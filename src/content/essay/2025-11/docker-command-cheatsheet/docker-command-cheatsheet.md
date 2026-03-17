---
title: "Docker基础命令集"
description: "部署docker的时候,一些基本命令合集"
badge: "技术分享"
date: 2025-11-03
tags: ["服务器","工具"]
archive: true
draft: false
slug: docker-command-cheatsheet
---
> 部署docker的时候,一些基本命令合集  
> 例如容器,镜像,日志,Docker Compose等

# 一. 基础命令

```shell
# 查看 Docker 版本
docker version

# 查看 Docker 系统信息
docker info

# 查看帮助文档
docker --help
```

# 二. 容器(container)相关命令

```shell
# 查看所有容器（包括已停止）
docker ps -a

# 强制删除容器
docker rm -f mycontainer

# 进入容器交互式命令行
docker exec -it mycontainer /bin/bash

# 查看容器日志
docker logs -f mycontainer

# 查看容器详细信息
docker inspect mycontainer

# 查看容器资源使用情况（CPU、内存）
docker stats

# 查看正在运行的容器
docker ps

# 启动容器
docker start mycontainer

# 停止容器
docker stop mycontainer

# 重启容器
docker restart mycontainer

# 删除容器
docker rm mycontainer

# 导出容器
docker export -o container.tar mycontainer

# 导入容器为镜像
cat container.tar | docker import - myimage:latest
```

# 三. 镜像(image)管理命令

```shell
# 查看本地镜像
docker images

# 搜索镜像（例如：nginx）
docker search nginx

# 拉取镜像
docker pull nginx:latest

# 删除镜像
docker rmi nginx:latest

# 强制删除镜像
docker rmi -f nginx

# 给镜像打标签
docker tag nginx:latest myrepo/nginx:v1

# 保存镜像为文件
docker save -o nginx.tar nginx:latest

# 从文件导入镜像
docker load -i nginx.tar

# 构建镜像（从 Dockerfile）
docker build -t myapp:v1 .
```

# 四. 网络（Networks）命令

```shell
# 查看所有网络
docker network ls

# 创建网络
docker network create mynet

# 查看网络详情
docker network inspect mynet

# 删除网络
docker network rm mynet

# 将容器连接到网络
docker network connect mynet mycontainer

# 将容器从网络断开
docker network disconnect mynet mycontainer
```

# 五. Docker Compose 常用命令

> 需要 `docker-compose.yml`

```shell
# 启动服务（后台）
docker compose up -d

# 停止服务
docker compose down

# 查看日志
docker compose logs -f

# 查看服务状态
docker compose ps

# 重启指定服务
docker compose restart web

# 构建镜像
docker compose build

```

# 六. 数据卷（Volumes）命令

```shell
# 查看所有数据卷
docker volume ls

# 创建卷
docker volume create myvolume

# 查看卷详情
docker volume inspect myvolume

# 删除卷
docker volume rm myvolume

# 清理未使用的卷
docker volume prune
```

# 七. 容器交互与调试

```shell
# 在容器中执行命令
docker exec mycontainer ls /app

# 附加到容器输出（退出时用 Ctrl + p + q）
docker attach mycontainer

# 查看容器运行的进程
docker top mycontainer

# 拷贝文件：主机 → 容器
docker cp ./test.txt mycontainer:/app/

# 拷贝文件：容器 → 主机
docker cp mycontainer:/app/test.txt ./
```

# 八. 系统清理命令

```shell
# 删除所有停止的容器
docker container prune

# 删除所有未使用的镜像
docker image prune

# 删除所有未使用的网络
docker network prune

# 一键清理所有未使用资源（慎用!!）
docker system prune -a
```

# 九. 常用组合示例

```shell
# 启动一个临时容器测试网络
docker run -it --rm busybox sh

# 启动容器并映射端口
docker run -d -p 8080:80 --name mynginx nginx

# 启动容器并挂载卷
docker run -d -v /data:/usr/share/nginx/html nginx

# 查看端口映射
docker port mynginx
```

# 十. 实用快捷命令

```shell
# 查看 Docker 运行日志
journalctl -u docker.service

# 查看容器 IP 地址
docker inspect -f '{{ .NetworkSettings.IPAddress }}' mycontainer

# 导出所有镜像列表
docker images --format "{{.Repository}}:{{.Tag}}" > images.txt
```
