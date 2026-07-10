---
format: arch-module/v0.1
name: LoRA 热切换 lora
described: 运行时 LoRA 权重热切换，不触发重编译
module_form: atomic
module_kind: interface-object
main_subject: replace_lora()
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/runtime/**
---

# 模块：LoRA 热切换（lora）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/runtime/lora.py`
- 上游：[optimization-components](optimization-components.md)（复合父模块）

## 职责

`replace_lora` / `clear_lora_cache`：在 sage/fp8/compile 之后**热切换 LoRA 权重，不触发重编译**。

## 对外接口

- `replace_lora(...)`：运行时替换 transformer 上的 LoRA 权重。
- `clear_lora_cache(...)`：清理 LoRA 缓存。

## 特殊性

- **不在 component 框架内**：无 `Spec`、无 `attach`、无 hook 注册；是 apply 之后调用的运行时工具。放在 optimization-components 复合模块下是按「能力归类」，非按 hook 组件归类。

## 约束

- 必须在 sage/fp8/compile 之后调用，才能享受「不重编」的热切换。

## Review Notes

- Review status: not-reviewed
