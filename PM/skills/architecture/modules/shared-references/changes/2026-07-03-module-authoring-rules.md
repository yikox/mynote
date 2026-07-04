---
title: 模块文档书写规范
level: L2
status: implemented
review_status: reviewed
primary_module: shared-references
impacted_modules: [modular-skills]
---

# 模块文档书写规范

## Request

方向一：模块文档写成什么样才算合格目前靠 agent 自觉。需要一份 authoring 规则回答：粒度判定（什么配立档）、各节写作边界、事实确定度标注、更新触发器、kind 专用模板与通用模板的关系。

## Current Module State

- module-design-template 给了七节结构，但每节写多少、写什么、不写什么没有规则。
- `verified / inferred / unclear` 只在 migration-rules 出现，正常开发中不确定的事实没有标注机制。
- 何时必须更新模块文档只有零散提法（"baseline would otherwise be stale"），没有明确触发清单。
- module-kind-classification 里各 kind 有专用文档模板，与通用模板谁优先没说。
- 没有粒度指导：什么东西配一个模块文档、顶层模块几个合适。

## Target Module Design

新增 `_shared/references/module-authoring-rules.md`，六节：

1. **Granularity**：顶层模块 4-9 个；atomic 模块 = 一个可独立理解、独立验证的技术职责；小于此的是模块内部实现，不单独立档；composite 用于"外部只需要知道整体、内部子模块彼此强相关"的场景。
2. **Section Rules**（对齐模板七节）：Responsibility ≤3 句、只写 what 不写 how；Public Contract 必须具体到别人实际依赖的表面（签名/格式/CLI/目录约定），无外部依赖者须显式写明"无外部契约"；Internal Design 只写读代码前需要知道的，禁止复述代码；Dependencies 是图的子集（引用既有规则）；Constraints 只写不可从代码推出的约束；Validation 必须是可执行的命令或检查。
3. **Fact Confidence**：`verified / inferred / unclear` 从迁移规则升级为通用机制——任何不确定的事实行内标注 `(inferred)` 或 `(unclear)`，review 检查不确定事实不得伪装成事实。
4. **Update Triggers**：公共契约、依赖关系、约束、code_paths 变了必须同步文档；纯内部实现变化不强制。列为清单。
5. **Length Guidance**：目标 30-80 行；显著超长 = 拆分信号或该下沉到代码/子文档。
6. **Kind Templates**：通用 module-design-template 为基座；当 kind 的主设计载体需要专用节（如 function-flow 的流程步骤、data-state 的状态机）时，从 module-kind-classification 的对应模板取节合入，通用节不删。

接线：modular-architecture 与 modular-init 的 Required References 增加该文档；review-rules 增加"不确定事实已标注、模块文档符合 authoring 规则"检查项。模板本身不改（指导性内容放规则文档，避免污染复制到项目里的模板实例）。

## Contract Impact

无外部契约变化：纯新增规则文档 + 引用接线。存量模块文档不追溯强制，audit/review 提示改进。

## Implementation Outline

新建 module-authoring-rules.md → modular-architecture / modular-init SKILL 引用 → review-rules 补检查项 → README 一句提及 → install 同步。

## Validation

- grep 验证四处接线（新文档 + 两个 SKILL + review-rules）。
- 用本项目 6 个模块文档对照规则自查一遍，作为规则可用性演练（发现的问题按 L0/L1 顺手修）。

## Risks

- 规则过细导致写文档负担：各节规则控制在 1-3 条硬规则 + 反例，总文档 ≤ 100 行。
- 与 kind 分类文档重复：authoring 只讲"怎么写"，kind 文档讲"哪类模块长什么样"，交叉处只引用不复制。

## Review Notes

- Review status: reviewed（2026-07-03 modular-review 通过，无阻塞项）
