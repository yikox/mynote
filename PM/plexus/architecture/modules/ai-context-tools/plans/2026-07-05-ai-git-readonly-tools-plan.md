---
source_design: architecture/modules/ai-context-tools/changes/2026-07-05-ai-git-readonly-tools.md
level: L2
---

# AI 只读 Git 检视工具集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 给 AI 5 个只读 Git 工具（git_log / read_note_at / git_diff / git_status / git_show_commit），基于后端 git2，工作区内、无 shell/透传;恢复靠组合 read_note_at + 现有 update_note。

**Architecture:** 后端 `core/git_history.rs`（git2 只读函数）→ `commands/git_history.rs`（Tauri 命令）→ `src/services/git.ts`（gitService）→ `src/ai/tools/defs/git*.ts`（5 个 def, write:false）经 `ctx.git` 执行。

**Tech Stack:** Rust + git2 0.19 (libgit2), Tauri 2, TypeScript, Vitest, cargo test.

## Global Constraints（逐条 copy 自设计安全边界，每 task 隐含遵守）

- **全只读**:仅用 git2 读 API,不改仓库/工作区/索引;不新增任何写工具。
- **工作区内**:命令经 `workspace(&state)` 取 root;`path` 视为 repo/工作区相对,拒绝越界(`..` / 绝对路径 → 错误)。
- **无透传**:`rev` 交 `git2` 的 `revparse_single`(解析 ref/hash,无 hook/`-c`/shell 面);绝不拼接 `git` 命令行。
- **输出有界**:diff / 文件内容按 8000 字符(现有 `MAX_TOOL_RESULT_CHARS`)截断并注明。
- **additive**:不改任何既有工具/命令的对外契约。
- **验证**:Rust `npm run rust:test` 绿;前端 `npm run test:run` 绿;`npm run build` 成功;`npx tsc --noEmit` 无错。

## File Structure

- `src-tauri/src/core/git_history.rs` — 新增。git2 只读函数 + 单测。
- `src-tauri/src/core/mod.rs` — 加 `pub mod git_history;`
- `src-tauri/src/commands/git_history.rs` — 新增。5 个 `#[tauri::command]`。
- `src-tauri/src/commands/mod.rs` — 加 `pub mod git_history;`
- `src-tauri/src/lib.rs` — `generate_handler!` 注册 5 命令。
- `src/services/git.ts` — 新增。gitService 包装 invoke。
- `src/ai/tools/types.ts` — 改。ToolDomain+`'git'`;ToolCategory+`'history'`;ToolContext+`git`。
- `src/ai/tools/defs/git{Log,ReadAt,Diff,Status,ShowCommit}.ts` — 新增 5 个 def。
- `src/ai/tools/registry.ts` — 注册 5 def。
- `src/ai/agentLoop.ts` — buildDispatcher 的 ctx 加 `git: gitService`。
- `src/stores/aiConfigStore.ts` / AIConfig ToolsSection — 5 工具纳入 toolEnabled 默认与列表。
- 各 `.test.ts(x)` 相应。

---

## Task 1: 后端 git2 只读函数 + 单测（core/git_history.rs）

**Files:** Create `src-tauri/src/core/git_history.rs`; Modify `src-tauri/src/core/mod.rs`

**Interfaces — Produces（返回结构 + 函数签名）:**
```rust
pub struct CommitInfo { pub hash: String, pub short_hash: String, pub date: String, pub author: String, pub message: String }
pub struct FileChange { pub path: String, pub status: String } // modified|added|deleted|untracked|renamed
pub struct StatusInfo { pub branch: String, pub head: String, pub changes: Vec<FileChange> }
pub struct CommitDetail { pub hash: String, pub short_hash: String, pub date: String, pub author: String, pub message: String, pub files: Vec<FileChange>, pub diff: Option<String> }

pub fn log(root: &Path, path: Option<&str>, limit: usize) -> AppResult<Vec<CommitInfo>>;
pub fn show_file(root: &Path, rev: &str, path: &str) -> AppResult<String>;
pub fn diff(root: &Path, from: Option<&str>, to: Option<&str>, path: Option<&str>) -> AppResult<String>;
pub fn status(root: &Path) -> AppResult<StatusInfo>;
pub fn show_commit(root: &Path, rev: &str, include_diff: bool) -> AppResult<CommitDetail>;
```
（每个结构体 `#[derive(serde::Serialize)]` **且 `#[serde(rename_all = "camelCase")]`**——使前端直接拿到 `shortHash` 等 camelCase 字段,gitService 无需再映射;date 用 commit time 转 ISO8601;错误统一 `AppError::Git`。）

**实现要点（git2）:** `log`= `repo.revwalk()` push HEAD, `set_sorting(TIME)`, 逐 commit;有 `path` 时比较 commit tree 与首个父 tree 的 `diff_tree_to_tree` 是否含该 path,含则计入,取够 limit 即停。`show_file`= `repo.revparse_single(rev)?.peel_to_commit()?.tree()?.get_path(Path::new(path))?` → blob → `str::from_utf8`(非 utf8/非 blob → 错误)。`diff`= 依 from/to 组 tree↔tree / tree↔workdir(`diff_tree_to_workdir_with_index`)/ HEAD↔workdir;`pathspec` 限定 path;`diff.print(Patch, cb)` 拼 unified 文本。`status`= `repo.statuses()` 映射 flag→状态串;branch/head 复用 `git.rs::current_branch` 思路 + HEAD short id。`show_commit`= commit 元信息 + 与父 tree diff 的文件列表(deltas),`include_diff` 时附 patch 文本。

- [ ] **Step 1: 写失败测试** — 在 `git_history.rs` `#[cfg(test)]` 内,仿 `git.rs` 用 tempdir 造 git2 仓 + 2~3 次提交(含一次改某文件、一次删文件、一次未跟踪),断言:
  - `log(root, None, 20)` 返回按时间倒序、含各 commit hash/message;
  - `log(root, Some("a.md"), 20)` 只含触及 a.md 的提交;
  - `show_file(root, "HEAD~1", "a.md")` == 旧内容;未知 rev / 不存在文件 → Err;
  - `diff(root, Some("HEAD~1"), Some("HEAD"), Some("a.md"))` 含预期增删行;
  - `status(root)` 含未跟踪/改动文件与正确状态串、branch 非空;
  - `show_commit(root, "HEAD", true)` 含 files 列表与 diff 文本。
- [ ] **Step 2: 跑确认失败** — Run: `cd src-tauri && PATH="$HOME/.cargo/bin:$PATH" cargo test git_history` — Expected: 编译失败/函数未定义。
- [ ] **Step 3: 实现上述函数** 于 `git_history.rs`;`core/mod.rs` 加 `pub mod git_history;`。
- [ ] **Step 4: 跑确认通过** — Run: `cd src-tauri && PATH="$HOME/.cargo/bin:$PATH" cargo test git_history` — Expected: 全绿。
- [ ] **Step 5: 提交** — `git add src-tauri/src/core/git_history.rs src-tauri/src/core/mod.rs && git commit -m "feat(git): read-only git2 history functions (log/show/diff/status/show_commit)"`

---

## Task 2: Tauri 命令 + 注册（commands/git_history.rs）

**Files:** Create `src-tauri/src/commands/git_history.rs`; Modify `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces — Consumes:** Task 1 core fns。**Produces（命令）:**
```rust
#[tauri::command] pub fn git_log(state: State<'_, AppState>, path: Option<String>, limit: Option<usize>) -> AppResult<Vec<CommitInfo>>;
#[tauri::command] pub fn git_show_file(state: State<'_, AppState>, path: String, rev: String) -> AppResult<String>;
#[tauri::command] pub fn git_diff(state: State<'_, AppState>, path: Option<String>, from: Option<String>, to: Option<String>) -> AppResult<String>;
#[tauri::command] pub fn git_status(state: State<'_, AppState>) -> AppResult<StatusInfo>;
#[tauri::command] pub fn git_show_commit(state: State<'_, AppState>, rev: String, include_diff: Option<bool>) -> AppResult<CommitDetail>;
```

- [ ] **Step 1: 实现命令** — 每个命令仿 `commands/notes.rs`:用私有 `workspace(&state)?` 取 root(可复用/照抄 notes.rs 里的 `workspace` helper),校验 `path`(若含 `..` 或以 `/` 开头 → `AppError::Other("invalid path")`),`limit` clamp 到 [1,100] 默认 20,调 `core::git_history::*`。`commands/mod.rs` 加 `pub mod git_history;`。
- [ ] **Step 2: 注册** — `lib.rs` 的 `generate_handler!` 增 `commands::git_history::{git_log, git_show_file, git_diff, git_status, git_show_commit}`。
- [ ] **Step 3: 编译校验** — Run: `cd src-tauri && PATH="$HOME/.cargo/bin:$PATH" cargo test` — Expected: 编译通过、既有测试仍绿。
- [ ] **Step 4: 提交** — `git commit -m "feat(git): tauri commands for read-only git history"`

---

## Task 3: 前端 gitService（src/services/git.ts）

**Files:** Create `src/services/git.ts`, `src/services/git.test.ts`

**Interfaces — Produces:**
```ts
export interface GitCommit { hash: string; shortHash: string; date: string; author: string; message: string }
export interface GitFileChange { path: string; status: string }
export interface GitStatus { branch: string; head: string; changes: GitFileChange[] }
export interface GitCommitDetail extends GitCommit { files: GitFileChange[]; diff?: string }
export const gitService = {
  log(path?: string, limit?: number): Promise<GitCommit[]>,
  showFile(path: string, rev: string): Promise<string>,
  diff(path?: string, from?: string, to?: string): Promise<string>,
  status(): Promise<GitStatus>,
  showCommit(rev: string, includeDiff?: boolean): Promise<GitCommitDetail>,
};
```
（后端返回 snake_case;service 层做 camelCase 映射,或后端结构体加 `#[serde(rename_all="camelCase")]`——本计划采用**后端 serde camelCase**,service 直接透传,Task 1 结构体加该属性。）

- [ ] **Step 1: 写失败测试** — `git.test.ts`:`vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))`,断言 `gitService.log('a.md', 20)` 调 `invoke('git_log', { path:'a.md', limit:20 })` 并返回其结果;`showFile`→`invoke('git_show_file',{path,rev})`;`diff`/`status`/`showCommit` 同理映射命令名与参数。
- [ ] **Step 2: 跑确认失败** — Run: `npx vitest run src/services/git.test.ts` — FAIL。
- [ ] **Step 3: 实现** `src/services/git.ts`(仿 `src/services/notes.ts` 的 invoke 包装)。
- [ ] **Step 4: 跑确认通过** — `npx vitest run src/services/git.test.ts`;`npx tsc --noEmit`。
- [ ] **Step 5: 提交** — `git commit -m "feat(git): frontend gitService wrapping git commands"`

---

## Task 4: ToolContext / types 接线

**Files:** Modify `src/ai/tools/types.ts`, `src/ai/agentLoop.ts`

- [ ] **Step 1: types** — `ToolDomain` 增 `| 'git'`;`ToolCategory` 增 `| 'history'`;`ToolContext` 增 `git: typeof gitService`(import type from `../../services/git`)。
- [ ] **Step 2: ctx 接线** — `agentLoop.ts` `buildDispatcher` 内构造 `ctx: ToolContext` 处(约 line 97)增 `git: gitService`(import `gitService`)。
- [ ] **Step 3: 编译校验** — `npx tsc --noEmit`(此时无 def 消费也应通过);`npx vitest run src/ai/agentLoop.test.ts`(fake runtime 不受影响,应绿)。
- [ ] **Step 4: 提交** — `git commit -m "feat(git): wire gitService into ToolContext"`

---

## Task 5: 5 个只读工具 def + 注册

**Files:** Create `src/ai/tools/defs/gitLog.ts`, `gitReadAt.ts`, `gitDiff.ts`, `gitStatus.ts`, `gitShowCommit.ts`, `src/ai/tools/defs/gitTools.test.ts`; Modify `src/ai/tools/registry.ts`

**Interfaces — Consumes:** `ctx.git`(Task 4), gitService(Task 3)。每个 def 仿 `defs/readNote.ts`:`{ name, domain:'git', write:false, schema, async execute(args,ctx){...}, summary(args){ category:'history', ... } }`。工具名与参数:
- `git_log` {path?, limit?} → `JSON.stringify(await ctx.git.log(path, limit))`
- `read_note_at` {path, rev} → `await ctx.git.showFile(path, rev)`（描述里写明:配合 `update_note` 可把笔记恢复到历史版本）
- `git_diff` {path?, from?, to?} → diff 文本(超 8000 字符截断并注明,复用 `trimResult` 思路)
- `git_status` {} → `JSON.stringify(await ctx.git.status())`
- `git_show_commit` {rev, includeDiff?} → `JSON.stringify(await ctx.git.showCommit(rev, includeDiff))`

- [ ] **Step 1: 写失败测试** — `gitTools.test.ts`:构造 fake ctx `{ git: { log:vi.fn(async()=>[...]), showFile:vi.fn(async()=>'old'), diff:vi.fn(async()=>'@@...'), status:vi.fn(), showCommit:vi.fn() }, config:{} }`,对每个 def 调 `execute` 断言:参数正确透传给 ctx.git.*、返回值符合;`git_diff` 超长被截断。
- [ ] **Step 2: 跑确认失败** — `npx vitest run src/ai/tools/defs/gitTools.test.ts` — FAIL。
- [ ] **Step 3: 实现 5 个 def** + `registry.ts` import 并加入 `TOOL_REGISTRY`。
- [ ] **Step 4: 跑确认通过** — `npx vitest run src/ai/tools`;`npx tsc --noEmit`。
- [ ] **Step 5: 提交** — `git commit -m "feat(git): 5 read-only git tools (log/read_note_at/diff/status/show_commit)"`

---

## Task 6: 工具开关默认 + 全量验收

**Files:** Modify `src/stores/aiConfigStore.ts`(或 tools 默认 `toolConfigDefaults`/`toolEnabled` 所在处)、AIConfig ToolsSection(若其按注册表渲染则无需改)

- [ ] **Step 1: 默认开启** — 将 5 个新工具名加入默认 `toolEnabled`(与现有 read 工具一致默认 true);确认 ToolsSection 从 `TOOL_REGISTRY` 动态列出(若是则自动出现,无需硬编码)。加/改对应测试(若 aiConfigStore 有 toolEnabled 默认测试)。
- [ ] **Step 2: 全量验收** — Run 全部:`npx vitest run`(全绿)、`npx tsc --noEmit`(无错)、`npm run build`(成功)、`cd src-tauri && PATH="$HOME/.cargo/bin:$PATH" cargo test`(全绿)。报告各自数量。
- [ ] **Step 3: 提交** — `git commit -m "feat(git): enable read-only git tools by default"`

---

## Validation（对应设计）

- Rust:`git_history` 单测覆盖 log(含 path 过滤)/show_file(含错误)/diff(三语义)/status/show_commit。
- 前端:gitService 映射测试 + 5 def 执行测试(参数透传 + 截断)。
- 终态:`npx vitest run` 全绿、`cargo test` 全绿、`tsc` 无错、`build` 成功。
- 安全:def 均 `write:false`;命令拒绝越界 path;rev 仅经 revparse_single;输出截断。
