---
title: "Conda基础命令集"
description: ""
badge: "技术分享"
date: 2025-12-08
tags: ["Python"]
archive: true
draft: false
slug: conda-command-cheatsheet
---
# 一、安装

## 1.下载安装包

根据系统版本,下载 [`下载地址`](https://repo.anaconda.com/miniconda/) 

## 2.如果是windows系统配置环境变量

```plain text
D:\Software\miniconda3\Scripts
```

> 注意不是 `D:\Software\miniconda3` 而是子目录 `Scripts` .

# 二、命令大全

## 1. 环境管理

### 1) 查看所有环境

```shell
conda env list
```

**或**

```shell
conda info --envs
```

---

### 2) 创建环境

**指定名称**

```bash
conda create -n myenv python=3.13
```

**指定路径（项目级环境）**

```bash
conda create -p ./env python=3.13
```

---

### 3) 激活环境

**指定名称**

```bash
conda activate myenv
```

**指定路径的：**

```bash
conda activate ./env
```

---

### 4) 退出环境

```bash
conda deactivate

```

---

### 5) 删除环境

**通过名称：**

```shell
conda remove -n myenv --all
```

**通过路径：**

```shell
conda remove -p ./env --all
```

---

### 6) 克隆环境

```shell
conda create --name newenv --clone oldenv
```

---

## 2. 包管理

### 1) 搜索包

```shell
conda search numpy
```

---

### 2) 安装包

```bash
conda install numpy
```

**指定版本：**

```bash
conda install numpy=1.26

```

**从特定 channel 安装：**

```bash
conda install -c conda-forge numpy
```

---

### 3) 更新包

```shell
conda update numpy

```

**更新 conda 所有包：**

```shell
conda update --all
```

---

### 3) 卸载包

```bash
conda remove numpy
```

---

## 3.环境文件（yml）操作

### 1)导出当前环境

```bash
conda env export > environment.yml
```

---

### 2) 用 yml 文件创建环境

```bash
conda env create -f environment.yml
```

---

### 3) 更新环境（同步 yml）

```bash
conda env update -f environment.yml --prune
```

---

## 4.Conda 信息查看

### 1) 查看 Conda 基本信息

```bash
conda info
```

---

### 2) 查看当前环境已安装包

```bash
conda list
```

---

## 5.Conda 通道（Channels）管理

### 1) 查看 channel 列表

```bash
conda config --show channels
```

---

### 2) 添加 channel

```bash
conda config --add channels conda-forge
```

---

### 3) 设置 channel 优先级

```bash
conda config --set channel_priority strict
```

---

## 4) 删除 channel

```bash
conda config --remove channels conda-forge
```

---

## 6.Conda 配置（Config）

### 1) 编辑配置文件（.condarc）

```bash
conda config --edit
```

---

### 2) 设置默认环境路径

**例如将环境路径改到 D 盘：**

```bash
conda config --set envs_dirs D:\conda_envs
```

---

**设置包缓存路径**

```bash
conda config --set pkgs_dirs D:\conda_pkgs
```

---

## 2. 清理 Conda 缓存

### 1) 清理所有包缓存（常用）

```bash
conda clean --all
```

### 2) 清理索引缓存

```bash
conda clean --index-cache
```

### 3) 清理未使用包

```shell
conda clean --packages
```

---

## 8. 其他 Conda 相关命令

### 1) 更新 conda 自身

```bash
conda update conda
```

---

### 2) 更新整个 Miniconda

```shell
conda update --all
```

---

### 3) 禁用 base 环境自动激活

```shell
conda config --set auto_activate_base false
```

---

### 4) 手动激活 base：

```shell
conda activate
```

---
