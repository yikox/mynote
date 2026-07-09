---
format: arch-module/v0.1
name: FLUX.2 warp warp-flux2
described: FLUX.2-Klein 模型侧适配
module_form: atomic
module_kind: adapter-io
main_subject: warp_transformer_flux2
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/warps/transformers/transformer_flux2.py
  - optkit_v2/warps/pipelines/pipeline_flux2_klein.py
---

# 模块：FLUX.2 warp（warp-flux2）

- 状态：accepted（全矩阵实跑，稳态零重编）
- 代码：`optkit_v2/warps/transformers/transformer_flux2.py`、`optkit_v2/warps/pipelines/pipeline_flux2_klein.py`
- 上游：[warps](warps.md)（复合父模块）

## 职责

FLUX.2-Klein 编辑 pipeline 的模型侧适配。

## 已注册 pipeline

| Pipeline 类名 | 任务 | RegionE 适用 |
| --- | --- | --- |
| `Flux2KleinPipeline` | 编辑 | 是（实测 +dicache 3.43×） |

## 发出的 hook

`replace_dispatch_attention_fn`（attn_mode=self）、`should_skip_block`/`get_skip_output`、`cp_split_blocks`/`cp_gather_blocks`、`on_backend_*`。含双段 block（transformer + single）。

## Review Notes

- Review status: not-reviewed
