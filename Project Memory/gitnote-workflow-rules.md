# GitNote Workflow Rules

## Agent 规则
- 不要自动打开或自动化 browser；只有用户明确要求 browser use 时才使用 browser。
- 普通代码变更完成前运行 `npm run build`。
- 需要 packaged build 或 DMG 验证时运行 `npm run build:dmg`，必要时用 elevated execution。
- 不要读取或展示 `~/.gitnote/secrets.json` 的内容；API key 只应保存在本机 secrets/keychain 相关位置。

## 代码修改习惯
- 优先遵循现有分层：Rust core 放纯逻辑，commands 做 Tauri 适配，frontend 通过 services 调 `invoke`。
- notes 相关路径应保持 workspace-relative POSIX path，不应允许 `..` 越出 workspace root。
- `update_note` 是整文件覆盖，调用前应读取旧内容并尽量提供 diff/preview。
- AI 写操作需要确认；开启自动确认时也要保持结果可追踪。

## 项目记忆
- 使用 `$gitnote-project-memory` 时，把项目记忆写入 GitNote active `workspace` 的 `Project Memory/`。
- 语言使用中文，但保留 `workspace`、`tool`、`build:dmg`、`Tauri`、`CodeMirror` 等原始英文术语。
- 不把这类共享项目记忆写进外部 per-agent memory。
