import { io as Client, Socket } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { prisma } from './prisma.js';
import { generateJwt } from './utils/security.js';
import { initRealtime } from './realtime/realtime.service.js';
import { noteService } from './services/note.service.js';
import bcrypt from 'bcryptjs';

async function runSecurityTests() {
  console.log('🔒 Starting Real-Time Security & Private Note Isolation Tests...\n');

  const app = express();
  const server = http.createServer(app);
  initRealtime(server);

  await new Promise<void>((resolve) => {
    server.listen(5098, () => resolve());
  });

  const SERVER_URL = 'http://localhost:5098';
  const testSuffix = Date.now().toString();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Setup Test Users: Owner (User A), Member Mentioned (User B), Member Not Mentioned (User C)
  const usernameA = `sec_usera_${testSuffix}`;
  const usernameB = `sec_userb_${testSuffix}`;
  const usernameC = `sec_userc_${testSuffix}`;

  const userA = await prisma.user.create({
    data: {
      email: `${usernameA}@example.com`,
      username: usernameA,
      passwordHash,
      fullName: 'Security User A',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `${usernameB}@example.com`,
      username: usernameB,
      passwordHash,
      fullName: 'Security User B',
    },
  });

  const userC = await prisma.user.create({
    data: {
      email: `${usernameC}@example.com`,
      username: usernameC,
      passwordHash,
      fullName: 'Security User C',
    },
  });

  const tokenA = generateJwt({ userId: userA.id, email: userA.email, username: userA.username });
  const tokenB = generateJwt({ userId: userB.id, email: userB.email, username: userB.username });
  const tokenC = generateJwt({ userId: userC.id, email: userC.email, username: userC.username });

  const project = await prisma.project.create({
    data: {
      name: `Security RT Project ${testSuffix}`,
      key: `SRT${testSuffix.slice(-3)}`,
      description: 'Project for testing real-time note isolation',
      createdById: userA.id,
      members: {
        create: [
          { userId: userA.id, role: 'PROJECT_ADMIN' },
          { userId: userB.id, role: 'PROJECT_MEMBER' },
          { userId: userC.id, role: 'PROJECT_MEMBER' },
        ],
      },
    },
  });

  let clientA: Socket | null = null;
  let clientB: Socket | null = null;
  let clientC: Socket | null = null;

  try {
    clientA = await new Promise<Socket>((resolve, reject) => {
      const s = Client(SERVER_URL, { auth: { token: tokenA }, transports: ['websocket'] });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });

    clientB = await new Promise<Socket>((resolve, reject) => {
      const s = Client(SERVER_URL, { auth: { token: tokenB }, transports: ['websocket'] });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });

    clientC = await new Promise<Socket>((resolve, reject) => {
      const s = Client(SERVER_URL, { auth: { token: tokenC }, transports: ['websocket'] });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });

    // All clients join the project room
    await Promise.all([
      new Promise<void>((res) => clientA!.emit('join:project', { projectId: project.id }, () => res())),
      new Promise<void>((res) => clientB!.emit('join:project', { projectId: project.id }, () => res())),
      new Promise<void>((res) => clientC!.emit('join:project', { projectId: project.id }, () => res())),
    ]);

    // TEST 1: Private Note Isolation
    console.log('Test 1: Private @username note is delivered ONLY to author and mentioned user');
    let clientBReceived = false;
    let clientCReceived = false;

    clientB.on('NOTE_CREATED', (data) => {
      if (data.title === 'Top Secret Strategy') {
        clientBReceived = true;
      }
    });

    clientC.on('NOTE_CREATED', (data) => {
      if (data.title === 'Top Secret Strategy') {
        clientCReceived = true;
      }
    });

    const privateNote = await noteService.createNote(project.id, userA.id, {
      title: 'Top Secret Strategy',
      content: `Here are the secret keys @${usernameB} strictly confidential`,
    });

    // Wait 300ms for event dissemination
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (clientBReceived) {
      console.log('  ✓ Mentioned user (Client B) received private NOTE_CREATED event');
    } else {
      throw new Error('Mentioned user (Client B) did NOT receive private NOTE_CREATED event');
    }

    if (!clientCReceived) {
      console.log('  ✓ Unmentioned project member (Client C) received ZERO events (no leakage)');
    } else {
      throw new Error('SECURITY VIOLATION: Private note event leaked to unmentioned project member!');
    }

    // TEST 2: Team Note Broadcast
    console.log('\nTest 2: Team @team note is broadcast to all project members');
    let teamBReceived = false;
    let teamCReceived = false;

    clientB.on('NOTE_CREATED', (data) => {
      if (data.title === 'All Hands Announcement') {
        teamBReceived = true;
      }
    });

    clientC.on('NOTE_CREATED', (data) => {
      if (data.title === 'All Hands Announcement') {
        teamCReceived = true;
      }
    });

    await noteService.createNote(project.id, userA.id, {
      title: 'All Hands Announcement',
      content: `Welcome @team to the new sprint!`,
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (teamBReceived && teamCReceived) {
      console.log('  ✓ Both members (Client B & C) received public @team NOTE_CREATED event');
    } else {
      throw new Error('Team note failed to broadcast to all members');
    }

    // TEST 3: Private Note Deletion Isolation
    console.log('\nTest 3: Private note deletion is isolated from unmentioned members');
    let deleteBReceived = false;
    let deleteCReceived = false;

    clientB.on('NOTE_DELETED', (data) => {
      if (data.noteId === privateNote.id) {
        deleteBReceived = true;
      }
    });

    clientC.on('NOTE_DELETED', (data) => {
      if (data.noteId === privateNote.id) {
        deleteCReceived = true;
      }
    });

    await noteService.deleteNote(project.id, privateNote.id, userA.id);
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (deleteBReceived && !deleteCReceived) {
      console.log('  ✓ Private NOTE_DELETED event delivered strictly to mentioned member, blocked from Client C');
    } else {
      throw new Error(`Deletion event isolation failed (B: ${deleteBReceived}, C: ${deleteCReceived})`);
    }

    console.log('\n🔒 ALL REAL-TIME SECURITY & ISOLATION TESTS PASSED WITH ZERO LEAKS!\n');
  } finally {
    if (clientA) clientA.close();
    if (clientB) clientB.close();
    if (clientC) clientC.close();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    // Clean DB
    await prisma.noteMention.deleteMany({ where: { note: { projectId: project.id } } });
    await prisma.note.deleteMany({ where: { projectId: project.id } });
    await prisma.activity.deleteMany({ where: { projectId: project.id } });
    await prisma.notification.deleteMany({ where: { projectId: project.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });
  }
}

runSecurityTests().catch((err) => {
  console.error('❌ Security Tests Failed:', err);
  process.exit(1);
});
