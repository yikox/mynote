# 模块：序列并行（parallel）

- 状态：accepted（当前已落地基线；Ring + Ulysses 的 2×2 组合已完成 LTX2 真机验证）
- 代码：`optkit_v2/components/parallel/`（`component.py` 编排、`transformers/ulysses.py`、`transformers/ring.py`、`cp_wrappers.py`、`sequence_dispatcher.py`）
- 上游：[main-design](../main-design.md)；相关：[regione](regione.md)、[optimization-components](optimization-components.md)（sage）

## 1. 职责与边界

序列并行（Context Parallel）：把自注意力序列切分到多卡。Ulysses（head all-to-all）与 Ring（分块循环 + 在线 softmax）是两个可独立配置、也可同时启用的维度；V2 不为二者组合另设模式名。`ParallelSpec`：`ulysses_degree`、`ring_degree`、`cp_degree = ulysses × ring`、`ulysses_anything`、`ring_anything`、`ring_rotate_method`（allgather/p2p）、`convert_to_fp32`。

## 2. 统一切分契约（Ulysses / Ring 共用）

- 切分单位 = **自注意力序列**。`attn_mode` 区分三类：
  - `"self"`（q/k/v 同处被切的序列；flux/qwen joint = `[txt|img]`，wan attn1 = 视频）→ **需要通信**。
  - `"cross"`（query 已分片、k/v 是复制的全量条件；wan attn2 文本、I2V 图像）→ **本地算即正确，全透传**（Ulysses/Ring/RegionE 都返回 None）。
  - `"v2a"`（LTX2：audio query 全卡复制、video K/V 按完整 CP group 分片）→ 各 rank 计算 partial output 与 log-sum-exp，再在完整 CP group 稳定合并；不走 Ring，也不 gather 长 video K/V。
- CP 切分**下沉到 transformer 级**（序列在 tokenize/patch 后才存在；wan 进来是 5D 视频）：`cp_split_blocks`（block 循环前切 hidden+rotary，joint 模型连带切 encoder）、`cp_gather_blocks`（proj_out 后 all_gather 回 full）。
- **支持不均匀序列切分**（`ulysses_anything` / `ring_anything`，默认开）：丢弃无效 txt padding 后每 rank joint 序列常不被 `cp_degree` 整除，标准等长路径会 reshape 错位出纯噪声；anything 路径走 `gather_sizes + pad` 处理变长，整除时退化为等长路径，数值一致、无额外代价。

## 3. Ulysses（head all-to-all）

```mermaid
flowchart LR
    a["seq 切片, head 全量"] -->|"on_backend_enter: scatter heads"| b["head 切片, seq 全量"]
    b --> c["算 attention"]
    c -->|"on_backend_exit: gather heads"| d["还原 seq 切片"]
```

- 是 attention 的**外层**变换。`HOOK_ORDER["on_backend_enter"] = (PARALLEL, REGIONE)` → Ulysses 先 scatter，再轮到 RegionE 的 KV 组装（内层），二者正交。
- **分段处理**：bundle 里 `<seg>_q/_k/_v` 段名任意（flux/qwen 两段 img/txt；wan 单段），parallel 泛化遍历，不认具体语义。
- 限制：cross-mode 透传。

## 4. Ring（分块循环 + 在线 softmax）

- **机制**：序列分块分发各 rank，环形传 K/V 分块，每步在线 softmax 合并（需 LSE）。作为 `replace_dispatch_attention_fn` 的**装饰器**包裹内层 kernel（sage 或原生），故 `HOOK_ORDER` 中 ring 在 sage 之后。
- **内层 kernel 选择**：内层支持 `return_lse`（sage 支持）直接复用；否则退回 `native_attention_kernel`（原生 flash 出 LSE）→ **保证关 sage 也能跑 ring**。
- **`cp_wrappers.py` 只做 ring**：到达 wrapper 时 q/k/v 已被外置 Ulysses scatter 过 head，直接调 `ring_attention`，不走 diffusers `_templated_context_parallel_attention` 的 degree 路由（误走会双重 scatter 维度全错）。
- 限制：cross-mode 透传；**不支持 RegionE**（config 报错）；**已知数值漂移**——Qwen ring 路径 SSIM 偏低（ring4=0.70、u2r2=0.58，而 ulysses4=0.88；flux-kontext ring4≈ulysses4 正常）→ Qwen 专属 ring（RoPE/attention）问题，排查中。
- LTX2 实测风险：默认 FP8 + SageAttention 下纯 Ring `u1/r2` 逐帧视频通过、运行正常，但音频 cosine 低于 Ulysses 控制线；P2P 与 AllGather 逐项一致，attention 微测试显示 Sage 分块近似误差明显大于 native。匹配的原生 attention 全模型实验中纯 Ring 以 `0.822073 >= 0.796239` 通过相对门禁，确认 Sage 分块近似是主要贡献者，但不证明是唯一来源。该问题是 Sage 与 Ring 的质量交互风险，不是通信正确性失败；当前不自动改变内核选择。

## 5. Ring + Ulysses 组合

二者同时启用时，执行为外置 Ulysses head all-to-all ∘ 内层 Ring 装饰器，二维 mesh 为 `(ring, ulysses)`；没有第三条特殊分支。LTX2 `u2/r2` 已在 4×RTX5090、CUDA/NCCL、Sage、FP8、compile 下完成真实权重验证：timed 约 28.4 秒，逐帧视频与音频数值门禁均通过；主观听音未验收。

## 6. 全局约束

`ulysses_degree`、`ring_degree` 均须 `>=1`；`cp_degree=1` 时除暴露 `ctx.parallel = self` 外不注册任何 hook（全 identity），`cp_degree>1` 时必须等于 `world_size`。当前不支持在同一 world 内再分数据并行子组；需外部已 `dist.init_process_group`（典型 torchrun）。

## 7. 已知风险

- **A14B（wan-t2v/i2v）四卡 OOM**：双 14B 专家 fp8 常驻 ~26G，CP 切序列不切权重，每卡 >32G；需 ≥48G 卡或对双专家做权重切分，单卡可用。
- ADR-005：CP 切分单位 = 自注意力序列，下沉到 transformer 级；原始 self/cross 两类已由 LTX2 扩展为 self/cross/v2a 三类，支持不均匀切分。
