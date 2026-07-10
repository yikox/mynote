---
format: arch-module/v0.1
name: 应用配置规则
described: 定义 localStorage、~/.plexus 和工作区 .plexus 中配置的归属、默认值与迁移规则
module_form: atomic
module_kind: config-rule
secondary_kinds:
  - resource-file
  - data-state
main_subject: config stores + Rust config modules
status: draft
review_status: not-reviewed
---

# 应用配置规则

## 模块定位

该模块说明配置和密钥分布。证据路径：`src/stores/settingsStore.ts`、`src/stores/aiConfigStore.ts`、`src/stores/providersStore.ts`、`src-tauri/src/core/config.rs`、`src-tauri/src/core/providers.rs`、`src-tauri/src/core/secrets_store.rs`、`src-tauri/src/core/git_config.rs`。

## 配置结构

- localStorage：`plexus.theme`、`plexus.shortcuts`、`plexus.aiConfig`，并迁移旧 `gitnote.*` key。
- `~/.plexus/config.json`：active workspace。
- `~/.plexus/providers.json`：provider 元数据和 active provider。
- `~/.plexus/secrets.json`：provider API key 和 Git PAT，文件权限在 Unix 上设为 0600。
- `.plexus/git.json`：当前工作区远端 Git 配置。
- `.plexus/workspace.json`：当前工作区 UI 恢复状态。

## 合并与优先级

AI agent 模板默认值和预设在 `aiConfigStore` 中播种；保存配置与 defaults 合并并执行旧字段迁移。Provider 运行时以 active provider 为主，agent template 可覆盖 provider id。

## 校验规则

Git remote URL 不能为空；branch 会被实际当前分支覆盖；sync interval 为空时默认 60s。密钥不进入 provider JSON，也不暴露给前端 JS 内存用于聊天请求。

## 生效时机

主题和快捷键立即生效；provider 与 agent 配置在下一次 AI 请求生效；Git 配置保存后发送 `ConfigChanged`；active workspace 在打开工作区后写入。

## 扩展方式

新增配置必须先选择归属位置：用户设备级、工作区级、浏览器 UI 级或密钥级。若从旧 key/文件迁移，需要在读取路径中保持幂等迁移。

## 验证方式

使用 settings/AI config/provider/git config/secrets 相关测试和端到端编译。

