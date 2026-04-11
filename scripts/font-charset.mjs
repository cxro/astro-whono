import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, 'tools', 'charset-common.txt');
const BASE_CHARSET_PATH = path.join(ROOT, 'tools', 'charset-base.txt');

const ASCII_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ASCII_DIGITS = '0123456789';
const ASCII_PUNCT = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
const CJK_PUNCT = '，。！？；：、（）《》〈〉「」『』【】〔〕“”‘’—…·•';
const EXTRA_SPACES = ' \u00A0\u3000';

const EXTRA_CHARS = [
  ASCII_LETTERS,
  ASCII_DIGITS,
  ASCII_PUNCT,
  CJK_PUNCT,
  EXTRA_SPACES,
].join('');

const SOURCE_DIRS = [
  { dir: path.join(ROOT, 'src', 'content'), exts: new Set(['.md']) },
  { dir: path.join(ROOT, 'src', 'pages'), exts: new Set(['.astro']) },
  { dir: path.join(ROOT, 'src', 'components'), exts: new Set(['.astro']) },
  { dir: path.join(ROOT, 'src', 'layouts'), exts: new Set(['.astro']) },
];

const SOURCE_FILES = [path.join(ROOT, 'site.config.mjs')];

const charset = new Set();

const addText = (text) => {
  for (const ch of text) {
    charset.add(ch);
  }
};

const walk = async (dir, exts, results) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, exts, results);
      continue;
    }
    if (exts.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
};

const collectFiles = async () => {
  const files = [];
  for (const source of SOURCE_DIRS) {
    try {
      await walk(source.dir, source.exts, files);
    } catch {
      // Ignore missing directories to keep the script portable.
    }
  }
  for (const filePath of SOURCE_FILES) {
    try {
      await fs.access(filePath);
      files.push(filePath);
    } catch {
      // Ignore missing files to keep the script portable.
    }
  }
  return files;
};

const main = async () => {
  try {
    const baseText = await fs.readFile(BASE_CHARSET_PATH, 'utf8');
    addText(baseText);
  } catch {
    // Optional base charset file; ignore if missing.
  }

  const files = await collectFiles();
  for (const filePath of files) {
    const text = await fs.readFile(filePath, 'utf8');
    addText(text);
  }

  addText(EXTRA_CHARS);

  const sorted = Array.from(charset).sort(
    (a, b) => a.codePointAt(0) - b.codePointAt(0)
  );
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${sorted.join('')}\n`, 'utf8');

  console.log(`charset generated: ${OUTPUT_PATH}`);
  console.log(`characters: ${sorted.length}`);
};

await main();
