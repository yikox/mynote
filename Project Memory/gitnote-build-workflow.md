# GitNote Build Workflow

## 环境
- 项目需要 Node.js 18+、Rust stable；macOS 打包需要 Xcode CLI。
- 前端构建由 Vite/TypeScript 负责，桌面壳使用 Tauri v2。

## 常用命令
- `npm install` - 安装依赖。
- `npm run build` - 运行 `tsc && vite build`，普通代码变更后至少执行这个命令。
- `npm run build:dmg` - 运行 `scripts/build-dmg.sh`，需要产出 macOS DMG 时使用。
- `npm run test:run` - 前端测试，Vitest + Testing Library。
- `npm run rust:test` - Rust 单元测试和集成测试，进入 `src-tauri` 后执行 `cargo test`。

## 注意事项
- `build:dmg` 依赖 macOS `hdiutil`，sandboxed subprocess 可能出现 disk image device 错误；必要时使用 system terminal 或 elevated execution。
- 只要改了 app code，完成前至少跑 `npm run build`；如果目标是 packaged build，则跑 `npm run build:dmg`。
- 普通代码验证不要自动打开 browser，除非用户明确要求 browser verification。
