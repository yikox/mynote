---
name: Modular Skills
described: 七个 modular-* skill 指令包，agent 使用模块化工作流的入口
module_form: composite
module_kind: config-rule
main_subject: modular-programming/*/SKILL.md
code_paths:
  - modular-programming/modular-init/**
  - modular-programming/modular-architecture/**
  - modular-programming/modular-change/**
  - modular-programming/modular-status/**
  - modular-programming/modular-review/**
  - modular-programming/modular-audit/**
  - modular-programming/modular-knowledge/**
status: implemented
review_status: reviewed
---

# Modular Skills

## Responsibility

面向 agent 的七个 skill 指令包（`modular-init`、`modular-architecture`、`modular-change`、`modular-status`、`modular-review`、`modular-audit`、`modular-knowledge`），每个包含 `SKILL.md`（frontmatter description + 工作流指令）和 `agents/openai.yaml`（Codex 元数据）。它们定义 agent 在目标项目里怎么走模块化流程。

## Public Contract

- `SKILL.md` frontmatter `description` 是技能触发契约（含中文触发词）。
- 每个 skill 通过 `../_shared/references/*.md` 相对路径读取规则，通过 `../_shared/assets/*.md` 使用模板；安装后布局必须保持 `_shared` 与 skill 目录同级。
- 分工：init 接入/修复；architecture 模块地图与图；change 日常修改入口（L0-L3 路由）；status 记 PM；review 自动评审；audit 审计迁移；knowledge 记知识。

## Internal Design

- 所有非平凡流程规则集中在 shared-references，SKILL.md 只保留每个 skill 特有的 workflow 步骤，避免重复。
- 用户确认点（模块地图落盘、L2/L3 要点摘要+确认、L2→L3 升级等）由 workflow-rules 统一定义，SKILL.md 在对应步骤内嵌。
- modular-audit 自带确定性检查脚本 `scripts/check_modular_project.py`（文件/schema/所有权/图/表-图一致性/PM 完整性），随 skill 目录安装。
- init 询问工作流偏好（docs-language、confirmation 粒度）并写入目标项目 AI 文档 Preferences 区；偏好语义在 workflow-rules 的 Preference Profiles，low-touch 不降安全底线。

## Dependencies

| Dependency | Direction | Reason |
| --- | --- | --- |
| shared-references | out | 读取工作流/存储/评审/迁移/PM 维护规则 |
| shared-assets | out | 初始化和设计时使用模板 |
| graph-renderer | out | modular-architecture 渲染架构图 |

## Constraints

- 描述与正文使用 agent 中性措辞，不绑定单一 agent 产品。
- 英文正文 + description 内保留中文触发词。

## Validation

- `find modular-programming -name SKILL.md` 应列出 7 个。
- `./install.sh --dry-run <tmp>` 只安装 `_shared` + 7 个 skill。

## Review Notes

- Review status: reviewed（2026-07-02 会话中逐个通读并完善）
