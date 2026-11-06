type MeasureText = (text: string) => number;

// 这些标点不放在行首，宁可略微超出行宽。
const NO_LINE_START = /^[，。、；：？！）》」』】”’…,.;:?!)\]]/u;
const MIN_QR_CELL_SIZE = 3;

// 旧版 Firefox 没有 Intl.Segmenter，退回逐字断行。
const splitPosterText = (text: string): string[] =>
  typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter('zh', { granularity: 'word' }).segment(text), ({ segment }) => segment)
    : Array.from(text);

const addEllipsis = (line: string, measure: MeasureText, maxWidth: number): string => {
  let chars = Array.from(line);
  while (chars.length > 0 && measure(`${chars.join('')}…`) > maxWidth) {
    chars = chars.slice(0, -1);
  }
  return `${chars.join('').trimEnd()}…`;
};

export const wrapPosterText = (
  text: string,
  measure: MeasureText,
  maxWidth: number,
  maxLines: number
): string[] => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const units = splitPosterText(normalized).flatMap((unit) => (
    measure(unit) > maxWidth ? Array.from(unit) : [unit]
  ));
  const lines: string[] = [];
  let line = '';

  for (const unit of units) {
    const next = line + unit;
    if (!line || measure(next) <= maxWidth || NO_LINE_START.test(unit)) {
      line = next;
      continue;
    }

    lines.push(line.trimEnd());
    if (lines.length === maxLines) {
      lines[maxLines - 1] = addEllipsis(line.trimEnd(), measure, maxWidth);
      return lines;
    }
    line = unit.trimStart();
  }

  if (line) lines.push(line);
  return lines;
};

// 每个模块用整数像素才清晰；链接很长时宁可让二维码变大，也不把模块压到难以识别。
export const getPosterQrCellSize = (moduleCount: number, targetSize: number): number =>
  Math.max(MIN_QR_CELL_SIZE, Math.floor(targetSize / moduleCount));
