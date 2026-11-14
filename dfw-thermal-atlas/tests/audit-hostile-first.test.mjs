// Audit, part B: hostile answers on the first read of a fresh install (nothing in the store to fall back on). The same
// sweep as tests/audit-hostile.test.mjs, in its own file so the two run side by side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sweep, violations } from './audit-hostile-kit.mjs';

let unhandled = 0; process.on('unhandledRejection', () => { unhandled++; });

test('hostile answers, a first read: right or marked or a plain failure, never garbage, never past the time limit', async () => {
  const rows = await sweep(false), bad = violations(rows, false);
  assert.ok(rows.length > 900, 'the sweep ran: ' + rows.length + ' runs');
  assert.deepEqual(bad, [], bad.length + ' of ' + rows.length + ' runs:\n' + bad.join('\n'));
  assert.equal(unhandled, 0, 'no unhandled rejection');
});
