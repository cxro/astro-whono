const MORE_REGEX = /<!--\s*more\s*-->/i;

export type DerivedMarkdownText = {
  plainText: string;
  excerptText: string;
};

export function splitMore(md: string): string {
  if (!md) return '';
  const match = md.match(MORE_REGEX);
  if (!match) return md;
  const index = match.index ?? -1;
  return index >= 0 ? md.slice(0, index) : md;
}

export function cleanMarkdownToText(md: string): string {
  if (!md) return '';
  let text = md;

  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/~~~[\s\S]*?~~~/g, ' ');
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, ' ');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/`[^`]*`/g, ' ');

  text = text.replace(/^\s*#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+[.)]\s+/gm, '');

  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\r?\n+/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function truncateText(text: string, maxChars = 120): string {
  if (!text) return '';
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars))}…`;
}

export function deriveMarkdownText(md: string): DerivedMarkdownText {
  if (!md) {
    return {
      plainText: '',
      excerptText: '',
    };
  }

  const excerptMarkdown = splitMore(md);
  const plainText = cleanMarkdownToText(md);

  return {
    plainText,
    excerptText:
      excerptMarkdown === md ? plainText : cleanMarkdownToText(excerptMarkdown),
  };
}
