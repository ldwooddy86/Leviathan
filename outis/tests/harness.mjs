/* A minimal test harness: test(name, fn) registers, run() executes in order and reports. No packages. */
import assert from 'node:assert/strict';

const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
export { assert };

export async function run(label) {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`PASS  ${label}: ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${label}: ${t.name}\n      ${String((e && e.stack) || e).split('\n').slice(0, 6).join('\n      ')}`);
    }
  }
  tests.length = 0;
  return failed;
}
