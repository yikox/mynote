---
format: arch-module/v0.1
name: Wan warp warp-wan
described: Wan 视频系模型侧适配（t2v / i2v / VACE）
module_form: atomic
module_kind: adapter-io
main_subject: warp_transformer_wan
status: draft
review_status: not-reviewed
code_paths:
  - optkit_v2/warps/transformers/transformer_wan.py
  - optkit_v2/warps/transformers/transformer_wan_vace.py
  - optkit_v2/warps/pipelines/pipeline_wan*.py
---

# 模块：Wan warp（warp-wan）

- 状态：draft（部分路径「盲写」，待真实权重验证 —— M4 收口项）
- 代码：`optkit_v2/warps/transformers/transformer_wan.py`、`transformer_wan_vace.py`、`optkit_v2/warps/pipelines/pipeline_wan{,_i2v,_vace}.py`
- 上游：[warps](warps.md)（复合父模块）

## 职责

Wan 视频扩散系模型侧适配。5D 视频输入在 transformer 内 patch 后才 tokenize；文本走**交叉注意力**（cross-mode，CP/ring 透传，不做通信）。

## 已注册 pipeline

| Pipeline 类名 | 任务 | RegionE 适用 |
| --- | --- | --- |
| `WanPipeline` | t2v 文生视频 | 否（cross 透传） |
| `WanImageToVideoPipeline` | 图生视频 | 否 |
| `WanVACEPipeline` | VACE 控制生成 | 否 |

## 发出的 hook

`replace_dispatch_attention_fn`（**分 self / cross 两种 attn_mode**，cross 透传）、`should_skip_block`/`get_skip_output`、`cp_split_blocks`/`cp_gather_blocks`（wan 不传 encoder，文本复制走交叉注意力）、`on_backend_*`。

## 约束 / 待验证

- t2v/ti2v/VACE 部分路径真实权重下可能产图错误，需补权重验证（M4）。
- A14B 双专家 fp8 常驻 ~26G，四卡 OOM（CP 切序列不切权重）；需 ≥48G 卡或对双专家做权重切分，单卡可用。
- TI2V-5B i2v 花屏为 diffusers 0.38 原生缺陷（非 optkit）；wan-i2v 测试机缺 `ftfy` 未跑通。

## Review Notes

- Review status: not-reviewed
