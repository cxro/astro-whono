---
title: Markdown Formatting Guide
description: Demonstrates all Markdown formatting effects supported by this theme, including headings, lists, code, tables, quotes, and more
date: 2026-01-15
badge: Example
tags: [ "Markdown", "Formatting"]
draft: false
---

This article demonstrates all Markdown formatting effects supported by this theme.

First paragraph... (for list preview)
<!-- more -->
Rest of the content...

## Text Formatting

This is normal text. **This is bold text**, *this is italic text*, ***this is bold italic***. You can also use ~~strikethrough~~ to mark deprecated content.

Inline code uses backticks: `const hello = 'world'`, perfect for marking variable names or commands.

## Quotes

> The value of design goes beyond completion. Good design should stand the test of time, maintaining its unique charm and practicality through the years.

You can also use multi-paragraph quotes:

> First paragraph of quote content.
>
> Second paragraph, showing multi-paragraph effect.

Source attribution (using `<cite>` at the last line inside blockquote):

> The value of design goes beyond completion.
>
> <cite>— Dieter Rams</cite>

Pullquote (using `blockquote.pullquote` variant):

<blockquote class="pullquote">
  You hate those people so much and fight them for so long, only to become like them. No ideal in this world is worth such degradation.
  <cite>— One Hundred Years of Solitude</cite>
</blockquote>

## Callouts

Supports four types: `note / tip / info / warning`. Here's minimal syntax first; for finer control, you can also write HTML directly.

~~~md
:::note[Title]
This is the content.
:::
~~~

To write HTML directly (more precise control):

~~~html
<div class="callout note">
  <p class="callout-title" data-icon="none">Title</p>
  <p>This is the content.</p>
</div>
~~~

Notes:
- Default icon determined by type, no `<span class="callout-icon">` needed.
- Hide icon with `data-icon="none"` on `.callout-title`.
- Custom icon with `data-icon="✨"` (optional).

### Syntax Sugar Examples (Callout)

This group shows actual frontend styles for different types, title formats, and content structures.

:::note
This is a no-title example.
:::

:::note[With Title]
This is normal paragraph content.
:::

:::tip[Tip]
Can include inline code `npm run dev`, emphasized text, and [links](https://astro.build).
:::

:::info[Info]
```ts
const hello = 'world';
```
:::

:::warning[Warning]
> Can also include quote blocks.
>
> Can be multiple paragraphs.
:::

Basic syntax:

~~~text
:::type[Optional Title]
Content text
:::
~~~

Only `note / tip / info / warning` supported; unsupported types (like `:::foo[...]`) fall back to `note`.

## Lists

### Unordered List

- First item
- Second item
  - Nested item A
  - Nested item B
- Third item

### Ordered List

1. Preparation
2. Install dependencies
3. Run project
   1. Development mode
   2. Production build

### Task List

- [x] Complete design draft
- [x] Develop homepage
- [ ] Write documentation
- [ ] Deploy to production

## Code Blocks

The following code blocks demonstrate toolbar (language/lines/copy button) and line numbers (enabled by default).

### JavaScript

```javascript
// A simple Astro component example
const greeting = 'Hello, World!';

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
```

### Python

```python
def quick_sort(arr):
    """Quick sort algorithm implementation"""
    if len(arr) <= 1:
        return arr
    
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    
    return quick_sort(left) + middle + quick_sort(right)

# Usage example
numbers = [3, 6, 8, 10, 1, 2, 1]
print(quick_sort(numbers))
```

### CSS

```css
.card {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}
```

### Shell

```bash
# Install dependencies and start dev server
npm install
npm run dev

# Build production version
npm run build
```

## Tables

| Feature | Status | Description |
|:----:|:----:|:----:|
| Responsive Layout | ✅ | Perfect mobile adaptation |
| Dark Mode | 🚧 | In development |
| RSS Feed | ✅ | Multi-feed support |
| Internationalization | ❌ | Planned |

## Links and Images

This is an [external link](https://astro.build) that opens in a new tab.

### Figure / Caption

**Case A: img + figcaption**

<figure class="figure">
  <img src="/images/archive/demo-archive-01.webp" alt="Figure caption example image 1" />
  <figcaption class="figure-caption">Figure caption example: This is the image description text.</figcaption>
</figure>

**Case B: Without figcaption**

<figure class="figure">
  <img src="/images/archive/demo-archive-02.webp" alt="No caption example" />
</figure>

**Case C: picture + figcaption (optional)**

<figure class="figure">
  <picture>
    <source srcset="/images/archive/demo-archive-03.webp" type="image/webp" />
    <img src="/images/archive/demo-archive-02.webp" alt="Figure caption example image 2" />
  </picture>
  <figcaption class="figure-caption">Figure caption example: picture description text.</figcaption>
</figure>

> Note: Current styles make `img` and `picture` visually consistent. `picture` is mainly for providing multiple "fallback versions" of the same image; browser automatically picks the most suitable (e.g., mobile small image, desktop large image, or prefer WebP/AVIF). When automatic selection isn't needed, use `img`.

### Gallery

**Case: Two-image layout (with optional figcaption)**

<ul class="gallery">
  <li>
    <figure>
      <img src="/images/archive/demo-archive-01.webp" alt="Gallery example 1" />
      <figcaption>First image caption (optional)</figcaption>
    </figure>
  </li>
  <li>
    <figure>
      <img src="/images/archive/demo-archive-02.webp" alt="Gallery example 2" />
      <figcaption>Second image caption (optional)</figcaption>
    </figure>
  </li>
</ul>

## Divider

Content above.

---

Content below.

## Math and Special Characters

Common math symbols: π ≈ 3.14159, e ≈ 2.71828

Special characters: © 2026 · ™ · ® · € · £ · ¥ · → · ← · ↑ · ↓

## English Paragraph

> The best way to predict the future is to invent it. — Alan Kay

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

## Mixed Formatting

This paragraph contains **bold**, *italic*, `code`, and [links](/). You can freely combine these elements to create rich reading experiences.

---

That's all Markdown formats supported by this theme. If you find any rendering issues, feel free to submit an Issue!
