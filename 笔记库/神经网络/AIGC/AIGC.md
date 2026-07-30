# AIGC

> NVIDIA GPU 上的 AIGC 推理工具链：MPS 多进程协作 + Polygraphy 模型检查与转换。

---

## 概览

- **主题范围**：聚焦 NVIDIA 生态的两类工具——运行时（MPS，多进程共享 GPU）与模型转换（Polygraphy，ONNX↔TensorRT）。
- **学习路径**：[Nvidia-MPS使用指南.md](./神经网络/AIGC/Nvidia-MPS使用指南.md) → [Polygraphy使用指南.md](./神经网络/AIGC/Polygraphy使用指南.md)。前者解决"多进程怎么共享 GPU"，后者解决"模型怎么转换和验证"。

---

## 知识地图

### 多进程运行时
- MPS：CUDA API 的二进制兼容替代实现，让多进程 MPI 作业透明利用 Hyper-Q
- 适用场景：多进程推理服务、多卡共享、CPU offload 之外的轻量协作

- [Nvidia-MPS使用指南.md](./神经网络/AIGC/Nvidia-MPS使用指南.md)

### 模型检查与转换
- Polygraphy：NVIDIA 官方模型诊断工具
- 核心能力：inspect model 显示 ONNX / TensorRT Engine 网络结构；convert 做 ONNX → TensorRT 转换并配置 min/opt/max shape

- [Polygraphy使用指南.md](./神经网络/AIGC/Polygraphy使用指南.md)

---

## 横向关联

- 与 [预研/SDNQ项目分析报告.md](../../预研/SDNQ项目分析报告.md)、[预研/SVDQuant.md](../../预研/SVDQuant.md) 的量化技术形成"工具 → 量化算法"上下游
- 与 [编程语言/CUDA/CUDA-Graph.md](../../编程语言/CUDA/CUDA-Graph.md) 共享 CUDA 运行时知识
