import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const simpleIcons = require('@iconify-json/simple-icons/icons.json');
const logos = require('@iconify-json/logos/icons.json');

const LANG_ALIASES = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rs: 'rust',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  docker: 'dockerfile',
  conf: 'nginx',
  yml: 'yaml',
  md: 'markdown',
  cs: 'csharp',
};

const LANG_LABELS = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  vue: 'Vue',
  svelte: 'Svelte',
  astro: 'Astro',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  csharp: 'C#',
  ruby: 'Ruby',
  php: 'PHP',
  kotlin: 'Kotlin',
  json: 'JSON',
  yaml: 'YAML',
  toml: 'TOML',
  bash: 'Bash',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
  sql: 'SQL',
  markdown: 'Markdown',
  nginx: 'Nginx',
  text: 'Text',
};

const SIMPLE_ICON_KEYS = {
  javascript: ['javascript'],
  typescript: ['typescript'],
  jsx: ['react'],
  tsx: ['react'],
  html: ['html5'],
  css: ['css3'],
  scss: ['sass'],
  vue: ['vuedotjs'],
  svelte: ['svelte'],
  astro: ['astro'],
  python: ['python'],
  go: ['go'],
  rust: ['rust'],
  java: ['java'],
  csharp: ['csharp'],
  ruby: ['ruby'],
  php: ['php'],
  kotlin: ['kotlin'],
  json: ['json'],
  yaml: ['yaml'],
  toml: ['toml'],
  bash: ['gnubash'],
  powershell: ['powershell'],
  dockerfile: ['docker'],
  sql: ['postgresql', 'mysql', 'sqlite'],
  markdown: ['markdown'],
  nginx: ['nginx'],
};

const LOGO_ICON_KEYS = {
  javascript: ['javascript-icon', 'javascript'],
  typescript: ['typescript-icon', 'typescript'],
  jsx: ['react', 'reactjs'],
  tsx: ['react', 'reactjs'],
  html: ['html-5', 'html5', 'html'],
  css: ['css-3-official', 'css-3', 'css3', 'css'],
  scss: ['sass'],
  vue: ['vue', 'vuejs', 'vue-js'],
  svelte: ['svelte-icon', 'svelte'],
  astro: ['astro-icon', 'astro'],
  python: ['python', 'python-icon'],
  go: ['go'],
  rust: ['rust'],
  java: ['java'],
  csharp: ['c-sharp', 'csharp'],
  ruby: ['ruby'],
  php: ['php', 'php-icon'],
  kotlin: ['kotlin'],
  json: ['json'],
  yaml: ['yaml'],
  toml: ['toml'],
  bash: ['bash-icon', 'bash'],
  powershell: ['powershell'],
  dockerfile: ['docker'],
  sql: ['postgresql', 'mysql', 'sqlite'],
  markdown: ['markdown'],
  nginx: ['nginx'],
};

const COLOR_PRIORITY_LANGS = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'go',
  'rust',
  'java',
  'html',
  'css',
  'scss',
  'vue',
  'svelte',
  'astro',
  'php',
  'bash',
]);

const normalize = (value) => (value || '').trim().toLowerCase();

export const normalizeLang = (raw) => {
  const lowered = normalize(raw);
  if (!lowered) return 'text';
  return LANG_ALIASES[lowered] || lowered;
};

export const getLangLabel = (raw, normalized = normalizeLang(raw)) => {
  const rawLowered = normalize(raw);
  if (rawLowered && LANG_LABELS[rawLowered]) return LANG_LABELS[rawLowered];
  return LANG_LABELS[normalized] || normalized || 'text';
};

const resolveIcon = (set, key) => {
  if (!set) return null;
  if (set.icons && set.icons[key]) return set.icons[key];
  const alias = set.aliases && set.aliases[key];
  if (alias && alias.parent && set.icons && set.icons[alias.parent]) {
    return set.icons[alias.parent];
  }
  return null;
};

const pickIcon = (set, keys) => {
  if (!Array.isArray(keys)) return null;
  for (const key of keys) {
    const icon = resolveIcon(set, key);
    if (icon) return icon;
  }
  return null;
};

const normalizeSvgBody = (body) => {
  if (!body) return '';
  return body
    .replace(/fill="[^"]*"/g, 'fill="currentColor"')
    .replace(/fill:[^;"]+/g, 'fill:currentColor');
};

const getViewBox = (set, icon) => {
  const width = icon?.width ?? set?.width ?? 24;
  const height = icon?.height ?? set?.height ?? 24;
  const left = icon?.left ?? 0;
  const top = icon?.top ?? 0;
  return `${left} ${top} ${width} ${height}`;
};

const buildSvg = (set, icon, className, isColored) => {
  if (!icon || !icon.body) return null;
  const viewBox = getViewBox(set, icon);
  const body = isColored ? icon.body : normalizeSvgBody(icon.body);
  const classes = isColored ? `${className} is-colored` : className;
  return `<svg class="${classes}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;
};

export const getLangIcon = (rawLang) => {
  const normalized = normalizeLang(rawLang);
  const logoKeys = LOGO_ICON_KEYS[normalized] || [normalized];
  const simpleKeys = SIMPLE_ICON_KEYS[normalized] || [normalized];

  const preferLogo = COLOR_PRIORITY_LANGS.has(normalized);
  if (preferLogo) {
    const logoIcon = pickIcon(logos, logoKeys);
    if (logoIcon) {
      return {
        svg: buildSvg(logos, logoIcon, 'code-lang-icon', true),
        isColored: true,
      };
    }
  }

  const simpleIcon = pickIcon(simpleIcons, simpleKeys);
  if (simpleIcon) {
    return {
      svg: buildSvg(simpleIcons, simpleIcon, 'code-lang-icon', false),
      isColored: false,
    };
  }

  if (!preferLogo) {
    const logoIcon = pickIcon(logos, logoKeys);
    if (logoIcon) {
      return {
        svg: buildSvg(logos, logoIcon, 'code-lang-icon', true),
        isColored: true,
      };
    }
  }

  return null;
};
