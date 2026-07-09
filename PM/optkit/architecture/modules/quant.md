---
format: arch-module/v0.1
name: 量化 quant
described: 基于 torchao 的 FP8/INT8 transformer 权重量化
module_form: atomic
module_kind: function-flow
main_subject: QuantComponent
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/components/quant/**
---

# 模块：量化（quant）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/components/quant/`（`component.py`、`backend.py`）
- 上游：[optimization-components](optimization-components.md)（复合父模块）

## 职责

基于 torchao 对 transformer 权重做 FP8/INT8 量化，缩小常驻显存。`dtype` 支持 `float8/fp8/int8` 及各自 `_weight_only` 变体。

## 注册的 hook / 契约

- pipe 变换（改权重），注册 `on_pipe_ready`（`_apply`）。
- 顺序：`HOOK_ORDER["on_pipe_ready"] = (QUANT, COMPILE, REGIONE)` —— **量化早于 compile**（compile 编的是已量化权重）。
- 双 transformer 模型：`transformer` 与 `transformer_2`（Wan2.2 A14B 双专家）都量化；单 transformer 模型 `transformer_2=None` 自动跳过。

## 关键参数

- `auto_skip`（默认 True）：按类名查 skip 表，跳过 `norm_out / proj_out / time_embed / x_embedder / lora` 等关键模块；设 False 只跳 `lora_A/lora_B`（易踩坑，不推荐）。

## 约束 / 已知缺陷

- transformer **不做 cpu-offload**（torchao 量化张量与 accelerate 跨设备不兼容）。
- **qwen t2i + ulysses4 + true CFG → latent NaN**：根因 = per-tensor fp8 动态激活量化在 CFG 两分支 txt 长度不一致时小切片 amax 退化；规避：负 prompt pad 同长 / `true_cfg_scale=1.0`。详见 `../bugs/`。

## Review Notes

- Review status: not-reviewed
