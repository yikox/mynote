
> Multi-Process Service 多进程服务
> 从官方文档翻译[地址](https://docs.nvidia.com/deploy/mps/index.html#topic_2)

The Multi-Process Service (MPS) is an alternative, binary-compatible implementation of the CUDA Application Programming Interface (API). The MPS runtime architecture is designed to transparently enable co-operative multi-process CUDA applications, typically MPI jobs, to utilize Hyper-Q capabilities on the latest NVIDIA (Kepler-based) Tesla and Quadro GPUs .  
多进程服务（MPS）是 CUDA 应用程序接口（API）的替代、二进制兼容实现。MPS 运行时架构旨在透明地使协同多进程 CUDA 应用程序，通常 MPI 作业，能够利用最新 NVIDIA（基于 Kepler 的）Tesla 和 Quadro GPU 上的 Hyper-Q 功能。

# 1. 引言

## 1.1. 一目了然

### 1.1.1. MPS

The Multi-Process Service (MPS) is an alternative, binary-compatible implementation of the CUDA Application Programming Interface (API). The MPS runtime architecture is designed to transparently enable cooperative multi-process CUDA applications, typically MPI jobs, to utilize Hyper-Q capabilities on the latest NVIDIA (Kepler and later) GPUs. Hyper-Q allows CUDA kernels to be processed concurrently on the same GPU; this can benefit performance when the GPU compute capacity is underutilized by a single application process.  
多进程服务（MPS）是 CUDA 应用编程接口（API）的替代、二进制兼容实现。MPS 运行时架构旨在透明地启用使用 MPI 作业的协同多进程 CUDA 应用程序，利用最新 NVIDIA（Kepler 及之后）GPU 上的 Hyper-Q 功能。Hyper-Q 允许 CUDA 内核在相同的 GPU 上并行处理；当 GPU 的计算能力被单个应用程序进程未充分利用时，这可以提高性能。

### 1.1.2. Volta MPS

The Volta architecture introduced new MPS capabilities. Compared to MPS on pre-Volta GPUs, Volta MPS provides a few key improvements:  
Volta 架构引入了新的 MPS 能力。与预 Volta GPU 上的 MPS 相比，Volta MPS 提供了一些关键改进：
- Volta MPS clients submit work directly to the GPU without passing through the MPS server.  
    Volta MPS 客户直接将工作提交给 GPU，无需通过 MPS 服务器。
- Each Volta MPS client owns its own GPU address space instead of sharing GPU address space with all other MPS clients.  
    每个 Volta MPS 客户端拥有自己的 GPU 地址空间，而不是与所有其他 MPS 客户端共享 GPU 地址空间。
- Volta MPS supports limited execution resource provisioning for Quality of Service (QoS).  
    Volta MPS 支持有限的执行资源分配以提供服务质量（QoS）。
This document will introduce the new capabilities and note the differences between Volta MPS and MPS on pre-Volta GPUs. Running MPS on Volta will automatically enable the new capabilities.  
这份文档将介绍新功能，并指出 Volta MPS 与 Volta 之前的 GPU 上的 MPS 之间的差异。在 Volta 上运行 MPS 将自动启用新功能。
![mps-1](https://yikox.github.io/imgs/mps-1.png)

###  1.1.3. 目标受众
This document is a comprehensive guide to MPS capabilities and usage. It is intended to be read by application developers and users who will be running GPU calculations and intend to achieve the greatest level of execution performance. It is also intended to be read by system administrators who will be enabling the MPS capability in a user-friendly way, typically on multi-node clusters.  
此文档是关于 MPS 功能和使用的全面指南。旨在供应用程序开发者和计划运行 GPU 计算并追求最高执行性能的用户阅读。同时，也供系统管理员阅读，他们将以用户友好的方式启用 MPS 功能，通常在多节点集群上进行。

### 1.1.4. 本文件的组织结构

The order of the presentation is as follows:  
演示的顺序如下：
- Introduction and Concepts – describes why MPS is needed and how it enables Hyper-Q for multi-process applications.  
    介绍与概念 - 描述为什么需要 MPS 以及它是如何为多进程应用启用 Hyper-Q 的。
- When to Use MPS – describes what factors to consider when choosing to run an application with or choosing to deploy MPS for your users.  
    何时使用 MPS - 描述在选择运行应用程序或为用户部署 MPS 时需要考虑的因素。
- Architecture – describes the client-server architecture of MPS in detail and how it multiplexes clients onto the GPU.  
    架构 - 详细描述了 MPS 的客户端-服务器架构以及它如何将客户端多路复用到 GPU。
- Appendices – Reference information for the tools and interfaces used by the MPS system and guidance for common use-cases.  
    附录 – MPS 系统使用的工具和界面的参考信息以及常见用例的指导。
    
## 1.2. 先决条件 

Portions of this document assume that you are already familiar with:  
本文件的部分内容假定您已经熟悉：
- the structure of CUDA applications and how they utilize the GPU via the CUDA Runtime and CUDA Driver software libraries.  
    CUDA 应用程序的结构以及它们如何通过 CUDA 运行时和 CUDA 驱动软件库利用 GPU。
- concepts of modern operating systems, such as how processes and threads are scheduled and how inter-process communication typically works  
    现代操作系统的基本概念，包括进程和线程的调度方式以及进程间通信通常如何工作
- the Linux command-line shell environment  
    Linux 命令行shell环境
- configuring and running MPI programs via a command-line interface  
    通过命令行界面配置和运行 MPI 程序

## 1.3. 概念
### 1.3.1. 为什么需要 MPS
To balance workloads between CPU and GPU tasks, MPI processes are often allocated individual CPU cores in a multi-core CPU machine to provide CPU-core parallelization of potential Amdahl bottlenecks. As a result, the amount of work each individual MPI process is assigned may underutilize the GPU when the MPI process is accelerated using CUDA kernels. While each MPI process may end up running faster, the GPU is being used inefficiently. The Multi-Process Service takes advantage of the inter-MPI rank parallelism, increasing the overall GPU utilization.  
为了在 CPU 和 GPU 任务之间平衡工作负载，MPI 进程通常在多核 CPU 机器上分配单独的 CPU 内核，以提供 CPU 核心并行化潜在的 Amdahl 瓶颈。因此，每个单独的 MPI 进程分配的工作量可能在使用 CUDA 内核加速 MPI 进程时，导致 GPU 的利用率不足。尽管每个 MPI 进程最终可能运行得更快，但 GPU 的使用效率较低。多进程服务利用了 MPI 进程之间的并行性，从而提高了整体 GPU 利用率。
### 1.3.2. 什么是 MPS

MPS is a binary-compatible client-server runtime implementation of the CUDA API which consists of several components:  
MPS 是 CUDA API 的二进制兼容客户端-服务器运行时实现，包含多个组件：
- Control Daemon Process – The control daemon is responsible for starting and stopping the server, as well as coordinating connections between clients and servers.  
    控制守护进程 - 控制守护进程负责启动和停止服务器，以及协调客户端与服务器之间的连接。
- Client Runtime – The MPS client runtime is built into the CUDA Driver library and may be used transparently by any CUDA application.  
    客户端运行时 - MPS 客户端运行时内置在 CUDA 驱动库中，任何 CUDA 应用程序都可以透明地使用。
- Server Process – The server is the clients’ shared connection to the GPU and provides concurrency between clients.  
    服务器进程 - 服务器是客户端对 GPU 的共享连接，并在客户端之间提供并发性。
    
## 1.4. 参见 (see also)
- Manpage for `nvidia-cuda-mps-control (1)`  `nvidia-cuda-mps-control (1)` 的 manpage
- Manpage for `nvidia-smi (1)`  `nvidia-smi (1)` 的 manpage
    

# 2. 使用 MPS 的时机

## 2.1. MPS 的好处

### 2.1.1. GPU 使用率

A single process may not utilize all the compute and memory-bandwidth capacity available on the GPU. MPS allows kernel and memcopy operations from different processes to overlap on the GPU, achieving higher utilization and shorter running times.  
单个进程可能不会充分利用 GPU 上的所有计算和内存带宽容量。MPS 允许来自不同进程的内核和 memcopy 操作在 GPU 上重叠，实现更高的利用率和更短的运行时间。

### 2.1.2. 减少 GPU 上的上下文存储

Without MPS, each CUDA processes using a GPU allocates separate storage and scheduling resources on the GPU. In contrast, the MPS server allocates one copy of GPU storage and scheduling resources shared by all its clients. Volta MPS supports increased isolation between MPS clients, so the resource reduction is to a much lesser degree.  
没有 MPS，每个 CUDA 进程在 GPU 上分配单独的存储和调度资源。相比之下，MPS 服务器为所有客户端共享分配一个 GPU 存储和调度资源的副本。Volta MPS 支持 MPS 客户端之间的更高隔离度，因此资源减少的程度要小得多。

### 2.1.3. 减少 GPU 上下文切换

Without MPS, when processes share the GPU their scheduling resources must be swapped on and off the GPU. The MPS server shares one set of scheduling resources between all of its clients, eliminating the overhead of swapping when the GPU is scheduling between those clients.  
没有 MPS，当进程共享 GPU 时，它们的调度资源必须在 GPU 上开启和关闭。MPS 服务器在所有客户端之间共享一组调度资源，当 GPU 在这些客户端之间调度时，消除了切换的开销。

## 2.2. 确定候选应用

MPS is useful when each application process does not generate enough work to saturate the GPU. Multiple processes can be run per node using MPS to enable more concurrency. Applications like this are identified by having a small number of blocks-per-grid.  
MPS 在每个应用程序过程不足以使 GPU 饱和时很有用。使用 MPS 可以在每个节点上运行多个进程，以实现更高的并发性。这类应用程序通过具有较少的块-网格数量来识别。

Further, if the application shows a low GPU occupancy because of a small number of threads-per-grid, performance improvements may be achievable with MPS.Using fewer blocks-per-grid in the kernel invocation and more threads-per-block to increase the occupancy per block is recommended. MPS allows the leftover GPU capacity to be occupied with CUDA kernels running from other processes.  
进一步，如果应用程序由于线程网格数量较少而显示 GPU 占用率低，则使用 MPS 可能可以实现性能改进。建议在内核调用中使用较少的块-per-网格，并使用更多的线程-per-块来增加每个块的占用率。MPS 允许使用来自其他进程的 CUDA 内核运行占用剩余 GPU 容量。

These cases arise in strong-scaling situations, where the compute capacity (node, CPU core and/or GPU count) is increased while the problem size is held fixed. Though the total amount of computation work stays the same, the work per process decreases and may underutilize the available compute capacity while the application is running. With MPS, the GPU will allow kernel launches from different processes to run concurrently and remove an unnecessary point of serialization from the computation.  
这些情况发生在强扩展场景中，计算能力（节点、CPU 核心和/或 GPU 数量）增加，而问题大小保持不变。尽管总计算工作量保持不变，但每个进程的工作量减少，可能导致在应用程序运行时未充分利用可用的计算能力。通过 MPS，GPU 允许来自不同进程的内核启动并发运行，并从计算中移除一个不必要的序列化点。

## 2.3. 考虑因素

### 2.3.1. 系统考虑

#### 2.3.1.1. 限制
- MPS is only supported on the Linux operating system. The MPS server will fail to start when launched on an operating system other than Linux.  
    MPS 只支持在 Linux 操作系统上运行。在非 Linux 的操作系统上启动 MPS 服务器时，服务器将无法启动。
- Only Volta MPS is supported on Tegra platforms.  
    只有 Volta MPS 在 Tegra 平台上被支持。
- MPS requires a GPU with compute capability version 3.5 or higher. The MPS server will fail to start if one of the GPUs visible after applying `CUDA_VISIBLE_DEVICES` is not of compute capability 3.5 or higher.  
    MPS 要求使用计算能力版本 3.5 或更高的 GPU。如果应用 `CUDA_VISIBLE_DEVICES` 后可见的 GPU 中有任何一个的计算能力低于 3.5，MPS 服务器将无法启动。
- The Unified Virtual Addressing (UVA) feature of CUDA must be available, which is the default for any 64-bit CUDA program running on a GPU with compute capability version 2.0 or higher. If UVA is unavailable, the MPS server will fail to start.  
    CUDA 的统一虚拟地址（UVA）功能必须可用，这是任何在具有计算能力版本 2.0 或更高版本的 GPU 上运行的 64 位 CUDA 程序的默认设置。如果 UVA 不可用，MPS 服务器将无法启动。
- The amount of page-locked host memory that can be allocated by MPS clients is limited by the size of the tmpfs filesystem (/dev/shm).  
    MPS 客户端可以分配的页面锁定主机内存量受限于 tmpfs 文件系统（/dev/shm）的大小。
- Exclusive-mode restrictions are applied to the MPS server, not MPS clients. GPU compute modes are not supported on Tegra platforms.  
    专有模式限制应用于 MPS 服务器，而非 MPS 客户端。Tegra 平台不支持 GPU 计算模式。
- Only one user on a system may have an active MPS server.  
    系统中仅有一名用户可以拥有活跃的 MPS 服务器。
- The MPS control daemon will queue MPS server activation requests from separate users, leading to serialized exclusive access of the GPU between users regardless of GPU exclusivity settings.  
    MPS 控制守护进程将排队处理来自不同用户的 MPS 服务器激活请求，导致用户之间的 GPU 访问序列化和独占，无论 GPU 独占设置如何。
- All MPS client behavior will be attributed to the MPS server process by system monitoring and accounting tools (for example, nvidia-smi, NVML API).  
    所有 MPS 客户端行为都将通过系统监控和计费工具（例如，nvidia-smi，NVML API）归因于 MPS 服务器进程。
#### 2.3.1.2. GPU 计算模式

Three Compute Modes are supported via settings accessible in nvidia-smi:  
通过 nvidia-smi 可访问的设置支持三种计算模式：
- `PROHIBITED` – the GPU is not available for compute applications.  
    `PROHIBITED` – GPU 不适用于计算应用。
- `EXCLUSIVE_PROCESS` — the GPU is assigned to only one process at a time, and individual process threads may submit work to the GPU concurrently.  
    `EXCLUSIVE_PROCESS` — 一次只分配给一个进程 GPU，单个进程线程可以并发向 GPU 提交工作。
- `DEFAULT` – multiple processes can use the GPU simultaneously. Individual threads of each process may submit work to the GPU simultaneously.  
    `DEFAULT` – 多个进程可以同时使用 GPU。每个进程的个别线程可以同时向 GPU 提交工作。
Using MPS effectively causes `EXCLUSIVE_PROCESS` mode to behave like DEFAULT mode for all MPS clients. MPS will always allow multiple clients to use the GPU via the MPS server.  
有效使用 MPS 会导致 `EXCLUSIVE_PROCESS` 模式在所有 MPS 客户端中表现得如同 DEFAULT 模式。MPS 始终允许多个客户端通过 MPS 服务器使用 GPU。

When using MPS it is recommended to use `EXCLUSIVE_PROCESS` mode to ensure that only a single MPS server is using the GPU, which provides additional insurance that the MPS server is the single point of arbitration between all CUDA processes for that GPU.  
使用 MPS 时，建议使用 `EXCLUSIVE_PROCESS` 模式，以确保仅有一个 MPS 服务器使用 GPU，这提供了额外的保证，即 MPS 服务器是该 GPU 上所有 CUDA 进程之间的唯一仲裁点。

### 2.3.2. 应用考虑

- The NVIDIA Codec SDK: [https://developer.nvidia.com/nvidia-video-codec-sdk](https://developer.nvidia.com/nvidia-video-codec-sdk) is not supported under MPS on pre-Volta MPS clients.  
    NVIDIA 编码器 SDK：https://developer.nvidia.com/nvidia-video-codec-sdk 不在  pre-Volta MPS 客户端的 MPS 下支持。
- Only 64-bit applications are supported. The MPS server will fail to start if the CUDA application is not 64-bit. The MPS client will fail CUDA initialization.  
    仅支持 64 位应用程序。如果 CUDA 应用程序不是 64 位，MPS 服务器将无法启动。MPS 客户端将无法初始化 CUDA。
- If an application uses the CUDA driver API, then it must use headers from CUDA 4.0 or later (that is, it must not have been built by setting `CUDA_FORCE_API_VERSION` to an earlier version). Context creation in the client will fail if the context version is older than 4.0.  
    如果应用程序使用 CUDA 驱动程序 API，那么它必须使用 CUDA 4.0 或更高版本的头文件（即，它不能通过将 `CUDA_FORCE_API_VERSION` 设置为较早的版本来构建）。如果客户端创建的上下文版本较旧，则上下文创建将失败。
- Dynamic parallelism is not supported. CUDA module load will fail if the module uses dynamic parallelism features.  
    动态并行性不被支持。如果模块使用了动态并行性特性，CUDA 模块加载将会失败。
- MPS server only supports clients running with the same UID as the server. The client application will fail to initialize if the server is not running with the same UID. Volta MPS may be launched in `-multiuser-server` mode to allow clients under different UIDs to connect to a single MPS server launched under the root user while dropping isolation between users. Refer to [Server](https://docs.nvidia.com/deploy/mps/index.html#server) for details regarding `-multiuser-server` mode.  
    MPS 服务器仅支持与服务器具有相同 UID 的客户端。如果服务器未使用相同的 UID 运行，则客户端应用程序将无法初始化。Volta MPS 可以通过在 root 用户下启动 MPS 服务器并在 `-multiuser-server` 模式下运行来启动，允许具有不同 UID 的客户端连接到单个 MPS 服务器，同时在用户之间降低隔离。有关 `-multiuser-server` 模式的详细信息，请参阅服务器。
- Stream callbacks are not supported on pre-Volta MPS clients. Calling any stream callback APIs will return an error.  
    pre-Volta MPS 客户端不支持流回调。调用任何流回调 API 将返回错误。
- CUDA graphs with host nodes are not supported under MPS on pre-Volta MPS clients.  
    CUDA 图形与主机节点在 pre-Volta MPS 客户端上不支持在 MPS 下使用。
- The amount of page-locked host memory that pre-Volta MPS client applications can allocate is limited by the size of the tmpfs filesystem (`/dev/shm`). Attempting to allocate more page-locked memory than the allowed size using any of relevant CUDA APIs will fail.  
    pre-Volta MPS 客户端应用程序可以分配的页面锁定主机内存量受限于 tmpfs 文件系统的大小（ `/dev/shm` ）。使用任何相关的 CUDA API 尝试分配超过允许大小的页面锁定内存将失败。
- Terminating an MPS client without synchronizing with all outstanding GPU work (via Ctrl-C / program exception such as segfault / signals, etc.) can leave the MPS server and other MPS clients in an undefined state, which may result in hangs, unexpected failures, or corruptions.  
    中止 MPS 客户端而不与所有待处理 GPU 工作同步（通过 Ctrl-C/程序异常如段错误/信号等），可能会使 MPS 服务器和其他 MPS 客户端处于未定义状态，导致卡顿、意外失败或数据损坏。
- CUDA IPC between CUDA contexts which are created by processes running as MPS clients and CUDA contexts which are created by processes not running as MPS clients is supported under Volta MPS. CUDA IPC is not supported on Tegra platforms.  
    在 Volta MPS 下，支持 MPS 客户端运行的 CUDA 上下文与非 MPS 客户端运行的 CUDA 上下文之间的 CUDA IPC。在 Tegra 平台上不支持 CUDA IPC。
- Launching cooperative group kernel with MPS is not supported on Tegra platforms.  
    在 Tegra 平台上，使用 MPS 启动合作组内核不受支持。
    
### 2.3.3. 内存保护和错误包含

MPS is only recommended for running cooperative processes effectively acting as a single application, such as multiple ranks of the same MPI job, such that the severity of the following memory protection and error containment limitations is acceptable.  
MPS 只推荐用于运行协同进程，这些进程作为单个应用有效协作，例如同一 MPI 任务的多个实例，前提是后续的内存保护和错误控制限制是可以接受的。
#### 2.3.3.1. 内存保护

Volta MPS client processes have fully isolated GPU address spaces.  
Volta MPS 客户端处理具有完全隔离的 GPU 地址空间。
Pre-Volta MPS client processes allocate memory from different partitions of the same GPU virtual address space. As a result:  
Pre-Volta MPS 客户端进程从同一 GPU 虚拟地址空间的不同分区中分配内存。因此：
- An out-of-range write in a CUDA Kernel can modify the CUDA-accessible memory state of another process and will not trigger an error.  
    CUDA 内核中的越界写操作可以修改另一个进程的 CUDA 可访问内存状态，并且不会触发错误。
- An out-of-range read in a CUDA Kernel can access CUDA-accessible memory modified by another process, and will not trigger an error, leading to undefined behavior.  
    CUDA 内核中的越界读取可以访问由另一个进程修改的 CUDA 可访问内存，并且不会触发错误，导致未定义行为。
This pre-Volta MPS behavior is constrained to memory accesses from pointers within CUDA Kernels. Any CUDA API restricts MPS clients from accessing any resources outside of that MPS Client’s memory partition. For example, it is not possible to overwrite another MPS client’s memory using the `cudaMemcpy()` API.  
pre-Volta MPS 行为仅限于 CUDA 内核中指针的内存访问。任何 CUDA API 都限制了 MPS 客户端只能访问该 MPS 客户端的内存分区内的资源。例如，使用 `cudaMemcpy()` API 无法覆盖另一个 MPS 客户端的内存。

#### 2.3.3.2. 错误包含

Volta MPS supports limited error containment:  
Volta MPS 支持有限的错误包含：
- A fatal GPU fault generated by a Volta MPS client process will be contained within the subset of GPUs shared between all clients with the fatal fault-causing GPU.  
    致命的 GPU 故障由 Volta MPS 客户端进程产生，将仅存在于所有客户端共享的 GPU 子集中，这些 GPU 具有导致致命故障的 GPU。
- A fatal GPU fault generated by a Volta MPS client process will be reported to all the clients running on the subset of GPUs in which the fatal fault is contained, without indicating which client generated the error. Note that it is the responsibility of the affected clients to exit after being informed of the fatal GPU fault.  
    在由 Volta MPS 客户端进程产生的致命 GPU 故障将被报告给在包含致命故障的 GPU 子集上运行的所有客户端，但不会指示是哪个客户端产生了错误。请注意，受影响的客户端有责任在得知致命 GPU 故障后退出。
- Clients running on other GPUs remain unaffected by the fatal fault and will run as normal till completion.  
    在其他 GPU 上运行的客户端不受致命故障影响，将继续正常运行直至完成。
- Once a fatal fault is observed, the MPS server will wait for all the clients associated with the affected GPUs to exit, prohibiting new client connecting to those GPUs from joining. The status of the MPS server changes from `ACTIVE` to `FAULT`. When all the existing clients associated with the affected GPUs have exited, the MPS server will recreate the GPU contexts on the affected GPUs and resume processing client requests to those GPUs. The MPS server status changes back to `ACTIVE`, indicating that it is able to process new clients.  
    一旦检测到致命错误，MPS 服务器将等待与受影响 GPU 关联的所有客户端退出，禁止新客户端连接到这些 GPU。MPS 服务器的状态从 `ACTIVE` 更改为 `FAULT` 。当与受影响 GPU 关联的所有现有客户端退出后，MPS 服务器将在受影响的 GPU 上重新创建 GPU 上下文，并恢复处理针对这些 GPU 的客户端请求。MPS 服务器状态恢复到 `ACTIVE` ，表示它可以处理新客户端。
For example, if your system has devices 0, 1, and 2, and if there are four clients client A, client B, client C, and client D connected to the MPS server: client A runs on device 0, client B runs on device 0 and 1, client C runs on device 1, client D runs on device 2. If client A triggers a fatal GPU fault:  
例如，如果你的系统有设备 0、1 和 2，如果有四个客户端 client A、client B、client C 和 client D 连接到 MPS 服务器：client A 运行在设备 0 上，client B 运行在设备 0 和 1 上，client C 运行在设备 1 上，client D 运行在设备 2 上。如果 client A 触发了致命的 GPU 错误：

Since device 0 and device 1 share a comment client, client B, the fatal GPU fault is contained within device 0 and 1.  
由于设备 0 和设备 1 共享一个评论客户端，客户端 B，致命的 GPU 故障存在于设备 0 和 1 中。

The fatal GPU fault will be reported to all the clients running on device 0 and 1, i.e., client A, client B, and client C.  
致命的 GPU 故障将被报告给设备 0 和 1 上运行的所有客户端，即客户端 A、客户端 B 和客户端 C。

Client D running on device 2 remain unaffected by the fatal fault and continue to run as normal.  
客户端 D 在设备 2 上运行，不受致命故障影响，继续正常运行。

The MPS server will wait for client A, client B, and client C to exit and reject any new client requests will be rejected with error `CUDA_ERROR_MPS_SERVER_NOT_READY` while the server status is `FAULT`. After client A, client B, and client C have exited, the server recreates the GPU contexts on device 0 and device 1 and then resumes accepting client requests on all devices. The server status becomes `ACTIVE` again.  
MPS 服务器将等待客户端 A、客户端 B 和客户端 C 退出，并拒绝任何新的客户端请求，当服务器状态为 `FAULT` 时，将使用错误 `CUDA_ERROR_MPS_SERVER_NOT_READY` 拒绝新请求。在客户端 A、客户端 B 和客户端 C 退出后，服务器在设备 0 和设备 1 上重建 GPU 上下文，然后在所有设备上恢复接受客户端请求。服务器状态再次变为 `ACTIVE` 。

Information about the fatal GPU fault containment will be logged, including:  
关于致命 GPU 故障的包含信息将被记录，包括：

If the fatal GPU fault is a fatal memory fault, the PID of the client which triggered the fatal GPU memory fault.  
如果致命的 GPU 故障是致命的内存故障，触发致命 GPU 内存故障的客户端的 PID。

The device IDs of the devices which are affected by this fatal GPU fault.  
受影响的设备的 GPU 致命故障的设备 ID。

The PIDs of the clients which are affected by this fatal GPU fault. The status of each affected client becomes `INACTIVE` and the status of the MPS server becomes `FAULT`.  
受影响的客户端的 PIDs。每个受影响的客户端的状态变为 `INACTIVE` ，MPS 服务器的状态变为 `FAULT` 。

The messages indicating the successful recreation of the affected devices after all the affected clients have exited.  
表示所有受影响的客户端退出后，成功恢复受影响设备的消息。

Pre-Volta MPS client processes share on-GPU scheduling and error reporting resources. As a result:  
预 Volta MPS 客户端进程共享 GPU 上的调度和错误报告资源。因此：

- A GPU fault generated by any client will be reported to all clients, without indicating which client generated the error.  
    任何客户端产生的 GPU 故障将被报告给所有客户端，不指明是哪个客户端产生的错误。
    
- A fatal GPU fault triggered by one client will terminate the MPS server and the GPU activity of all clients.  
    一个客户端引发的致命 GPU 故障将终止 MPS 服务器以及所有客户端的 GPU 活动。
    

CUDA API errors generated on the CPU in the CUDA Runtime or CUDA Driver are delivered only to the calling client.  
CUDA API 错误在 CUDA 运行时或 CUDA 驱动程序中在 CPU 上生成，仅传递给调用客户端。

### 2.3.4. MPS 在多 GPU 系统上

The MPS server supports using multiple GPUs. On systems with more than one GPU, you can use `CUDA_VISIBLE_DEVICES` to enumerate the GPUs you would like to use. Refer to [Environment Variables](https://docs.nvidia.com/deploy/mps/index.html#environment-variables) for more details.  
MPS 服务器支持使用多个 GPU。在具有多个 GPU 的系统上，您可以使用 `CUDA_VISIBLE_DEVICES` 来枚举要使用的 GPU。请参阅环境变量以获取更多详细信息。

On systems with a mix of Volta / pre-Volta GPUs, if the MPS server is set to enumerate any Volta GPU, it will discard all pre-Volta GPUs. In other words, the MPS server will either operate only on the Volta GPUs and expose Volta capabilities or operate only on pre-Volta GPUs.  
在混合使用 Volta /预 Volta GPU 的系统中，如果 MPS 服务器配置为枚举任何 Volta GPU，它将丢弃所有预 Volta GPU。换句话说，MPS 服务器要么仅在 Volta GPU 上运行并暴露 Volta 功能，要么仅在预 Volta GPU 上运行。

### 2.3.5. 性能

#### 2.3.5.1. 客户端-服务器连接限制
The pre-Volta MPS Server supports up to 16 client CUDA contexts per-device concurrently. Volta MPS server supports 48 client CUDA contexts per-device. These contexts may be distributed over multiple processes. If the connection limit is exceeded, the CUDA application will fail to create a CUDA Context and return an API error from `cuCtxCreate()` or the first CUDA Runtime API call that triggers context creation. Failed connection attempts will be logged by the MPS server.  
Pre-Volta MPS 服务器每设备同时支持最多 16 个客户端 CUDA 上下文。Volta MPS 服务器每设备支持 48 个客户端 CUDA 上下文。这些上下文可以在多个进程中分布。如果连接限制被超过，CUDA 应用将无法创建 CUDA 上下文，并从 `cuCtxCreate()` 或触发上下文创建的第一个 CUDA 运行时 API 调用返回 API 错误。失败的连接尝试将被 MPS 服务器记录。

#### 2.3.5.2. Volta MPS 执行资源分配

Volta MPS supports limited execution resource provisioning. The client contexts can be set to only use a portion of the available threads. The provisioning capability is commonly used to achieve two goals:  
Volta MPS 支持有限的执行资源分配。客户端上下文可以设置仅使用可用线程的一部分。此分配能力通常用于实现两个目标：
- Reduce client memory footprint: Since each MPS client process has fully isolated address space, each client context allocates independent context storage and scheduling resources. Those resources scale with the amount of threads available to the client. By default, each MPS client has all available threads useable. As MPS is usually used with multiple processes running simultaneously, making all threads accessible to every client is often unnecessary, and therefore wasteful to allocate full context storage. Reducing the number of threads available will effectively reduce the context storage allocation size.  
    减少客户端内存占用：由于每个 MPS 客户端进程具有完全隔离的地址空间，每个客户端上下文分配独立的上下文存储和调度资源。这些资源随客户端可用的线程数量而扩展。默认情况下，每个 MPS 客户端可以使用所有可用线程。由于 MPS 通常在多个并发进程运行时使用，使所有线程对每个客户端可用通常是不必要的，因此分配完整的上下文存储空间是浪费的。减少可用线程的数量将有效地减少上下文存储分配的大小。
- Improve QoS: The provisioning mechanism can be used as a classic QoS mechanism to limit available compute bandwidth. Reducing the portion of available threads will also concentrate the work submitted by a client to a set of SMs, reducing destructive interference with other clients’ submitted work.  
    提高 QoS：配置机制可以作为经典的 QoS 机制来限制可用计算带宽。减少可用线程的比例也将使客户端提交的工作集中在一组 SM 上，减少与其他客户端提交工作之间的破坏性干扰。
    
Setting the limit does not reserve dedicated resources for any MPS client context. It simply limits how much resources can be used by a client context. Kernels launched from different MPS client contexts may execute on the same SM, depending on load-balancing.  
设置限制并不为任何 MPS 客户端上下文预留专用资源。它只是限制客户端上下文可以使用的资源量。从不同 MPS 客户端上下文启动的内核可能在同一个 SM 上执行，这取决于负载均衡。

By default, each client is provisioned to have access to all available threads. This will allow the maximum degree of scheduling freedom, but at a cost of higher memory footprint due to wasted execution resource allocation. The memory usage of each client process can be queried through nvidia-smi.  
默认情况下，每个客户端被配置为可以访问所有可用的线程。这将允许最大程度的调度自由，但会因执行资源分配的浪费而导致更高的内存占用。可以通过 nvidia-smi 查询每个客户端进程的内存使用情况。

The provisioning limit can be set via a few different mechanisms for different effects. These mechanisms are categorized into two mechanisms: active thread percentage and programmatic interface. In particular, partitioning via active thread percentage are categorized into two strategies: uniform partitioning and non-uniform partitioning.  
配置限制可以通过几种不同的机制设置，以实现不同的效果。这些机制被分为两类：活跃线程百分比和程序化接口。特别是，通过活跃线程百分比进行的分区可以分为两种策略：均匀分区和非均匀分区。

The limit constrained by the uniform active thread percentage is configured for a client process when it starts and cannot be changed for the client process afterwards. The executed limit is reflected through device attribute `cudaDevAttrMultiProcessorCount` whose value remains unchanged throughout the client process.  
客户端进程启动时为其配置的由均匀活跃线程百分比限制的限制，在客户端进程之后无法更改。执行的限制通过设备属性 `cudaDevAttrMultiProcessorCount` 反映，其值在整个客户端进程中保持不变。
- The MPS control utility provides 2 sets of commands to set/query the limit of all future MPS clients. Refer to [nvidia-cuda-mps-control](https://docs.nvidia.com/deploy/mps/index.html#nvidia-cuda-mps-control) for more details.  
    MPS 控制工具提供两组命令来设置/查询所有未来 MPS 客户端的限制。请参阅 nvidia-cuda-mps-control 以获取更多详细信息。
- Alternatively, the limit for all future MPS clients can be set by setting the environment variable `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` for the MPS control process. Refer to [MPS Control Daemon Level](https://docs.nvidia.com/deploy/mps/index.html#mps-control-daemon-level) for more details.  
    或者，所有未来 MPS 客户端的限制可以通过为 MPS 控制进程设置环境变量 `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` 来设置。有关更多详细信息，请参阅 MPS 控制守护进程级别。
- The limit can be further constrained for new clients by solely setting the environment variable `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` for a client process. Refer to [Client Process Level](https://docs.nvidia.com/deploy/mps/index.html#client-process-level) for more details.  
    对于新客户，可以通过仅设置客户端进程的环境变量 `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` 来进一步限制此限制。请参阅客户端进程级别以获取更多详细信息。
    
The limit constrained by the non-uniform active thread percentage is configured for every client CUDA context and can be changed throughout the client process. The executed limit is reflected through device attribute `cudaDevAttrMultiProcessorCount` whose value returns the portion of available threads that can be used by the client CUDA context current to the calling thread.  
非均匀活跃线程百分比限制为每个客户端 CUDA 上下文配置，并在整个客户端进程期间可以更改。执行的限制通过设备属性 `cudaDevAttrMultiProcessorCount` 反映，其值返回可用于当前调用线程的客户端 CUDA 上下文的可用线程部分。
- The limit constrained by the uniform partitioning mechanisms can be further constrained for new client CUDA contexts by setting the environment variable `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` in conjunction with the environment variable `CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING`. Refer to [Client CUDA Context Level](https://docs.nvidia.com/deploy/mps/index.html#client-cuda-context-level) and [CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING](https://docs.nvidia.com/deploy/mps/index.html#cuda-mps-enable-per-ctx-device-multiprocessor-partitioning) for more details.  
    由均匀分区机制限制的限制可以通过设置环境变量 `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` 与环境变量 `CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING` 结合来进一步限制新的客户端 CUDA 上下文。参见客户端 CUDA 上下文级别和 CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING 以获取更多详细信息。

The limit constrained by the programmatic partitioning is configured for a client CUDA context created via `cuCtxCreate_v3()` with the execution affinity `CUexecAffinityParam` which specifies the number of SMs that the context is limited to use. The executed limit of the context can be queried through `cuCtxGetExecAffinity()`. Refer to [Best Practice for SM Partitioning](https://docs.nvidia.com/deploy/mps/index.html#best-practices-for-partitioning) for more details.  
程序分区限制为客户通过 `cuCtxCreate_v3()` 创建的 CUDA 上下文配置，该上下文使用执行亲和性 `CUexecAffinityParam` 指定上下文受限使用的 SM 数量。通过 `cuCtxGetExecAffinity()` 可以查询上下文执行的限制。有关更多详细信息，请参阅 SM 分区的最佳实践。

A common provisioning strategy is to uniformly partition the available threads equally to each MPS client processes (i.e., set active thread percentage to 100% / n, for n expected MPS client processes). This strategy will allocate close to the minimum amount of execution resources, but it could restrict performance for clients that could occasionally make use of idle resources.  
常见的配置策略是将可用线程均匀分配给每个 MPS 客户端进程（即，将活动线程百分比设置为 100%/n，n 为预期的 MPS 客户端进程数）。这种策略将分配接近最小的执行资源，但可能会限制偶尔可以利用空闲资源的客户端的性能。

A more optimal strategy is to uniformly partition the portion by half of the number of expected clients (i.e., set active thread percentage to 100% / 0.5n) to give the load balancer more freedom to overlap execution between clients when there are idle resources.  
更优的策略是将部分均匀分割为预期客户数量的一半（即，将活跃线程百分比设置为 100% / 0.5n），这样负载均衡器在有空闲资源时可以有更多自由度，让不同客户之间的执行重叠。

The near optimal provision strategy is to non-uniformly partition the available threads based on the workloads of each MPS clients (i.e., set active thread percentage to 30% for client 1 and set active thread percentage to 70 % client 2 if the ratio of the client1 workload and the client2 workload is 30%: 70%). This strategy will concentrate the work submitted by different clients to disjoint sets of the SMs and effectively minimize the interference between work submissions by different clients.  
近最优提供策略是根据每个 MPS 客户端的工作负载非均匀地划分可用线程（例如，为客户端 1 设置活动线程百分比为 30%，为客户端 2 设置活动线程百分比为 70%，如果客户端 1 的工作负载与客户端 2 的工作负载比例为 30%：70%）。这种策略将集中不同客户端提交的工作到 SM 的不同集合中，并有效地最小化不同客户端提交工作之间的干扰。

The most optimal provision strategy is to precisely limit the number of SMs to use for each MPS clients knowing the execution resource requirements of each client (i.e., 24 SMs for client1 and 60 SMs for client 2 on a device with 84 SMs). This strategy provides finer grained and more flexible control over the set of SMs the work will be running on than the active thread percentage.  
最优的供应策略是精确限制每个 MPS 客户端使用的 SM 数量，知道每个客户端的执行资源需求（例如，客户端 1 使用 24 个 SM，客户端 2 使用 60 个 SM，在一个拥有 84 个 SM 的设备上）。这种策略提供了对将要运行工作的 SM 集合进行更精细和更灵活的控制，比活跃线程百分比提供了更多的控制。

If the active thread percentage is used for partitioning, the limit will be internally rounded down to the nearest hardware supported thread count limit. If the programmatic interface is used for partitioning, the limit will be internally rounded up to the nearest hardware supported SM count limit.  
如果使用活跃线程百分比进行分区，限制将被内部向下舍入到最接近的硬件支持的线程计数限制。如果使用程序化接口进行分区，限制将被内部向上舍入到最接近的硬件支持的 SM 计数限制。

#### 2.3.5.3. 线程与 Linux 调度

On pre-Volta GPUs, launching more MPS clients than there are available logical cores on your machine will incur increased launch latency and will generally slow down client-server communication due to how the threads get scheduled by the Linux CFS (Completely Fair Scheduler). For setups where multiple GPUs are used with an MPS control daemon and server started per GPU, we recommend pinning each MPS server to a distinct core. This can be accomplished by using the utility `taskset`, which allows binding a running program to multiple cores or launching a new one on them. To accomplish this with MPS, launch the control daemon bound to a specific core, for example, `taskset -c 0 nvidia-cuda-mps-control -d`. The process affinity will be inherited by the MPS server when it starts up.  
在 Pre-Volta GPU 上，如果启动的 MPS 客户端数量超过机器上可用的逻辑内核数量，将会导致启动延迟增加，并且由于 Linux CFS（完全公平调度器）如何调度线程，客户端与服务器的通信通常会变慢。对于使用多个 GPU 并为每个 GPU 启动 MPS 控制守护进程和服务器的设置，我们建议将每个 MPS 服务器绑定到一个独特的内核。可以通过使用允许将运行程序绑定到多个内核或在它们上启动新程序的工具 `taskset` 来实现这一点。对于 MPS，启动绑定到特定内核的控制守护进程，例如 `taskset -c 0 nvidia-cuda-mps-control -d` 。MPS 服务器启动时将继承进程亲和性。

#### 2.3.5.4. Volta MPS 设备内存限制

On Volta MPS, users can enforce clients to adhere to allocate device memory up to a preset limit. This mechanism provides a facility to fractionalize GPU memory across MPS clients that run on the specific GPU, which enables scheduling and deployment systems to make decisions based on the memory usage for the clients. If a client attempts to allocate memory beyond the preset limit, the cuda memory allocation calls will return out of memory error. The memory limit specific will also account for CUDA internal device allocations which will help users make scheduling decisions for optimal GPU utilization. This can be accomplished through a hierarchy of control mechanisms for users to limit the pinned device memory on MPS clients. The `default` limit setting would enforce a device memory limit on all the MPS clients of all future MPS Servers spawned. The `per server` limit setting allows finer grained control on the memory resource limit whereby users have the option to set memory limit selectively using the server PID and thus all clients of the server. Additionally, MPS clients can further constrain the memory limit setting from the server by using the `CUDA_MPS_PINNED_DEVICE_MEM_LIMIT` environment variable.  
在 Volta MPS 中，用户可以强制客户端将设备内存分配限制在预设的上限。此机制提供了在特定 GPU 上运行的 MPS 客户端之间分割 GPU 内存的便利，这使得调度和部署系统可以根据客户端的内存使用情况做出决策。如果客户端尝试分配超出预设限制的内存，cuda 内存分配调用将返回内存不足错误。预设的内存限制还将考虑 CUDA 内部设备分配，这将帮助用户根据客户端的内存使用情况做出最佳 GPU 利用的调度决策。这可以通过用户对 MPS 客户端的 Pinned 设备内存设置层次控制机制来实现。 `default` 限制设置将强制所有未来 MPS 服务器启动的所有 MPS 客户端的设备内存限制。 `per server` 限制设置允许对内存资源限制进行更精细的控制，用户可以选择使用服务器 PID 来设置内存限制，从而对服务器的所有客户端进行限制。此外，MPS 客户端还可以通过使用 `CUDA_MPS_PINNED_DEVICE_MEM_LIMIT` 环境变量进一步限制内存限制设置。

### 2.3.6. 工具的交互

#### 2.3.6.1. 调试和 CUDA-GDB

On Volta MPS, GPU coredumps can be generated and debugged using CUDA-GDB. Refer to CUDA-GDB documentation <https://docs.nvidia.com/cuda/cuda-gdb/index.html>`__ for usage instructions.  
在 Volta MPS 上，可以使用 CUDA-GDB 生成并调试 GPU 内核崩溃。参阅 CUDA-GDB 文档获取使用说明。

Under certain conditions applications invoked from within CUDA-GDB (or any CUDA-compatible debugger, such as Allinea DDT) may be automatically run without using MPS, even when MPS automatic provisioning is active. To take advantage of this automatic fallback, no other MPS client applications may be running at the time. This enables debugging of CUDA applications without modifying the MPS configuration for the system.  
在某些条件下，从 CUDA-GDB（或任何 CUDA 兼容的调试器，如 Allinea DDT）内部调用的应用程序可能在 MPS 自动配置启用时，即使 MPS 自动配置处于活动状态，也可能自动运行而无需使用 MPS。为了利用这种自动回退，此时系统上不得有其他 MPS 客户端应用程序运行。这使得可以在不修改系统 MPS 配置的情况下调试 CUDA 应用程序。

Here’s how it works:  
这就是工作原理：

1. CUDA-GDB attempts to run an application and recognizes that it will become an MPS client. 
    CUDA-GDB 尝试运行一个应用程序并认识到它将成为 MPS 客户端。
    
2. The application running under CUDA-GDB blocks in `cuInit()` and waits for all of the active MPS client processes to exit, if any are running.  
    在 CUDA-GDB 下运行的应用程序在 `cuInit()` 处被阻塞，并等待所有活跃的 MPS 客户端进程退出，如果它们正在运行。
    
3. Once all client processes have terminated, the MPS server will allow cuda-gdb and the application being debugged to continue.  
    一旦所有客户端进程终止后，MPS 服务器将允许 cuda-gdb 和正在调试的应用程序继续运行。
    
4. Any new client processes attempt to connect to the MPS daemon will be provisioned a server normally.  
    任何新客户尝试连接到 MPS 守护进程的流程都将正常提供服务器。
    

#### 2.3.6.2. memcheck

The `memcheck` tool is supported on MPS. Refer to the `memcheck` [documentation](https://docs.nvidia.com/compute-sanitizer/ComputeSanitizer/index.html#memcheck-tool) for usage instructions.  
`memcheck` 工具在 MPS 上受支持。参见 `memcheck` 文档以获取使用说明。

#### 2.3.6.3. 详细信息配置

CUDA profiling tools (such as nvprof and Nvidia Visual Profiler) and CUPTI-based profilers are supported under MPS.  
CUDA 性能分析工具（如 nvprof 和 Nvidia 可视化分析器）以及基于 CUPTI 的分析器在 MPS 下得到支持。

Note that Visual Profiler and nvprof will be deprecated in a future CUDA release. The NVIDIA Volta platform is the last architecture on which these tools are fully supported. It is recommended to use next-generation tools [NVIDIA Nsight Systems](https://developer.nvidia.com/nsight-systems) for GPU and CPU sampling and tracing and [NVIDIA Nsight Compute](https://developer.nvidia.com/nsight-compute) for GPU kernel profiling.  
请注意，未来 CUDA 版本中 Visual Profiler 和 nvprof 将被弃用。NVIDIA Volta 平台是这些工具完全支持的最后一个架构。建议使用下一代工具 NVIDIA Nsight Systems 进行 GPU 和 CPU 采样和跟踪，以及使用 NVIDIA Nsight Compute 进行 GPU 内核性能分析。

Refer to [Migrating to Nsight Tools from Visual Profiler and nvprof](https://docs.nvidia.com/cuda/profiler-users-guide/index.html#migrating-to-nsight-tools-from-visual-profiler-and-nvprof) for more details.  
参考从 Visual Profiler 和 nvprof 迁移到 Nsight Tools 的更多信息。

### 2.3.7. 客户端早期终止

Terminating a MPS client via CTRL-C or signals is not supported and will lead to undefined behavior. The user must guarantee that the MPS client is idle, by calling either `cudaDeviceSynchronize` or `cudaStreamSynchronize` on all streams, before the MPS client can be terminated. Early termination of a MPS client without synchronizing all outstanding GPU work may leave the MPS server in an undefined state and result in unexpected failures, corruptions, or hangs; as a result, the affected MPS server and all its clients must be restarted.  
通过 CTRL-C 或信号终止 MPS 客户端不受支持，会导致未定义的行为。用户必须确保 MPS 客户端处于空闲状态，通过在所有流上调用 `cudaDeviceSynchronize` 或 `cudaStreamSynchronize` 来实现，然后才能终止 MPS 客户端。在未同步所有未完成的 GPU 工作的情况下过早终止 MPS 客户端可能会使 MPS 服务器处于未定义状态，并导致意外失败、损坏或死锁；因此，受影响的 MPS 服务器及其所有客户端都必须重新启动。

On Volta MPS, user can instruct the MPS server to terminate the CUDA contexts of a MPS client process, regardless of whether the CUDA contexts are idle or not, by using the control command `terminate_client <server PID> <client PID>`. This mechanism enables user to terminate the CUDA contexts of a given MPS client process, even when the CUDA contexts are non-idle, without affecting the MPS server or its other MPS clients. The control command `terminate_client` sends a request to the MPS server which terminates the CUDA contexts of the target MPS client process on behalf of the user and returns after the MPS server has completed the request. The return value is `CUDA_SUCCESS` if the CUDA contexts of the target MPS client process have been successfully terminated; otherwise, a CUDA error describing the failure state. When the MPS server starts handling the request, each MPS client context running in the target MPS client process becomes `INACTIVE`; the status changes will be logged by the MPS server. Upon successful completion of the client termination, the target MPS client process will observe a sticky error `CUDA_ERROR_MPS_CLIENT_TERMINATED`, and it becomes safe to kill the target MPS client process with signals such as SIGKILL without affecting the rest of the MPS server and its MPS clients. Note that the MPS server is not responsible for killing the target MPS client process after the sticky error is set because the target MPS client process might want to:  
在 Volta MPS 中，用户可以通过使用控制命令 `terminate_client <server PID> <client PID>` 来指示 MPS 服务器终止 MPS 客户端进程的 CUDA 上下文，无论这些 CUDA 上下文是否处于空闲状态。这一机制允许用户在不干扰 MPS 服务器或其其他 MPS 客户端的情况下终止给定 MPS 客户端进程的 CUDA 上下文。控制命令 `terminate_client` 向 MPS 服务器发送请求，服务器代表用户终止目标 MPS 客户端进程的 CUDA 上下文，并在请求完成后返回。返回值为 `CUDA_SUCCESS` ，表示成功终止了目标 MPS 客户端进程的 CUDA 上下文；否则，返回一个描述失败状态的 CUDA 错误。当 MPS 服务器开始处理请求时，目标 MPS 客户端进程中的每个运行中的 MPS 客户端上下文都会变为 `INACTIVE` ；状态的变化将由 MPS 服务器记录。 在客户端终止成功后，目标 MPS 客户端进程会观察到粘性错误 `CUDA_ERROR_MPS_CLIENT_TERMINATED` ，使用 SIGKILL 等信号安全地杀死目标 MPS 客户端进程不会影响 MPS 服务器及其 MPS 客户端。请注意，MPS 服务器在设置粘性错误后不对目标 MPS 客户端进程进行终止负责，因为目标 MPS 客户端进程可能希望：

- Perform clean-up of its GPU or CPU state. This may include a device reset. Continue remaining CPU work.  
    清理其 GPU 或 CPU 状态。这可能包括设备重置。继续剩余的 CPU 工作。
    
- Continue remaining CPU work.  
    继续剩余的 CPU 工作。
    

If the user wants to terminate the GPU work of a MPS client process that is running inside a PID namespace different from the MPS control’s PID namespace, such as a MPS client process inside a container, the user must use the PID of the target MPS client process translated into the MPS control’s PID namespace. For example, the PID of a MPS client process inside the container is 6, and the PID of this MPS client process in the host PID namespace is 1024; the user must use 1024 to terminate the GPU work of the target MPS client process.  
如果用户希望终止在 PID 命名空间与 MPS 控制的 PID 命名空间不同的环境中运行的 MPS 客户端进程的 GPU 工作，例如在容器中的 MPS 客户端进程，用户必须使用目标 MPS 客户端进程在 MPS 控制的 PID 命名空间中的 PID 来终止 GPU 工作。例如，容器中的 MPS 客户端进程的 PID 为 6，该 MPS 客户端进程在主机 PID 命名空间中的 PID 为 1024；用户必须使用 1024 来终止目标 MPS 客户端进程的 GPU 工作。

The common workflow for terminating the client application `nbody`:  
终止客户端应用的常见工作流程 `nbody` ：

Use the control command `ps` to get the status of the current active MPS clients  
使用控制命令 `ps` 获取当前活跃 MPS 客户端的状态
```shell
$ echo "ps" | nvidia-cuda-mps-control

PID ID SERVER DEVICE NAMESPACE COMMAND

9741 0 6472 GPU-cb1213a3-d6a4-be7f 4026531836 ./nbody

9743 0 6472 GPU-cb1213a3-d6a4-be7f 4026531836 ./matrixMul
```

Terminate using the PID of `nbody` in the host PID namespace as reported by `ps`:  
使用主机 PID 命名空间中由 `ps` 报告的 PID `nbody` 终止：
```shell
$ echo "terminate_client 6472 9741" | nvidia-cuda-mps-control

#wait until terminate_client to return

#upon successful termination 0 is returned

0
```


Now it is safe to kill `nbody`:  
现在可以安全地杀死 `nbody` :
```shell
$ kill -9 9741
```


MPS client termination is not supported on Tegra platforms.  
MPS 客户端终止不支持在 Tegra 平台上进行。

### 2.3.8. 客户优先级控制

Users are normally only able to control the GPU priority level of their kernels by using the `cudaStreamCreateWithPriority()` API while the program is being written. On Volta MPS, the user can use the control command `set_default_client_priority <Priority Level>` to map the stream priorities of a given client to a different range of internal CUDA priorities. Changes to this setting do not take effect until the next client connection to the server is opened. The user can also set the `CUDA_MPS_CLIENT_PRIORITY` environment variable before starting the control daemon or any given client process to set this value.  
用户通常只能在编写程序时通过使用 `cudaStreamCreateWithPriority()` API 来控制其内核的 GPU 优先级级别。在 Volta MPS 上，用户可以使用控制命令 `set_default_client_priority <Priority Level>` 将给定客户端的流优先级映射到内部 CUDA 优先级的不同范围内。对这个设置的更改直到下一次客户端连接到服务器时才会生效。用户还可以在启动控制守护进程或任何给定客户端进程之前设置 `CUDA_MPS_CLIENT_PRIORITY` 环境变量来设置此值。

In this release, the allowed priority level values are `0` (normal) and `1` (below normal). Lower numbers map to higher priorities to match the behavior of the Linux kernel scheduler.  
在此次发布中，允许的优先级值为 `0` （正常）和 `1` （低于正常）。较低的数字映射到较高的优先级，以匹配 Linux 内核调度器的行为。

> Note 注意
CUDA priority levels are not guarantees of execution order–they are only a performance hint to the CUDA Driver.  
CUDA 优先级级别不是执行顺序的保证，它们只是 CUDA 驱动程序的性能提示。

For example: 例如：
- Process A is launched at Normal priority and only uses the default CUDA Stream, which has the lowest priority of 0.  
    进程 A 以正常优先级启动，仅使用默认 CUDA 流，该流的优先级最低为 0。
- Process B is launched at Below Normal priority and uses streams with custom Stream priority values, such as -3.  
    过程 B 以较低优先级启动，并使用具有自定义流优先级值的流，例如 -3。
    
Without this feature, the streams from Process B would be executed first by the CUDA Driver. However, with the Client Priority Level feature, the streams from Process A will take precedence. 
没有这个功能，Process B 的流将首先由 CUDA 驱动程序执行。然而，有了客户端优先级级别功能，Process A 的流将优先执行。

# 3. 架构

## 3.1. 背景

CUDA is a general purpose parallel computing platform and programming model that leverages the parallel compute engine in NVIDIA GPUs to solve many complex computational problems in a more efficient way than on a CPU.  
CUDA 是一个通用的并行计算平台和编程模型，利用 NVIDIA GPU 中的并行计算引擎，以比 CPU 更高效的方式解决许多复杂计算问题。

A CUDA program starts by creating a CUDA context, either explicitly using the driver API or implicitly using the runtime API, for a specific GPU. The context encapsulates all the hardware resources necessary for the program to be able to manage memory and launch work on that GPU.  
CUDA 程序从创建 CUDA 上下文开始，使用驱动程序 API 显式地或使用运行时 API 隐式地为特定的 GPU 创建上下文。上下文封装了程序能够管理内存和在该 GPU 上启动工作的所有硬件资源。

Launching work on the GPU typically involves copying data over to previously allocated regions in GPU memory, running a CUDA kernel that operates on that data, and then copying the results back from GPU memory into system memory. A CUDA kernel consists of a hierarchy of thread groups that execute in parallel on the GPUs compute engine.  
启动 GPU 工作通常涉及将数据复制到 GPU 内存中预先分配的区域，运行 CUDA 内核对这些数据进行操作，然后将结果从 GPU 内存复制回系统内存。CUDA 内核由在 GPU 计算引擎上并行执行的线程组层次结构组成。

All work on the GPU launched using CUDA is launched either explicitly into a CUDA stream, or implicitly using a default stream. A stream is a software abstraction that represents a sequence of commands, which may be a mix of kernels, copies, and other commands, that execute in order. Work launched in two different streams can execute simultaneously, allowing for coarse grained parallelism.  
使用 CUDA 启动的所有 GPU 工作都明确地启动到 CUDA 流中，或者使用默认流隐式启动。流是软件抽象，代表一系列命令的序列，这些命令可能是内核、复制和其他命令的混合，按照顺序执行。在两个不同的流中启动的工作可以同时执行，允许粗粒度并行。

CUDA streams are aliased onto one or more ‘work queues’ on the GPU by the driver. Work queues are hardware resources that represent an in-order sequence of the subset of commands in a stream to be executed by a specific engine on the GPU, such as the kernel executions or memory copies. GPUs with Hyper-Q have a concurrent scheduler to schedule work from work queues belonging to a single CUDA context. Work launched to the compute engine from work queues belonging to the same CUDA context can execute concurrently on the GPU.  
CUDA 流由驱动程序在 GPU 上以一个或多个“工作队列”进行分发。工作队列是硬件资源，代表了流中要由 GPU 上的特定引擎（如内核执行或内存复制）执行的命令子集的有序序列。具有 Hyper-Q 的 GPU 具有并发调度器来调度属于单个 CUDA 上下文的工作队列中的工作。来自同一 CUDA 上下文的工作队列在 GPU 上可以并发执行到计算引擎的工作。

The GPU also has a time sliced scheduler to schedule work from work queues belonging to different CUDA contexts. Work launched to the compute engine from work queues belonging to different CUDA contexts cannot execute concurrently. This can cause underutilization of the GPU’s compute resources if work launched from a single CUDA context is not sufficient to use up all resource available to it.  
GPU 也具有时间切片调度器，用于调度来自不同 CUDA 上下文的工作队列的工作。来自不同 CUDA 上下文的工作队列向计算引擎发起的工作无法并行执行。如果来自单个 CUDA 上下文发起的工作不足以充分利用其可利用的计算资源，这可能导致 GPU 计算资源的利用率不足。

Additionally, within the software layer, to receive asynchronous notifications from the OS and perform asynchronous CPU work on behalf of the application the CUDA Driver may create internal threads: an upcall handler thread and potentially a user callback executor thread.  
此外，在软件层中，为了从操作系统接收异步通知并代表应用程序执行异步 CPU 工作，CUDA 驱动器可能会创建内部线程：一个回调处理器线程，以及可能的用户回调执行线程。

## 3.2. 客户端-服务器架构
![mps-2](https://yikox.github.io/imgs/mps-2.png)

This diagram shows a likely schedule of CUDA kernels when running an MPI application consisting of multiple OS processes without MPS. Note that while the CUDA kernels from within each MPI process may be scheduled concurrently, each MPI process is assigned a serially scheduled time-slice on the whole GPU.  
此图显示了在运行包含多个 OS 进程的 MPI 应用时，CUDA 内核可能的运行时间表，不包含 MPS。请注意，尽管每个 MPI 进程内的 CUDA 内核可能同时调度，但整个 GPU 上为每个 MPI 进程分配了按顺序调度的时间片。
![mps-3](https://yikox.github.io/imgs/mps-3.png)

When using pre-Volta MPS, the server manages the hardware resources associated with a single CUDA context. The CUDA contexts belonging to MPS clients funnel their work through the MPS server. This allows the client CUDA contexts to bypass the hardware limitations associated with time sliced scheduling, and permit their CUDA kernels execute simultaneously.  
使用预 Volta MPS 时，服务器管理与单个 CUDA 上下文关联的硬件资源。MPS 客户端的 CUDA 上下文通过 MPS 服务器分发其工作。这使得客户端 CUDA 上下文可以绕过与时间切片调度相关的时间限制，允许其 CUDA 内核同时执行。

Volta provides new hardware capabilities to reduce the types of hardware resources the MPS server must managed. A client CUDA context manages most of the hardware resources on Volta, and submits work to the hardware directly. The Volta MPS server mediates the remaining shared resources required to ensure simultaneous scheduling of work submitted by individual clients, and stays out of the critical execution path.  
Volta 提供新的硬件能力，以减少 MPS 服务器必须管理的硬件资源类型。客户端 CUDA 上下文管理 Volta 上的大部分硬件资源，并直接将工作提交给硬件。Volta MPS 服务器调解剩余的共享资源，以确保提交给单个客户端的工作可以同时调度，同时保持在关键执行路径之外。

The communication between the MPS client and the MPS server is entirely encapsulated within the CUDA driver behind the CUDA API. As a result, MPS is transparent to the MPI program.  
MPS 客户端与 MPS 服务器之间的通信完全封装在 CUDA API 背后的 CUDA 驱动程序中。因此，MPS 对 MPI 程序是透明的。

MPS clients CUDA contexts retain their upcall handler thread and any asynchronous executor threads. The MPS server creates an additional upcall handler thread and creates a worker thread for each client.  
MPS 客户端 CUDA 上下文保留其回调处理器线程和任何异步执行线程。MPS 服务器为每个客户端创建一个额外的回调处理器线程，并为每个客户端创建一个工作线程。

## 3.3. 配置顺序

![mps-4](https://yikox.github.io/imgs/mps-4.png)

Figure 1 System-wide provisioning with multiple users.
图 1 全局配置与多个用户。

### 3.3.1. 服务端

The MPS control daemon is responsible for the startup and shutdown of MPS servers. The control daemon allows at most one MPS server to be active at a time. When an MPS client connects to the control daemon, the daemon launches an MPS server if there is no server active. The MPS server is launched with the same user id as that of the MPS client.  
MPS 控制守护进程负责 MPS 服务器的启动和关闭。控制守护进程允许同一时间最多只有一个 MPS 服务器处于活动状态。当 MPS 客户端连接到控制守护进程时，如果没有任何服务器处于活动状态，守护进程将启动一个 MPS 服务器。MPS 服务器以与 MPS 客户端相同的用户 ID 启动。

If there is an MPS server already active and the user ID of the server and client match, then the control daemon allows the client to proceed to connect to the server. If there is an MPS server already active, but the server and client were launched with different user ID’s, the control daemon requests the existing server to shutdown once all its clients have disconnected. Once the existing server has shutdown, the control daemon launches a new server with the same user ID as that of the new user’s client process. This is shown in the figure above where user Bob starts client C’ before a server is available. Only once user Alice’s clients exit is a server created for user Bob and client C’.  
如果已经有活跃的 MPS 服务器，并且服务器和客户端的用户 ID 匹配，那么控制守护进程允许客户端连接到服务器。如果已经有活跃的 MPS 服务器，但服务器和客户端是使用不同的用户 ID 启动的，控制守护进程在所有客户端断开连接后请求现有服务器关闭。一旦现有服务器关闭，控制守护进程启动一个新的服务器，其用户 ID 与新用户客户端进程的用户 ID 相同。如上图所示，用户 Bob 在可用服务器之前启动了客户端 C'。只有当用户 Alice 的客户端退出后，才会为用户 Bob 和客户端 C'创建服务器。

The MPS control daemon does not shutdown the active server if there are no pending client requests. This means that the active MPS server process will persist even if all active clients exit. The active server is shutdown when either a new MPS client, launched with a different user id than the active MPS server, connects to the control daemon or when the work launched by the clients has caused a fault. This is shown in the example above, where the control daemon issues a server exit request to Alice’s server only once user Bob starts client C, even though all of Alice’s clients have exited.  
MPS 控制守护进程在没有待处理客户端请求的情况下不会关闭活动服务器。这意味着，即使所有活动客户端退出，活动 MPS 服务器进程也会持续存在。活动服务器在以下两种情况下关闭：当使用与活动 MPS 服务器不同的用户 ID 启动的新 MPS 客户端连接到控制守护进程时，或者当由客户端引发的故障发生时。这在上面的示例中有所显示，其中控制守护进程仅在用户 Bob 启动客户端 C 后向爱丽丝的服务器发出服务器退出请求，尽管爱丽丝的所有客户端都已经退出。

On Volta MPS, the restriction of one Linux user per MPS server may be relaxed to avoid reprovisioning the MPS server on each new user request. Under this mode, clients from all Linux users will appear as clients from the root user and connect to the root MPS server. It is important to make sure that isolation between different users (including the root user) can be safely disregarded before enabling this mode. Clients from all users will share the same MPS log files. The same error containment rules (refer to [Memory Protection and Error Containment](https://docs.nvidia.com/deploy/mps/index.html#memory-protection-and-error-containment)) also apply in this mode across clients from all users. For example, a fatal fault from one client may bring down a different user’s client that shares any GPU with the faulting client. To allow multiple Linux users share one MPS server, start the control daemon under superuser with the `-multiuser-server` option. This option is not supported on Tegra platforms.  
在 Volta MPS 中，可以放宽每个 MPS 服务器仅限一个 Linux 用户的限制，以避免在每次新用户请求时重新配置 MPS 服务器。在这种模式下，所有 Linux 用户的客户端将被视为来自 root 用户的客户端，并连接到 root MPS 服务器。在启用此模式之前，确保可以安全地忽略不同用户（包括 root 用户）之间的隔离非常重要。所有用户的客户端将共享相同的 MPS 日志文件。此模式下，所有用户客户端的相同错误包含规则（参见内存保护和错误包含）同样适用。例如，一个客户端的致命故障可能会导致与故障客户端共享任何 GPU 的不同用户客户端崩溃。为了允许多个 Linux 用户共享一个 MPS 服务器，请在超级用户下使用 `-multiuser-server` 选项启动控制守护进程。此选项在 Tegra 平台上不支持。

An MPS server may be in one of the following states: `INITIALIZING`, `ACTIVE` or `FAULT`. The `INITIALIZING` state indicates that the MPS server is busy initializing and the MPS control will hold the new client requests in its queue. The `ACTIVE` state indicates the MPS server is able to process new client requests. The `FAULT` state indicates that the MPS server is blocked on a fatal fault caused by a client. Any new client requests will be rejected with error `CUDA_ERROR_MPS_SERVER_NOT_READY`.  
MPS 服务器可能处于以下状态之一： `INITIALIZING` ， `ACTIVE` 或 `FAULT` 。 `INITIALIZING` 状态表示 MPS 服务器正忙于初始化，MPS 控制将在其队列中保留新的客户端请求。 `ACTIVE` 状态表示 MPS 服务器能够处理新的客户端请求。 `FAULT` 状态表示 MPS 服务器因客户端故障而被阻塞。任何新的客户端请求都将被错误 `CUDA_ERROR_MPS_SERVER_NOT_READY` 拒绝。

A newly launched MPS server will be in the `INITIALIZING` state first. After successful initialization, the MPS server goes into the `ACTIVE` state. When a client encounters a fatal fault, the MPS server will transition from `ACTIVE` to `FAULT`. On pre-Volta MPS, the MPS server shuts down after encountering a fatal fault. On Volta MPS, the MPS server becomes `ACTIVE` again after all faulting clients have disconnected.  
新发布的 MPS 服务器首先处于 `INITIALIZING` 状态。成功初始化后，MPS 服务器进入 `ACTIVE` 状态。当客户端遇到致命故障时，MPS 服务器从 `ACTIVE` 状态转换到 `FAULT` 状态。在预 Volta MPS 中，MPS 服务器在遇到致命故障后会关闭。在 Volta MPS 中，所有故障客户端断开连接后，MPS 服务器再次变为 `ACTIVE` 状态。

The control daemon executable also supports an interactive mode where a user with sufficient permissions can issue commands, for example to see the current list of servers and clients or startup and shutdown servers manually.  
控制守护进程可执行文件还支持交互模式，具有足够权限的用户可以在此模式下发出命令，例如查看当前的服务器和客户端列表，或手动启动和关闭服务器。

### 3.3.2. 客户端连接/断开

When CUDA is first initialized in a program, the CUDA driver attempts to connect to the MPS control daemon. If the connection attempt fails, the program continues to run as it normally would without MPS. If however, the connection attempt succeeds, the MPS control daemon proceeds to ensure that an MPS server, launched with same user id as that of the connecting client, is active before returning to the client. The MPS client then proceeds to connect to the server.  
当 CUDA 在程序中首次初始化时，CUDA 驱动尝试连接到 MPS 控制守护进程。如果连接尝试失败，程序将继续正常运行，不使用 MPS。然而，如果连接尝试成功，MPS 控制守护进程将确保在连接客户端的同一用户 ID 下启动的 MPS 服务器是活跃的，然后才向客户端返回。MPS 客户端随后将连接到服务器。

All communication between the MPS client, the MPS control daemon, and the MPS server is done using named pipes and UNIX domain sockets. The MPS server launches a worker thread to receive commands from the client. Successful client connection will be logged by the MPS server as the client status becomes `ACTIVE`. Upon client process exit, the server destroys any resources not explicitly freed by the client process and terminates the worker thread. The client exit event will be logged by the MPS server.  
MPS 客户端、MPS 控制守护进程和 MPS 服务器之间的所有通信使用命名管道和 UNIX 域套接字进行。MPS 服务器启动一个工作线程来接收客户端的命令。客户端连接成功后，MPS 服务器会将客户端状态记录为 `ACTIVE` 。当客户端进程退出时，服务器会销毁任何未由客户端进程明确释放的资源，并终止工作线程。客户端退出事件将被 MPS 服务器记录。

# 附录：工具和界面参考

The following utility programs and environment variables are used to manage the MPS execution environment. They are described below, along with other relevant pieces of the standard CUDA programming environment.  
以下实用程序和环境变量用于管理 MPS 执行环境。它们与标准 CUDA 编程环境中的其他相关部分一起描述如下。

## 4.1. 工具和守护进程

### 4.1.1. nvidia-cuda-mps-control

Typically stored under `/usr/bin` on Linux systems and typically run with superuser privileges, this control daemon is used to manage the `nvidia-cuda-mps-server` described in the following section. These are the relevant use cases:  
通常在 Linux 系统中存储在 `/usr/bin` 位置，并通常以超级用户权限运行，此控制守护进程用于管理以下部分中描述的 `nvidia-cuda-mps-server` 。以下是相关用例：
```shell
man nvidia-cuda-mps-control          # Describes usage of this utility.

nvidia-cuda-mps-control -d           # Start daemon in background process.

ps -ef | grep mps                    # Check if the MPS daemon is running.

echo quit | nvidia-cuda-mps-control  # Shut the daemon down.

nvidia-cuda-mps-control -f           # Start daemon in foreground.

nvidia-cuda-mps-control -v           # Print version of control daemon executable (applicable on Tegra platforms only).
```

The control daemon creates a `nvidia-cuda-mps-control.pid` file that contains the PID of the control daemon process in the `CUDA_MPS_PIPE_DIRECTORY`. When there are multiple instances of the control daemon running in parallel, one can target a specific instance by looking up its PID in the corresponding `CUDA_MPS_PIPE_DIRECTORY`. If `CUDA_MPS_PIPE_DIRECTORY` is not set, the `nvidia-cuda-mps-control.pid` file will be created at the default pipe directory at `/tmp/nvidia-mps`.  
控制守护进程创建一个 `nvidia-cuda-mps-control.pid` 文件，其中包含控制守护进程进程的 PID。当有多个控制守护进程并行运行时，可以通过查找对应 `CUDA_MPS_PIPE_DIRECTORY` 文件中的 PID 来针对特定实例。如果 `CUDA_MPS_PIPE_DIRECTORY` 未设置，则将在默认管道目录 `/tmp/nvidia-mps` 下创建 `nvidia-cuda-mps-control.pid` 文件。

When used in interactive mode, the available commands are:  
在交互模式下使用时，可用命令为：

- `get_server_list` – prints out a list of all PIDs of server instances.  
    `get_server_list` – 打印出所有服务器实例的 PID 列表。
    
- `get_server_status <PID>` – this will print out the status of the server with the given `<PID>`.
    `get_server_status <PID>` – 这将打印出给定的服务器状态。
    
  -  `start_server - uid <user id>` – manually starts a new instance of nvidia-cuda-mps-server with the given user ID.  
    `start_server - uid <user id>` – 手动启动给定用户 ID 的新实例 nvidia-cuda-mps-server。
    
- `get_client_list <PID>` – lists the PIDs of client applications connected to a server instance assigned to the given PID.  
    `get_client_list <PID>` – 列出给定 PID 分配的服务器实例上连接的客户端应用程序的进程 ID。
    
- `quit` – terminates the `nvidia-cuda-mps-control` daemon.  
    `quit` – 终止 `nvidia-cuda-mps-control` 守护进程。
    

Commands available to Volta MPS control:  
Volta MPS 控制可用命令： Translated Text:

- `get_device_client_list [<PID>]` – lists the devices and PIDs of client applications that enumerated this device. It optionally takes the server instance PID.  
    `get_device_client_list [<PID>]` – 列出客户端应用程序枚举此设备的设备和 PID。它可选地接受服务器实例 PID。
    
- `set_default_active_thread_percentage <percentage>` – overrides the default active thread percentage for MPS servers. If there is already a server spawned, this command will only affect the next server. The set value is lost if a quit command is executed. The default is 100.  
    `set_default_active_thread_percentage <percentage>` – 覆盖 MPS 服务器的默认活跃线程百分比。如果已经启动了服务器，此命令仅影响下一个服务器。设置的值会在执行退出命令后丢失。默认值为 100。
    
- `get_default_active_thread_percentage` – queries the current default available thread percentage.  
    `get_default_active_thread_percentage` – 查询当前默认可用的线程百分比。
    
- `set_active_thread_percentage <PID> <percentage>` – overrides the active thread percentage for the MPS server instance of the given PID. All clients created with that server afterwards will observe the new limit. Existing clients are not affected.  
    `set_active_thread_percentage <PID> <percentage>` – 为给定 PID 的 MPS 服务器实例覆盖活跃线程百分比。之后使用该服务器创建的所有客户端将观察到新的限制。现有客户端不受影响。
    
- `get_active_thread_percentage <PID>` – queries the current available thread percentage of the MPS server instance of the given PID.  
    `get_active_thread_percentage <PID>` – 查询给定 PID 的 MPS 服务器实例当前可用线程百分比。
    
- `set_default_device_pinned_mem_limit <dev> <value>` – sets the default device pinned memory limit for each MPS client. If there is already a server spawned, this command will only affect the next server. The set value is lost if a `quit` command is executed. The dev argument may be an integer device ordinal or a device UUID string. The value must be in the form of an integer followed by a qualifier, either `G` or `M` that specifies the value in Gigabyte or Megabyte respectively. For example: to set a limit of 10 gigabytes for device 0, use the following command:  
    `set_default_device_pinned_mem_limit <dev> <value>` – 为每个 MPS 客户端设置默认设备固定内存限制。如果已经启动了服务器，此命令仅影响下一个服务器。执行 `quit` 命令时，设置的值会丢失。dev 参数可以是整数设备序号或设备 UUID 字符串。值必须以整数形式加上指定单位的限定符， `G` 表示千兆字节， `M` 表示兆字节。例如，要为设备 0 设置 10 千兆字节的限制，使用以下命令：
    
    `set_default_device_pinned_mem_limit 0 10G`
    
    By default, there is no memory limit set.  
    默认情况下，没有设置内存限制。
    
- `get_default_device_pinned_mem_limit <dev>` – queries the current default pinned memory limit for the device. The dev argument may be an integer device ordinal or a device UUID string.  
    `get_default_device_pinned_mem_limit <dev>` – 查询设备当前的默认固定内存限制。dev 参数可以是整数设备序号或设备 UUID 字符串。
    
- `set_device_pinned_mem_limit <PID> <dev> <value>` - overrides the device pinned memory limit for MPS servers. This sets the device pinned memory limit for each client of MPS server instance of the given PID for the device dev. All clients created with that server afterwards will observe the new limit. Existing clients are not affected. The dev argument may be an integer device ordinal or a device UUID string. For example, to set a limit of 900MB for the server with pid 1024 for device 0, use the following command:  
    `set_device_pinned_mem_limit <PID> <dev> <value>` - 越过 MPS 服务器的设备固定内存限制。这为给定 PID 的 MPS 服务器实例中的每个客户端设置设备 dev 的固定内存限制。之后使用该服务器创建的所有客户端都将观察到新的限制。现有客户端不受影响。dev 参数可以是整数设备序号或设备 UUID 字符串。例如，要为 pid 为 1024 的服务器和设备 0 设置 900MB 的限制，使用以下命令：
    
    `set_device_pinned_mem_limit 1024 0 900M`
    
- `get_device_pinned_mem_limit <PID> <dev>` – queries the current device pinned memory limit of the MPS server instance of the given PID for the device dev. The dev argument may be an integer device ordinal or a device UUID string.  
    `get_device_pinned_mem_limit <PID> <dev>` – 查询给定 PID 的 MPS 服务器实例在设备 dev 上的当前设备固定内存限制。dev 参数可以是整数设备序号或设备 UUID 字符串。
    
- `terminate_client <server PID> <client PID>` – terminates all the outstanding GPU work of the MPS client process `<client PID>` running on the MPS server denoted by` <server PID>`. For example, to terminate the outstanding GPU work for an MPS client process with PID 1024 running on an MPS server with PID 123, use the following command:  
    `terminate_client <server PID> <client PID>` – 终止 MPS 服务器标识为上运行的 MPS 客户端进程的所有未完成的 GPU 工作。例如，要终止 PID 为 1024 的 MPS 客户端进程在 PID 为 123 的 MPS 服务器上进行的所有未完成的 GPU 工作，请使用以下命令：`terminate_client 123 1024`
    
- `ps [-p PID]` – reports a snapshot of the current client processes. It optionally takes the server instance PID. It displays the PID, the unique identifier assigned by the server, the partial UUID of the associated device, the PID of the connected server, the namespace PID, and the command line of the client.  
    `ps [-p PID]` – 报告当前客户端进程的快照。它可选地接受服务器实例 PID。它显示 PID，由服务器分配的唯一标识符，与之关联的设备的部分 UUID，连接的服务器的 PID，命名空间 PID，以及客户端的命令行。
    
- `set_default_client_priority [priority]` – sets the default client priority that will be used for new clients. The value is not applied to existing clients. Priority values should be considered as hints to the CUDA Driver, not guarantees. Allowed values are `0 [NORMAL]` and 1 `[BELOW NORMAL]`. The set value is lost if a quit command is executed. The default is `0 [NORMAL]`.  
    `set_default_client_priority [priority]` – 设置默认客户端优先级，用于新客户端。该值不应用于现有客户端。优先级值应被视为 CUDA 驱动的提示，而不是保证。允许的值为 `0 [NORMAL]` 和 1 `[BELOW NORMAL]` 。执行退出命令后，设置的值会丢失。默认值为 `0 [NORMAL]` 。
    
- `get_default_client_priority` – queries the current priority value that will be used for new clients.  
    `get_default_client_priority` – 查询将用于新客户的当前优先级值。
    

### 4.1.2. nvidia-cuda-mps-server

Typically stored under `/usr/bin` on Linux systems, this daemon is run under the same $UID as the client application running on the node. The `nvidia-cuda-mps-server` instances are created on-demand when client applications connect to the control daemon. The server binary should not be invoked directly, and instead the control daemon should be used to manage the startup and shutdown of servers.  
通常在 Linux 系统中存储在 `/usr/bin` 位置，此守护进程在节点上运行的客户端应用程序的相同$UID 下运行。当客户端应用程序连接到控制守护进程时，会在 `nvidia-cuda-mps-server` 位置创建实例。当客户端应用程序连接到控制守护进程时，会按需创建实例。服务器二进制文件不应直接调用，而是应使用控制守护进程来管理服务器的启动和关闭。

The `nvidia-cuda-mps-server` process owns the CUDA context on the GPU and uses it to execute GPU operations for its client application processes. Due to this, when querying active processes via nvidia-smi (or any NVML-based application) nvidia-cuda-mps-server will appear as the active CUDA process rather than any of the client processes.  
`nvidia-cuda-mps-server` 过程在 GPU 上拥有 CUDA 上下文并使用它来为其客户端应用程序过程执行 GPU 操作。因此，通过 nvidia-smi（或任何基于 NVML 的应用程序）查询活动进程时，nvidia-cuda-mps-server 会作为活跃的 CUDA 进程出现，而不是任何客户端进程。

On Tegra platforms, the version of the `nvidia-cuda-mps-server` executable can be printed with:  
在 Tegra 平台上，可以使用以下命令打印 `nvidia-cuda-mps-server` 可执行文件的版本： ```bash cat /proc/version ```
```shell
nvidia-cuda-mps-server -v
```


### 4.1.3. nvidia-smi

Typically stored under `/usr/bin` on Linux systems, this is used to configure GPU’s on a node. The following use cases are relevant to managing MPS:  
通常在 Linux 系统中存储在 `/usr/bin` 下，用于配置节点上的 GPU。以下用例与管理 MPS 相关： -
```shell
man nvidia-smi                        # Describes usage of this utility.

nvidia-smi -L                         # List the GPU's on node.

nvidia-smi -q                         # List GPU state and configuration information.

nvidia-smi -q -d compute              # Show the compute mode of each GPU.

nvidia-smi -i 0 -c EXCLUSIVE_PROCESS  # Set GPU 0 to exclusive mode, run as root.

nvidia-smi -i 0 -c DEFAULT            # Set GPU 0 to default mode, run as root. (SHARED_PROCESS)

nvidia-smi -i 0 -r                    # Reboot GPU 0 with the new setting.
```

## 4.2. 环境变量

### 4.2.1. CUDA_VISIBLE_DEVICES

`CUDA_VISIBLE_DEVICES` is used to specify which GPU’s should be visible to a CUDA application. Only the devices whose index or UUID is present in the sequence are visible to CUDA applications and they are enumerated in the order of the sequence.  
`CUDA_VISIBLE_DEVICES` 用于指定 CUDA 应用程序中应可见的 GPU。仅在序列中包含索引或 UUID 的设备对 CUDA 应用程序可见，并按照序列的顺序进行枚举。

When `CUDA_VISIBLE_DEVICES` is set before launching the control daemon, the devices will be remapped by the MPS server. This means that if your system has devices 0, 1 and 2, and if `CUDA_VISIBLE_DEVICES` is set to `0,2`, then when a client connects to the server it will see the remapped devices – device 0 and a device 1. Therefore, keeping `CUDA_VISIBLE_DEVICES` set to `0,2` when launching the client would lead to an error.  
在启动控制守护进程时设置 `CUDA_VISIBLE_DEVICES` ，设备将由 MPS 服务器重新映射。这意味着，如果您的系统有设备 0、1 和 2，如果将 `CUDA_VISIBLE_DEVICES` 设置为 `0,2` ，那么当客户端连接到服务器时，它将看到重新映射的设备 - 设备 0 和设备 1。因此，在启动客户端时将 `CUDA_VISIBLE_DEVICES` 保持为 `0,2` 将导致错误。

The MPS control daemon will further filter-out any pre-Volta devices, if any visible device is Volta+.  
MPS 控制守护进程将进一步筛选出任何预 Volta 设备，如果可见设备是 Volta+。

To avoid this ambiguity, we recommend using UUIDs instead of indices. These can be viewed by launching `nvidia-smi -q`. When launching the server, or the application, you can set `CUDA_VISIBLE_DEVICES` to `UUID_1,UUID_2`, where `UUID_1` and `UUID_2` are the GPU UUIDs. It will also work when you specify the first few characters of the UUID (including `GPU-`) rather than the full UUID.  
为了避免这种歧义，我们建议使用 UUID 代替索引。这些可以通过启动 `nvidia-smi -q` 来查看。在启动服务器或应用程序时，可以将 `CUDA_VISIBLE_DEVICES` 设置为 `UUID_1,UUID_2` ，其中 `UUID_1` 和 `UUID_2` 是 GPU 的 UUID。即使只指定 UUID 的前几位字符（包括 `GPU-` ），而不是完整的 UUID，这种方法也有效。

The MPS server will fail to start if incompatible devices are visible after the application of `CUDA_VISIBLE_DEVICES`.  
应用 `CUDA_VISIBLE_DEVICES` 后，如果出现不兼容的设备，MPS 服务器将无法启动。

### 4.2.2. CUDA_MPS_PIPE_DIRECTORY

The MPS control daemon, the MPS server, and the associated MPS clients communicate with each other via named pipes and UNIX domain sockets. The default directory for these pipes and sockets is `/tmp/nvidia-mps`. The environment variable, `CUDA_MPS_PIPE_DIRECTORY`, can be used to override the location of these pipes and sockets. The value of this environment variable should be consistent across all MPS clients sharing the same MPS server, and the MPS control daemon.  
MPS 控制守护进程，MPS 服务器和相关 MPS 客户端通过命名管道和 UNIX 域套接字相互通信。这些管道和套接字的默认目录为 `/tmp/nvidia-mps` 。可以使用环境变量 `CUDA_MPS_PIPE_DIRECTORY` 来覆盖这些管道和套接字的位置。此环境变量的值应在整个共享同一 MPS 服务器的 MPS 客户端之间保持一致，并且与 MPS 控制守护进程保持一致。

The recommended location for the directory containing these named pipes and domain sockets is local folders such as `/tmp`. If the specified location exists in a shared, multi-node filesystem, the path must be unique for each node to prevent multiple MPS servers or MPS control daemons from using the same pipes and sockets. When provisioning MPS on a per-user basis, the directory should be set to a location such that different users will not end up using the same directory.  
推荐的目录位置包含这些命名管道和域套接字是本地文件夹，如 `/tmp` 。如果指定的位置在共享的、多节点文件系统中存在，路径必须对每个节点都是唯一的，以防止多个 MPS 服务器或 MPS 控制守护进程使用相同的管道和套接字。在按用户单独配置 MPS 时，应设置目录位置，确保不同用户不会使用相同的目录。

On Tegra platforms, there is no default directory setting for pipes and sockets. Users must set this environment variable such that only intended users have access to this location.  
在 Tegra 平台上，没有默认的目录设置用于管道和套接字。用户必须设置此环境变量，确保只有预期的用户可以访问此位置。

### 4.2.3. CUDA_MPS_LOG_DIRECTORY

The MPS control daemon maintains a `control.log` file which contains the status of its MPS servers, user commands issued and their result, and startup and shutdown notices for the daemon. The MPS server maintains a `server.log` file containing its startup and shutdown information and the status of its clients.  
MPS 控制守护进程维护一个 `control.log` 文件，其中包含其 MPS 服务器的状态、用户命令及其结果，以及守护进程的启动和关闭通知。MPS 服务器维护一个 `server.log` 文件，其中包含其启动和关闭信息以及客户端的状态。

By default these log files are stored in the directory `/var/log/nvidia-mps`. The `CUDA_MPS_LOG_DIRECTORY` environment variable can be used to override the default value. This environment variable should be set in the MPS control daemon’s environment and is automatically inherited by any MPS servers launched by that control daemon.  
默认情况下，这些日志文件存储在目录 `/var/log/nvidia-mps` 中。可以使用 `CUDA_MPS_LOG_DIRECTORY` 环境变量来覆盖默认值。此环境变量应设置在 MPS 控制守护进程的环境中，并且由该控制守护进程启动的任何 MPS 服务器会自动继承此设置。

On Tegra platforms, there is no default directory setting for storing the log files. MPS will remain operational without the user setting this environment variable; however, in such instances, MPS logs will not be available. If logs are required to be captured, then the user must set this environment variable such that only intended users have access to this location.  
在 Tegra 平台上，没有默认的目录设置用于存储日志文件。MPS 将在用户不设置此环境变量的情况下继续运行；然而，在这种情况下，MPS 日志将不可用。如果需要捕获日志，则用户必须设置此环境变量，以便只有预期的用户可以访问此位置。

### 4.2.4. CUDA_DEVICE_MAX_CONNECTIONS

When encountered in the MPS client’s environment, `CUDA_DEVICE_MAX_CONNECTIONS` sets the preferred number of compute and copy engine concurrent connections (work queues) from the host to the device for that client. The number actually allocated by the driver may differ from what is requested based on hardware resource limitations or other considerations. Under MPS, each server’s clients share one pool of connections, whereas without MPS each CUDA context would be allocated its own separate connection pool. Volta MPS clients exclusively owns the connections set aside for the client in the shared pool, so setting this environment variable under Volta MPS may reduce the number of available clients. The default value is 2 for Volta MPS clients.  
在 MPS 客户端的环境中遇到 `CUDA_DEVICE_MAX_CONNECTIONS` 时，它设置从主机到设备为该客户端的计算和复制引擎并发连接（工作队列）的首选数量。实际由驱动程序分配的数量可能与请求的数量不同，这取决于硬件资源限制或其他考虑因素。在 MPS 下，每个服务器的客户端共享一个连接池，而没有 MPS，每个 CUDA 上下文将被分配自己的单独连接池。在 Volta MPS 客户端中，客户端独占共享池为客户端保留的连接，因此在 Volta MPS 下设置此环境变量可能会减少可用客户端的数量。默认值为 2，适用于 Volta MPS 客户端。

### 4.2.5. CUDA_MPS_ACTIVE_THREAD_PERCENTAGE

On Volta GPUs, this environment variable sets the portion of the available threads that can be used by the client contexts. The limit can be configured at different levels.  
在 Volta GPU 上，此环境变量设置可用于客户端上下文的可用线程的部分。限制可以在不同的级别进行配置。

#### 4.2.5.1. MPS 控制守护进程级别

Setting this environment variable in an MPS control’s environment will configure the default active thread percentage when the MPS control daemon starts.  
在 MPS 控制的环境中设置此环境变量将配置 MPS 控制守护进程启动时的默认活动线程百分比。

All the MPS servers spawned by the MPS control daemon will observe this limit. Once the MPS control daemon has started, changing this environment variable cannot affect the MPS servers.  
所有由 MPS 控制守护进程启动的 MPS 服务器都将遵守这个限制。一旦 MPS 控制守护进程启动，更改这个环境变量将不会影响 MPS 服务器。

#### 4.2.5.2. 客户端进程级别

Setting this environment variable in an MPS client’s environment will configure the active thread percentage when the client process starts. The new limit will only further constrain the limit set by the control daemon (via `set_default_active_thread_percentage` or `set_active_thread_percentage` control daemon commands or this environment variable at the MPS control daemon level). If the control daemon has a lower setting, the control daemon setting will be obeyed by the client process instead.  
在 MPS 客户端的环境中设置此环境变量将配置客户端进程启动时的活跃线程百分比。新的限制只会进一步约束控制守护进程通过 `set_default_active_thread_percentage` 或 `set_active_thread_percentage` 控制守护进程命令或在 MPS 控制守护进程级别此环境变量设置的限制。如果控制守护进程的设置较低，客户端进程将遵循控制守护进程的设置。

All the client CUDA contexts created within the client process will observe the new limit. Once the client process has started, changing the value of this environment variable cannot affect the client CUDA contexts.  
所有在客户端进程内创建的客户端 CUDA 上下文都将观察到新的限制。一旦客户端进程开始运行，更改此环境变量的值将不会影响客户端 CUDA 上下文。

#### 4.2.5.3. 客户端 CUDA 上下文级别

By default, configuring the active thread percentage at the client CUDA context level is disabled. User must explicitly opt-in via environment variable `CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING`. Refer to [CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING](https://docs.nvidia.com/deploy/mps/index.html#cuda-mps-enable-per-ctx-device-multiprocessor-partitioning) for more details.  
默认情况下，在客户端 CUDA 上下文级别配置活动线程百分比是禁用的。用户必须通过环境变量 `CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING` 显式启用。参见 CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING 以获取更多详细信息。

Setting this environment variable within a client process will configure the active thread percentage when creating a new client CUDA context. The new limit will only further constraint the limit set at the control daemon level and the client process level. If the control daemon or the client process has a lower setting, the lower setting will be obeyed by the client CUDA context instead. All the client CUDA contexts created afterwards will observe the new limit. Existing client CUDA contexts are not affected.  
在客户端进程内设置此环境变量将配置创建新客户端 CUDA 上下文时的活动线程百分比。新限制只会进一步约束控制守护进程级别和客户端进程级别的限制。如果控制守护进程或客户端进程的设置较低，客户端 CUDA 上下文将遵循较低的设置。之后创建的所有客户端 CUDA 上下文都将遵守新的限制。现有的客户端 CUDA 上下文不受影响。

### 4.2.6. CUDA_MPS_ENABLE_PER_CTX_DEVICE_MULTIPROCESSOR_PARTITIONING

By default, users can only partition the available threads uniformly. An explicit opt-in via this environment variable is required to enable non-uniform partitioning capability. To enable non-uniform partitioning capability, this environment variable must be set before the client process starts.  
默认情况下，用户只能均匀地分区可用的线程。要启用非均匀分区功能，需要通过此环境变量进行显式启用。要启用非均匀分区功能，必须在客户端进程启动之前设置此环境变量。

When non-uniform partitioning capability is enabled in an MPS client’s environment, client CUDA contexts can have different active thread percentages within the same client process via setting `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` before context creations. The device attribute `cudaDevAttrMultiProcessorCount` will reflect the active thread percentage and return the portion of available SMs that can be used by the client CUDA context current to the calling thread.  
当 MPS 客户端环境启用非均匀分区功能时，通过在创建上下文之前设置 `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` ，客户端 CUDA 上下文可以在同一客户端进程中具有不同的活跃线程百分比。设备属性 `cudaDevAttrMultiProcessorCount` 将反映活跃线程百分比，并返回当前调用线程可由客户端 CUDA 上下文使用的可用 SM 部分。

### 4.2.7. CUDA_MPS_PINNED_DEVICE_MEM_LIMIT

The pinned memory limit control limits the amount of GPU memory that is allocatable by CUDA APIs by the client process. On Volta GPUs, this environment variable sets a limit on pinned device memory that can be allocated by the client contexts. Setting this environment variable in an MPS client’s environment will set the device’s pinned memory limit when the client process starts. The new limit will only further constrain the limit set by the control daemon (via `set_default_device_pinned_mem_limit` or `set_device_pinned_mem_limit control` daemon commands or this environment variable at the MPS control daemon level). If the control daemon has a lower value, the control daemon setting will be obeyed by the client process instead. This environment variable will have the same semantics as `CUDA_VISIBLE_DEVICES` i.e. the value string can contain comma-separated device ordinals and/or device UUIDs with per device memory limit separated by an equals. Example usage:  
固定内存限制控制通过 CUDA API 由客户端进程可分配的 GPU 内存量进行限制。在 Volta GPU 上，此环境变量设置客户端上下文可分配的固定设备内存限制。在 MPS 客户端的环境中设置此环境变量，客户端进程启动时将设置设备的固定内存限制。新的限制只会进一步限制由控制守护进程（通过 `set_default_device_pinned_mem_limit` 或 `set_device_pinned_mem_limit control` 守护进程命令或在 MPS 控制守护进程级别此环境变量）设置的限制。如果控制守护进程的值较低，则客户端进程将遵循控制守护进程的设置。此环境变量的语义与 `CUDA_VISIBLE_DEVICES` 相同，即值字符串可以包含用逗号分隔的设备序号和/或设备 UUID，以及每个设备的内存限制由等号分隔。示例使用：
```shell
$ export CUDA_MPS_PINNED_DEVICE_MEM_LIMIT=''0=1G,1=512MB''
```

The following example highlights the hierarchy and usage of the MPS memory limiting functionality.  
以下示例突出了 MPS 内存限制功能的层次结构和用法。
```shell
# Set the default device pinned mem limit to 3G for device 0. The default limit constrains the memory allocation limit of all the MPS clients of future MPS servers to 3G on device 0.

$ nvidia-cuda-mps-control set_default_device_pinned_mem_limit 0 3G

# Start daemon in background process

$ nvidia-cuda-mps-control -d

# Set device pinned mem limit to 2G for device 0 for the server instance of the given PID. All the MPS clients on this server will observe this new limit of 2G instead of the default limit of 3G when allocating pinned device memory on device 0.

# Note -- users are allowed to specify a server limit (via set_device_pinned_mem_limit) greater than the default limit previously set by set_default_device_pinned_mem_limit.

$ nvidia-cuda-mps-control set_device_pinned_mem_limit <pid> 0 2G

# Further constrain the device pinned mem limit for a particular MPS client to 1G for device 0. This ensures the maximum amount of memory allocated by this client is capped at 1G.

# Note - setting this environment variable to a value greater than value observed by the server for its clients (through set_default_device_pinned_mem_limit/ set_device_pinned_mem_limit) will not set the limit to the higher value and thus will be ineffective and the eventual limit observed by the client will be that observed by the server.

$ export CUDA_MPS_DEVICE_MEM_LIMIT="0=1G"

```

### 4.2.8. CUDA_MPS_CLIENT_PRIORITY

The client priority level variable controls the initial default server value for the MPS Control Daemon if used to launch that, or the client priority level value for a given client if used in a client launch. The following examples demonstrate both usages.  
客户优先级变量控制了如果使用它来启动 MPS 控制守护进程，则初始默认服务器值，或者如果在客户端启动中使用，则为给定客户端的客户优先级级别值。以下示例展示了这两种用法。

```shell
# Set the default client priority level for new servers and clients to Below Normal

$ export CUDA_MPS_CLIENT_PRIORITY=1

$ nvidia-cuda-mps-control -d

# Set the client priority level for a single program to Normal without changing the priority level for future clients

$ CUDA_MPS_CLIENT_PRIORITY=0 <program>
```


> Note 注意
CUDA priority levels are not guarantees of execution order – they are only a performance hint to the CUDA Driver.  
CUDA 优先级级别不是执行顺序的保证，它们只是 CUDA 驱动程序的性能提示。

## 4.3. MPS 日志格式

### 4.3.1. 控制日志

Some of the example messages logged by the control daemon:  
控制守护进程记录的一些示例消息： Translated Text:

- Startup and shutdown of MPS servers identified by their process ids and the user id with which they are being launched.  
    使用它们的进程 ID 和启动时使用的用户 ID 标识 MPS 服务器的启动和关闭。
    `[2013-08-05 12:50:23.347 Control 13894] Starting new server 13929 for user 500`
    `[2013-08-05 12:50:24.870 Control 13894] NEW SERVER 13929: Ready`
    `[2013-08-05 13:02:26.226 Control 13894] Server 13929 exited with status 0`
- New MPS client connections identified by the client process id and the user id of the user that launched the client process.  
    新 MPS 客户端连接由客户端进程 ID 和启动客户端进程的用户 ID 标识。
    `[2013-08-05 13:02:10.866 Control 13894] NEW CLIENT 19276 from user 500: Server already exists`
    `[2013-08-05 13:02:10.961 Control 13894] Accepting connection...`
    
- User commands issued to the control daemon and their result.  
    用户向控制守护进程发出的命令及其结果。
    `[2013-08-05 12:50:23.347 Control 13894] Starting new server 13929 for user 500`
    `[2013-08-05 12:50:24.870 Control 13894] NEW SERVER 13929: Ready`
    
- Error information such as failing to establish a connection with a client.  
    客户端连接失败的错误信息。
    `[2013-08-05 13:02:10.961 Control 13894] Accepting connection...`
    `[2013-08-05 13:02:10.961 Control 13894] Unable to read new connection type information`
    

###  4.3.2. 服务器日志

Some of the example messages logged by the MPS server:  
MPS 服务器记录的一些示例消息： Translated Text:
- New MPS client connections and disconnections identified by the client process ID.  
    新 MPS 客户端连接和断开，通过客户端进程 ID 识别。
    `[2013-08-05 13:00:09.269 Server 13929] New client 14781 connected`
    `[2013-08-05 13:00:09.270 Server 13929] Client 14777 disconnected`
    
- Error information such as the MPS server failing to start due to system requirements not being met.  
    MPS 服务器因系统要求未满足而无法启动的相关错误信息。
    `[2013-08-06 10:51:31.706 Server 29489] MPS server failed to start`
    `[2013-08-06 10:51:31.706 Server 29489] MPS is only supported on 64-bit Linux platforms, with an SM 3.5 or higher GPU.`
    
- Information about fatal GPU error containment on Volta+ MPS  
    关于 Volta+ MPS 中致命 GPU 错误的包含信息
    `[2022-04-28 15:56:07.410 Other 11570] Volta MPS: status of client {11661, 1} is ACTIVE`
    `[2022-04-28 15:56:07.468 Other 11570] Volta MPS: status of client {11663, 1} is ACTIVE`
    `[2022-04-28 15:56:07.518 Other 11570] Volta MPS: status of client {11643, 2} is ACTIVE`
    `[2022-04-28 15:56:08.906 Other 11570] Volta MPS: Server is handling a fatal GPU error.`
    `[2022-04-28 15:56:08.906 Other 11570] Volta MPS: status of client {11641, 1} is INACTIVE`
    `[2022-04-28 15:56:08.906 Other 11570] Volta MPS: status of client {11643, 1} is INACTIVE`
    `[2022-04-28 15:56:08.906 Other 11570] Volta MPS: status of client {11643, 2} is INACTIVE`
    `[2022-04-28 15:56:08.906 Other 11570] Volta MPS: The following devices`
    `[2022-04-28 15:56:08.906 Other 11570] 0`
    `[2022-04-28 15:56:08.907 Other 11570] 1`
    `[2022-04-28 15:56:08.907 Other 11570] Volta MPS: The following clients have a sticky error set:`
    `[2022-04-28 15:56:08.907 Other 11570] 11641`
    `[2022-04-28 15:56:08.907 Other 11570] 11643`
    `[2022-04-28 15:56:09.200 Other 11570] Client {11641, 1} exit`
    `[2022-04-28 15:56:09.244 Other 11570] Client {11643, 1} exit`
    `[2022-04-28 15:56:09.244 Other 11570] Client {11643, 2} exit`
    `[2022-04-28 15:56:09.245 Other 11570] Volta MPS: Destroy server context on device 0`
    `[2022-04-28 15:56:09.269 Other 11570] Volta MPS: Destroy server context on device 1`
    `[2022-04-28 15:56:10.310 Other 11570] Volta MPS: Creating server context on device 0`
    `[2022-04-28 15:56:10.397 Other 11570] Volta MPS: Creating server context on device 1`
    

## 4.4. MPS 已知问题

- Clients may fail to start, returning `ERROR_OUT_OF_MEMORY` when the first CUDA context is created, even though there are fewer client contexts than the hard limit of 16.  
    客户可能在创建第一个 CUDA 上下文时无法启动，返回 `ERROR_OUT_OF_MEMORY` ，尽管客户端上下文的数量少于硬件限制 16 的硬限制。
    
    Comments: When creating a context, the client tries to reserve virtual address space for the Unified Virtual Addressing memory range. On certain systems, this can clash with the system linker and the dynamic shared libraries loaded by it. Ensure that CUDA initialization (e.g., `cuInit()` or any `cuda*()` Runtime API function) is one of the first functions called in your code. To provide a hint to the linker and to the Linux kernel that you want your dynamic shared libraries higher up in the VA space (where it won’t clash with CUDA’s UVA range), compile your code as PIC (Position Independent Code) and PIE (Position Independent Executable). Refer to your compiler manual for instructions on how to achieve this.  
    注释：在创建上下文时，客户端尝试为统一虚拟地址内存范围预留虚拟地址空间。在某些系统上，这可能会与系统链接器和由其加载的动态共享库发生冲突。确保 CUDA 初始化（例如， `cuInit()` 或任何 `cuda*()` 运行时 API 函数）是您代码中调用的最早函数之一。为了向链接器和 Linux 内核提供提示，您希望您的动态共享库位于 VA 空间的较高位置（在那里它不会与 CUDA 的 UVA 范围冲突），请将您的代码编译为 PIC（位置无关代码）和 PIE（位置无关可执行文件）。请参阅您的编译器手册以获取实现此功能的说明。
    
- Memory allocation API calls (including context creation) may fail with the following message in the server log: MPS Server failed to create/open SHM segment.  
    服务器日志中可能会出现以下消息，表示内存分配 API 调用（包括上下文创建）失败：MPS 服务器未能创建/打开 SHM 段。
    
    Comments: This is most likely due to exhausting the file descriptor limit on your system. Check the maximum number of open file descriptors allowed on your system and increase if necessary. We recommend setting it to 16384 and higher. Typically this information can be checked via the command `ulimit -n`; refer to your operating system instructions on how to change the limit.  
    注释：这很可能是因为系统中的文件描述符限制已耗尽。检查系统允许的最大打开文件描述符数量，并在必要时增加。我们建议将其设置为 16384 或更高。通常可以通过命令 `ulimit -n` 来检查此信息；参阅您的操作系统说明，了解如何更改限制。
    

# 5. 附录：常见任务

The convention for using MPS will vary between system environments. The Cray environment, for example, manages MPS in a way that is almost invisible to the user, whereas other Linux-based systems may require the user to manage activating the control daemon themselves. As a user you will need to understand which set of conventions is appropriate for the system you are running on. Some cases are described in this section.  
使用 MPS 的约定将在不同的系统环境中有所不同。例如，Cray 环境以几乎对用户不可见的方式管理 MPS，而基于 Linux 的其他系统可能需要用户自行管理激活控制守护进程。作为用户，您需要了解适用于您正在运行的系统的约定是哪一套。本节描述了一些情况。

## 5.1. 在 Linux 上启动和停止 MPS

### 5.1.1. 在多用户系统中

To cause all users of the system to run CUDA applications via MPS you will need to set up the MPS control daemon to run when the system starts.  
为了使系统的所有用户通过 MPS 运行 CUDA 应用程序，您需要设置 MPS 控制守护进程，在系统启动时运行。

#### 5.1.1.1. 启动 MPS 控制守护进程

As root, run the commands:  
作为 root，运行命令：
```shell
export CUDA_VISIBLE_DEVICES=0           # Select GPU 0.

nvidia-smi -i 0 -c EXCLUSIVE_PROCESS    # Set GPU 0 to exclusive mode.

nvidia-cuda-mps-control -d              # Start the daemon.

```

This will start the MPS control daemon that will spawn a new MPS Server instance for any $UID starting an application and associate it with the GPU visible to the control daemon. Only one instance of the `nvidia-cuda-mps-control` daemon should be run per node. Note that `CUDA_VISIBLE_DEVICES` should not be set in the client process’s environment.  
这将启动 MPS 控制守护进程，该守护进程将为启动应用程序的任何$UID 生成一个新的 MPS 服务器实例，并将其与控制守护进程可见的 GPU 关联。每个节点上只应运行一个守护进程实例。请注意，客户端进程的环境中不应设置 `CUDA_VISIBLE_DEVICES` 。

#### 5.1.1.2. 关闭 MPS 控制守护进程

To shut down the daemon, as root, run:  
要关闭守护进程，请以 root 身份运行：
```shell
echo quit | nvidia-cuda-mps-control
```


#### 5.1.1.3. 日志文件

You can view the status of the daemons by viewing the log files in  
你可以通过查看日志文件来查看守护进程的状态
`/var/log/nvidia-mps/control.log`
`/var/log/nvidia-mps/server.log`
These are typically only visible to users with administrative privileges.  
这些通常只对具有管理员权限的用户可见。

### 5.1.2. 在单用户系统中

When running as a single user, the control daemon must be launched with the same user id as that of the client process  
在单用户模式运行时，控制守护进程必须使用与客户端进程相同的所有者 ID 启动

#### 5.1.2.1. 启动 MPS 控制守护进程

As $UID, run the commands:  
作为$UID，运行命令：

`export CUDA_VISIBLE_DEVICES=0 # Select GPU 0.`
`export CUDA_MPS_PIPE_DIRECTORY=/tmp/nvidia-mps # Select a location that's accessible to the given $UID`
`export CUDA_MPS_LOG_DIRECTORY=/tmp/nvidia-log # Select a location that's accessible to the given $UID`
`nvidia-cuda-mps-control -d # Start the daemon.`

This will start the MPS control daemon that will spawn a new MPS Server instance for that $UID starting an application and associate it with GPU visible to the control daemon.  
这将启动 MPS 控制守护进程，该守护进程将为该$UID 启动一个新的 MPS 服务器实例，运行应用程序并与控制守护进程可见的 GPU 关联。

#### 5.1.2.2. 启动 MPS 客户端应用

Set the following variables in the client process’s environment. Note that `CUDA_VISIBLE_DEVICES` should not be set in the client’s environment.  
在客户端进程的环境中设置以下变量。请注意，客户端环境中不应设置 `CUDA_VISIBLE_DEVICES` 。

`export CUDA_MPS_PIPE_DIRECTORY=/tmp/nvidia-mps # Set to the same location as the MPS control daemon`

`export CUDA_MPS_LOG_DIRECTORY=/tmp/nvidia-log # Set to the same location as the MPS control daemon`


#### 5.1.2.3. 关闭 MPS

To shut down the daemon, as $UID, run:  
要关闭守护进程，请以$UID 身份运行：
```shell
echo quit | nvidia-cuda-mps-control
```

#### 5.1.2.4. 日志文件

You can view the status of the daemons by viewing the log files in  
你可以通过查看日志文件来查看守护进程的状态
```shell
$CUDA_MPS_LOG_DIRECTORY/control.log

$CUDA_MPS_LOG_DIRECTORY/server.log
```

### 5.1.3. 编写批处理队列系统

#### 5.1.3.1. 基本原则

Chapters 3 and 4 describe the MPS components, software utilities, and the environment variables that control them. However, using MPS at this level puts a burden on the user since at the application level, the user only cares whether MPS is engaged or not, and should not have to understand the details of environment settings and so on when they are unlikely to deviate from a fixed configuration.  
第 3 章和第 4 章描述了 MPS 组件、软件工具以及控制它们的环境变量。然而，在这个级别使用 MPS 会给用户带来负担，因为在应用级别，用户只关心 MPS 是否参与，而不应该需要理解环境设置等细节，尤其是在不太可能偏离固定配置的情况下。

There may be consistency conditions that need to be enforced by the system itself, such as clearing CPU- and GPU- memory between application runs, or deleting zombie processes upon job completion.  
系统本身可能需要强制执行一致性条件，例如在应用程序运行之间清理 CPU 和 GPU 内存，或者在任务完成后删除僵尸进程。

Root-access (or equivalent) is required to change the mode of the GPU.  
需要根访问权限（或等效权限）来更改 GPU 的模式。

We recommend you manage these details by building some sort of automatic provisioning abstraction on top of the basic MPS components. This section discusses how to implement a batch-submission flag in the PBS/Torque queuing environment and discusses MPS integration into a batch queuing system in-general.  
我们建议您通过在基本 MPS 组件之上构建某种自动预置抽象来管理这些细节。本节讨论如何在 PBS/Torque 队列环境中实现批提交标志，并讨论 MPS 如何与批队列系统整体集成。

#### 5.1.3.2. 按任务 MPS 控制：一个 Torque/PBS 示例

> Note 注意
Torque installations are highly customized. Conventions for specifying job resources vary from site to site and we expect that, analogously, the convention for enabling MPS could vary from site to site as well. Check with your system’s administrator to find out if they already have a means to provision MPS on your behalf.  
扭矩安装非常定制化。指定工作资源的约定在各个站点之间有所不同，我们预计启用 MPS 的约定也可能在各个站点之间有所不同。请与您的系统的管理员联系，以了解他们是否已经提供了一种为您代理提供 MPS 的方法。

Tinkering with nodes outside the queuing convention is generally discouraged since jobs are usually dispatched as nodes are released by completing jobs. It is possible to enable MPS on a per-job basis by using the Torque prologue and epilogue scripts to start and stop the `nvidia-cuda-mps-control` daemon. In this example, we re-use the `account` parameter to request MPS for a job, so that the following command:  
调整队列约定之外的节点通常被禁止，因为任务通常会在完成任务并释放节点时被分发。可以通过使用 Torque 的前序和后序脚本来在单个任务级别启用 MPS。在这个例子中，我们重用 `account` 参数来请求 MPS，因此以下命令：

`qsub -A "MPS=true" ...`

will result in the prologue script starting MPS as shown:  
将导致序言脚本开始 MPS，如下所示：
```shell
# Activate MPS if requested by user

USER=$2
ACCTSTR=$7
echo $ACCTSTR | grep -i "MPS=true"
if [ $? -eq 0 ]; then
   nvidia-smi -c 3
   USERID=`id -u $USER`
   export CUDA_VISIBLE_DEVICES=0
   nvidia-cuda-mps-control -d && echo "MPS control daemon started"
   sleep 1
   echo "start_server -uid $USERID" | nvidia-cuda-mps-control && echo "MPS server started for $USER"
fi

and the epilogue script stopping MPS as shown:  
并且结尾脚本停止 MPS 如所示：

# Reset compute mode to default
nvidia-smi -c 0

# Quit cuda MPS if it's running
ps aux | grep nvidia-cuda-mps-control | grep -v grep > /dev/null
if [ $? -eq 0 ]; then
   echo quit | nvidia-cuda-mps-control
fi

# Test for presence of MPS zombie
ps aux | grep nvidia-cuda-mps | grep -v grep > /dev/null
if [ $? -eq 0 ]; then
   logger "`hostname` epilogue: MPS refused to quit! Marking offline"
   pbsnodes -o -N "Epilogue check: MPS did not quit" `hostname`
fi

# Check GPU sanity, simple check
nvidia-smi > /dev/null
if [ $? -ne 0 ]; then
   logger "`hostname` epilogue: GPUs not sane! Marking `hostname` offline"
   pbsnodes -o -N "Epilogue check: nvidia-smi failed" `hostname`
fi

```

## 5.2. SM 分区的最佳实践

Creating a context is a costly operation in terms of time, memory, and the hardware resources.  
创建上下文是一项在时间、内存和硬件资源方面成本较高的操作。

If a context with execution affinity is created at kernel launch time, the user will observe a sudden increase in latency and memory footprint as a result of the context creation. To avoid paying the latency of context creation and the abrupt increase in memory usage at kernel launch time, it is recommended that users create a pool of contexts with different SM partitions upfront and select context with the suitable SM partition on kernel launch:  
如果在内核启动时创建了具有执行亲和性的上下文，用户会观察到由于上下文创建而导致的延迟和内存占用的突然增加。为了避免在内核启动时支付上下文创建的延迟以及内存使用量的突然增加，建议用户在启动时创建不同 SM 分区的上下文池，并在内核启动时选择合适的 SM 分区的上下文：
```shell
int device = 0;
cudaDeviceProp prop;
const Int CONTEXT_POOL_SIZE = 4;
CUcontext contextPool[CONTEXT_POOL_SIZE];
int smCounts[CONTEXT_POOL_SIZE];
cudaSetDevice(device);
cudaGetDeviceProperties(&prop, device);
smCounts[0] = 1; smCounts[1] = 2;
smCounts[3] = (prop. multiProcessorCount - 3) / 3;
smCounts[4] = (prop. multiProcessorCount - 3) / 3 * 2;
for (int i = 0; i < CONTEXT_POOL_SIZE; i++) {
   CUexecAffinityParam affinity;
   affinity.type = CU_EXEC_AFFINITY_TYPE_SM_COUNT;
   affinity.param.smCount.val = smCounts[i];
   cuCtxCreate_v3(&contextPool[i], affinity, 1, 0, deviceOrdinal);
}

for (int i = 0; i < CONTEXT_POOL_SIZE; i++) {
   std::thread([i]() {
      int numSms = 0;
      int numBlocksPerSm = 0;
      int numThreads = 128;
      CUexecAffinityParam affinity;
      cuCtxSetCurrent(contextPool[i]);
      cuCtxGetExecAffinity(&affinity, CU_EXEC_AFFINITY_TYPE_SM_COUNT);
      numSms = affinity.param.smCount.val;
      cudaOccupancyMaxActiveBlocksPerMultiprocessor(
         &numBlocksPerSm, kernel, numThreads, 0);
      void *kernelArgs[] = { /* add kernel args */ };

      dim3 dimBlock(numThreads, 1, 1);
      dim3 dimGrid(numSms * numBlocksPerSm, 1, 1);
      cudaLaunchCooperativeKernel((void*)my_kernel, dimGrid, dimBlock, kernelArgs);
   };
}
```


The hardware resources needed for client CUDA contexts is limited and support up to 48 client CUDA contexts per-device on Volta MPS. The size of the context pool per-device is limited by the number of CUDA client contexts supported per-device. The memory footprint of each client CUDA context and the value of `CUDA_DEVICE_MAX_CONNECTIONS` may further reduce the number of available clients. Therefore, CUDA client contexts with different SM partitions should be created judiciously.  
客户端 CUDA 上下文所需硬件资源有限，每个 Volta MPS 设备支持最多 48 个客户端 CUDA 上下文。每个设备的上下文池大小受限于设备支持的 CUDA 客户端上下文数量。客户端 CUDA 上下文的内存占用量以及 `CUDA_DEVICE_MAX_CONNECTIONS` 的值可能会进一步减少可用客户端的数量。因此，应合理创建具有不同 SM 分区的 CUDA 客户端上下文。

# 6. 通知

This document is provided for information purposes only and shall not be regarded as a warranty of a certain functionality, condition, or quality of a product. NVIDIA Corporation (“NVIDIA”) makes no representations or warranties, expressed or implied, as to the accuracy or completeness of the information contained in this document and assumes no responsibility for any errors contained herein. NVIDIA shall have no liability for the consequences or use of such information or for any infringement of patents or other rights of third parties that may result from its use. This document is not a commitment to develop, release, or deliver any Material (defined below), code, or functionality.  
本文件仅提供信息，不被视为对产品特定功能、状态或质量的保证。NVIDIA 公司（“NVIDIA”）不对本文件中包含的信息的准确性或完整性做出任何陈述或保证，也不对本文件中可能包含的任何错误负责。NVIDIA 不对使用此类信息的后果或使用结果，或由此导致的任何专利或其他第三方权利的侵犯负责。本文件不构成开发、发布或交付任何材料（定义如下）、代码或功能的承诺。

NVIDIA reserves the right to make corrections, modifications, enhancements, improvements, and any other changes to this document, at any time without notice.  
NVIDIA 保留随时在不通知的情况下对本文件进行修正、修改、增强、改进和其他任何更改的权利。

Customer should obtain the latest relevant information before placing orders and should verify that such information is current and complete.  
客户在下单前应获取最新相关资讯，并验证该资讯是否最新且完整。

NVIDIA products are sold subject to the NVIDIA standard terms and conditions of sale supplied at the time of order acknowledgement, unless otherwise agreed in an individual sales agreement signed by authorized representatives of NVIDIA and customer (“Terms of Sale”). NVIDIA hereby expressly objects to applying any customer general terms and conditions with regards to the purchase of the NVIDIA product referenced in this document. No contractual obligations are formed either directly or indirectly by this document.  
NVIDIA 产品销售基于订单确认时提供的 NVIDIA 标准销售条款和条件，除非在由 NVIDIA 和客户授权代表签署的个别销售协议中另有约定（“销售条款”）。NVIDIA 明确反对将任何客户通用条款应用于本文件中提及的 NVIDIA 产品购买。本文件直接或间接不形成任何合同义务。

NVIDIA products are not designed, authorized, or warranted to be suitable for use in medical, military, aircraft, space, or life support equipment, nor in applications where failure or malfunction of the NVIDIA product can reasonably be expected to result in personal injury, death, or property or environmental damage. NVIDIA accepts no liability for inclusion and/or use of NVIDIA products in such equipment or applications and therefore such inclusion and/or use is at customer’s own risk.  
NVIDIA 产品不设计、授权或保证适用于医疗、军事、航空、太空或生命支持设备，也不适用于预期可能导致人身伤害、死亡或财产或环境损害的应用。NVIDIA 不对将 NVIDIA 产品包含在或用于此类设备或应用承担责任，因此此类包含或使用由客户自行承担风险。

NVIDIA makes no representation or warranty that products based on this document will be suitable for any specified use. Testing of all parameters of each product is not necessarily performed by NVIDIA. It is customer’s sole responsibility to evaluate and determine the applicability of any information contained in this document, ensure the product is suitable and fit for the application planned by customer, and perform the necessary testing for the application in order to avoid a default of the application or the product. Weaknesses in customer’s product designs may affect the quality and reliability of the NVIDIA product and may result in additional or different conditions and/or requirements beyond those contained in this document. NVIDIA accepts no liability related to any default, damage, costs, or problem which may be based on or attributable to: (i) the use of the NVIDIA product in any manner that is contrary to this document or (ii) customer product designs.  
NVIDIA 不代表或保证基于此文档的产品适用于任何指定用途。NVIDIA 不一定对每个产品的所有参数进行测试。客户有责任评估并确定文档中包含的任何信息的适用性，确保产品适合客户计划的应用，并对应用进行必要的测试，以避免应用或产品的故障。客户产品设计中的弱点可能会影响 NVIDIA 产品的质量和可靠性，并可能导致本文档中未包含的其他条件和/或要求。NVIDIA 对于任何基于或归因于以下情况的故障、损害、成本或问题不承担任何责任：(i) 以与本文档相反的方式使用 NVIDIA 产品，或(ii) 客户产品设计。

No license, either expressed or implied, is granted under any NVIDIA patent right, copyright, or other NVIDIA intellectual property right under this document. Information published by NVIDIA regarding third-party products or services does not constitute a license from NVIDIA to use such products or services or a warranty or endorsement thereof. Use of such information may require a license from a third party under the patents or other intellectual property rights of the third party, or a license from NVIDIA under the patents or other intellectual property rights of NVIDIA.  
本文件中，NVIDIA 不授予任何专利权、版权或其他 NVIDIA 知识产权的许可。NVIDIA 发布的关于第三方产品或服务的信息不构成 NVIDIA 使用此类产品或服务的许可或对其的保证或认可。使用此类信息可能需要从第三方或 NVIDIA 获得专利或其他知识产权的许可。

Reproduction of information in this document is permissible only if approved in advance by NVIDIA in writing, reproduced without alteration and in full compliance with all applicable export laws and regulations, and accompanied by all associated conditions, limitations, and notices.  
此文档中的信息复制仅在事先获得 NVIDIA 书面批准后方可进行，复制时不得修改，并完全遵守所有适用的出口法律和规定，同时必须附带所有相关条件、限制和通知。

THIS DOCUMENT AND ALL NVIDIA DESIGN SPECIFICATIONS, REFERENCE BOARDS, FILES, DRAWINGS, DIAGNOSTICS, LISTS, AND OTHER DOCUMENTS (TOGETHER AND SEPARATELY, “MATERIALS”) ARE BEING PROVIDED “AS IS.” NVIDIA MAKES NO WARRANTIES, EXPRESSED, IMPLIED, STATUTORY, OR OTHERWISE WITH RESPECT TO THE MATERIALS, AND EXPRESSLY DISCLAIMS ALL IMPLIED WARRANTIES OF NONINFRINGEMENT, MERCHANTABILITY, AND FITNESS FOR A PARTICULAR PURPOSE. TO THE EXTENT NOT PROHIBITED BY LAW, IN NO EVENT WILL NVIDIA BE LIABLE FOR ANY DAMAGES, INCLUDING WITHOUT LIMITATION ANY DIRECT, INDIRECT, SPECIAL, INCIDENTAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES, HOWEVER CAUSED AND REGARDLESS OF THE THEORY OF LIABILITY, ARISING OUT OF ANY USE OF THIS DOCUMENT, EVEN IF NVIDIA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. Notwithstanding any damages that customer might incur for any reason whatsoever, NVIDIA’s aggregate and cumulative liability towards customer for the products described herein shall be limited in accordance with the Terms of Sale for the product.  
这份文件以及所有英伟达设计规范、参考电路板、文件、图纸、诊断工具、列表和其他文档（统称“材料”）均以“原样提供”。英伟达不对材料提供任何形式的保证，包括但不限于明示保证、暗示保证、法定保证或其他保证。英伟达明确否认所有暗示的保证，包括但不限于无侵权、适销性和特定用途适用性。除非法律禁止，否则对于因使用本文件而导致的任何损害，无论损害如何产生以及无论基于何种理论，英伟达均不承担任何责任，包括但不限于直接损害、间接损害、特殊损害、偶然损害、惩罚性损害或后果性损害。不考虑客户可能因任何原因遭受的任何损害，对于本文件中描述的产品，英伟达向客户承担的总和和累积责任应根据产品的销售条款进行限制。

## 6.1. 商标

NVIDIA and the NVIDIA logo are trademarks or registered trademarks of NVIDIA Corporation in the U.S. and other countries. Other company and product names may be trademarks of the respective companies with which they are associated.  
NVIDIA 和 NVIDIA 标志是美国及其它国家中 NVIDIA Corporation 的商标或注册商标。其它公司和产品的名称可能是与其关联的公司的商标。

---