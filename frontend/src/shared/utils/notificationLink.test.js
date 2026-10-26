import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationDestination, timeAgo } from './notificationLink.js';

test('notificationDestination maps each typed link to a view', () => {
  assert.deepEqual(notificationDestination({ type: 'Booking', id: 5 }), { view: 'bookings', bookingId: 5 });
  assert.deepEqual(notificationDestination({ type: 'HostBooking', id: 9 }), { view: 'host', hostTab: 'bookings', bookingId: 9 });
  assert.deepEqual(notificationDestination({ type: 'HostTab', extra: 'reviews' }), { view: 'host', hostTab: 'reviews' });
  assert.deepEqual(notificationDestination({ type: 'AdminTab', extra: 'homestays' }), { view: 'admin', adminTab: 'homestays' });
  assert.deepEqual(notificationDestination({ type: 'Homestay', id: 34 }), { view: 'detail', homestayId: 34 });
  assert.deepEqual(notificationDestination({ type: 'News', extra: 'da-lat' }), { view: 'news-detail', slug: 'da-lat' });
});

test('notificationDestination ignores missing or unknown links', () => {
  assert.equal(notificationDestination(null), null);
  assert.equal(notificationDestination({ type: 'Url', extra: 'https://evil.example' }), null);
  assert.equal(notificationDestination({ type: 'Homestay' }), null);
});

test('timeAgo speaks Vietnamese', () => {
  const now = Date.UTC(2026, 9, 26, 12, 0);
  assert.equal(timeAgo(new Date(now - 20_000).toISOString(), now), 'vừa xong');
  assert.equal(timeAgo(new Date(now - 5 * 60_000).toISOString(), now), '5 phút trước');
  assert.equal(timeAgo(new Date(now - 3 * 3600_000).toISOString(), now), '3 giờ trước');
  assert.equal(timeAgo(new Date(now - 2 * 86400_000).toISOString(), now), '2 ngày trước');
});
