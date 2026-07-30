# GitHub CLI (gh) 使用指南

GitHub CLI 是 GitHub 官方推出的命令行工具，让你可以在终端中直接与 GitHub 交互，无需切换到浏览器即可完成仓库管理、PR 操作、Issue 管理等任务。

## 安装

### macOS

```bash
brew install gh
```

### Windows

使用 Scoop 或 Chocolatey：

```bash
# Scoop
scoop install gh

# 或 Chocolatey
choco install gh
```

### Linux (Debian/Ubuntu)

```bash
sudo apt install gh
```

### 验证安装

```bash
gh --version
```

## 认证

### 登录

```bash
gh auth login
```

会提示你选择：
- 通过浏览器认证
- 通过 Token 认证

### 其他认证操作

```bash
gh auth status        # 查看当前认证状态
gh auth refresh       # 刷新 Token
gh auth logout        # 登出
```

> 也可以通过环境变量 `GITHUB_TOKEN` 来设置认证信息。

## 仓库操作 (gh repo)

### 基础操作

```bash
# 克隆仓库
gh repo clone owner/repo

# 查看当前仓库信息
gh repo view

# 查看指定仓库信息
gh repo view owner/repo

# 在浏览器中打开仓库
gh repo view --web
gh browse            # 简写
```

### 创建仓库

```bash
# 在当前目录创建
gh repo create

# 创建新目录并初始化
gh repo create my-project

# 创建私有仓库
gh repo create my-project --private

# 创建公开仓库
gh repo create my-project --public

# 从现有目录创建（当前目录已存在 Git 项目）
gh repo create --source . --push --public
```

### 仓库管理

```bash
# 列出仓库
gh repo list owner          # 列出用户所有仓库
gh repo list owner --limit 50

# Fork 仓库
gh repo fork owner/repo

# 添加协作者
gh repo add-collaborator username --permission admin

# 同步 Fork
gh repo sync owner/repo
```

## Issue 操作 (gh issue)

### 基础操作

```bash
# 创建 Issue
gh issue create
gh issue create --title "Bug: 登录失败" --body "详细描述..."
gh issue create --label bug --assignee @me

# 查看 Issue 列表
gh issue list
gh issue list --state all           # 包含已关闭
gh issue list --label bug           # 按标签筛选
gh issue list --assignee username   # 按负责人筛选
gh issue list --search "error in:title"  # 搜索

# 查看单个 Issue
gh issue view 123
gh issue view 123 --web             # 在浏览器打开
```

### Issue 管理

```bash
# 关闭 Issue
gh issue close 123

# 评论 Issue
gh issue comment 123 --body "这是我的评论"

# 编辑 Issue
gh issue edit 123 --title "新标题" --body "新内容"
```

## Pull Request 操作 (gh pr)

### 创建 PR

```bash
# 创建 PR（交互式）
gh pr create

# 使用命令行参数
gh pr create --title "修复登录bug" --body "详细描述..."
gh pr create --base main --head feature-branch

# 自动推送分支并创建 PR
gh pr create --fill     # 自动用 commit 信息填充 title 和 body
```

### 查看 PR

```bash
# 查看 PR 列表
gh pr list
gh pr list --state all              # 包含已合并/已关闭
gh pr list --author @me             # 我的 PR
gh pr list --assignee @me            # 分配给我的 PR
gh pr list --search "title:fix"      # 搜索

# 查看单个 PR
gh pr view 123
gh pr view 123 --web                 # 在浏览器打开

# 查看当前分支对应的 PR
gh pr view --web

# 查看 PR 状态
gh pr status
```

### PR 管理

```bash
# 检出 PR 到本地
gh pr checkout 123
gh pr checkout 22                   # 基于 PR 编号

# 合并 PR
gh pr merge 123
gh pr merge --squash                # 压缩合并
gh pr merge --rebase                # 变基合并
gh pr merge --delete-branch         # 合并后删除分支

# 标记 PR 为准备就绪
gh pr ready 123

# 添加 Review
gh pr review 123 --approve           # 批准
gh pr review 123 --request-changes  # 请求修改
gh pr review 123 --comment          # 仅评论

# 添加标签/负责人
gh pr edit 123 --add-label bug
gh pr edit 123 --add-assignee username
```

## GitHub Actions 操作 (gh run)

### 工作流管理

```bash
# 列出最近的运行
gh run list
gh run list --workflow=ci.yml       # 指定工作流

# 查看运行详情
gh run view 12345
gh run view 12345 --log             # 查看日志

# 触发工作流
gh workflow run ci.yml
gh workflow run ci.yml --field name=value

# 等待运行完成
gh run watch 12345

# 重试失败的运行
gh run rerun 12345
```

## Gist 操作 (gh gist)

```bash
# 创建 Gist
gh gist create file.txt
gh gist create --public file.txt   # 公开 Gist
echo "hello" | gh gist create       # 从 stdin 创建

# 查看 Gist
gh gist list
gh gist view abc123

# 编辑 Gist
gh gist edit abc123 --add file2.txt
```

## Release 操作 (gh release)

```bash
# 创建 Release
gh release create v1.0.0
gh release create v1.0.0 --title "Version 1.0" --notes "发布说明..."

# 列出 Release
gh release list

# 查看 Release
gh release view v1.0.0

# 删除 Release
gh release delete v1.0.0
```

## 配置 (gh config)

```bash
# 设置默认编辑器
gh config set editor vim

# 查看配置
gh config get editor

# 设置 Git 协议
gh config set git_protocol ssh      # 使用 SSH
```

## 别名 (gh alias)

```bash
# 创建别名
gh alias set co "pr checkout"
gh alias set issues "issue list --assignee @me"

# 使用别名
gh co 123          # 相当于 gh pr checkout 123
gh issues          # 相当于 gh issue list --assignee @me

# 查看所有别名
gh alias list
```

## 自动化与脚本

### JSON 输出

大多数命令支持 `--json` 参数，便于脚本处理：

```bash
# 获取仓库信息
gh repo view --json name,description,url

# 列出所有 open issue
gh issue list --state open --json number,title

# 结合 jq 使用
gh issue list --state open --json number,title | jq '.[] | "#\(.number) \(.title)"'
```

### 常用脚本示例

```bash
# 批量关闭已合并的 PR 对应的 Issue
gh pr list --merged --state open --json number,title | jq -r '.[] | .number' | while read pr; do
  gh issue close $pr --comment "PR #$pr 已合并"
done

# 导出 PR 列表为 CSV
gh pr list --json number,title,author,state | jq -r '.[] | [.number, .title, .author.login, .state] | @csv'
```

## 工作流程示例

### 日常开发流程

```bash
# 1. 同步最新代码
git pull origin main

# 2. 创建功能分支
git checkout -b feature/new-feature

# 3. 开发并提交
git add .
git commit -m "Add new feature"

# 4. 推送并创建 PR
git push -u origin feature/new-feature
gh pr create --fill

# 5. 添加 Reviewer
gh pr edit --add-reviewer username

# 6. 合并 PR（代码审查通过后）
gh pr merge --squash --delete-branch
```

### Bug 修复流程

```bash
# 1. 创建修复分支
git checkout -b fix/bug-description

# 2. 修复并提交
git commit -m "Fix: resolve the issue"

# 3. 关联 Issue 创建 PR
git push -u origin fix/bug-description
gh pr create --title "Fix: resolve issue" --body "Fixes #123"

# 4. 合并
gh pr merge --squash
```

## 常用命令速查表

| 类别 | 命令 | 说明 |
|------|------|------|
| 仓库 | `gh repo clone` | 克隆仓库 |
| 仓库 | `gh repo create` | 创建仓库 |
| 仓库 | `gh browse` | 浏览器打开仓库 |
| Issue | `gh issue create` | 创建 Issue |
| Issue | `gh issue list` | 列出 Issue |
| Issue | `gh issue view` | 查看 Issue |
| PR | `gh pr create` | 创建 PR |
| PR | `gh pr checkout` | 检出 PR |
| PR | `gh pr merge` | 合并 PR |
| PR | `gh pr status` | PR 状态 |
| PR | `gh pr review` | Review PR |
| Actions | `gh run list` | 列出运行 |
| Actions | `gh run watch` | 监控运行 |
| Gist | `gh gist create` | 创建代码片段 |
| Release | `gh release create` | 创建发布 |

## 参考链接

- [GitHub CLI 官方文档](https://cli.github.com/manual/)
- [GitHub CLI Examples](https://cli.github.com/manual/examples)
- [Codecademy GitHub CLI Tutorial](https://www.codecademy.com/article/github-cli-tutorial)
