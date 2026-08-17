> 本页是当前可执行的短指南；完整中文译文已归档到 [官方文档译文.md](./Nvidia-MPS使用指南/官方文档译文.md)。译文来自旧版 NVIDIA 文档，版本与限制可能落后；远程图片可能失效，操作前以后面的 NVIDIA 官方最新正文为准。

## 适用范围

NVIDIA Multi-Process Service（MPS）是 Linux/QNX 上、与 CUDA API 二进制兼容的协作式多进程运行时。它让多个 CUDA 进程通过 MPS server 共享 GPU，适合每个进程单独运行无法充分占满 GPU、且进程属于同一协作任务的场景；它不是通用的多租户隔离方案。

官方入口：

- [MPS 文档（最新）](https://docs.nvidia.com/deploy/mps/latest/index.html)
- [Quick Start](https://docs.nvidia.com/deploy/mps/latest/quick-start.html)
- [When to Use MPS](https://docs.nvidia.com/deploy/mps/latest/when-to-use-mps.html)

## 最小启动、验证与停止

在同一用户下执行：

```bash
# 启动控制守护进程（它负责管理 MPS server）
nvidia-cuda-mps-control -d

# 查看 server / client 状态（二选一）
echo ps | nvidia-cuda-mps-control
nvidia-smi

# 停止控制守护进程及其管理的 server
echo quit | nvidia-cuda-mps-control
```

如果显式设置管道目录，启动 controller、MPS client 必须使用同一个 `CUDA_MPS_PIPE_DIRECTORY`；日志目录也应按用户权限单独配置。先确认 GPU 驱动、CUDA 工具链和目标程序都能在不启用 MPS 时正常运行，再做 MPS A/B 测量。

## 使用前检查

- MPS 主要用于同一协作任务的多个进程；监控工具通常把客户端负载归到 MPS server。
- 客户端与 server 默认必须使用同一 UID；多用户模式会降低隔离，只有在明确需要时才评估。
- 仅支持 64 位 CUDA 应用；CUDA Unified Virtual Addressing（UVA）必须可用。
- Dynamic parallelism 当前不支持；旧架构/旧 CUDA 客户端还可能受 stream callback、CUDA Graph host node、`/dev/shm` 锁页内存等限制影响。
- MPS 不是错误隔离边界：异常退出、越界访问或不兼容的客户端可能影响同一 server 下的其他进程。先用短任务验证错误行为，再扩大规模。
- 仅启用 MPS 不保证加速；比较单进程、普通多进程与 MPS 的 GPU 利用率、端到端延迟、吞吐和显存，确认额外并发确实填补了空闲容量。

## 排障顺序

1. 记录 `nvidia-smi`、CUDA 版本、UID、`CUDA_MPS_PIPE_DIRECTORY` 和日志目录。
2. 停止残留 controller/server 后，用最小 CUDA 程序重试。
3. 确认 controller 与 client 的管道目录一致、目录可读写，且没有跨 UID 连接。
4. 用 `echo ps | nvidia-cuda-mps-control` 检查客户端是否已注册；结束时使用 `echo quit | nvidia-cuda-mps-control`，不要只杀 client 进程。
