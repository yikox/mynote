# Modular Programming Skills 知识摘要

Last updated: 2026-07-02

## Verified Commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `./install.sh` | 安装套件到 ~/.agents、~/.codex、~/.claude 的 skills 目录 | rsync -a --delete，会清理 legacy 名称 |
| `./install.sh --dry-run <dir>` | 预览安装 | 应输出 Installed 7 skill(s) |
| `python3 modular-programming/_shared/scripts/render_modular_graph.py <graph.arch.json> -o <out.html> [--svg-output <out.svg>]` | 渲染架构图 | warning 视为问题 |

## Architecture Facts

- 记忆位置：`/Users/zyc/notes/PM/skills/`（用户统一在 ~/notes/PM/ 管理多项目记忆）。
- 渲染器内部模块文档在仓库 `modular-programming/_shared/scripts/renderer-docs/`，改脚本前先读。
- 安装后布局：`<target>/_shared` 与 `<target>/modular-*` 同级，skill 内 `../_shared/` 相对路径依赖此布局。
- 图 JSON ref 路径相对 JSON 文件本身；本项目图引用仓库 SKILL.md 需 5 级向上（notes/PM/skills/architecture/graphs → /Users/zyc）。

## Conventions

- Skill 正文英文，description 含中文触发词，措辞 agent 中性（不写 Codex/Claude 专名）。
- legacy 名称（pm-*、architecture-design）只允许出现在 migration-rules 映射与 install.sh 清理数组。
- 提交信息末尾带 Co-Authored-By（Claude）；文档类改动也分主题提交。

## Troubleshooting

| Symptom | Cause | Fix / Evidence |
| --- | --- | --- |
| 渲染告警"引用文件不存在" | 图 JSON ref 相对路径层级算错 | 从 JSON 所在目录数层级；本项目需 ../../../../../ |
| 渲染告警"引用文件缺少 described" | ref 指向的文件 front matter 无 described 且对象无内联覆盖（有内联覆盖不再告警，0e50636 起） | 给 ref 文件补 described 或在对象上内联 |

## Reusable Lessons

- 修改仓库里的 skill 后要跑 `./install.sh`，否则 ~/.claude/skills 等安装副本仍是旧版。
- SKILL.md front matter 用 `description`（skill 协议），模块文档用 `described`（图渲染协议），两者不通用。
