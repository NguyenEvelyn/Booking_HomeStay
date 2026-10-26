import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryLabel, contentBlocks, readingMinutes } from './newsContent.js';

test('contentBlocks splits paragraphs and sub-headings', () => {
  assert.deepEqual(contentBlocks('Mở đầu dòng 1\ndòng 2\n\n## Mẹo đặt phòng\nĐặt sớm 30 ngày.\n\n\nKết.'), [
    { type: 'paragraph', text: 'Mở đầu dòng 1 dòng 2' },
    { type: 'heading', text: 'Mẹo đặt phòng' },
    { type: 'paragraph', text: 'Đặt sớm 30 ngày.' },
    { type: 'paragraph', text: 'Kết.' }
  ]);
});

test('contentBlocks keeps markup as plain text', () => {
  assert.deepEqual(contentBlocks('<script>alert(1)</script>'), [{ type: 'paragraph', text: '<script>alert(1)</script>' }]);
  assert.deepEqual(contentBlocks(''), []);
});

test('category labels and reading time', () => {
  assert.equal(categoryLabel('DiemDen'), 'Điểm đến');
  assert.equal(categoryLabel('khac'), 'Tin tức');
  assert.equal(readingMinutes('một '.repeat(660)), 3);
});
