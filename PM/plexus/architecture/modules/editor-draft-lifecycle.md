---
format: arch-module/v0.1
name: 编辑器草稿生命周期
described: 管理笔记加载、草稿变更、防抖保存、脏标记、外部变更和卸载 flush
module_form: atomic
module_kind: data-state
secondary_kinds:
  - event-message
  - function-flow
main_subject: useNoteDraft()
status: draft
review_status: not-reviewed
---

# 编辑器草稿生命周期

## 模块定位

该模块是单个打开笔记的前端编辑状态所有者。证据路径：`src/components/Editor/useNoteDraft.ts`、`src/components/Editor/activeDraftFlush.ts`、`src/components/Editor/MarkdownEditor.tsx`、`src/stores/tabsStore.ts`。

## 数据模型

核心 ref/state 包括 `draftRef`、`lastSavedRef`、`draftRevisionRef`、`pendingSaveRef`、`inactiveFlushesRef`、`externalState`、`saveStatus`。Tab dirty 状态由 `tabsStore.markDirty()` 同步。

## 状态流转

加载路径时读取文件并建立基线；用户输入后变为 dirty/saving；800ms 防抖后写回；成功则更新 `lastSavedRef` 并标记 saved；失败则标记 failed。组件卸载时若有脏草稿，会通过 inactive flush 继续保存。

## 读写路径

读取和保存全部通过 `notesService.read/update()`。外部文件变化通过 `onNotesChanged()` 触发 reconcile，检测自写回声、外部冲突或删除。

## 一致性与并发

保存使用 request id、revision 和 content 三重校验，避免旧请求覆盖新草稿。切换路径时清理 timer 并递增 request。

## 与其他模块关系

向 [Markdown 模块编辑引擎](markdown-module-engine.md) 提供 `value/onChange`，向 [笔记文件仓储](note-file-repository.md) 发起持久化，接收 [Tauri 事件桥](event-bridge.md) 的 watcher 事件。

## 验证方式

使用 `useNoteDraft.test.tsx`、`activeDraftFlush.test.ts` 和编辑器集成测试。

