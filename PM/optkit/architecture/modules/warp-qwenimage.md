---
format: arch-module/v0.1
name: Qwen-Image warp warp-qwenimage
described: Qwen-Image 系模型侧适配（t2i / Edit / Edit-Plus）
module_form: atomic
module_kind: adapter-io
main_subject: warp_transformer_qwenimage
status: accepted
review_status: not-reviewed
code_paths:
  - optkit_v2/warps/transformers/transformer_qwenimage.py
  - optkit_v2/warps/pipelines/pipeline_qwenimage*.py
---

# 模块：Qwen-Image warp（warp-qwenimage）

- 状态：accepted（编辑系全矩阵实跑；t2i 有已知 CFG NaN 遗留）
- 代码：`optkit_v2/warps/transformers/transformer_qwenimage.py`、`optkit_v2/warps/pipelines/pipeline_qwenimage{,_edit,_edit_plus}.py`
- 上游：[warps](warps.md)（复合父模块）

## 职责

Qwen-Image 系模型侧适配：单流 block 结构（无 single_transformer_blocks）。

## 已注册 pipeline

| Pipeline 类名 | 任务 | RegionE 适用 |
| --- | --- | --- |
| `QwenImagePipeline` | t2i 文生图 | 否（无参考图） |
| `QwenImageEditPipeline` | 单图编辑 | 是 |
| `QwenImageEditPlusPipeline` | Plus 多图编辑 | 是（实测 u4+regione 8.36×，SSIM 0.90） |

## 发出的 hook

`replace_dispatch_attention_fn`（attn_mode=self）、`should_skip_block`/`get_skip_output`、`cp_split_blocks`/`cp_gather_blocks`、`on_backend_*`。

## 已知遗留

**Qwen t2i + ulysses4 + true CFG → latent NaN 全黑图**：根因在 [quant](quant.md)（fp8 动态激活量化 CFG 两分支不等长退化），非 warp 本身；qwen edit 系不受影响。规避见 quant 文档。

## Review Notes

- Review status: not-reviewed
