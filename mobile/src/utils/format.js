// Same output as the web app's money(): "1.008.000đ".
export function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;
}
