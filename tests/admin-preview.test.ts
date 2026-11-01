import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
// Load the rendering dependencies during collection, outside the first test's timeout.
import { POST } from '../src/pages/api/admin/preview';

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

  it('keeps math fenced code as code instead of KaTeX', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: ['```math', 'x + y', '```'].join('\n')
    });

    expect(result.html).toContain('class="code-block"');
    expect(result.html).toContain('x + y');
    expect(result.html).not.toContain('class="katex"');
  });

  it('does not treat raw HTML math classes as supported math syntax', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: [
        '<span class="math-inline">x + y</span>',
        '<code class="language-math math-inline">a + b</code>',
        '<pre><code class="language-math">c + d</code></pre>'
      ].join('\n')
    });

    expect(result.html).not.toContain('class="katex"');
    expect(result.html).toContain('x + y');
    expect(result.html).toContain('a + b');
    expect(result.html).toContain('c + d');
    expect(result.html).not.toContain('math-inline');
    expect(result.html).not.toContain('language-math');
  });

  it('keeps markdown math protected while raw html and code highlighting are processed', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: [
        'Inline math $$x + y$$.',
        '',
        '<span class="math-inline">raw + html</span>',
        '<script>alert("x")</script>',
        '',
        '```ts',
        'const value = 1;',
        '```'
      ].join('\n')
    });

    expect(result.html).toContain('class="katex"');
    expect(result.html).toContain('raw + html');
    expect(result.html).not.toContain('math-inline');
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('class="code-block"');
    expect(result.html).toContain('<code class="language-ts">');
  });

  it('renders double-dollar math as KaTeX without Shiki code wrappers', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: ['Inline math $$x + y$$.', '', '$$', 'x^2 + y^2 = z^2', '$$'].join('\n')
    });

    expect(result.html).toContain('class="katex"');
    expect(result.html).toContain('class="katex-display"');
    expect(result.html).not.toContain('class="code-block"');
    expect(result.html).not.toContain('class="code-toolbar"');
    expect(result.html).not.toContain('language-text');
    expect(result.html).not.toContain('shiki');
  });

  it('keeps single-dollar and ordinary dollar text outside math rendering', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: 'The price is $12 and inline single-dollar $x$ stays plain text.'
    });

    expect(result.html).not.toContain('class="katex"');
    expect(result.html).toContain('$12');
    expect(result.html).toContain('$x$');
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

  it('applies Astro-compatible default smartypants typography in preview', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');

    const result = await renderAdminMarkdownPreview({
      collection: 'essay',
      source: 'He said "Hello" -- ok.'
    });

    expect(result.html).toContain('“Hello”');
    expect(result.html).toContain('— ok.');
    expect(result.html).not.toContain('"Hello"');
    expect(result.html).not.toContain('-- ok.');
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

  it('renders about markdown-first preview with friend and FAQ directives', async () => {
    const { getThemeSettings } = await import('../src/lib/theme-settings');

    const response = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/preview', {
        collection: 'about',
        entryId: 'index',
        source: [
          '## Hello',
          '',
          'about body',
          '',
          ':::friend{name="Alice" url="https://alice.example" avatar="friends/alice.webp"}',
          'Engineer',
          ':::',
          '',
          ':::friend{name="Unsafe" url="javascript:alert(1)" avatar="http://bad.example/a.webp"}',
          'Should not render as a card.',
          ':::',
          '',
          ':::faq{question="能编辑吗？"}',
          '可以。',
          '',
          '::site-info{name="Whono" url="https://astro.whono.me/" description="一个极简的双栏 Astro 主题" avatar="author/avatar.webp"}',
          ':::',
          '',
          '## 联系',
          '',
          '::contact-links'
        ].join('\n')
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/preview')
    } as never);

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text());
    expect(payload.ok).toBe(true);
    expect(payload.result.collection).toBe('about');
    expect(payload.result.html).toContain('<h2 data-admin-outline-key=');
    expect(payload.result.html).toContain('about body');
    expect(payload.result.html).toContain('<ul class="friend-list">');
    expect(payload.result.html).toContain('class="friend-card"');
    expect(payload.result.html).toContain('href="https://alice.example/"');
    expect(payload.result.html).toContain('src="/friends/alice.webp"');
    expect(payload.result.html).toContain('Engineer');
    expect(payload.result.html).toContain('<div class="qa-list" aria-label="常见问题">');
    expect(payload.result.html).toContain('<summary class="qa-question">');
    expect(payload.result.html).toContain('能编辑吗？');
    expect(payload.result.html).toContain('class="about-site-info"');
    expect(payload.result.html).toContain('data-about-site-info-copy');
    expect(payload.result.html).toContain('data-about-copy-text=');
    expect(payload.result.html).toContain('<dt class="about-site-info__field-label">名称</dt>');
    expect(payload.result.html).toContain('<dd class="about-site-info__field-value">Whono</dd>');
    expect(payload.result.html).toContain('avatar: author/avatar.webp');
    expect(payload.result.html).not.toContain('about-site-info__avatar');
    expect(payload.result.html).not.toContain('about-site-info__eyebrow');
    expect(payload.result.html).not.toContain('src="/author/avatar.webp"');
    expect(payload.result.html).toContain('class="contact-list"');
    expect(payload.result.html).toContain('href="https://github.com/cxro/astro-whono"');
    expect(payload.result.html).toContain(`href="mailto:${getThemeSettings().settings.site.socialLinks.email}"`);
    expect(payload.result.html).not.toContain('data-about-contact-links');
    expect(payload.result.html).not.toContain('javascript:alert');
    expect(payload.result.html).not.toContain('http://bad.example');
  });

  it('keeps about-only directives out of essay and memo preview rendering', async () => {
    const { renderAdminMarkdownPreview } = await import('../src/lib/admin-console/preview');
    const source = [
      ':::faq{question="Should not become about FAQ"}',
      'Answer',
      ':::'
    ].join('\n');

    const [essayResult, memoResult] = await Promise.all([
      renderAdminMarkdownPreview({ collection: 'essay', source }),
      renderAdminMarkdownPreview({ collection: 'memo', entryId: 'index', source })
    ]);

    for (const result of [essayResult, memoResult]) {
      expect(result.html).not.toContain('qa-list');
      expect(result.html).not.toContain('qa-item');
      expect(result.html).not.toContain('qa-question');
      expect(result.html).not.toContain('contact-list');
      expect(result.html).toContain('Answer');
    }
  });

  it('requires fixed about entryId for markdown-first preview', async () => {
    const basePayload = {
      collection: 'about',
      source: 'about body'
    };

    const missingResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/preview', basePayload),
      url: new URL('http://127.0.0.1:4321/api/admin/preview')
    } as never);
    expect(missingResponse.status).toBe(400);
    expect(JSON.parse(await missingResponse.text()).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'entryId' })
      ])
    );

    const wrongResponse = await POST({
      request: createJsonRequest('http://127.0.0.1:4321/api/admin/preview', {
        ...basePayload,
        entryId: 'other'
      }),
      url: new URL('http://127.0.0.1:4321/api/admin/preview')
    } as never);
    expect(wrongResponse.status).toBe(400);
    expect(JSON.parse(await wrongResponse.text()).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'entryId' })
      ])
    );
  });

});
