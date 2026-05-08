# Swift 语法快速入门

> Swift 是一种安全、快速、互动的编程语言，由 Apple 开发，用于 iOS、macOS 等平台。

---

## 1. 变量与常量

### 声明

```swift
// 常量：值不可更改
let name = "Swift"
let age: Int = 10

// 变量：值可以更改
var count = 0
count = 1
```

### 类型注解

```swift
var message: String = "Hello"
var score: Double = 99.5
var items: [String] = ["a", "b"]
```

---

## 2. 数据类型

### 基本类型

| 类型 | 说明 | 示例 |
|------|------|------|
| Int | 整数 | `42` |
| Double/Float | 浮点数 | `3.14` |
| String | 字符串 | `"Hello"` |
| Bool | 布尔值 | `true` / `false` |
| Array | 数组 | `[1, 2, 3]` |
| Dictionary | 字典 | `["key": "value"]` |
| Set | 集合 | `Set([1, 2, 3])` |

### 可选类型 (Optional)

```swift
var name: String? = nil  // 可为 nil
name = "Swift"

// 安全解包
if let safeName = name {
    print(safeName)
}

// ?? 空合运算符
let displayName = name ?? "Guest"
```

---

## 3. 函数

### 基本语法

```swift
func greet(name: String) -> String {
    return "Hello, \(name)!"
}

print(greet(name: "World"))  // Hello, World!
```

### 多参数与默认参数

```swift
func add(a: Int, b: Int, multiplier: Int = 1) -> Int {
    return (a + b) * multiplier
}

add(a: 1, b: 2)                    // 3
add(a: 1, b: 2, multiplier: 10)   // 30
```

### inout 参数（修改外部变量）

```swift
func swap(_ a: inout Int, _ b: inout Int) {
    let temp = a
    a = b
    b = temp
}

var x = 1, y = 2
swap(&x, &y)
print(x, y)  // 2 1
```

### 泛型函数

```swift
func swapValues<T>(_ a: inout T, _ b: inout T) {
    let temp = a
    a = b
    b = temp
}
```

---

## 4. 闭包 (Closure)

```swift
// 完整语法
let add: (Int, Int) -> Int = { (a, b) in
    return a + b
}

// 简洁语法
let multiply = { $0 * $1 }
```

---

## 5. 控制流

### if / else

```swift
let score = 85
if score >= 90 {
    print("A")
} else if score >= 60 {
    print("B")
} else {
    print("C")
}
```

### switch

```swift
let rank = "A"
switch rank {
case "A": print("优秀")
case "B": print("良好")
default: print("其他")
}

// 支持范围匹配
let grade = 85
switch grade {
case 90...100: print("A")
case 80..<90:  print("B")
default:       print("C")
}
```

### for 循环

```swift
// 遍历范围
for i in 1...5 {
    print(i)  // 1, 2, 3, 4, 5
}

// 遍历数组
let names = ["Alice", "Bob"]
for name in names {
    print(name)
}

// 遍历字典
let dict = ["a": 1, "b": 2]
for (key, value) in dict {
    print("\(key): \(value)")
}
```

### while

```swift
var n = 0
while n < 5 {
    n += 1
}
```

---

## 6. 结构体 (Struct)

> 值类型，用于封装简单数据。

```swift
struct Point {
    var x: Double
    var y: Double
    
    // 构造器
    init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
    
    // 方法（若要修改属性，需加 mutating）
    mutating func moveBy(dx: Double, dy: Double) {
        x += dx
        y += dy
    }
}

var p = Point(x: 0, y: 0)
p.moveBy(dx: 10, dy: 5)
```

---

## 7. 类 (Class)

> 引用类型，支持继承。

```swift
class Animal {
    var name: String
    var age: Int
    
    // 构造器
    init(name: String, age: Int) {
        self.name = name
        self.age = age
    }
    
    func speak() {
        print("\(name) makes a sound")
    }
}

// 子类继承
class Dog: Animal {
    var breed: String
    
    init(name: String, age: Int, breed: String) {
        self.breed = breed
        super.init(name: name, age: age)
    }
    
    // 重写方法
    override func speak() {
        print("\(name) barks")
    }
}

let dog = Dog(name: "Buddy", age: 3, breed: "Golden Retriever")
dog.speak()  // Buddy barks
```

---

## 8. 枚举 (Enum)

```swift
enum Direction {
    case north, south, east, west
}

enum Status {
    case success(Int, String)   // 关联值
    case failure(String)
}

let status = Status.success(200, "OK")

switch status {
case .success(let code, let message):
    print("成功: \(code) - \(message)")
case .failure(let error):
    print("失败: \(error)")
}
```

---

## 9. 协议 (Protocol)

> 定义行为的蓝图，类似其他语言的接口。

```swift
protocol Runnable {
    var speed: Double { get }
    func run()
}

class Person: Runnable {
    var speed: Double = 5.0
    
    func run() {
        print("人以 \(speed) m/s 奔跑")
    }
}

// 协议扩展
extension Runnable {
    func describe() {
        print("速度: \(speed)")
    }
}
```

---

## 10. 泛型 (Generics)

### 泛型函数

```swift
func swap<T>(_ a: inout T, _ b: inout T) {
    let temp = a
    a = b
    b = temp
}
```

### 泛型结构体

```swift
struct Stack<Element> {
    var items: [Element] = []
    
    mutating func push(_ item: Element) {
        items.append(item)
    }
    
    mutating func pop() -> Element {
        return items.removeLast()
    }
}

var stack = Stack<Int>()
stack.push(1)
stack.push(2)
print(stack.pop())  // 2
```

---

## 11. 扩展 (Extension)

```swift
extension Int {
    var isEven: Bool {
        return self % 2 == 0
    }
    
    func doubled() -> Int {
        return self * 2
    }
}

print(4.isEven)        // true
print(5.doubled())     // 10
```

---

## 12. 错误处理

```swift
enum NetworkError: Error {
    case noConnection
    case timeout
}

func fetchData() throws -> String {
    throw NetworkError.timeout
}

// 使用 try / catch
do {
    let data = try fetchData()
    print(data)
} catch NetworkError.timeout {
    print("请求超时")
} catch {
    print("未知错误: \(error)")
}
```

---

## 13. 访问控制

| 关键字 | 作用域 |
|--------|--------|
| `private` | 仅当前作用域 |
| `fileprivate` | 当前文件 |
| `internal` | 模块内（默认） |
| `public` | 任意模块 |
| `open` | 可被继承/重写（仅类） |

---

## 快速对比

| 特性 | 类 (Class) | 结构体 (Struct) | 枚举 (Enum) |
|------|------------|-----------------|-------------|
| 类型 | 引用 | 值 | 值 |
| 继承 | ✅ | ❌ | ❌ |
| 构造器 | init | init | 关联值 |
| 用途 | 复杂对象 | 轻量数据 | 固定选项 |

---

## 学习资源

- [Swift 官方文档](https://swift.org/documentation/)
- [The Swift Programming Language (中文版)](https://swift.bootcss.com/)
- [菜鸟教程 Swift](https://www.runoob.com/swift/swift-tutorial.html)