# LLM Wiki 设计指南

> 基于 Andrej Karpathy 的 LLM Wiki 理念：让 AI 从"生成答案"转变为"构建知识"

---

## 核心概念

### 什么是 LLM Wiki？

LLM Wiki 是一个**自维护的增量知识库**，由 LLM 驱动，持续积累和复合（compounding）。

**核心转变：**
- 传统 RAG：查询 → 检索 → 生成 → 遗忘（每次从零开始）
- LLM Wiki：摄取 → 提炼 → 持久化 → 持续增长

> "不要每次执行源码时才运行程序。编译一次成二进制，之后运行那个。"

---

## 三层架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3 — SCHEMA (CLAUDE.md / AGENTS.md)               │
│  定义规则：页面结构、摄取方式、答案格式                 │
└─────────────────────────────────────────────────────────┘
                           ↑
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2 — WIKI (LLM 维护的知识库)                     │
│  预综合、互联、始终就绪                                 │
└─────────────────────────────────────────────────────────┘
                           ↑
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 1 — RAW (原始来源)                               │
│  PDFs、笔记、文章（不可变）                              │
└─────────────────────────────────────────────────────────┘
```

---

## 文件结构

```
my-workspace/
├── CLAUDE.md          # Schema 配置（操作规则）
├── raw/               # 原始来源（Layer 1）
│   ├── articles/
│   ├── papers/
│   └── notes/
├── wiki/              # LLM 生成的知识库（Layer 2）
│   ├── index.md       # 页面目录（自动更新）
│   ├── log.md         # 操作历史（只追加）
│   ├── sources/       # 来源摘要页
│   ├── concepts/      # 概念页面
│   ├── people/        # 人物页面
│   ├── projects/      # 项目页面
│   └── .meta/
│       ├── schema.json       # PageSpec 页面类型定义
│       └── embeddings.json   # 向量索引
└── .llm/              # L1 记忆（git 排除，存凭证）
```

---

## 核心特征

### 1. 预综合（Pre-synthesized）
- LLM 一次性读取来源，提炼后永久存入 wiki
- 查询时直接读 wiki，无需实时检索

### 2. 互联性（Interlinked）
- 新文档被摄取时，自动链接到相关现有页面
- 跨来源交叉引用，而非孤立存储

### 3. 累积性（Compounding）
- 每次添加来源，wiki 变大、变智能
- 知识随时间复合增长

### 4. 自维护（Self-maintaining）
- LLM 自动更新页面、建立链接、标记过时内容

---

## 三大操作

### 1. INGEST — 摄取

```
输入: raw/ 中新增文档
↓ LLM 读取
↓ 提取核心论点（3-5 个关键点）
↓ 链接到相关现有页面（创建或更新）
↓ 更新 index.md
↓ append log.md

输出: 结构化的 wiki 页面，自动交叉引用
```

### 2. QUERY — 查询

```
输入: 用户问题
↓ LLM 查找相关 wiki 页面
↓ 综合多个来源的信息
↓ 生成连贯回答（标注信息来源）

输出: 基于累积知识的答案
```

### 3. LINT — 健康检查

```
输入: wiki 目录
↓ 扫描矛盾/过时内容
↓ 检查缺失的跨链接
↓ 标记 confidence:: stale 的页面

输出: 质量报告 + 修复建议
```

---

## Schema 设计

### Page Types & Properties

```yaml
# 实体页（人/工具/客户）
type:: entity
entity-type:: person | client | tool
created:: YYYY-MM-DD
updated:: YYYY-MM-DD
status:: active | inactive | archived

# 项目页
type:: project
status:: active | completed | on-hold

# 知识页
type:: knowledge
domain:: tech | business | content
confidence:: high | medium | low | stale

# 来源摘要页
type:: source
source-url::
source-date::
```

### Namespace Conventions

```
Wiki/Business      # 业务相关内容
Wiki/Tech          # 技术文档
Wiki/Content       # 内容创作
Wiki/Projects      # 项目跟踪
Wiki/People        # 人物档案
Wiki/Learning      # 学习笔记
Wiki/Reference     # 参考资料
Wiki/Careers       # 职业发展
```

**命名规范：**
- 标题用 Title Case
- 多单词用连字符分隔
- 最大深度: 3 层
- 文件名三下划线转义空格: `Wiki___Tech___Title.md`

---

## 页面结构示例

### 首次创建（空状态）

```markdown
---
type:: knowledge
domain:: tech
confidence:: low
---

## 标题
To be filled via /wiki ingest.
```

### 摄取后（完整状态）

```markdown
---
type:: knowledge
domain:: tech
confidence:: high
updated:: 2025-01-15
source:: [[来源摘要页]]
---

## 标题

### 核心概念
（提炼内容）

### 关键要点
1. ...
2. ...

### 相关链接
- [[相关概念A]]
- [[相关人物B]]
```

---

## 工具链

| 工具 | 用途 |
|------|------|
| **Obsidian** | 本地笔记管理 + 可视化 |
| **Claude Code** | CLI 驱动的 LLM agent |
| **Logseq** | 大纲式笔记 + 双向链接 |
| **Obsidian Web Clipper** | 网页剪藏 |

---

## 最佳实践

1. **从 Schema 开始** — 先定义页面类型和命名规范，LLM 才能一致输出
2. **保持 raw/ 不可变** — 原始来源是可信真相，wiki 是派生产物
3. **定期 LINT** — 检查矛盾和过时内容，保持质量
4. **分层记忆**：
   - L1 (`.llm/`)：敏感信息（API 密钥等），git 排除
   - L2 (wiki/)：结构化知识，版本控制
5. **复合优于覆盖** — 让知识增长，而非替换

---

## 参考资源

- [Karpathy LLM101n](https://github.com/karpathy/LLM101n)
- [Neural Networks: Zero to Hero](https://karpathy.ai/zero-to-hero.html)
- [LLM Wiki 原版 Idea](https://gist.github.com/karpathy)

---

## 核心隐喻

> **"Obsidian 是 IDE；LLM 是程序员；wiki 是代码库。"**

| 传统开发 | LLM Wiki |
|----------|----------|
| IDE | Obsidian / Logseq |
| 程序员 | LLM (Claude Code) |
| 代码库 | wiki/ 目录 |
| 编译 | Ingest |
| 运行 | Query |
| 调试 | Lint |

---

*最后更新: 2025-01*