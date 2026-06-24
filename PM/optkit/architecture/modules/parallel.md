# 模块：序列并行（parallel）

- 状态：accepted（当前已落地基线；USP 路径标注待 2×2 真机复核）
- 代码：`optkit_v2/components/parallel/`（`component.py` 编排、`transformers/ulysses.py`、`transformers/ring.py`、`cp_wrappers.py`、`sequence_dispatcher.py`）
- 上游：[main-design](../main-design.md)；相关：[regione](regione.md)、[optimization-components](optimization-components.md)（sage）

## 1. 职责与边界

序列并行（Context Parallel）：把自注意力序列切分到多卡，做 Ulysses（head all-to-all）/ Ring（分块循环 + 在线 softmax）/ USP（两者组合）。`ParallelSpec`：`ulysses_degree`、`ring_degree`、`cp_degree = ulysses × ring`、`ulysses_anything`、`ring_anything`、`ring_rotate_method`（allgather/p2p）、`convert_to_fp32`。

## 2. 统一切分契约（Ulysses / Ring 共用）

- 切分单位 = **自注意力序列**。`attn_mode` 区分两类：
  - `"self"`（q/k/v 同处被切的序列；flux/qwen joint = `[txt|img]`，wan attn1 = 视频）→ **需要通信**。
  - `"cross"`（query 已分片、k/v 是复制的全量条件；wan attn2 文本、I2V 图像）→ **本地算即正确，全透传**（Ulysses/Ring/RegionE 都返回 None）。
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

## 5. USP（Ulysses × Ring 同时 > 1）

= 外置 Ulysses head-alltoall ∘ 内层 ring 装饰器组合（2D mesh `(ring, ulysses)`）。**限制**：USP 路径需真机 2×2 数值对比验证后方可信（代码标注 ⚠️）。

## 6. 全局约束

`cp_degree (= ulysses × ring) <= world_size`，否则 config 报错；`cp_degree <= 1` 时除暴露 `ctx.parallel = self` 外不注册任何 hook（全 identity）。需外部已 `dist.init_process_group`（典型 torchrun）。

## 7. 已知风险

- **A14B（wan-t2v/i2v）四卡 OOM**：双 14B 专家 fp8 常驻 ~26G，CP 切序列不切权重，每卡 >32G；需 ≥48G 卡或对双专家做权重切分，单卡可用。
- ADR-005：CP 切分单位 = 自注意力序列，下沉到 transformer 级，self/cross 两模式，支持不均匀切分。
