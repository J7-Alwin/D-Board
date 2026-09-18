import { prisma } from './prisma.js';
import { workService } from './services/work.service.js';
import { commentService } from './services/comment.service.js';
import { noteService } from './services/note.service.js';
import { invitationService } from './services/invitation.service.js';
import { notificationService } from './services/notification.service.js';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('🚀 Starting Notifications Vertical Slice Integration Tests...\n');

  const testSuffix = Date.now().toString();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Setup Test Users: Admin/Author (A), Member/Assignee (B), Member (C), Non-member (D)
  const userA = await prisma.user.create({
    data: {
      email: `user_a_${testSuffix}@example.com`,
      username: `usera_${testSuffix}`,
      passwordHash,
      fullName: 'User A (Admin)',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `user_b_${testSuffix}@example.com`,
      username: `userb_${testSuffix}`,
      passwordHash,
      fullName: 'User B (Member)',
    },
  });

  const userC = await prisma.user.create({
    data: {
      email: `user_c_${testSuffix}@example.com`,
      username: `userc_${testSuffix}`,
      passwordHash,
      fullName: 'User C (Member)',
    },
  });

  const userD = await prisma.user.create({
    data: {
      email: `user_d_${testSuffix}@example.com`,
      username: `userd_${testSuffix}`,
      passwordHash,
      fullName: 'User D (External)',
    },
  });

  // Setup Project
  const project = await prisma.project.create({
    data: {
      name: `Notification Test Project ${testSuffix}`,
      key: `NOTIF${testSuffix.slice(-3)}`,
      description: 'Project for testing notification flows',
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

  console.log(`✅ Test project and users initialized (Project: ${project.id})`);

  try {
    // ----------------------------------------------------
    // TEST 1: WorkItem Assignment Notification
    // ----------------------------------------------------
    console.log('\n--- TEST 1: WorkItem Assignment Notification ---');
    const workItem = await workService.createWorkItem(project.id, userA.id, {
      title: 'Implement Dark Mode',
      type: 'TASK',
      status: 'TODO',
      priority: 'HIGH',
      assignedToId: userB.id,
    });

    const notifsB1 = await notificationService.getUserNotifications(userB.id);
    const notifsA1 = await notificationService.getUserNotifications(userA.id);
    const notifsC1 = await notificationService.getUserNotifications(userC.id);

    console.assert(notifsB1.notifications.length === 1, `Expected 1 notification for B, got ${notifsB1.notifications.length}`);
    console.assert(notifsB1.notifications[0].type === 'WORK_ASSIGNED', 'Expected WORK_ASSIGNED type');
    console.assert(notifsA1.notifications.length === 0, 'Actor A should not receive self-notification');
    console.assert(notifsC1.notifications.length === 0, 'Unrelated user C should receive no notification');
    console.log('✅ TEST 1 PASSED: Assignee B received WORK_ASSIGNED; Actor A and C received nothing.');

    // ----------------------------------------------------
    // TEST 2: Comment on WorkItem Notification
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Comment on WorkItem Notification ---');
    const comment = await commentService.createComment(userC.id, project.id, workItem.id, {
      content: 'I have started testing the UI components.',
    });

    const notifsB2 = await notificationService.getUserNotifications(userB.id);
    const notifsA2 = await notificationService.getUserNotifications(userA.id);
    const notifsC2 = await notificationService.getUserNotifications(userC.id);

    // B (assignee) should have 2 notifications total (1 assignment + 1 comment)
    console.assert(notifsB2.notifications.length === 2, `Expected 2 notifications for B, got ${notifsB2.notifications.length}`);
    console.assert(notifsB2.notifications[0].type === 'WORK_COMMENTED', 'Expected WORK_COMMENTED for B');

    // A (creator) should have 1 notification (comment)
    console.assert(notifsA2.notifications.length === 1, `Expected 1 notification for A, got ${notifsA2.notifications.length}`);
    console.assert(notifsA2.notifications[0].type === 'WORK_COMMENTED', 'Expected WORK_COMMENTED for A');

    // C (comment author) should have 0 notifications (actor excluded)
    console.assert(notifsC2.notifications.length === 0, 'Author C should not receive self-notification');
    console.log('✅ TEST 2 PASSED: Assignee B & Creator A received WORK_COMMENTED; Author C excluded.');

    // ----------------------------------------------------
    // TEST 3: Note with @team Notification
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Note with @team Notification ---');
    await noteService.createNote(project.id, userA.id, {
      title: 'Sprint Retrospective Notes',
      content: 'Hey @team, please review the retrospective action items before tomorrow.',
      pinned: false,
    });

    const notifsB3 = await notificationService.getUserNotifications(userB.id);
    const notifsC3 = await notificationService.getUserNotifications(userC.id);
    const notifsA3 = await notificationService.getUserNotifications(userA.id);

    const teamNotifB = notifsB3.notifications.find((n) => n.type === 'NOTE_TEAM_UPDATED');
    const teamNotifC = notifsC3.notifications.find((n) => n.type === 'NOTE_TEAM_UPDATED');
    const teamNotifA = notifsA3.notifications.find((n) => n.type === 'NOTE_TEAM_UPDATED');

    console.assert(!!teamNotifB, 'User B should receive NOTE_TEAM_UPDATED');
    console.assert(!!teamNotifC, 'User C should receive NOTE_TEAM_UPDATED');
    console.assert(!teamNotifA, 'Author A should not receive NOTE_TEAM_UPDATED');
    console.log('✅ TEST 3 PASSED: Members B and C received NOTE_TEAM_UPDATED; Author A excluded.');

    // ----------------------------------------------------
    // TEST 4: Project Invitation Notification
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Project Invitation Notification ---');
    const invitation = await invitationService.createInvitation(project.id, userA.id, {
      email: userD.email,
      role: 'PROJECT_MEMBER',
      message: 'Join our team!',
    });

    const notifsD = await notificationService.getUserNotifications(userD.id);
    console.assert(notifsD.notifications.length === 1, `Expected 1 notification for D, got ${notifsD.notifications.length}`);
    console.assert(notifsD.notifications[0].type === 'PROJECT_INVITED', 'Expected PROJECT_INVITED');
    console.log('✅ TEST 4 PASSED: Registered user D received in-app PROJECT_INVITED notification.');

    // ----------------------------------------------------
    // TEST 5: Invitation Acceptance Notification
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Invitation Acceptance Notification ---');
    await invitationService.acceptInvitation(invitation.id, userD.id);

    const notifsA5 = await notificationService.getUserNotifications(userA.id);
    const acceptedNotifA = notifsA5.notifications.find((n) => n.type === 'INVITATION_ACCEPTED');
    console.assert(!!acceptedNotifA, 'Inviter A should receive INVITATION_ACCEPTED');
    console.log('✅ TEST 5 PASSED: Inviter A received INVITATION_ACCEPTED notification.');

    // ----------------------------------------------------
    // TEST 6: Unread Count Accuracy
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Unread Count Accuracy ---');
    const unreadCountB = await notificationService.getUnreadCount(userB.id);
    console.assert(unreadCountB === 3, `Expected unread count 3 for B, got ${unreadCountB}`);
    console.log(`✅ TEST 6 PASSED: User B unread count accurately computed as ${unreadCountB}.`);

    // ----------------------------------------------------
    // TEST 7: Mark Single Notification As Read
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Mark Single Notification As Read ---');
    const targetNotifId = notifsB3.notifications[0].id;
    const markedNotif = await notificationService.markAsRead(targetNotifId, userB.id);
    console.assert(markedNotif.readAt !== null, 'readAt should be populated');

    const newUnreadCountB = await notificationService.getUnreadCount(userB.id);
    console.assert(newUnreadCountB === 2, `Expected unread count 2, got ${newUnreadCountB}`);
    console.log('✅ TEST 7 PASSED: Single notification marked read; unread count decremented.');

    // ----------------------------------------------------
    // TEST 8: Mark All Notifications As Read
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Mark All Notifications As Read ---');
    const markAllResult = await notificationService.markAllAsRead(userB.id);
    console.assert(markAllResult.updatedCount === 2, `Expected 2 updated, got ${markAllResult.updatedCount}`);

    const finalUnreadCountB = await notificationService.getUnreadCount(userB.id);
    console.assert(finalUnreadCountB === 0, `Expected 0 unread for B, got ${finalUnreadCountB}`);
    console.log('✅ TEST 8 PASSED: All notifications marked as read; unread count is now 0.');

    // ----------------------------------------------------
    // TEST 9: Category Filters & Pagination
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Category Filters & Pagination ---');
    const assignmentsFilter = await notificationService.getUserNotifications(userB.id, {
      category: 'ASSIGNMENTS',
    });
    console.assert(assignmentsFilter.notifications.length === 1, `Expected 1 assignment notification, got ${assignmentsFilter.notifications.length}`);
    console.assert(assignmentsFilter.notifications[0].type === 'WORK_ASSIGNED', 'Expected WORK_ASSIGNED');

    const commentsFilter = await notificationService.getUserNotifications(userB.id, {
      category: 'COMMENTS',
    });
    console.assert(commentsFilter.notifications.length === 1, `Expected 1 comment notification, got ${commentsFilter.notifications.length}`);

    const mentionsFilter = await notificationService.getUserNotifications(userB.id, {
      category: 'MENTIONS',
    });
    console.assert(mentionsFilter.notifications.length === 1, `Expected 1 team mention notification, got ${mentionsFilter.notifications.length}`);

    const paginated = await notificationService.getUserNotifications(userB.id, {
      page: 1,
      limit: 2,
    });
    console.assert(paginated.notifications.length === 2, 'Expected 2 notifications on page 1');
    console.assert(paginated.pagination.totalPages === 2, 'Expected 2 total pages');
    console.log('✅ TEST 9 PASSED: Category filters (ASSIGNMENTS, COMMENTS, MENTIONS) & pagination verified.');

    // ----------------------------------------------------
    // TEST 10: Delete Notification
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Delete Notification ---');
    const deleteRes = await notificationService.deleteNotification(targetNotifId, userB.id);
    console.assert(deleteRes.success === true, 'Delete should return success');

    const afterDelete = await notificationService.getUserNotifications(userB.id);
    console.assert(afterDelete.notifications.length === 2, 'Expected count to be 2 after deleting 1');
    console.log('✅ TEST 10 PASSED: Notification successfully deleted.');

    console.log('\n==================================================');
    console.log('🎉 ALL NOTIFICATIONS INTEGRATION TESTS PASSED 🎉');
    console.log('==================================================');
  } finally {
    // Cleanup fixtures
    console.log('\n🧹 Cleaning up test database fixtures...');
    await prisma.notification.deleteMany({
      where: {
        recipientId: { in: [userA.id, userB.id, userC.id, userD.id] },
      },
    });
    await prisma.activity.deleteMany({ where: { projectId: project.id } });
    await prisma.comment.deleteMany({ where: { workItem: { projectId: project.id } } });
    await prisma.noteMention.deleteMany({ where: { note: { projectId: project.id } } });
    await prisma.note.deleteMany({ where: { projectId: project.id } });
    await prisma.workItem.deleteMany({ where: { projectId: project.id } });
    await prisma.invitation.deleteMany({ where: { projectId: project.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id, userD.id] } },
    });
    console.log('✅ Cleanup complete.');
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
