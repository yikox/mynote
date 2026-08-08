# Rust

> Rust 入门级速查笔记。

---

## 概览

### 起源 / 为什么诞生

- **诞生背景**：Rust 由 Mozilla 工程师 Graydon Hoare 于 **2006 年**作为个人项目发起，2009 年获得 Mozilla 赞助，**2010 年**首次公开，**1.0 版本于 2015 年**正式发布。
- **核心动机**：C/C++ 长期存在内存安全问题——缓冲区溢出、悬垂指针、数据竞争等占据安全漏洞的很大比例；Rust 希望在保留 C/C++ 性能的同时，从语言层面根治这些问题。
- **设计目标**：
  - **内存安全**：无 GC，靠所有权 / 借用 / 生命周期在编译期保证
  - **并发安全**：在编译期消除数据竞争
  - **零成本抽象**：性能对标 C/C++
  - **实用性**：rustup / cargo 工具链开箱即用
- **关键推动力**：Mozilla 的 **Servo 浏览器引擎**项目需要一门既安全又高性能的系统语言，Rust 因此获得资源支持并快速走向成熟。


## 应用领域 / 生态

### 优势领域

- **系统编程**：操作系统、嵌入式、驱动、底层库——对标 C/C++，同时获得内存安全
- **高性能网络服务 / 后端**：高并发、低延迟，配合 Tokio 异步运行时
- **命令行工具**：零成本抽象 + 静态编译，适合发布跨平台 CLI
- **WebAssembly**：可直接编译为 WASM，是 WASM 生态的主力语言
- **区块链 / 密码学**：对安全性和确定性要求极高，社区活跃（Substrate / Solana 等）
- **数据处理 / 大数据**：高性能计算、数据处理流水线

### 知名 Rust 项目 / 软件

- **命令行工具**：`rg`（ripgrep）、`fd`、`bat`、`lsd`/`exa`、`starship`、`zoxide`、`dust`、`bottom`、`hyperfine`、`alacritty`（终端）
- **前端 / JS 工具链**：`swc`（JS/TS 编译器）、`Turbopack`（Vercel 打包器）、`Biome`（Lint/格式化）、`napi-rs`（Node 原生插件）
- **浏览器 / 渲染**：Servo 浏览器引擎、Firefox 的 `Stylo` 与 `WebRender` 组件
- **数据库 / 存储**：`TiKV`（TiDB 存储引擎）、`sled`、`SurrealDB`、`Neon`、`RocksDB` 的部分组件
- **Web 后端框架**：`Axum`、`Actix-web`、`Rocket`、`Tower`、`Poem`
- **运行时 / 基础设施**：`wasmtime`、`wasmer`（WASM 运行时）、`rust-analyzer`（Rust 语言服务器）
- **区块链**：Polkadot / Substrate、Solana、NEAR
- **操作系统 / 嵌入式**：Redox OS、Tock、ESP32 生态
- **游戏引擎**：Bevy、Veloren、macroquad

### 与其它语言配合

| 语言 / 生态 | 配合方式 |
| --- | --- |
| C/C++ | 通过 FFI（`extern "C"`）+ `bindgen` 双向互调，是主要互操作目标 |
| Python | `PyO3` / `maturin` 把 Rust 写成 Python 扩展（pyd），或嵌入 RustPython |
| JavaScript / TypeScript | `wasm-bindgen` 编译为 WASM；`napi-rs` 生成 Node 原生插件；`swc` / `Turbopack` 直接用于前端工具链 |
| WebAssembly | Rust 是编写 WASM 模块最常用的语言之一 |
| Go | cgo / 共享库（cdylib）互调 |
| Java | JNI / JNA 调用 Rust 共享库 |
| .NET | P/Invoke 调用 Rust cdylib |
| Ruby / PHP / R 等 | 通过 C ABI 或对应扩展机制互调 |

> 小结：Rust 的强项在于「需要性能 + 需要安全」的场景；它几乎从不替代高级语言，而是作为底层库 / 组件被其它语言调用。




---

## 知识地图

### Rust 快速入门
- 环境：rustup（Linux/macOS 一键脚本 / Windows rustup-init.exe）
- 核心：变量可变性（`let` vs `let mut`）、类型系统、标量与复合类型

- [Rust快速入门.md](./编程语言/Rust/Rust快速入门.md)

---

## 演进 / 待补

- 当前仅入门级，可补：
  - 所有权 / 借用 / 生命周期（Rust 最核心的部分）
  - 错误处理（`Result` / `?` 操作符）
  - 泛型 / Trait / 模式匹配
  - 异步编程（Tokio）
