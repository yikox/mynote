# Modular Programming Skills 项目管理

Last updated: 2026-07-02

仓库：`/Users/zyc/work/skills`（记忆在本目录 `/Users/zyc/notes/PM/skills/`）

## Overview

- 一套 `modular-programming` skills，让 AI agent 按"先定位模块，再设计/实现"的方式开发项目。
- 产物：7 个 skill 指令包 + 共享规则/模板 + 图渲染器 + 安装器。

## Current Status

| Field | Value |
| --- | --- |
| Version | main @ 0e50636 |
| State | 套件融合完成，已接入模块化工作流（dogfood） |
| Current focus | 完善使用流程细节，实际项目试用 |
| Architecture baseline | architecture/main-design.md |

## Active Tasks

| Date | Task | Primary Module | Impacted Modules | Level | Status | Next Step / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| - | 暂无进行中任务 | - | - | - | - | - |

## Requirements / Change Backlog

| ID | Date | Request | Primary Module | Impacted Modules | Level | Change Summary | Scope / Impact | Status | Priority | Design Path / Next Step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-20260702-audit-script | 2026-07-02 | 为 modular-audit 提供确定性检查脚本（原 check_pm_project.py 的新 schema 版） | modular-skills | shared-references | L2 | 新增脚本 + audit SKILL 接线 | 提升审计可重复性 | ready-for-design | P2 | 需要时从 git 历史找回旧脚本参考 |

## Modular Design Index

| Type | Path | Status | Review | Notes |
| --- | --- | --- | --- | --- |
| Main Architecture | architecture/main-design.md | implemented | reviewed | 2026-07-02 初始化，模块地图经用户确认 |
| Module | architecture/modules/modular-skills.md | implemented | reviewed |  |
| Module | architecture/modules/shared-references.md | implemented | reviewed |  |
| Module | architecture/modules/shared-assets.md | implemented | reviewed |  |
| Module | architecture/modules/graph-renderer.md | implemented | reviewed |  |
| Module | architecture/modules/examples.md | implemented | reviewed |  |
| Module | architecture/modules/installer.md | implemented | reviewed |  |

开发过程文档（不属于模块地图）：仓库 `docs/superpowers/specs|plans/2026-07-02-modular-programming-cleanup*.md`。

## Roadmap

| Priority | Item | Primary Module | Status | Notes |
| --- | --- | --- | --- | --- |
| P1 | 在真实项目上试用整套工作流并回收问题 | modular-skills | planned | 用 plexus 或 quick-launcher 等现有项目 |
| P2 | modular-audit 确定性检查脚本 | modular-skills | backlog | REQ-20260702-audit-script |

## Milestones

| Milestone | Status | Notes |
| --- | --- | --- |
| project-memory + architecture-design 融合为 modular-programming | done | 2026-07-02，commits 0aa0bba/22275eb |
| 用户确认点 + AI 规则片段机制 | done | 2026-07-02，commit 942ee88 |
| 本仓库自身接入工作流（dogfood） | done | 2026-07-02，本目录建立 |

## Testing and Validation

- `./install.sh --dry-run /tmp/x`：只安装 `_shared` + 7 个 modular-* skill。
- `python3 modular-programming/_shared/scripts/render_modular_graph.py modular-programming/_shared/examples/system-overview.arch.json -o /tmp/graph.html`：无 warning。
- 本仓库图：`architecture/graphs/current-project.arch.json` 渲染零 warning（2026-07-02 验证）。

## Blockers and Risks

| Risk / Blocker | Impact | Mitigation / Status |
| --- | --- | --- |
| 工作流规则较多，agent 可能不完全遵守 | 流程漂移 | ai-rules-snippet 进项目 AI 文档；modular-review/audit 兜底 |

## ADR Summary

| Date | ADR | Decision | Status | Notes |
| --- | --- | --- | --- | --- |
| - | - | 暂无 ADR | - | 融合决策记录在仓库 docs/superpowers/specs |

## Archive

### Completed Work

| Date | Task / Requirement | Final Status | Evidence |
| --- | --- | --- | --- |
| 2026-07-02 | 融合 architecture-design + project-memory 为 modular-programming，补齐规则缺口，删除旧目录 | implemented | commits 4499d30/0aa0bba/22275eb，spec: docs/superpowers/specs/2026-07-02-modular-programming-cleanup-design.md |
| 2026-07-02 | 用户确认点清单 + ai-rules-snippet + Session Entry 语义修正 | implemented | commit 942ee88 |
| 2026-07-02 | 本仓库接入模块化工作流（modular-init dogfood） | implemented | 本目录全部文件；模块地图经用户确认；AGENTS.md/CLAUDE.md commit 0e50636 |
| 2026-07-02 | 渲染器：内联 name/described 覆盖时抑制 ref 文件缺字段告警（L1，graph-renderer） | implemented | commit 0e50636；验证：本仓库图零 warning、两张示例图回归通过、负向用例仍告警 |

### Design Archive

| Type | Path | Final Status | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

## Recent Updates

- 2026-07-02 - modular-init dogfood 完成：建立本项目记忆（PM/知识/架构 baseline + 图），模块地图 6 模块经用户确认；AGENTS.md + CLAUDE.md 入仓（0e50636）。
- 2026-07-02 - 修复 graph-renderer L1 缺陷：内联 name/described 覆盖时不再对 ref 文件缺字段告警（0e50636），本仓库图渲染零 warning。
- 2026-07-02 - 新增用户确认点机制：L2/L3 需 3-8 条要点摘要 + 用户确认，init 合并 ai-rules-snippet 进项目 AI 文档（942ee88）。
- 2026-07-02 - 完成套件融合与历史清理：pm-maintenance-rules、Session Entry、路由速查表、渲染器文档迁移；删除 legacy 目录（0aa0bba、22275eb）。
