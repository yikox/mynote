---
format: arch-module/v0.1
name: 区域编译 compile
described: 逐 block 的 torch.compile，避免变长序列反复重编
module_form: atomic
module_kind: function-flow
main_subject: CompileComponent
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/components/compile/**
---

# 模块：区域编译（compile）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/components/compile/`（`component.py`、`backend.py`）
- 上游：[optimization-components](optimization-components.md)（复合父模块）

## 职责

**逐 block 编译**（`block.compile()`）而非整图，避免变长序列/分支反复重编。覆盖 `transformer_blocks / single_transformer_blocks / blocks / vace_blocks`。

## 注册的 hook / 契约

- pipe 变换，注册 `on_pipe_ready`；晚于 quant、早于 regione 换 scheduler（`(QUANT, COMPILE, REGIONE)`）。

## 关键设置

- `cache_size_limit = 10000`。
- `allow_unspec_int_on_nn_module = True`（block 序号不被特化，同构 block 共用一份 graph）。
- 产物缓存默认 `/app/cache/torch_inductor`。

## 约束

- **必须跑两遍**（第二遍才是稳态计时）：warmup 内仍有重编（fp8 权重 guard + CFG cond/uncond 两种序列长），run2 起稳态零重编。
- RegionE + compile 强制 `dynamic=True`。

## Review Notes

- Review status: not-reviewed
