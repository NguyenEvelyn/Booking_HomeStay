import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from './hostBookingUtils.js';

test('csvCell quotes values and escapes embedded quotes', () => {
  assert.equal(csvCell('Nguyễn "Văn" A'), '"Nguyễn ""Văn"" A"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(1500000), '"1500000"');
});

test('csvCell neutralizes spreadsheet formulas from guest-entered text', () => {
  for (const value of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) {
    assert.ok(csvCell(value).startsWith(`"'`), `${value} must be prefixed with an apostrophe`);
  }
});
