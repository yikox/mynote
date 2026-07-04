---
name: Shared References
described: 八份规则文档，模块化工作流的行为规范来源
module_form: atomic
module_kind: config-rule
main_subject: modular-programming/_shared/references/
code_paths:
  - modular-programming/_shared/references/**
status: implemented
review_status: reviewed
---

# Shared References

## Responsibility

存放所有 skill 共享的规则文档：`module-authoring-rules.md`（模块文档写作规范：粒度、各节边界、事实标注、更新触发器）、`modular-workflow-rules.md`（核心流程、Session Entry、路由速查表、用户确认点、Preference Profiles、L0-L3 定义）、`storage-schema.md`（项目记忆目录布局、PM 章节、状态词表）、`review-rules.md`（评审检查清单）、`migration-rules.md`（老项目迁移与 legacy skill 名映射）、`pm-maintenance-rules.md`（PM 归档/压缩细则）、`architecture-graph-json-format.md`（arch.json 格式规范）、`module-kind-classification.md`（module_kind 分类体系）。

## Public Contract

- Skill 通过 `../_shared/references/<name>.md` 相对路径读取。
- workflow-rules 是行为总纲；其余文档不得与其矛盾。
- 状态词表（draft/proposed/accepted/implemented 等）由 storage-schema 定义，全套统一使用。

## Internal Design

- 规则分层：workflow-rules（何时做什么）→ storage-schema（存哪儿、什么结构）→ 专项细则（review/migration/pm-maintenance/graph/kind）。

## Dependencies

| Dependency | Direction | Reason |
| --- | --- | --- |
| modular-skills | in | 被七个 skill 引用 |

## Constraints

- 新增规则先考虑并入现有文档，避免文件数膨胀。
- legacy skill 名（pm-*、architecture-design）只允许出现在 migration-rules 的映射表。

## Validation

- `grep -rn "pm-maintenance-rules" modular-programming/` 确认引用接线。

## Review Notes

- Review status: reviewed
