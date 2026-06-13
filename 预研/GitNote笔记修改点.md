# GitNote GitHub OAuth 集成方案

## 目标流程

用户点一个按钮 → 浏览器打开 GitHub 授权页 → App 自动拿到 token，自动 create / 复用一个叫 gitnote 的仓库 → 之后就静默 push。

## 实现路径（OAuth 2.0 Device Authorization Grant）

桌面 App 不能在前端里塞 OAuth client\_secret（embed 即泄漏），所以必须走 OAuth 2.0 Device Authorization Grant（GitHub / GitLab 都支持）：

1. **注册 OAuth App**：去 GitHub 注册一个 OAuth App，拿到一个 client\_id（公开可见，安全）
2. **请求 device\_code**：App 内 POST `https://github.com/login/device/code` → 拿 device\_code + user\_code
3. **用户授权**：App 弹一个小窗显示 user\_code，并 tauri::opener 打开 `https://github.com/login/device`，用户在浏览器粘 code 授权
4. **轮询获取 token**：App 后台轮询 `oauth/access_token` 直到拿到 access\_token（或拒绝 / 超时）
5. **创建/复用仓库**：用 token 调 `GET /repos/{user}/gitnote`，404 就 `POST /user/repos` 创建（默认 private）
6. **设置 origin 并初始 push**

## 涉及的工作量

### 后端

* 新增 device-flow 状态机（HTTP 客户端 + 轮询 + 取消）

* GitHub REST 客户端

* token 存储格式从"裸 PAT"改成 "{token, scope, expires\_at, refresh\_token?}"

* 写 OAuth client\_id 的注册流程文档

### 前端

* 新增"连接 GitHub"对话框（user\_code + 倒计时 + 取消按钮）

* 设置页 UI 改造：
  
  * PAT 输入框去掉
  
  * 换成"已连接：@username" + "断开" + "重新选择仓库"

* 错误态（rate limit / 拒绝 / 超时）

### 运维

* 在 github.com/settings/applications/new 注册 OAuth App

* 把 client\_id 写进 Cargo.toml 或环境变量

## 参考资料

* [GitHub Device Flow](https://docs.github.com/en/developers/apps/authorizing-oauth-apps#device-flow)

* [Tauri opener plugin](https://github.com/tauri-apps/tauri-plugin-opener)

* 改名参考 Distill 蒸馏，源自 “Distill”（蒸馏、提取精华），去掉一个 “l” 更显极简科技感。AI 在底层像蒸馏器一样帮你把冗长的信息、网页剪藏浓缩成最易读的摘要和结构，服务于人类的真正吸收。