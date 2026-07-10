---
format: arch-module/v0.1
name: 评估工具 eval
described: 性能 profiling 与画质度量的独立工具集，不参与优化装配
module_form: atomic
module_kind: utility-support
main_subject: ProfileSession + QualityMetric
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/eval/**
---

# 模块：评估工具（eval）

- 状态：accepted（当前已落地基线）
- 代码：`optkit_v2/eval/`（`profiling.py`、`quality.py`）
- 上游：[main-design](../main-design.md)

## 模块定位

优化效果的**评估工具集**：性能打点 + 画质度量。它是旁路工具——不注册 hook、不参与 `apply_warp` 装配、不依赖 Context/HOOK_ORDER，对被测 pipeline 是否经过 optkit 优化无感知。

## 能力分组

| 能力 | 文件 | 说明 |
| --- | --- | --- |
| 性能 profiling | `profiling.py` | `annotate_pipeline(pipe)` 给 pipeline / transformer block 注入 `torch.profiler.record_function` 打点（经 forward hook，兼容 torch.compile）；`ProfileSession` 包一段推理产出 trace |
| 画质度量 | `quality.py` | `QualityMetric`：PSNR / SSIM / LPIPS 基线-优化结果对比 |

## 对外接口

- `from optkit_v2.eval import annotate_pipeline, ProfileSession`（包 `__init__` 显式导出）。
- `QualityMetric` 从 `optkit_v2.eval.quality` 直接 import（含重依赖，见约束）。

## 依赖限制

- 不允许依赖 `core/`、`components/`、`warps/`（保持旁路工具地位，避免评估代码反向耦合框架）。
- `quality.py` 依赖 `cv2 / skimage / lpips`，这些是**评估侧可选重依赖**，故包 `__init__` 只导出 profiling 侧，避免生产环境 import optkit_v2.eval 即拉起 lpips。

## 验证方式

- `examples/v2/qwenimage_t2i_full_opt_profiler.py`：profiling 实跑示例（trace 产出 + 各阶段耗时）。
- 画质度量：等价回归对比中 PSNR>50dB 判定（见 PM 测试记录）。
