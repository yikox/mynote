#### 解析模型后显示trt网络
```
polygraphy inspect model identity.onnx --show layers --display-as=trt
```

#### 显示TRT Engine网络
```
polygraphy inspect model dynamic_identity.engine --show layers
```

#### 编译ONNX=>TensorRT
eg:
```
polygraphy convert dynamic_identity.onnx -o dynamic_identity.engine \
    --trt-min-shapes X:[1,3,28,28] --trt-opt-shapes X:[1,3,28,28] --trt-max-shapes X:[1,3,28,28] \
    --trt-min-shapes X:[1,3,28,28] --trt-opt-shapes X:[4,3,28,28] --trt-max-shapes X:[32,3,28,28] \
    --trt-min-shapes X:[128,3,28,28] --trt-opt-shapes X:[128,3,28,28] --trt-max-shapes X:[128,3,28,28]
```
对于具有多个输入的模型，只需为每个输入提供多个参数 `--trt-*-shapes` 参数. 例如: `--trt-min-shapes input0:[10,10] input1:[10,10] input2:[10,10] ...`
提示：如果我们只想使用一个配置文件，其中min,opt,max三种一致的话，我们可以利用运行时输入形状选项：``--input-shapes`作为一种简写，而不是单独设置min/opt/max。

在引擎构建过程中，指定一个或多个优化配置文件。优化配置文件包括每个输入的3个形状：
- min：shape可以使用的最小形状。
- opt：TensorRT应该优化的形状。通常，您会希望该形状与最常用的形状相对应。
- max：shape可以使用的的最大形状。

#### 比较不同框架的运行情况

##### 比较TnesorRT和OnnxRuntime的输出
```
polygraphy run dynamic_identity.onnx --trt --onnxrt

#提供输入shape
polygraphy run dynamic_identity.onnx --trt --onnxrt \
    --input-shapes X:[1,2,4,4]
```
##### 比较不同精度
```
polygraphy run dynamic_identity.onnx --trt --fp16 --onnxrt \
    --input-shapes X:[1,2,4,4]
```