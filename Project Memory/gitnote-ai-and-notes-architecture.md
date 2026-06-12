# GitNote AI and Notes Architecture

## Notes tools
- AI tools 包括 `list_notes`、`read_note`、`search_notes`、`create_note`、`update_note`、`delete_note`、`move_note`。
- `list_notes` 默认只列直接子项，避免一次性读完整棵树。
- `search_notes` 使用 ripgrep 风格搜索，返回 path、line、content。
- `read_note` 支持 offset/limit，大文件应分页读取。
- `create_note`、`update_note`、`delete_note`、`move_note` 会触发写操作确认和自动 git commit；AI 写操作 commit 消息带 `[AI]` 前缀。

## System prompt
- 默认 system prompt 说明 AI 是 GitNote 笔记 App 的助手，并注入当前 `workspacePath`。
- 用户可在 `.gitnote/system-prompt.md` 自定义模板。
- 模板可使用 `{{workspacePath}}` 和 `{{treePreview}}`。

## 数据位置
- 全局配置在 `~/.gitnote/config.json`，主要记录 active `workspace` 和 UI 设置。
- Provider 配置在 `~/.gitnote/providers.json`，不含 API key。
- API key 不进入 frontend JS 内存，不写入 notes repo。
- per-workspace runtime state 位于 `<workspace>/.gitnote/`，该目录被 `.gitignore` 排除。
