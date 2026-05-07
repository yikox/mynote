# SwiftUI 实战：从零构建一个 Todo List App

> 本文通过实战驱动的方式，带你从环境搭建到完整功能，入门 SwiftUI。

---

## 1. 项目概述：我们要做什么

我们将构建一个 **Todo List App**，功能包括：

- ✅ 查看任务列表
- ➕ 添加新任务
- ✏️ 编辑任务
- 🗑️ 删除任务
- ✔️ 标记完成

---

## 2. 环境准备

### 工具要求

- macOS + **Xcode 15+**（支持 iOS 17+ 新特性）
- 可用 iOS Simulator（iPhone 15 等）

### 创建项目

```
Xcode → File → New → Project → App
    → Interface: SwiftUI
    → Lifecycle: SwiftUI App
    → Language: Swift
```

---

## 3. 数据模型

### 创建任务模型

```swift
// Models/TodoItem.swift

import Foundation

struct TodoItem: Identifiable, Codable {
    var id: UUID
    var title: String
    var isCompleted: Bool
    var createdAt: Date
    
    init(title: String) {
        self.id = UUID()
        self.title = title
        self.isCompleted = false
        self.createdAt = Date()
    }
}
```

> **知识点**：
> - `Identifiable`：让 SwiftUI 能唯一标识每个元素
> - `Codable`：支持数据持久化（UserDefaults / 文件存储）
> - `UUID`：全局唯一标识符

---

## 4. 视图层

### 4.1 主视图（内容列表）

```swift
// Views/ContentView.swift

import SwiftUI

struct ContentView: View {
    @State private var items: [TodoItem] = []
    @State private var showingAddSheet = false
    
    var body: some View {
        NavigationStack {
            List {
                ForEach($items) { $item in
                    TodoRowView(item: $item)
                }
                .onDelete(perform: deleteItems)
            }
            .navigationTitle("待办事项")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                AddItemView(items: $items)
            }
        }
    }
    
    private func deleteItems(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
    }
}

#Preview {
    ContentView()
}
```

> **知识点**：
> - `@State`：修饰值类型，驱动视图更新
> - `NavigationStack`：导航容器（iOS 16+，替代 NavigationView）
> - `.toolbar`：添加工具栏按钮
> - `.sheet`：以模态方式展示新视图
> - `$items`： Binding 绑定，支持双向修改

### 4.2 任务行视图

```swift
// Views/TodoRowView.swift

import SwiftUI

struct TodoRowView: Item: View {
    @Binding var item: TodoItem
    
    var body: some View {
        HStack(spacing: 12) {
            Button {
                item.isCompleted.toggle()
            } label: {
                Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(item.isCompleted ? .green : .gray)
            }
            .buttonStyle(.plain)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.body)
                    .strikethrough(item.isCompleted)
                    .foregroundStyle(item.isCompleted ? .secondary : .primary)
                
                Text(item.createdAt, style: .date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
}
```

> **知识点**：
> - `@Binding`：接收父视图的引用，双向绑定
> - `.strikethrough()`：删除线文本
> - `.foregroundStyle()`：设置前景色
> - `.buttonStyle(.plain)`：移除按钮默认样式

### 4.3 添加任务视图

```swift
// Views/AddItemView.swift

import SwiftUI

struct AddItemView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var items: [TodoItem]
    
    @State private var title = ""
    @FocusState private var isTitleFocused: Bool
    
    var body: some View {
        NavigationStack {
            Form {
                Section("任务内容") {
                    TextField("输入待办事项...", text: $title)
                        .focused($isTitleFocused)
                }
            }
            .navigationTitle("新建任务")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("添加") {
                        addItem()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                isTitleFocused = true
            }
        }
    }
    
    private func addItem() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else { return }
        
        let newItem = TodoItem(title: trimmedTitle)
        items.insert(newItem, at: 0)
        dismiss()
    }
}
```

> **知识点**：
> - `@Environment(\.dismiss)`：获取关闭视图的环境值
> - `@FocusState`：管理输入焦点
> - `.onAppear`：视图出现时执行
> - `.disabled()`：条件禁用按钮

---

## 5. 数据持久化

### 5.1 使用 @AppStorage（简单场景）

```swift
// 方式1: @AppStorage，适合简单键值对

struct ContentView: View {
    @AppStorage("username") private var username = ""
    
    var body: some View {
        Text("Hello, \(username)")
    }
}
```

### 5.2 使用 ObservableObject（复杂场景）

```swift
// ViewModels/TodoViewModel.swift

import SwiftUI

@MainActor
class TodoViewModel: ObservableObject {
    @Published var items: [TodoItem] = []
    
    private let saveKey = "todo_items"
    
    init() {
        loadItems()
    }
    
    func addItem(title: String) {
        let newItem = TodoItem(title: title)
        items.insert(newItem, at: 0)
        saveItems()
    }
    
    func deleteItems(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
        saveItems()
    }
    
    func toggleComplete(for item: TodoItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index].isCompleted.toggle()
            saveItems()
        }
    }
    
    private func saveItems() {
        if let encoded = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(encoded, forKey: saveKey)
        }
    }
    
    private func loadItems() {
        guard let data = UserDefaults.standard.data(forKey: saveKey),
              let decoded = try? JSONDecoder().decode([TodoItem].self, from: data) else {
            return
        }
        items = decoded
    }
}
```

---

## 6. 视图修饰符速查

### 布局类

| 修饰符 | 作用 |
|--------|------|
| `padding()` | 内边距 |
| `frame(width:height:)` | 固定尺寸 |
| `spacer()` | 弹性空间 |
| `HStack / VStack / ZStack` | 水平/垂直/重叠布局 |
| `LazyVStack / LazyHStack` | 按需加载列表 |

### 样式类

| 修饰符 | 作用 |
|--------|------|
| `background(Color)` | 背景色 |
| `cornerRadius()` | 圆角 |
| `shadow(radius:)` | 阴影 |
| `font(.title)` | 字体 |
| `foregroundStyle(.blue)` | 前景色 |

### 交互类

| 修饰符 | 作用 |
|--------|------|
| `onTapGesture` | 点击 |
| `onAppear` | 出现时 |
| `onChange(of:)` | 值变化时 |
| `alert("标题", isPresented:)` | 弹出警告 |

---

## 7. 常用控件一览

### 文本与输入

```swift
Text("Hello SwiftUI")
    .font(.largeTitle)
    .foregroundStyle(.blue)

TextField("placeholder", text: $text)
    .textFieldStyle(.roundedBorder)

SecureField("密码", text: $password)
```

### 按钮与手势

```swift
Button("点击我") {
    print("点击")
}

Button {
    // action
} label: {
    Image(systemName: "star.fill")
        .font(.title)
}

Link("访问官网", destination: URL(string: "https://apple.com")!)
```

### 图片与图标

```swift
Image(systemName: "photo.fill")
    .resizable()
    .scaledToFill()
    .frame(width: 100, height: 100)
    .clipShape(Circle())
```

### 开关与选择

```swift
Toggle("深色模式", isOn: $isDarkMode)

Picker("选项", selection: $selected) {
    Text("选项A").tag("a")
    Text("选项B").tag("b")
}

Slider(value: $value, in: 0...100)
```

---

## 8. 导航与跳转

### 8.1 基本导航

```swift
NavigationStack {
    List(items) { item in
        NavigationLink(value: item) {
            Text(item.title)
        }
    }
    .navigationDestination(for: TodoItem.self) { item in
        DetailView(item: item)
    }
}
```

### 8.2 TabView（多标签）

```swift
struct MainTabView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem { Label("首页", systemImage: "house") }
                .tag(0)
            
            SettingsView()
                .tabItem { Label("设置", systemImage: "gear") }
                .tag(1)
        }
    }
}
```

---

## 9. 动画效果

### 简单过渡动画

```swift
Button("切换") {
    withAnimation(.easeInOut(duration: 0.3)) {
        isShowing.toggle()
    }
}

if isShowing {
    Text("Hello")
        .transition(.opacity.combined(with: .scale))
}
```

### 视图过渡

```swift
// 滑入效果
.transition(.move(edge: .trailing))

// 组合效果
.transition(.asymmetric(
    insertion: .scale,
    removal: .opacity
))
```

---

## 10. 网络请求示例

```swift
// Views/FetchDemoView.swift

import SwiftUI

struct Post: Codable, Identifiable {
    let id: Int
    let title: String
    let body: String
}

struct FetchDemoView: View {
    @State private var posts: [Post] = []
    @State private var isLoading = false
    
    var body: some View {
        List(posts) { post in
            VStack(alignment: .leading) {
                Text(post.title)
                    .font(.headline)
                Text(post.body)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .overlay {
            if isLoading {
                ProgressView("加载中...")
            }
        }
        .task {
            await fetchPosts()
        }
    }
    
    @Sendable
    private func fetchPosts() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let url = URL(string: "https://jsonplaceholder.typicode.com/posts")!
            let (data, _) = try await URLSession.shared.data(from: url)
            posts = try JSONDecoder().decode([Post].self, from: data)
        } catch {
            print("加载失败: \(error)")
        }
    }
}
```

> **知识点**：
> - `.task` 修饰符：视图出现时异步加载
> - `async/await`：Swift 并发模型
> - `@Sendable`：并发安全标注

---

## 11. 完整项目结构

```
TodoApp/
├── App/
│   └── TodoAppApp.swift          # 入口
├── Models/
│   └── TodoItem.swift            # 数据模型
├── ViewModels/
│   └── TodoViewModel.swift       # 业务逻辑
├── Views/
│   ├── ContentView.swift         # 主视图
│   ├── TodoRowView.swift         # 列表行
│   ├── AddItemView.swift         # 添加视图
│   └── FetchDemoView.swift       # 网络示例
└── Assets.xcassets/              # 资源目录
```

---

## 12. 下一步建议

| 方向 | 学习内容 |
|------|----------|
| **进阶** | `@Observable` macro (iOS 17+)、Navigation 系列 API |
| **状态管理** | EnvironmentObject、App Storage |
| **并发** | async/await、Actor、Task |
| **存储** | Core Data、SQLite.swift |
| **实战** | Apple 官方教程 [Meet SwiftUI](https://developer.apple.com/tutorials/swiftui) |

---

> 动手试试吧！先 copy 代码跑通，再逐步改造，你会发现 SwiftUI 的魔力 🚀