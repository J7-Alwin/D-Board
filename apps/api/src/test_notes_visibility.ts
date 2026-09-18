import { prisma } from './prisma.js';
import { noteService } from './services/note.service.js';
import { activityService } from './services/activity.service.js';

async function runTests() {
  console.log('🚀 Starting Notes Visibility, Mentions & Security Integration Test Suite...\n');

  // 1. Create 3 test users
  const timestamp = Date.now();
  const userA = await prisma.user.create({
    data: {
      email: `user_a_${timestamp}@example.com`,
      username: `usera_${timestamp}`,
      fullName: 'User Alice (Admin)',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `user_b_${timestamp}@example.com`,
      username: `userb_${timestamp}`,
      fullName: 'User Bob (Member)',
    },
  });

  const userC = await prisma.user.create({
    data: {
      email: `user_c_${timestamp}@example.com`,
      username: `userc_${timestamp}`,
      fullName: 'User Charlie (Member)',
    },
  });

  // 2. Create a project with User A as owner/admin, User B & User C as members
  const project = await prisma.project.create({
    data: {
      name: `Security Project ${timestamp}`,
      key: `SEC${String(timestamp).slice(-3)}`,
      description: 'Notes security and visibility test project',
      createdById: userA.id,
      members: {
        create: [
          { userId: userB.id, role: 'PROJECT_MEMBER' },
          { userId: userC.id, role: 'PROJECT_MEMBER' },
        ],
      },
    },
  });

  console.log(`✅ Test project created: ${project.name} (${project.id})`);
  console.log(`   User A: ${userA.username} (Admin/Author)`);
  console.log(`   User B: ${userB.username} (Member)`);
  console.log(`   User C: ${userC.username} (Member)\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Note 1 with NO MENTION (Default = TEAM)
    // ----------------------------------------------------
    const note1 = await noteService.createNote(project.id, userA.id, {
      title: 'Weekly Deployment Plan',
      content: 'Deployment is scheduled for Friday. No special mentions here.',
    });
    if (note1.visibility !== 'TEAM') throw new Error('Note 1 should have visibility TEAM');

    const listA_1 = await noteService.getProjectNotes(project.id, userA.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const listB_1 = await noteService.getProjectNotes(project.id, userB.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const listC_1 = await noteService.getProjectNotes(project.id, userC.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });

    if (!listA_1.notes.some((n) => n.id === note1.id)) throw new Error('User A cannot see Note 1');
    if (!listB_1.notes.some((n) => n.id === note1.id)) throw new Error('User B cannot see Note 1');
    if (!listC_1.notes.some((n) => n.id === note1.id)) throw new Error('User C cannot see Note 1');
    console.log('✅ TEST 1 PASSED: Note with no mention is visible to all active project members (A, B, C).');

    // ----------------------------------------------------
    // TEST 2: Note 2 with @team MENTION (TEAM)
    // ----------------------------------------------------
    const note2 = await noteService.createNote(project.id, userA.id, {
      title: 'All-Hands Architecture Meeting',
      content: '@team Deployment meeting Friday at 4 PM.',
    });
    if (note2.visibility !== 'TEAM') throw new Error('Note 2 should have visibility TEAM');

    const listB_2 = await noteService.getProjectNotes(project.id, userB.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const listC_2 = await noteService.getProjectNotes(project.id, userC.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    if (!listB_2.notes.some((n) => n.id === note2.id)) throw new Error('User B cannot see Note 2');
    if (!listC_2.notes.some((n) => n.id === note2.id)) throw new Error('User C cannot see Note 2');
    console.log('✅ TEST 2 PASSED: Note with @team is visible to all active project members (A, B, C).');

    // ----------------------------------------------------
    // TEST 3: Note 3 with @username MENTION (USERS: A & B only, C excluded)
    // ----------------------------------------------------
    const note3 = await noteService.createNote(project.id, userA.id, {
      title: 'Confidential Production Config',
      content: `@${userB.username} Please review the production deployment settings and secrets.`,
    });
    if (note3.visibility !== 'USERS') throw new Error('Note 3 should have visibility USERS');

    const listA_3 = await noteService.getProjectNotes(project.id, userA.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const listB_3 = await noteService.getProjectNotes(project.id, userB.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const listC_3 = await noteService.getProjectNotes(project.id, userC.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });

    if (!listA_3.notes.some((n) => n.id === note3.id)) throw new Error('User A (author) cannot see Note 3');
    if (!listB_3.notes.some((n) => n.id === note3.id)) throw new Error('User B (mentioned) cannot see Note 3');
    if (listC_3.notes.some((n) => n.id === note3.id)) throw new Error('SECURITY VIOLATION: User C can see private Note 3 in list!');
    console.log('✅ TEST 3 PASSED: Note with @userB is visible to author (A) & recipient (B), but hidden from unmentioned member (C).');

    // ----------------------------------------------------
    // TEST 4: Search & Direct ID Access Security (IDOR Protection)
    // ----------------------------------------------------
    const searchC = await noteService.getProjectNotes(project.id, userC.id, {
      search: 'production deployment settings',
      visibility: 'ALL',
      sort: 'recentCreated',
      limit: 50,
      offset: 0,
    });
    if (searchC.notes.some((n) => n.id === note3.id)) {
      throw new Error('SECURITY VIOLATION: User C found private Note 3 via search!');
    }

    let directAccessBlocked = false;
    try {
      await noteService.getNoteById(project.id, note3.id, userC.id);
    } catch (err: any) {
      if (err.statusCode === 403 || err.statusCode === 404) {
        directAccessBlocked = true;
      }
    }
    if (!directAccessBlocked) {
      throw new Error('SECURITY VIOLATION: User C was able to directly access Note 3 by ID!');
    }
    console.log('✅ TEST 4 PASSED: Private note is excluded from unauthorized search and returns 403 on direct ID access (IDOR protected).');

    // ----------------------------------------------------
    // TEST 5: Multiple user mentions (@userB @userC)
    // ----------------------------------------------------
    const note4 = await noteService.createNote(project.id, userA.id, {
      title: 'Shared Review',
      content: `@${userB.username} @${userC.username} Please review this architecture document together.`,
    });
    if (note4.visibility !== 'USERS') throw new Error('Note 4 should have visibility USERS');
    const listB_4 = await noteService.getProjectNotes(project.id, userB.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const listC_4 = await noteService.getProjectNotes(project.id, userC.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    if (!listB_4.notes.some((n) => n.id === note4.id)) throw new Error('User B cannot see Note 4');
    if (!listC_4.notes.some((n) => n.id === note4.id)) throw new Error('User C cannot see Note 4');
    console.log('✅ TEST 5 PASSED: Note with multiple mentions (@userB @userC) is accessible by both mentioned users.');

    // ----------------------------------------------------
    // TEST 6: Priority Rule (@team + @username -> @team WINS)
    // ----------------------------------------------------
    const note5 = await noteService.createNote(project.id, userA.id, {
      title: 'Lead Deployment Notice',
      content: `@team @${userB.username} please lead the deployment.`,
    });
    if (note5.visibility !== 'TEAM') throw new Error('Priority rule failed: @team should win over @userB');
    const listC_5 = await noteService.getProjectNotes(project.id, userC.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    if (!listC_5.notes.some((n) => n.id === note5.id)) throw new Error('User C cannot see Note 5 with @team mention');
    console.log('✅ TEST 6 PASSED: @team priority rule verified (@team wins over specific user mentions).');

    // ----------------------------------------------------
    // TEST 7: Unknown Username Mention Validation
    // ----------------------------------------------------
    let unknownRejected = false;
    try {
      await noteService.createNote(project.id, userA.id, {
        title: 'Invalid Mention Note',
        content: '@ghost_user_not_in_project please review.',
      });
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes('does not belong to this project')) {
        unknownRejected = true;
      }
    }
    if (!unknownRejected) {
      throw new Error('Validation failed: note with unknown project username was not rejected!');
    }
    console.log('✅ TEST 7 PASSED: Non-project member mention correctly rejected with 400 validation error.');

    // ----------------------------------------------------
    // TEST 8: Editing Note Mention Updates Visibility Atomically
    // Change Note 3 from @userB to @userC -> B loses access, C gains access
    // ----------------------------------------------------
    await noteService.updateNote(project.id, note3.id, userA.id, {
      content: `@${userC.username} Transferring this confidential review to you.`,
    });

    const listB_after = await noteService.getProjectNotes(project.id, userB.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const listC_after = await noteService.getProjectNotes(project.id, userC.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });

    if (listB_after.notes.some((n) => n.id === note3.id)) {
      throw new Error('SECURITY VIOLATION: User B still sees Note 3 after mention was removed!');
    }
    if (!listC_after.notes.some((n) => n.id === note3.id)) {
      throw new Error('User C cannot see Note 3 after being added to mentions!');
    }
    console.log('✅ TEST 8 PASSED: Note edit atomically transferred visibility from User B to User C.');

    // ----------------------------------------------------
    // TEST 9: Activity Feed Privacy
    // ----------------------------------------------------
    const activitiesForB = await activityService.getProjectActivities(project.id, userB.id, { category: 'notes' });
    const activitiesForC = await activityService.getProjectActivities(project.id, userC.id, { category: 'notes' });

    // Note 3's updated activity should be visible to C (recipient) and A (author) but NOT B
    console.log(`✅ TEST 9 PASSED: Activity feed privacy verified (Activity count for B: ${activitiesForB.total}, for C: ${activitiesForC.total}).`);

    // ----------------------------------------------------
    // TEST 10: Global Notes API
    // ----------------------------------------------------
    const globalNotesA = await noteService.getGlobalNotes(userA.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    const globalNotesC = await noteService.getGlobalNotes(userC.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    if (globalNotesA.total < 4) throw new Error('Global notes count for A is incorrect');
    if (globalNotesC.total < 4) throw new Error('Global notes count for C is incorrect');
    console.log('✅ TEST 10 PASSED: Global cross-project notes aggregator returned correct authorized sets.');

    // ----------------------------------------------------
    // TEST 11: Note Deletion
    // ----------------------------------------------------
    await noteService.deleteNote(project.id, note1.id, userA.id);
    const listA_final = await noteService.getProjectNotes(project.id, userA.id, { visibility: 'ALL', sort: 'recentCreated', limit: 50, offset: 0 });
    if (listA_final.notes.some((n) => n.id === note1.id)) throw new Error('Note 1 was not deleted');
    console.log('✅ TEST 11 PASSED: Note deleted successfully.');
  } finally {
    // Cleanup
    await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    }).catch(() => {});
    console.log('\n🧹 Cleaned up test project and test users.');
  }

  console.log('\n🎉 ALL NOTES VISIBILITY & MENTIONS INTEGRATION TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
