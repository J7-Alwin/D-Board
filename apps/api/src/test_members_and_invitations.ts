import { prisma } from './prisma.js';
import { memberService } from './services/member.service.js';
import { invitationService } from './services/invitation.service.js';
import { workService } from './services/work.service.js';

async function runTests() {
  console.log('🚀 Starting Members, Invitations, and My Work Integration Test Suite...');

  // 1. Create or upsert test users
  const adminUser = await prisma.user.upsert({
    where: { email: 'inv_admin@example.com' },
    update: {},
    create: {
      email: 'inv_admin@example.com',
      username: 'invadmin',
      fullName: 'Invite Admin',
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'inv_member@example.com' },
    update: {},
    create: {
      email: 'inv_member@example.com',
      username: 'invmember',
      fullName: 'Invite Member',
    },
  });

  const outsiderUser = await prisma.user.upsert({
    where: { email: 'inv_outsider@example.com' },
    update: {},
    create: {
      email: 'inv_outsider@example.com',
      username: 'invoutsider',
      fullName: 'Invite Outsider',
    },
  });

  // 2. Create test project with adminUser as creator
  const project = await prisma.project.create({
    data: {
      name: 'Titan Workspace Platform',
      key: 'TWP',
      description: 'Enterprise workspace for developer productivity',
      createdById: adminUser.id,
      members: {
        create: {
          userId: adminUser.id,
          role: 'PROJECT_ADMIN',
        },
      },
    },
  });

  console.log(`✅ Test project created: ${project.name} (${project.id})`);

  // 3. Test Invitation Creation
  const invitation = await invitationService.createInvitation(project.id, adminUser.id, {
    email: 'inv_member@example.com',
    role: 'PROJECT_MEMBER',
    message: 'Welcome to Titan Workspace team!',
  });
  console.log(`✅ Invitation created for ${invitation.invitedEmail} (status: ${invitation.status})`);

  // 4. Test Duplicate Invitation Rejection
  let duplicateBlocked = false;
  try {
    await invitationService.createInvitation(project.id, adminUser.id, {
      email: 'inv_member@example.com',
      role: 'PROJECT_MEMBER',
    });
  } catch (err: any) {
    duplicateBlocked = true;
    console.log(`✅ Duplicate invitation prevented: "${err.message}"`);
  }
  if (!duplicateBlocked) throw new Error('Duplicate pending invitation was not blocked!');

  // 5. Test User-facing Invitations retrieval
  const userInvs = await invitationService.getUserInvitations(memberUser.id);
  console.log(`✅ Fetched user invitations: count = ${userInvs.length}`);
  if (userInvs.length !== 1 || userInvs[0].project.name !== 'Titan Workspace Platform') {
    throw new Error('User invitation list mismatch!');
  }

  // 6. Test Invitation Acceptance (Transactional)
  const acceptResult = await invitationService.acceptInvitation(invitation.id, memberUser.id);
  console.log(`✅ Invitation accepted: "${acceptResult.message}"`);

  // Verify membership created
  const projectMembers = await memberService.getProjectMembers(project.id, adminUser.id);
  console.log(`✅ Active members count: ${projectMembers.members.length}`);
  const joinedMember = projectMembers.members.find((m) => m.userId === memberUser.id);
  if (!joinedMember) throw new Error('Accepted user was not added to ProjectMember!');

  // 7. Test Double-Accept Prevention
  let doubleAcceptBlocked = false;
  try {
    await invitationService.acceptInvitation(invitation.id, memberUser.id);
  } catch (err: any) {
    doubleAcceptBlocked = true;
    console.log(`✅ Double accept prevented: "${err.message}"`);
  }
  if (!doubleAcceptBlocked) throw new Error('Double accept was not blocked!');

  // 8. Test Role Update (Admin demotes / promotes)
  const updatedRole = await memberService.updateMemberRole(
    project.id,
    joinedMember.id,
    'PROJECT_ADMIN',
    adminUser.id
  );
  console.log(`✅ Member promoted to: ${updatedRole.role}`);

  // Test Last-Admin / Creator protection
  let demoteCreatorBlocked = false;
  try {
    const creatorMember = projectMembers.members.find((m) => m.userId === adminUser.id);
    if (creatorMember) {
      await memberService.updateMemberRole(project.id, creatorMember.id, 'PROJECT_MEMBER', adminUser.id);
    }
  } catch (err: any) {
    demoteCreatorBlocked = true;
    console.log(`✅ Creator demote protected: "${err.message}"`);
  }
  if (!demoteCreatorBlocked) throw new Error('Creator demotion was not protected!');

  // 9. Create work items and test My Work aggregation
  const item1 = await workService.createWorkItem(project.id, adminUser.id, {
    title: 'Setup Kubernetes Cluster',
    type: 'TASK',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignedToId: memberUser.id,
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString(), // Due soon (in 3 days)
  });

  const item2 = await workService.createWorkItem(project.id, adminUser.id, {
    title: 'Fix Memory Leak in Ingress',
    type: 'BUG',
    priority: 'URGENT',
    status: 'TODO',
    assignedToId: memberUser.id,
    dueDate: new Date(Date.now() - 2 * 86400000).toISOString(), // Overdue
  });

  console.log(`✅ Created test work items: [${item1.title}], [${item2.title}]`);

  // Test getMyWorkItems
  const myWork = await workService.getMyWorkItems(memberUser.id, { tab: 'my-work' });
  console.log('✅ My Work summary metrics:', myWork.summary);
  console.log(`✅ My Work items returned: ${myWork.workItems.length}`);
  if (myWork.summary.total !== 2 || myWork.summary.dueSoon !== 1 || myWork.summary.overdue !== 1) {
    throw new Error('My Work summary counters mismatch!');
  }

  // Test Outsider has 0 items and cannot query other projects
  const outsiderWork = await workService.getMyWorkItems(outsiderUser.id, { tab: 'my-work' });
  if (outsiderWork.workItems.length !== 0) {
    throw new Error('Outsider should not see any work items!');
  }

  // 10. Test Member Removal
  const removeResult = await memberService.removeMember(project.id, joinedMember.id, adminUser.id);
  console.log(`✅ Member removed: "${removeResult.message}"`);

  // Verify removed member no longer sees work in My Work
  const myWorkAfterRemoval = await workService.getMyWorkItems(memberUser.id, { tab: 'my-work' });
  if (myWorkAfterRemoval.workItems.length !== 0) {
    throw new Error('Removed member should no longer see project work!');
  }

  // Cleanup
  await prisma.project.delete({ where: { id: project.id } });
  console.log('🧹 Cleaned up test project.');
  console.log('🎉 ALL MEMBERS, INVITATIONS, AND MY WORK INTEGRATION TESTS PASSED!');
}

runTests()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
