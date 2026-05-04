---
title: FPIE(泊松融合)使用指南
date: 2023-09-11T17:16:27+08:00
tags: fpie
categories: 三方库介绍
mathjax: true
---
> [Fast-Poisson-Image-Editin](https://github.com/Trinkle23897/Fast-Poisson-Image-Editing)是一种快速的泊松图像编辑实现，可以利用多核CPU或GPU来处理高分辨率图像输入。
<!--more-->

## 介绍
[Fast-Poisson-Image-Editin](https://github.com/Trinkle23897/Fast-Poisson-Image-Editing)是一种快速的泊松图像编辑实现，可以利用多核CPU或GPU来处理高分辨率图像输入。
## 使用
### 安装
- 安装现成版本
```shell
pip install fpie
```
- 编译带 cuda 的版本
	- 需要带 cuda 环境的系统
	- 下载[Fast-Poisson-Image-Editin](https://github.com/Trinkle23897/Fast-Poisson-Image-Editing)，进入Fast-Poisson-Image-Editing文件夹
	- 使用命令`python3 setup.py bdist_wheel`打包 fpie 轮子
	- 打包成功后有 dist 文件夹下有生成的轮子，安装即可
- 使用`fpie --check-backend`检查支持的后端，我们的目标是 cuda 后端

### 通过代码使用
fpie 的教程是通过命令 fpie 使用，但是我们可以直接引用其中的`Processor`来使用例如
```python
from fpie.io import read_images, write_image
from fpie.process import EquProcessor, GridProcessor #引入两种模式的 processor
import time
# MPI 后端使用的，我们的用不到
import os
CPU_COUNT = os.cpu_count() or 1
if __name__ == "__main__":
    src, mask, tgt = read_images(".png", "mask.png", "target.png")
    # 两种 processor的初始化
    # proc = EquProcessor("avg", "cuda", CPU_COUNT, 100, 1024)
    proc = GridProcessor("avg", "cuda", CPU_COUNT, 100, 1024, 4, 4)
    
    t1 = time.time()
    #传入 src,mask,tgt三张图片，后面两个坐标第一个是 mask 在 src图上的坐标，第二个是 mask 在 tgt 图上的坐标
    n = proc.reset(src, mask, tgt, (0, 0), (0, 0))
    t2 = time.time()
    print("reset time: {} ms".format((t2 - t1)*1000))
    proc.sync()
    # 迭代，参数 500是迭代次数，返回图像和误差
    result, err = proc.step(500)  # type: ignore
    print(f"abs error {err}")
    t3 = time.time()
    print("step time: {} ms".format((t3 - t2)*1000))
    print("total time: {} ms".format((t3 - t1)*1000))
    write_image("fpie_res1.png", result)
```
## 总结
我是拿来代替 OpenCV 的seamlessclone函数的，比 OpenCV 快很多，但是对于融合的边缘有色差的情况容易出现边缘线，效果不如 OpenCV，使用者需要自行考虑是否使用。
优化点：` proc.reset(src, mask, tgt, (0, 0), (0, 0))`内部有很多图像的转换用的是 numpy 计算可以进行优化