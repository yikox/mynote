---
format: arch-module/v0.1
name: 图片资产管线
described: 处理编辑器和聊天图片的捕获、压缩、解码、嗅探、写入和 data URL 读取
module_form: atomic
module_kind: adapter-io
secondary_kinds:
  - resource-file
  - function-flow
main_subject: assetsService + core::assets
status: draft
review_status: not-reviewed
---

# 图片资产管线

## 模块定位

该模块负责图片二进制在前端拖拽/粘贴、压缩、后端写入和预览读取之间的转换。证据路径：`src/hooks/useImageInput.ts`、`src/services/imageCapture.ts`、`src/services/imageCompress.ts`、`src/services/assets.ts`、`src/components/Editor/editorImages.ts`、`src/components/Editor/LocalImage.tsx`、`src-tauri/src/core/assets.rs`、`src-tauri/src/commands/assets.rs`。

## 外部契约

前端以 base64 传输图片，后端支持 PNG/JPEG/GIF/WEBP magic number 嗅探。单图大小限制为 10MB。读取返回 `data:<media>;base64,...`。

## 内外映射

编辑器图片落在 workspace 相对路径，通常是笔记附近的 assets 路径；聊天图片落在 `.plexus/chat-assets/<session>/...`，供 session 历史引用和缩略图读取。

## 失败模式

bad base64、超限、非支持图片类型、路径越界都会返回错误。前端用 notice 展示插入/附加失败。

## 与其他模块关系

复用 [笔记文件仓储](note-file-repository.md) 的路径安全读写；由 [Markdown 模块编辑引擎](markdown-module-engine.md) 和 [AI 聊天界面](ai-chat-surface.md) 调用。

## 验证方式

使用 `assets.rs`、`imageCapture.test.ts`、`editorImages.test.ts`、聊天附件相关测试。

