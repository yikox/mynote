---
title: ADR-2026-07-03-code-ownership-and-relation-semantics
status: accepted
review_status: reviewed
---

# ADR-2026-07-03-Code Ownership And Relation Semantics

## Context

模块化工作流需要回答两个持久问题：模块如何锚定代码（否则地图与代码脱节、主模块无法机械定位），以及关系箭头是什么意思（否则每张图语义不一致）。

## Decision

1. **代码所有权内嵌 frontmatter**：模块文档 frontmatter `code_paths`（仓库相对 glob 列表）声明所有权；每个承载行为的路径属于且只属于一个模块。
2. **箭头 = 依赖方向**：`A -> B` 读作 A 依赖/使用 B；数据流向不同则写 described。
3. **关系 kind 封闭五词**：`uses`（默认）/`reads`/`writes`/`triggers`/`distributes`；`solid` = 运行时依赖，`dashed` = 非运行时。
4. **图是模块间关系的权威来源**：模块文档 Dependencies 表是图关系的子集视图。

## Alternatives Considered

| Alternative | Reason Not Chosen |
| --- | --- |
| 独立 modules.json 映射清单 | 第二真相源，与模块文档漂移 |
| UML 完整关系词表 | 表达力过剩，agent 难以一致使用 |
| 箭头表示数据流向 | 修改路由需要依赖方向；数据流可写 described |
| Dependencies 表为权威、图为视图 | 图承担校验（同层规则、端点存在性），作为权威更可检查 |

## Consequences

- modular-change 可确定性定位主模块；modular-audit 获得孤儿/幽灵/一致性三个机械检查点。
- 新建与迁移必填 code_paths；存量文档由 audit 提示补齐，不追溯强制。
- 渲染器无需改动（宽容未知字段）；kind 的可视化是未来增强。

## Follow-Up

- REQ-20260702-audit-script：脚本落地时精确化 glob 语义。
- REQ-20260703-module-authoring-rules（方向一）与 REQ-20260703-nesting-subgraphs（方向四）在此约定之上展开。
