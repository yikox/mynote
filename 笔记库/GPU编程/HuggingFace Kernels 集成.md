# HuggingFace Kernels 集成

> 来源: https://huggingface.co/docs/kernels/integrating-kernels 及子文档

## 两种集成方式

### 1. `get_kernel()` — 手动加载预编译 kernel

一行代码从 Hub 下载并加载优化 kernel，返回 Python module，直接操作 tensor。

```python
from kernels import get_kernel

activation = get_kernel("kernels-community/activation", version=1)
activation.gelu_fast(y, x)   # in-place: output 在前, input 在后
```

**特性:**
- 多版本共存（同进程内），v1+ API 不破，v0 无稳定性保证
- 自动缓存到 HF cache，按需下载
- 辅助 API: `has_kernel()` / `get_kernel_variants()` / `get_loaded_kernels()`
- 后端感知: CUDA / ROCm / Metal / XPU

**覆盖操作:** 激活函数、Flash Attention 2/3、LayerNorm/RMSNorm、量化计算(AWQ/GPTQ/MXFP4)、GEMM (含 FP8)、MoE 块、融合算子

### 2. Kernel Layers — Drop-in 替换 `nn.Module`

比 `get_kernel()` 更高层。替换原始层的 `forward`，对模型代码零侵入。

**两阶段模式 (Two-class Pattern):**
```
KernelName         → 真正的优化 forward
KernelNameLayout   → nn.Module, 负责参数重映射(conversion_mapping) + 模块融合
```

**方式一: 一键启用**
```python
model = AutoModel.from_pretrained("model-name", use_kernels=True)
```
自动匹配可用的优化 kernel，无匹配则静默回退标准 PyTorch。

**方式二: 精细控制**
```python
config = KernelConfig({
    "RMSNorm": "kernels-community/triton-layer-norm:RMSNorm",
})
model = AutoModel.from_pretrained("model-name", kernel_config=config)
```

**模块融合 (Kernel Layers 独有能力):**
```python
# RMSNorm + MLP → 单 kernel, 减少两次显存读写 + 两次 kernel launch
config = KernelConfig({
    ("RMSNorm", "*.post_attention_layernorm"): "...RMSNormMLP",
    ("MLP",     "*.mlp"):                     "...RMSNormMLP",
})
```

## 对比

| | `get_kernel()` | Kernel Layers |
|---|---|---|
| 抽象层级 | 低: 手动调函数 | 高: nn.Module drop-in |
| 集成方式 | 手动改写调用 | `use_kernels=True` 或 KernelConfig |
| 参数管理 | 用户自理 | Layout 自动处理 weight 重映射 |
| 模块融合 | ❌ | ✅ |
| 适用 | 研究实验/自定义 pipeline | 生产训练推理 |

## 精度

**不保证 bit-exact 一致**（官方明确声明），差异来自:
- 浮点运算重排（融合 kernel 改变执行顺序，FP 不满足结合律）
- 累加策略不同（FP32 累加 vs BF16 累加）
- 算法近似（Flash Attention 分块 tiling online softmax）

**典型误差:** 相对误差 `1e-3 ~ 1e-2` 量级（RMSNorm 对比官方用 `rtol=1e-2, atol=1e-2`）。

**保障措施:**
- 无匹配 kernel 时自动回退标准 PyTorch
- 同 vN 分支保证 API/行为不变
- `get_loaded_kernels()` 可审计当前加载了哪些 kernel
- `torch.use_deterministic_algorithms(True)` 可强制确定性（牺牲性能）

**盲区:** Hub 不做统一精度校验，kernel 质量由作者保证；特定 dtype 下可能测试不充分。

## `use_kernels=True` ≠ 量化

**不会自动量化你的模型。** 它替换 forward 实现，不改变权重 dtype。

```
use_kernels=True     → 换「怎么算」，权重仍是 FP16/BF16
quantization_config   → 换「用什么算」，权重变 INT4/INT8/FP8
```

量化入口是独立的:
```python
model = AutoModel.from_pretrained("model-name",
    quantization_config=BitsAndBytesConfig(load_in_4bit=True))
```

唯一交叉: MXFP4 模型会自动从 Hub 拉取对应 kernel，但量化是 checkpoint 自带的，kernel 只管计算。且 `use_kernels=True` 的某些 kernel (LigerRMSNorm 等) **不兼容 MXFP4**，反而会强制退回 bfloat16。
