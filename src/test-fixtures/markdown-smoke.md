---
title: Markdown Smoke Fixture
---

# Markdown Smoke Fixture

## Callout

:::tip[A Small Tip]
This is the callout content for the smoke fixture.
:::

## Code Block

```js
export const smoke = 'ok';
console.log(smoke);
```

## Figure

<figure class="figure">
  <picture>
    <source srcset="/images/archive/demo-archive-03.webp" type="image/webp" />
    <img src="/images/archive/demo-archive-02.webp" alt="Smoke fixture standalone figure" />
  </picture>
  <figcaption class="figure-caption">Smoke fixture standalone figure</figcaption>
</figure>

## Gallery

<ul class="gallery">
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
