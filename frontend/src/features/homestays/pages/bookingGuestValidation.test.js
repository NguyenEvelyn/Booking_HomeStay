import assert from 'node:assert/strict';
import test from 'node:test';
import { findMissingCompanionIndex } from './bookingGuestValidation.js';

const incompleteAdult = { type: 'adult', fullName: '', birthDate: '', gender: '', documentNumber: '' };
const completeAdult = { type: 'adult', fullName: 'Nguyễn Văn A', birthDate: '1990-01-01', gender: 'Nam', documentNumber: '123456789012' };

test('cho phép thanh toán khi khách đi cùng chọn khai báo sau', () => {
  assert.equal(findMissingCompanionIndex([incompleteAdult], true), -1);
});

test('yêu cầu khai báo khách đi cùng nếu không chọn khai báo sau', () => {
  assert.equal(findMissingCompanionIndex([incompleteAdult], false), 0);
  assert.equal(findMissingCompanionIndex([completeAdult], false), -1);
});
