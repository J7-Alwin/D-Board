import prisma from './prisma.js';
import * as authService from './services/auth.service.js';
import { hashToken } from './utils/security.js';

async function runAuthTests() {
  console.log('--- Starting D-Board Real Authentication Tests ---');

  const testUsername = `dev_tester_${Date.now()}`;
  const testEmail = `${testUsername}@example.com`;
  const testPassword = 'Password123!';

  // 1. Test Registration
  console.log('1. Testing Registration...');
  const regResult = await authService.register({
    username: testUsername,
    email: testEmail,
    password: testPassword,
  });

  if (!regResult.user.id || !regResult.token) {
    throw new Error('Registration failed to return user id or token');
  }
  console.log('✓ Registration succeeded for user:', regResult.user.username);

  // 2. Test Duplicate Email Prevention
  console.log('2. Testing Duplicate Email Detection...');
  try {
    await authService.register({
      username: `${testUsername}_dup`,
      email: testEmail,
      password: testPassword,
    });
    throw new Error('Duplicate email was not rejected');
  } catch (err: any) {
    if (err.statusCode === 409) {
      console.log('✓ Duplicate email rejected properly (409 Conflict)');
    } else {
      throw err;
    }
  }

  // 3. Test Login
  console.log('3. Testing Login with identifier and password...');
  const loginResult = await authService.login({
    identifier: testEmail,
    password: testPassword,
  });
  if (!loginResult.user || !loginResult.token) {
    throw new Error('Login failed');
  }
  console.log('✓ Login succeeded');

  // 4. Test Invalid Password
  console.log('4. Testing Invalid Password...');
  try {
    await authService.login({
      identifier: testEmail,
      password: 'WrongPassword!',
    });
    throw new Error('Invalid password was accepted');
  } catch (err: any) {
    if (err.statusCode === 401) {
      console.log('✓ Invalid password rejected properly (401 Unauthorized)');
    } else {
      throw err;
    }
  }

  // 5. Test getUserById (Me)
  console.log('5. Testing Get User Profile...');
  const userProfile = await authService.getUserById(regResult.user.id);
  if (userProfile.username !== testUsername) {
    throw new Error('Profile fetch returned incorrect user');
  }
  console.log('✓ Profile retrieved successfully');

  // 6. Test Password Reset Request
  console.log('6. Testing Password Reset Request...');
  const resetRes = await authService.requestPasswordReset(testEmail);
  if (!resetRes || !resetRes.otp) {
    throw new Error('Password reset OTP was not generated');
  }
  const otp = resetRes.otp;
  console.log('✓ 6-digit reset OTP generated, hash stored securely in DB');

  // 7. Verify Database Token Hash Storage
  const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
  if (!dbUser?.passwordResetTokenHash || dbUser.passwordResetTokenHash !== hashToken(otp)) {
    throw new Error('OTP hash mismatch in database');
  }
  console.log('✓ Verified DB stores only SHA-256 hash of OTP');

  // 8. Test Password Reset Execution
  console.log('8. Testing Password Reset Execution with OTP...');
  const newPassword = 'NewSecurePassword456!';
  await authService.resetPassword({ email: testEmail, otp }, newPassword);
  console.log('✓ Password reset executed with OTP');

  // 9. Verify Old OTP is Invalidated (Single-Use)
  console.log('9. Testing OTP Invalidation (Single-Use)...');
  try {
    await authService.resetPassword({ email: testEmail, otp }, 'AnotherPassword789!');
    throw new Error('Expired/used OTP was accepted');
  } catch (err: any) {
    if (err.statusCode === 400) {
      console.log('✓ OTP successfully invalidated after single use');
    } else {
      throw err;
    }
  }

  // 10. Test Login with New Password
  console.log('10. Testing Login with New Password...');
  const newLogin = await authService.login({
    identifier: testUsername,
    password: newPassword,
  });
  if (!newLogin.user) {
    throw new Error('Login with new password failed');
  }
  console.log('✓ Login with new password succeeded');

  // Cleanup test user
  await prisma.user.delete({ where: { id: regResult.user.id } });
  console.log('✓ Cleaned up test user');

  console.log('--- ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY ---');
}

runAuthTests()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
