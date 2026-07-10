---
format: arch-module/v0.1
name: SageAttention sage
described: 把注意力后端整体替换为 SageAttention 量化 kernel
module_form: atomic
module_kind: function-flow
main_subject: SageComponent
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/components/sage/**
---

# 模块：SageAttention（sage）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/components/sage/`（`component.py`、`backend.py`）
- 上游：[optimization-components](optimization-components.md)（复合父模块）

## 职责

把 attention 后端整体换成 SageAttention kernel（INT8/FP8 量化注意力）。**不替换 attn processor**（processor 由 warp 负责）。

## 注册的 hook / 契约

- 注册 `replace_dispatch_attention_fn`（`_use_sage`）：以 diffusers `dispatch_attention_fn` 为种子，**replace 整个 dispatch → `sage_kernel`**。
- 与 ring 的顺序：`HOOK_ORDER["replace_dispatch_attention_fn"] = (SAGE, PARALLEL)` —— sage 先 replace、ring 再 decorate 包裹，ring 循环的内层 kernel 即 sage 替换后的函数（保留 sage 加速）。

## 约束

- 需安装 `sageattention`，否则 `attach` 直接 `RuntimeError`。
- sage kernel 支持 `return_lse`（ring 在线 softmax 依赖）；关 sage 走 ring 时退回 `native_attention_kernel` 出 LSE。

## Review Notes

- Review status: not-reviewed
