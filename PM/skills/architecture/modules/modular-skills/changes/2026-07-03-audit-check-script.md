---
title: modular-audit 确定性检查脚本
level: L2
status: implemented
review_status: reviewed
primary_module: modular-skills
impacted_modules: [shared-references]
---

# modular-audit 确定性检查脚本

## Request

REQ-20260702-audit-script：modular-audit 目前全靠 agent 阅读判断，需要一个可重复执行的脚本做机械检查。code_paths 与关系语义落地后（85bd2bc），检查面已齐备。

## Current Module State

- modular-audit SKILL 列出检查项但无工具支撑；孤儿/幽灵/重叠、frontmatter schema、词表、表-图一致性都是纯手工。
- 旧 `check_pm_project.py`（git 历史 22275eb 前）检查旧 pm schema，不适配新 storage-schema。

## Target Module Design

### 位置与归属

`modular-programming/modular-audit/scripts/check_modular_project.py`——归 modular-skills 所有（modular-audit/** 已在其 code_paths 内），随 skill 目录整体安装，不进 `_shared/scripts/`（那是 graph-renderer 的所有权）。Python 3 标准库，无第三方依赖，输出中文，与渲染器一致。

### CLI

```text
python3 check_modular_project.py <pm-root> [--repo-root <path>]
```

`<pm-root>` = 含 project-management.md 与 architecture/ 的目录。`--repo-root` 提供时才做代码所有权检查。退出码：有 error 为 1，仅 warning 为 0。

### 检查项（全部确定性）

| 组 | 检查 | 级别 |
| --- | --- | --- |
| files | project-management.md / knowledge-summary.md / architecture/main-design.md 存在 | error |
| frontmatter | 模块文档必填字段齐全；module_form ∈ {atomic, composite}；module_kind ∈ 九分类；status/review_status ∈ 词表 | error |
| frontmatter | code_paths 缺失（存量补齐提示） | warning |
| ownership | 幽灵 glob（匹配不到文件）；重叠认领（同一文件两模块） | error |
| ownership | 孤儿路径（未被认领且不在默认元文件排除表：README*/LICENSE*/CLAUDE.md/AGENTS.md/.git*/.github/**/隐藏文件） | warning |
| graph | JSON 可解析；format 合法；relation 端点存在；kind ∈ 五词表；style ∈ {solid,dashed}；ref 指向存在的文件 | error |
| consistency | 模块文档 Dependencies 表 ⊆ 图关系（按 out/in 方向匹配） | error |
| designs | changes/adrs 文档 frontmatter status/review_status ∈ 词表 | error |
| pm | Active Tasks 表存在；L1/L2/L3 行主模块非空；Design Index 中路径存在于磁盘 | error |

### 接线

- modular-audit SKILL 增加 Scripts 节：审计开始时运行脚本，脚本结果并入报告（脚本管机械项，agent 管语义项）。
- 假设：glob 用 `fnmatch` + `**` 前缀匹配语义，与 85bd2bc 的 assumption 一致，本次即为"脚本落地时精确化"。（此定义写进脚本 docstring）

## Contract Impact

无外部契约变化：新增工具 + SKILL 接线。脚本对合法存量项目只报 warning 不报 error（code_paths 缺失是 warning）。

## Implementation Outline

写脚本 → 用本项目 PM 目录实测（dogfood，发现的问题顺手修）→ 构造一个坏例验证 error 路径 → SKILL 接线 → install 同步。

## Validation

- `python3 .../check_modular_project.py /Users/zyc/notes/PM/skills --repo-root /Users/zyc/work/skills` 跑通，报告可读。
- 负向用例：临时坏 PM 目录（缺文件、坏 kind、幽灵 glob、表-图漂移）各触发对应 error，退出码 1。
- `./install.sh --dry-run` 确认脚本随 modular-audit 分发。

## Risks

- markdown 表解析脆弱：只解析本套件模板产出的表结构（管道分隔、表头识别），非模板格式跳过并 warning "无法解析"，不误报。
- 孤儿检查误报：默认排除表 + 仅 --repo-root 显式提供时启用，报 warning 不报 error。

## Review Notes

- Review status: reviewed（2026-07-03 modular-review：单主模块、契约不变、实现/验证具体、脆弱点有降级策略，无阻塞项）
