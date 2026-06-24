# 模块：优化组件（optimization-components）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/components/{sage,quant,compile,cache}`、`optkit_v2/runtime/lora.py`
- 上游：[main-design](../main-design.md)；相关：[parallel](parallel.md)、[regione](regione.md)

本模块收纳「叶子型 / 轻协作」优化能力。序列并行（parallel）与区域感知编辑（regione）因复杂度独立成模块。

## 1. SageAttention（components/sage/）—— 注意力后端替换

- **做什么**：把 attention 后端整体换成 SageAttention kernel（INT8/FP8 量化注意力），不替换 attn processor（processor 由 warp 负责）。
- **怎么接**：注册到 `replace_dispatch_attention_fn`，以 diffusers `dispatch_attention_fn` 为种子，sage handler **replace** 整个 dispatch → `sage_kernel`。
- **与 Ring 的关系**：`HOOK_ORDER["replace_dispatch_attention_fn"] = (SAGE, PARALLEL)`，sage 先 replace、ring 再 decorate（包裹）→ **sage 与 ring 是包裹关系**，ring 循环的内层 kernel 用的就是 sage 替换后的函数（保留 sage 加速）。
- **限制**：需安装 `sageattention`，否则 `attach` 直接 `RuntimeError`；sage kernel 支持 `return_lse`（ring 在线 softmax 依赖），关 sage 走 ring 时退回 `native_attention_kernel` 出 LSE。

## 2. 量化 Quant（components/quant/）—— FP8/INT8 权重量化

- **做什么**：基于 torchao 对 transformer 权重做 FP8/INT8 量化，缩小常驻显存。`dtype` 支持 `float8/fp8/int8` 及各自 `_weight_only` 变体。
- **怎么接**：pipe 变换（改权重），注册到 `on_pipe_ready`；`HOOK_ORDER["on_pipe_ready"] = (QUANT, COMPILE, REGIONE)`，**量化早于 compile**。
- **双 transformer 模型**：`transformer` 与 `transformer_2`（Wan2.2 A14B 双专家）都量化；单 transformer 模型 `transformer_2=None` 自动跳过。
- **`auto_skip`（默认 True）**：按类名查 skip 表，跳过 `norm_out / proj_out / time_embed / x_embedder / lora` 等关键模块；设 False 只跳 `lora_A/lora_B`（易踩坑，不推荐）。
- **限制**：transformer **不做 cpu-offload**（torchao 量化张量与 accelerate 跨设备不兼容）。
- **已知缺陷**：qwen t2i + ulysses4 + true CFG → latent NaN（根因=per-tensor fp8 动态激活量化在 CFG 两分支 txt 长度不一致时小切片 amax 退化；规避：负 prompt pad 同长 / `true_cfg_scale=1.0`），详见 `../bugs/`。

## 3. torch.compile（components/compile/）—— 区域编译

- **做什么**：**逐 block 编译**（`block.compile()`）而非整图，避免变长序列/分支反复重编。覆盖 `transformer_blocks / single_transformer_blocks / blocks / vace_blocks`。
- **怎么接**：pipe 变换，注册到 `on_pipe_ready`，晚于 quant、早于 regione 换 scheduler。
- **关键设置**：`cache_size_limit = 10000`；`allow_unspec_int_on_nn_module = True`（block 序号不被特化，同构 block 共用一份 graph）；产物缓存默认 `/app/cache/torch_inductor`。
- **限制**：**必须跑两遍**（第二遍才是稳态计时）；warmup 内仍有重编（fp8 权重 guard + CFG cond/uncond 两种序列长），run2 起稳态零重编；RegionE + compile 强制 `dynamic=True`。

## 4. 步级缓存 DiCache / MagCache（components/cache/）

- **共性**：按累积误差在降噪步上**跳块复用残差**。实现 `should_skip(idx, hidden)` + `get_skip_output(hidden)`（`CacheComponent` ABC，`base.py`），挂在 `should_skip_block`（布尔）/ `get_skip_output`（链式）；`on_pipeline_enter` 按实际步数 `num_steps=len(timesteps)` 校准并 reset。
- **DiCache**（`dicache.py`）：probe block 输出漂移判跳。关键参数 `rel_l1_thresh`（默认 0.08）、`probe_depth`、`error_choice`。
- **MagCache**（`magcache.py`）：离线标定逐步幅度比判跳。关键参数 `magcache_thresh`、`K`、`mag_ratios`（+CFG 时 `cfg_mag_ratios`）、`is_calibration`。
- **CFG 注意**：transformer 被 cond/uncond 各跑一次时须设 `cfg_enable=True`，否则 cnt 到 num_steps 会在推理中途 reset。
- **限制**：阈值须逐任务标定（qwen-edit 0.08 / qwen t2i 0.04 / flux2 0.04 / flux 0.08）；t2i 类任务对基线 SSIM 仅弱参考；与 RegionE 互斥（`cache` 三选一）。

## 5. 运行时 LoRA 热切换（runtime/lora.py）

- `replace_lora` / `clear_lora_cache`：在 sage/fp8/compile 之后**热切换 LoRA 权重，不触发重编译**。属运行时工具，**不在 component 框架内**（无 attach / hook）。

## 6. 依赖

torch、torchao、`sageattention`（可选，sage 必需）、diffusers `dispatch_attention_fn`。
