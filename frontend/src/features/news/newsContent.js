// News post helpers shared by the public pages and the admin editor preview.

export const NEWS_CATEGORIES = [
  { value: 'CamNang', label: 'Cẩm nang' },
  { value: 'DiemDen', label: 'Điểm đến' },
  { value: 'UuDai', label: 'Ưu đãi' },
  { value: 'TinTripio', label: 'Tin Tripio' }
];

export const categoryLabel = (value) => NEWS_CATEGORIES.find((x) => x.value === value)?.label || 'Tin tức';

// Plain-text content → blocks. A blank line starts a new paragraph, "## " starts a sub-heading.
// The result is rendered as text nodes only, never as HTML.
export function contentBlocks(content) {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const lines = chunk.split('\n');
      if (lines[0].startsWith('## ')) {
        const heading = { type: 'heading', text: lines[0].slice(3).trim() };
        const rest = lines.slice(1).join(' ').trim();
        return rest ? [heading, { type: 'paragraph', text: rest }] : [heading];
      }
      return [{ type: 'paragraph', text: lines.join(' ') }];
    });
}

export const newsDate = (value) => value
  ? new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
  : '';

// Rough reading time for the article header (≈ 220 words per minute).
export const readingMinutes = (content) => Math.max(1, Math.round(String(content || '').split(/\s+/).filter(Boolean).length / 220));
