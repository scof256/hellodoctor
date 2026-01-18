// Simple test runner for date separator tests
import { execSync } from 'child_process';

const tests = [
  '__tests__/unit/date-utils.test.ts',
  '__tests__/unit/DateSeparator.test.tsx',
  '__tests__/properties/date-grouping.property.test.ts',
  '__tests__/properties/date-label-formatting.property.test.ts',
  '__tests__/properties/chronological-order-preservation.property.test.ts',
  '__tests__/properties/date-normalization.property.test.ts',
  '__tests__/properties/invalid-timestamp-handling.property.test.ts',
  '__tests__/integration/ChatInterface-date-separators.test.tsx',
  '__tests__/integration/PatientMessagesClient-date-separators.test.tsx',
  '__tests__/integration/DirectChatOverlay-date-separators.test.tsx'
];

console.log('Running date separator tests...\n');

try {
  const result = execSync(`npx vitest run ${tests.join(' ')}`, {
    encoding: 'utf-8',
    stdio: 'inherit'
  });
  console.log('\n✓ All tests passed!');
} catch (error) {
  console.error('\n✗ Some tests failed');
  process.exit(1);
}
