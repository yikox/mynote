# CUDA

> CUDA Graph：用 DAG 替代逐 kernel 提交，降低 GPU 调度开销。

---

## 概览

- **主题范围**：聚焦 CUDA Graph 这一种工作流优化机制——不是语言入门，而是**性能优化专项**。
- **核心思想**：把 GPU 操作（kernel、内存拷贝、事件同步）预先组织为有向无环图，一次性提交给 GPU 自主调度，消除 CPU 逐个提交的调度开销。
- **学习路径**：单篇笔记。

---

## 知识地图

### CUDA Graph
- **节点**：单个 GPU 操作（kernel 启动、内存拷贝）
- **边**：操作间依赖关系
- **构建方式**：
  - 显式 API（`cudaGraphAddKernelNode` → `cudaGraphInstantiate` → `cudaGraphLaunch`）
  - 流捕获（`cudaStreamBeginCapture` → 现有代码无需改）
- **执行模式对比**：
  - 传统流：CPU 逐个提交 → 调度开销大
  - Graph 模式：一次性提交整图 → GPU 自主调度

- [CUDA-Graph.md](./编程语言/CUDA/CUDA-Graph.md)

---

## 横向关联

- 与 [神经网络/并行策略](../../神经网络/并行策略/) 的多卡并行互补——本目录是单卡内的图优化，神经网络侧是多卡分布式
- 与 [神经网络/AIGC/Nvidia-MPS使用指南.md](../../神经网络/AIGC/Nvidia-MPS使用指南.md) 共享 CUDA 运行时知识
