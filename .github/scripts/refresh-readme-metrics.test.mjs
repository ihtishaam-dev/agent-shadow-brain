import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periods, sumDownloads, validateRecent } from './refresh-readme-metrics.mjs';

test('covers a multi-year history exactly once across leap years', () => {
  const ranges = periods('2023-02-01', '2026-11-10');
  assert.equal(ranges[0].start, '2023-02-01');
  assert.equal(ranges.at(-1).end, '2026-11-10');
  for (let index = 0; index < ranges.length; index++) {
    const range = ranges[index];
    assert((Date.parse(range.end) - Date.parse(range.start)) / 86_400_000 + 1 <= 365);
    if (index > 0) assert.equal(Date.parse(range.start) - Date.parse(ranges[index-1].end), 86_400_000);
  }
});
test('rejects incomplete, wrong-package, or negative counts instead of publishing a false total', () => {
  const ranges = periods('2026-01-01', '2026-11-10');
  const row = { ...ranges[0], package: '@theihtisham/agent-shadow-brain', downloads: 1234 };
  assert.equal(sumDownloads([row], ranges), 1234);
  assert.throws(() => sumDownloads([], ranges));
  assert.throws(() => sumDownloads([{ ...row, package: 'wrong' }], ranges));
  assert.throws(() => sumDownloads([{ ...row, end: '2026-11-09' }], ranges));
  assert.throws(() => sumDownloads([{ ...row, downloads: -1 }], ranges));
});
test('rejects reversed or impossible dates', () => {
  assert.throws(() => periods('2026-11-10', '2026-01-01'));
  assert.throws(() => periods('2026-02-31', '2026-11-10'));
});
test('rejects a recent-count response with a shortened or mismatched reporting window', () => {
  const row = { package: '@theihtisham/agent-shadow-brain', start: '2026-11-04', end: '2026-11-10', downloads: 123 };
  validateRecent(row, 7);
  assert.throws(() => validateRecent(row, 30));
  assert.throws(() => validateRecent({ ...row, package: 'wrong' }, 7));
  assert.throws(() => validateRecent({ ...row, start: '2026-11-05' }, 7));
});
