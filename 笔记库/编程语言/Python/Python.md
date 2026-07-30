# Python

> Python 基础语法 + pip 镜像 + PyTorch 编译栈（Dynamo / AOTAutograd / Inductor）。

---

## 概览

- **主题范围**：本目录分为三层：
  1. **语言基础**：类、魔法方法、面向对象
  2. **工具生态**：pip 国内镜像
  3. **PyTorch 编译栈**：`torch.compile` 整体架构 + Inductor 后端原理
- **学习路径**：
  - Python 入门：[Python基础语法.md](./编程语言/Python/Python基础语法.md)
  - 工具：[Python源.md](./编程语言/Python/Python源.md)
  - PyTorch 编译：[Torch编译架构.md](./编程语言/Python/Torch编译架构.md) → [Torch编译Inductor原理.md](./编程语言/Python/Torch编译Inductor原理.md)
- **核心心智模型**：`torch.compile` 是**前端 + 后端**两层架构——前端用 Dynamo 抓 Python 字节码、AOTAutograd 抓反向图；后端由 Inductor 接管 FX Graph，做算子分解 / 联合优化 / Codegen。

---

## 知识地图

### 语言基础
- [Python基础语法.md](./编程语言/Python/Python基础语法.md) — 类（self、魔法方法）、数据类型、控制流

### 工具生态
- [Python源.md](./编程语言/Python/Python源.md) — pip 国内镜像（清华 / 阿里云 / 中科大 / 豆瓣）配置

### PyTorch 编译栈
两篇笔记是 PyTorch 编译栈的完整快照：

| 笔记 | 视角 |
| --- | --- |
| [Torch编译架构.md](./编程语言/Python/Torch编译架构.md) | 整体流水线：Dynamo → AOTAutograd → Inductor 的职责分工与数据格式 |
| [Torch编译Inductor原理.md](./编程语言/Python/Torch编译Inductor原理.md) | Inductor 内部：Pre-grad / Joint-graph / Codegen Pass |

---

## 横向关联

- 与 [神经网络/Agent](../../神经网络/Agent/Agent.md) 的"模型优化"是上下游——本目录讲编译器，Agent 侧讲上层应用
- 与 [计算机系统/MLIR入门.md](../../计算机系统/MLIR入门.md) 共享编译器 IR 概念
- 与 [神经网络/AIGC](../../神经网络/AIGC/AIGC.md) 互补——本目录讲 Python 端编译，神经网络侧讲 ONNX/TensorRT 端转换
