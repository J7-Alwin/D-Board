import { createRateLimiter } from './middlewares/rateLimit.middleware.js';
import type { Request, Response } from 'express';

async function runRateLimitingTests() {
  console.log('🚀 Starting Rate Limiting Middleware Tests...\n');

  const limiter = createRateLimiter({
    prefix: 'test_limit',
    windowSeconds: 2,
    maxRequests: 3,
    message: 'Test limit exceeded',
  });

  const mockIp = '192.168.1.100';

  // Helper to execute middleware
  const executeRequest = async (ip: string): Promise<{ statusCode: number; headers: Record<string, any>; body?: any }> => {
    let statusCode = 200;
    const headers: Record<string, any> = {};
    let responseBody: any = null;

    const req: any = {
      ip,
      socket: { remoteAddress: ip },
    };

    const res: any = {
      setHeader(name: string, value: any) {
        headers[name] = value;
      },
      status(code: number) {
        statusCode = code;
        return {
          json(data: any) {
            responseBody = data;
          },
        };
      },
    };

    let nextCalled = false;
    await limiter(req as Request, res as Response, () => {
      nextCalled = true;
    });

    return { statusCode, headers, body: responseBody };
  };

  // TEST 1: Request 1, 2, 3 succeed with decremented remaining header
  console.log('Test 1: Requests under threshold succeed with headers');
  const req1 = await executeRequest(mockIp);
  const req2 = await executeRequest(mockIp);
  const req3 = await executeRequest(mockIp);

  if (req1.statusCode === 200 && req1.headers['X-RateLimit-Remaining'] === 2 &&
      req2.statusCode === 200 && req2.headers['X-RateLimit-Remaining'] === 1 &&
      req3.statusCode === 200 && req3.headers['X-RateLimit-Remaining'] === 0) {
    console.log('  ✓ 3 requests allowed with correct X-RateLimit-Remaining counts');
  } else {
    throw new Error(`Unexpected responses: ${JSON.stringify({ req1, req2, req3 })}`);
  }

  // TEST 2: Request 4 is blocked with 429
  console.log('\nTest 2: Exceeding threshold returns 429 Too Many Requests');
  const req4 = await executeRequest(mockIp);
  if (req4.statusCode === 429 && req4.body?.error === 'Test limit exceeded' && req4.headers['Retry-After']) {
    console.log('  ✓ Request 4 rejected with 429 and Retry-After header');
  } else {
    throw new Error(`Expected 429, got ${req4.statusCode}: ${JSON.stringify(req4)}`);
  }

  // TEST 3: Different IP is not affected (Client Isolation)
  console.log('\nTest 3: Different client identifier is not affected');
  const reqDifferentIp = await executeRequest('192.168.1.101');
  if (reqDifferentIp.statusCode === 200 && reqDifferentIp.headers['X-RateLimit-Remaining'] === 2) {
    console.log('  ✓ Client B permitted with fresh quota');
  } else {
    throw new Error(`Different IP was unexpectedly blocked: ${JSON.stringify(reqDifferentIp)}`);
  }

  // TEST 4: Window expiration resets quota
  console.log('\nTest 4: Recovery after window expiration');
  await new Promise((resolve) => setTimeout(resolve, 2100)); // wait 2.1s
  const reqRecovered = await executeRequest(mockIp);
  if (reqRecovered.statusCode === 200) {
    console.log('  ✓ Quota successfully restored after window expired');
  } else {
    throw new Error(`Client A failed to recover after window: ${JSON.stringify(reqRecovered)}`);
  }

  console.log('\n🎉 ALL RATE LIMITING TESTS PASSED SUCCESSFULLY!\n');
}

runRateLimitingTests().catch((err) => {
  console.error('❌ Rate Limiting Tests Failed:', err);
  process.exit(1);
});
