import { encode } from 'uqr';
import { getPosterQrCellSize, wrapPosterText } from '../lib/article-poster';

type ArticlePosterData = {
  siteName: string;
  title: string;
  date: string;
  summary: string;
  authorName: string;
  authorAvatar: string;
  url: string;
};

// 海报固定浅色，保存后观感和二维码对比度不随主题变化。取值与 global.css 的浅色主题一致。
const COLORS = {
  background: '#fffefc',
  text: '#292524',
  muted: '#57534e',
  faint: '#a8a29e',
  border: '#e7e5e4'
};
const WIDTH = 375;
const PADDING = 28;
const CONTENT_WIDTH = WIDTH - PADDING * 2;
const SCALE = 2;
const TITLE_TOP = 78;
const TITLE_LINE_HEIGHT = 36;
const SUMMARY_LINE_HEIGHT = 26;
const AVATAR_SIZE = 44;
const AUTHOR_GAP = 12;
const QR_TARGET_SIZE = 80;
const FOOTER_GAP = 16;
const FOOTER_BOTTOM = 20;

const loadAvatar = async (src: string): Promise<HTMLImageElement | null> => {
  if (!src) return null;

  const image = new Image();
  image.src = src;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
};

export const renderArticlePoster = async (data: ArticlePosterData): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  const rootStyle = getComputedStyle(document.documentElement);
  const fontStack = (name: string) => rootStyle.getPropertyValue(name).trim() || 'serif';
  const copyFont = fontStack('--font-copy');
  const fonts = {
    brand: `20px ${fontStack('--font-brand')}`,
    title: `600 24px ${fontStack('--font-readable')}`,
    summary: `15px ${copyFont}`,
    date: `13px ${copyFont}`,
    hint: `12px ${copyFont}`
  };
  const hint = '扫码阅读全文';
  // Canvas 不会等待网页字体，先按实际文字加载；加载失败时和页面一样退回系统字体。
  const loadFont = (font: string, text: string) => document.fonts.load(font, text).catch(() => []);
  const [avatar] = await Promise.all([
    loadAvatar(data.authorAvatar),
    loadFont(fonts.brand, data.siteName),
    loadFont(fonts.title, data.title),
    loadFont(fonts.summary, `${data.summary}${data.authorName}`),
    loadFont(fonts.date, data.date),
    loadFont(fonts.hint, hint)
  ]);

  const wrap = (text: string, font: string, maxWidth: number, maxLines: number): string[] => {
    ctx.font = font;
    return wrapPosterText(text, (value) => ctx.measureText(value).width, maxWidth, maxLines);
  };
  ctx.font = fonts.date;
  const dateWidth = data.date ? ctx.measureText(data.date).width + 16 : 0;
  const siteLine = wrap(data.siteName, fonts.brand, CONTENT_WIDTH - dateWidth, 1)[0] ?? '';
  const titleLines = wrap(data.title, fonts.title, CONTENT_WIDTH, 3);
  const summaryLines = wrap(data.summary, fonts.summary, CONTENT_WIDTH, 4);

  const { data: modules } = encode(data.url, { ecc: 'M', border: 0 });
  const cellSize = getPosterQrCellSize(modules.length, QR_TARGET_SIZE * SCALE);
  const qrPixels = cellSize * modules.length;
  const qrSize = qrPixels / SCALE;

  const summaryTop = TITLE_TOP + titleLines.length * TITLE_LINE_HEIGHT + 14;
  const dividerTop = summaryTop + summaryLines.length * SUMMARY_LINE_HEIGHT + 26;
  const rowTop = dividerTop + FOOTER_GAP;
  const rowHeight = Math.max(qrSize, AVATAR_SIZE);
  const height = rowTop + rowHeight + FOOTER_BOTTOM;

  canvas.width = WIDTH * SCALE;
  canvas.height = Math.ceil(height * SCALE);
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, height);

  ctx.fillStyle = COLORS.text;
  ctx.font = fonts.brand;
  ctx.fillText(siteLine, PADDING, 48);
  if (data.date) {
    ctx.fillStyle = COLORS.faint;
    ctx.font = fonts.date;
    ctx.textAlign = 'right';
    ctx.fillText(data.date, WIDTH - PADDING, 47);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = COLORS.text;
  ctx.font = fonts.title;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, PADDING, TITLE_TOP + index * TITLE_LINE_HEIGHT + 26);
  });

  ctx.fillStyle = COLORS.muted;
  ctx.font = fonts.summary;
  summaryLines.forEach((line, index) => {
    ctx.fillText(line, PADDING, summaryTop + index * SUMMARY_LINE_HEIGHT + 18);
  });

  ctx.fillStyle = COLORS.border;
  ctx.fillRect(PADDING, dividerTop, CONTENT_WIDTH, 1);

  const rowCenter = rowTop + rowHeight / 2;
  if (avatar) {
    const avatarTop = rowCenter - AVATAR_SIZE / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(PADDING + AVATAR_SIZE / 2, rowCenter, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    // 非正方形头像居中裁切，与页面上的 object-fit: cover 一致。
    const side = Math.min(avatar.naturalWidth, avatar.naturalHeight);
    ctx.drawImage(
      avatar,
      (avatar.naturalWidth - side) / 2,
      (avatar.naturalHeight - side) / 2,
      side,
      side,
      PADDING,
      avatarTop,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
    ctx.restore();
  }

  const authorLeft = PADDING + (avatar ? AVATAR_SIZE + AUTHOR_GAP : 0);
  const authorWidth = WIDTH - PADDING - qrSize - AUTHOR_GAP - authorLeft;
  const authorLine = wrap(data.authorName, fonts.summary, authorWidth, 1)[0] ?? '';
  ctx.fillStyle = COLORS.text;
  ctx.font = fonts.summary;
  ctx.fillText(authorLine, authorLeft, rowCenter - 3);
  ctx.fillStyle = COLORS.faint;
  ctx.font = fonts.hint;
  ctx.fillText(hint, authorLeft, rowCenter + 16);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const qrLeft = (WIDTH - PADDING) * SCALE - qrPixels;
  const qrTop = rowTop * SCALE;
  ctx.fillStyle = COLORS.text;
  modules.forEach((row, y) => {
    row.forEach((filled, x) => {
      if (filled) ctx.fillRect(qrLeft + x * cellSize, qrTop + y * cellSize, cellSize, cellSize);
    });
  });

  return canvas.toDataURL('image/png');
};
