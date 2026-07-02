---
name: Installer
described: 把 skill 套件 rsync 到各 agent skills 目录并清理 legacy 名称
module_form: atomic
module_kind: function-flow
main_subject: install.sh
status: implemented
review_status: reviewed
---

# Installer

## Responsibility

`install.sh`：发现仓库内全部 `SKILL.md`，把 `_shared` 和每个 skill 目录 rsync（`-a --delete`）到目标 skills 目录，并从目标目录删除 legacy skill 名称（`pm-*`、`architecture-design` 等）。支持 `--dry-run` 与自定义目标。

## Public Contract

- 默认目标：`~/.agents/skills`、`~/.codex/skills`、`~/.claude/skills`。
- 安装后布局：`<target>/_shared` 与 `<target>/modular-*` 同级，保证 skill 内 `../_shared/` 相对路径可用。
- `_shared` 整体同步（references、assets、scripts、examples 随套件一起分发）。

## Internal Design

- bash + rsync，无其他依赖；deprecated_skills 数组维护 legacy 名称清单。

## Dependencies

| Dependency | Direction | Reason |
| --- | --- | --- |
| modular-skills | out | 打包分发对象 |
| shared-references | out | 随 _shared 分发 |
| shared-assets | out | 随 _shared 分发 |
| graph-renderer | out | 随 _shared 分发 |
| examples | out | 随 _shared 分发 |

## Constraints

- 仓库删除 legacy 目录后，脚本不得再依赖它们存在。

## Validation

- `./install.sh --dry-run /tmp/x` 输出 `Installed 7 skill(s)`。

## Review Notes

- Review status: reviewed
