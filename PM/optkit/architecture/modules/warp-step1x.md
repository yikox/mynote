---
format: arch-module/v0.1
name: Step1X-Edit warp warp-step1x
described: Step1X-Edit 模型侧适配（base 与 v1p2 共用 transformer）
module_form: atomic
module_kind: adapter-io
main_subject: warp_transformer_step1x_edit
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/warps/transformers/transformer_step1x_edit.py
  - optkit_v2/warps/pipelines/pipeline_step1x_edit*.py
---

# 模块：Step1X-Edit warp（warp-step1x）

- 状态：accepted（全矩阵实跑，稳态零重编）
- 代码：`optkit_v2/warps/transformers/transformer_step1x_edit.py`、`optkit_v2/warps/pipelines/pipeline_step1x_edit{,_v1p2}.py`
- 上游：[warps](warps.md)（复合父模块）
- 特殊：基于**独立 diffusers fork**。

## 职责

Step1X-Edit 参考编辑 pipeline 的模型侧适配。base 与 v1p2 **共用同一 transformer 类**（1 transformer 文件 / 2 pipeline）。

## 已注册 pipeline

| Pipeline 类名 | 任务 | RegionE 适用 |
| --- | --- | --- |
| `Step1XEditPipeline` | 参考编辑 | 是 |
| `Step1XEditPipelineV1P2` | 参考编辑 | 是 |

## 发出的 hook

`replace_dispatch_attention_fn`（attn_mode=self）、`should_skip_block`/`get_skip_output`、`cp_split_blocks`/`cp_gather_blocks`、`on_backend_*`。含双段 block（transformer + single）。

## 并行

经 optkit_v2 **warp-based CP**（非 diffusers `_cp_plan`）支持 ulysses/ring（`supports_parallel=True`）。

## Review Notes

- Review status: not-reviewed
