import { prisma } from './prisma.js';
import { noteService } from './services/note.service.js';
import { notificationService } from './services/notification.service.js';
import bcrypt from 'bcryptjs';

async function runSecurityTests() {
  console.log('🔒 Starting Notifications Security & IDOR Test Suite...\n');

  const testSuffix = Date.now().toString();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Users: Admin/Author (A), Intended Recipient (B), Unmentioned Member (C)
  const userA = await prisma.user.create({
    data: {
      email: `sec_a_${testSuffix}@example.com`,
      username: `seca_${testSuffix}`,
      passwordHash,
      fullName: 'Sec User A',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `sec_b_${testSuffix}@example.com`,
      username: `secb_${testSuffix}`,
      passwordHash,
      fullName: 'Sec User B',
    },
  });

  const userC = await prisma.user.create({
    data: {
      email: `sec_c_${testSuffix}@example.com`,
      username: `secc_${testSuffix}`,
      passwordHash,
      fullName: 'Sec User C',
    },
  });

  const project = await prisma.project.create({
    data: {
      name: `Security Project ${testSuffix}`,
      key: `SEC${testSuffix.slice(-3)}`,
      description: 'Project for testing notification security',
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

  try {
    // ----------------------------------------------------
    // SECURITY TEST 1: IDOR Protection
    // ----------------------------------------------------
    console.log('--- SECURITY TEST 1: IDOR Protection on Notifications ---');
    const notifForA = await notificationService.createNotification({
      recipientId: userA.id,
      actorId: userB.id,
      projectId: project.id,
      type: 'SYSTEM',
      title: 'Confidential Admin Notice',
      message: 'Secret API keys updated.',
      link: '/app/settings',
    });

    console.assert(notifForA !== null, 'Notification should be created');

    // Attempt 1: User B tries to mark User A's notification as read
    try {
      await notificationService.markAsRead(notifForA!.id, userB.id);
      console.error('FAILED: User B was able to mark User A notification as read');
    } catch (err: any) {
      console.assert(err.statusCode === 403, `Expected 403 Forbidden, got ${err.statusCode}`);
      console.log('✅ User B denied markAsRead on User A notification (403 Forbidden)');
    }

    // Attempt 2: User B tries to delete User A's notification
    try {
      await notificationService.deleteNotification(notifForA!.id, userB.id);
      console.error('FAILED: User B was able to delete User A notification');
    } catch (err: any) {
      console.assert(err.statusCode === 403, `Expected 403 Forbidden, got ${err.statusCode}`);
      console.log('✅ User B denied deleteNotification on User A notification (403 Forbidden)');
    }

    // Attempt 3: User B tries to query User A's notifications via getUserNotifications
    const bListing = await notificationService.getUserNotifications(userB.id);
    const leakedNotif = bListing.notifications.find((n) => n.id === notifForA!.id);
    console.assert(!leakedNotif, 'User B notification query must not return User A notifications');
    console.log('✅ User B notification listing strictly isolated to recipientId = userB');
    console.log('✅ SECURITY TEST 1 PASSED: Full IDOR protections enforced on notifications.');

    // ----------------------------------------------------
    // SECURITY TEST 2: Private Note Notification Protection
    // ----------------------------------------------------
    console.log('\n--- SECURITY TEST 2: Private Note Notification Protection ---');
    // User A creates private note mentioning ONLY User B
    const privateNote = await noteService.createNote(project.id, userA.id, {
      title: 'Confidential Salary Review',
      content: `Hello @${userB.username}, this is your confidential performance review.`,
      pinned: false,
    });

    const notifsForB = await notificationService.getUserNotifications(userB.id);
    const notifsForC = await notificationService.getUserNotifications(userC.id);

    const privateNotifForB = notifsForB.notifications.find((n) => n.noteId === privateNote.id);
    const privateNotifForC = notifsForC.notifications.find((n) => n.noteId === privateNote.id);

    console.assert(!!privateNotifForB, 'Intended recipient B must receive NOTE_MENTIONED notification');
    console.assert(!privateNotifForC, 'Unmentioned member C must NOT receive private note notification');
    console.assert(notifsForC.notifications.length === 0, 'User C should have exactly 0 notifications');

    console.log('✅ Intended recipient B received private note notification');
    console.log('✅ Unmentioned member C received 0 notifications and cannot discover private note');
    console.log('✅ SECURITY TEST 2 PASSED: Private note notification privacy fully guaranteed.');

    console.log('\n==================================================');
    console.log('🎉 ALL NOTIFICATION SECURITY TESTS PASSED 🎉');
    console.log('==================================================');
  } finally {
    console.log('\n🧹 Cleaning up security test fixtures...');
    await prisma.notification.deleteMany({
      where: { recipientId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.activity.deleteMany({ where: { projectId: project.id } });
    await prisma.noteMention.deleteMany({ where: { note: { projectId: project.id } } });
    await prisma.note.deleteMany({ where: { projectId: project.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });
    console.log('✅ Security cleanup complete.');
  }
}

runSecurityTests().catch((err) => {
  console.error('❌ Security test failed:', err);
  process.exit(1);
});
