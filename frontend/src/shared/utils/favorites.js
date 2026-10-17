const FAVORITES_KEY = 'tripio-favorites';
export const FAVORITES_CHANGED_EVENT = 'tripio:favorites-changed';

export const readFavoriteIds = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(value) ? [...new Set(value.map(Number).filter(Number.isFinite))] : [];
  } catch {
    return [];
  }
};

export const writeFavoriteIds = (ids) => {
  const normalized = [...new Set(ids.map(Number).filter(Number.isFinite))];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: normalized }));
  return normalized;
};

export const toggleFavoriteId = (id) => {
  const numericId = Number(id);
  const current = readFavoriteIds();
  return writeFavoriteIds(current.includes(numericId)
    ? current.filter((item) => item !== numericId)
    : [...current, numericId]);
};
