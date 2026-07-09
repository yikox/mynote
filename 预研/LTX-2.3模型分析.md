# LTX-2.3 模型总结

## 一、基础信息

| 项目 | 详情 |
|------|------|
| **名称** | LTX-2.3 |
| **开发者** | Lightricks（以色列，Facetune / LTX Studio 母公司） |
| **发布时间** | 2026 年 3 月 |
| **架构** | Diffusion Transformer (DiT)，**220 亿参数** |
| **许可证** | **Apache 2.0**（可商用、修改、自托管） |
| **来源** | HuggingFace: `Lightricks/LTX-2.3`；魔搭有镜像；Diffusers 格式: `diffusers/LTX-2.3-Diffusers` |
| **蒸馏版** | `diffusers/LTX-2.3-Distilled-Diffusers`（8 步，CFG=1） |
| **模态** | T2V、I2V、T2AV、I2AV（同步音视频） |
| **排名** | 2026 年与 HunyuanVideo、Wan2.2 并称开源视频生成三强 |

**核心亮点**：

- 首个开源**同步音视频生成**模型（视频 + 音频单次推理同时产出）
- 原生 4K + 50 FPS，最长约 20 秒
- 文本连接器扩大 4x，复杂 prompt（多主体、空间关系、风格指令）遵循度大幅提升
- I2V 大幅改善：减少冻结/Ken Burns 效果，运动更自然
- 支持 LoRA：Style LoRA / Motion LoRA / IC-LoRA（图像条件 LoRA）
- 首次原生支持竖版视频

**参考链接**：
- HuggingFace 模型卡: https://huggingface.co/Lightricks/LTX-2.3
- Diffusers 格式: https://huggingface.co/diffusers/LTX-2.3-Diffusers
- 官方站点: https://ltx.io/model/ltx-2-3
- 魔搭介绍: https://modelscope.csdn.net/69ae35b154b52172bc5fefff.html
- Wikipedia: https://en.wikipedia.org/wiki/LTX_(text-to-video_model)

---

## 二、模型流程

### 涉及的模型组件速查

| 组件 | 模型 | 作用 |
|------|------|------|
| 文本编码器 | Gemma 3 12B (fp4) | prompt → embedding |
| 文本投影 | Text Projection (bf16) | embedding → DiT 条件向量 |
| 视频 VAE | LTX23_video_vae (~0.5GB) | 像素 ↔ latent（空间压缩 32x） |
| 音频 VAE | LTX23_audio_vae | 音频 ↔ latent |
| 扩散主干 | ltx-2.3-22b-dev (46GB bf16 / ~29GB FP8) | 22B DiT，去噪生成 latent |
| 蒸馏 LoRA | ltx-2.3-22b-distilled-lora (~7.6GB) | 加速推理（8 步替代 30+ 步） |
| 空间放大器 | ltx-2.3-spatial-upscaler-x2 | latent 空间 2x 超分 |
| 时间放大器 | (可选) temporal-upscaler | latent 帧率翻倍 |
| 声码器 | Vocoder + MelBandRoformer | 音频 latent → 波形，增强音质 |

### 管线分阶段

#### Stage 1 — 编码（Encoding）

```
输入: 文本 prompt + (可选) 起始帧图片 + (可选) 参考音频
处理:
  文本: GemmaTokenizer → Gemma 3 12B → Text Projection → prompt_embeddings
  (可选) 图片: → Video VAE Encoder → image_latents (空间压缩 32x)
  (可选) 音频: → Audio VAE Encoder → audio_latents
输出: prompt_embeddings [B, seq, dim] + 条件 latents
涉及模型: Gemma 3 12B (~6GB fp4), Text Projection (小), Video VAE (~0.5GB), Audio VAE (小)
资源: 文本编码约需 6-8GB VRAM，VAE 编码轻量
```

#### Stage 2 — 扩散去噪（Denoising）

```
输入: 随机噪声 (shape=[B,C,T,H/32,W/32]) + prompt_embeddings + (可选 image_latents)
处理:
  22B DiT Transformer 迭代去噪 (Flow Matching)
  → 视频和音频在统一框架内同步去噪
  → 每个 step: Transformer forward pass，处理时空联合 attention
关键参数:
  Fast Flow:  num_inference_steps=30~40, guidance_scale=3.0~4.0
  Distilled:  num_inference_steps=8,      guidance_scale=1.0
输出: 视频 latent + 音频 latent
涉及模型: ltx-2.3-22b-dev (46GB bf16 / ~29GB FP8), Distilled LoRA (可选, ~7.6GB)
资源: bf16 需 32GB+ VRAM, FP8 需 16GB+, GGUF 量化可压到 6GB+
```

#### Stage 3 — 解码输出（Decode，即 Fast Flow 终点）

```
输入: 视频 latent + 音频 latent (Stage 2 输出)
处理:
  视频 latent → Video VAE Decoder → 视频帧 (pixel space) → encode_video → .mp4
  音频 latent → Audio VAE Decoder → Vocoder → 音频波形
  (可选) MelBandRoformer 音频增强
输出: 同步音视频 .mp4
涉及模型: Video VAE, Audio VAE, Vocoder, (可选) MelBandRoformer
资源: 轻量，解码阶段不占额外大 VRAM
```

#### Stage 4 — Quality Flow 放大精修（可选，仅两阶段管线）

```
输入: Stage 2 的低分辨率 latent (如 512×768)
处理:
  ① Spatial Upscaler (2x): latent 空间分辨率翻倍 (512×768 → 1024×1536)
  ② DiT 二次轻量去噪:
     - 蒸馏 LoRA 模式: 4~8 steps, CFG=1.0, denoise=0.35~0.55
     - 精修纹理、边缘、微细节，不破坏 Stage 2 已建立的运镜结构
  ③ (可选) Temporal Upscaler (2x): latent 帧率翻倍
输出: 高分辨率 latent → 输入 Stage 3 VAE Decode → 最终高质量视频
涉及模型: Spatial Upscaler, Distilled LoRA, (可选) Temporal Upscaler
资源: 放大+精修额外占用约 2-4GB VRAM
```

> **Fast Flow 路径**: Stage1 → Stage2 → Stage3（适合快速迭代/预览）
> **Quality Flow 路径**: Stage1 → Stage2 → Stage4 → Stage3（适合最终输出）

---

## 三、简单运行 Demo

### 1. 魔搭下载

```python
export PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
pip install modelscope 

mkdir -p /app/model/LTX-2.3
modelscope download --model hf-diffusers/LTX-2.3-Diffusers README.md --local_dir ./app/model/LTX-2.3
modelscope download --model Lightricks/LTX-2.3 --local_dir  /app/model/LTX-2.3
```

### 2. Diffusers 运行

安装（需要包含 LTX-2 支持的较新版本）：

```bash
pip install -U git+https://github.com/huggingface/diffusers.git
```

#### 文本生视频 + 音频（LTX2Pipeline）

```python
import torch
from diffusers import LTX2Pipeline
from diffusers.pipelines.ltx2.export_utils import encode_video
from diffusers.pipelines.ltx2.utils import DEFAULT_NEGATIVE_PROMPT

pipe = LTX2Pipeline.from_pretrained(
    "diffusers/LTX-2.3-Diffusers",
    torch_dtype=torch.bfloat16,
)
pipe.enable_model_cpu_offload()

prompt = "A flowing river in a forest at golden hour, gentle wind in the leaves."
video, audio = pipe(
    prompt=prompt,
    negative_prompt=DEFAULT_NEGATIVE_PROMPT,
    width=768,
    height=512,
    num_frames=121,
    frame_rate=24.0,
    num_inference_steps=30,
    guidance_scale=3.0,
)

encode_video(
    video,
    fps=24.0,
    audio=audio.float().cpu(),
    audio_sample_rate=pipe.vocoder.config.output_sampling_rate,
    output_path="output.mp4",
)
```

#### 图片生视频（LTX2ConditionPipeline）

```python
import torch
from diffusers import LTX2ConditionPipeline
from diffusers.pipelines.ltx2.pipeline_ltx2_condition import LTX2VideoCondition
from diffusers.pipelines.ltx2.utils import DEFAULT_NEGATIVE_PROMPT
from diffusers.utils import load_image

pipe = LTX2ConditionPipeline.from_pretrained(
    "diffusers/LTX-2.3-Diffusers",
    torch_dtype=torch.bfloat16,
)
pipe.enable_model_cpu_offload()

first_image = load_image("https://example.com/start_frame.jpg")
last_image = load_image("https://example.com/end_frame.jpg")

conditions = [
    LTX2VideoCondition(frames=first_image, index=0, strength=1.0),
    LTX2VideoCondition(frames=last_image, index=-1, strength=1.0),
]

video = pipe(
    conditions=conditions,
    prompt="CG animation style, a small blue bird takes off, flapping its wings.",
    negative_prompt=DEFAULT_NEGATIVE_PROMPT,
    width=768,
    height=512,
    num_frames=121,
    frame_rate=24.0,
    num_inference_steps=30,
    guidance_scale=3.0,
)
```

#### 蒸馏版（更快）

将模型 ID 换成 `diffusers/LTX-2.3-Distilled-Diffusers`，参数调整：

```python
pipe = LTX2Pipeline.from_pretrained(
    "diffusers/LTX-2.3-Distilled-Diffusers",
    torch_dtype=torch.bfloat16,
)
# 8 steps, CFG=1.0，无需 guidance_scale
```

---

## 四、注意事项

- LTX-2 的旧 LoRA 与 2.3 **不兼容**（VAE 重建后潜在空间改变），自定义 LoRA 需重新训练
- 原始仓 `Lightricks/LTX-2.3` 缺少 `model_index.json`，无法直接用 `DiffusionPipeline.from_pretrained()` 加载，需使用 `diffusers/LTX-2.3-Diffusers` 或 DiffSynth-Studio
- DiffSynth-Studio（魔搭官方推荐）最低 8GB VRAM，支持自动显存管理
- LoRA 训练需 80GB 显存（A100/H100）
