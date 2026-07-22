# 笔记库

> 个人知识管理与学习笔记库

---

## 📂 目录结构

| 目录                                      | 说明                                  |
| ----------------------------------------- | ------------------------------------- |
| [神经网络/](./神经网络/神经网络.md)       | AI、深度学习、Agent、AIGC、并行策略   |
| [GPU编程/](./GPU编程/GPU编程.md)          | OpenGL Compute Shader、GPU 编程与调试 |
| [编程语言/](./编程语言/编程语言.md)       | Python、Rust、Swift、CUDA 等          |
| [计算机系统/](./计算机系统/计算机系统.md) | 操作系统、编译原理、多线程、调试      |
| [预研/](./预研/预研.md)                   | 技术调研、模型分析、算法与论文复现    |
| [方法论/](./方法论/方法论.md)             | 编程思维、架构设计等通识方法论        |
| [工具/](./工具/工具.md)                   | 开发工具、三方库与常用软件指南        |
| [berkshire/](./berkshire/berkshire.md)    | 投资记录与交易系统                    |
| [PM/](./PM/PM.md)                         | 多项目管理（产品与技术）              |

> 本库采用「**目录 + 同名 .md 归纳**」的双轨结构：每个目录同级都有一份同名 .md 作为知识地图，串联下属笔记的主题、关系与学习路径。
> 例外：[PM/](./PM/PM.md) 内部为项目制结构（每个项目自含 project-management.md / knowledge-summary.md），不再额外建同级归纳。

---

## 🧠 神经网络 & AI

- 知识地图：[神经网络.md](./神经网络/神经网络.md)

### AI 应用
- [LLM应用设计指南.md](./神经网络/LLM应用设计指南.md) — LLM Wiki 三层架构设计
- [大语言模型架构分析.md](./神经网络/大语言模型架构分析.md) — 四大开源 LLM 架构对比（DeepSeek V4 / GLM-5.1 / MiniMax M2.7 / Kimi K2.6）

### Agent
- 知识地图：[Agent.md](./神经网络/Agent/Agent.md)
- [上下文管理模块设计.md](./神经网络/Agent/上下文管理模块设计.md) — Agent 上下文管理模块设计

### 并行策略
- 知识地图：[并行策略.md](./神经网络/并行策略/并行策略.md)
- [DeepSpeed-Ulysses序列并行.md](./神经网络/并行策略/DeepSpeed-Ulysses序列并行.md) — DeepSpeed-Ulysses 序列并行
- [Ring-Attention环形注意力.md](./神经网络/并行策略/Ring-Attention环形注意力.md) — Ring-Attention 环形注意力

### AIGC
- 知识地图：[AIGC.md](./神经网络/AIGC/AIGC.md)
- [Nvidia-MPS使用指南.md](./神经网络/AIGC/Nvidia-MPS使用指南.md) — Nvidia MPS 使用
- [Polygraphy使用指南.md](./神经网络/AIGC/Polygraphy使用指南.md) — Polygraphy 工具

### 图像处理
- 知识地图：[图像处理.md](./神经网络/图像处理/图像处理.md)
- [NvJPEG使用指南.md](./神经网络/图像处理/NvJPEG使用指南.md) — NvJPEG 编解码（GPU 加速）

---

## 🎮 GPU 编程

- 知识地图：[GPU编程.md](./GPU编程/GPU编程.md)
- [OpenGLCS入门.md](./GPU编程/OpenGLCS入门.md) — OpenGL Compute Shader 入门
- [GLCS同步Bug分析.md](./GPU编程/GLCS同步Bug分析.md) — GLCS 在天玑芯片上的同步 Bug 案例

---

## 💻 编程语言

- 知识地图：[编程语言.md](./编程语言/编程语言.md)

### Python
- 知识地图：[Python.md](./编程语言/Python/Python.md)
- [Python基础语法.md](./编程语言/Python/Python基础语法.md) — Python 基础语法
- [Python源.md](./编程语言/Python/Python源.md) — pip 国内镜像配置
- [Torch编译架构.md](./编程语言/Python/Torch编译架构.md) — torch.compile 整体流水线
- [Torch编译Inductor原理.md](./编程语言/Python/Torch编译Inductor原理.md) — Inductor 后端原理

### CUDA
- 知识地图：[CUDA.md](./编程语言/CUDA/CUDA.md)
- [CUDA-Graph.md](./编程语言/CUDA/CUDA-Graph.md) — CUDA Graph

### Rust
- 知识地图：[Rust.md](./编程语言/Rust/Rust.md)
- [Rust快速入门.md](./编程语言/Rust/Rust快速入门.md) — Rust 快速入门

### Swift
- 知识地图：[Swift.md](./编程语言/Swift/Swift.md)
- [Swift学习笔记.md](./编程语言/Swift/Swift学习笔记.md) — Swift 学习笔记
- [Swift-Metal编程入门.md](./编程语言/Swift/Swift-Metal编程入门.md) — Swift Metal 编程
- [SwiftUI实战-TodoApp.md](./编程语言/Swift/SwiftUI实战-TodoApp.md) — SwiftUI 实战

---

## 🔧 计算机系统

- 知识地图：[计算机系统.md](./计算机系统/计算机系统.md)
- [操作系统.md](./计算机系统/操作系统.md) — 操作系统原理
- [MLIR入门.md](./计算机系统/MLIR入门.md) — MLIR 入门
- [多线程笔记.md](./计算机系统/多线程笔记.md) — 多线程编程
- [GDB调试笔记.md](./计算机系统/GDB调试笔记.md) — GDB 调试技术

---

## 🔬 预研

- 知识地图：[预研.md](./预研/预研.md)

### 扩散模型加速
- [DiCache扩散模型缓存加速.md](./预研/DiCache扩散模型缓存加速.md) — DiCache 扩散模型缓存加速
- [SeaCache论文复现笔记.md](./预研/SeaCache论文复现笔记.md) — SeaCache 论文复现
- [SVDQuant.md](./预研/SVDQuant.md) — SVDQuant 量化分析
- [Triton-distributed序列并行Attention研究.md](./预研/Triton-distributed序列并行Attention研究.md) — Triton-distributed 序列并行 Attention
- [Sparse-Linear-Attention技术分析.md](./预研/Sparse-Linear-Attention技术分析.md) — Sparse Linear Attention 技术分析
- [SDNQ项目分析报告.md](./预研/SDNQ项目分析报告.md) — SDNQ 项目分析

### 视频生成
- [LTX-2.3模型总结.md](./预研/LTX-2.3模型总结.md) — LTX-2.3 同步音视频模型分析

### 图像编辑
- 知识地图：[图像编辑.md](./预研/图像编辑/图像编辑.md)
- [RegionE图像编辑.md](./预研/RegionE图像编辑.md) — RegionE 区域感知图像编辑
- [FPIE泊松融合使用指南.md](./预研/图像编辑/FPIE泊松融合使用指南.md) — FPIE 泊松融合（传统图像编辑）

### Bug 诊断
- 知识地图：[bugs.md](./预研/bugs/bugs.md)
- [代码诊断问题集.md](./预研/bugs/代码诊断问题集.md) — 引导式代码诊断问题集

---

## 💡 方法论

- 知识地图：[方法论.md](./方法论/方法论.md)
- [编程思维与架构设计.md](./方法论/编程思维与架构设计.md) — 编程思维与架构设计

---

## 🛠️ 工具

- 知识地图：[工具.md](./工具/工具.md)
- [github-cli使用指南.md](./工具/github-cli使用指南.md) — GitHub CLI 使用
- [SQL基本语法.md](./工具/SQL基本语法.md) — SQL 基础语法
- [Markdown规范.md](./工具/Markdown规范.md) — Markdown 写作规范
- [Linux常用命令.md](./工具/Linux常用命令.md) — Linux 常用命令
- [常用软件安装.md](./工具/常用软件安装.md) — 软件安装指南（miniconda/CUDA/PyTorch）
- [Python常用技巧.md](./工具/Python常用技巧.md) — Python 常用技巧（pdb/pip/import 路径）
- [apple-container-1.0.md](./工具/apple-container-1.0.md) — Apple Container 1.0 调研
- [VSCode-SFTP使用指南.md](./工具/VSCode-SFTP使用指南.md) — VSCode SFTP 配置
- [Hexo使用指南.md](./工具/Hexo使用指南.md) — Hexo 博客搭建

### 三方库
- 知识地图：[三方库.md](./工具/三方库/三方库.md)
- [rumps库使用.md](./工具/三方库/rumps库使用.md) — rumps（macOS 菜单栏 App）

---

## 📈 berkshire

- 知识地图：[berkshire.md](./berkshire/berkshire.md)
- [投资记录.md](./berkshire/投资记录.md) — 结构化投资记录（标的、策略、风控、复盘）

---

## 📋 PM

- 索引：[PM.md](./PM/PM.md)

PM 内部为项目制结构，每个子项目自含 `project-management.md` + `knowledge-summary.md`，不再额外建同级归纳。

- [optkit/](./PM/optkit/) — 推理优化工具
- [plexus/](./PM/plexus/) — Plexus 笔记 App
- [quick-launcher/](./PM/quick-launcher/) — 快速启动器
- [skills/](./PM/skills/) — 模块化编程技能
- [stock-analysis/](./PM/stock-analysis/) — 股票智能分析
- [workflows/](./PM/workflows/) — 工作流
- [云成本项目-算法监控/](./PM/云成本项目-算法监控/) — 云成本算法监控
- [量化/](./PM/量化/) — 量化交易

---

> 💡 按主题分类。**建议从目录级 .md 知识地图入手**，再下钻具体笔记。
