---
format: arch-module/v0.1
name: DiCache dicache
described: probe block 输出漂移判跳，跳块复用残差
module_form: atomic
module_kind: function-flow
main_subject: DiCacheComponent
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/components/cache/dicache.py
---

# 模块：DiCache（dicache）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/components/cache/dicache.py`（共享基类 `base.py::CacheComponent`）
- 上游：[cache](cache.md)（复合父模块）

## 职责

按累积误差在降噪步上**跳块复用残差**。probe block 输出漂移判跳：跑 `probe_depth` 个 block → `should_skip(idx, hidden)` 决定是否跳剩余 block → 跳时用残差外推。

## 注册的 hook / 契约

- `on_pipeline_enter`：按实际步数 `num_steps=len(timesteps)` 校准并 reset。
- `on_transformer_enter/exit`、`cache_before_blocks`/`cache_after_blocks`。
- `should_skip_block`（布尔，`CacheComponent` 契约）/ `get_skip_output`（链式）。

## 关键参数

- `rel_l1_thresh`（默认 0.08）、`probe_depth`、`error_choice`。

## 约束

- **CFG 注意**：transformer 被 cond/uncond 各跑一次时须设 `cfg_enable=True`，否则 cnt 到 num_steps 会在推理中途 reset。
- 阈值须逐任务标定（qwen-edit 0.08 / qwen t2i 0.04 / flux2 0.04 / flux 0.08）；t2i 类任务对基线 SSIM 仅弱参考。
- 与 magcache / regione 互斥（cache 三选一）。

## Review Notes

- Review status: not-reviewed
