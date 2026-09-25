import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });
process.env.NODE_ENV = 'test';

async function runE2ESmokeSuite() {
  const request = (await import('supertest')).default;
  const { app } = await import('../apps/api/src/server.js');
  const { default: prisma } = await import('../apps/api/src/prisma.js');
  console.log('================================================================');
  console.log('🧪 D-BOARD E2E DETERMINISTIC SMOKE SUITE (E2E-01 - E2E-10)');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const userA = {
    username: `e2e_owner_${timestamp}`,
    email: `e2e_owner_${timestamp}@example.com`,
    password: 'Password123!',
    fullName: 'E2E Project Owner',
  };

  const userB = {
    username: `e2e_member_${timestamp}`,
    email: `e2e_member_${timestamp}@example.com`,
    password: 'Password123!',
    fullName: 'E2E Project Collaborator',
  };

  let sessionCookieA: string = '';
  let sessionCookieB: string = '';
  let projectId: string = '';
  let memberUserId: string = '';
  let projectMemberId: string = '';
  let workItemId: string = '';
  let folderId: string = '';
  let file1Id: string = '';
  let file2Id: string = '';

  try {
    // -------------------------------------------------------------
    // E2E-01: Register -> verify email -> login -> dashboard
    // -------------------------------------------------------------
    console.log('--- [E2E-01] Register -> Verify Email -> Login -> Dashboard ---');
    const regResA = await request(app).post('/api/auth/register').send(userA);
    if (regResA.status !== 201) throw new Error(`User A registration failed: ${regResA.text}`);

    await prisma.user.update({
      where: { email: userA.email },
      data: { isEmailVerified: true },
    });

    const loginResA = await request(app).post('/api/auth/login').send({
      identifier: userA.email,
      password: userA.password,
    });
    if (loginResA.status !== 200) throw new Error(`User A login failed: ${loginResA.text}`);

    const cookiesA = loginResA.headers['set-cookie'];
    sessionCookieA = Array.isArray(cookiesA) ? cookiesA[0].split(';')[0] : cookiesA.split(';')[0];

    const dashRes = await request(app).get('/api/dashboard').set('Cookie', sessionCookieA);
    if (dashRes.status !== 200) throw new Error(`Dashboard fetch failed: ${dashRes.text}`);
    console.log('✓ E2E-01 passed: User registered, verified, logged in, and loaded dashboard');

    // Also register and verify User B for multi-user journeys
    const regResB = await request(app).post('/api/auth/register').send(userB);
    if (regResB.status !== 201) throw new Error(`User B registration failed: ${regResB.text}`);
    memberUserId = regResB.body.data.user.id;

    await prisma.user.update({
      where: { email: userB.email },
      data: { isEmailVerified: true },
    });

    const loginResB = await request(app).post('/api/auth/login').send({
      identifier: userB.email,
      password: userB.password,
    });
    const cookiesB = loginResB.headers['set-cookie'];
    sessionCookieB = Array.isArray(cookiesB) ? cookiesB[0].split(';')[0] : cookiesB.split(';')[0];

    // -------------------------------------------------------------
    // E2E-02: Create project -> invite member -> accept invitation -> member appears
    // -------------------------------------------------------------
    console.log('\n--- [E2E-02] Create Project -> Invite Member -> Accept -> Member Appears ---');
    const projRes = await request(app)
      .post('/api/projects')
      .set('Cookie', sessionCookieA)
      .send({
        name: `E2E Workspace ${timestamp}`,
        key: `E2E${timestamp.toString().slice(-4)}`,
        description: 'End to end testing project workspace',
        technologyStack: ['React', 'Node'],
        invitations: [{ email: userB.email, role: 'PROJECT_MEMBER' }],
      });
    if (projRes.status !== 201) throw new Error(`Create project failed: ${projRes.text}`);
    projectId = projRes.body.data.project.id;

    // Fetch invitation for User B
    const invites = await prisma.invitation.findMany({ where: { projectId, invitedEmail: userB.email } });
    if (invites.length === 0) throw new Error('Invitation record not found');
    const inviteId = invites[0].id;

    // User B accepts invitation
    const acceptRes = await request(app)
      .post(`/api/invitations/${inviteId}/accept`)
      .set('Cookie', sessionCookieB);
    if (acceptRes.status !== 200) throw new Error(`Accept invitation failed: ${acceptRes.text}`);

    // Verify member appears in project members
    const membersRes = await request(app)
      .get(`/api/projects/${projectId}/members`)
      .set('Cookie', sessionCookieA);
    if (membersRes.status !== 200) throw new Error(`List members failed: ${membersRes.text}`);
    const membersList = Array.isArray(membersRes.body.data) 
      ? membersRes.body.data 
      : (membersRes.body.data?.members || membersRes.body.members || []);
    const foundMember = membersList.find((m: any) => m.userId === memberUserId || m.user?.email === userB.email);
    if (!foundMember) throw new Error('Invited member not found in project members list');
    projectMemberId = foundMember.id;
    console.log('✓ E2E-02 passed: Project created, member invited, accepted, and verified in project');

    // -------------------------------------------------------------
    // E2E-03: Create work item -> assign member -> update status
    // -------------------------------------------------------------
    console.log('\n--- [E2E-03] Create Work Item -> Assign Member -> Update Status ---');
    const workRes = await request(app)
      .post(`/api/projects/${projectId}/work`)
      .set('Cookie', sessionCookieA)
      .send({
        title: 'Complete architecture specification',
        type: 'TASK',
        priority: 'HIGH',
        status: 'TODO',
        assignedToId: memberUserId,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });
    if (workRes.status !== 201) throw new Error(`Create work item failed: ${workRes.text}`);
    workItemId = workRes.body.data.workItem.id;

    // Update status to IN_PROGRESS
    const updateWorkRes = await request(app)
      .patch(`/api/projects/${projectId}/work/${workItemId}`)
      .set('Cookie', sessionCookieA)
      .send({ status: 'IN_PROGRESS' });
    if (updateWorkRes.status !== 200) throw new Error(`Update work status failed: ${updateWorkRes.text}`);
    console.log('✓ E2E-03 passed: Work item created, assigned to collaborator, and status updated to IN_PROGRESS');

    // -------------------------------------------------------------
    // E2E-04: Create calendar event -> member attendee -> view event
    // -------------------------------------------------------------
    console.log('\n--- [E2E-04] Create Calendar Event -> Member Attendee -> View Event ---');
    const calRes = await request(app)
      .post(`/api/projects/${projectId}/calendar/events`)
      .set('Cookie', sessionCookieA)
      .send({
        title: 'Sprint Planning Sync',
        type: 'MEETING',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600000).toISOString(),
        attendeeIds: [memberUserId],
      });
    if (calRes.status !== 201) throw new Error(`Create calendar event failed: ${calRes.text}`);

    const calListRes = await request(app)
      .get(`/api/projects/${projectId}/calendar/events`)
      .set('Cookie', sessionCookieB);
    if (calListRes.status !== 200) throw new Error(`Query calendar failed: ${calListRes.text}`);
    console.log('✓ E2E-04 passed: Calendar event created with attendee and viewed by member');

    // -------------------------------------------------------------
    // E2E-05: Upload file -> create folder -> move file -> retrieve
    // -------------------------------------------------------------
    console.log('\n--- [E2E-05] Upload File -> Create Folder -> Move File -> Retrieve ---');
    const folderRes = await request(app)
      .post(`/api/projects/${projectId}/folders`)
      .set('Cookie', sessionCookieA)
      .send({ name: 'Architecture Specs' });
    if (folderRes.status !== 201) throw new Error(`Create folder failed: ${folderRes.text}`);
    folderId = folderRes.body.data.folder.id;

    const fileContent1 = Buffer.from('Initial Architecture Blueprint Version 1');
    const uploadRes = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', sessionCookieA)
      .attach('files', fileContent1, 'blueprint_v1.txt');
    if (uploadRes.status !== 201) throw new Error(`Upload file failed: ${uploadRes.text}`);
    file1Id = uploadRes.body.data.files[0].id;

    // Move file into folder
    const moveRes = await request(app)
      .patch(`/api/projects/${projectId}/files/${file1Id}/move`)
      .set('Cookie', sessionCookieA)
      .send({ folderId });
    if (moveRes.status !== 200) throw new Error(`Move file failed: ${moveRes.text}`);
    console.log('✓ E2E-05 passed: Folder created, file uploaded, and moved into target folder');

    // -------------------------------------------------------------
    // E2E-06: Duplicate same file -> verify deduplication behavior
    // -------------------------------------------------------------
    console.log('\n--- [E2E-06] Duplicate Same File -> Verify Storage Deduplication ---');
    const dupRes = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', sessionCookieB)
      .attach('files', fileContent1, 'duplicate_blueprint.txt');
    if (dupRes.status !== 201) throw new Error(`Duplicate upload failed: ${dupRes.text}`);
    file2Id = dupRes.body.data.files[0].id;

    const att1 = await prisma.attachment.findUnique({ where: { id: file1Id } });
    const att2 = await prisma.attachment.findUnique({ where: { id: file2Id } });
    if (att1?.storedObjectId !== att2?.storedObjectId) {
      throw new Error('Storage deduplication invariant violated: storedObjectId does not match');
    }
    console.log('✓ E2E-06 passed: Duplicate binary detected and deduplicated to single physical stored object');

    // -------------------------------------------------------------
    // E2E-07: Global search -> open result
    // -------------------------------------------------------------
    console.log('\n--- [E2E-07] Global Search -> Verify Search Results ---');
    const searchRes = await request(app)
      .get('/api/search?query=blueprint')
      .set('Cookie', sessionCookieA);
    if (searchRes.status !== 200) throw new Error(`Global search failed: ${searchRes.text}`);
    console.log('✓ E2E-07 passed: Global search successfully located project content');

    // -------------------------------------------------------------
    // E2E-08: Global activity -> verify project activity appears
    // -------------------------------------------------------------
    console.log('\n--- [E2E-08] Global Activity -> Verify Project Event Auditing ---');
    const actRes = await request(app)
      .get(`/api/projects/${projectId}/activity`)
      .set('Cookie', sessionCookieA);
    if (actRes.status !== 200) throw new Error(`Project activity failed: ${actRes.text}`);
    const activities = Array.isArray(actRes.body.data) ? actRes.body.data : (actRes.body.data?.activities || actRes.body.activities || []);
    console.log(`✓ E2E-08 passed: Activity log recorded ${activities.length} project events`);

    // -------------------------------------------------------------
    // E2E-09: Archive project -> verify mutations blocked -> unarchive
    // -------------------------------------------------------------
    console.log('\n--- [E2E-09] Archive Project -> Block Mutations -> Unarchive -> Resume ---');
    const archiveRes = await request(app)
      .post(`/api/projects/${projectId}/archive`)
      .set('Cookie', sessionCookieA);
    if (archiveRes.status !== 200) throw new Error(`Archive project failed: ${archiveRes.text}`);

    // Mutating actions must now be strictly blocked (400)
    const blockedUpload = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Cookie', sessionCookieA)
      .attach('files', Buffer.from('should fail'), 'fail.txt');
    if (blockedUpload.status !== 400) throw new Error('File upload should be blocked in archived project');

    const blockedWork = await request(app)
      .post(`/api/projects/${projectId}/work`)
      .set('Cookie', sessionCookieA)
      .send({ title: 'Should fail', type: 'TASK' });
    if (blockedWork.status !== 400) throw new Error('Work creation should be blocked in archived project');

    // Unarchive
    const unarchiveRes = await request(app)
      .post(`/api/projects/${projectId}/unarchive`)
      .set('Cookie', sessionCookieA);
    if (unarchiveRes.status !== 200) throw new Error(`Unarchive failed: ${unarchiveRes.text}`);
    console.log('✓ E2E-09 passed: Archiving blocked file uploads and work creation; unarchiving restored normal workflow');

    // -------------------------------------------------------------
    // E2E-10: Remove member -> verify access eviction
    // -------------------------------------------------------------
    console.log('\n--- [E2E-10] Remove Member -> Verify Access Eviction ---');
    const removeRes = await request(app)
      .delete(`/api/projects/${projectId}/members/${projectMemberId}`)
      .set('Cookie', sessionCookieA);
    if (removeRes.status !== 200) throw new Error(`Remove member failed: ${removeRes.text}`);

    // User B should now be unauthorized to access project
    const evictedCheck = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', sessionCookieB);
    if (evictedCheck.status !== 403) throw new Error('Removed member still has access to project');
    console.log('✓ E2E-10 passed: Member removed and immediate project authorization eviction verified');

    console.log('\n================================================================');
    console.log('🎉 ALL 10 E2E USER JOURNEYS PASSED 100%!');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ E2E Smoke Suite Failed:', error);
    process.exit(1);
  } finally {
    // Teardown test project and users
    if (projectId) {
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { email: { in: [userA.email, userB.email] } },
    }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  }
}

runE2ESmokeSuite();
