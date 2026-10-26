// Where a notification opens. The backend sends a typed link (Notification.LinkType/LinkId/LinkExtra),
// never a URL; App.jsx turns the destination into a view switch.
export function notificationDestination(link) {
  if (!link?.type) return null;
  switch (link.type) {
    case 'Booking': return { view: 'bookings', bookingId: link.id ?? null };
    case 'HostBooking': return { view: 'host', hostTab: 'bookings', bookingId: link.id ?? null };
    case 'HostTab': return { view: 'host', hostTab: link.extra || 'overview' };
    case 'AdminTab': return { view: 'admin', adminTab: link.extra || 'overview' };
    case 'Homestay': return link.id ? { view: 'detail', homestayId: link.id } : null;
    case 'News': return link.extra ? { view: 'news-detail', slug: link.extra } : { view: 'news' };
    default: return null;
  }
}

// "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", then the date.
export function timeAgo(value, now = Date.now()) {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(value).toLocaleDateString('vi-VN');
}
