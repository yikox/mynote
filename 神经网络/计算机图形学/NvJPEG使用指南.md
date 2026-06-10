---
title: NvJEPG使用指南
date: 2023-08-25T10:03:51+08:00
tags: [python] 
categories: 三方库介绍
mathjax: true
---
> NvJPEG 库使用方便,功能简单,使用 GPU 加速 JPEG 图片的编解码,自测在GPU V100  CPU 8 核(型号未知) 的服务器上使用 NvJPEG 进行解码能比使用 OpenCV 进行解码快一倍
<!--more-->

## 介绍
NvJPEG 库使用方便,功能简单,使用 GPU 加速 JPEG 图片的编解码,自测在GPU V100  CPU 8 核(型号未知) 的服务器上使用 NvJPEG 进行解码能比使用 OpenCV 进行解码快一倍. 由于使用简单,替代方便,建议先测速

==注:使用 NvJPEG 解码与 cv2.imdecode的结果存在像素点上的偏差==

## 安装
```
pip install pynvjpeg -i https://pypi.tuna.tsinghua.edu.cn/simple
```

## 使用
```python
from nvjpeg import NvJpeg
nj = NvJpeg()
# 读取图片
img = nj.read("_JPEG_FILE_PATH_")
# 写图片
nj.write("_JPEG_FILE_PATH_", img)

#读文件给 nvjpeg 进行解码
input_image_file = "1.jpg"
with open(input_image_file, 'rb') as f:
	jpeg_bytes = f.read()
# 解码
img = nj.decode(jpeg_bytes)

# 编码
encode_img = nj.encode(img)
# encode_img = nj.encode(img, 70)

with open("out.jpg", 'wb') as f:
	f.write(encode_img)
```


## 拓展
NvJPEG 只能编解码 JPEG 图片，因此在进行解码时如果不能保证图像数据是 JPEG 格式会触发报错，推荐搭配imghdr库一起使用。
```python
import imghdr
from nvjpeg import NvJpeg
nj = NvJpeg()
# img_data 为图像数据
img_format = imghdr.what(None, img_data)
if img_format is 'jpeg':
	img = nj.decode(img_data)
else:
	img = cv2.imdecode(img_data,-1)
```