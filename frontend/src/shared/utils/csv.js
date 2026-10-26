// One CSV cell: quoted, with formula-looking values (=, +, -, @, tab, CR) neutralized by a leading apostrophe.
export const csvCell = value => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
