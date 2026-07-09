---
format: arch-module/v0.1
name: 缓存 cache
described: 步级/区域缓存复合模块：dicache·magcache·regione 三选一互斥
module_form: composite
main_subject: components/cache/
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/components/cache/__init__.py
  - optkit_v2/components/cache/base.py
module_kind: data-state
---

# 模块：缓存（cache）· 复合

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/components/cache/`
- 上游：[optimization-components](optimization-components.md)（复合父模块）

## 1. 模块定位

在**降噪步维度**做加速的能力集合。三种缓存策略从 `OptKitConfig.cache` 字段**三选一互斥**（类型上构造不出同时开两个）：dicache/magcache 是「步级跳块复用」，regione 是「区域感知编辑加速」。共享基类 `CacheComponent`（`base.py`）定义 `should_skip` / `get_skip_output` 契约。

## 2. 子模块清单

| 子模块 | module_kind | 代码 | 职责摘要 | 文档 |
| --- | --- | --- | --- | --- |
| dicache | function-flow | `components/cache/dicache.py` | probe block 输出漂移判跳，跳块复用残差 | [dicache](dicache.md) |
| magcache | function-flow | `components/cache/magcache.py` | 离线标定逐步幅度比判跳 | [magcache](magcache.md) |
| regione | function-flow | `components/cache/regione/` | 区域感知编辑加速（空间 partition + 时间 AVDCache） | [regione](regione.md) |

> 共享：`base.py` 提供 `CacheComponent` ABC（dicache/magcache 继承）；regione 因复杂度独立成子包，另有 `on_backend_enter`/`on_denoise_step_*` 等更深协作。

## 3. 组合边界

- **对外**：三子模块各由 `DiCacheSpec` / `MagCacheSpec` / `RegionESpec` 启用，互斥由 `OptKitConfig.__post_init__` 强校验。
- dicache/magcache 注册同一组 hook：`on_pipeline_enter`（按实际步数 `num_steps=len(timesteps)` 校准 reset）、`on_transformer_enter/exit`、`cache_before_blocks`/`cache_after_blocks`、`should_skip_block`（布尔）/`get_skip_output`（链式）。
- regione 注册更广：`on_pipe_ready`（换 scheduler）、`on_pipeline_enter`、`on_denoise_step_pre/post`、`on_denoise_forward_pre/post`、`on_backend_enter`（KV 组装，与 parallel 顺序协作）。

## 4. 约束

- **三选一互斥**：dicache / magcache / regione 不能同时启用。
- 阈值须逐任务标定（dicache：qwen-edit 0.08 / qwen t2i 0.04 / flux2 0.04 / flux 0.08）。
- regione 仅适用序列级参考拼接的编辑 pipeline；t2i / Fill / Inpaint 在 apply 时报错拦截。

## 5. 演进规则

新增一种缓存策略 = 新增一个子模块 + 一个互斥 `Spec`，并在 `HOOK_ORDER` 登记其注册点。

## Review Notes

- Review status: not-reviewed
