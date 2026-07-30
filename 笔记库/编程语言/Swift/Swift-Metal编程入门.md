# Swift + Metal 编程入门

> Metal 是 Apple 提供的高性能 GPU 编程框架，支持图形渲染和通用计算（GPGPU）。

---

## 1. Metal 概述

### 什么是 Metal？

- Apple 提供的**低层次 GPU API**
- 直接访问 GPU 硬件，性能极高
- 支持 **图形渲染** 和 **并行计算（Compute Shader）**
- 可在 iOS、macOS、tvOS 上使用

### 应用场景

| 场景 | 说明 |
|------|------|
| 3D 图形渲染 | 游戏、AR/VR、可视化 |
| 通用计算 | 机器学习、图像处理、物理模拟 |
| 视频编解码 | 高性能视频处理 |

---

## 2. 核心组件一览

```
MTLDevice          → 获取 GPU 设备
    ↓
MTLCommandQueue    → 命令队列，负责提交任务
    ↓
MTLCommandBuffer   → 命令缓冲区，存储具体操作
    ↓
MTLComputeCommandEncoder   或   MTLRenderCommandEncoder
    ↓
MTLBuffer / MTLTexture     → 数据/纹理资源
```

---

## 3. 基本流程

```swift
import Metal

// 1. 获取默认 GPU 设备
let device = MTLCreateSystemDefaultDevice()

// 2. 创建命令队列
let commandQueue = device.makeCommandQueue()!

// 3. 创建缓冲区（存放数据）
let bufferSize = 1024 * sizeof(Float)
let inputBuffer = device.makeBuffer(length: bufferSize, options: .storageModeShared)!
let outputBuffer = device.makeBuffer(length: bufferSize, options: .storageModeShared)!

// 4. 编码命令
let commandBuffer = commandQueue.makeCommandBuffer()!
let computeEncoder = commandBuffer.makeComputeCommandEncoder()!

// ... 设置管线、参数、Dispatch ...
computeEncoder.endEncoding()

// 5. 提交执行
commandBuffer.commit()
commandBuffer.waitUntilCompleted()
```

---

## 4. 计算着色器 (Compute Shader) 示例

### 4.1 Metal Shader 文件（.metal）

```metal
// compute.metal

#include <metal_stdlib>
using namespace metal;

// 核函数：每个线程处理一个数据
kernel void add_arrays(
    device const float* inputA [[buffer(0)]],
    device const float* inputB [[buffer(1)]],
    device float* output      [[buffer(2)]],
    uint id [[thread_position_in_grid]]
) {
    output[id] = inputA[id] + inputB[id];
}
```

### 4.2 Swift 端调用

```swift
import Metal

class MetalCompute {
    let device: MTLDevice
    let commandQueue: MTLCommandQueue
    let pipelineState: MTLComputePipelineState
    
    init() throws {
        // 获取默认 GPU 设备
        guard let device = MTLCreateSystemDefaultDevice() else {
            throw NSError(domain: "Metal", code: -1, userInfo: [NSLocalizedDescriptionKey: "不支持 Metal"])
        }
        self.device = device
        
        // 创建命令队列
        guard let queue = device.makeCommandQueue() else {
            throw NSError(domain: "Metal", code: -2, userInfo: nil)
        }
        self.commandQueue = queue
        
        // 加载 Metal 库（编译好的 shader）
        guard let library = device.makeDefaultLibrary() else {
            throw NSError(domain: "Metal", code: -3, userInfo: nil)
        }
        
        // 获取核函数
        guard let kernel = library.makeFunction(name: "add_arrays") else {
            throw NSError(domain: "Metal", code: -4, userInfo: nil)
        }
        
        // 创建计算管线
        self.pipelineState = try device.makeComputePipelineState(function: kernel)
    }
    
    func run(inputA: [Float], inputB: [Float], count: Int) -> [Float] {
        // 准备输入数据
        var output = [Float](repeating: 0, count: count)
        
        // 创建缓冲区
        let bufferA = device.makeBuffer(
            bytes: inputA,
            length: count * MemoryLayout<Float>.stride,
            options: .storageModeShared
        )!
        let bufferB = device.makeBuffer(
            bytes: inputB,
            length: count * MemoryLayout<Float>.stride,
            options: .storageModeShared
        )!
        let bufferOut = device.makeBuffer(
            length: count * MemoryLayout<Float>.stride,
            options: .storageModeShared
        )!
        
        // 创建命令缓冲区
        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeComputeCommandEncoder() else {
            return output
        }
        
        // 设置计算管线
        encoder.setComputePipelineState(pipelineState)
        
        // 绑定输入/输出缓冲区
        encoder.setBuffer(bufferA, offset: 0, index: 0)
        encoder.setBuffer(bufferB, offset: 0, index: 1)
        encoder.setBuffer(bufferOut, offset: 0, index: 2)
        
        // 配置线程组
        let threadsPerGroup = MTLSize(width: 256, height: 1, depth: 1)
        let numGroups = MTLSize(
            width: (count + 255) / 256,  // 向上取整
            height: 1,
            depth: 1
        )
        encoder.dispatchThreadgroups(numGroups, threadsPerThreadgroup: threadsPerGroup)
        
        // 结束编码并提交
        encoder.endEncoding()
        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
        
        // 读取结果
        let pointer = bufferOut.contents().bindMemory(to: Float.self, capacity: count)
        output = Array(UnsafeBufferPointer(start: pointer, count: count))
        
        return output
    }
}

// 使用示例
let compute = try MetalCompute()
let a: [Float] = [1, 2, 3, 4, 5]
let b: [Float] = [10, 20, 30, 40, 50]
let result = compute.run(inputA: a, inputB: b, count: 5)
print(result)  // [11, 22, 33, 44, 55]
```

---

## 5. 图形渲染（Render Pipeline）基础

### 5.1 顶点/片元 Shader（.metal）

```metal
// shader.metal

#include <metal_stdlib>
using namespace metal;

// 顶点输入结构体
struct VertexIn {
    float3 position [[attribute(0)]];
    float4 color    [[attribute(1)]];
};

// 顶点输出 / 片元输入
struct VertexOut {
    float4 position [[position]];
    float4 color;
};

// 顶点着色器
vertex VertexOut vertexShader(
    uint vertexID [[vertex_id]],
    constant float3* positions [[buffer(0)]],
    constant float4* colors    [[buffer(1)]]
) {
    VertexOut out;
    out.position = float4(positions[vertexID], 1.0);
    out.color = colors[vertexID];
    return out;
}

// 片元着色器
fragment float4 fragmentShader(VertexOut in [[stage_in]]) {
    return in.color;
}
```

### 5.2 Swift 渲染代码框架

```swift
class MetalRenderer {
    let device: MTLDevice
    let commandQueue: MTLCommandQueue
    let pipelineState: MTLRenderPipelineState
    let vertexBuffer: MTLBuffer
    
    struct Vertex {
        var position: SIMD3<Float>
        var color: SIMD4<Float>
    }
    
    init() throws {
        guard let device = MTLCreateSystemDefaultDevice() else {
            throw NSError(domain: "Metal", code: -1, userInfo: nil)
        }
        self.device = device
        
        guard let queue = device.makeCommandQueue() else {
            throw NSError(domain: "Metal", code: -2, userInfo: nil)
        }
        self.commandQueue = queue
        
        // 构建渲染管线描述符
        let descriptor = MTLRenderPipelineDescriptor()
        let library = device.makeDefaultLibrary()!
        descriptor.vertexFunction = library.makeFunction(name: "vertexShader")
        descriptor.fragmentFunction = library.makeFunction(name: "fragmentShader")
        descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        
        self.pipelineState = try device.makeRenderPipelineState(descriptor: descriptor)
        
        // 创建顶点缓冲区
        let vertices: [Vertex] = [
            Vertex(position: [0, 0.5, 0], color: [1, 0, 0, 1]),  // 红
            Vertex(position: [-0.5, -0.5, 0], color: [0, 1, 0, 1]), // 绿
            Vertex(position: [0.5, -0.5, 0], color: [0, 0, 1, 1])  // 蓝
        ]
        self.vertexBuffer = device.makeBuffer(
            bytes: vertices,
            length: vertices.count * MemoryLayout<Vertex>.stride,
            options: .storageModeShared
        )!
    }
    
    func render(in view: MTKView) {
        guard let drawable = view.currentDrawable,
              let renderPassDescriptor = view.currentRenderPassDescriptor,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) else {
            return
        }
        
        encoder.setRenderPipelineState(pipelineState)
        encoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
        
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
```

---

## 6. 纹理（Texture）操作

### 读取纹理数据

```swift
// 读取 Metal 纹理像素
func readTexture(_ texture: MTLTexture) {
    let width = texture.width
    let height = texture.height
    let bytesPerPixel = 4
    let bytesPerRow = width * bytesPerPixel
    
    var pixels = [UInt8](repeating: 0, count: width * height * bytesPerPixel)
    let region = MTLRegion(origin: MTLOrigin(x: 0, y: 0, z: 0),
                           size: MTLSize(width: width, height: height, depth: 1))
    
    texture.getBytes(&pixels, bytesPerRow: bytesPerRow, from: region, mipmapLevel: 0)
    
    // 处理像素数据...
}
```

---

## 7. 内存管理要点

### 存储模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `.storageModeShared` | CPU/GPU 共享内存 | 需要 CPU 读写 |
| `.storageModeManaged` | 可管理统一内存 | macOS 高效访问 |
| `.storageModePrivate` | GPU 私有内存 | 仅 GPU 使用，性能最佳 |
| `.storageModeMemoryless` | 临时显存 | 渲染目标，不需要持久化 |

### 数据同步

```swift
// CPU -> GPU 同步
encoder.useResources([bufferA, bufferB], usage: .read)

// GPU -> CPU 同步（在等待完成后读取）
commandBuffer.waitUntilCompleted()
let pointer = buffer.contents().bindMemory(...)
```

---

## 8. 调试工具

### Xcode 内置工具

- **Metal Frame Capture**：捕获 GPU 调用
- **Metal System Trace**：分析 GPU 性能
- **GPU Profiler**：查看着色器耗时

### 在代码中添加注释

```swift
encoder.startMonitoring()

// ... GPU 操作 ...

encoder.stopMonitoring()
let time = encoder.elapsedGpuTime  // 获取执行时间
```

---

## 9. 常见错误处理

```swift
// 检查 Metal 是否可用
guard MTLCreateSystemDefaultDevice() != nil else {
    print("当前设备不支持 Metal")
}

// 处理管线编译错误
do {
    pipelineState = try device.makeComputePipelineState(function: kernel)
} catch let error as NSError {
    print("Shader 编译失败: \(error.localizedDescription)")
}
```

---

## 10. 入门建议

1. **从 Compute Shader 开始**：比图形渲染更简单，适合理解 Metal 流程
2. **善用官方模板**：Xcode -> New Project -> Game / Metal
3. **用 MTKView**：简化渲染循环，不必手动管理 DisplayLink
4. **参考 Apple 官方文档**：  
   - [Metal Best Practices Guide](https://developer.apple.com/documentation/metal/metal_best_practices_guide)  
   - [MetalKit](https://developer.apple.com/documentation/metalkit)

---

## 学习路径推荐

```
第1步: 安装 Xcode，创建 Metal Game 项目
第2步: 修改默认 shader，观察渲染结果
第3步: 尝试 Compute Shader（GPU 并行计算）
第4步: 加载纹理，处理图像数据
第5步: 深入学习：延迟渲染、GPU Particle 等
```

---

> 祝你玩得开心 🚀