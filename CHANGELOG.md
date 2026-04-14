# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning.


## [Unreleased]

### Added
- 新增后台真实路由壳层：`/admin/` 现为后台稳定入口与概览页，`/admin/theme/` 承担 Theme Console 实际编辑工作流。
- 新增 `AdminLayout / AdminShell / AdminNav` 共享后台壳层，以及 `theme-shared.ts` 作为 Theme Console 新共享入口。
- 新增 `/admin/data/` Data Console，以及 settings 导出包协议与对应导出接口。
- 新增后台概览聚合数据读取层，`/admin/` 在开发态会展示内容统计与最近内容。
- 新增 `/admin/content/` 与 `/admin/content/:collection/` 只读内容控制台，以及对应的服务端内容索引聚合层与复制路径脚本。
- 新增 `/admin/media/` Media Console，首批提供目录浏览、搜索、分页、路径复制、字段上下文 value 辅助，以及大文件提示。
- 新增 `/admin/checks/` 与 `src/lib/admin-console/checks.ts`，首批聚合 settings 保护态、essay slug、bits 媒体路径与 tag 路由键诊断。
- 新增 Phase 4A 媒体共享层 `src/lib/admin-console/media-shared.ts`，以及 `GET /api/admin/media/list/`、`GET /api/admin/media/meta/` 两个 dev-only 媒体只读接口。
- 新增后台共用 `AdminMediaPicker` dialog 与 Theme / Content 共享的 media picker 客户端控制器。
- 新增 Media Console 显式“刷新媒体库”入口，以及次级“最近修改”快捷筛选；结果按本地文件最近修改时间派生。
- 新增 Theme Console 的 `/admin/` Overview 公开展示开关与关闭态文案配置。

### Changed
- Theme Console 的未保存离开提醒从单纯 `beforeunload` 扩展为路由级 dirty guard；切换后台真实路由时会先显式确认。
- `/admin` 边界检查与静态产物校验现同步覆盖 `/admin/`、`/admin/theme/`、`/admin/data/` 与 `/api/admin/data/settings/`，并确保后台路由继续排除在 sitemap 之外。
- `/admin` 边界检查与静态产物校验现继续扩展到 `/admin/content/` 与 `/admin/content/:collection/`，确保内容控制台在 preview / production 下保持只读。
- `/admin` 边界检查与静态产物校验现继续扩展到 `/admin/media/`，并保证该路由仍固定排除在 sitemap 之外。
- Theme Console 共享规则实现已迁入 `theme-shared.ts`；`shared.ts` 现退为兼容导出层，降低后续后台能力继续堆进旧文件的风险。
- Data Console 的导入 dry-run / revision 冲突检测 / 实际写盘继续复用 `/api/admin/settings/` 现有链路，不新增独立写盘规则。
- `/admin/` Overview 的 Checks 卡现改为消费 `/admin/checks/` 的结构化诊断摘要，并继续保留 preview/build CLI 基线提示。
- `bits.images[*].src` 的后台校验现与文档契约对齐，只接受仓库内相对图片路径或 `https://` 远程 URL，不再把 `http://` 误判成本地路径。
- `bits` collection 编辑页现用图片行编辑器替代原始 JSON 文本输入；图片选择、宽高回填与最终保存继续复用既有内容写盘链路。
- Theme Console 的 `home.heroImageSrc` 与 `page.bits.defaultAuthor.avatar` 现共享字段级媒体辅助，并在 preview / production 边界检查中纳入 `/api/admin/media/list/`、`/api/admin/media/meta/` 的静态壳断言。
- `/api/admin/media/list/` 现支持 `dir` 目录参数，可按 `public/**`、`src/assets/**`、`src/content/**` 受控范围收窄扫描；Theme / Content 既有 picker 契约保持兼容。
- `/admin/media/` 开发态现优先消费 SSR 注入的完整 browse 轻索引；一级分类、二级分类、搜索与分页切换在客户端本地完成，详情区仅在选中后按 `path` 请求 `/api/admin/media/meta/` 补齐尺寸、体积与 MIME。
- 媒体共享层现对 content owner、asset list、本地 inspection meta 与 `recent` scope 索引使用短 TTL 进程内缓存，并支持通过刷新入口显式失效；整体仍保持 `list/meta` 只读 contract 不变。
- `/admin/` Overview 现输出稳定 `data-admin-overview-mode`，preview/build 边界检查改为按 maintainer/public/hidden 模式验证页面契约。

### Fixed
- 修正文档中的 Data Console manifest 协议说明，明确当前固定字段为 `schemaVersion / createdAt / includedScopes / excludes / locale`。
- 修复 Theme Console、Content Console 与 Media Console 对 `/api/admin/media/list/`、`/api/admin/media/meta/` 的尾斜杠拼接不一致问题，避免部分入口下出现 404。
- 修复 `/admin/media/` 首屏挂载后会重复拉取同一列表，以及 browse 切换仍依赖服务端列表导致的明显卡顿；当前首屏与 browse 切换均优先走本地 bootstrap 结果。
- 修复媒体浏览默认系统资源过滤过宽的问题；现在仅隐藏 `public/` 根目录级站点图标/预览资源，不再误伤 `src/content/**/preview-*.png` 这类真实附件。

## [0.3.1] - 2026-03-24

### Changed
- 升级 Astro 到 v6，并同步更新相关官方包，延续现有主题、内容集合与构建流程。
- 明确 Theme Console 的生产环境边界：`/admin/` 保留只读提示，`/api/admin/settings/` 仅供本地开发使用。
- 优化代码块交互脚本的加载范围：正文页与小记页按需加载复制与行号逻辑，非正文页不再加载相关脚本。

### Fixed
- 修复移动端首页留白以及文章、小记页标题和元信息显示异常的问题，优化手机端浏览体验。
- 修复 Windows 下 `npm run check:preview-admin` 无法执行的问题。
- 修复 Hero 图片与 Bits 头像在不同入口下校验规则不一致的问题；Theme Console、内容配置与前台展示现已保持一致。
- 修复 Theme Console 在本地开发环境 `/admin/` 首次载入配置时的注入风险。
- 修复 Markdown 正文中的表格在文章页展示异常的问题。
- 补齐字体子集重建的依赖与步骤说明；缺失 `pyftsubset` 时，脚本现在会直接提示安装方式。

## [0.3.0] - 2026-03-21

本次更新聚焦标签浏览、列表检索与 `/bits/` 浏览体验，并进一步提高 Theme Console 在本地维护场景下的稳定性。

### Added
- `/archive/` 新增标签入口，并提供可分页的静态标签结果页。
- 首页导语支持直接进入标签浏览；`/bits/` 新增年份筛选，并补充更完整的搜索结果展示。
- Theme Console 新增文章元信息显示选项，可控制正文页是否显示字数与阅读时长。
- `/bits/` 新增年份筛选，并增强搜索结果展示。

### Changed
- 列表搜索现可与归档标签页联动，归档页无结果的年份分组会自动收起。
- `/archive/` 与 `/essay/` 补充了更明确的页面描述，改善分享与搜索引擎识别。
- `/bits/` 改为分页浏览；搜索支持高亮、命中片段、键盘操作，并可直接跳转到对应内容。
- 统一文章路由与 slug 规则，避免与 `tag/`、`page/` 子路由冲突。
- 调整测试与 CI 基线：Markdown smoke check 改用专用测试页面，并新增 `npm test` 与轻量回归测试，减少 fork 或替换示例内容后的无关 CI 失败。

### Fixed
- 修复无 JavaScript 时 `/archive/` 标签入口不可用，以及标签结果页标签显示异常的问题。
- 修复 `/archive/` 与 `/essay/` 列表搜索过滤失效、跨时区日期显示异常，以及开发环境下可能读取旧索引的问题。
- 修复 `/bits/` 搜索与年份筛选结果不同步、图片预览在特殊字符场景下的输出异常，以及搜索框交互时的轻微跳动。
- 修复 Theme Console 在配置缓存、校验提示和手动修改 settings JSON 后排序一致性方面的多个问题。
- 修复 archive 异常标签可能生成错误路由与统计的问题；构建时会直接中止并提示。


## [0.2.0] - 2026-03-13
本次更新聚焦本地 Theme Console，方便 fork 或 clone 后更快接管站点配置。

### Added
- 新增本地 Theme Console `/admin/`，可在开发环境中集中管理站点标题、默认描述、页脚版权、首页导语、侧栏导航、社交链接、内页主副标题和 Bits 默认作者。
- 新增界面显示选项，可控制阅读模式入口、代码行号和侧栏分隔线样式。
- 新增首页导语与侧栏导航的细粒度配置，支持独立显隐、排序和点缀字符设置。
- 新增本地配置保存机制；首次保存会生成 `src/data/settings/*.json`，旧配置仍可继续兼容读取。

### Changed
- 首页、侧栏、页脚和关于页等站点信息统一接入 Theme Console 配置，后台修改可直接反映到前台。
- 首页 Hero 与各内页标题配置能力增强，支持自定义 Hero 图片和栏目主副标题。
- 社交链接支持固定平台与自定义链接统一排序，前台展示与后台配置保持一致。
- 生产环境中的 `/admin/` 保持只读，并从 sitemap 中排除。
- 调整发布基线并更新部分依赖到安全版本。
- 首页在 Hero 与导语都关闭时会切换到更紧凑的首屏节奏，减少首屏留白。
- Theme Console 后台样式改为仅在 `/admin/` 页面按需加载，公开页面不再携带后台样式，减少构建产物中的冗余 HTML/CSS 体积。
- 优化公开页样式加载：减少多页面浏览时重复内联样式带来的 HTML 体积开销；正文页与 `/bits/` 改为按页面场景加载样式，更利于缓存复用。
- 调整公开页样式结构：首页、关于页和小记页的样式改为按页维护，共享样式只保留通用部分，fork 后更容易定位和修改。
- 优化首页首屏加载：首页会优先加载首屏所需的样式与字体声明，再加载共享样式，在不改变现有视觉效果的前提下减少等待。
- `/bits/` 页面的“碎碎念”草稿生成器改为按需加载；草稿对话框和相关脚本不再首屏加载，首次点击时才会加载。

### Fixed
- 修复 `/admin/` 首次加载可能报错、开发环境下偶发无法保存配置的问题。
- 修复隐藏侧栏分隔线后页面布局错位的问题，并改进保存失败时的错误提示与接口校验反馈。
- 修复 Theme Console 社交链接在固定平台与自定义链接之间可能出现的排序冲突；后台自动整理排序，并限制可选范围，避免保存重复排序值。
- 修复 Theme Console 自定义社交链接保存时可能静默覆盖已有名称的问题；固定平台会自动沿用平台名，兜底平台统一显示为“网站”。
- 修复 `/archive/` 与 `/essay/` 列表搜索在子路径部署下可能重复拼接 Base URL，导致索引加载失败的问题。
- 修复首页在子路径部署下可能请求错误字体路径的问题；当前首屏字体声明会跟随 `BASE_URL` 输出，避免字体 404、回退或二次切换。
- 修复 `/bits/` 单图卡片无法打开图片预览的问题，单图与多图现在共用同一套 Lightbox 交互。
- 修复 `/bits/` 草稿对话框作者设置区域的可访问性问题，补齐展开状态语义与焦点管理。
- 修复开发环境下 `/archive/{slug}/`、`/essay/{slug}/` 及对应分页页在 Theme Console 使用 `server` 输出模式后可能无法访问的问题。
- 修复正文页图片预览对键盘用户不可用的问题；当前可通过键盘打开 Lightbox，关闭后焦点会返回到原触发位置。
- 修复 Theme Console 默认语言在配置文件被手动写入非法值时仍可能透传的问题；当前会回退到安全默认值，避免输出非法 `<html lang>`。


## [0.1.1] - 2026-02-07
本次更新聚焦搜索、图片预览、bits 多图展示与部署安全基线，进一步完善阅读体验与静态站部署细节。

### Added
- 新增 sitemap 与构建期 `robots.txt`，在设置 `SITE_URL` 时自动启用。
- 新增统一的 Lightbox 预览能力，正文页与 `/bits/` 复用同一套图片预览交互。
- `/archive/` 与 `/essay/` 列表页新增静态搜索，索引按需加载，搜索体验更轻量。
- `/bits/` 新增轻量图片预览与 Markdown 语法演示。
- `/bits/` 支持作者覆盖，并在草稿生成器中补充作者输入。
- 新增 Cloudflare Pages 与 Netlify 的基础部署配置。

### Changed
- Markdown 渲染链路补充安全清洗，在保留现有写作能力的前提下增强 XSS 防护。
- `/bits/` 列表改为按内容长度分流展示：短内容保留原结构渲染，长内容显示摘要。
- `/archive/` 与 `/essay/` 列表页新增搜索框与命中提示。
- `/bits/` 多图展示与交互进一步优化，缩略图、移动端网格与 `+N` 展示更清晰。
- 首页 Hero 图片改用 `astro:assets` 优化，并配合 LCP 控制提升首屏表现。
- 字体改为子集化与自托管，减少首屏字体负担。
- 路由与内容集合进一步收敛：归档入口统一为 `/archive/`，`/essay/` 改为重定向，`/memo/` 替代 `/kids/`。

### Fixed
- 修复 bits 多图 `+N` 点击无响应的问题。
- 修复灯箱遮挡与默认露出问题。
- 修复列表与详情页 slug 过滤不一致可能导致的潜在 404。
- 修复 `robots.txt` 中误导性的 sitemap 注释。

### Maintenance
- 调整部署与安全基线，包括响应头、构建参数与依赖治理。
- 新增 `npm run audit:prod` 并接入 CI。
- 统一部分图标、路径拼接与内容工具实现，减少重复代码。


## [0.1.0] - 2026-01-28 (Pre-release)
本次预发布完成主题的基础能力，包括代码块、Callout、搜索、移动端交互与阅读体验。

### Added
- 新增代码块工具栏，支持语言、行号与复制能力。
- 新增 Callout 写作支持，统一提示块的内容结构与样式。
- 新增 Figure / Caption 支持，完善图文写作场景。
- 新增 `/bits/` 搜索索引与搜索提示。
- 新增客户端交互脚本目录，用于搜索、主题与阅读模式等前端交互。
- 新增移动端 / 平板回到顶部按钮。
- 新增文章详情页上下篇导航。
- 新增本地与 CI 聚合命令。

### Changed
- 重构代码块结构与变量体系，增强行号与复制按钮体验。
- 更新 Markdown 指南与 README，补充 Callout 与 Figure 的使用方式。
- 调整全局排版与样式入口结构，梳理导入顺序。
- `/bits/` 搜索改为 JSON 懒加载，并补充摘要信息。
- 主题、阅读模式与搜索脚本迁移到 TS 模块。
- 优化移动端断点与交互表现，包括导航、列表、图像和工具栏等场景。
- 调整图标使用策略与文档结构。

### Fixed
- 修复暗色模式下纯文本代码块可读性问题。
- 修复代码块语言图标裁切问题。
- 修复阅读模式退出按钮错位问题。
- 修复行内代码换行导致的背景断裂问题。
- 修复小屏长行内容撑宽引发的横向滚动问题。

### Maintenance
- 补充类型检查支持与开发依赖。
- 整理部分样式与脚本入口，为后续迭代收敛结构。


## Pre-release（未发布历史）
以下内容为 `0.1.0` 之前的早期迭代记录，按主题能力做归档整理。

### Added
- 建立 Astro 主题基础骨架，包含固定侧栏与内容区布局。
- 初步建立内容集合：`essay`、`bits`、`memo`。
- 增加基础路由：`/`、`/archive/`、`/essay/`、`/bits/`、`/memo/`、`/about/`。
- 增加 RSS 订阅入口与 `/bits/` 草稿生成能力。
- 增加夜间模式与阅读模式入口。
- 增加最薄的 Callout 组件，实现统一的输出结构。

### Changed
- 逐步收敛 Callout 的结构、图标与样式表现。
- 调整整体配色与引用、代码块等基础排版样式，提升暗色模式适配。
- 统一列表页标题结构，形成主标题加副标题的页面头部样式。
- 优化正文图片展示、TOC 区域间距与侧栏交互细节。
- 调整导航与 hover 反馈，统一整体交互风格。

### Fixed
- 修复早期类型检查、文档路径与引用样式问题。
- 修复深色模式下代码块背景与高亮异常。
- 修复部分未使用样式与细节遗留问题。
