#glcs #bug排查

> 结论：如果 compute shader 去写了 SSBOs,images,atomics,shared memory需要由开发者自己进行同步

## 现象
某个模型在使用 glcs 计算时发现在天玑 9000 的手机上结果错误（其他厂商的 soc 结果正常），经过排查发现，天玑系列的大部分芯片都存在这个问题。但是当我对每个算子执行完之后运行 glFinish进行同步时发现结果居然正确了，因此开始探究是什么东西导致了这一现象。
## 排查
我对模型进行了拆解寻找最小可复现的结构，最终得到这样一个结构

![GLCS Images Synchronizing.png](./imgs/GLCSImagesSynchronizing.png)

因为 LeakyRelu 会被优化到卷积当中去，所以这个结构其实就是两个卷积（下面称之为卷积 1 和卷积 2），当两个卷积之间不使用 glFinish 同步就会导致结果错误时，首先猜测的就是当卷积 1 没有执行完的时候，卷积 2 就触发了执行。那么我们就要如何进行验证呢？
首先我们打印出这两个卷积所使用的全部 GL API ：
```C++
glUseProgram( 1 )
glUniform1i(2, 0)
glActiveTexture(GL_TEXTURE0 + 0)
glBindTexture(32879, 2)
glUniform1i(1, 1)
glActiveTexture(GL_TEXTURE0 + 1)
glBindTexture(32879, 4)
//......
glBindImageTexture(0, 5, 0, GL_TRUE, 0, GL_READ_WRITE, 34842)
glDispatchCompute(2, 6, 1)

glUseProgram( 5 )
glUniform1i(2, 0)
glActiveTexture(GL_TEXTURE0 + 0)
glBindTexture(32879, 3)
glUniform1i(1, 1)
glActiveTexture(GL_TEXTURE0 + 1)
glBindTexture(32879, 5)
//......
glBindImageTexture(0, 6, 0, GL_TRUE, 0, GL_READ_WRITE, 34842)
glDispatchCompute(1, 3, 1)
```
抛开无关紧要的参数，可以看到，两个卷积之间都使用了纹理 ID 为 5 的这张纹理（下面简称纹理 5），卷积 1 使用glBindImageTexture接口将纹理 5 绑定到 image对象，并赋予了GL_READ_WRITE权限，卷积 2 使用了glBindTexture接口将纹理 5 绑定到了卷积 2 的纹理对象`GL_TEXTURE0 + 1` 。
因为我们怀疑==首先猜测的就是当卷积 1 没有执行完的时候，卷积 2 就触发了执行==，那么就是卷积 1 还没写完纹理 5 的数据，卷积 2 就开始读纹理 5 的内容了，那么我们就需要去确保纹理 5 能被正常的顺序操作，即先被卷积 1 完全写入，再被卷积 2 读取，因此我们在两个卷积之间加入了一个`glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)`屏障来确保顺序的正常执行，结果也正如我们所设想的一样。
## 理论支撑
常规的理解上，由于卷积 1 和卷积 2 使用了同一张纹理，且卷积 1 是进行写纹理，那么卷积 1 和卷积 2 之间的同步应当由驱动进行处理（其他的厂商不用Barrier也是结果正确的），而不是由开发者手动进行处理。因此我向联发科的同学进行了询问并得到了以下回复：
在 [ARM Mali OpenGL es](https://arm-software.github.io/opengl-es-sdk-for-android/compute_intro.html#computeMemory)的文档中有关于compute pipeline的描述：

![GLCS Images Synchronizing-1.png](./imgs/GLCSImagesSynchronizing-1.png)

如果 compute shader 去写了 SSBOs,images,atomics,shared memory需要由开发者自己进行同步。