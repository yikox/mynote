---
title: OpenGL Compute Shader 入门
mathjax: true
date: 2022-02-25 19:44:39
tags: [GPU,OpenGL]
categories: GPU
---

> OpenGL入门学习，通过这篇文章，可以简单的编写OpenGL程序进行计算（computer shader）。 
> *个别图片来源于网络，本篇文章仅是个人学习的总结，且时间有点久远，没有留存当时截图时的链接。*

<!-- more -->

### CPU&&GPU

GPU全称是Graphics Processing Unit，图形处理单元。它的功能最初与名字一致，是专门用于绘制图像和处理图元数据的特定芯片，后来渐渐加入了其它很多功能。

先认识一下当前移动端的GPU，移动端一般是CPU和GPU集成在一起为一个SOC的，安卓阵营主要有高通的骁龙系列，GPU的架构是Adreno，以及联发科的天玑系列和华为的麒麟系列，它们GPU的架构都是ARM公司的Mali架构。
IOS阵营比较特殊，苹果是的SOC是苹果自研并不对外公布，我们直接叫它苹果4/5核GPU。

GPU和CPU在架构上也是完全不同的，如下图展示的一样，CPU有强大的算数逻辑单元，巨大的cache，复杂的控制器，也是因此CPU擅长逻辑控制和串行运算。而GPU有较小的cache，简单的控制器，众多高效节能的ALU，为了提高吞吐量而重度管线化，总结就是GPU适用于计算密集型和易于并发的程序。

![CPU架构图](/image/cpu_struct.png)
![GPU架构图](/image/gpu_struct.png)

### OpenGL ES

OpenGL是一个知名度很高的名词，一般它被认为是一个API(Application Programming Interface, 应用程序编程接口)，包含了一系列可以操作图形、图像的函数。然而，OpenGL本身并不是一个API，它仅仅是一个由Khronos组织制定并维护的规范(Specification)，OpenGL库的开发者通常是显卡的生产商。

OpenGL ES是OpenGL的一个子集，专门用于嵌入式设备的一套规范。

OpenGL自身是一个巨大的状态机(State Machine)，用户通过OpenGL提供的API修改OpenGL的状态，而用户修改的状态会保存在OpenGL的上下文(Context)中，当状态机运行的时候，需要基于一个上下文的环境（相当于一个配置表，任务表）运行。
[TODO]：上下文的参数，变量，内容需要详细了解，上下文与状态机的交互过程。

### 管线（pipeline）

管线是OpenGL的一个概念，OpenGL本身的主要业务是渲染，因此OpenGL基于流水线的思想实现了一套渲染管线，数据通过管线上的一个个功能不同的着色器，实现顶点变换，光栅化，片段着色等一系列操作，最终呈现在屏幕上。

下图是一个经典的着色器示意图，由六个着色器组成，三个灰色（图元装配，光栅化，测试与混合）的着色器不可编程，是由OpenGL固定好的操作，三个蓝色（顶点着色器，几何着色器，片段着色器）的着色器是可以自己编程替换的。

[渲染管线图](/image/render_pipeline.png)

不过本文的重点不是渲染，而是计算管线，下面是一个经典的渲染管线和计算管线的对比图片

[计算管线图](/image/compute_pipeline.png)

该图片中左边的流程是渲染管线，右边的流程是计算管线，计算管线相较于渲染管线来说非常短，仅有一个计算着色器。与纹理，内存等资源进行交互，简单且纯粹。这也使得它能把全部的GPU资源投入到计算当中去。

### 着色器(shader)

先放一个简单的计算shader代码,这个shader代码实现了一个简单的y=x*scale+bias的功能
```glsl
//OpenGL ES的版本
#version 310 es

//输出的纹理Y，绑定到image3D对象，在OpenGL中只有image对象有写入纹理接口
//rgba32f表示输入纹理的格式，对应的还有像rgba16f之类的，详细的查询官网
//binding=0表示绑定点为0，可以理解为采样器的门牌号为0，也可以理解为我们要把纹理Y绑定到编号为0的资源，它是一个image3D资源
//writeonly是一个修饰符，对应的还有readonly,一般用来修饰image对象和buffer对象
//highp是一个精度限定符，对应的还有mediump和lowp,计算着色器都支持，可以修饰在对象前面，也可以全局修饰
layout(rgba32f, binding = 0) writeonly uniform highp image3D Y;
//输入的纹理X，绑定到sampler3D对象，sampler是也叫采样器，可以对纹理进行采样，在GL中可以设置采样方式：最近邻，双线性等
layout(binding = 1) uniform highp sampler3D X;

//uniform，也叫统一资源限定符，一般我们也会描述它们为uniform变量，它们是一种可以由CPU端配置数据到GPU端使用的数据，GPU端可见不可修改
//vec4 是glsl语言的一种数据格式，向量
layout(binding = 2) uniform vec4 scale;
layout(binding = 3) uniform vec4 bias;

//这个语句是计算着色器特有的，用来配置本地工作组大小
layout (local_size_x = 1, local_size_y = 1, local_size_z = 1) in;

//main函数，入口函数，大家都懂
void main()
{
    //ivec3 也是向量数据，i表示整数
    //gl_GlobalInvocationID则是一组特殊的宏，表示当前线程在全局中的编号
    ivec3 pos = ivec3(gl_GlobalInvocationID);
    
    //texelFetch是纹理采样函数，它有三个参数，纹理，坐标，mipp级数（计算着色器使用一般设为0）
    vec4 color   = texelFetch(X, pos, 0) * scale + bias;

    //imageStore是写纹理数据的函数，只可用于image对象
    imageStore(Y, pos, color);
}
```
#### 精度限定符
precision lowp float ;
precision mediump int;
