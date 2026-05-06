# Rust 入门教程

> Rust 是一门注重安全、并发和性能的系统编程语言。

## 环境安装

### 安装 Rust (Linux/macOS)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 安装 Rust (Windows)

下载 [rustup-init.exe](https://rustup.rs) 并运行。

### 验证安装

```bash
rustc --version
cargo --version
```

## 基本语法

### Hello World

```rust
fn main() {
    println!("Hello, world!");
}
```

### 变量与可变性

```rust
// 不可变变量
let x = 5;

// 可变变量
let mut y = 10;
y = y + 1;

// 常量
const MAX_POINTS: u32 = 100_000;

// 类型标注
let z: i32 = 100;
```

### 数据类型

#### 标量类型

| 类型 | 说明 |
|------|------|
| `i32` | 有符号 32 位整数 |
| `u32` | 无符号 32 位整数 |
| `f64` | 64 位浮点数 |
| `bool` | 布尔值 `true` / `false` |
| `char` | Unicode 字符 |

#### 复合类型

```rust
// 元组
let tup: (i32, f64, u8) = (500, 6.4, 1);
let (a, b, c) = tup;  // 解构
let first = tup.0;    // 索引访问

// 数组
let arr = [1, 2, 3, 4, 5];
let months = ["Jan", "Feb", "Mar", "Apr", "May"];
let first = arr[0];
```

### 控制流

#### if 表达式

```rust
let number = 6;

if number < 5 {
    println!("condition was true");
} else if number == 5 {
    println!("condition was exactly five");
} else {
    println!("condition was false");
}

// if 作为表达式（返回值）
let condition = true;
let value = if condition { 5 } else { 6 };
```

#### 循环

```rust
// loop 循环（可返回值）
let result = loop {
    counter += 1;
    if counter == 10 {
        break counter * 2;
    }
};

// while 循环
let mut n = 0;
while n <= 5 {
    println!("{}", n);
    n += 1;
}

// for 循环（遍历）
let arr = [10, 20, 30];
for element in arr.iter() {
    println!("{}", element);
}

// for range
for i in 0..5 {
    println!("{}", i);  // 0, 1, 2, 3, 4
}
```

### 函数

```rust
fn another_function(x: i32, y: char) {
    println!("x = {}, y = {}", x, y);
}

// 有返回值的函数
fn five() -> i32 {
    5  // 注意：不要加 semicolon，否则会变成语句
}

// 调用
let result = five();
```

## 所有权 (Ownership)

> Rust 的核心概念，每个值有唯一的所有者。

### 基本规则

1. 每个值有一个所有者
2. 同一时间只有一个所有者
3. 当所有者离开作用域，值被丢弃

```rust
fn main() {
    // 赋值会转移所有权
    let s1 = String::from("hello");
    let s2 = s1;  // s1 已无效
    
    // 克隆保留原值
    let s3 = s2.clone();
    
    // 引用（借用）
    let s4 = &s2;
    println!("{}", s4);
}
```

### 借用规则

- 可变引用：同一作用域只能有一个可变引用
- 不可变引用：可以有多个不可变引用
- 引用必须总是有效的

```rust
let mut s = String::from("hello");

// 可变引用
let r1 = &mut s;
// let r2 = &mut s;  // 错误：不能同时有两个可变引用

// 不可变引用
let r3 = &s;
let r4 = &s;  // OK：可以有多个不可变引用
```

## 结构体与枚举

### 结构体

```rust
// 普通结构体
struct User {
    username: String,
    email: String,
    sign_in_count: u64,
    active: bool,
}

let user = User {
    email: String::from("test@example.com"),
    username: String::from("username"),
    active: true,
    sign_in_count: 1,
};
```

### 元组结构体

```rust
struct Point(i32, i32);
struct Color(u8, u8, u8);

let p = Point(0, 0);
let black = Color(0, 0, 0);
```

### 枚举

```rust
enum Message {
    Quit,
    Move { x: i32, y: i32 },
    Write(String),
    ChangeColor(i32, i32, i32),
}

// 使用 match 处理
fn process_message(msg: Message) {
    match msg {
        Message::Quit => println!("Quit"),
        Message::Move { x, y } => println!("Move to ({}, {})", x, y),
        Message::Write(text) => println!("{}", text),
        Message::ChangeColor(r, g, b) => println!("Color: {}, {}, {}", r, g, b),
    }
}
```

## Option 与 Result

### Option

```rust
fn find_user(id: u32) -> Option<String> {
    if id == 1 {
        Some(String::from("Alice"))
    } else {
        None
    }
}

// 使用 match
match find_user(1) {
    Some(name) => println!("Found: {}", name),
    None => println!("User not found"),
}

// 使用 if let
if let Some(name) = find_user(2) {
    println!("Found: {}", name);
}

// unwrap 或 unwrap_or
let name = find_user(1).unwrap_or(String::from("Guest"));
```

### Result

```rust
fn read_file(path: &str) -> Result<String, std::io::Error> {
    Ok(String::from("file contents"))
}

// 使用 match
match read_file("test.txt") {
    Ok(content) => println!("{}", content),
    Err(e) => println!("Error: {}", e),
}

// 使用 ?
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let content = read_file("test.txt")?;
    println!("{}", content);
    Ok(())
}
```

## 常用集合

### Vec (动态数组)

```rust
// 创建
let v: Vec<i32> = Vec::new();
let v2 = vec![1, 2, 3];

// 添加元素
let mut v3 = Vec::new();
v3.push(1);
v3.push(2);

// 读取
let third = v2[2];           // 可能 panic
let third = v2.get(2);       // 返回 Option<&T>

// 遍历
for i in &v2 {
    println!("{}", i);
}
```

### HashMap

```rust
use std::collections::HashMap;

let mut scores = HashMap::new();
scores.insert(String::from("Blue"), 50);
scores.insert(String::from("Yellow"), 30);

// 获取值
let team_name = String::from("Blue");
let score = scores.get(&team_name);  // Option<&i32>

// 遍历
for (key, value) in &scores {
    println!("{}: {}", key, value);
}
```

## 常用宏

| 宏 | 说明 |
|-----|------|
| `println!` | 打印并换行 |
| `print!` | 打印不换行 |
| `format!` | 格式化字符串 |
| `vec!` | 创建 Vec |
| `panic!` | 触发 panic |

```rust
let s = String::from("world");
let formatted = format!("Hello, {}!", s);
println!("{}", formatted);  // Hello, world!
```

## 常用 Trait

### Debug 和 Display

```rust
// 实现 Debug 以便 {:?} 打印
#[derive(Debug)]
struct Rectangle {
    width: u32,
    height: u32,
}

println!("{:?}", rect);  // Rectangle { width: 30, height: 50 }
```

### Clone 和 Copy

```rust
// Clone: 深拷贝
let s1 = String::from("hello");
let s2 = s1.clone();

// Copy: 栈上拷贝（用于标量类型）
let x = 5;
let y = x;  // 整数实现了 Copy
```

### 默认实现

```rust
#[derive(Default, Debug, Clone, Copy, PartialEq)]
struct Config {
    timeout: u32,
}
```

## 常用命令

```bash
# 创建项目
cargo new my_project

# 构建项目
cargo build

# 运行项目
cargo run

# 运行测试
cargo test

# 发布构建
cargo build --release

# 添加依赖
cargo add serde
```

## 学习路径

1. 基础语法（变量、函数、控制流）
2. 所有权与借用
3. 结构体与枚举
4. 模式匹配与错误处理
5. 泛型与 trait
6. 生命周期
7. 迭代器与闭包
8. 并发编程

## 相关资源

- [The Rust Programming Language](https://doc.rust-lang.org/book/) - 官方书籍
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/) - 实例学习
- [Rustlings](https://github.com/rust-lang/rustlings/) - 交互式练习
- [Rust Playground](https://play.rust-lang.org/) - 在线编译运行