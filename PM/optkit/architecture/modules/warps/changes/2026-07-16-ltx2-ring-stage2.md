# LTX2 Stage2 Ring + Ulysses 并行设计

Last updated: 2026-07-17

- 状态：accepted
- 级别：L2 模块变更
- 需求 ID：REQ-20260716-ltx2-ring-stage2
- 主模块：模型 warp（LTX2）
- 影响模块：序列并行、`TDD/LTX` Stage2 demo
- 关联实现：`optkit_v2/warps/transformers/transformer_ltx2.py`、`optkit_v2/components/parallel/`、`TDD/LTX/ltx2.3_demo_opt_stage2.py`
- 用户确认：2026-07-16；V2 中 Ring 与 Ulysses 是两个可独立配置且可同时启用的并行维度，不引入或区分“USP”路径
- 实施状态：已落地，质量验证收口中（`u2/r2` 逐帧视频与音频数值门禁通过、主观听音未验收；纯 Ring `u1/r2` 默认 FP8 + Sage 音频数值门禁未过，匹配的原生 attention 对照已通过并确认 Sage 分块近似为主要贡献者，产品策略待确认）
- 实施计划：`2026-07-16-ltx2-ring-stage2-implementation-plan.md`

## 1. 结论

现有 V2 并行模块已经具备 LTX2 纯 Ring 及 Ring + Ulysses 组合所需的数学与通信能力。本次不新增并行算法、不增加 LTX2 专属公共接口，也不修改 `OptKitContext`、`ParallelSpec` 或 `HOOK_ORDER` 契约。

实施只需要：

1. 让 Stage2 demo 可配置 Ring/Ulysses degree 与 Ring rotation method；
2. 保持 LTX2 现有六路 attention 角色分发，其中 video self 进入 Ulysses + Ring，`v2a` 继续走完整 CP group 的 LSE merge；
3. 清理 V2 并行代码与文档中的“USP”旧术语，统一称为“Ring + Ulysses 组合”；
4. 在真实 5090/CUDA/NCCL/Sage/compile 环境完成纯 Ring 与组合路径的数值、画质、音频和性能验证。

## 2. 背景与约束

LTX2 是 video + audio 双残差流联合 DiT。每个 block 有六路 attention，不能照搬单流模型把所有 token 拼成一条 self-attention 序列：

- 只切 video 序列；audio 与 text 在所有 CP rank 复制；
- video self 的 Q/K/V 都随 video 分片；
- `a2v` 是 video Q 分片、audio K/V 复制，本地计算即正确；
- `v2a` 是 audio Q 复制、video K/V 分片，必须合并局部 softmax 状态，禁止直接相加局部输出；
- Stage2 使用所有 torchrun rank 做 CP，因此 demo 层要求 `ulysses_degree × ring_degree == world_size`；公共配置仍保留 `cp_degree <= world_size`，不收窄其他调用方可能使用的数据并行空间。

## 3. 现有 V2 能力审计

### 3.1 序列切分与二维 mesh

`ParallelComponent` 已按 `(ring_degree, ulysses_degree)` 创建二维 mesh，并以完整 CP group 做 transformer 级 video sequence split/gather。`SequenceDispatcher` 支持不均匀序列切分，因此 LTX2 的实际 video token 数不需要对 CP degree 整除。

### 3.2 Ulysses 与 Ring 的组合

- Ulysses：通过 `on_backend_enter/exit` 在 attention 外层执行 head all-to-all；
- Ring：通过 `replace_dispatch_attention_fn` 装饰内层 attention kernel，循环轮转 K/V 并用 LSE online-softmax 合并；
- 同时开启：执行顺序自然为 Ulysses 外层、Ring 内层，无需第三条特殊路径；
- Sage：先替换 dispatch，Ring 再包装 Sage kernel，顺序已经由 `HOOK_ORDER` 固定。

### 3.3 LTX2 第三种拓扑

`attn_sharded_kv_lse_merge` 已支持 Q 全量、K/V 按完整 CP group 分片的 attention：各 rank 计算局部 `(out_i, lse_i)`，all-gather 短 audio query 对应的 partial out/LSE，再用 `SDPAMerger` 合并。该路径比 gather 长 video K/V 后重复计算更省通信与计算。

本设计要求 `v2a` 优先匹配这条路径，不被 Ring 再次包装。

### 3.4 最小数值验证证据

2026-07-16 使用 Gloo、float32、不均匀 video 长度 `S=11` 做 attention 级验证：

| 配置 | video self 最大绝对误差 | v2a 最大绝对误差 | a2v 最大绝对误差 |
| --- | ---: | ---: | ---: |
| `u2/r1` | `0` | `1.19e-7` | `0` |
| `u1/r2` | `1.79e-7` | `1.19e-7` | `0` |
| `u2/r2` | `1.79e-7` | `2.38e-7` | `0` |

该证据验证 mesh 分组、Ulysses + Ring 组合、不均匀切分和 `v2a` LSE merge 的数学路径；不替代真实 CUDA/NCCL/Sage/compile 验收。

## 4. 六路 attention 数据流

| Attention | Q/K/V 分布 | 并行处理 |
| --- | --- | --- |
| `attn1` | video Q/K/V 均为 CP 分片 | Ulysses head all-to-all（外层）+ Ring K/V rotation（内层） |
| `audio_attn1` | audio 全卡复制 | 本地计算 |
| `attn2` | video Q 分片；text K/V 复制 | 本地计算 |
| `audio_attn2` | audio Q、text K/V 均复制 | 本地计算 |
| `audio_to_video_attn` | video Q 分片；audio K/V 复制 | 本地计算 |
| `video_to_audio_attn` | audio Q 复制；video K/V 分片 | 不走 Ulysses/Ring；完整 CP group partial out/LSE gather + LSE merge |

block 完成后只 gather video 输出；audio 输出继续保持全卡复制。

## 5. 方案比较

### 方案 A：复用 V2 正交组合（采纳）

复用现有 sequence split、Ulysses 外层 hook、Ring dispatch 装饰器和 `v2a` LSE merge。LTX2 warp 只声明 attention 角色，Stage2 demo 负责装配 degree。

优点：公共接口零增量、模型与 component 边界不变、已有其他模型 Ring 路径可复用；最符合 V2 组件化设计。

### 方案 B：在 LTX2 warp 内实现专属 Ring（拒绝）

会让 warp import 并行 component、复制 Ring/LSE 算法，并破坏“warp 只发 hook”的边界；后续公共 Ring 修复无法自动覆盖 LTX2。

### 方案 C：让 v2a 也走 Ring K/V rotation（拒绝）

数学上可行，但需要轮转长 video K/V；现有方案只通信短 audio query 对应的 partial out/LSE，成本更低。并且 `v2a` 的 Q 在所有 rank 复制，不需要 Ring 的 query-local 输出语义。

## 6. 详细变更

### 6.1 Stage2 demo

新增可选环境变量：

- `OPTKIT_RING_DEGREE`：默认 `1`；
- `OPTKIT_ULYSSES_DEGREE`：可显式指定；未指定时取 `world_size // ring_degree`；
- `OPTKIT_RING_ROTATE_METHOD`：`p2p` 或 `allgather`，默认 `p2p`。

启动前校验：

- 两个 degree 均为正整数；
- `world_size % ring_degree == 0`；
- `ulysses_degree × ring_degree == world_size`；
- rotation method 只接受 `p2p/allgather`。

默认行为仍为 `u=world_size/r=1`，兼容现有 Stage2 Ulysses 命令。日志统一打印 `ulysses`、`ring`、`rotate_method`。

### 6.2 LTX2 warp

不改 processor 分支和 attention 数学。保留现有三类角色：

- `self_video` → `attn_mode="self"`；
- `v2a` → `attn_mode="v2a"`；
- 其余 → `attn_mode="cross"`。

只更新文件头和局部注释：Ring 不再标记为 out-of-scope；明确 Ring + Ulysses 组合与 `v2a` 独立 LSE merge。

### 6.3 公共并行模块与文档

运行时代码不改。把 `component.py`、`cp_wrappers.py`、`transformers/ulysses.py`、`sequence_dispatcher.py` 和 parallel 架构文档中的“USP”改为“Ring + Ulysses 组合”。

兼容性：仅术语/注释调整；`ParallelSpec` 字段、hook 名、handler 顺序、tensor 契约和默认值均不变。

## 7. 测试与验收

### 7.1 拓扑矩阵

| torchrun | 配置 | 目的 |
| --- | --- | --- |
| 2 卡 | `u2/r1` | 现有 Ulysses 控制组 |
| 2 卡 | `u1/r2` | 纯 Ring |
| 4 卡 | `u2/r2` | Ring + Ulysses 组合 |

默认验证 `p2p`；`allgather` 作为结果交叉验证和故障定位手段。

### 7.2 运行阶段

1. 正确性阶段：固定 seed、prompt、768×512、121 帧、24fps、30 steps、guidance 3.0；通过 `OPTKIT_DUMP` 保存 video/audio 原始数组；
2. 生产组合阶段：sage + fp8 + compile，compile 跑 warmup + timed 两趟；
3. 回传 MP4 和数组，检查视频逐帧 SSIM、音频 waveform cosine、NaN/Inf 与形状。

### 7.3 验收门槛

- 无 Traceback、NCCL hang、NaN/Inf；video/audio shape 与单卡一致；
- 以 `u2/r1` 对单卡的质量指标为控制线，`u1/r2` 与 `u2/r2` 的逐帧 SSIM 下降不超过 `0.02`；
- 音频 waveform cosine 相对控制线下降不超过 `1e-3`；
- MP4 无花屏，音频无明显爆音、中断或错位；
- 日志含 warmup/timed/saved 与完整 parallel 配置；
- 本轮记录性能和 peak memory，不把“必须快于 Ulysses”设为正确性硬门槛。

## 8. 风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| Ring online-softmax 的数值顺序差异被扩散过程放大 | 最终视频 SSIM 下降 | 先跑纯 Ring 隔离；用 Ulysses 控制线和 attention 级误差联合判断 |
| `p2p` 在特定 NCCL/PCIe 拓扑 hang 或性能差 | 运行失败或无加速 | 用 `allgather` 交叉验证，区分算法与 transport 问题 |
| Sage `return_lse` 与 compile 集成异常 | Traceback 或重编译 | 正确性与 production 组合分阶段验证；保留原生 flash LSE fallback |
| 误把 `v2a` 送入 Ring | 长 KV 通信、重复合并或错误输出 | `attn_mode="v2a"` 优先匹配完整 CP LSE merge；测试覆盖 audio 输出 |
| Stage2 degree 乘积小于 world size | rank 闲置、mesh/collective 不一致 | demo 启动即要求乘积等于 world size |

## 9. 范围

In scope：LTX2 Stage2 demo 配置与日志、LTX2 warp 注释、V2 parallel 旧术语清理、三种拓扑远端验证。

Out of scope：改变公共并行算法；新增特殊并行模式；MagCache；STG；IC-LoRA self mask；DiCache + Ring 组合验证；发布文档与 autotest 接入。

## 10. 决策记录

| 日期 | 决策 | 理由 |
| --- | --- | --- |
| 2026-07-16 | V2 不引入或区分“USP”；Ring 与 Ulysses 可独立配置并同时启用 | 两者已由正交 hook/mesh 组合，新增模式只会制造概念和代码分叉 |
| 2026-07-16 | LTX2 `v2a` 保持完整 CP group partial out/LSE merge，不走 Ring | Q 复制、KV 分片；通信短 audio out/LSE 比轮转长 video KV 更合适 |
| 2026-07-16 | 不修改公共契约与并行算法 | 现有三种拓扑的 attention 级数值验证已通过 |
| 2026-07-16 | Stage2 使用全部 torchrun rank，要求 degree 乘积等于 world size | 避免 demo 中出现未参与 CP 的 rank 和不一致 collective |
| 2026-07-17 | 保留原音频门禁，不用 `fp8_row` 的混杂相对结果宣称修复 | rowwise 两组没有匹配的 single-row 参考，且 Ulysses↔Ring 直接 cosine 从默认 FP8 的 0.816554 降至 0.723803 |
| 2026-07-17 | 不自动把纯 Ring 改为关闭 SageAttention | 匹配的原生 attention 对照虽通过，但自动回退会改变用户开启 Sage 后的公开语义，并使纯 Ring timed 从约 29.95 秒变为约 32.25 秒；需单独确认产品策略 |

## 11. 实施与验收结果

### 11.1 已落地内容

- Stage2 demo 新增 Ring degree、Ulysses degree 与 P2P/AllGather rotation 解析；默认行为保持 Ulysses-only。
- demo 启动时要求 `ulysses_degree × ring_degree == world_size`，错误配置在加载模型前失败。
- LTX2 warp 的六路 attention 角色不变；`attn1` 进入 Ulysses 外层 + Ring 内层，`v2a` 继续完整 CP group 的 partial output/log-sum-exp 稳定合并。
- V2 产品代码没有新增模式、配置字段、hook、`attn_mode` 或并行算法；只清理旧术语并补全注释。

### 11.2 真实权重矩阵

统一使用 768×512、121 帧、30 步、seed 0、Sage、默认 FP8、compile warmup + timed：

| 拓扑 | timed | 视频 SSIM（对 single） | 音频 cosine（对 single） | 结果 |
| --- | ---: | ---: | ---: | --- |
| u2/r1 | 30.34s | 0.905051 | 0.805666 | 控制组成功 |
| u1/r2 p2p | 29.95s | 0.923510 | 0.792696 | 运行/逐帧视频通过；音频未过 0.804666 阈值 |
| u2/r2 p2p | 28.48s | 0.914866 | 0.815392 | 运行、逐帧视频、音频数值门禁通过 |

视频门禁按每一帧相对控制组同帧比较，而不是只看均值：`u1/r2` 与 `u2/r2` 均为 0 个失败帧，最小逐帧差值分别为 `+0.014905`（第 31 帧）与 `+0.006138`（第 100 帧）。三种拓扑都没有 Traceback、NCCL 错误、OOM 或 NaN/Inf，MP4 中帧无花屏。组合路径的运行、逐帧视频与音频数值门禁通过，但没有主观听音，不能宣称已验收爆音、中断或音画错位；纯 Ring 的运行支持已落地，但不能标记为默认 FP8 音频质量完成。

### 11.3 根因边界

attention 微测试证明 P2P 与 AllGather 逐项一致，`v2a` 跨 rank 输出一致，排除了传输与 rank divergence。代表形状下 Sage Ring 对 full-KV 的 relative L2 约 4.3%，native 约 0.3%。随后完成同量化、同原生 attention 后端的 single/control/candidate 全模型实验：single、`u2/r1`、`u1/r2` timed 分别为 46.36、37.25、32.25 秒；控制音频 cosine 为 `0.797239`，阈值为 `0.796239`，纯 Ring 为 `0.822073`，通过门禁。该模型级对照结合微测试确认 Sage 分块近似与 Ring 多轮合并的交互是主要贡献者，但关闭 Sage 会影响六路 attention，不能证明 video self 是唯一贡献位置。`fp8_row` 对照没有缩小拓扑间直接差异。当前不修改公共 Ring 算法、不自动改变内核选择，也不放宽质量阈值；下一步由产品设计确认纯 Ring 风险说明、自动回退或仅推荐 `u2/r2`。
