---
name: Modular Programming Skills Architecture
status: implemented
review_status: reviewed
---

# Modular Programming Skills 仓库架构

## Scope

仓库 `/Users/zyc/work/skills`：一套让 AI agent 按"先定位模块，再设计/实现"方式开发项目的 skill 套件。产物是 Markdown 指令/规则/模板 + 一个 Python 图渲染器 + bash 安装器；无服务、无持久化状态。使用者是 Claude Code / Codex 等 agent 及其用户。项目记忆在 `/Users/zyc/notes/PM/skills/`（本目录）。

## Module Map

| Module | Form | Kind | Responsibility | Status |
| --- | --- | --- | --- | --- |
| [modular-skills](modules/modular-skills.md) | composite | config-rule | 七个 skill 指令包，工作流入口 | implemented |
| [shared-references](modules/shared-references.md) | atomic | config-rule | 七份共享规则文档，行为规范来源 | implemented |
| [shared-assets](modules/shared-assets.md) | atomic | resource-file | 八份模板（PM/知识/设计/变更/ADR/AI 规则片段） | implemented |
| [graph-renderer](modules/graph-renderer.md) | atomic | function-flow | `.arch.json` → HTML/SVG 渲染脚本 | implemented |
| [examples](modules/examples.md) | atomic | resource-file | 可渲染示例图与模块文档样例 | implemented |
| [installer](modules/installer.md) | atomic | function-flow | `install.sh` 分发套件、清理 legacy 名称 | implemented |

仓库内 `docs/superpowers/`（specs/plans）是开发过程产物，不属于模块地图，由 PM 设计索引管理。

## Architecture Graph

- Source: `architecture/graphs/current-project.arch.json`
- Rendered: `architecture/rendered/current-project-architecture.html`

## Cross-Module Flow

- agent 触发某个 skill → SKILL.md 指令引用 `../_shared/references/` 规则与 `../_shared/assets/` 模板 → `modular-architecture` 需要出图时调用 graph-renderer。
- graph-renderer 的输入契约由 shared-references 的图格式文档定义，examples 是其回归夹具。
- installer 把 modular-skills + 整个 `_shared`（references/assets/scripts/examples）rsync 到 `~/.agents|.codex|.claude/skills`，安装后 `../_shared/` 相对路径保持有效。

## Shared Constraints

- Skill 正文英文 + description 含中文触发词；措辞 agent 中性。
- legacy 名称（pm-*、architecture-design）只允许出现在 migration-rules 映射与 installer 清理数组。
- 渲染器仅用 Python 3 标准库；warning 视为问题。
- 模板结构与 storage-schema 双向同步。

## Open Questions

- 是否为 modular-audit 提供确定性检查脚本（原 check_pm_project.py 的新 schema 版），见 PM backlog。

## Review Notes

- Review status: reviewed（2026-07-02 初始化，模块地图经用户确认）
