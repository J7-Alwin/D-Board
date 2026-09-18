import 'dotenv/config';
import prisma from './prisma.js';
import * as authService from './services/auth.service.js';
import { invitationService } from './services/invitation.service.js';
import { hashToken } from './utils/security.js';

async function runAuthAndEmailFlowTests() {
  console.log('====================================================');
  console.log('STARTING D-BOARD AUTH & EMAIL INTEGRATION SUITE');
  console.log('====================================================\n');

  const timestamp = Date.now();
  const alwinEmail = `alwin_${timestamp}@example.com`;
  const alanEmail = `alan_${timestamp}@example.com`;
  const unifiedEmail = `unified_${timestamp}@example.com`;

  try {
    // ----------------------------------------------------
    // TEST 1: User Registration + Welcome Email Dispatch
    // ----------------------------------------------------
    console.log('TEST 1: Standard User Registration & Welcome Flow');
    const alwinAuth = await authService.register({
      email: alwinEmail,
      password: 'StrongPassword123!',
      fullName: 'Alwin Admin',
      username: `alwin_${timestamp}`,
    });

    if (!alwinAuth || !alwinAuth.user || alwinAuth.user.email !== alwinEmail) {
      throw new Error('Alwin registration failed');
    }
    console.log('  ✓ Registered Alwin successfully (Welcome email triggered)');

    // ----------------------------------------------------
    // TEST 2: Google OAuth Unified Identity Linking
    // ----------------------------------------------------
    console.log('\nTEST 2: Google OAuth Unified Identity Linking');
    // First, register standard account for unifiedEmail
    const standardUser = await authService.register({
      email: unifiedEmail,
      password: 'StandardPassword123!',
      fullName: 'Unified Tester',
      username: `unified_${timestamp}`,
    });

    const originalUserId = standardUser.user.id;
    console.log(`  ✓ Standard account created for ${unifiedEmail} (ID: ${originalUserId})`);

    // Now attempt Google login with the exact same email
    const googleProfile = {
      id: `google-uid-${timestamp}`,
      email: unifiedEmail,
      displayName: 'Unified Tester Google',
      picture: 'https://lh3.googleusercontent.com/a/sample-avatar',
    };

    const googleAuthResult = await authService.handleGoogleAuth(googleProfile);
    if (!googleAuthResult || !googleAuthResult.user) {
      throw new Error('Google auth failed');
    }

    if (googleAuthResult.user.id !== originalUserId) {
      throw new Error(`Duplicate account created! Expected ${originalUserId}, got ${googleAuthResult.user.id}`);
    }

    const updatedDbUser = await prisma.user.findUnique({ where: { id: originalUserId } });
    if (updatedDbUser?.googleId !== googleProfile.id) {
      throw new Error('Google ID was not linked to existing user');
    }

    // Verify user count for this email is exactly 1
    const userCount = await prisma.user.count({ where: { email: unifiedEmail } });
    if (userCount !== 1) {
      throw new Error(`Expected 1 user record, found ${userCount}`);
    }
    console.log('  ✓ Google OAuth successfully linked googleId to existing account without duplicate creation');

    // ----------------------------------------------------
    // TEST 3: 6-Digit OTP Password Reset Flow
    // ----------------------------------------------------
    console.log('\nTEST 3: 6-Digit Numeric OTP Password Reset Flow');
    const resetReq = await authService.requestPasswordReset(alwinEmail);
    if (!resetReq || !resetReq.otp || resetReq.otp.length !== 6) {
      throw new Error('Expected 6-digit OTP returned in test mode');
    }
    const otp = resetReq.otp;
    console.log(`  ✓ Generated 6-digit numeric OTP: ${otp}`);

    // Verify OTP hash stored in DB
    const dbAlwin = await prisma.user.findUnique({ where: { email: alwinEmail } });
    if (!dbAlwin?.passwordResetTokenHash || dbAlwin.passwordResetTokenHash !== hashToken(otp)) {
      throw new Error('Database does not store correct SHA-256 hash of OTP');
    }
    console.log('  ✓ Verified DB stores SHA-256 hash of OTP securely');

    // Verify OTP helper
    const isOtpValid = await authService.verifyPasswordResetOtp(alwinEmail, otp);
    if (!isOtpValid) {
      throw new Error('verifyPasswordResetOtp failed for valid OTP');
    }
    console.log('  ✓ verifyPasswordResetOtp successfully verified valid OTP');

    // Reset password using OTP
    const newPassword = 'NewAlwinSecurePassword456!';
    await authService.resetPassword({ email: alwinEmail, otp }, newPassword);
    console.log('  ✓ resetPassword succeeded with { email, otp, newPassword }');

    // Verify login with new password
    const loginRes = await authService.login({ identifier: alwinEmail, password: newPassword });
    if (!loginRes || !loginRes.user) {
      throw new Error('Failed to login with newly reset password');
    }
    console.log('  ✓ Successfully authenticated using new password');

    // Verify OTP is single-use
    try {
      await authService.resetPassword({ email: alwinEmail, otp }, 'ShouldFailPassword999!');
      throw new Error('OTP was accepted a second time! Single-use violation.');
    } catch (err: any) {
      if (err.statusCode === 400) {
        console.log('  ✓ Replayed OTP rejected (Single-use verified)');
      } else {
        throw err;
      }
    }

    // ----------------------------------------------------
    // TEST 4: Unregistered User Invitation Linking & First Login Flow
    // ----------------------------------------------------
    console.log('\nTEST 4: Unregistered User Project Invitation Linking');
    // Alwin creates a project
    const project = await prisma.project.create({
      data: {
        name: `Engineering Hub ${timestamp}`,
        key: `ENG${timestamp.toString().slice(-4)}`,
        description: 'Engineering workspace for D-Board testing',
        createdById: alwinAuth.user.id,
        technologyStack: ['TypeScript', 'Node.js', 'PostgreSQL'],
        members: {
          create: [{ userId: alwinAuth.user.id, role: 'PROJECT_ADMIN' }],
        },
      },
    });
    console.log(`  ✓ Project created: "${project.name}" (ID: ${project.id})`);

    // Alwin invites Alan (Alan is NOT yet registered in D-Board)
    const invitation = await invitationService.createInvitation(project.id, alwinAuth.user.id, {
      email: alanEmail,
      role: 'PROJECT_MEMBER',
      message: 'Hey Alan, welcome to the new project!',
    });

    if (invitation.invitedUserId !== null) {
      throw new Error('Unregistered user invitation should have invitedUserId: null');
    }
    console.log(`  ✓ Invitation sent to unregistered email ${alanEmail} (invitedUserId is null)`);

    // Now Alan registers on D-Board for the first time
    const alanAuth = await authService.register({
      email: alanEmail,
      password: 'AlanSecurePassword123!',
      fullName: 'Alan Engineer',
      username: `alan_${timestamp}`,
    });

    console.log(`  ✓ Alan registered on D-Board (ID: ${alanAuth.user.id})`);

    // Verify invitation is now linked to Alan
    const userInvitations = await invitationService.getUserInvitations(alanAuth.user.id, 'PENDING');
    if (userInvitations.length === 0 || userInvitations[0].id !== invitation.id) {
      throw new Error('Pending invitation was not auto-linked to Alan upon first registration!');
    }
    console.log(`  ✓ Pending invitation automatically linked to Alan's account!`);

    // Alan accepts the invitation
    const acceptRes = await invitationService.acceptInvitation(invitation.id, alanAuth.user.id);
    if (!acceptRes.success) {
      throw new Error('Alan failed to accept invitation');
    }
    console.log('  ✓ Alan accepted invitation (Project joined confirmation email triggered)');

    // Verify Alan is now in project members
    const memberRecord = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: alanAuth.user.id,
        },
      },
    });

    if (!memberRecord || memberRecord.role !== 'PROJECT_MEMBER') {
      throw new Error('Alan is not listed as a PROJECT_MEMBER in the project!');
    }
    console.log('  ✓ Verified Alan is now active member of the project');

    console.log('\n====================================================');
    console.log('ALL AUTH, GOOGLE UNIFIED LOGIN, OTP, AND EMAIL INVITATION FLOWS PASSED PERFECTLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAuthAndEmailFlowTests();
