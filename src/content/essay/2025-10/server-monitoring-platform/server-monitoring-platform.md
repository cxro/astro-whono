---
title: "服务器监控平台"
description: ""
badge: "技术分享"
date: 2025-10-21
tags: ["建站","服务器","工具"]
archive: true
draft: false
slug: server-monitoring-platform
---
> Docker部署Grafana，Loki，Prometheus，promtail，node-exporter

# 一、方案概览

这套方案的职责可以简单理解为：

- `node-exporter` 负责采集主机指标
- `Prometheus` 负责抓取和存储指标
- `Promtail` 负责采集日志
- `Loki` 负责存储和查询日志
- `Grafana` 负责把指标和日志统一可视化

这样就能同时覆盖服务器资源监控、应用指标监控和日志查询。

## 1. Grafana

Grafana 是一个开源的可视化与监控平台，用于收集、分析和展示各种来源的数据。简单来说，它就是一个“数据仪表盘”工具，但功能非常强大，尤其适合监控系统、应用性能和日志分析。

### 核心功能

#### 1) 数据可视化

- 支持多种图表：折线图、柱状图、饼图、热力图、表格等。
- 可以把多个图表组合成一个仪表盘（Dashboard），形成可视化报告。

#### 2) 数据源连接

- Grafana 本身不存储数据，而是连接各种数据源：
  - **时序数据库**：Prometheus、InfluxDB、Graphite 等
  - **日志数据库**：Loki、Elasticsearch 等
  - **关系型数据库**：MySQL、PostgreSQL 等
  - **云服务**：AWS CloudWatch、Google Cloud Monitoring 等

#### 3) 告警与通知

- 可以设置阈值告警，当数据异常时触发通知。
- 通知方式丰富：邮件、Slack、钉钉、Webhook 等。

#### 4) 插件扩展

- 丰富的社区插件：新图表类型、数据源插件、面板插件等。
- 可以自定义仪表盘主题和功能。

### 典型使用场景

- **系统监控**：CPU、内存、磁盘、网络流量等指标可视化。
- **应用性能监控**：监控接口延迟、请求数量、错误率。
- **日志分析**：结合 Loki 或 Elasticsearch，查询并可视化日志数据。
- **业务指标监控**：例如用户增长、销售数据、订单量等。

### 优点

- 开源且免费，社区活跃。
- 支持多数据源和跨数据源的联合查询。
- 可生成实时更新的仪表盘，直观展示数据变化。
- 易于设置告警并与各种通知系统集成。

## 2. Loki

Loki 是日志存储和查询组件，定位上更接近“轻量日志系统”，专门和 Grafana 生态配合使用。

### 核心概念

#### 1) 轻量化

- Loki 不像 Elasticsearch 那样对日志内容做全文索引。
- 它只对日志的 **标签（labels）** 做索引，比如 `job="app"`、`level="error"`。
- 这样可以显著减少存储空间和计算开销。

#### 2) 与 Prometheus 类似的标签机制

- 日志被打上标签（labels），然后可以通过 Grafana 查询这些标签。
- 例如：`{job="backend", level="error"}` 查询所有后端服务的错误日志。

#### 3) 模块组成

- **Promtail**：日志采集工具，类似于 Prometheus 的 Exporter。
  - 它会从文件、容器或系统日志中收集日志，打上标签，然后发送给 Loki。
- **Loki Server**：日志存储和索引服务。
- **Grafana**：日志可视化和查询。

### 特点

- **节省存储**：只索引标签，不做全文索引。
- **可扩展性强**：支持水平扩展，适合大规模日志收集。
- **与 Prometheus 兼容**：设计理念类似，查询语言使用 LogQL。
- **轻松整合 Grafana**：直接在 Grafana 上可视化日志，支持告警。

### 典型使用场景

- 集中管理和查询容器化应用日志（Docker、Kubernetes）。
- 系统日志监控，如 Linux 系统日志、应用日志。
- 结合 Grafana 告警，当出现错误日志自动推送通知。

## 3. Prometheus

Prometheus 是一个开源的**监控与告警系统**，它的核心是**时序数据库**，专门用来收集、存储和分析指标数据（Metrics），而不是日志。它在云原生、微服务和容器化环境中非常流行，尤其常和 Grafana 配合使用。

### 核心概念

#### 1) Metrics（指标）

- Prometheus 收集的都是**数值类型数据**，通常带有时间戳。
- 常见指标类型：
  - **Counter**（计数器）：单调递增，例如请求总数。
  - **Gauge**（仪表盘）：可增可减，例如 CPU 利用率、内存占用。
  - **Histogram / Summary**（直方图/摘要）：统计分布，例如响应时间分布。

#### 2) Pull 模式

- Prometheus 主要通过 HTTP 抓取（pull）各服务暴露的 `/metrics` 接口的数据，而不是被动接收。
- 也可以通过 **Pushgateway** 支持短周期作业的数据推送。

#### 3) PromQL 查询语言

- 类似 SQL，但专门用于时序数据查询和计算。
- 可用于 Grafana 中绘制图表、计算比率、告警条件等。

### 架构组成

- **Prometheus Server**：核心组件，抓取指标、存储数据、执行查询和告警规则。
- **Exporter**：服务端点暴露 metrics 的工具，例如：
  - **Node Exporter**：系统级指标（CPU、内存、磁盘）
  - **MySQL Exporter**：数据库指标
- **Alertmanager**：处理告警，将告警发送到邮件、Slack、钉钉等。
- **Grafana**：可视化展示 Prometheus 收集的指标。

### 特点

- **高效时序数据库**：专为指标存储优化。
- **灵活查询与计算**：PromQL 支持聚合、比率计算、时间区间分析。
- **开箱即用**：适合容器、微服务和云原生架构。
- **告警能力强**：可以基于指标定义复杂的告警规则。

### 典型使用场景

- 系统监控：CPU、内存、磁盘、网络流量。
- 应用性能监控：请求速率、错误率、响应时间。
- 业务指标监控：交易量、用户活跃数、订单数等。

> 如果你把 **Prometheus** 当做指标监控系统，**Loki** 当做日志系统，**Grafana** 当做可视化和告警中心，就能组成一套比较完整的监控体系。

## 4. Promtail

Promtail 是 **Loki 的日志采集器**，它的作用是把日志收集、打标签，然后发送给 Loki。可以把它理解成 Loki 的“前置收集工具”，类似于 Prometheus 的 Exporter。

### 核心作用

#### 1) 收集日志

- Promtail 可以从：
  - **文件系统**（如 `/var/log/*.log`）
  - **Docker / Kubernetes 容器日志**
  - **系统日志**
- 收集日志内容。

#### 2) 打标签（Labels）

- 将每条日志加上标签，方便在 Loki 或 Grafana 中查询。
- 例如：

```plain text
job:backend
level:error
filename:app.log
```

#### 3) 发送给 Loki

- Promtail 会把带标签的日志推送到 Loki 存储系统中。
- Loki 再进行索引（只索引标签，不全文索引）以便查询。

### 特点

- **轻量化**：只收集和转发日志，不存储日志。
- **与 Loki 配合紧密**：专门为 Loki 打造。
- **支持多种日志源**：包括文件、容器、系统日志等。
- **可配置性强**：可以按路径、日志内容、正则等进行标签打标和过滤。

### 工作流程

1. Promtail 读取日志文件或容器日志。
2. 给每条日志打上标签。
3. 将日志推送到 Loki。
4. 在 Grafana 中用 LogQL 查询和可视化这些日志。

> **Prometheus + Exporter** 负责收集指标，**Promtail + Loki** 负责收集日志，Grafana 统一展示两类数据。

## 5. node-exporter

`Node Exporter` 是 **Prometheus 官方提供的一个 Exporter**，它的作用是收集 **主机级系统指标**，然后提供给 Prometheus 拉取。简单说，它就是 Prometheus 用来监控服务器的“探针”。

### 核心作用

- 收集服务器操作系统的硬件和系统指标，包括：
  - CPU 使用率
  - 内存使用情况
  - 磁盘空间和 I/O
  - 网络流量
  - 文件系统信息
  - 负载平均值
- 将这些指标暴露在一个 HTTP 接口（通常是 `http://<host>:9100/metrics`），Prometheus 会定期抓取。

### 特点

- **轻量化**：只负责采集指标，不存储数据。
- **开箱即用**：无需复杂配置，启动后就可以被 Prometheus 抓取。
- **指标丰富**：支持 Linux、Windows 等多平台。
- **可扩展**：可以加自定义指标采集脚本或 exporter。

### 工作流程

1. **Node Exporter** 在主机上运行，收集本机系统指标。
2. **Prometheus** 定期访问 Node Exporter 提供的 `/metrics` 接口抓取指标。
3. **Grafana** 使用 Prometheus 的指标来可视化，例如 CPU 利用率曲线、内存使用情况等。

### 典型应用场景

- 服务器性能监控
- 容器宿主机资源监控
- 数据中心硬件资源统计
- 与应用指标结合，形成完整的监控体系

# 二、Docker部署

---

## 部署文件夹路径

```plain text
.
├── docker-compose.yml
├── grafana
│   └── data
├── loki
│   ├── config.yaml
│   └── data
├── prometheus
│   ├── data
│   └── prometheus.yml
└── promtail
    ├── config.yaml
    ├── log
    └── positions

```

## docker-compose.yml

```yaml
services:
  prometheus:
    image: a3bc50fcb50f  #prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus/data:/prometheus:Z               # 映射宿主机目录保存数据
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - /etc/localtime:/etc/localtime:ro       # 同步宿主机时间
      - /etc/timezone:/etc/timezone:ro         # 同步时区
    ports:
      - "9090:9090"
    environment:
      - TZ=Asia/Shanghai
#    network_mode: "host"
    networks:
      monitor:
        ipv4_address: 172.19.0.50
    restart: unless-stopped

  grafana:
    image: 0a7de979b313   #grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - TZ=Asia/Shanghai
    volumes:
      - ./grafana/data:/var/lib/grafana:Z            # 映射宿主机目录保存数据
      - /etc/localtime:/etc/localtime:ro       # 同步宿主机时间
      - /etc/timezone:/etc/timezone:ro         # 同步时区
    ports:
      - "3000:3000"
#    network_mode: "host"
    networks:
      monitor:
        ipv4_address: 172.19.0.40
    depends_on:
      - prometheus
      - loki   # Grafana 依赖 Loki，确保启动顺序
    restart: unless-stopped

  node-exporter:
    image: 255ec253085f   #prom/node-exporter:latest
    container_name: node-exporter
#    network_mode: "host"  # 让 node-exporter 能访问宿主机指标
    networks:
      monitor:
        ipv4_address: 172.19.0.30
    pid: "host"           # 让 node-exporter 获取宿主机进程信息
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.ignored-mount-points=^/(sys|proc|dev|host|etc)($|/)'

  loki:
    image: 7ab1582665de   #grafana/loki:latest
    container_name: loki
    volumes:
      - ./loki/config.yaml:/etc/loki/config.yaml
      - ./loki/data:/loki:Z
    command: -config.file=/etc/loki/config.yaml
    ports:
      - "3100:3100"
#    network_mode: "host"
    networks:
      monitor:
        ipv4_address: 172.19.0.20
    restart: unless-stopped

  promtail:
    image: cef821797911  #grafana/promtail:latest
    container_name: promtail
    volumes:
#      - ./promtail/log:/var/log:Z              # 采集宿主机日志
      - ./promtail/config.yaml:/etc/promtail/config.yaml
      - ./promtail/positions:/tmp/positions:Z
      - /opt/deploy/xiaozhi-backend-web/log:/opt/deploy/xiaozhi-backend-web/log:Z
    command: -config.file=/etc/promtail/config.yaml
#    network_mode: "host"
    networks:
      monitor:
        ipv4_address: 172.19.0.10
    restart: unless-stopped

networks:
  monitor:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: 172.19.0.0/16
          gateway: 172.19.0.1
```

# 三、配置文件

## 1. Loki 配置

文件路径：`.loki/config.yaml`

```yaml
# Loki 总体配置
auth_enabled: false   # 是否开启认证，默认关闭（生产环境建议结合反向代理+认证）

server:
  http_listen_port: 3100   # Loki HTTP API 监听端口（Grafana/Promtail 会通过这个端口访问）

ingester:   # 负责接收日志流并存储为 chunk
  wal:
    enabled: true
    dir: /loki/wal    # 指定 WAL 存放目录
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory       # 使用内存存储集群节点信息（单机模式）
      replication_factor: 1   # 日志副本数（单机模式 1 即可，多节点建议 >=3）
    final_sleep: 0s           # 停止时等待时间
  chunk_idle_period: 5m       # 如果 5 分钟没有新日志写入，关闭当前 chunk
  chunk_retain_period: 30s    # 在 chunk 关闭后，仍然保留 30s（避免频繁写入）

schema_config:
  configs:
    - from: 2025-09-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:
  tsdb_shipper:
    active_index_directory: /loki/tsdb-index
    cache_location: /loki/tsdb-cache
  filesystem:
    directory: /loki/chunks

limits_config:
  ingestion_rate_mb: 4
  ingestion_burst_size_mb: 6
  max_streams_per_user: 0
  retention_period: 168h

compactor:
  working_directory: /loki/compactor

table_manager:
  retention_deletes_enabled: true
  retention_period: 168h
```

## 2. Prometheus 配置

文件路径：`.prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['172.19.0.30:9100']

  - job_name: 'xiaozhi-backstage-web'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['172.19.0.1:9001']
```

## 3. Promtail 配置

文件路径：`.promtail/config.yaml`

```yaml
# Promtail 主服务配置
server:
  http_listen_port: 9080
  grpc_listen_port: 0

# Promtail 用来记录日志收集的进度（避免重启后重复采集）
positions:
  filename: /tmp/positions/positions.yaml

# Loki 客户端配置，指定日志推送的目标地址
clients:
  - url: http://127.0.0.1:3100/loki/api/v1/push

# 日志采集配置
scrape_configs:
  - job_name: xiaozhi-backend-web-job
    static_configs:
      - targets:
          - localhost
        labels:
          job: xiaozhi-backend-web
          host: '四维Ai服务器（正式）'
          __path__: /opt/deploy/xiaozhi-backend-web/log/*.log
    pipeline_stages:
      - multiline:
          firstline: '^\d{4}-\d{2}-\d{2}.*(INFO|ERROR|WARN|DEBUG).*'
          max_wait_time: 3s
      - regex:
          expression: '^(?P<time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+)\s+(?P<level>[A-Z]+)\s+(?P<msg>.*)$'
      - labels:
          level:
```
