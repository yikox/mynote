# 笔记库

> 个人知识管理与学习笔记库

---

## 📂 目录结构

| 目录 | 说明 |
| --- | --- |
| [神经网络/](#-神经网络--ai) | AI、深度学习、Agent、AIGC、并行策略 |
| [GPU编程/](#-gpu-编程) | OpenGL Compute Shader、GPU 编程与调试 |
| [编程语言/](#-编程语言) | Python、Rust、Swift、CUDA 等 |
| [计算机系统/](#-计算机系统) | 操作系统、编译原理、多线程、调试 |
| [预研/](#-预研) | 技术调研、模型分析、算法与论文复现 |
| [方法论/](#-方法论) | 编程思维、架构设计等通识方法论 |
| [工具/](#-工具) | 开发工具、三方库与常用软件指南 |
| [berkshire/](#-berkshire) | 投资记录与交易系统 |
| [PM/](#-pm) | 多项目管理(产品与技术) |

---

## 🧠 神经网络 & AI

### AI 应用

- [LLM应用设计指南.md](./神经网络/LLM应用设计指南.md) — LLM 应用设计指南
- [大语言模型架构分析.md](./神经网络/大语言模型架构分析.md) — LLM 架构分析

### Agent

- [上下文管理模块设计.md](./神经网络/Agent/上下文管理模块设计.md) — Agent 上下文管理模块设计

### 并行策略

- [DeepSpeed-Ulysses序列并行.md](./神经网络/并行策略/DeepSpeed-Ulysses序列并行.md) — DeepSpeed-Ulysses 序列并行
- [Ring-Attention环形注意力.md](./神经网络/并行策略/Ring-Attention环形注意力.md) — Ring-Attention 环形注意力

### AIGC

- [Nvidia-MPS使用指南.md](./神经网络/AIGC/Nvidia-MPS使用指南.md) — Nvidia MPS 使用
- [Polygraphy使用指南.md](./神经网络/AIGC/Polygraphy使用指南.md) — Polygraphy 工具

### 图像处理

- [NvJPEG使用指南.md](./神经网络/图像处理/NvJPEG使用指南.md) — NvJPEG 编解码(GPU 加速)

---

## 🎮 GPU 编程

- [OpenGLCS入门.md](./GPU编程/OpenGLCS入门.md) — OpenGL Compute Shader 入门
- [GLCS同步Bug分析.md](./GPU编程/GLCS同步Bug分析.md) — GLCS 在天玑芯片上的同步 Bug 案例

---

## 💻 编程语言

### Python

- [Python基础语法.md](./编程语言/Python/Python基础语法.md) — Python 基础语法
- [Python源.md](./编程语言/Python/Python源.md) — Python 源码解读
- [Torch编译架构.md](./编程语言/Python/Torch编译架构.md) — Torch 编译架构
- [Torch编译Inductor原理.md](./编程语言/Python/Torch编译Inductor原理.md) — Torch 编译 Inductor 原理

### CUDA

- [CUDA-Graph.md](./编程语言/CUDA/CUDA-Graph.md) — CUDA Graph

### Rust

- [Rust快速入门.md](./编程语言/Rust/Rust快速入门.md) — Rust 快速入门

### Swift

- [Swift学习笔记.md](./编程语言/Swift/Swift学习笔记.md) — Swift 学习笔记
- [Swift-Metal编程入门.md](./编程语言/Swift/Swift-Metal编程入门.md) — Swift Metal 编程
- [SwiftUI实战-TodoApp.md](./编程语言/Swift/SwiftUI实战-TodoApp.md) — SwiftUI 实战

---

## 🔧 计算机系统

- [操作系统.md](./计算机系统/操作系统.md) — 操作系统原理
- [MLIR入门.md](./计算机系统/MLIR入门.md) — MLIR 入门
- [多线程笔记.md](./计算机系统/多线程笔记.md) — 多线程编程
- [GDB调试笔记.md](./计算机系统/GDB调试笔记.md) — GDB 调试技术

---

## 🔬 预研

### 技术调研

- [DiCache扩散模型缓存加速.md](./预研/DiCache扩散模型缓存加速.md) — DiCache 扩散模型缓存加速
- [SeaCache论文复现笔记.md](./预研/SeaCache论文复现笔记.md) — SeaCache 论文复现
- [SVDQuant.md](./预研/SVDQuant.md) — SVDQuant 量化分析
- [Triton-distributed序列并行Attention研究.md](./预研/Triton-distributed序列并行Attention研究.md) — Triton-distributed 序列并行 Attention
- [Sparse-Linear-Attention技术分析.md](./预研/Sparse-Linear-Attention技术分析.md) — Sparse-Linear Attention 技术分析
- [SDNQ项目分析报告.md](./预研/SDNQ项目分析报告.md) — SDNQ 项目分析
- [LTX-2.3模型分析.md](./预研/LTX-2.3模型分析.md) — LTX-2.3 视频生成模型分析

### 图像编辑

- [FPIE泊松融合使用指南.md](./预研/图像编辑/FPIE泊松融合使用指南.md) — FPIE 泊松融合(快速图像编辑)
- [RegionE图像编辑.md](./预研/RegionE图像编辑.md) — RegionE 图像编辑

### Bug 案例

- [代码诊断问题集.md](./预研/bugs/代码诊断问题集.md) — 代码诊断问题集

### 其他

- [GitNote笔记修改点.md](./预研/GitNote笔记修改点.md) — GitNote 笔记修改记录

---

## 💡 方法论

- [编程思维与架构设计.md](./方法论/编程思维与架构设计.md) — 编程思维与架构设计

---

## 📋 PM

### optkit

推理优化工具项目。

- [project-management.md](./PM/optkit/project-management.md) — 项目管理
- [knowledge-summary.md](./PM/optkit/knowledge-summary.md) — 知识总结
- [v2-architecture.md](./PM/optkit/v2-architecture.md) — v2 架构设计

### plexus

Plexus 笔记 App 项目。

- [architecture/](./PM/plexus/architecture/) — 模块化架构设计(主设计文档 + 变更 + ADR)
- [archives/](./PM/plexus/archives/) — 历史版本与 v1 归档

### quick-launcher

快速启动器项目。

- [project-management.md](./PM/quick-launcher/project-management.md) — 项目管理
- [knowledge-summary.md](./PM/quick-launcher/knowledge-summary.md) — 知识总结

### skills

模块化编程技能项目。

- [project-management.md](./PM/skills/project-management.md) — 项目管理
- [knowledge-summary.md](./PM/skills/knowledge-summary.md) — 知识总结

### stock-analysis

股票智能分析项目。

- [project-management.md](./PM/stock-analysis/project-management.md) — 项目管理
- [knowledge-summary.md](./PM/stock-analysis/knowledge-summary.md) — 知识总结

### workflows

工作流项目。

- [project-management.md](./PM/workflows/project-management.md) — 项目管理
- [knowledge-summary.md](./PM/workflows/knowledge-summary.md) — 知识总结

### 云成本项目-算法监控

云成本算法监控项目。

- [project-management.md](./PM/云成本项目-算法监控/project-management.md) — 项目管理
- [knowledge-summary.md](./PM/云成本项目-算法监控/knowledge-summary.md) — 知识总结

### 量化

量化交易项目。

- [project-management.md](./PM/量化/project-management.md) — 项目管理
- [knowledge-summary.md](./PM/量化/knowledge-summary.md) — 知识总结

---

## 🛠️ 工具

- [github-cli使用指南.md](./工具/github-cli使用指南.md) — GitHub CLI 使用
- [SQL基本语法.md](./工具/SQL基本语法.md) — SQL 基础语法
- [Markdown规范.md](./工具/Markdown规范.md) — Markdown 写作规范
- [Linux常用命令.md](./工具/Linux常用命令.md) — Linux 常用命令
- [常用软件安装.md](./工具/常用软件安装.md) — 软件安装指南(miniconda/CUDA/PyTorch)
- [Python常用技巧.md](./工具/Python常用技巧.md) — Python 常用技巧(pdb/pip/import 路径)
- [apple-container-1.0.md](./工具/apple-container-1.0.md) — Apple Container 1.0 调研
- [VSCode-SFTP使用指南.md](./工具/VSCode-SFTP使用指南.md) — VSCode SFTP 配置
- [Hexo使用指南.md](./工具/Hexo使用指南.md) — Hexo 博客搭建

### 三方库

- [rumps库使用.md](./工具/三方库/rumps库使用.md) — rumps(macOS 菜单栏 App)

---

## 📈 berkshire

- [投资记录.md](./berkshire/投资记录.md) — 结构化投资记录(标的、策略、风控、复盘)

---

> 💡 按主题分类,点击链接可跳转查看详细内容
