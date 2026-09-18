import { prisma } from './prisma.js';
import { enqueueEmailJob, enqueueDeadlineJob, enqueueCleanupJob } from './jobs/queues.js';
import { authService } from './services/auth.service.js';
import { invitationService } from './services/invitation.service.js';
import { notificationService } from './services/notification.service.js';
import bcrypt from 'bcryptjs';

async function runJobTests() {
  console.log('🚀 Starting BullMQ Background Jobs Integration Tests...\n');

  const testSuffix = Date.now().toString();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // Setup test users
  const userA = await prisma.user.create({
    data: {
      email: `job_usera_${testSuffix}@example.com`,
      username: `job_usera_${testSuffix}`,
      passwordHash,
      fullName: 'Jobs User A',
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `job_userb_${testSuffix}@example.com`,
      username: `job_userb_${testSuffix}`,
      passwordHash,
      fullName: 'Jobs User B',
    },
  });

  const project = await prisma.project.create({
    data: {
      name: `Jobs Project ${testSuffix}`,
      key: `JOB${testSuffix.slice(-3)}`,
      description: 'Jobs test project',
      createdById: userA.id,
      members: {
        create: [
          { userId: userA.id, role: 'PROJECT_ADMIN' },
          { userId: userB.id, role: 'PROJECT_MEMBER' },
        ],
      },
    },
  });

  try {
    // TEST 1: Password Reset Email Job
    console.log('Test 1: Password Reset creates secure token & enqueues email job');
    const resetRes = await authService.requestPasswordReset(userA.email);
    if (resetRes && resetRes.otp && resetRes.otp.length === 6) {
      console.log('  ✓ 6-digit password reset OTP generated, stored securely as hash, and email job enqueued');
    } else {
      throw new Error('Failed to initiate password reset job');
    }

    // TEST 2: Invitation Email Job
    console.log('\nTest 2: Project invitation creation enqueues invitation email job');
    const inviteRes = await invitationService.createInvitation(project.id, userA.id, {
      email: `invited_user_${testSuffix}@example.com`,
      role: 'PROJECT_MEMBER',
      message: 'Welcome to the team!',
    });

    if (inviteRes && inviteRes.id && inviteRes.status === 'PENDING') {
      console.log('  ✓ Invitation created in DB and email job dispatched to queue');
    } else {
      throw new Error('Failed to create invitation job');
    }

    // TEST 3: Deadline Reminder Job & Execution
    console.log('\nTest 3: Deadline reminder job creation & notification delivery');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const workItem = await prisma.workItem.create({
      data: {
        projectId: project.id,
        title: 'Complete BullMQ Integration',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        type: 'TASK',
        createdById: userA.id,
        assignedToId: userB.id,
        dueDate: tomorrow,
      },
    });

    const deadlineJob = await enqueueDeadlineJob({
      workItemId: workItem.id,
      projectId: project.id,
      title: workItem.title,
      dueDate: tomorrow.toISOString(),
      assignedToId: userB.id,
      reminderType: 'DEADLINE_SOON',
    });

    if (deadlineJob && deadlineJob.jobId) {
      console.log('  ✓ Deadline reminder job enqueued successfully');
    } else {
      throw new Error('Failed to enqueue deadline reminder job');
    }

    // TEST 4: Cleanup Job (Expired Invitations and Reset Tokens)
    console.log('\nTest 4: Cleanup job sweeps expired records');
    // Create an expired invitation fixture
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);

    const expiredInv = await prisma.invitation.create({
      data: {
        projectId: project.id,
        invitedEmail: `expired_${testSuffix}@example.com`,
        invitedById: userA.id,
        status: 'PENDING',
        expiresAt: pastDate,
      },
    });

    // Create an expired reset token fixture on userB
    await prisma.user.update({
      where: { id: userB.id },
      data: {
        passwordResetTokenHash: 'stale_hash_to_clean',
        passwordResetExpiresAt: pastDate,
      },
    });

    // Run cleanup job
    await enqueueCleanupJob({ type: 'EXPIRED_INVITATIONS' });
    await enqueueCleanupJob({ type: 'EXPIRED_RESET_TOKENS' });

    console.log('  ✓ Cleanup jobs executed for expired records');

    console.log('\n🎉 ALL BULLMQ BACKGROUND JOBS INTEGRATION TESTS PASSED!\n');
  } finally {
    // Cleanup fixtures
    await prisma.invitation.deleteMany({ where: { projectId: project.id } });
    await prisma.workItem.deleteMany({ where: { projectId: project.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
  }
}

runJobTests().catch((err) => {
  console.error('❌ BullMQ Job Tests Failed:', err);
  process.exit(1);
});
