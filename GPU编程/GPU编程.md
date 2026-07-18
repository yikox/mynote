# GPU 编程

> OpenGL Compute Shader 入门与移动端 GPU 实战 Bug 排查。

---

## 概览

- **主题范围**：以 OpenGL Compute Shader 为主线的 GPU 通用计算实践，重点在移动端 SoC（天玑 / 骁龙 / 苹果 GPU）的兼容性踩坑。
- **学习路径**：[OpenGLCS入门.md](./GPU编程/OpenGLCS入门.md) → [GLCS同步Bug分析.md](./GPU编程/GLCS同步Bug分析.md)。前者建立基础，后者展示真实工程问题。
- **横向关联**：与 [神经网络](../神经网络/神经网络.md) 的"GPU 加速"主题互补——本目录偏 OpenGL 移动端，神经网络侧偏 NVIDIA / CUDA 生态。

---

## 知识地图

### OpenGL Compute Shader 基础
GLCS 是 OpenGL 4.3+ 提供的 GPGPU 能力，可在不支持 CUDA 的设备上跑通用计算。入门篇覆盖 CPU vs GPU 架构差异、移动端 GPU 厂商生态、Compute Shader 编程模型。

- [OpenGLCS入门.md](./GPU编程/OpenGLCS入门.md) — GLCS 概念、移动端 GPU 厂商、Compute Shader 编程模型

### 移动端 Bug 实战
GLCS 在天玑 9000 上的同步 Bug：Compute Shader 写 SSBO / Image / Atomic / Shared Memory 时，开发者必须显式同步，否则在 Mali 类 GPU 上结果错乱。

- [GLCS同步Bug分析.md](./GPU编程/GLCS同步Bug分析.md) — 天玑 9000 同步 Bug 排查

---

## 演进 / 待补

- 当前只有 OpenGL Compute Shader 一条线。CUDA / Vulkan Compute / Metal Compute Shader 的对照内容分别在 [编程语言/CUDA](../编程语言/CUDA/CUDA-Graph.md) 和 [编程语言/Swift/Swift-Metal编程入门.md](../编程语言/Swift/Swift-Metal编程入门.md)。
