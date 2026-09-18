import { cacheService } from './redis/cache.service.js';

async function runCacheTests() {
  console.log('🚀 Starting Redis & Cache Service Integration Tests...\n');

  // TEST 1: Basic Set & Get
  console.log('Test 1: Set and Get cached string and object values');
  await cacheService.set('test:string', 'hello world', 60);
  const valString = await cacheService.get<string>('test:string');
  if (valString === 'hello world') {
    console.log('  ✓ String value cached and retrieved successfully');
  } else {
    throw new Error(`Expected "hello world", got "${valString}"`);
  }

  const sampleObj = { id: '123', name: 'Alpha Project', count: 42 };
  await cacheService.set('test:object', sampleObj, 60);
  const valObj = await cacheService.get<typeof sampleObj>('test:object');
  if (valObj && valObj.id === '123' && valObj.count === 42) {
    console.log('  ✓ Object value serialized and deserialized cleanly');
  } else {
    throw new Error(`Expected valid object, got: ${JSON.stringify(valObj)}`);
  }

  // TEST 2: Delete
  console.log('\nTest 2: Key deletion');
  await cacheService.del('test:string');
  const deletedVal = await cacheService.get<string>('test:string');
  if (deletedVal === null) {
    console.log('  ✓ Key deleted successfully');
  } else {
    throw new Error(`Expected null after deletion, got: ${deletedVal}`);
  }

  // TEST 3: Pattern Deletion
  console.log('\nTest 3: Pattern-based deletion (delPattern)');
  await cacheService.set('user:456:dashboard', { stats: 'ok' }, 60);
  await cacheService.set('user:456:notifications', { unread: 5 }, 60);
  await cacheService.set('user:789:dashboard', { stats: 'ok' }, 60);

  await cacheService.delPattern('user:456:*');
  const u1 = await cacheService.get('user:456:dashboard');
  const u2 = await cacheService.get('user:456:notifications');
  const other = await cacheService.get('user:789:dashboard');

  if (u1 === null && u2 === null && other !== null) {
    console.log('  ✓ Pattern deletion removed matching user:456:* keys without affecting other users');
  } else {
    throw new Error('Pattern deletion failed');
  }

  // TEST 4: Cache-Aside Wrapper
  console.log('\nTest 4: Cache wrap helper');
  let computeCount = 0;
  const expensiveFetch = async () => {
    computeCount++;
    return { calculatedScore: 99 };
  };

  const firstCall = await cacheService.wrap('computed:metric', expensiveFetch, 60);
  const secondCall = await cacheService.wrap('computed:metric', expensiveFetch, 60);

  if (computeCount === 1 && firstCall.calculatedScore === 99 && secondCall.calculatedScore === 99) {
    console.log('  ✓ wrap() computed only once and served second request from cache');
  } else {
    throw new Error(`wrap() failed, computeCount was: ${computeCount}`);
  }

  // TEST 5: TTL Expiration
  console.log('\nTest 5: TTL Expiration');
  await cacheService.set('test:short_lived', 'expires_fast', 1); // 1 second TTL
  const immediate = await cacheService.get('test:short_lived');
  if (immediate === 'expires_fast') {
    console.log('  ✓ Value exists immediately');
  }
  await new Promise((resolve) => setTimeout(resolve, 1100)); // wait 1.1s
  const expired = await cacheService.get('test:short_lived');
  if (expired === null) {
    console.log('  ✓ Value correctly expired after TTL window');
  } else {
    throw new Error(`Expected expired key to return null, got: ${expired}`);
  }

  console.log('\n🎉 ALL CACHE TESTS PASSED SUCCESSFULLY!\n');
}

runCacheTests().catch((err) => {
  console.error('❌ Cache Tests Failed:', err);
  process.exit(1);
});
