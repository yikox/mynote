---
format: arch-module/v0.1
name: FLUX warp warp-flux
described: FLUX.1 系模型侧适配（t2i / Kontext / Fill / Inpaint）
module_form: atomic
module_kind: adapter-io
main_subject: warp_transformer_flux
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/warps/transformers/transformer_flux.py
  - optkit_v2/warps/pipelines/pipeline_flux.py
  - optkit_v2/warps/pipelines/pipeline_flux_fill.py
  - optkit_v2/warps/pipelines/pipeline_flux_inpaint.py
  - optkit_v2/warps/pipelines/pipeline_flux_kontext.py
---

# 模块：FLUX warp（warp-flux）

- 状态：accepted（全矩阵实跑，稳态零重编）
- 代码：`optkit_v2/warps/transformers/transformer_flux.py`、`optkit_v2/warps/pipelines/pipeline_flux{,_kontext,_fill,_inpaint}.py`
- 上游：[warps](warps.md)（复合父模块）

## 职责

FLUX.1 系模型侧适配：替换 `transformer.forward` + attn processor，镜像各 pipeline `__call__` 并注册。

## 已注册 pipeline

| Pipeline 类名 | 任务 | RegionE 适用 |
| --- | --- | --- |
| `FluxPipeline` | t2i 文生图 | 否 |
| `FluxKontextPipeline` | 参考编辑 | 是 |
| `FluxFillPipeline` | 通道级条件填充 | 否（通道条件） |
| `FluxInpaintPipeline` | mask 重绘 | 否（mask 混合） |

## 发出的 hook

`replace_dispatch_attention_fn`（attn_mode=self）、`should_skip_block`/`get_skip_output`（cache）、`cp_split_blocks`/`cp_gather_blocks`（CP）、`on_backend_*`。含 `single_transformer_blocks`，全局 block idx 双段连续。

## Review Notes

- Review status: not-reviewed
