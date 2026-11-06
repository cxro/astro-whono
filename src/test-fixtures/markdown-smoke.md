---
title: Markdown Smoke Fixture
---

# Markdown Smoke Fixture

## Callout

:::tip[一个小建议]
这里是 smoke fixture 的 callout 内容。
:::

## Content Syntax

这是 ==高亮== 文本，会议 10:30 开始，结局是 :spoiler[被模糊的内容]。

:::spoiler
整段模糊内容。
:::

:::details[折叠标题]
折叠内容。
:::

## Code Block

```js
export const smoke = 'ok';
console.log(smoke);
```

## Math

Inline math $$x + y$$ should render as KaTeX.

$$
x^2 + y^2 = z^2
$$

## Figure

<figure class="figure figure--md figure--left">
  <picture>
    <source srcset="/images/archive/demo-archive-03.webp" type="image/webp" />
    <img src="/images/archive/demo-archive-02.webp" alt="Smoke fixture standalone figure" />
  </picture>
  <figcaption class="figure-caption">Smoke fixture standalone figure</figcaption>
</figure>

## Gallery

<ul class="gallery cols-2">
  <li>
    <figure>
      <img src="/images/archive/demo-archive-01.webp" alt="Smoke fixture gallery item 1" />
      <figcaption>Smoke fixture gallery item 1</figcaption>
    </figure>
  </li>
  <li>
    <figure>
      <img src="/images/archive/demo-archive-02.webp" alt="Smoke fixture gallery item 2" />
    </figure>
  </li>
</ul>
