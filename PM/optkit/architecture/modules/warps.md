# 模块：模型 warp（warps）

- 状态：accepted（Qwen/FLUX/Step1X 系已全矩阵实跑；LTX2 双流 warp 与组合并行已实跑；Wan 部分路径待真实权重验证）
- 代码：`optkit_v2/warps/transformers/`、`optkit_v2/warps/pipelines/`、`optkit_v2/warps/{_registry,_attach}.py`
- 上游：[main-design](../main-design.md)

## 1. 职责与边界

模型侧适配层：把 diffusers pipeline/transformer 的 `forward` / `__call__` 镜像替换，在正确位置发 hook，让 component 能挂上。**warp 不知道有哪些 component**，只经 hook 名 + value/kw 契约与框架耦合。

两层：
- **transformer 级**（`warps/transformers/`）：替换 `transformer.forward` + attn processor。按 diffusers transformer 模型一文件：`transformer_flux` / `transformer_flux2` / `transformer_qwenimage` / `transformer_wan` / `transformer_wan_vace` / `transformer_step1x_edit` / `transformer_ltx2`。
- **pipeline 级**（`warps/pipelines/`）：镜像 `__call__` + 以 **pipeline 类名**注册到 `_registry`（import 即注册，见 `optkit_v2/__init__.py` 末尾副作用 import）。

`apply_warp` 按 `type(pipe).__mro__` 类名解析，无需手传 warp 名。

## 2. 已注册 pipeline（14 个）

| 模型族 | Pipeline 类名 | 任务 | RegionE 适用 |
| --- | --- | --- | --- |
| Qwen-Image | `QwenImagePipeline` | t2i 文生图 | 否（无参考图） |
| Qwen-Image-Edit | `QwenImageEditPipeline` | 单图编辑 | 是 |
| Qwen-Image-Edit-2509 | `QwenImageEditPlusPipeline` | Plus 多图编辑 | 是（实测 u4+regione 8.36×） |
| FLUX.1 | `FluxPipeline` | t2i 文生图 | 否 |
| FLUX.1-Kontext | `FluxKontextPipeline` | 参考编辑 | 是 |
| FLUX.1-Fill | `FluxFillPipeline` | 通道级条件填充 | 否（通道条件） |
| FLUX.1-Inpaint | `FluxInpaintPipeline` | mask 重绘 | 否（mask 混合） |
| FLUX.2-Klein | `Flux2KleinPipeline` | 编辑 | 是 |
| Step1X-Edit | `Step1XEditPipeline` | 参考编辑 | 是 |
| Step1X-Edit v1p2 | `Step1XEditPipelineV1P2` | 参考编辑 | 是 |
| Wan | `WanPipeline` | t2v 文生视频 | 否（cross 透传） |
| Wan-I2V | `WanImageToVideoPipeline` | 图生视频 | 否 |
| Wan-VACE | `WanVACEPipeline` | VACE 控制生成 | 否 |
| LTX2 | `LTX2Pipeline` | video + audio 联合生成 | 否；只切 video，audio/text 复制 |

> Step1X-Edit base 与 v1p2 共用同一 transformer 类（1 transformer 文件 / 2 pipeline），基于独立 diffusers fork。

## 3. 成熟度

- Qwen / FLUX 系（t2i / 编辑 / Fill / Inpaint / Kontext / FLUX2-Klein）+ Step1X-Edit 均已在 4×RTX5090 全矩阵实跑（baseline / sage+fp8+compile / +dicache / ulysses4），稳态零重编。
- LTX2 已完成基础 sage/fp8/compile、只切 video 的 Ulysses、双流 DiCache，以及纯 Ring / Ring + Ulysses 组合实跑。`u2/r2` 逐帧视频与音频数值门禁通过（主观听音未验收）；默认 FP8 + Sage 组合下纯 Ring `u1/r2` 仍有音频数值漂移风险，Sage 分块近似是待模型级匹配实验确认的主要假设。六路 attention 不能按单流拼接处理：video self 走组合并行，`v2a` 在完整 CP group 合并 partial output/log-sum-exp。
- Wan t2v/ti2v/VACE 部分路径标注「盲写，待真实权重验证」（M4 收口项）。
- 已知遗留：**Qwen t2i + ulysses4 + true CFG → latent NaN**（根因 = fp8 动态激活量化在 CFG 两分支 txt 长度不一致时退化，见 [optimization-components](optimization-components.md) §2 与 `../bugs/`）；Qwen edit 系不受影响。

## 4. 新增一个 pipeline 的最小路径

1. `warps/transformers/transformer_xxx.py`：写 `warp_transformer_xxx`，替换 `forward`（在正确位置发 `cp_split_blocks` / `cache_*` / `on_backend_*` 等 hook）+ attn processor。
2. `warps/pipelines/pipeline_xxx.py`：镜像 `__call__`（发 pipeline 级 hook），用 `@register_warp("XxxPipeline")` 注册。
3. 在 `optkit_v2/__init__.py` 末尾加副作用 import 触发注册。
4. 若新增 hook 注册点或新参与 component，必须在 `core/order.py` 的 `HOOK_ORDER` 显式登记，否则 `register` 报错。

> 关键纪律：**新模型只写 warp，不碰 component；改 Context / order.py 即契约变更，需评审。**
