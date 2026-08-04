# astro-whono

[中文](README.md) | [English](README.en.md)

[![CI](https://img.shields.io/github/actions/workflow/status/cxro/astro-whono/ci.yml?style=flat&label=CI&labelColor=2E3440&color=A3BE8C&logo=githubactions&logoColor=ECEFF4)](https://github.com/cxro/astro-whono/actions/workflows/ci.yml)  [![Node](https://img.shields.io/badge/Node-%3E%3D22.12.0-81A1C1?style=flat&labelColor=2E3440&logo=nodedotjs&logoColor=ECEFF4)](https://github.com/cxro/astro-whono#%E7%8E%AF%E5%A2%83%E8%A6%81%E6%B1%82)  [![Astro](https://img.shields.io/github/package-json/dependency-version/cxro/astro-whono/astro?branch=main&style=flat&label=Astro&labelColor=2E3440&color=BC52EE&logo=astro&logoColor=ECEFF4)](https://docs.astro.build/)  [![License](https://img.shields.io/badge/License-MIT-4C566A?style=flat&labelColor=2E3440&logo=opensourceinitiative&logoColor=ECEFF4)](LICENSE)

**✨ astro-whono 支持本地后台可视化预览写作**

一个极简双栏的 Astro 主题，用于个人写作与轻量内容发布。


## 链接

- 在线演示：<https://astro.whono.me>
- 仓库地址：<https://github.com/cxro/astro-whono>


## 预览

<p align="center">
  <img src="public/preview-light.png" width="49%" alt="浅色预览" />
  <img src="public/preview-dark.png" width="49%" alt="深色预览" />
</p>


## 特性

- 双栏布局（侧栏导航 + 内容区）
- 移动端适配
- 内容集合：随笔 / 絮语 / 小记 / 关于（归档为目录视图）
- 内置本地 Admin Console（/admin）：开发环境下管理站点配置、内容与图片资源
- 絮语草稿生成器：/bits 页面一键生成 Markdown（复制/下载），支持多图与自动读取尺寸
- RSS：默认归档订阅 + 分栏订阅
- 浅色 / 深色模式 + 阅读模式


## 开始使用

### 环境要求

- Node.js 22.12+（建议使用 `.nvmrc`）


### 快速开始

```bash
npm install
npm run dev
```

<details>
  <summary>Windows（PowerShell）提示</summary>

如遇执行策略拦截 `npm.ps1`，可用：

- `cmd /c npm run ...`
- 或改用 Git Bash / WSL
</details>


### 常用命令

  - `npm run dev`：启动本地开发服务
  - `npm run build`：生成静态站点
  - `npm run preview`：预览构建产物
  - `npm run new:bit`：创建一条 bits 草稿

<details>
  <summary>维护者校验</summary>

以下命令用于维护主题本身，普通写作与部署通常不需要执行。

```bash
# 基础回归：Astro check、Vitest、build
npm run verify

# Markdown 渲染契约：改动渲染链路、文章样式或代码块工具栏时执行
npm run build
npm run check:markdown-smoke

# 发布前产物检查：需已确定正式域名
SITE_URL=https://你的域名 npm run build
SITE_URL=https://你的域名 npm run check:prod-artifacts

# Admin 边界检查：仅改动 /admin/** 或 /api/admin/** 时执行
npm run check:preview-admin

# 生产依赖审计：发布前或依赖变更时执行
npm run audit:prod
```
</details>


## 部署

### 一键部署

[![Deploy to Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https://github.com/cxro/astro-whono)&nbsp;&nbsp;[![Deploy to Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)](https://app.netlify.com/start/deploy?repository=https://github.com/cxro/astro-whono)&nbsp;&nbsp;[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=flat&logo=cloudflare&logoColor=white)](https://dash.cloudflare.com/?to=/:account/workers-and-pages)

> 建议在生产环境设置：SITE_URL=https://你的域名 （不要以 / 结尾）。
> 未设置时会使用占位地址，页面可访问，但分享与收录相关链接可能不完整。

<details>
  <summary><strong>Cloudflare Pages 部署（手动导入仓库）</strong></summary>

**构建设置**
- Framework preset：Astro
- Build command：`npm run build`
- Output directory：`dist`

**Node.js 版本（通常不用填）**
- 本项目已提供 `.nvmrc`，Cloudflare Pages 会自动读取。
- 如需手动指定，可在 Pages 的环境变量里设置：`NODE_VERSION=22.22.0`

**环境变量（生产环境应设置）**
- 在 Pages 项目 → Settings → Environment variables 添加：`SITE_URL=https://你的域名`（例如 `https://astro.whono.me`，不要以 `/` 结尾）
- `SITE_URL` 用于生成 canonical、Open Graph 的 `og:url`、RSS 链接与 sitemap 等绝对链接；未设置时相关链接会退化为占位域名，影响分享预览与搜索收录。

**关于 sitemap / robots**
- 只有设置了 `SITE_URL`，才会生成 sitemap，并且 `/robots.txt` 才会输出 `Sitemap:` 行（避免指向错误域名）。

</details>

<details>
<summary><strong>部署后检查</strong></summary>

- 首页 / 列表 / 详情页可访问
- RSS 可访问（`/rss.xml` 及分栏 RSS）
- 设置 `SITE_URL` 后：canonical / `og:url` 指向你的域名
- Network 不再请求演示域名资源

</details>


## 配置与入口

### 项目入口

- 站点配置：`site.config.mjs`
- 内容集合：`src/content.config.ts`
- 样式共享入口：`src/styles/global.css`
- 页面 / 场景样式入口：`src/styles/home.css`、`src/styles/about.css`、`src/styles/memo.css`、`src/styles/article.css`、`src/styles/bits-page.css`
- 后台样式入口：`src/styles/components/admin/shell.css` + `src/styles/components/admin/**` 路由私有样式；不再提供全量 `admin.css` 聚合入口

### Admin Console（/admin）

内置本地 Admin Console，仅面向开发环境，用于查看站点概况、调整主题配置、编辑内容与导入导出 settings 快照。

启动 `npm run dev` 后访问 `http://localhost:4321/admin/`（端口以实际为准）。

| 入口 | 用途 |
| :---: | :--- |
| `/admin/` | 后台稳定入口与 Site Overview |
| `/admin/theme/` | Theme Console，编辑站点信息、侧栏、首页与内页文案等 |
| `/admin/images/` | 图片资源浏览与路径辅助 |
| `/admin/data/` | settings 快照导出 / dry-run 导入 / 确认写入 |
| `/admin/content/` | 随笔 / 絮语 / 小记 / 关于页的本地编辑、新建与源文件导出 |

> 使用详情：[Admin Console 快速指南](https://astro.whono.me/archive/admin-console-guide/) · [Theme Console 配置指南](https://astro.whono.me/archive/theme-console-guide/) · [Content Console 使用指南](https://astro.whono.me/archive/content-console-guide/)

生产构建保持静态站点输出：`/admin/` 可按 Theme 设置显示只读公开 Overview 或关闭态文案，其他后台子路由与 `/api/admin/**` 仅在本地开发可用。

#### 兼容迁移（已 fork 用户）

- 未创建 `src/data/settings/*.json` 时，前台仍按 `settings > legacy > default` 读取
- 首次在 `/admin/theme/` 保存后才会生成对应的 JSON 文件，无需手动迁移


## 内容与写作

### 内容与路由

内容集合（Content Collections）：
- 随笔：位于 `src/content/essay` 目录
- 絮语：位于 `src/content/bits` 目录
- 小记：位于 `src/content/memo/index.md`
- 关于：位于 `src/content/about/index.md`（固定单页）
- 归档：由随笔集合按 `archive` 字段生成目录视图

主要路由：
- 列表页：`/archive/`、`/essay/`、`/bits/`、`/memo/`、`/about/`
- 详情页规范入口：/archive/[slug]（/essay/[slug] 保留兼容跳转）

草稿规则：
- `essay` / `bits` 的 `draft: true` 在本地开发可见，生产构建、RSS 与公开列表会过滤
- `memo` 是单页内容；`src/content/memo/index.md` 不应标记为草稿，生产构建会终止以避免 `/memo/` 输出空页

### 图片资源

- 文章正文图片：建议放 `src/content/**` 或 `src/assets/**`， Astro 在构建时可以参与处理优化
- `/bits/` 配图：放 `public/bits/**`，并填写实际文件路径，例如 `bits/demo-01.jpg`
- `/bits/` 默认头像：放 `public/author/**`，并填写实际文件路径，例如 `author/your-avatar.png`
- 首页 Hero：支持 `src/assets/**`、`public/**` 和 `https://` 图片地址
- 需要公共直链，或不希望经过 Astro 处理的图片：放 `public/**`

### 核心字段（Frontmatter）

随笔：
```yaml
title: My Post
date: 2026-01-01
draft: false        # 草稿：上线后不会出现在列表/RSS（本地预览可见，默认是 false，可省略）
archive: true       # 归档开关：false 不进 /archive 与 /archive/rss.xml（默认 true，详情与 /essay 仍可见，可省略）
slug: optional      # 自定义 URL slug（默认使用拍平后的内容路径，例如 2024/my-post → 2024-my-post）
badge: optional     # 列表徽标；未填时列表显示“随笔”
updatedAt: 2026-01-02 # 可选更新日期；填写后前台日期显示为“更新于：YYYY-MM-DD”
```

`date` 建议使用 `YYYY-MM-DD`，用于归档、排序和日期展示；旧内容中的 ISO 8601 datetime 兼容读取，按日期部分处理。需要保留具体发布时间时，可另填 `publishedAt: 2026-01-01T12:00:00+08:00`。

絮语（bits）：
```yaml
date: 2026-01-01T12:00:00+08:00 # 示例；生成器按本地时区输出
tags:                           # 可选标签（默认空数组，可省略）
  - loc:深圳                    # 地点标签写法：loc:<地点>，仅展示第一个
  - 阅读
images:                         # 可选：多图（自动读取图片尺寸，用于减少页面跳动 CLS）
  - src: bits/demo-01.webp      # 支持相对路径 bits/... 或绝对 URL https://...
    width: 800                  # 可选；建议填写，生成器 / 图片选择器会自动回填
    height: 800                 # 可选；建议填写，生成器 / 图片选择器会自动回填
# draft: true   # 可选：草稿；`dev` 可见，`build/preview` 与线上默认不显示
```

当前 `/bits/` 不生成详情页，`slug` 通常无需填写。

作者信息（仅 /bits/ 页面）：

- 默认作者与头像优先读取 Theme Console 的 `page.bits.defaultAuthor`；未创建 `src/data/settings/page.json` 时回退到 `site.config.mjs` 的 `site.author` / `site.authorAvatar`
- 头像仅写相对图片路径（不带 `public/` 与前导 `/`），例如 `author/avatar.webp`，指向 `public/**` 中实际存在的文件；缺失或加载失败时回退到首字母头像
- 单条 bits 可在 frontmatter 用 `author` 覆盖，头像规则相同：

```yaml
author:
  name: Alice
  avatar: author/alice.webp
```


### 摘要与描述（description）

- 列表摘要默认从正文生成（清洗后截断）
- 可用 `<!-- more -->` 指定摘要截取位置
- `description` 仅用于 SEO/OG（meta description），不影响列表摘要


### 写作约定（内容块）

- Callout：`:::note[title] ... :::`（note / tip / info / warning）
- Figure：`figure.figure > (img|picture) + figcaption.figure-caption?`，可选 `figure--sm/md/lg/full` 与 `figure--left/center/right`
- Gallery：`ul.gallery > li > figure > (img|picture) + figcaption?`，可选 `cols-2` / `cols-3`
- Math：支持双美元公式，行内写 `$$x$$`，块级写 `$$ ... $$`；单美元 `$x$` 不作为公式解析
- Quote：标准 `blockquote`，可选 `cite` 标注来源
- Pullquote：`blockquote.pullquote`
- Code Block：构建时增强工具栏/复制按钮/行号（作者无需额外写法）

Callout 示例：

```md
:::note[Note]
这里是正文……
:::
```


## 字体与许可

本主题使用两套字体排版（自托管 + 子集化）：
- Noto Serif SC（400 / 600）
- LXGW WenKai Lite（Regular）

仓库提交的是子集化后的 WOFF2 字体（latin / cjk-common / cjk-ext 三段，`unicode-range` 按需加载），因此 **clone 即用**。
子集字符集由仓库文本 + `tools/charset-base.txt`（3500 常用字）共同生成，用来降低缺字概率。

缺字或更换源字体时，运行 `npm run font:build` 重新生成子集；步骤与文件清单见下。

<details>
  <summary>子集再生成与文件清单</summary>

1. 安装 Python 3，执行 `python -m pip install fonttools brotli zopfli`，确认 `pyftsubset --help` 可用（不可用时把 Python Scripts 目录加入 `PATH`）
2. 把源字体放到 `tools/fonts-src/`
3. 运行 `npm run font:build`；缺字时把字符补到 `tools/charset-base.txt` 后重跑
4. `tools/charset-common.txt` 由 `npm run font:charset` 重生成，不要手改

子集文件（仓库内）：
- `public/fonts/lxgw-wenkai-lite-latin.woff2`
- `public/fonts/lxgw-wenkai-lite-cjk-common.woff2`
- `public/fonts/lxgw-wenkai-lite-cjk-ext.woff2`
- `public/fonts/noto-serif-sc-400-latin.woff2`
- `public/fonts/noto-serif-sc-400-cjk-common.woff2`
- `public/fonts/noto-serif-sc-400-cjk-ext.woff2`
- `public/fonts/noto-serif-sc-600-latin.woff2`
- `public/fonts/noto-serif-sc-600-cjk-common.woff2`
- `public/fonts/noto-serif-sc-600-cjk-ext.woff2`

源字体（不入库）：
- `tools/fonts-src/LXGWWenKaiLite-Regular.woff2`
- `tools/fonts-src/NotoSerifSC-Regular.ttf`
- `tools/fonts-src/NotoSerifSC-SemiBold.ttf`
</details>

字体许可：SIL Open Font License 1.1（见 `public/fonts/OFL-LXGW-WenKai-Lite.txt` 与 `public/fonts/OFL-NotoSerifSC.txt`）。

### 配置排版字体

在开发模式下打开 Theme Console（`/admin/theme/` →「排版字体」），可分别设置正文、文案、等宽和品牌字体，保存后在下次构建时生效。选项包括系统字体、自托管字体，以及构建时下载并自托管的在线字体，页面加载不访问第三方字体服务；内置选项以外的字体在 `src/lib/fonts/registry.ts` 中注册。详见 [Theme Console 配置指南 →「排版字体」](https://astro.whono.me/archive/theme-console-guide/)。

运行 `npm run check:font-charset` 可检查字符集和字体子集是否与站点内容一致；检查失败时，按提示运行 `npm run font:build` 重新生成。

### 配置站点图标

在开发模式下打开 Theme Console（`/admin/theme/` →「站点设置」→「站点图标」），可上传正方形 PNG 分别自定义浏览器标签页图标与移动端触摸图标。上传文件以内容哈希命名写入 `public/images/site/`，替换后不受浏览器图标缓存影响；保存并重新构建后生效。

自定义标签页图标（SVG 或 PNG 任一）后，另一空槽位不再输出主题默认图标，避免部分浏览器继续显示默认图标；触摸图标独立回退，未自定义时保持主题默认。SVG 图标暂不支持在控制台上传，可直接替换 `public/favicon.svg`，或在 `src/data/settings/site.json` 的 `favicon.svg` 中填写 `public/**` 下的 SVG 路径。


## RSS

- `/rss.xml`（默认 RSS；与 `/archive/rss.xml` 使用同源归档数据）
- `/archive/rss.xml`（归档订阅）
- `/essay/rss.xml`

部署时建议设置 `SITE_URL`（影响 RSS/OG/canonical 的绝对链接）。


## 贡献

欢迎创建 Issue 来报告问题或提出想法。
欢迎提交 Pull Request 参与开发，建议从 feature/* 分支发起。

### Fork 同步上游

```bash
git remote add upstream https://github.com/cxro/astro-whono.git
git fetch upstream --tags
git checkout main
git merge upstream/main
git push origin main --tags
```


## 致谢

- 感谢 [elizen/elizen-blog](https://github.com/elizen/elizen-blog)，这是本主题设计的起点，其风格源自Hugo 主题  [yihui/hugo-ivy](https://github.com/yihui/hugo-ivy)


## 许可证

License：MIT
