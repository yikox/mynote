---
name: Shared Assets
described: 八份模板：PM、知识、主设计、模块设计、模块变更、架构变更、ADR、AI 规则片段
module_form: atomic
module_kind: resource-file
main_subject: modular-programming/_shared/assets/
code_paths:
  - modular-programming/_shared/assets/**
status: implemented
review_status: reviewed
---

# Shared Assets

## Responsibility

初始化和设计文档的起始模板：`project-management-template.md`、`knowledge-summary-template.md`、`main-design-template.md`、`module-design-template.md`、`module-change-template.md`、`architecture-change-template.md`、`adr-template.md`、`ai-rules-snippet.md`（init 合并进目标项目 CLAUDE.md/AGENTS.md 的工作流规则片段，含 Preferences 区）。

## Public Contract

- 模板结构必须与 `storage-schema.md` 的 PM 章节和状态词表一致。
- `ai-rules-snippet.md` 约 30 行，写入目标项目 AI 文档时按项目调整路径和语言、合并不覆盖。

## Internal Design

- 模板留空表格 + 占位符（`<YYYY-MM-DD>` 等），agent 填充后即为合法文档。

## Dependencies

| Dependency | Direction | Reason |
| --- | --- | --- |
| modular-skills | in | init/architecture/change 使用模板创建新文件 |
| shared-references | out | 模板结构须与 storage-schema 保持同步 |

## Constraints

- 改 storage-schema 的章节结构时必须同步模板，反之亦然。

## Validation

- 用模板初始化一个项目后跑 `modular-review` 无结构性缺陷。

## Review Notes

- Review status: reviewed
