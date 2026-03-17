---
title: "Linux基本命令集"
description: "收录一些常常用到的Linux命令集"
badge: "技术分享"
date: 2025-11-03
tags: ["服务器","工具"]
archive: true
draft: false
slug: linux-command-cheatsheet
---
> 使用Linux时候,经常用到的一些Linux命令集合
例如: 文件,防火墙,端口占用等

# 一. 防火墙

## 1. 服务状态基本命令

```shell
# 启动 firewalld
sudo systemctl start firewalld

# 停止 firewalld
sudo systemctl stop firewalld

# 设置开机自启
sudo systemctl enable firewalld

# 查看 firewalld 状态
sudo systemctl status firewalld

# 重启 firewalld
sudo systemctl restart firewalld
```

## 2. 查看防火墙状态与规则

```shell
# 查看当前运行区域
sudo firewall-cmd --get-active-zones

# 查看指定区域的配置（如 public）
sudo firewall-cmd --zone=public --list-all

# 查看所有开放的端口
sudo firewall-cmd --list-ports
```

## 3. 允许/禁止某个服务

```shell
# 查看可用服务列表
sudo firewall-cmd --get-services

# 开放 http 服务
sudo firewall-cmd --add-service=http --permanent

# 移除 http 服务
sudo firewall-cmd --remove-service=http --permanent
```

## 4. 开放 / 关闭 某个端口

### 开放端口

```shell
# 开放8080端口
sudo firewall-cmd --zone=public --add-port=8080/tcp --permanent

# 使配置生效
sudo firewall-cmd --reload
```

### 查询是否已经开放

```shell
sudo firewall-cmd --zone=public --list-ports
```

### 关闭端口

```shell
# 关闭8080端口
sudo firewall-cmd --zone=public --remove-port=8080/tcp --permanent

# 使配置生效
sudo firewall-cmd --reload
```

## 5. 其他常用命令

```shell
# 查看默认区域
sudo firewall-cmd --get-default-zone

# 设置默认区域
sudo firewall-cmd --set-default-zone=public
```

# 二. 端口占用

## 1. 查询端口占用情况

```shell
ss -tulnp | grep 8080
```

## 2. 杀死进程

```shell
kill -9 PID
```
