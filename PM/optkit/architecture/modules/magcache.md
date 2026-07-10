---
format: arch-module/v0.1
name: MagCache magcache
described: 离线标定逐步幅度比判跳
module_form: atomic
module_kind: function-flow
main_subject: MagCacheComponent
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/components/cache/magcache.py
---

# 模块：MagCache（magcache）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/components/cache/magcache.py`（共享基类 `base.py::CacheComponent`）
- 上游：[cache](cache.md)（复合父模块）

## 职责

按累积误差在降噪步上**跳块复用残差**（与 dicache 同基类、同 hook 契约）。判跳依据是**离线标定的逐步幅度比**（magnitude ratio），而非在线 probe。

## 注册的 hook / 契约

- 与 dicache 相同一组：`on_pipeline_enter`（按实际步数校准 reset）、`on_transformer_enter/exit`、`cache_before_blocks`/`cache_after_blocks`、`should_skip_block` / `get_skip_output`。

## 关键参数

- `magcache_thresh`、`K`、`mag_ratios`（+CFG 时 `cfg_mag_ratios`）、`is_calibration`（标定模式）。

## 约束

- 需先离线标定 `mag_ratios`；CFG 场景须提供 `cfg_mag_ratios` 并设 `cfg_enable=True`。
- 与 dicache / regione 互斥（cache 三选一）。

## Review Notes

- Review status: not-reviewed
