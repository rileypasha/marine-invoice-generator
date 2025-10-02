const fs = require('fs');
const path = require('path');

const checks = [];
let passed = 0;
let failed = 0;

function check(description, test) {
  const result = test();
  checks.push({ description, result });
  if (result) {
    passed++;
    console.log('✅', description);
  } else {
    failed++;
    console.log('❌', description);
  }
}

console.log('\n🔍 Verifying Offline Support Implementation...\n');

check('IndexedDB cache layer exists', () => fs.existsSync('src/db/cache.ts'));
check('Offline queue exists', () => fs.existsSync('src/db/queue.ts'));
check('Offline plugin exists', () => fs.existsSync('src/utils/offline-plugin.ts'));
check('Network status hook exists', () => fs.existsSync('src/hooks/useNetworkStatus.ts'));
check('Offline banner exists', () => fs.existsSync('src/components/OfflineBanner.tsx'));
check('Conflict resolution exists', () => fs.existsSync('src/components/ConflictResolution.tsx'));
check('Optimistic mutations exists', () => fs.existsSync('src/hooks/api/useOptimisticMutations.ts'));
check('Print offline exists', () => fs.existsSync('src/utils/print-offline.ts'));
check('Service worker exists', () => fs.existsSync('public/sw.js'));
check('SW registration exists', () => fs.existsSync('src/utils/service-worker-registration.ts'));
check('Quick start guide exists', () => fs.existsSync('OFFLINE_QUICKSTART.md'));
check('Full documentation exists', () => fs.existsSync('OFFLINE_SUPPORT.md'));
check('Implementation summary exists', () => fs.existsSync('OFFLINE_IMPLEMENTATION_SUMMARY.md'));

console.log('\n' + '='.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${checks.length}`);
console.log(`\n${failed === 0 ? '🎉 All checks passed!' : '⚠️  Some checks failed'}\n`);
