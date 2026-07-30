# Swift

> Apple 平台的三层栈：Swift 语法 → Metal（GPU）/ SwiftUI（GUI）任选深入。

---

## 概览

- **主题范围**：本目录按"语言 → 系统框架"组织：
  1. **语言层**：Swift 基础语法
  2. **GPU 层**：Metal Compute / Render 编程
  3. **GUI 层**：SwiftUI 完整 App 实战
- **学习路径**：
  - 入门：[Swift学习笔记.md](./编程语言/Swift/Swift学习笔记.md)
  - GPU 方向：[Swift-Metal编程入门.md](./编程语言/Swift/Swift-Metal编程入门.md)
  - GUI 方向：[SwiftUI实战-TodoApp.md](./编程语言/Swift/SwiftUI实战-TodoApp.md)
- **横向关联**：Metal 与 [GPU编程/](../../GPU编程/GPU编程.md) 的 OpenGL Compute Shader 是同主题不同 API 实现；SwiftUI 与 [工具/三方库/rumps库使用.md](../../工具/三方库/rumps库使用.md) 的 macOS 菜单栏 App 是不同 UI 框架的选择。

---

## 知识地图

### Swift 语法
- 变量 / 常量、可选类型、闭包、协议
- [Swift学习笔记.md](./编程语言/Swift/Swift学习笔记.md)

### Metal GPU 编程
Apple 的低层次 GPU API，对标 OpenGL / Vulkan / DirectX。核心组件链：`MTLDevice → MTLCommandQueue → MTLCommandBuffer → MTLComputeCommandEncoder`（或 RenderEncoder）。

- [Swift-Metal编程入门.md](./编程语言/Swift/Swift-Metal编程入门.md)

### SwiftUI 实战
完整 Todo List App：数据模型 + 列表 + 增删改。Xcode 15+ / iOS 17+ 环境。

- [SwiftUI实战-TodoApp.md](./编程语言/Swift/SwiftUI实战-TodoApp.md)

---

## 横向关联

- 与 [GPU编程/](../../GPU编程/GPU编程.md) 的 OpenGL Compute Shader 是 GPU 编程的两条生态路线
- 与 [工具/apple-container-1.0.md](../../工具/apple-container-1.0.md) 共享 Apple 平台生态
