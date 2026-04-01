import YAML from 'yaml';

export type MarkdownFrontmatterSection = {
  hasFrontmatter: boolean;
  frontmatterText: string | null;
  bodyText: string;
  lineEnding: '\n' | '\r\n';
};

export type FrontmatterPatch = {
  path: readonly string[];
  value?: unknown;
  action: 'set' | 'delete';
};

const detectLineEnding = (sourceText: string): '\n' | '\r\n' =>
  sourceText.includes('\r\n') ? '\r\n' : '\n';

const trimLineEnding = (value: string): string =>
  value.endsWith('\r') ? value.slice(0, -1) : value;

export const splitMarkdownFrontmatter = (sourceText: string): MarkdownFrontmatterSection => {
  const lineEnding = detectLineEnding(sourceText);
  const openingMarker = `---${lineEnding}`;

  if (!sourceText.startsWith(openingMarker) && sourceText !== '---') {
    return {
      hasFrontmatter: false,
      frontmatterText: null,
      bodyText: sourceText,
      lineEnding
    };
  }

  let index = sourceText === '---' ? 3 : openingMarker.length;
  const frontmatterStart = sourceText === '---' ? 4 : openingMarker.length;

  while (index <= sourceText.length) {
    const lineEnd = sourceText.indexOf('\n', index);
    const sliceEnd = lineEnd === -1 ? sourceText.length : lineEnd;
    const line = trimLineEnding(sourceText.slice(index, sliceEnd));

    if (line === '---' || line === '...') {
      return {
        hasFrontmatter: true,
        frontmatterText: sourceText.slice(frontmatterStart, index),
        bodyText: lineEnd === -1 ? '' : sourceText.slice(lineEnd + 1),
        lineEnding
      };
    }

    if (lineEnd === -1) {
      throw new Error('Markdown frontmatter 缺少关闭标记');
    }

    index = lineEnd + 1;
  }

  throw new Error('Markdown frontmatter 缺少关闭标记');
};

export const parseMarkdownFrontmatterDocument = (frontmatterText: string | null) => {
  const document = YAML.parseDocument(frontmatterText ?? '', {
    keepSourceTokens: true,
    prettyErrors: true
  });

  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join('; '));
  }

  return document;
};

const ensureMapDocument = (document: ReturnType<typeof parseMarkdownFrontmatterDocument>) => {
  if (document.contents === null) {
    document.contents = parseMarkdownFrontmatterDocument('{}').contents;
  }
};

const stringifyFrontmatterBlock = (
  document: ReturnType<typeof parseMarkdownFrontmatterDocument>,
  lineEnding: '\n' | '\r\n'
): string => {
  const yamlText = String(document);
  const normalizedYaml = yamlText.length > 0 ? yamlText.replaceAll('\n', lineEnding) : '';
  const body = normalizedYaml.endsWith(lineEnding) || normalizedYaml.length === 0
    ? normalizedYaml
    : `${normalizedYaml}${lineEnding}`;

  return `---${lineEnding}${body}---${lineEnding}`;
};

export const patchMarkdownFrontmatter = (
  sourceText: string,
  patches: readonly FrontmatterPatch[]
): string => {
  if (patches.length === 0) return sourceText;

  const section = splitMarkdownFrontmatter(sourceText);
  const document = parseMarkdownFrontmatterDocument(section.frontmatterText);

  for (const patch of patches) {
    if (patch.path.length === 0) continue;

    if (patch.action === 'delete') {
      document.deleteIn([...patch.path]);
      continue;
    }

    ensureMapDocument(document);
    document.setIn([...patch.path], patch.value);
  }

  return `${stringifyFrontmatterBlock(document, section.lineEnding)}${section.bodyText}`;
};
