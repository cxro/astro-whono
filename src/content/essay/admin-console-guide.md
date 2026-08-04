---
title: Admin Console 快速指南
description: 介绍 astro-whono 本地 Admin Console 的入口、各页面功能。
badge: 指南
date: 2026-04-24
tags: [ "Admin Console", "指南" ]
draft: false
---

Admin Console `/admin/`是本地后台入口，用于在 fork、clone 或自托管后接手站点配置与内容维护。

它不是独立 CMS，保存操作会写回仓库里的配置或内容文件，因此适合和 Git 一起使用：改动前后可以看 diff，需要回退时也按普通项目文件处理。

:::note[本地工具]
Admin Console 仅在开发环境提供写入能力。<br>
生产环境最多保留只读的站点概览页面；`/api/admin/*` 只服务本地后台，不作为公开 API。
:::

## 快速入口

本地启动项目：

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:4321/`，如修改过端口，请将 `4321` 换成你的实际端口。

| 入口 | 页面 | 主要用途 |
| :---: | :---: | :--- |
| `/admin/` | Site Overview | 查看站点概况、内容结构、近期文章等 |
| `/admin/theme/` | Theme Console | 编辑站点信息、侧栏、首页、内页文案 |
| `/admin/content/` | Content Console | 文章管理与可视化写作 |
| `/admin/images/` | Images Console | 浏览图片资源，复制可用路径 |
| `/admin/data/` | Data Console | 导入与导出主题设置，便于迁移和备份 |

## 主要页面

### 📈 Site Overview

[Site Overview](/admin/) 是后台首页，可查看站点内容数量、近期更新、后台入口等（入口仅开发环境可见）。

本页面可选对访客开放，受 Theme Console 页面内的 Admin Overview 开关控制。

### 🛠️ Theme Console

Theme Console 管理主题级配置，方便在 fork 或 clone 后快速调整站点基础设置。

具体内容详见 [Theme Console 配置指南](/archive/theme-console-guide/)。

### 📝 Content Console

Content Console 是内容管理与可视化写作入口，可以集中查看和维护站点的写作内容。

具体内容详见 [Content Console 使用指南](/archive/content-console-guide/)。

### 🖼️ Images Console

Images Console 可浏览图片资源、核对图片信息，并复制可用于配置或内容字段的路径。

目前定位接近资源浏览器，暂不支持压缩、删除或替换文件。
需要换图时，先把图片放到项目约定目录，再回到对应页面选择或填写路径。

### 📤 Data Console

Data Console 负责导入或导出主题设置。导出适合做迁移或备份；导入会先走预检，再确认写入。

它处理的是 Theme Console 管理的主题配置数据，不处理文章内容。

---
这些就是目前 Admin Console 的主要入口和功能。如果你有更多想法或建议，欢迎提交 Issue。
