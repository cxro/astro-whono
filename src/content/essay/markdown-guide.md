---
title: Markdown Formatting Guide
description: Show all Markdown formatting effects, including headings, lists, code, tables, quotes, etc.
date: 2026-01-15
badge: Example
tags: ["Markdown", "formatting"]
draft: false
---

This article demonstrates all Markdown formatting supported by this theme.

First paragraph... (for list preview)

<!-- more -->

Following content...

## Text Formatting

This is a normal paragraph. **This is bold text**, _this is italic text_, **_this is bold italic_**. You can also use ~~strikethrough~~ to mark deprecated content.

Inline code is wrapped with backticks: `const hello = 'world'`, which is great for marking variable names or commands.

## Blockquote

> The value of design is not just in its completion. Good design should stand the test of time, maintaining its unique charm and practicality as years go by.

You can also use multi-paragraph blockquotes:

> First paragraph of the quote.
>
> Second paragraph of the quote, showing multi-paragraph effect.

来源标注（`<cite>` 放在 blockquote 内最后一行）：

> 设计的价值不止于建造完成。
>
> <cite>— Dieter Rams</cite>

Pullquote（使用 `blockquote.pullquote` 变体）：

<blockquote class="pullquote">
  你那么憎恨那些人，跟他们斗了那么久，最终却变得和他们一样。人世间没有任何理想值得以这样的沉沦为代价。
  <cite>— 百年孤独</cite>
</blockquote>

## 提示块（Callout）

支持 `note / tip / info / warning` 四种语法糖。下面先给一个最小写法；如需更精细控制，也可以直接写 HTML。

```md
:::note[标题]
这是正文。
:::
```

如需直接写 HTML（更精确控制）：

```html
<div class="callout note">
  <p class="callout-title" data-icon="none">标题</p>
  <p>这是正文。</p>
</div>
```

说明：

- 默认图标由类型决定，不需要 `<span class="callout-icon">`。
- 隐藏图标用 `data-icon="none"`，写在 `.callout-title` 上。
- 自定义图标可用 `data-icon="✨"`（可选）。

### 语法糖变体示例（Callout）

这一组示例主要展示不同类型、标题形式与内容结构在前端的实际样式。

:::note
这是无标题示例。
:::

:::note[带标题]
这是普通段落正文。
:::

:::tip[Tip]
可以包含行内代码 `npm run dev`、强调文本和 [链接](https://astro.build)。
:::

:::info[Info]

```ts
const hello = "world";
```

:::

:::warning[Warning]

> 也可以包含引用块。
>
> 也可以换成多段内容。
> :::

基础语法如下：

```text
:::type[可选标题]
正文内容
:::
```

仅支持 `note / tip / info / warning`；不支持的类型（如 `:::foo[...]`）当前会降级为 `note`。

## 列表

### 无序列表

- 第一项
- 第二项
  - 嵌套项 A
  - 嵌套项 B
- 第三项

### 有序列表

1. 准备工作
2. 安装依赖
3. 运行项目
   1. 开发模式
   2. 生产构建

### 任务列表

- [x] 完成设计稿
- [x] 开发首页
- [ ] 编写文档
- [ ] 发布上线

## 代码块

以下代码块用于展示工具栏（语言/行数/复制按钮）与行号（默认开启）。

### JavaScript

```javascript
// 一个简单的 Astro 组件示例
const greeting = "Hello, World!";

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // 55
```

### Python

```python
def quick_sort(arr):
    """快速排序算法实现"""
    if len(arr) <= 1:
        return arr

    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]

    return quick_sort(left) + middle + quick_sort(right)

# 使用示例
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
# 安装依赖并启动开发服务器
npm install
npm run dev

# 构建生产版本
npm run build
```

## 表格

|    功能    | 状态 |      说明      |
| :--------: | :--: | :------------: |
| 响应式布局 |  ✅  | 完美适配移动端 |
|  暗色模式  |  🚧  |     开发中     |
|  RSS 订阅  |  ✅  |  支持多 Feed   |
|   国际化   |  ❌  |     计划中     |

## 链接与图片

这是一个 [外部链接](https://astro.build)，会在新标签页打开。

### Figure / Caption

**案例 A：img + figcaption**

<figure class="figure">
  <img src="/images/archive/demo-archive-01.webp" alt="图注示例图片 1" />
  <figcaption class="figure-caption">图注示例：这是图片的说明文字。</figcaption>
</figure>

**案例 B：无 figcaption**

<figure class="figure">
  <img src="/images/archive/demo-archive-02.webp" alt="无图注示例" />
</figure>

**案例 C：picture + figcaption（可选）**

<figure class="figure">
  <picture>
    <source srcset="/images/archive/demo-archive-03.webp" type="image/webp" />
    <img src="/images/archive/demo-archive-02.webp" alt="图注示例图片 2" />
  </picture>
  <figcaption class="figure-caption">图注示例：picture 的说明文字。</figcaption>
</figure>

> 说明：当前样式下 `img` 与 `picture` 视觉一致。`picture` 主要用于给同一张图准备多个“备用版本”，浏览器将自动选最合适的那张（如手机小图、电脑大图，或优先用 WebP/AVIF）。不需要自动选版本时，用 `img` 就行。

### Gallery

**案例：两图排版（含可选 figcaption）**

<ul class="gallery">
  <li>
    <figure>
      <img src="/images/archive/demo-archive-01.webp" alt="画廊示例 1" />
      <figcaption>第一张图注（可选）</figcaption>
    </figure>
  </li>
  <li>
    <figure>
      <img src="/images/archive/demo-archive-02.webp" alt="画廊示例 2" />
      <figcaption>第二张图注（可选）</figcaption>
    </figure>
  </li>
</ul>

## 分割线

上方是一些内容。

---

下方是另一些内容。

## 数学与特殊字符

常用数学符号：π ≈ 3.14159，e ≈ 2.71828

特殊字符：© 2026 · ™ · ® · € · £ · ¥ · → · ← · ↑ · ↓

## 英文段落

> The best way to predict the future is to invent it. — Alan Kay

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

## 混合排版

这是一段包含 **粗体**、_斜体_、`代码` 和 [链接](/) 的混合排版文本。你可以在一个段落中自由组合这些元素，创造丰富的阅读体验。

---

以上就是本主题支持的所有 Markdown 格式。如果你发现任何渲染问题，欢迎提交 Issue！
