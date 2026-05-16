import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const createJsonRequest = (url: string, payload: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: {
      origin: new URL(url).origin,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

describe('admin preview api', () => {
  it('renders markdown with project callout and sanitize rules', async () => {
    const { POST } = await import('../src/pages/api/admin/preview');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/preview', {
        collection: 'essay',
        source: [
          '# Preview',
          '',
          ':::warning[注意]',
          '<script>alert("x")</script>',
          '',
          '<figure class="figure"><figcaption>说明</figcaption></figure>',
          ':::'
        ].join('\n')
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/preview')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.collection).toBe('essay');
    expect(payload.result.codeHighlight).toBe('shiki-rehype');
    expect(payload.result.html).toContain('<h1>Preview</h1>');
    expect(payload.result.html).toContain('class="callout warning"');
    expect(payload.result.html).toContain('class="callout-title"');
    expect(payload.result.html).toContain('<figure class="figure">');
    expect(payload.result.html).not.toContain('<script>');
    expect(typeof payload.result.elapsedMs).toBe('number');
  });

  it('renders fenced code with shiki preview highlighting and toolbar structure', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: ['```ts', 'const value = 1;', '```'].join('\n')
    });

    expect(result.codeHighlight).toBe('shiki-rehype');
    expect(result.html).toContain('class="code-block"');
    expect(result.html).toContain('shiki');
    expect(result.html).toContain('<code class="language-ts">');
  });

  it('renders GFM syntax shown by the editor syntax examples', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: ['~~删除线~~', '', '- [x] 已完成', '- [ ] 待办事项'].join('\n')
    });

    expect(result.html).toContain('<del>删除线</del>');
    expect(result.html).toContain('<input type="checkbox" checked disabled>');
    expect(result.html).toContain('<input type="checkbox" disabled>');
  });

  it('annotates markdown H2 and H3 preview nodes with source outline keys', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');
    const { extractMarkdownOutline } = await import('../src/lib/admin-console/editor-outline');
    const source = [
      '## Same',
      '',
      '<h2>Raw heading</h2>',
      '',
      '### Child',
      '',
      '## Same'
    ].join('\n');
    const [first, child, second] = extractMarkdownOutline(source);
    expect(first).toBeDefined();
    expect(child).toBeDefined();
    expect(second).toBeDefined();

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source
    });

    expect(result.html).toContain(`<h2 data-admin-outline-key="${first!.key}">Same</h2>`);
    expect(result.html).toContain('<h2>Raw heading</h2>');
    expect(result.html).toContain(`<h3 data-admin-outline-key="${child!.key}">Child</h3>`);
    expect(result.html).toContain(`<h2 data-admin-outline-key="${second!.key}">Same</h2>`);
  });

  it('renders representative existing content structures', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');
    const { splitMarkdownFrontmatter } = await import('../src/lib/admin-console/frontmatter');

    const markdownGuide = splitMarkdownFrontmatter(
      await readFile('src/content/essay/markdown-guide.md', 'utf8')
    ).bodyText;
    const memo = splitMarkdownFrontmatter(
      await readFile('src/content/memo/index.md', 'utf8')
    ).bodyText;

    const markdownGuideResult = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: markdownGuide
    });
    const memoResult = await renderAdminMarkdownPreview({
      collection: 'memo',
      source: memo
    });

    expect(markdownGuideResult.html).toContain('class="callout note"');
    expect(markdownGuideResult.codeHighlight).toBe('shiki-rehype');
    expect(markdownGuideResult.html).toContain('class="code-block"');
    expect(markdownGuideResult.html).toContain('<code class="language-ts">');
    expect(markdownGuideResult.html).toContain('<figure class="figure">');
    expect(memoResult.html).toContain('<figure class="figure">');
    expect(markdownGuideResult.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(memoResult.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('returns structured json errors for invalid inputs', async () => {
    const { POST } = await import('../src/pages/api/admin/preview');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/preview', {
        collection: 'page',
        source: 123
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/preview')
    } as never);

    expect(response.status).toBe(400);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(false);
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'collection' }),
        expect.objectContaining({ path: 'source' })
      ])
    );
  });

});
