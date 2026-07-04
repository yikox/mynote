---
title: Init 定制化偏好询问
level: L2
status: implemented
review_status: reviewed
primary_module: modular-skills
impacted_modules: [shared-assets, shared-references]
---

# Init 定制化偏好询问

## Request

`modular-init` 初始化时向用户询问定制化偏好（至少：文档语言、确认粒度），并把偏好落实到目标项目文档，让后续所有 skill 会话遵守。

## Current Module State

- init 会问项目目标/运行环境等**事实**问题，但不问用户**偏好**。
- 确认粒度由 workflow-rules 的 User Confirmation Points 一刀切：L2/L3 全部阻塞确认。
- 文档语言无规则，agent 看情况自行决定（本项目实际混用：skill 正文英文、PM 中文）。
- ai-rules-snippet 无偏好区，偏好没有落地载体。

## Target Module Design

### 偏好集（首版两项，可扩展）

| 偏好 | 取值 | 语义 |
| --- | --- | --- |
| `docs-language` | `zh` / `en` / `follow-project` | PM、架构文档、知识文档、设计文档、要点摘要的书写语言；`follow-project` = 跟随项目现有文档主导语言 |
| `confirmation` | `high-touch` / `standard` / `low-touch` | 见下表 |

### 确认粒度语义（在 workflow-rules User Confirmation Points 基础上调整）

| Profile | 语义 |
| --- | --- |
| `high-touch` | 标准确认点全保留；额外：L1 实现前也给一句摘要并确认；L2/L3 设计按节展示确认 |
| `standard` | 即现有 User Confirmation Points，不变（默认值） |
| `low-touch` | L2 确认降级为"发要点摘要后直接实现，用户可随时叫停"；L3 方向接受、模块地图落盘、AI 文档首次写入、L2→L3 升级**仍阻塞**（安全底线不降） |

### 存放位置（单一事实来源）

偏好写入目标项目 AI 文档（CLAUDE.md/AGENTS.md）中 ai-rules-snippet 的新增 `## Preferences` 区，每会话自动进上下文。PM 不重复存。

### 修改点

1. `modular-init/SKILL.md`：workflow 增加一步——确定模式后、创建文件前，询问偏好（语言、确认粒度，用选择题）；合并 snippet 时填入偏好；报告中含偏好。
2. `_shared/assets/ai-rules-snippet.md`：新增 `## Preferences` 区（两行设置 + 语义指引占位）。
3. `_shared/references/modular-workflow-rules.md`：User Confirmation Points 后新增 "Preference Profiles" 小节，定义两个偏好的取值与语义（上表），并声明：未设置时按 `standard` + `follow-project`。
4. `README.md`：init 说明补一句偏好询问。
5. 本仓库 `AGENTS.md`：作为 dogfood 补上自己的 Preferences（`docs-language: zh`、`confirmation: standard`——待用户确认取值）。

## Contract Impact

- skill ↔ shared-references 契约扩展（新增偏好语义节），向后兼容：未设置偏好的存量项目按默认值，行为与现状一致。
- ai-rules-snippet 模板结构新增一节，不影响已合并的项目（audit 可提示补齐）。

## Implementation Outline

按修改点 1-5 顺序落地；`./install.sh` 同步；用 `--dry-run` 与渲染回归验证无破坏。

## Validation

- `grep -n "Preferences" modular-programming/_shared/assets/ai-rules-snippet.md modular-programming/_shared/references/modular-workflow-rules.md modular-programming/modular-init/SKILL.md` 三处接线齐全。
- 语义一致性：low-touch 不得弱化 L3/模块地图/AI 文档首写确认（人工检查表格）。

## Risks

- 偏好膨胀：首版只收两项，其余需求先进 backlog。
- low-touch 被误解为"全不确认"：语义表里明确列出仍阻塞项。
- 已接入项目（本仓库）snippet 无 Preferences 区：本次顺带补齐，其他项目由 modular-audit 检查。

## Review Notes

- Review status: reviewed（2026-07-02 modular-review 检查通过：模块归属、级别、契约兼容、验证具体性均无阻塞项；开放问题=本仓库自身偏好取值）
