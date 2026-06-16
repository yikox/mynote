# optkit_v2 架构讲解（分享文档）

> 面向新接入同学的代码导读。讲清三件事：**支持哪些优化方法及其限制**、**Context 的设计**、**已实现的模型 pipeline**。
> 代码路径：`optkit_v2/`。

---

## 0. 一分钟总览

optkit_v2 把 diffusion 推理优化重构为**可组合的 component 框架**。用户只描述意图，框架负责装配：

```python
from optkit_v2 import OptKitConfig, apply_warp
from optkit_v2.config import SageSpec, QuantSpec, CompileSpec, ParallelSpec, DiCacheSpec

cfg = OptKitConfig(
    sage=SageSpec(),
    quant=QuantSpec(enabled=True, dtype="float8"),
    compile=CompileSpec(enabled=True),
    parallel=ParallelSpec(ulysses_degree=4),     # torchrun 4 卡
    cache=DiCacheSpec(enabled=True, rel_l1_thresh=0.08),
    world_size=4,
)
ctx = apply_warp(pipe, cfg)   # warp 按 pipe 类名自动解析
images = pipe(prompt="...").images
```
·
三层 + 一契约：

```
用户 → OptKitConfig(specs)         描述意图，无逻辑           config/specs.py
        │ apply.py: spec → component
        ▼
     OptComponent（能力插件）        sage/quant/compile/parallel/cache/regione
        │   ↕ register / trigger hooks
     OptKitContext（冻结契约）        分发原语 + 命名生命周期 + 跨组件引用槽   core/context.py
        │   ↕ warp 经 trigger 发 hook
     warp（模型侧）                   替换 transformer.forward + attn processor  warps/*.py
```

`apply_warp`（`apply.py`）的编排顺序：

1. 校验同一 transformer 未被重复 warp（`pipe.transformer._optkit_ctx`）。
2. `resolve_warp(pipe)` 按 `type(pipe).__mro__` 类名解析模型 warp。
3. `config.specs()` → 逐个 `spec_to_component` → `component.attach(ctx)`（单趟，顺序无关）。
4. `warp_fn(pipe, ctx)` 替换 `transformer.forward` 与 attn processor。
5. `ctx.trigger("on_pipe_ready", pipe)` 统一执行延迟的 pipe 变换（量化改权重 → compile 编图 → regione 换 scheduler），顺序由 `HOOK_ORDER` 定。

---

## 1. 支持的优化方法与限制

能力身份枚举（`core/order.py` 的 `Comp`）：`sage / quant / compile / parallel / cache / regione`。
配置容器 `OptKitConfig` 字段：`sage / quant / compile / parallel / cache`，其中 **`cache` 三选一互斥**（DiCache / MagCache / RegionE，单字段联合，从类型上即构造不出“同时开两个”）。

### 1.1 SageAttention（`components/sage/`）—— 注意力后端替换

- **做什么**：把 attention 后端整体换成 SageAttention kernel（INT8/FP8 量化注意力），不替换 attn processor（processor 由 warp 负责）。
- **怎么接**：注册到 `replace_dispatch_attention_fn`，以 diffusers `dispatch_attention_fn` 为种子，sage handler **replace** 整个 dispatch → `sage_kernel`。
- **与 Ring 的关系**：`HOOK_ORDER["replace_dispatch_attention_fn"] = (SAGE, PARALLEL)`，sage 先 replace，ring 再 decorate（包裹）。即 **sage 与 ring 是包裹关系**：ring 循环的内层 kernel 用的就是 sage 替换后的函数（保留 sage 加速）。
- **限制**：
  - 需安装 `sageattention`，否则 `attach` 直接 `RuntimeError`。
  - sage kernel 支持 `return_lse`，ring 在线 softmax 合并依赖它；关 sage 走 ring 时退回 `native_attention_kernel` 出 LSE。

### 1.2 量化 Quant（`components/quant/`）—— FP8/INT8 权重量化

- **做什么**：基于 torchao 对 transformer 权重做 FP8/INT8 量化，缩小常驻显存。`dtype` 支持 `float8/fp8/int8` 及各自 `_weight_only` 变体。
- **怎么接**：是 pipe 变换（改权重），注册到 `on_pipe_ready`；`HOOK_ORDER["on_pipe_ready"] = (QUANT, COMPILE, REGIONE)`，**量化早于 compile**（编译已量化的权重）。
- **双 transformer 模型**：`transformer` 与 `transformer_2`（Wan2.2 A14B 双专家）都会量化；单 transformer 模型 `transformer_2=None` 自动跳过。
- **`auto_skip`（默认 True）**：按 `model.__class__.__name__` 查 skip 表，跳过 `norm_out / proj_out / time_embed / x_embedder / lora` 等关键模块，fallback 用 `common_skip_keys + lora_skip_keys`。设 False 只跳 `lora_A/lora_B`（其余全量化，易踩坑，不推荐）。
- **限制 / 注意**：
  - **transformer 不做 cpu-offload**：torchao 量化张量与 accelerate 跨设备搬运不兼容；显存不足靠量化缩到常驻，而非 offload。


### 1.3 torch.compile（`components/compile/`）—— 区域编译

- **做什么**：**逐 block 编译**（`block.compile()`），而非整图，避免变长序列/分支带来的反复重编。覆盖 `transformer_blocks / single_transformer_blocks / blocks / vace_blocks` 四类容器。
- **怎么接**：pipe 变换，注册到 `on_pipe_ready`，晚于 quant、早于 regione 换 scheduler。
- **关键设置**：
  - `torch._dynamo.config.cache_size_limit = 10000`。
  - `allow_unspec_int_on_nn_module = True`：让 warp 经 `ctx._current_block_idx` 传入的 block 序号不被 dynamo 特化，**同构 block 共用一份 graph**（否则每个 block idx 各编一份 → N+ 次重编）。
  - 编译产物缓存默认 `/app/cache/torch_inductor`（`CompileSpec.cache_dir`）。
- **限制 / 注意**：
  - **必须跑两遍**：第一遍含编译开销，计时/对比结论取第二遍稳态。
  - 开 compile 的项 warmup 内仍有重编（fp8 权重类型 guard + CFG cond/uncond 两种序列长），run2 起稳态零重编。
  - **RegionE + compile 强制 `dynamic=True`**（partial step 是变长序列，否则 dynamo 反复重编每步几分钟）；config 层会自动覆盖并 warn。

### 1.4 Parallel —— 序列并行（重点：Ulysses / Ring / USP）

代码：`components/parallel/`（`component.py` 编排，`transformers/ulysses.py`、`transformers/ring.py`、`cp_wrappers.py`、`sequence_dispatcher.py`）。

`ParallelSpec`：`ulysses_degree`、`ring_degree`、`cp_degree = ulysses × ring`、`ulysses_anything`、`ring_anything`、`ring_rotate_method`（allgather/p2p）、`convert_to_fp32`。

**统一切分契约（两者共用）**：
- 切分单位 = **自注意力序列**。`attn_mode` 区分两类 attention：
  - `"self"`（自注意力，q/k/v 同处被切的序列；flux/qwen joint = `[txt|img]`，wan attn1 = 视频）→ **需要通信**。
  - `"cross"`（交叉注意力，query 已分片、k/v 是复制的全量条件；wan attn2 文本、I2V 图像）→ **本地算即正确，全透传**（Ulysses/Ring/RegionE 都返回 None）。
- CP 切分**下沉到 transformer 级**（序列在 tokenize/patch 后才存在；wan 进来是 5D 视频）：`cp_split_blocks`（block 循环前切 hidden+rotary，joint 模型连带切 encoder）、`cp_gather_blocks`（proj_out 后 all_gather 回 full）。
- **支持不均匀序列切分**（`ulysses_anything` / `ring_anything`，默认开）：文本+图像模型丢弃无效 txt padding 后，每 rank 的 joint 序列常不被 `cp_degree` 整除，差 1 token；标准等长路径会 reshape 错位出纯噪声。anything 路径走 `gather_sizes + pad` 处理变长；整除时退化为等长路径，数值一致、无额外代价。

#### Ulysses（head all-to-all）

- **机制**：把「序列切片、head 全量」转成「head 切片、序列全量」再算 attention。挂在 `on_backend_enter`（scatter heads：seq-local → head-local seq-global）/ `on_backend_exit`（gather heads）。是 attention 的**外层**变换。
- **顺序**：`HOOK_ORDER["on_backend_enter"] = (PARALLEL, REGIONE)` → Ulysses 先 scatter，再轮到 RegionE 的 KV 组装（内层），二者正交。
- **分段处理**：bundle 里 `<seg>_q/_k/_v` 段名任意（flux/qwen 两段 img/txt；wan 自注意力单段），parallel 泛化遍历，不认具体语义。
- **限制**：cross-mode 透传（不通信）。

#### Ring（分块循环 + 在线 softmax）

- **机制**：序列分块分发到各 rank，环形传递 K/V 分块，每步在线 softmax 合并（需 LSE）。作为 `replace_dispatch_attention_fn` 的**装饰器**包裹内层 kernel（sage 或原生），故 `HOOK_ORDER` 中 ring 在 sage 之后。
- **内层 kernel 选择**：若内层支持 `return_lse`（sage 支持）直接复用；否则退回 `native_attention_kernel`（原生 flash 出 LSE）。**这保证了关 sage 也能跑 ring**。
- **`cp_wrappers.py` 只做 ring**：到达 wrapper 时 q/k/v 已被外置的 Ulysses scatter 过 head，故直接调 `ring_attention`，不走 diffusers `_templated_context_parallel_attention` 的 degree 路由（其 ulysses/usp 分支对 optkit 永远走不到，误走会双重 scatter 维度全错）。
- **限制**：
  - cross-mode 透传（query 已分片、kv 复制，本地算）。
  - **RegionE 不支持 Ring**：ring 的 seq-partition K/V 与 RegionE 全局 cache 算法不兼容，config 层 `__post_init__` 直接报错（只能 `ulysses_degree>1, ring_degree=1`）。
  - **已知数值漂移**：Qwen 在 ring 路径下 SSIM 偏低（ring4=0.70、u2r2=0.58，而 ulysses4=0.88），flux-kontext ring4≈ulysses4 正常 → 是 Qwen 专属 ring（RoPE/attention 处理）问题，排查中。

#### USP（Ulysses × Ring 同时 > 1）

- = 外置 Ulysses head-alltoall ∘ 内层 ring 装饰器组合而成（2D mesh `(ring, ulysses)`）。
- **限制**：USP 路径需真机 2×2 数值对比验证后方可信（代码标注 ⚠️）。

**Parallel 的全局约束**：`cp_degree (= ulysses × ring) <= world_size`，否则 config 报错；`cp_degree <= 1` 时除暴露 `ctx.parallel = self` 外不注册任何 hook（全 identity）。需外部已 `dist.init_process_group`（典型 torchrun）。

### 1.5 步级缓存 DiCache / MagCache（`components/cache/`）

- **共性**：按累积误差在降噪步上**跳块复用残差**。实现 `should_skip(idx, hidden)` + `get_skip_output(hidden)`（`CacheComponent` ABC），挂在 `should_skip_block`（布尔）/ `get_skip_output`（链式）等 hook；`on_pipeline_enter` 按实际步数 `num_steps=len(timesteps)` 校准并 reset。
- **DiCache**：probe block 输出漂移判跳。关键参数 `rel_l1_thresh`（默认 0.08）、`probe_depth`、`error_choice`。
- **MagCache**：离线标定的逐步幅度比判跳。关键参数 `magcache_thresh`、`K`、`mag_ratios`（+ CFG 时 `cfg_mag_ratios`）、`is_calibration`。
- **CFG 注意**：单次 pipeline 调用里 transformer 被 cond/uncond 各跑一次时须设 `cfg_enable=True`，否则 cnt 到 num_steps 会在推理中途 reset 清空窗口。
- **限制 / 注意**：
  - **阈值须逐任务标定**：qwen-edit 0.08 / qwen t2i 0.04 / flux2 0.04 / flux 0.08（标定过大会出马赛克）。
  - t2i 类任务对基线 SSIM 仅弱参考（无锚定，漂移地板 ~0.5），质量结论须看图 + 对 sfc 算 SSIM。
  - 与 RegionE 互斥（`cache` 字段三选一）。

### 1.6 RegionE（`components/cache/regione/`）—— 区域感知编辑加速

详见 `docs/v2-regione-design.md`、`docs/v2-regione-cp-design.md`。两个**正交**加速维度：

- **空间维（region partition）**：onestep 估计 vs 参考图 latent 算编辑区域；**edited token 逐步迭代，unedited 区域单步预测后冻结**。partition 在 scheduler 里算（latent 空间，`scheduler.py _compute_partition`）。
- **时间维（AVDCache）**：步级缓存，`cache_threshold > 0` 启用（默认 0 关闭）；gamma 由 28 步标定曲线线性插值，支持任意步数。

**三处协作**（这是 RegionE 最复杂的部分）：
1. **序列切分在 pipeline 层**：`on_denoise_step_pre` 把 `[noise|cond]` 中 noise 按 `edited_ids` 切成 edited 子集（Q 侧降维），rotary 同步切；`on_denoise_step_post` 用 `ids_scatter` 还原。`HOOK_ORDER` 中 **regione 在 parallel CP 切分之前**（regione 先切 edited，CP 再分发）。
2. **KV cache 组装在 attn 内**：`on_backend_enter`（内层，parallel 之后）。store 步存 post-rotary full K/V；partial 步从 cache 拼 full K/V（edited 位置写 partial、cond 段整体覆盖）。Q 是 edited 子集而 K/V 是 full → 等价「edited query attend 全部 token」。
3. **换 scheduler**：`on_pipe_ready` 把 scheduler 换成 `RegionEFlowMatchScheduler`，给每个 block 准备 `RegionEAttnState`（cond+uncond cache；含 single_transformer_blocks 的模型如 Flux 两段都覆盖）。

`RegionESpec` 关键参数：`num_inference_steps`、`warmup_step`(6)、`post_step`(2)、`threshold`(0.80，token_selector 相似度阈值，None=关 partition)、`cache_threshold`(0)、`erosion_dilation`、`similarity_type`(cosine)。

**限制（config `__post_init__` 强校验）**：
- `threshold` 必须显式设置；要求 `warmup_step < num_inference_steps - post_step`（否则无 partial 加速区间；flux-kontext 须 `STEPS>10`）。
- **不支持 Ring**（见 1.4）。
- **+ Ulysses 必须 `ulysses_anything=True`**（Qwen txt/img 序列不保证整除 cp_size），且 `ring_anything` 被强制关。
- **+ compile 强制 `dynamic=True`**（partial step 变长序列）。
- **适用范围**：仅序列级参考拼接的编辑 pipeline（Qwen-Edit / Qwen-Edit-Plus / FLUX.1-Kontext / FLUX.2-Klein）。t2i 无参考图、Fill 通道级条件、Inpaint mask 混合**不适用**，在 apply 时报错拦截；wan 走 cross-mode 透传不适用。
- **显存**：单卡 RegionE 大模型（Qwen 20B，1024 分辨率）32G 放不下，需四卡序列切分。

### 1.7 运行时 LoRA 热切换（`runtime/lora.py`）

- `replace_lora` / `clear_lora_cache`：在 sage/fp8/compile 之后**热切换 LoRA 权重，不触发重编译**。属运行时工具，不在 component 框架内。

---

## 2. Context 的设计（`core/context.py`）

`OptKitContext` 是 **warp ↔ component、component ↔ component 之间的稳定边界，被显式声明为「冻结契约」**——修改本类 = 契约变更，需评审。它本身**不含任何能力逻辑**，能力逻辑全在各 component 的 handler 里。设计由三部分组成。

### (a) 分发原语 —— 永久冻结，只有两个

```python
register(name, fn, *, by)          # by = 注册 component 身份，优先级查 HOOK_ORDER
trigger(name, value=None, /, **kw) -> value
```

`trigger` 是**统一 fold**：按 priority 升序遍历 handler，`new = fn(value, **kw)`，`new is not None` 即替换 value。**约定 `None` = 「不接管 / 透传」**。一条原语覆盖五种归约语义：

| 语义 | 用法 |
| --- | --- |
| 通知 | handler 做副作用、返回 None（value 透传） |
| 链式 | handler 返回新 value |
| 布尔 | 种子 False，handler 返回 True/None（如 `should_skip_block`） |
| 短路 | 种子 None，首个返回非 None 的 handler 接管（如 `on_denoise_forward_pre`） |
| compose | value 是函数，后注册 handler replace/decorate 前一个（如 `replace_dispatch_attention_fn`：sage replace、ring decorate） |

handler 统一签名 `fn(value, **kw) -> new | None`。

### (b) 命名生命周期糖 —— 冻结目录，每个都是一行 `trigger` 包装

严禁在这些方法体内写能力逻辑。两级：

- **transformer 级**：`on_transformer_enter` / `cache_before_blocks` / `cache_after_blocks` / `on_transformer_exit` / `cp_split_blocks` / `cp_gather_blocks` / `on_attn_processor_enter` / `on_backend_enter` / `on_backend_exit` / `on_attn_processor_exit`。
- **pipeline 级**：`on_pipeline_enter` / `on_denoise_loop_enter` / `on_denoise_step_pre` / `on_denoise_step_post` / `on_denoise_loop_exit` / `on_pipeline_exit`。

warp 在对应位置经 `trigger` 发出 hook，component 在 `attach` 里 `register` 对应 handler——**warp 不知道有哪些 component，component 不知道是哪个模型**，二者只通过 hook 名 + value/kw 契约耦合。

### (c) 跨 component 共享事实 —— 只用「活跃 component 引用」，不另设 dict

Context 只持有两个跨组件引用槽（未启用 = None）：

```python
ctx.regione    # RegionEComponent | None —— 持 manager / attn cache / region_mode
ctx.parallel   # ParallelComponent | None —— 持 cp_group / dispatcher / mesh
```

事实就是各 component 的成员变量，owning component 写、任意 component 读，例如 dicache 读 `ctx.parallel.cp_group` 做 CP-aware reduce、读 `ctx.regione.region_mode` 判模式。一般 leaf 优化（sage/quant/compile）无人读取，不设槽。**新增引用槽 = 契约变更**。

其余允许的状态：`rank / world_size / device`（环境身份，构造时定）+ `_current_block_idx`（warp 内 forward ↔ attn processor 的迭代游标，选 per-block KV cache 槽）。**任何模型特定知识**（rotary 结构 / txt pad / 编辑区域切分）**严禁进入 Context**；跨 hook 的中间状态由 handler 自身实例持有。

### 顺序事实源：`core/order.py`

为什么不用全局优先级数字？因为**同两个 component 在不同 hook 需要相反顺序**：

- `on_denoise_step_pre`：regione 先切 edited、parallel 后切 1/cp；
- `on_denoise_step_post`：parallel 先 gather（unwind）、regione 后 restore。

单一全局数字无法表达「此处 A 先、彼处 B 先」。故顺序事实源放在**注册点一侧**：`HOOK_ORDER[hook] = (Comp.X, Comp.Y, ...)` 显式列出参与者顺序，component 注册时只报自己名字（`by=self.name`），优先级 = 名字在元组里的下标。**未登记的 `(注册点, component)` 直接报错**（`hook_priority` 抛 KeyError/ValueError）。改顺序只动 `order.py` 这一个文件。

### 延迟 pipe 变换到 `on_pipe_ready`

顺序敏感的活儿（quant 改权重 → compile 编 graph → regione 换 scheduler）**延迟到 warp 替换完 forward 之后**统一执行：各 component 在 `attach` 里把变换函数注册到 `on_pipe_ready`，`apply.py` 在 `warp_fn` 之后触发，按 `HOOK_ORDER["on_pipe_ready"] = (QUANT, COMPILE, REGIONE)` fold。**这样 attach 顺序就完全无所谓了**（跨组件引用也只在 runtime handler 里读，那时已全 attach 完）。

---

## 3. 已实现且支持的模型 pipeline

warp 分两层（`warps/`）：
- **transformer 级**（`warps/transformers/`）：替换 `transformer.forward` + attn processor。按 diffusers transformer 模型一文件：`transformer_flux` / `transformer_flux2` / `transformer_qwenimage` / `transformer_wan` / `transformer_wan_vace`。
- **pipeline 级**（`warps/pipelines/`）：镜像 `__call__` + 以 **pipeline 类名**注册到 `_registry`（import 即注册，见 `optkit_v2/__init__.py` 末尾的副作用 import）。

`apply_warp` 按 `type(pipe).__mro__` 类名解析，无需手传 warp 名。已注册的 11 个 pipeline：

| 模型族 | Pipeline 类名 | 文件 | 任务 | RegionE 适用 |
| --- | --- | --- | --- | --- |
| Qwen-Image | `QwenImagePipeline` | `pipeline_qwenimage.py` | t2i 文生图 | 否（无参考图） |
| Qwen-Image-Edit | `QwenImageEditPipeline` | `pipeline_qwenimage_edit.py` | 单图编辑 | 是 |
| Qwen-Image-Edit-2509 | `QwenImageEditPlusPipeline` | `pipeline_qwenimage_edit_plus.py` | Plus 多图编辑 | 是（实测 u4+regione 8.36×） |
| FLUX.1 | `FluxPipeline` | `pipeline_flux.py` | t2i 文生图 | 否 |
| FLUX.1-Kontext | `FluxKontextPipeline` | `pipeline_flux_kontext.py` | 参考编辑 | 是 |
| FLUX.1-Fill | `FluxFillPipeline` | `pipeline_flux_fill.py` | 通道级条件填充 | 否（通道条件） |
| FLUX.1-Inpaint | `FluxInpaintPipeline` | `pipeline_flux_inpaint.py` | mask 重绘 | 否（mask 混合） |
| FLUX.2-Klein | `Flux2KleinPipeline` | `pipeline_flux2_klein.py` | 编辑 | 是 |
| Wan | `WanPipeline` | `pipeline_wan.py` | t2v 文生视频 | 否（cross 透传） |
| Wan-I2V | `WanImageToVideoPipeline` | `pipeline_wan_i2v.py` | 图生视频 | 否 |
| Wan-VACE | `WanVACEPipeline` | `pipeline_wan_vace.py` | VACE 控制生成 | 否 |

**成熟度说明**：
- Qwen / FLUX 系（t2i / 编辑 / Fill / Inpaint / Kontext / FLUX2-Klein）均已在 4×RTX5090 全矩阵实跑验证（baseline / sage+fp8+compile / +dicache / ulysses4），稳态零重编。
- Wan t2v/ti2v/VACE 部分路径标注「盲写，待真实权重验证」（M4 收口项）。
- 已知遗留：**Qwen t2i + ulysses4 + true CFG → latent NaN 全黑图**，触发条件为 CFG 两分支 txt 长度不一致；规避：负 prompt embeds pad 到同长，或 `true_cfg_scale=1.0`。Qwen edit 系不受影响。

---

## 4. 新增一个 pipeline 的最小路径

1. `warps/transformers/transformer_xxx.py`：写 `warp_transformer_xxx`，替换 `forward`（在正确位置发 `cp_split_blocks` / `cache_*` / `on_backend_*` 等 hook）+ attn processor。
2. `warps/pipelines/pipeline_xxx.py`：镜像 `__call__`（发 pipeline 级 hook），用 `@register_warp("XxxPipeline")` 注册。
3. 在 `optkit_v2/__init__.py` 末尾加副作用 import 触发注册。
4. 若新增 hook 注册点或新参与 component，必须在 `core/order.py` 的 `HOOK_ORDER` 显式登记，否则 `register` 报错。

> 关键纪律：**新模型只写 warp，不碰 component；改 Context / order.py 即契约变更，需评审。**
