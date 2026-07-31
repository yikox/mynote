# 第三章：DeepSeek-V4-Flash 原生混合精度三级存储部署

> 状态：阶段 1.5 原型门禁已通过，但还不是完整可用服务。WSL 上限 30GB、Swap 0、服务 cgroup 24GB 已验收；固定 `v0.6.3` 源码已用 CUDA/SM89 + AVX2 编译；MXFP4 mmap/UE8M0 原型与默认路径均通过合成权重数值回归。官方权重尚未下载；完整 SGLang V4 环境门禁未通过。

## 2026-08-01 SSH 构建与验收结果

本次只在远端构建和测试，不下载约 148.67GiB 官方权重。

远端目录：`/home/yiko/workspace/deepseek-v4-flash-serve/`

固定源码与构建方式：

- `ktransformers v0.6.3` 源码归档 SHA256：`dd0c9e382c5d9f02ba0b01a991395de06703af066006214b15d930a3715666ef`。
- 编译脚本：`scripts/bootstrap_mmap_kernel.sh`；使用项目私有 sysroot，补齐 `pkgconf`、HWLOC、NUMA、Python 3.12 headers，不改系统包。
- 编译选项：`CPUINFER_CPU_INSTRUCT=AVX2`、关闭 AMX/AVX-512、`CPUINFER_USE_CUDA=1`、`CPUINFER_CUDA_ARCHS=89`、CUDA Toolkit 12.6。
- 产物：`kt_kernel_ext.cpython-312-x86_64-linux-gnu.so`，CPU 变体为 AVX2；链接最终使用 NUMA 共享库。

原型开关和验收命令：

```bash
ROOT=/home/yiko/workspace/deepseek-v4-flash-serve
PY=/home/yiko/workspace/qwen35-agent-serve/.venv/bin/python
cd "$ROOT"
export KT_MXFP4_MMAP=1
export KT_MXFP4_BACKEND=avx2
export KT_KERNEL_CPU_VARIANT=avx2
bash scripts/run_under_24g.sh env \
  LD_LIBRARY_PATH="$ROOT/.deps/sysroot/usr/lib/x86_64-linux-gnu:/usr/local/cuda-12.6/lib64" \
  PYTHONPATH="$ROOT/run/python" \
  "$PY" "$ROOT/scripts/validate_mxfp4_mmap.py"
```

`run_under_24g.sh` 内部使用 `MemoryHigh=22G`、`MemoryMax=24G`、`MemorySwapMax=0`、`OOMPolicy=stop`。在 transient unit 内实读到 `memory.max=25769803776`、`memory.high=23622320128`、`memory.swap.max=0`。4 专家合成 Safetensors 结果：`qlen=1` 相对误差 `0.004596`，`qlen=4` 相对误差 `0.002769`，输出 `MXFP4_MMAP_VALIDATION=PASS`，CPU 变体 AVX2，RSS 增量约 `117.5MiB`，Swap 峰值 `0B`。

随后将 `KT_MXFP4_MMAP=0` 做默认路径回归，误差同样为 `0.004596/0.002769` 并通过。说明补丁是 opt-in，当前默认 MXFP4 行为未被破坏；这不是全模型吞吐或服务可用性证明。

本轮没有实现用户态 LRU、连续 expert pack、GPU 专家迁移或 SGLang API；第一版只验证“官方 Safetensors 只读映射 + raw UE8M0 scale 即时解码 + cgroup 文件页缓存上限”这条最小路径。

## 本章目标

在现有单机上探索 DeepSeek-V4-Flash 官方原生混合精度权重的极限部署：

```text
官方 DeepSeek-V4-Flash（159,630,045,338 bytes，约 148.67GiB）
├── 路由专家：MXFP4
├── 其余大部分权重：FP8
├── NVMe：完整冷权重
├── 系统内存：次高频专家缓存
└── 显存：公共权重、KV Cache 与高频专家
```

最终提供单并发、OpenAI-compatible 的实验服务，供编码 Agent 做正确性、专家局部性和性能测试。

这不是生产目标。当前机器首先回答三个问题：

1. 官方 FP4+FP8 权重能否在 32GB 内存机器上正确完成一次请求。
2. 编码 Agent 请求的专家访问是否足够集中，能否把 SSD 冷读取压到可接受范围。
3. 在不二次量化权重的条件下，Decode 能否稳定达到至少 2 token/s。

## 明确边界

本章坚持：

- 使用 DeepSeek 官方原生 FP4+FP8 checkpoint，不转换成 IQ2、Q2 或其他低比特 GGUF。
- 允许无损重排权重布局，但不改变权重数值和量化 scale。
- WSL2 最大内存设置为 30GB。
- 推理服务使用 cgroup 硬限制 24GB，不把 30GB 全部交给模型。
- 服务禁用 Swap，防止模型的显式 NVMe 冷层与系统换页互相争抢。
- 单并发，先验证 1K/4K，再递增到 16K、32K；128K 只在前面全部通过后测试。
- 保留第一、二章的 Qwen 模型与目录，不覆盖、不删除。

本章不承诺：

- 日常可交互的编码 Agent 速度。
- 128K 输入和 16K 输出能在合理时间内完成。
- 不修改推理引擎即可直接运行。32GB 内存下需要新增 SSD 专家存储层。

## 已确认的机器规格

| 项目 | 实测状态 |
| --- | --- |
| CPU | Intel Core i5-13600KF，20 逻辑处理器 |
| CPU 指令集 | AVX2、AVX-VNNI 可用；AVX-512 不可用 |
| Windows 内存 | 32GB，2×16GB DDR5-6400 |
| WSL 当前内存 | `MemTotal: 30800524 kB`，约 29.4GiB 可见 |
| WSL 上限 | 30GB，已生效 |
| WSL Swap | 0，已生效 |
| 服务内存硬限制 | 24GB |
| GPU | NVIDIA RTX 4070 Ti SUPER，16376MiB |
| GPU 架构 | Ada，Compute Capability 8.9 |
| 驱动 | Windows 560.94 |
| 驱动报告 CUDA | 12.6 |
| CUDA Toolkit | 12.6，`nvcc 12.6.20` |
| 已验证 PyTorch | 2.10.0+cu128，CUDA 可用 |
| 已验证 KT-Kernel | 0.6.3.post1，自动选择 AVX2 |
| 主板 | MSI MAG B760M MORTAR WIFI II |
| SSD | ZHITAI TiPlus7100 1TB NVMe，健康 |
| WSL 文件系统可用空间 | 约 780GB |
| 已测顺序直接读取 | 约 3.7GB/s |

机器平台未来可扩容，但本章只使用当前 32GB 内存，不把硬件升级计入方案。

## 为什么 WSL 30GB、服务只用 24GB

`memory=30GB` 是 WSL VM 的上限，不会在启动时立即预留。但 Windows 在空闲状态仍使用约 10GB；如果模型真实占满 30GB，宿主会进入页面文件，页面文件又位于同一块 SSD，最终与模型权重读取竞争。

因此采用两层限制：

```text
物理内存 32GB
├── WSL VM 上限 30GB：只提供极限空间
├── V4 服务 MemoryMax 24GB：实际硬边界
└── Windows、WSL 内核及其他进程：使用剩余空间
```

不能使用 `ulimit -v 24G`：原生模型会 mmap 约 148.67GiB 文件，虚拟地址空间远大于实际驻留内存。正确限制方式是 cgroup v2 / systemd：

```ini
MemoryHigh=22G
MemoryMax=24G
MemorySwapMax=0
OOMPolicy=stop
```

`MemoryHigh` 提前触发回收；`MemoryMax` 是最终硬边界；`MemorySwapMax=0` 防止服务进入 Swap。

## 运行时选择

基线使用 KTransformers + 其维护的 SGLang 路线：

- 已支持 DeepSeek-V4-Flash 原生 MXFP4 专家权重。
- 已提供按频率放置 GPU 专家、动态专家更新和逐 token 专家统计。
- SGLang 能继续提供 OpenAI-compatible API。
- 只新增缺失的 NVMe 专家层，不重新实现完整模型与服务协议。

官方 V4 教程对完整 SGLang 路线要求 CUDA 12.8+、FlashInfer 0.6.9+。但 `kt-kernel 0.6.3.post1` 的预编译 wheel 自带静态 CUDA runtime；本机现有 `torch 2.10.0+cu128` 已能在驱动 560.94 上识别 RTX 4070 Ti SUPER，并成功同时加载 AVX2 原生扩展、执行轻量 CUDA 计算。因此暂不升级驱动或 Toolkit；完整 SGLang、FlashInfer 和 TileLang 仍需单独验收，不能把 Kernel 导入成功等同于服务可启动。

### 原版运行时为何无法落在 24GB

已安装的 0.6.3 Python wrapper 与官方当前 AVX2 MXFP4 C++ 源码共同表明，现有路径不是 SSD 按需执行：

1. Python 用 safetensors mmap 暂时拿到每个专家的指针。
2. C++ 为每个专家分配 owned buffer。
3. `load_weights()` 将所有 MXFP4 权重从 mmap `memcpy` 到 owned buffer。
4. 原始 UE8M0/BF16 scale 在 AVX2 BufferB 中扩成 FP32。
5. Python 随后释放 mmap 句柄。

官方源码注释明确说明，旧实现曾直接指向 mmap，但 mmap 释放后发生 use-after-free，所以新实现改成完整复制。按当前结构粗算：

```text
每个专家 MXFP4 权重 = 3 × 4096 × 2048 × 4 bit = 12MiB
每个专家 FP32 scale = 3 × 4096 × 2048 / 32 × 4 byte = 3MiB
专家数量 = 43 × 256 = 11008
仅 CPU 专家 owned buffer ≈ 11008 × 15MiB = 161.25GiB
```

即使少量专家放进 16GB 显存，剩余量仍远超 24GB。原版启动参数无法解决这个问题；必须修改权重生命周期和 scale 策略。固定 `v0.6.3` 源码已下载、核对并完成 AVX2/CUDA 编译，归档 SHA256 为 `dd0c9e382c5d9f02ba0b01a991395de06703af066006214b15d930a3715666ef`；源码确认 TP 包装器在单 CPU 池时也会复制全部专家。

本次 opt-in 补丁的实际边界：

- `BufferB` 在 mmap 模式只保存权重只读指针和 raw `uint8` UE8M0 scale 指针，`scale_at()` 在 AVX2 内核内按字节解码，不再启动时扩成 FP32。
- mmap 模式下 buffer 需求降为 scale 元数据，不复制每个专家的完整 weight/scale owned buffer；直接路径和单池 TP 路径均覆盖。
- Python 保留连续 raw scale tensor 和 loader 生命周期；为了避免未实现的 GPU 回迁，mmap 模式强制 `threadpool_count=1`、`kt-num-gpu-experts=0`，动态专家迁移关闭。
- 默认 `KT_MXFP4_MMAP` 未开启时仍走原版复制/scale 转换路径，并已通过同一合成模型回归。

合成模型通过不等于完整 159.6GB 模型已经可服务：仍未验证全模型 header、长上下文 KV、Prefill/Decode 吞吐和 OpenAI API。

CPU 没有 AVX-512。RAM 命中的专家需要对比两条执行路径：

1. CPU 使用 AVX2/VNNI 计算。
2. 从 Pinned RAM 复制到 GPU staging buffer，以原生 MXFP4 GPU kernel 计算。

先测量再决定，不预先假设 CPU 或 PCIe 路线更快。

## 最小模块设计

只新增一个内部接口：

```text
ExpertStore.get(layer_id, expert_ids, phase) -> expert handles / futures
```

内部实现三层，不增加外部 API：

```text
ExpertStore
├── GPUExpertCache
├── RAMExpertCache
└── NVMeExpertStore
    ├── 4KiB 对齐的只读专家块
    ├── 原生 MXFP4 权重与 UE8M0 scale
    └── io_uring / pread 到固定 staging buffer
```

缓存键必须是 `(layer_id, expert_id)`。每层都有独立的一组 256 个专家，不能只按 expert_id 做全局缓存。

最小修改边界：

- C++ 不再为所有专家分配并复制 weight buffer。
- 冷专家权重保留在只读 pack，不依赖可被提前释放的临时 mmap。
- 只为当前层被路由到的专家准备 weight/scale staging。
- UE8M0 scale 不在启动时全量扩成 FP32；只转换当前活跃专家，并进入有上限的 RAM LRU。
- 每层完成后对冷块显式回收，避免 cgroup 把隐式 page cache 算进 24GB 后失控。
- 热专家晋升到 RAM/GPU 时复制到 owned buffer；冷专家绝不常驻。

## 内存和显存预算

### 服务内存：24GB

| 用途 | 初始预算 |
| --- | ---: |
| RAM 专家缓存 | 16GB |
| Pinned I/O staging | 2GB |
| SGLang、Python、调度器与元数据 | 3GB |
| Prefill 激活与临时缓冲 | 2GB |
| 安全余量 | 1GB |

只有实际 RSS 和 cgroup 指标证明还有余量时，才把专家缓存从 16GB 增加到 18GB；不能靠 OOM 后再回退。

### 显存：16GB

| 用途 | 初始预算 |
| --- | ---: |
| FP8 公共权重 | 8～10GB |
| KV Cache、激活和 CUDA 工作区 | 3～4GB |
| 高频 MXFP4 专家 | 1～3GB |
| 驱动与安全余量 | 约 1GB |

初始上下文只设 4096。确定公共权重、Kernel 工作区和实际 KV 占用后，再决定每层能放多少 GPU 专家。

按模型结构粗算，原生路由专家文件约 137GiB，仓库其余内容约 11.6GiB。若这部分大多必须常驻显存，则 16GB 显存只能留下约 4GiB 给 KV Cache、工作区和专家，表中的 1～3GB GPU 专家预算可能需要降为 0。正式下载前先读取全部 Safetensors header，精确拆分公共权重、路由专家和 scale 体积。

## 权重来源和布局

唯一主来源：

```text
deepseek-ai/DeepSeek-V4-Flash
```

下载前比较 Hugging Face 官方仓库与 ModelScope 官方镜像的实际速度；只有确认仓库、revision、文件大小和校验信息一致时才允许换源。

ModelScope 官方镜像元数据已核对：74 个文件合计 `159630045338` bytes，即 `148.667GiB`；其中有 46 个 Safetensors 分片，单分片大多约 3.57～3.59GB。Hugging Face 远端链路当前不可达，正式下载前仍需做同 revision 校验和大文件短时测速。原始分片适合完整加载，不适合 Decode 时按专家随机读取。需要生成一个不改数值的部署布局：

```text
models/native/
├── manifest.json
├── common.fp8.pack
├── layer-00.experts.mxfp4.pack
├── layer-01.experts.mxfp4.pack
├── ...
└── layer-42.experts.mxfp4.pack
```

每个专家块连续保存 gate、up、down 权重及 MXFP4 scales，并按 4KiB 或更大边界对齐。manifest 记录官方 revision、原 tensor key、offset、length、dtype、shape 和 checksum。

转换过程需要同时保留原始与重排权重，按实测仓库大小计算约 297.34GiB，再加索引、校验和临时空间；按 340GiB 做容量预算。当前约 780GB 可用空间通过容量门禁。发布最终 pack 前必须重读并逐 tensor 校验，使用 `.partial` 后原子改名。

## Prefill 数据流

Prefill 使用按层、按专家批处理：

1. 计算当前层一批 token 的 Router。
2. 按专家 ID 聚合 token。
3. 一个专家权重从 SSD 读取一次。
4. 批量计算分配给该专家的全部 token。
5. 记录本次请求的专家访问频率。
6. Prefill 完成后，重新生成 Decode 阶段的 GPU/RAM 热专家表。

长输入不能采用逐 token 权重读取。完整读取 148.67GiB 权重的纯 SSD 理论下限约为：

```text
148.67GiB / 3.45GiB/s ≈ 43 秒
```

这只是 I/O 下限，不包含模型计算。

## Decode 数据流

每个 token 粗略激活 43 层 × 6 个专家。按每个专家约 12MiB 权重和 0.75MiB 原生 scale 计算，完全冷读约 `3.21GiB/token`。

每层执行：

1. GPU Router 得到 6 个专家。
2. GPU cache 命中：直接计算。
3. RAM cache 命中：CPU 计算或异步传入 GPU staging。
4. SSD miss：异步读取到 Pinned RAM，再执行。
5. 合并专家输出，进入下一层。

使用两个时间尺度的缓存：

- 跨请求：来自真实编码 Agent 数据的每层专家频率。
- 请求内：来自当前 Prompt Prefill 的专家频率。

单次访问不晋升；重复命中才进入 RAM。显存专家在请求边界批量调整，避免逐 token 频繁换入换出。

## 理论速度与验收线

SSD 实测 3.7GB/s，完全冷读的乐观上限：

```text
3.45GiB/s / 3.21GiB/token ≈ 1.07 token/s
```

预期区间：

| 阶段 | Decode 预期 |
| --- | ---: |
| 普通 mmap、无专家感知 | 0.5～1.2 token/s |
| 三层缓存初版 | 1～2 token/s |
| 编码请求专家局部性较好 | 2～4 token/s |
| 80% 以上命中的理想状态 | 4～6 token/s |

阶段验收：

- 服务 cgroup 当前内存始终小于 24GB。
- 服务 Swap 使用为 0。
- Windows 不出现持续页面文件活动。
- 首个正确性请求能完成，输出格式、工具调用和停止条件正常。
- 记录 GPU hit、RAM hit、SSD bytes/token、TTFT、TPOT 和 Decode token/s。
- 进入性能优化前，SSD 冷读取目标低于 1GB/token。
- 若真实编码请求无法达到约 70% 综合专家命中率，停止复杂缓存开发，并将本章结论定为硬件不可行。

## 服务边界

独立目录：

```text
/home/yiko/workspace/deepseek-v4-flash-serve/
├── config/
├── logs/
├── models/
├── run/
├── scripts/
└── src/
```

服务只监听：

```text
127.0.0.1:30000
```

通过 SSH Local Forward 暴露给 Mac，不直接开放局域网明文接口。API 模型 ID：

```text
deepseek-v4-flash-native
```

并发固定为 1。

## 实施顺序

### 阶段 0：配置与回滚

- 备份 Windows `.wslconfig`。
- 将 WSL 上限设为 30GB，WSL Swap 设为 0。
- 关闭并重启 WSL，验证 `free -h`。
- 确认 cgroup v2 与 systemd `MemoryHigh/MemoryMax/MemorySwapMax` 可用。
- 建立独立目录，不碰第一、二章目录。

已完成并验收：

```ini
# C:\Users\yikox\.wslconfig
[wsl2]
memory=30GB
swap=0
networkingMode=mirrored
dnsTunneling=false
firewall=true

[experimental]
hostAddressLoopback=true
```

原配置备份为 `C:\Users\yikox\.wslconfig.codex-backup-20260731`。执行 `wsl.exe --shutdown` 后重新连接，WSL 可见约 29GiB、Swap 为 0。systemd user transient unit 已验证下列属性真实生效：

```ini
MemoryHigh=22G
MemoryMax=24G
MemorySwapMax=0
OOMPolicy=stop
```

### 阶段 1：环境门禁

- 验证当前 NVIDIA 驱动、CUDA Toolkit、编译器和 Python。
- 核对 KTransformers 当前固定 release/commit 对 CUDA、Ada SM89 和 V4 的要求。
- 优先验证官方预编译 Kernel，只有预编译路径失败才构建源码。
- 完整 SGLang/FlashInfer 路线不通过时停止，不下载权重。

当前结果：清华 PyPI 镜像下载 `kt-kernel 0.6.3.post1` 的 10.8MiB wheel 约 1 秒；模块成功加载 `_kt_kernel_ext_avx2`。在同一进程中，PyTorch CUDA 计算结果为 `341.500153`，GPU 为 RTX 4070 Ti SUPER。官方 PyPI 直连仅约 15KB/s，已停止并清理失败下载。

### 阶段 1.5：24GB 内存实现门禁

- 基于固定版本源码做最小补丁：长期有效的只读权重映射、冷专家不复制、UE8M0 scale 在 AVX2 内核中按组即时解码。
- 用合成的 MXFP4 小模型验证数值一致性和 mmap 生命周期；第一版不实现用户态 LRU，改由 cgroup 限制文件页缓存。
- 在 systemd 24GB transient unit 内验证硬限制、无 Swap 和最小 CPU 执行路径。
- 证明 RSS、file cache 和 scale cache 有明确上限后，才允许下载 148.67GiB 正式权重。

实施时做了一个收敛：第一轮不先开发自定义 expert pack 和用户态 LRU，而是直接保留官方 Safetensors 的只读映射，让 cgroup 对已触碰的 file cache 施加 24GB 硬边界。原因是这条路径改动最小，足以先回答“能否启动、数值是否正确、普通 mmap 的 token/s 是否可接受”。只有基准确认随机读取是主要瓶颈后，才进入连续 pack、显式预读和热专家晋升。

固定源码中的 opt-in 开关为：

```bash
export KT_MXFP4_MMAP=1
export KT_MXFP4_BACKEND=avx2
export KT_KERNEL_CPU_VARIANT=avx2
```

第一版有意限制为 `threadpool_count=1`、`kt-num-gpu-experts=0`，并禁用动态专家迁移。默认不开开关时，KT-Kernel 原行为保持不变。

### 阶段 2：下载门禁

- 获取 Hugging Face 与 ModelScope 元数据。
- 对小文件或单分片做短时速度探测。
- 选择可信且实际更快的源。
- 固定 revision，并计算预计完成时间和最终磁盘占用。
- 阶段 1.5 原型现已通过，但完整 SGLang 依赖门禁未通过，因此仍不开始 148.67GiB 下载。

2026-08-01 的官方端点实测：ModelScope SDK 可列出 `deepseek-ai/DeepSeek-V4-Flash` 的 46 个 Safetensors 分片，权重合计 `159617149040` bytes（约 `148.655GiB`），全仓库文件合计 `159630045338` bytes；Hugging Face `config.json` 请求 12 秒超时。ModelScope `config.json` 返回 200，8MiB Range 读取分片约 `7.27MB/s`；这只是短时 Range 样本，按该瞬时速度粗算全量约 6.1 小时，不作为下载承诺。正式下载前仍需固定 revision、重算文件清单和校验。

完整 SGLang V4 门禁当前结果：机器 CUDA Toolkit 为 12.6（官方教程要求 12.8+）；现有环境 `flashinfer-python=0.6.6` 且缺 `flashinfer-cubin`（教程要求两者同版本且 ≥0.6.9）；`transformers=5.3.0`（V4 需要 4.57.1）；`sglang`、`tilelang` 均未安装。因此本轮只完成 Kernel 原型，不宣称 SGLang 服务可启动。

### 阶段 3：权重重排

- 生成原生 dtype/scale 不变的 layer-expert pack。
- 校验 tensor 数量、shape、dtype、offset 和 checksum。
- 清除失败的 `.partial`，不保留一次性调试脚本。

### 阶段 4：最小推理

- 1K 上下文、最多 64 输出 token。
- 4K 上下文、最多 256 输出 token。
- 单并发、Thinking Off。
- 先验证正确性，再采集性能。

### 阶段 5：专家统计与缓存

- 使用真实编码 Agent 请求记录 per-token 专家分布。
- 离线模拟不同 GPU/RAM 配额的命中率。
- 达到继续门槛后再实现动态晋升、异步预读和 request-local 热专家。

### 阶段 6：Agent API 验收

- Chat Completions 普通响应与流式响应。
- Tool Calling。
- JSON/结构化输出。
- 1K、4K、16K 输入矩阵。
- 记录 16K、32K、128K 的 go/no-go 结果，不强行追求全部通过。

## 当前状态

截至 2026-08-01：

- 远端 SSH 已恢复，GPU 基本空闲，现有 Qwen llama.cpp 服务处于停止状态。
- WSL 已限制为 30GB，Swap 已设为 0；重启后验收通过。
- cgroup v2 的 `MemoryHigh=22G`、`MemoryMax=24G`、`MemorySwapMax=0` 已用 transient user unit 验收。
- 独立目录 `/home/yiko/workspace/deepseek-v4-flash-serve/` 已创建。
- 隔离环境已创建，`kt-kernel 0.6.3.post1` 已安装；完整依赖尚未安装。
- 当前驱动上 PyTorch cu128、CUDA 与 AVX2 Kernel 联合烟雾测试通过；完整 SGLang V4 栈尚未验收。
- 官方模型元数据已确认总量 148.667GiB、46 个 Safetensors 分片。
- `ktransformers v0.6.3` 源码归档已下载并校验；原版 KT-Kernel 全量复制专家权重的 24GB 阻塞已从源码确认。
- MXFP4 mmap/UE8M0 即时解码补丁已写入远端固定版本源码，并以 CUDA/SM89 + AVX2 编译成功；mmap 路径和默认路径在 24GB transient cgroup 中均通过合成权重数值回归，误差约 0.46%/0.28%，Swap 峰值为 0。
- 官方 V4 权重尚未下载。
- 完整 SGLang V4 仍被 CUDA/FlashInfer/Transformers/SGLang/TileLang 版本门禁挡住；当前结果只能称为“24GB 受限下的 MXFP4 mmap Kernel 原型”，不能称为 Agent 可用服务。
- 后续顺序：先决定是否为 SGLang 单独准备 CUDA 12.8+ 与兼容依赖环境；门禁通过后再下载官方权重、做全量 header 分析；之后才实现 expert pack、显式预读、RAM/GPU 晋升和真实 Prefill/Decode/API 验收。任何后续实际改动、参数和测量结果都应回写本章，替换计划值而不是追加过时过程记录。

## 参考

- [DeepSeek-V4-Flash 官方模型](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash)
- [KTransformers：DeepSeek-V4-Flash 教程](https://github.com/kvcache-ai/ktransformers/blob/main/doc/en/DeepSeek-V4-Flash.md)
- [KT-Kernel README](https://github.com/kvcache-ai/ktransformers/blob/main/kt-kernel/README.md)
- [AVX2 MXFP4 内核源码](https://github.com/kvcache-ai/ktransformers/blob/main/kt-kernel/operators/avx2/mxfp4-moe.hpp)
