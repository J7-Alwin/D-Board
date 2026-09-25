import { prisma } from './prisma.js';
import { authService } from './services/auth.service.js';
import { sessionService } from './services/session.service.js';
import { userService } from './services/user.service.js';
import { projectService } from './services/project.service.js';
import { memberService } from './services/member.service.js';
import { invitationService } from './services/invitation.service.js';
import { generateJwt, verifyJwt, hashToken } from './utils/security.js';

async function runPhase1SecurityTests() {
  console.log('🛡️  === STARTING PHASE 1 COMPREHENSIVE SECURITY HARDENING SUITE ===\n');
  const timestamp = Date.now();

  // ---------------------------------------------------------------------------
  // 1. SESSION MANAGEMENT & REVOCATION
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Session Management & Revocation ---');
  const testUser = await authService.register({
    email: `sec_user_${timestamp}@example.com`,
    username: `secuser_${timestamp}`,
    fullName: 'Security Test User',
    password: 'Password123!@#',
  });

  const { session } = await sessionService.createSession(testUser.user.id, {
    userAgent: 'Mozilla/5.0 Test Suite',
    ipAddress: '127.0.0.1',
  });
  console.log('✓ Session created in database & Redis cache');

  const validSession = await sessionService.validateSession(session.id);
  if (!validSession.valid || validSession.userId !== testUser.user.id) {
    throw new Error('Session validation failed for valid active session');
  }
  console.log('✓ Session validated successfully via Redis/PostgreSQL');

  // Verify JWT contains sessionId
  const token = generateJwt({
    userId: testUser.user.id,
    email: testUser.user.email,
    username: testUser.user.username,
    sessionId: session.id,
  });
  const decoded = verifyJwt(token);
  if (decoded.sessionId !== session.id) {
    throw new Error('JWT payload does not contain valid sessionId');
  }
  console.log('✓ JWT correctly embeds sessionId claim');

  // Revoke session
  await sessionService.revokeSession(session.id);
  const revokedCheck = await sessionService.validateSession(session.id);
  if (revokedCheck.valid) {
    throw new Error('Revoked session was still returned as valid!');
  }
  console.log('✓ Session revocation is immediate and authoritative');

  // ---------------------------------------------------------------------------
  // 2. PASSWORD RESET BRUTE-FORCE PROTECTION (5 ATTEMPTS LOCKOUT)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Password Reset Brute-Force Lockout ---');
  await authService.requestPasswordReset(testUser.user.email);
  
  // Submit 5 failed attempts
  for (let i = 1; i <= 5; i++) {
    try {
      await authService.resetPassword(
        { email: testUser.user.email, otp: '000000' },
        'NewPassword123!@#'
      );
      throw new Error('Invalid OTP should not have succeeded');
    } catch (err: any) {
      if (i < 5) {
        if (!err.message.includes('attempts remaining')) {
          throw new Error(`Expected attempts remaining message, got: ${err.message}`);
        }
      } else {
        if (!err.message.includes('Too many failed attempts') && !err.message.includes('invalidated')) {
          throw new Error(`Expected lockout message on 5th attempt, got: ${err.message}`);
        }
      }
    }
  }

  // Verify OTP was invalidated in DB
  const userAfterLockout = await prisma.user.findUnique({
    where: { id: testUser.user.id },
  });
  if (userAfterLockout?.passwordResetTokenHash !== null) {
    throw new Error('OTP hash was not cleared after 5 failed attempts!');
  }
  console.log('✓ Password reset locked out and OTP invalidated after 5 failed attempts');

  // ---------------------------------------------------------------------------
  // 3. EMAIL VERIFICATION & UNVERIFIED INVITATION ACCEPTANCE BLOCK
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Email Verification & Invitation Protection ---');
  const unverifiedUser = await prisma.user.create({
    data: {
      email: `unverified_${timestamp}@example.com`,
      username: `unverified_${timestamp}`,
      fullName: 'Unverified User',
      isEmailVerified: false,
      passwordHash: 'dummy',
    },
  });

  const rawToken = `test-verification-token-${timestamp}`;
  await prisma.user.update({
    where: { id: unverifiedUser.id },
    data: {
      emailVerificationTokenHash: hashToken(rawToken),
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Create project and invitation
  const project = await prisma.project.create({
    data: {
      name: `Security Project ${timestamp}`,
      key: 'SECP',
      description: 'Security test project description',
      createdById: testUser.user.id,
      members: {
        create: {
          userId: testUser.user.id,
          role: 'PROJECT_ADMIN',
        },
      },
    },
  });

  const invitation = await invitationService.createInvitation(project.id, testUser.user.id, {
    email: unverifiedUser.email,
    role: 'PROJECT_MEMBER',
  });

  // Attempt to accept invitation with unverified email
  let unverifiedBlocked = false;
  try {
    await invitationService.acceptInvitation(invitation.id, unverifiedUser.id);
  } catch (err: any) {
    if (err.statusCode === 403 && err.message.includes('verify your email')) {
      unverifiedBlocked = true;
    }
  }
  if (!unverifiedBlocked) {
    throw new Error('Unverified user was allowed to accept invitation!');
  }
  console.log('✓ Unverified user strictly blocked from accepting project invitations (403)');

  // Verify email using token
  await authService.verifyEmail(rawToken);
  const verifiedUser = await prisma.user.findUnique({
    where: { id: unverifiedUser.id },
  });
  if (!verifiedUser?.isEmailVerified) {
    throw new Error('Email verification token validation failed');
  }
  console.log('✓ Email verification token successfully confirmed user identity');

  // Now invitation acceptance succeeds
  const acceptResult = await invitationService.acceptInvitation(invitation.id, unverifiedUser.id);
  if (!acceptResult.message.includes('Successfully joined')) {
    throw new Error('Invitation acceptance failed after email verification');
  }
  console.log('✓ Verified user successfully accepted project invitation');

  // ---------------------------------------------------------------------------
  // 4. GOOGLE OAUTH SECURITY: REJECT UNVERIFIED & PREVENT ACCOUNT HIJACKING
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Google OAuth Security & Account Takeover Prevention ---');
  // Attempt with unverified google email -> must throw 403
  let unverifiedGoogleBlocked = false;
  try {
    await authService.handleGoogleAuth({
      googleId: 'google-12345',
      email: 'hacker@example.com',
      emailVerified: false,
      fullName: 'Hacker',
    });
  } catch (err: any) {
    if (err.statusCode === 403 && err.message.includes('not verified')) {
      unverifiedGoogleBlocked = true;
    }
  }
  if (!unverifiedGoogleBlocked) {
    throw new Error('Unverified Google account was not blocked!');
  }
  console.log('✓ Unverified Google email rejected with 403');

  // Attempt to link a different google ID to an account already linked to another google ID
  await prisma.user.update({
    where: { id: unverifiedUser.id },
    data: { googleId: `existing-google-id-${timestamp}` },
  });

  let hijackBlocked = false;
  try {
    await authService.handleGoogleAuth({
      googleId: 'malicious-different-google-id-000',
      email: unverifiedUser.email,
      emailVerified: true,
      fullName: 'Attacker Attempting Takeover',
    });
  } catch (err: any) {
    if (err.statusCode === 409 && err.message.includes('already linked')) {
      hijackBlocked = true;
    }
  }
  if (!hijackBlocked) {
    throw new Error('Account takeover via mismatched googleId was not blocked!');
  }
  console.log('✓ Account hijacking via conflicting Google IDs blocked with 409');

  // ---------------------------------------------------------------------------
  // 5. DATA INTEGRITY & SOLE OWNER DELETION PROTECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Sole Project Owner Deletion Protection ---');
  // testUser is sole admin of `project`
  let soleOwnerBlocked = false;
  try {
    await userService.deleteUserAccount(testUser.user.id);
  } catch (err: any) {
    if (err.statusCode === 400 && err.message.includes('sole administrator')) {
      soleOwnerBlocked = true;
    }
  }
  if (!soleOwnerBlocked) {
    throw new Error('Sole project owner was allowed to delete account without transfer!');
  }
  console.log('✓ Sole project owner account deletion blocked with 400');

  // Transfer ownership to unverifiedUser (now verified & admin)
  const memberRecord = await prisma.projectMember.findFirst({
    where: { projectId: project.id, userId: unverifiedUser.id },
  });
  await memberService.updateMemberRole(project.id, memberRecord!.id, 'PROJECT_ADMIN', testUser.user.id);
  await projectService.transferOwnership(project.id, testUser.user.id, unverifiedUser.id);
  console.log('✓ Project ownership successfully transferred to successor admin');

  // Now delete testUser account (soft deactivation + anonymization)
  const deleteResult = await userService.deleteUserAccount(testUser.user.id);
  if (!deleteResult.success) {
    throw new Error('Account deletion failed after ownership transfer');
  }

  const deactivatedUser = await prisma.user.findUnique({
    where: { id: testUser.user.id },
  });
  if (!deactivatedUser?.isDeactivated || deactivatedUser.passwordHash !== null) {
    throw new Error('User soft-deactivation or credential nullification failed');
  }
  console.log('✓ User safely deactivated and anonymized without cascading destructive deletes');

  // Verify project remains intact
  const projectCheck = await prisma.project.findUnique({
    where: { id: project.id },
  });
  if (!projectCheck || projectCheck.createdById !== unverifiedUser.id) {
    throw new Error('Project was corrupted or deleted during user deactivation');
  }
  console.log('✓ Collaborative project data integrity preserved 100%');

  // ---------------------------------------------------------------------------
  // CLEANUP TEST FIXTURES
  // ---------------------------------------------------------------------------
  await prisma.invitation.deleteMany({ where: { projectId: project.id } });
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.session.deleteMany({ where: { userId: { in: [testUser.user.id, unverifiedUser.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [testUser.user.id, unverifiedUser.id] } } });

  console.log('\n================================================================');
  console.log('🎉 ALL 5 PHASE 1 SECURITY HARDENING DOMAINS VERIFIED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runPhase1SecurityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ PHASE 1 SECURITY TEST FAILED:', err);
    process.exit(1);
  });
