import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHARSET_PATH = path.join(ROOT, 'tools', 'charset-common.txt');

const WENKAI_INPUT = path.join(
  ROOT,
  'tools',
  'fonts-src',
  'LXGWWenKaiLite-Regular.woff2'
);
const WENKAI_OUTPUTS = {
  latin: path.join(ROOT, 'public', 'fonts', 'lxgw-wenkai-lite-latin.woff2'),
  common: path.join(
    ROOT,
    'public',
    'fonts',
    'lxgw-wenkai-lite-cjk-common.woff2'
  ),
  ext: path.join(ROOT, 'public', 'fonts', 'lxgw-wenkai-lite-cjk-ext.woff2'),
};

const NOTO_REGULAR_INPUT = path.join(
  ROOT,
  'tools',
  'fonts-src',
  'NotoSerifSC-Regular.ttf'
);
const NOTO_SEMIBOLD_INPUT = path.join(
  ROOT,
  'tools',
  'fonts-src',
  'NotoSerifSC-SemiBold.ttf'
);
const NOTO_OUTPUTS = {
  400: {
    latin: path.join(ROOT, 'public', 'fonts', 'noto-serif-sc-400-latin.woff2'),
    common: path.join(
      ROOT,
      'public',
      'fonts',
      'noto-serif-sc-400-cjk-common.woff2'
    ),
    ext: path.join(ROOT, 'public', 'fonts', 'noto-serif-sc-400-cjk-ext.woff2'),
  },
  600: {
    latin: path.join(ROOT, 'public', 'fonts', 'noto-serif-sc-600-latin.woff2'),
    common: path.join(
      ROOT,
      'public',
      'fonts',
      'noto-serif-sc-600-cjk-common.woff2'
    ),
    ext: path.join(ROOT, 'public', 'fonts', 'noto-serif-sc-600-cjk-ext.woff2'),
  },
};

const failMissingPyftsubset = (details) => {
  console.error('[font:subset] Missing required tool / 缺少必需命令');
  console.error('- command: pyftsubset');
  console.error('- required by: npm run font:subset / npm run font:build');
  console.error('- install: python -m pip install fonttools brotli zopfli');
  console.error('- verify: pyftsubset --help');
  console.error(
    '- note: ensure the Python Scripts directory is available on PATH / 请确保 Python Scripts 目录已加入 PATH'
  );
  if (details) {
    console.error(`- detail: ${details}`);
  }
  process.exit(1);
};

const ensurePyftsubsetAvailable = () => {
  const result = spawnSync('pyftsubset', ['--help'], { stdio: 'pipe' });
  if (result.error) {
    failMissingPyftsubset(result.error.message);
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? String(result.stderr).trim() : '';
    failMissingPyftsubset(
      stderr || `pyftsubset exited with code ${result.status ?? 'unknown'}`
    );
  }
};

const runSubset = (label, args) => {
  const result = spawnSync('pyftsubset', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`pyftsubset failed for ${label}.`);
    process.exit(result.status ?? 1);
  }
};

const failMissingSource = ({ name, filename, expectedPath }) => {
  console.error('[font:subset] Missing source font / 缺少源字体文件');
  console.error(`- name: ${name}`);
  console.error(`- file: ${filename}`);
  console.error(`- expected path: ${expectedPath}`);
  console.error(
    '- hint: Please download the font file and place it in tools/fonts-src/ / 请自行下载字体文件并放入 tools/fonts-src/'
  );
  process.exit(1);
};

if (!existsSync(CHARSET_PATH)) {
  console.error(`missing charset file: ${CHARSET_PATH}`);
  console.error('run: npm run font:charset');
  process.exit(1);
}

ensurePyftsubsetAvailable();

if (!existsSync(WENKAI_INPUT)) {
  failMissingSource({
    name: 'LXGW WenKai Lite',
    filename: path.basename(WENKAI_INPUT),
    expectedPath: WENKAI_INPUT,
  });
}

runSubset('wenkai-latin', [
  WENKAI_INPUT,
  `--output-file=${WENKAI_OUTPUTS.latin}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+0000-00FF,U+2000-206F,U+3000-303F,U+FF00-FFEF',
]);

runSubset('wenkai-common', [
  WENKAI_INPUT,
  `--output-file=${WENKAI_OUTPUTS.common}`,
  '--flavor=woff2',
  '--with-zopfli',
  `--text-file=${CHARSET_PATH}`,
]);

runSubset('wenkai-ext', [
  WENKAI_INPUT,
  `--output-file=${WENKAI_OUTPUTS.ext}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+3400-4DBF,U+20000-2A6DF',
]);

if (!existsSync(NOTO_REGULAR_INPUT)) {
  failMissingSource({
    name: 'Noto Serif SC Regular',
    filename: path.basename(NOTO_REGULAR_INPUT),
    expectedPath: NOTO_REGULAR_INPUT,
  });
}

if (!existsSync(NOTO_SEMIBOLD_INPUT)) {
  failMissingSource({
    name: 'Noto Serif SC SemiBold',
    filename: path.basename(NOTO_SEMIBOLD_INPUT),
    expectedPath: NOTO_SEMIBOLD_INPUT,
  });
}

runSubset('noto-400-latin', [
  NOTO_REGULAR_INPUT,
  `--output-file=${NOTO_OUTPUTS[400].latin}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+0000-00FF,U+2000-206F,U+3000-303F,U+FF00-FFEF',
]);

runSubset('noto-400-common', [
  NOTO_REGULAR_INPUT,
  `--output-file=${NOTO_OUTPUTS[400].common}`,
  '--flavor=woff2',
  '--with-zopfli',
  `--text-file=${CHARSET_PATH}`,
]);

runSubset('noto-400-ext', [
  NOTO_REGULAR_INPUT,
  `--output-file=${NOTO_OUTPUTS[400].ext}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+3400-4DBF,U+20000-2A6DF',
]);

runSubset('noto-600-latin', [
  NOTO_SEMIBOLD_INPUT,
  `--output-file=${NOTO_OUTPUTS[600].latin}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+0000-00FF,U+2000-206F,U+3000-303F,U+FF00-FFEF',
]);

runSubset('noto-600-common', [
  NOTO_SEMIBOLD_INPUT,
  `--output-file=${NOTO_OUTPUTS[600].common}`,
  '--flavor=woff2',
  '--with-zopfli',
  `--text-file=${CHARSET_PATH}`,
]);

runSubset('noto-600-ext', [
  NOTO_SEMIBOLD_INPUT,
  `--output-file=${NOTO_OUTPUTS[600].ext}`,
  '--flavor=woff2',
  '--with-zopfli',
  '--unicodes=U+3400-4DBF,U+20000-2A6DF',
]);

console.log('font subsets generated (wenkai + noto).');
