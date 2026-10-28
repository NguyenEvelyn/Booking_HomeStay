// Same output as the web app's money(): "1.008.000đ".
export function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;
}

// "14:00:00" -> "14:00".
export function shortTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

export function shortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
