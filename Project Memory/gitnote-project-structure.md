# GitNote Project Structure

## 产品定位
- GitNote 是一个 Markdown 笔记桌面 App，采用 filesystem-backed notes + 自动 git。
- 用户选择一个文件夹作为 GitNote `workspace`，笔记文件和目录与文件系统 1:1 映射。
- AI 助手作为 agent 工作，能通过 tools 读取、搜索、创建、更新、删除和移动 notes。

## 代码结构
- `src-tauri/` - Rust backend 和 Tauri commands。
- `src-tauri/src/core/` - 纯逻辑模块，包括 notes、git、config、sessions、search、ai_proxy、workspace_state 等。
- `src-tauri/src/commands/` - Tauri command 适配层，负责参数转换和调用 core。
- `src/` - React frontend。
- `src/services/` - 封装 Tauri `invoke`，如 `notesService`、`workspaceService`。
- `src/stores/` - Zustand stores，管理 workspace、tabs、settings、AI config 等状态。
- `src/ai/` - tools schema、system prompt、agent loop、context 管理。
- `src/components/` - UI 组件，主要分为 Layout、NoteTree、Editor、AIChat、Settings。
- `docs/` - 设计 spec、实现 plan、project-management 文档。

## GitNote workspace 结构
- `<workspace>/.git/` - GitNote 自动初始化的 git repo。
- `<workspace>/.gitnote/` - App 内部状态目录，不进入 git。
- `<workspace>/.gitnote/workspace.json` - tabs、active tab、sidebar width 等 workspace state。
- `<workspace>/.gitnote/sessions/` - AI sessions。
- 普通 `.md` 文件就是用户 notes；子目录就是 note folders。
