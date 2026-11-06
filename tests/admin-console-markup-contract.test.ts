import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Theme Console script finds controls by id and silently stops if one is missing, so renames must fail here.
const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const ADMIN_COMPONENT_DIR = 'src/components/admin';
const adminComponents = readdirSync(join(process.cwd(), ADMIN_COMPONENT_DIR))
  .filter((name) => name.endsWith('.astro'))
  .map((name) => ({ name, source: read(`${ADMIN_COMPONENT_DIR}/${name}`) }));
const markup = [...adminComponents.map(({ source }) => source), read('src/pages/admin/theme/index.astro')].join('\n');

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// id={`page-${row.id}-title`} matches any page-<something>-title.
const templateIds = [...markup.matchAll(/\bid=\{`([^`]+)`\}/g)].map(
  ([, template = '']) => new RegExp(`^${template.split(/\$\{[^}]*\}/).map(escapeRegExp).join('[\\w-]+')}$`)
);

const isIdInMarkup = (id: string): boolean =>
  new RegExp(`["'\`]${escapeRegExp(id)}["'\`]`).test(markup) || templateIds.some((pattern) => pattern.test(id));

describe('admin theme console markup contract', () => {
  it('declares every id the console script looks up', () => {
    const ids = [...read('src/scripts/admin-console/controls.ts').matchAll(/byId<[^>]+>\('([^']+)'\)/g)].map(
      ([, id = '']) => id
    );

    expect(ids.length).toBeGreaterThan(50);
    expect(ids.filter((id) => !isIdInMarkup(id))).toEqual([]);
  });

  // Found through queryAll, not byId: a rename yields an empty list, which saves as "all share buttons off".
  it('keeps the share platform checkboxes and the console script on one attribute', () => {
    const attribute = 'data-article-share-platform';

    expect(read('src/scripts/admin-console/index.ts')).toContain(`'[${attribute}]'`);
    expect(markup).toContain(attribute);
  });

  it('pairs every section tab with exactly one panel', () => {
    const consoleSource = read(`${ADMIN_COMPONENT_DIR}/AdminThemeDevConsole.astro`);
    const tabIds = [...consoleSource.matchAll(/\{ id: '([\w-]+)', label:/g)].map(([, id = '']) => id);
    const panelIds = [...consoleSource.matchAll(/panelAttrs\('([\w-]+)'\)/g)].map(([, id = '']) => id);

    expect(tabIds).toHaveLength(6);
    expect(panelIds).toEqual(tabIds);
  });

  it('gives every reveal scope one source switch', () => {
    const count = (source: string, token: string): number => source.split(token).length - 1;
    const mismatched = adminComponents
      .filter(({ source }) => count(source, 'data-reveal-scope') !== count(source, "'data-reveal-source'"))
      .map(({ name }) => name);

    expect(count(markup, 'data-reveal-scope')).toBeGreaterThan(0);
    expect(mismatched).toEqual([]);
  });
});
