# SDNQ 项目阅读分析报告

## 项目概述

SDNQ (SD.Next Quantization Engine) 是一个专为深度学习模型（特别是 Stable Diffusion 和 Transformer 模型）设计的量化引擎。

| 项目属性 | 描述 |
|---------|------|
| 作者 | Disty0 |
| 许可证 | GPL-3.0 |
| 版本 | 0.1.5 |
| 语言 | Python |
| Star数 | 88 |
| Fork数 | 9 |

### 核心目标
SDNQ 旨在通过先进的量化技术减少模型内存占用和推理计算成本，同时保持模型精度。它支持：
- 模型量化（权重和优化器状态）
- 量化训练
- 预量化模型加载
- 多种量化精度配置

---

## 项目架构设计

### 整体架构

```
sdnq/
├── src/sdnq/                    # 核心源代码
│   ├── quantizer.py            # 量化核心逻辑（58KB）
│   ├── dequantizer.py          # 反量化器（23KB）
│   ├── loader.py               # 模型加载/保存（15KB）
│   ├── common.py               # 通用工具和配置（34KB）
│   ├── forward.py              # 前向传播逻辑
│   ├── packed_int.py           # 整数位打包
│   ├── packed_float.py         # 浮点数位打包
│   ├── triton_mm.py            # Triton 加速矩阵乘法
│   ├── sdnext.py               # SD.Next 集成
│   ├── file_loader.py          # 文件加载器
│   ├── layers/                 # 量化层封装
│   │   ├── linear/            # 线性层量化
│   │   └── conv/              # 卷积层量化
│   ├── optim/                  # 量化优化器
│   │   ├── optimizer.py       # 基础优化器
│   │   ├── adamw.py           # AdamW 量化
│   │   ├── lion.py            # Lion 量化
│   │   ├── came.py            # CAME 量化
│   │   ├── adafactor.py       # Adafactor 量化
│   │   └── muon.py            # Muon 量化
│   └── training/               # 训练相关
│       ├── tensor.py          # 可训练量化张量
│       ├── forward.py         # 训练前向传播
│       └── layers/            # 训练层封装
├── benchmarks/                 # 性能基准测试
│   ├── inference/             # 推理基准
│   └── training/              # 训练基准
├── scripts/                    # 辅助脚本
└── pyproject.toml             # 项目配置
```

### 核心模块设计

#### 1. 量化器 (quantizer.py)

**职责**：提供量化、配置管理和框架集成

**核心类和函数**：
```python
class QuantizationMethod(str, Enum):
    SDNQ = "sdnq"          # 标准量化
    SDNQ_TRAINING = "sdnq_training"  # 训练量化

class SDNQQuantizer(DiffusersQuantizer, HfQuantizer):
    # Diffusers 和 Transformers 量化器接口实现
    # 处理模型加载时的量化逻辑

@dataclass
class SDNQConfig(QuantizationConfigMixin):
    # 量化配置类
    # 定义所有量化参数
```

**关键量化流程**：
```
输入权重 → [SVD预量化] → [分组/归约] → [量化计算] → [位打包] → 量化权重
            ↓
        [缩放因子]
        [零点偏移]
```

#### 2. 反量化器 (dequantizer.py)

**职责**：在推理时还原量化权重

**核心功能**：
- 支持静态度量（预先计算缩放因子）
- 支持动态反量化（运行时计算）
- 处理位解包操作
- 与量化 matmul 集成

**反量化公式**：
- **对称量化**：`output = (quantized_weight * scale) + svd_reconstruction`
- **非对称量化**：`output = (quantized_weight * scale) + zero_point + svd_reconstruction`

#### 3. 层封装 (layers/)

**职责**：替换 PyTorch 原始层，注入量化逻辑

**支持的层类型**：
```
Linear 层:
  Linear → SDNQLinear

卷积层:
  Conv1d → SDNQConv1d
  Conv2d → SDNQConv2d
  Conv3d → SDNQConv3d

转置卷积:
  ConvTranspose1d → SDNQConvTranspose1d
  ConvTranspose2d → SDNQConvTranspose2d
  ConvTranspose3d → SDNQConvTranspose3d
```

**动态前向函数选择**：
根据配置选择不同的前向传播实现：
- 标准 torch.matmul
- INT8 量化矩阵乘法 (`torch._int_mm` 或 Triton)
- FP8 量化矩阵乘法

#### 4. 优化器量化 (optim/)

**职责**：优化器状态的量化以减少显存占用

**支持的优化器**：
```python
from sdnq.optim import Adafactor, AdamW, CAME, Lion, Muon

optimizer = AdamW(
    parameters,
    use_stochastic_rounding=True,      # 随机舍入
    use_stochastic_buffers=True,        # 状态张量量化
    use_quantized_buffers=True,         # 量化状态
    quantized_buffers_dtype="uint8",    # 量化精度
    quantized_buffers_group_size=32,    # 分组大小
)
```

**量化状态**：
- `exp_avg`：一阶动量
- `exp_avg_sq`：二阶动量（仅 Adam 类）
- 其他内部缓冲区

#### 5. 训练模块 (training/)

**职责**：支持可训练的量化模型

**核心特性**：
- 梯度检查点（gradient checkpointing）支持
- 量化张量的梯度传播
- 随机舍入以减少量化误差

**转换函数**：
```python
# 标准 SDNQ → 训练 SDNQ
convert_sdnq_model_to_training(model, ...)

# 训练 SDNQ → 标准 SDNQ
convert_training_model_to_sdnq(model, ...)

# 训练后量化
sdnq_training_post_load_quant(model, ...)
```

---

## 技术细节

### 1. 量化类型支持

#### 整数类型
| 类型 | 范围 | 位宽 | 符号 | 打包 |
|------|------|------|------|------|
| int2 | -2 到 1 | 2bit | 有 | ✓ |
| int3 | -4 到 3 | 3bit | 有 | ✓ |
| int4 | -8 到 7 | 4bit | 有 | ✓ |
| int5 | -16 到 15 | 5bit | 有 | ✓ |
| int6 | -32 到 31 | 6bit | 有 | ✓ |
| int7 | -64 到 63 | 7bit | 有 | ✓ |
| int8 | -128 到 127 | 8bit | 有 | - |
| uint2 | 0 到 3 | 2bit | 无 | ✓ |
| uint4 | 0 到 15 | 4bit | 无 | ✓ |
| uint8 | 0 到 255 | 8bit | 无 | - |

#### 浮点类型
| 类型 | 范围 | 位宽 | 指数 | 尾数 | 格式 |
|------|------|------|------|------|------|
| float2_e1m0fn | -2.0 到 2.0 | 2bit | 1 | 0 | 打包 |
| float4_e2m1fn | -6.0 到 6.0 | 4bit | 2 | 1 | 打包 |
| float7_e3m3fn | -30.0 到 30.0 | 7bit | 3 | 3 | 打包 |
| float8_e4m3fn | -448.0 到 448.0 | 8bit | 4 | 3 | 原生 FP8 |
| float8_e5m2 | -57344 到 57344 | 8bit | 5 | 2 | 原生 FP8 |

**自定义浮点格式命名规则**：
```
float{N}_e{E}m{M}[fn|fnu]
N: 总位宽
E: 指数位数
M: 尾数位数
fn: 有符号浮点
fnu: 无符号浮点
```

### 2. 量化算法

#### 对称量化
适用于权重分布接近对称的情况：
```python
scale = max(abs(weight)) / dtype_max
quantized = round(weight / scale).clamp(dtype_min, dtype_max)
```

#### 非对称量化
适用于权重分布不对称的情况：
```python
zero_point = min(weight)
scale = (max(weight) - zero_point) / (dtype_max - dtype_min)
quantized = round((weight - zero_point) / scale).clamp(dtype_min, dtype_max)

# 解码时
output = quantized * scale + zero_point
```

#### 分组量化 (Group-wise Quantization)
将权重按通道分组，每组独立计算缩放因子：
```python
# 将权重形状 [out_channels, in_channels] 重塑为
# [out_channels, num_groups, group_size]
# 每个组独立量化

group_size = 128  # 例如128个元素为一组
scale.shape = [out_channels, num_groups, 1]
```

#### SVDQuant 算法
使用奇异值分解压缩权重：
```python
# 1. 计算低秩 SVD
U, S, V = torch.svd_lowrank(weight, q=rank)

# 2. 分离低秩成分和残差
W_low_rank = U @ S @ V.T
W_residual = weight - W_low_rank

# 3. 量化残差
W_quantized = quantize(W_residual)

# 4. 反量化时合并
output = dequantize(W_quantized) + W_low_rank
```

#### 动态量化
根据 MSE 损失自动选择最佳量化精度：
```python
for dtype in dtype_order_from_min_to_max:
    q_weight, scale, zp = quantize(weight, dtype)
    reconstructed = dequantize(q_weight, scale, zp)
    loss = mse_loss(weight, reconstructed)
    if loss <= threshold:
        return dtype  # 选择满足精度要求的最小精度
```

### 3. 位打包 (Bit Packing)

由于 PyTorch 不直接支持 sub-8bit 类型，SDNQ 使用位打包技术：

#### 整数打包
```python
# 将 4 个 int2 值打包到一个 uint8 中
# 每个值占 2 位

int2_values: [-2, -1, 0, 1]
↓
packed_uint8: 0b11100100
```

#### 浮点数打包
自定义浮点格式转换为整数存储，按 IEEE 754 类似规则解包：
```python
# float4_e2m1fn 格式
sign: 1 bit
exponent: 2 bits
mantissa: 1 bit

# 打包到 uint8 的高4位
```

### 4. 量化矩阵乘法

#### INT8 Matmul
使用 INT8 累积，然后除以缩放因子：
```python
# Q_A @ Q_B 其中 Q_A, Q_B 为 int8
# scale_A, scale_B 分别为缩放因子

output_int32 = torch._int_mm(Q_A, Q_B)  # INT8×INT8=INT32
output_fp32 = output_int32 * (scale_A * scale_B)
```

#### FP8 Matmul
针对 H100+ GPU 的原生 FP8 支持，或软件模拟：
```python
# 原生硬件支持 (H100)
output = torch.tensor_mm_scale(Q_A, Q_B, scale_A, scale_B)

# 软件模拟 (其他GPU)
output = (Q_A.float() * scale_A) @ (Q_B.float() * scale_B)
```

#### Triton 优化
使用 Triton 编写自定义 kernel 加速：
```python
@triton.jit
def int_mm_kernel(...)
    # 自定义 INT8×INT8 快速矩阵乘法
    # 使用张量核心优化
```

### 5. 模型跳过规则

不同模型类型有不同的敏感层需要保留 FP32 精度：

**通用跳过模式**：
```python
common_skip_keys = [
    ".time_embed",        # 时间嵌入
    ".context_embedder",  # 上下文嵌入
    ".x_embedder",        # 输入嵌入
    ".lm_head",           # 语言模型头
    ".wte",               # Token 嵌入
]
```

**模型特定规则**：
```python
module_skip_keys_dict = {
    "FluxTransformer2DModel": [
        ["time_text_embed", "context_embedder", "x_embedder"],
        {}
    ],
    "Gemma3nForCausalLM": [
        ["lm_head", "correction_coefs", "prediction_coefs"],
        {}
    ],
    # ... 更多模型
}
```

### 6. 硬件适配

#### CUDA 后端
- 检测 GPU 算力：`torch.cuda.get_device_capability()`
- H100+ 支持 Tensor-wise FP8
- 其他 GPU 使用软件行级 FP8

#### ROCm 后端
- RDNA2 架构优化（<gfx1100）
- Triton 后端支持

#### 其他后端
- MPS (Apple Silicon)
- IPEX (Intel)
- CPU
- OpenVINO
- ZLUDA

环境变量控制：
```bash
SDNQ_USE_TRITON_MM=1          # 使用 Triton 优化
SDNQ_USE_CONTIGUOUS_MM=1      # 使用连续内存布局
SDNQ_USE_TENSORWISE_FP8_MM=0  # 使用行级 FP8
```

### 7. 设备和内存管理

**内存布局优化**：
```python
# 非连续内存（支持某些 GPU架构）
if weight.is_contiguous():
    weight = weight.t_().contiguous().t_()
```

**设备转移**：
```python
quantization_device  # 量化计算设备（通常是 CUDA CPU）
return_device       # 最终返回设备
non_blocking        # 非阻塞传输
```

**梯度检查点**：
```python
# 训练时启用
use_grad_ckpt = True  # 重新计算激活而非存储
```

---

## 使用示例

### 1. 基础量化

```python
from sdnq import SDNQConfig
from diffusers import StableDiffusionPipeline

# 配置量化
sdnq_config = SDNQConfig(
    weights_dtype="int4",          # 使用 int4 量化
    group_size=128,                 # 每组 128 个元素
    use_quantized_matmul=True,      # 启用量化矩阵乘法
    quant_conv=True,                # 量化卷积层
)

# 加载并量化模型
pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    quantization_config=sdnq_config,
    device_map="auto",
)
```

### 2. 动态量化

```python
sdnq_config = SDNQConfig(
    weights_dtype="int2",            # 最小精度
    use_dynamic_quantization=True,   # 动态选择精度
    dynamic_loss_threshold=0.01,     # MSE 阈值
)
# SDNQ 会为每层自动选择满足精度要求的最小精度
# 某些层可能使用 int4 或 int6
```

### 3. 预量化模型加载

```python
from sdnq import SDNQConfig
from sdnq.loader import load_sdnq_model

# 加载预量化模型
model = load_sdnq_model(
    "path/to/quantized_model",
    device="cuda",
)

# 或使用 AutoModel
from transformers import AutoModel
from sdnq import SDNQConfig  # 注册 SDNQ
model = AutoModel.from_pretrained("path/to/quantized_model")
```

### 4. 训练量化

```python
from sdnq.training import SDNQTensor, sdnq_training_post_load_quant
from sdnq.optim import AdamW

# 转换为可训练量化模型
quantized_model = sdnq_training_post_load_quant(
    model,
    weights_dtype="uint8",
    use_stochastic_rounding=True,
    use_quantized_matmul=True,
    use_grad_ckpt=True,
)

# 量化优化器
optimizer = AdamW(
    quantized_model.parameters(),
    use_quantized_buffers=True,
    quantized_buffers_dtype="uint8",
)

# 正常训练循环
for batch in dataloader:
    loss = quantized_model(batch)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

### 5. 保存量化模型

```python
from sdnq.loader import save_sdnq_model

# 保存单个模型
save_sdnq_model(
    quantized_model,
    "path/to/save",
    max_shard_size="5GB",
)

# 保存整个 pipeline
save_sdnq_model(
    pipe,
    "path/to/save",
    is_pipeline=True,
)
```

---

## 性能特性

### 内存压缩比例

根据量化精度不同，内存压缩比：

| 权重精度 | 压缩比 | 显存节省 |
|---------|--------|---------|
| FP16/BF16 | 1× | 0% |
| int8/FP8 | 2× | 50% |
| int4/FP4 | 4× | 75% |
| int2/FP2 | 8× | 87.5% |

### 推理加速

量化矩阵乘带来的加速：
- INT8 Matmul：约 2-4x 加速（取决于硬件）
- FP8 Matmul：约 2x 加速（H100+）
- 总体推理速度提升：1.5-3x

### 训练显存节省

优化器状态量化可进一步节省：
- Adam 状态通常是权重的 3x
- 量化后可降至权重相同大小
- 总显存节省：约 30-50%

---

## 兼容性

### 支持的框架
- Diffusers（Stable Diffusion 系列）
- Transformers（LLM 系列）

### 支持的模型架构

**Stable Diffusion 系列**：
- SD 1.5, SD 2.1, SDXL
- Flux, Flux.1
- HunyuanDiT
- Lumina
- PixArt-α
- 更多...

**Transformer 系列**：
- Gemma, Gemma2, Gemma3
- Qwen, Qwen2, Qwen3
- Llama 2, Llama 3
- Mistral, Mixtral
- Moondream
- 更多...

### 支持的硬件
- NVIDIA GPU（CUDA 11.8+, 推荐 CU12）
- AMD GPU（ROCm 5.7+, via ROCm-ZLUDA）
- Apple Silicon（MPS）
- Intel GPU（IPEX）
- CPU

---

## 技术优势

1. **灵活性**：支持 1-8bit 任意精度量化
2. **精度保持**：SVD + 动态量化减少精度损失
3. **易用性**：与 Diffusers/Transformers 无缝集成
4. **训练支持**：完整的 QAT（Quantization Aware Training）
5. **优化器量化**：减少训练显存占用
6. **硬件适配**：多平台后端优化
7. **模块化设计**：易于扩展和维护

---

## 总结

SDNQ 是一个功能强大的深度学习模型量化引擎，通过创新的量化算法（分组量化、SVDQuant、动态量化）和精细的工程优化（位打包、自定义 kernel、设备适配），在保证模型精度的前提下实现了显著的内存节省和计算加速。其模块化设计使其可以轻松集成到现有的深度学习工作流中，特别适合 Stable Diffusion 和大语言模型的部署和训练场景。
