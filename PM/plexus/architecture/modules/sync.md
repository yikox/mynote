# 同步 Sync 模块设计

Last updated: 2026-06-23

Status: implemented

## 目的

把本地工作区与用户自有 git 远程同步：管理远程配置、推送与同步状态，并通过 GitHub 设备流 OAuth 完成连接、列举/创建仓库。无服务端账户体系，同步完全依赖用户自有远程。

## 职责

- git 配置（`core::git_config`/`git_remote`）：读/写/清远程配置。
- 推送与同步（`core::git_pusher`/`git_sync`/`git`，基于 git2 vendored libgit2 + openssl）：写操作后推送、查询同步状态。
- GitHub OAuth（`core::github_oauth`）：设备流（start/poll/cancel）、连接状态、列举仓库、创建仓库、连接仓库。
- 前端：`gitRemoteStore` + `services/gitRemote.ts` + 设置区 `Settings/GitRemoteSection`。

## 边界

- In scope：git 远程配置/推送/同步状态、GitHub OAuth 与仓库管理、相关前端 store/service/设置 UI。
- Out of scope：笔记文件内容本身（Notes）；发布构建流水线（CI `.github/workflows/release.yml`，属运维，见 knowledge-summary）。

## 接口与契约

- 前端 `services/gitRemote.ts` → Tauri 命令：`get/set/clear_git_config`、`push_now`、`get_sync_status`；GitHub：`get_github_connection`、`start/poll/cancel_github_device_flow`、`list/create/connect_github_repository`。
- OAuth client id 经 env `PLEXUS_GITHUB_OAUTH_CLIENT_ID`。
- 凭据/token 经 `core::secrets_store` 安全存储，不落明文到仓库/笔记。

## 数据与状态

- `gitRemoteStore`：远程配置、连接状态、同步状态。
- 凭据在系统 secrets store；git 远程信息在 git 配置。

## 运行流程

- 连接：用户走 GitHub 设备流 OAuth（start → 显示 code → poll）→ 列举/创建仓库 → connect → 写 git 远程配置。
- 同步：本地写操作后由 pusher/sync 推送 → `get_sync_status` 反映状态 → 前端展示。

## 依赖

- Rust git2、reqwest（GitHub API）、`core::secrets_store`。
- 前端设置区由 UI Shell 宿主。

## Planned Changes

> 仅列已写 spec、尚未实现的设计变更；当前无此类条目（无 spec 的想法/待办见 PM `待办`）。

| Date | Change | Status | Spec | Detail |
| --- | --- | --- | --- | --- |
| — | （暂无） | — | — | — |

## 风险与开放问题

- 仓库私有 → Release 与安装包仅对有仓库权限者可见；要公开下载须改 Public 并先确认历史无密钥。
- 发布 CI 受 GitHub Actions 账单限额阻断（见 PM 风险），属账务/运维问题。
