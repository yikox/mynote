# Modular Programming Skills 项目管理

Last updated: 2026-07-02

仓库：`/Users/zyc/work/skills`（记忆在本目录 `/Users/zyc/notes/PM/skills/`）

## Overview

- 一套 `modular-programming` skills，让 AI agent 按"先定位模块，再设计/实现"的方式开发项目。
- 产物：7 个 skill 指令包 + 共享规则/模板 + 图渲染器 + 安装器。

## Current Status

| Field | Value |
| --- | --- |
| Version | main @ dd1a78d |
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
| REQ-20260703-code-mapping | 2026-07-03 | 方向二：模块与代码对应关系（code_paths frontmatter + 所有权分割规则） | shared-references | modular-skills, shared-assets | L3 | frontmatter 契约扩展 + 定位/审计规则 | 全套 skill 遵守的持久约定 | implemented | P1 | commit 85bd2bc |
| REQ-20260703-relation-semantics | 2026-07-03 | 方向三：模块间关系语义（箭头=依赖方向、关系类型词表、图为权威来源） | shared-references | modular-skills, graph-renderer | L3 | 图格式语义扩展 + 一致性规则 | 与方向二合并为一个 L3 | implemented | P1 | commit 85bd2bc |
| REQ-20260703-module-authoring-rules | 2026-07-03 | 方向一：模块文档书写规范（粒度判定、各节写作边界、verified 标注、更新触发器） | shared-references | modular-skills | L2 | 新增 module-authoring-rules.md（模板未改，指导入规则文档） | 模块文档质量稳定 | implemented | P2 | commit aac35f6 |
| REQ-20260703-nesting-subgraphs | 2026-07-03 | 方向四：模块嵌套规则（单图一层嵌套、composite 子图分解、子模块文档路径） | shared-references | shared-assets, graph-renderer | L2 | storage-schema + 图格式扩展 | 依赖前三方向定型 | needs-clarification | P3 | 待方向一落地后评估 |
| REQ-20260702-audit-script | 2026-07-02 | 为 modular-audit 提供确定性检查脚本（原 check_pm_project.py 的新 schema 版） | modular-skills | shared-references | L2 | modular-audit/scripts/check_modular_project.py + SKILL Scripts 节 | 审计机械项可重复执行 | implemented | P2 | commit dd1a78d |

## Modular Design Index

| Type | Path | Status | Review | Notes |
| --- | --- | --- | --- | --- |
| Main Architecture | architecture/main-design.md | implemented | reviewed | 2026-07-02 初始化，模块地图经用户确认 |
| Module Change | architecture/modules/modular-skills/changes/2026-07-02-init-preferences.md | implemented | reviewed | L2，commit 23d8250 |
| Architecture Change | architecture/changes/2026-07-03-code-mapping-and-relation-semantics.md | implemented | reviewed | L3，commit 85bd2bc |
| Module Change | architecture/modules/shared-references/changes/2026-07-03-module-authoring-rules.md | implemented | reviewed | L2，commit aac35f6 |
| Module Change | architecture/modules/modular-skills/changes/2026-07-03-audit-check-script.md | implemented | reviewed | L2，commit dd1a78d |
| ADR | architecture/adrs/ADR-2026-07-03-code-ownership-and-relation-semantics.md | accepted | reviewed | code_paths 单一所有权、箭头=依赖、五词 kind、图为权威 |
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
| 2026-07-03 | architecture/adrs/ADR-2026-07-03-code-ownership-and-relation-semantics.md | code_paths 单一所有权内嵌 frontmatter；箭头=依赖方向 + 五词 kind；图为关系权威来源 | accepted | commit 85bd2bc |

## Archive

### Completed Work

| Date | Task / Requirement | Final Status | Evidence |
| --- | --- | --- | --- |
| 2026-07-02 | 融合 architecture-design + project-memory 为 modular-programming，补齐规则缺口，删除旧目录 | implemented | commits 4499d30/0aa0bba/22275eb，spec: docs/superpowers/specs/2026-07-02-modular-programming-cleanup-design.md |
| 2026-07-02 | 用户确认点清单 + ai-rules-snippet + Session Entry 语义修正 | implemented | commit 942ee88 |
| 2026-07-02 | 本仓库接入模块化工作流（modular-init dogfood） | implemented | 本目录全部文件；模块地图经用户确认；AGENTS.md/CLAUDE.md commit 0e50636 |
| 2026-07-02 | 渲染器：内联 name/described 覆盖时抑制 ref 文件缺字段告警（L1，graph-renderer） | implemented | commit 0e50636；验证：本仓库图零 warning、两张示例图回归通过、负向用例仍告警 |
| 2026-07-02 | init 偏好询问（docs-language、confirmation 粒度）落实到 AI 文档 Preferences 区（L2，modular-skills） | implemented | commit 23d8250；设计经 review + 要点摘要 + 用户确认；grep 五处接线验证、dry-run 通过；本仓库取 zh + standard |
| 2026-07-02 | 要点摘要必须内嵌确认请求本身，不得作为单独前置消息（L1，用户反馈驱动） | implemented | commit c1fdec1；5 处措辞修正（workflow-rules/change/architecture/snippet/AGENTS.md），grep 验证 |
| 2026-07-02 | 显式 bug 修复流程：至少 L1、先复现、回归验证、L2 设计含根因分析、边界根因确认升 L3（L1，modular-skills） | implemented | commit 5c31a9a；5 处接线（workflow-rules/change/snippet/README/AGENTS.md），grep 验证 |
| 2026-07-03 | L3：模块-代码映射 + 关系语义（方向二+三） | implemented | commit 85bd2bc；ADR accepted；验证：接线 grep 齐全、孤儿检查 NONE、本项目图+两示例图渲染零 warning；baseline 已更新（6 模块 code_paths、图 kind、main-design 约束） |
| 2026-07-03 | L2：模块文档书写规范 module-authoring-rules（方向一） | implemented | commit aac35f6；46 行合规；演练自查发现并修复 2 处依赖表-图不一致（graph-renderer 补图关系、installer 表裁剪为子集） |
| 2026-07-03 | L2：modular-audit 确定性检查脚本 | implemented | commit dd1a78d；本项目实测 0 error 0 warning；负向坏例触发 14 error/2 warning 退出码 1，七组检查全验证；dry-run 确认随 skill 分发 |

### Design Archive

| Type | Path | Final Status | Notes |
| --- | --- | --- | --- |
|  |  |  |  |

## Recent Updates

- 2026-07-03 - L2 完成：audit 确定性脚本 check_modular_project.py（七组检查：文件/frontmatter/所有权/图/表-图一致性/设计状态/PM 完整性）；本项目全绿，坏例 14 error 验证（dd1a78d）。
- 2026-07-03 - L2 完成：module-authoring-rules（粒度 4-9、各节硬规则、(inferred)/(unclear) 标注、更新触发器、kind 模板叠加）；演练自查修复 2 处表-图不一致（aac35f6）。方向四（嵌套/子图）留 backlog P3。
- 2026-07-03 - L3 完成：模块-代码映射（code_paths 单一所有权 + 确定性主模块定位 + 孤儿/幽灵审计）与关系语义（箭头=依赖、五词 kind、图为权威）；ADR-2026-07-03；本项目 baseline 已吃狗粮（85bd2bc）。方向一/四仍在 backlog（P2/P3）。
- 2026-07-02 - L1：定义显式 Bug Fix Path——bug 修复至少 L1、先复现后修、回归验证、L2 设计含根因分析、边界根因确认升 L3（5c31a9a）。
- 2026-07-02 - L1：用户反馈"方案出来后没看到总结就被问确认"——根因是摘要写在确认弹窗前的消息里可能不展示；规则改为摘要必须内嵌确认请求本身（c1fdec1）。
- 2026-07-02 - L2：init 增加偏好询问（docs-language、confirmation：high-touch/standard/low-touch，low-touch 保留安全底线），偏好写入项目 AI 文档 Preferences 区（23d8250）；本仓库取 zh + standard。
- 2026-07-02 - modular-init dogfood 完成：建立本项目记忆（PM/知识/架构 baseline + 图），模块地图 6 模块经用户确认；AGENTS.md + CLAUDE.md 入仓（0e50636）。
- 2026-07-02 - 修复 graph-renderer L1 缺陷：内联 name/described 覆盖时不再对 ref 文件缺字段告警（0e50636），本仓库图渲染零 warning。
- 2026-07-02 - 新增用户确认点机制：L2/L3 需 3-8 条要点摘要 + 用户确认，init 合并 ai-rules-snippet 进项目 AI 文档（942ee88）。
- 2026-07-02 - 完成套件融合与历史清理：pm-maintenance-rules、Session Entry、路由速查表、渲染器文档迁移；删除 legacy 目录（0aa0bba、22275eb）。
