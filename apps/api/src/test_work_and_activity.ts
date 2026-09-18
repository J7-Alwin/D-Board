import { prisma } from './prisma.js';
import { workService } from './services/work.service.js';
import { commentService } from './services/comment.service.js';
import { activityService } from './services/activity.service.js';
import { dashboardService } from './services/dashboard.service.js';

async function runTests() {
  console.log('🚀 Starting Work Items, Comments, and Activity Integration Test Suite...');

  // 1. Create or fetch test users
  const user1 = await prisma.user.upsert({
    where: { email: 'work_admin@example.com' },
    update: {},
    create: {
      email: 'work_admin@example.com',
      username: 'workadmin',
      fullName: 'Work Admin',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'work_member@example.com' },
    update: {},
    create: {
      email: 'work_member@example.com',
      username: 'workmember',
      fullName: 'Work Member',
    },
  });

  const outsider = await prisma.user.upsert({
    where: { email: 'work_outsider@example.com' },
    update: {},
    create: {
      email: 'work_outsider@example.com',
      username: 'workoutside',
      fullName: 'Work Outsider',
    },
  });

  // 2. Create a test project
  const project = await prisma.project.create({
    data: {
      name: 'Alpha Quantum Engine',
      key: 'AQE',
      description: 'High performance physics engine for simulations',
      createdById: user1.id,
      members: {
        create: {
          userId: user2.id,
          role: 'PROJECT_MEMBER',
        },
      },
    },
  });

  console.log(`✅ Test project created: ${project.name} (${project.id})`);

  // 3. Create work items
  const task1 = await workService.createWorkItem(project.id, user1.id, {
    title: 'Design distributed task queue',
    description: 'Create Redis and BullMQ based event queue architecture',
    type: 'FEATURE',
    priority: 'HIGH',
    status: 'TODO',
    assignedToId: user2.id,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
  console.log(`✅ Task 1 created: ${task1.title} (${task1.id})`);

  const task2 = await workService.createWorkItem(project.id, user2.id, {
    title: 'Fix race condition in memory allocator',
    description: 'Mutex lock contention during heavy multi-threaded runs',
    type: 'BUG',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    assignedToId: user2.id,
    dueDate: new Date(Date.now() - 2 * 86400000).toISOString(), // Overdue
  });
  console.log(`✅ Task 2 created (Overdue Bug): ${task2.title} (${task2.id})`);

  // 4. Test query & stats aggregation
  const workList = await workService.getProjectWorkItems(project.id, user1.id);
  console.log(`✅ Fetched work items count: ${workList.workItems.length}`);
  console.log('✅ Stats computed:', workList.stats);
  if (workList.stats.total !== 2 || workList.stats.overdue !== 1) {
    throw new Error('Stats computation mismatch!');
  }

  // 5. Status Transition to COMPLETED
  const updatedTask = await workService.updateWorkItem(project.id, task1.id, user2.id, {
    status: 'COMPLETED',
  });
  console.log(`✅ Task 1 status changed to: ${updatedTask.status}, completedAt: ${updatedTask.completedAt}`);
  if (!updatedTask.completedAt) {
    throw new Error('CompletedAt should be set when status becomes COMPLETED');
  }

  // 6. Test Comments
  const comment1 = await commentService.createComment(user2.id, project.id, task1.id, {
    content: 'Initial benchmarks show 3x throughput improvement!',
  });
  console.log(`✅ Comment added: "${comment1.body}" by ${comment1.author.fullName}`);

  const comments = await commentService.getComments(user1.id, project.id, task1.id);
  if (comments.length !== 1) {
    throw new Error('Expected 1 comment');
  }

  // 7. Test Activity feed
  const activityResult = await activityService.getProjectActivities(project.id, user1.id);
  console.log(`✅ Project activities count: ${activityResult.activities.length}`);
  activityResult.activities.forEach((act) => {
    console.log(`   - [${act.type}] by ${act.actor.fullName || act.actor.username} (WorkItem: ${act.workItem?.title || 'N/A'})`);
  });

  // 8. Test Dashboard live query
  const dashboard = await dashboardService.getDashboardSummary(user2.id);
  console.log(`✅ Dashboard stats for user2:`, dashboard.stats);
  if (dashboard.stats.myOpenWorkCount < 1) {
    throw new Error('Expected myOpenWorkCount >= 1 for user2 (task2 is IN_PROGRESS)');
  }

  // 9. Authorization check: outsider access should fail
  let outsiderBlocked = false;
  try {
    await workService.getProjectWorkItems(project.id, outsider.id);
  } catch (err: any) {
    outsiderBlocked = true;
    console.log(`✅ Security check passed: Outsider blocked (${err.message})`);
  }
  if (!outsiderBlocked) {
    throw new Error('Outsider should have been blocked with 403!');
  }

  // Cleanup test project
  await prisma.project.delete({ where: { id: project.id } });
  console.log('🧹 Cleaned up test project.');
  console.log('🎉 ALL WORK ITEMS, COMMENTS & ACTIVITY INTEGRATION TESTS PASSED!');
}

runTests()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
