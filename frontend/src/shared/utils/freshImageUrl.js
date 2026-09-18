export function freshImageUrl(url, version) {
  if (!url || !version || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}
