# Apple Container 1.0.0 调研

> 一句话：在 macOS 上跑 Linux 容器的 Apple 官方工具，每个容器跑在一个独立轻量 VM 里。
> 1.0.0 = CLI / XPC / Swift 框架 API 稳定承诺，等同于"可以正式评估替代 Docker Desktop"。

## 基本信息

| 项 | 值 |
|---|---|
| CLI 仓库 | github.com/apple/container |
| 底层框架 | github.com/apple/containerization（Swift Package） |
| 最新版本 | **1.0.0**（2026-06-09，开源一周年） |
| 协议 | Apache 2.0 |
| 主语言 | Swift |
| 平台要求 | macOS 15+，Apple Silicon |
| 1.0.0 新能力（subnet / vnet 改进） | 需 macOS 26 Tahoe（**待核实**） |

## 作用 / 定位

在 macOS 上创建和运行 Linux 容器，对标 Docker Desktop 在 macOS 上的位置。
最大差异：走「每容器一个轻量 VM」路线，而非 Docker Desktop 的「共享 Linux VM」路线。

## 核心设计

- **VM-per-container**：每个容器 = 一个独立轻量 VM，基于 macOS Virtualization.framework
- **OCI 兼容**：pull / build / run / tag / push 完整支持，可直接拉 Docker Hub 镜像
- **Swift 原生 + 可嵌入**：CLI、XPC API、Swift Package 三层 API，macOS App 可直接调用
- **第一方维护**：Apple 官方长期支持，不存在 Docker Desktop 那种商用授权问题
- **仅 Linux**：Virtualization.framework 直接 boot Linux kernel + initrd，**不能跑 macOS / BSD 等**

## 优点

- 隔离性强：每个容器独立内核，安全性显著优于共享内核方案
- 原生 Apple Silicon 性能：arm64 镜像下 CPU / 内存与 OrbStack 持平，略胜 Docker Desktop
- 闲置资源占用低
- 可嵌入：Swift Package 形式的 API，IDE / AI Agent / 本地 dev 工具可直接集成
- 升级体验好：`.pkg` 安装包内置旧版卸载逻辑
- 免费 + 商用无忧：Apache 2.0，无授权风险

## 局限 / 适用边界

- 仅 Apple Silicon，Intel Mac 不支持
- 无 Docker Compose 那种原生编排，多容器需要自己启停
- amd64 镜像支持有限，主要面向 arm64
- 1.0.0 刚发有边缘路径问题（如 `brew install container` 后 apiserver 启动失败，官方推荐走 .pkg）

## 与其他方案对比

| 维度 | Apple Container | Docker Desktop | OrbStack |
|---|---|---|---|
| 隔离模型 | 每容器独立 VM | 共享 Linux VM | 共享 Linux VM |
| arm64 性能 | 优 | 中 | 优 |
| 闲置资源占用 | 低 | 高 | 低 |
| 完整 Linux 发行版 | 支持（`container machine`） | 不支持 | 支持 |
| 编排（Compose） | 无 | 有 | 有 |
| 商用授权 | 免费 | 公司商用需付费 | 个人/商用付费 |
| 第一方维护 | ✅ Apple | Docker Inc | OrbStack |

## 持久化 Linux VM（`container machine`）

普通 `container run` 跑的是"一个应用"——VM 跟进程绑，stop 之后 VM 销毁、文件系统回到镜像初始状态（装的包、写的文件、用户配置全部丢失）。

`container machine` 跑的是"一个 Linux 环境"——长期存活的 VM，自带 init，文件系统改动持久化，跨 stop / start / Mac 重启都保留。

> Apple 官方原话：
> "Containers are modeled after an **application** — tied to the process's lifecycle.
> A container machine is modeled after a **Linux environment** — runs the image's own init, persists filesystem changes, and is built from standard OCI images."

### 四个设计原则（WWDC26 官方）

1. Fast and lightweight
2. Simple to create and operate
3. Persistent across sessions
4. Seamless extension of macOS

### 关键能力

- **OCI 镜像作为根文件系统**：默认是 Apple 专门定制的迷你 Linux rootfs（不是某个完整发行版），可用 `--image ubuntu:24.04` 等指定其他镜像
- **跨会话持久化**：machine 内 `apt install`、写文件、改配置全部保留
- **自动镜像 macOS 用户**：UID / GID、`$HOME`、SSH key 自动同步
- **跑镜像自己的 init**：不是单进程，而是完整 Linux 系统
- **基于底层 `Containerization` 框架**：复用已有 VM-per-container 基础设施
- **底层 kernel 是 Apple 为 Apple Silicon 优化过的 Linux kernel**（不是上游 vanilla kernel）

### 常用命令

```bash
container machine init
container machine init --image openeuler/openeuler:latest
container machine list
container machine start [name]
container machine stop [name]
container machine rm [name]
container machine exec [name] -- uname -a
```

### 什么时候用哪个

- **`container run`**：跑一次性任务、CI 步骤、临时试验，每次都从干净镜像起
- **`container machine`**：长期 dev 环境、需要装包 / 改配置 / 跑多个服务的 Linux 工具链

## 使用方式

### 安装
1. macOS 15+，Apple Silicon
2. https://github.com/apple/container/releases 下载 1.0.0 `.pkg`
3. 双击安装（会自动处理旧版卸载）

### 验证
```bash
container --version       # 期望 1.0.0
container system status   # 确认 runtime 就绪
```

### 常用命令
```bash
# 镜像
container images pull nginx:latest
container images ls

# 运行
container run -it --rm nginx:latest /bin/sh
container run -d --name web -p 8080:80 nginx:latest

# 运维
container ls -a
container exec -it <id> /bin/bash
container stop <id>
container rm <id>

# 构建
container build -t my-app:latest .
container inspect my-app
```

## 适用场景

- macOS 后端 / 云原生开发：评估替代 Docker Desktop
- IDE / AI Agent / 本地 dev 工具：通过 Swift API 内嵌容器能力
- 关注 macOS 平台演进：未来与 Sandbox 体系深度整合

## 参考

- 仓库：https://github.com/apple/container
- 底层框架：https://github.com/apple/containerization
- 1.0.0 讨论：https://github.com/apple/container/discussions/1667
- 已知问题：https://github.com/apple/container/issues/1670
- WWDC25 视频（Containerization 框架）：https://developer.apple.com/videos/play/wwdc2025/346
- WWDC26 视频（container machines）：https://developer.apple.com/videos/play/wwdc2026/389
- 性能对比：https://www.repoflow.io/blog/apple-containers-vs-docker-desktop-vs-orbstack

## 待确认

- [ ] 1.0.0 是否仍要求 macOS 26 Tahoe 才能装基础功能？基础功能回退到 15+ 也能装吗？
- [ ] `brew install` 路径下 apiserver 启动失败的问题是否已修？
- [ ] `container machine` 的持久化数据在 macOS 上的具体存储路径（`~/Library/Application Support/container/`？需装上后核实）
