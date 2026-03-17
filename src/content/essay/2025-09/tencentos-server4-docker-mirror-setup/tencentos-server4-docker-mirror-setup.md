---
title: "TencentOS Server4配置docker镜像加速源"
description: "轻量应用服务器 安装 Docker 并配置镜像加速源_腾讯云"
badge: "开发随笔"
date: 2025-09-25
tags: ["建站"]
archive: true
draft: false
slug: tencentos-server4-docker-mirror-setup
---
> TencentOS Server 4 for x86_64系统的docker需要下载docker镜像,有些镜像下载缓慢,可以尝试配置腾讯云提供的镜像源进行下载

# 一.新增配置文件

```shell
# 新增目录
mkdir /etc/docker

# 创建配置文件
vim /etc/docker/daemon.json
```

> 配置文件内容

```json
{
    "registry-mirrors": [
        "https://mirror.ccs.tencentyun.com"
    ]
}
```

# 二. 重启docker

```shell
sudo systemctl restart docker
```

# 三. 验证镜像源配置是否成功

```shell
sudo docker info
```

> 打印这个配置即为成功

![image-10](./assets/image-10.png)
