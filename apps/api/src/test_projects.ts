import { prisma } from './prisma.js';
import { projectService } from './services/project.service.js';
import { dashboardService } from './services/dashboard.service.js';
import { authService } from './services/auth.service.js';

async function runTests() {
  console.log('--- Starting D-Board Projects & Dashboard Integration Tests ---');
  const timestamp = Date.now();
  const creatorUsername = `creator_${timestamp}`;
  const creatorEmail = `creator_${timestamp}@example.com`;
  const inviteeEmail = `invitee_${timestamp}@example.com`;
  const outsiderUsername = `outsider_${timestamp}`;
  const outsiderEmail = `outsider_${timestamp}@example.com`;

  let creatorId = '';
  let outsiderId = '';
  let projectId = '';

  try {
    // 1. Create Creator & Outsider Users
    console.log('1. Setting up test users...');
    const creator = await authService.register({
      fullName: 'Project Creator',
      username: creatorUsername,
      email: creatorEmail,
      password: 'Password123!',
      termsAccepted: true,
    });
    creatorId = creator.user.id;

    const outsider = await authService.register({
      fullName: 'Outsider User',
      username: outsiderUsername,
      email: outsiderEmail,
      password: 'Password123!',
      termsAccepted: true,
    });
    outsiderId = outsider.user.id;
    console.log('✓ Test users created');

    // 2. Create Project with Atomic Transaction & Pending Invitation
    console.log('2. Testing atomic project creation with creator as PROJECT_ADMIN and pending invitations...');
    const createdProject = await projectService.createProject(creatorId, {
      name: 'Phoenix Engine',
      key: 'PHX',
      description: 'Next-generation distributed rendering engine.',
      category: 'Infrastructure',
      technologyStack: ['Rust', 'WebGPU', 'TypeScript'],
      repositoryUrl: 'https://github.com/d-board/phoenix',
      invitations: [
        {
          email: inviteeEmail,
          role: 'PROJECT_MEMBER',
          message: 'Welcome to the Phoenix team!',
        },
      ],
    });

    projectId = createdProject?.id || '';
    console.log(`✓ Project created with id: ${projectId}`);

    // Verify creator is PROJECT_ADMIN in ProjectMember table
    const creatorMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: creatorId,
        },
      },
    });

    if (creatorMembership?.role !== 'PROJECT_ADMIN') {
      throw new Error(`Expected creator role to be PROJECT_ADMIN, got: ${creatorMembership?.role}`);
    }
    console.log('✓ Verified creator is automatically assigned PROJECT_ADMIN');

    // Verify invitation is PENDING and invitee is NOT automatically in ProjectMember
    const pendingInvitation = await prisma.invitation.findFirst({
      where: {
        projectId,
        invitedEmail: inviteeEmail.toLowerCase(),
      },
    });

    if (!pendingInvitation || pendingInvitation.status !== 'PENDING') {
      throw new Error(`Expected invitation to be PENDING, got: ${pendingInvitation?.status}`);
    }
    console.log('✓ Verified invitation created with PENDING status');

    const inviteeMemberCount = await prisma.projectMember.count({
      where: {
        projectId,
        user: { email: inviteeEmail.toLowerCase() },
      },
    });

    if (inviteeMemberCount !== 0) {
      throw new Error('Invited user was prematurely added to ProjectMember before accepting!');
    }
    console.log('✓ Verified invited user is NOT prematurely added to ProjectMember');

    // 3. Test Duplicate Project Membership Constraint
    console.log('3. Testing duplicate membership prevention...');
    try {
      await prisma.projectMember.create({
        data: {
          projectId,
          userId: creatorId,
          role: 'PROJECT_MEMBER',
        },
      });
      throw new Error('Expected duplicate membership creation to fail!');
    } catch (err: any) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint')) {
        console.log('✓ Duplicate project membership successfully prevented by database constraint');
      } else {
        throw err;
      }
    }

    // 4. Test User Projects Retrieval (Owned vs Joined)
    console.log('4. Testing getUserProjects separation...');
    const creatorProjects = await projectService.getUserProjects(creatorId);
    if (creatorProjects.owned.length !== 1 || creatorProjects.owned[0].id !== projectId) {
      throw new Error(`Expected creator to have 1 owned project, got: ${creatorProjects.owned.length}`);
    }
    if (creatorProjects.joined.length !== 0) {
      throw new Error(`Expected creator to have 0 joined projects, got: ${creatorProjects.joined.length}`);
    }
    console.log('✓ getUserProjects accurately separates owned and joined projects');

    // 5. Test Unauthorized Project Access Rejection
    console.log('5. Testing non-member unauthorized access rejection...');
    try {
      await projectService.getProjectById(projectId, outsiderId);
      throw new Error('Expected outsider access to private project to fail!');
    } catch (err: any) {
      if (err.statusCode === 403) {
        console.log('✓ Unauthorized outsider correctly rejected (403 Forbidden)');
      } else {
        throw err;
      }
    }

    // 6. Test Dashboard Summary Metrics
    console.log('6. Testing Dashboard summary metrics...');
    const dashboardData = await dashboardService.getDashboardSummary(creatorId);
    if (dashboardData.stats.myProjectsCount !== 1) {
      throw new Error(`Expected myProjectsCount = 1, got ${dashboardData.stats.myProjectsCount}`);
    }
    if (dashboardData.stats.joinedProjectsCount !== 0) {
      throw new Error(`Expected joinedProjectsCount = 0, got ${dashboardData.stats.joinedProjectsCount}`);
    }
    if (dashboardData.myProjects.length !== 1) {
      throw new Error(`Expected 1 project in myProjects list, got ${dashboardData.myProjects.length}`);
    }
    console.log('✓ Dashboard summary computed accurate metrics');

    // 7. Test Project Update (Admin only)
    console.log('7. Testing project update authorization...');
    const updated = await projectService.updateProject(projectId, creatorId, {
      description: 'Updated rendering engine description.',
    });
    if (updated.description !== 'Updated rendering engine description.') {
      throw new Error('Project description update failed');
    }
    console.log('✓ Project admin successfully updated project');

    try {
      await projectService.updateProject(projectId, outsiderId, {
        description: 'Malicious update attempt',
      });
      throw new Error('Expected non-admin project update to fail!');
    } catch (err: any) {
      if (err.statusCode === 403) {
        console.log('✓ Non-admin update rejected (403 Forbidden)');
      } else {
        throw err;
      }
    }

    // Cleanup test data
    console.log('8. Cleaning up test data...');
    await prisma.invitation.deleteMany({ where: { projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: [creatorId, outsiderId] } } });
    console.log('✓ Test data cleaned up');

    console.log('--- ALL PROJECT & DASHBOARD TESTS PASSED SUCCESSFULLY ---');
  } catch (error) {
    console.error('Test failed with error:', error);
    // Cleanup on failure
    if (projectId) {
      await prisma.invitation.deleteMany({ where: { projectId } }).catch(() => {});
      await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {});
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
    }
    if (creatorId || outsiderId) {
      await prisma.user.deleteMany({ where: { id: { in: [creatorId, outsiderId].filter(Boolean) } } }).catch(() => {});
    }
    process.exit(1);
  }
}

runTests();
