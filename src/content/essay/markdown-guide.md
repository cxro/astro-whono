---
title: Markdown 排版指南
description: 展示所有 Markdown 格式效果，包括标题、列表、代码、表格、引用等
date: 2026-01-15
updatedAt: 2026-11-05
badge: 示例
tags: [ "Markdown", "排版"]
draft: false
---

这篇文章展示了本主题支持的所有 Markdown 排版效果。

第一段……（用于列表预览）
<!-- more -->
后续正文……

## 文本格式

这是一段普通文本。**这是粗体文字**，*这是斜体文字*，***这是粗斜体***。你也可以使用 ~~删除线~~ 来标记废弃内容。

行内代码使用反引号包裹：`const hello = 'world'`，非常适合标记变量名或命令。

## 引用

> 设计的价值不止于建造完成。好的设计应该能够经受时间的考验，在岁月流转中依然保持其独特的魅力与实用性。

你也可以使用多段引用：

> 第一段引用内容。
>
> 第二段引用内容，展示多段落效果。

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

~~~md
:::note[标题]
这是正文。
:::
~~~

如需直接写 HTML（更精确控制）：

~~~html
<div class="callout note">
  <p class="callout-title" data-icon="none">标题</p>
  <p>这是正文。</p>
</div>
~~~

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
const hello = 'world';
```
:::

:::warning[Warning]
> 也可以包含引用块。
>
> 也可以换成多段内容。
:::

基础语法如下：

~~~text
:::type[可选标题]
正文内容
:::
~~~

提示块仅支持 `note / tip / info / warning`；`details`、`spoiler` 另有用途（见下一节），其他不支持的类型（如 `:::foo[...]`）会降级为 `note`。

## 高亮、模糊与折叠

用 `==文本==` 标出重点：这是==需要读者留意的一句话==。

用 `:spoiler[文本]` 遮住剧透，点击后显示：故事的结局是:spoiler[他一直都在原地等待]。整段内容可以用块写法：

:::spoiler
这一整段在点击前都是模糊的，适合藏起答案、彩蛋或剧情转折。
:::

用 `:::details[标题]` 折叠次要内容，读者需要时再展开：

:::details[什么时候适合用折叠内容？]
常见问题、补充说明或较长的示例，都可以先收起来，让正文更好读。
:::

:::details[默认展开的折叠内容]{open}
在标题后加 `{open}`，页面打开时就是展开状态。
:::

写法汇总：

~~~md
==高亮文本==

:spoiler[行内模糊]

:::spoiler
整段模糊
:::

:::details[标题]{open}
折叠内容
:::
~~~

说明：
- 模糊只用来防剧透，查看网页源码仍能看到原文，不要用它存放密码等敏感信息；模糊的内容不会出现在文章摘要和搜索结果里。
- `==` 两侧紧贴英文字母或数字时（如 `a==b`）不会变成高亮，代码请放进反引号。
- 絮语卡片支持高亮和模糊；超过 180 字的絮语只显示纯文本摘要，高亮不显示，模糊内容显示为「[隐藏内容]」。

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

| 功能 | 状态 | 说明 |
|:----:|:----:|:----:|
| 响应式布局 | ✅ | 完美适配移动端 |
| 暗色模式 | 🚧 | 开发中 |
| RSS 订阅 | ✅ | 支持多 Feed |
| 国际化 | ❌ | 计划中 |

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

这是一段包含 **粗体**、*斜体*、`代码` 和 [链接](/) 的混合排版文本。你可以在一个段落中自由组合这些元素，创造丰富的阅读体验。

---

以上就是本主题支持的所有 Markdown 格式。如果你发现任何渲染问题，欢迎提交 Issue！
