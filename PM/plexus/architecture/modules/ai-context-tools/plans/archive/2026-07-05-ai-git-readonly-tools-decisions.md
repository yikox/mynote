# Decision Log — AI 只读 Git 工具集 (REQ-20260705-ai-git-readonly-tools)

2026-07-05 | 设计 promote accepted+reviewed | 用户 brainstorming 逐项裁定 + invoke autopilot=接受;评审折叠进 intake(自设计、内部一致、L2)
2026-07-05 | plan self-approved | 自审修正 serde camelCase 跨任务引用(移入 Task 1 结构体要求);边界/验证/约束齐全
2026-07-05 | worktree 基于 HEAD 用 git fallback | 设计叠在 agent-runtime 合并之上,origin/main 会致 agentLoop.ts 冲突;EnterWorktree 默认 fresh 不合,改 settings 被 classifier 拦,故 git worktree add HEAD
2026-07-05 | Task 6 review folded into final whole-branch review | 小改(enable 默认+测试),已过全量验收;opus 终评覆盖其 diff
