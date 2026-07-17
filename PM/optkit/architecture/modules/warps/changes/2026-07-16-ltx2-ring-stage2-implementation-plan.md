# LTX2 Stage2 Ring + Ulysses 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改 V2 公共并行契约和算法的前提下，让 LTX2 Stage2 demo 支持纯 Ring 与 Ring + Ulysses 组合，并完成真实 5090 环境的数值、视频、音频和性能验收。

**执行状态（2026-07-17）：** Task 1–5 已完成；Task 6 的运行、性能、P2P、逐帧视频和组合拓扑音频数值门禁已完成，主观听音未验收。纯 Ring `u1/r2` 默认 FP8 音频 cosine 未过原门禁，因此 Task 7 不能按“全部硬门槛通过”完成，只更新为验证中状态。Task 3 的质量工具在代码审查中经过两轮数值稳定性加固，下文 Step 3 已同步为最终算法。

**Architecture:** 继续使用现有 `ParallelSpec(ulysses_degree, ring_degree)` 二维 mesh；LTX2 video self 由 Ulysses 外层 head all-to-all 与 Ring 内层 K/V rotation 自然组合，`v2a` 仍在完整 CP group 合并 partial out/LSE。新增代码仅限 Stage2 demo 的纯配置解析和验收工具；optkit 本体只更新过期注释与术语。

**Tech Stack:** Python 3、PyTorch Distributed/NCCL、diffusers `LTX2Pipeline`、OptKit V2、SageAttention、torchao FP8、torch.compile、NumPy、scikit-image。

**仓库根目录：**

- optkit：`/Users/chenzeyang/MTGIT/optkit-workspace/optkit`（分支 `v2`）
- TDD：`/Users/chenzeyang/MTGIT/optkit-workspace/TDD`（分支 `master`，无 remote）
- 项目记忆：`/Users/chenzeyang/zycode/zynode`（分支 `master`）

## Global Constraints

- 不新增 `attn_mode`、Context hook、`ParallelSpec` 字段，不修改 `HOOK_ORDER`。
- `attn1` 走 Ulysses 外层 + Ring 内层；`video_to_audio_attn` 不走 Ring，继续完整 CP group partial out/LSE merge。
- Stage2 使用所有 torchrun rank，必须满足 `ulysses_degree × ring_degree == world_size`。
- `OPTKIT_RING_DEGREE` 默认 `1`；`OPTKIT_ULYSSES_DEGREE` 未设置时按 `world_size // ring_degree` 推导；`OPTKIT_RING_ROTATE_METHOD` 默认 `p2p`。
- 真实推理固定 768×512、121 帧、24fps、30 steps、guidance 3.0、seed 0、金色时分森林河流 prompt。
- compile 测试必须 warmup + timed 两趟，性能只取 timed。
- transformer 不 offload；text encoder 使用 leaf-level group offload；禁止 `pipe.to("cuda")`。
- optkit、TDD 与项目记忆三个仓库均已有各自状态；每次只 stage 本任务明确列出的文件，不处理或提交其他脏文件、报告和媒体产物。
- 所有新增文档与代码注释使用中文；公共接口保持最小集合。
- 远端命令统一要求当前 shell 已设置 `LTX_HOST` 为有效 AIMaster SSH Host 别名；执行阶段通过 `aimaster-machine-control` / `ssh-session` 技能解析并验证该别名，不在代码中硬编码机器名。

---

### Task 1: 用 TDD 固化 Stage2 并行配置解析

**Files:**

- Create: `TDD/LTX/ltx2_stage2_config.py`
- Create: `TDD/LTX/ltx2_stage2_config_test.py`

**Interfaces:**

- Consumes: `world_size: int` 与只读环境变量映射 `Mapping[str, str]`。
- Produces: `resolve_stage2_parallel(world_size, environ) -> tuple[int, int, str]`，依次返回 `(ulysses_degree, ring_degree, ring_rotate_method)`。

- [x] **Step 1: 先写失败单测**

创建 `TDD/LTX/ltx2_stage2_config_test.py`：

```python
import unittest

from ltx2_stage2_config import resolve_stage2_parallel


class ResolveStage2ParallelTest(unittest.TestCase):
    def test_default_preserves_ulysses_only(self):
        self.assertEqual(resolve_stage2_parallel(4, {}), (4, 1, "p2p"))

    def test_ring_degree_infers_ulysses_degree(self):
        env = {"OPTKIT_RING_DEGREE": "2"}
        self.assertEqual(resolve_stage2_parallel(4, env), (2, 2, "p2p"))

    def test_explicit_degrees_and_allgather(self):
        env = {
            "OPTKIT_ULYSSES_DEGREE": "1",
            "OPTKIT_RING_DEGREE": "4",
            "OPTKIT_RING_ROTATE_METHOD": "allgather",
        }
        self.assertEqual(resolve_stage2_parallel(4, env), (1, 4, "allgather"))

    def test_rejects_invalid_values(self):
        cases = [
            (0, {}, "world_size 必须为正整数"),
            (4, {"OPTKIT_RING_DEGREE": "0"}, "OPTKIT_RING_DEGREE 必须为正整数"),
            (4, {"OPTKIT_RING_DEGREE": "3"}, "world_size=4 不能被 ring_degree=3 整除"),
            (
                4,
                {"OPTKIT_RING_DEGREE": "2", "OPTKIT_ULYSSES_DEGREE": "1"},
                "ulysses_degree × ring_degree 必须等于 world_size",
            ),
            (
                4,
                {"OPTKIT_RING_ROTATE_METHOD": "broadcast"},
                "OPTKIT_RING_ROTATE_METHOD 只支持 p2p 或 allgather",
            ),
        ]
        for world_size, env, message in cases:
            with self.subTest(world_size=world_size, env=env):
                with self.assertRaisesRegex(ValueError, message):
                    resolve_stage2_parallel(world_size, env)


if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 2: 运行测试并确认按预期失败**

Run:

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX
python3 ltx2_stage2_config_test.py
```

Expected: `ModuleNotFoundError: No module named 'ltx2_stage2_config'`。

- [x] **Step 3: 写最小配置解析实现**

创建 `TDD/LTX/ltx2_stage2_config.py`：

```python
from __future__ import annotations

import os
from collections.abc import Mapping


def _positive_int(name: str, raw: str | int) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} 必须为正整数，当前值={raw!r}") from exc
    if value <= 0:
        raise ValueError(f"{name} 必须为正整数，当前值={value}")
    return value


def resolve_stage2_parallel(
    world_size: int,
    environ: Mapping[str, str] | None = None,
) -> tuple[int, int, str]:
    """解析 Stage2 使用全部 torchrun rank 的 Ring/Ulysses 配置。"""
    world_size = _positive_int("world_size", world_size)
    env = os.environ if environ is None else environ

    ring_degree = _positive_int(
        "OPTKIT_RING_DEGREE", env.get("OPTKIT_RING_DEGREE", "1")
    )
    if world_size % ring_degree != 0:
        raise ValueError(
            f"world_size={world_size} 不能被 ring_degree={ring_degree} 整除"
        )

    raw_ulysses = env.get("OPTKIT_ULYSSES_DEGREE")
    ulysses_degree = (
        world_size // ring_degree
        if raw_ulysses is None
        else _positive_int("OPTKIT_ULYSSES_DEGREE", raw_ulysses)
    )
    if ulysses_degree * ring_degree != world_size:
        raise ValueError(
            "ulysses_degree × ring_degree 必须等于 world_size："
            f"{ulysses_degree} × {ring_degree} != {world_size}"
        )

    rotate_method = env.get("OPTKIT_RING_ROTATE_METHOD", "p2p").strip().lower()
    if rotate_method not in ("p2p", "allgather"):
        raise ValueError(
            "OPTKIT_RING_ROTATE_METHOD 只支持 p2p 或 allgather，"
            f"当前值={rotate_method!r}"
        )
    return ulysses_degree, ring_degree, rotate_method
```

- [x] **Step 4: 运行测试并确认通过**

Run: `python3 ltx2_stage2_config_test.py`

Expected: `Ran 4 tests` 与 `OK`。

- [x] **Step 5: 只提交配置 helper 与单测**

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD
git add LTX/ltx2_stage2_config.py LTX/ltx2_stage2_config_test.py
git commit -m "test(ltx2): 固化 Stage2 Ring 与 Ulysses 配置" -m "AI-Co-Authored-By: Codex"
```

Expected: 提交只含上述两个文件；`LTX/env.sh`、输出视频、图片和其他未跟踪脚本不进入提交。

---

### Task 2: 把 Ring/Ulysses degree 接入 Stage2 demo

**Files:**

- Modify: `TDD/LTX/ltx2.3_demo_opt_stage2.py:15-67`
- Test: `TDD/LTX/ltx2_stage2_config_test.py`

**Interfaces:**

- Consumes: Task 1 的 `resolve_stage2_parallel`。
- Produces: 向现有 `ParallelSpec` 传入解析后的 `ulysses_degree`、`ring_degree`、`ring_rotate_method`；不新增 OptKit API。

- [x] **Step 1: 先把 demo 集成要求写入现有单测**

在 `ltx2_stage2_config_test.py` 增加默认单卡用例：

```python
    def test_single_rank_is_identity_parallel(self):
        self.assertEqual(resolve_stage2_parallel(1, {}), (1, 1, "p2p"))
```

- [x] **Step 2: 运行单测确认新增要求成立，并记录 demo 仍未消费 helper**

Run:

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX
python3 ltx2_stage2_config_test.py
rg -n "resolve_stage2_parallel|OPTKIT_RING_DEGREE" ltx2.3_demo_opt_stage2.py
```

Expected: 单测通过；`rg` 无输出且退出码为 1，证明 demo 尚未接入 Ring 配置。

- [x] **Step 3: 修改 Stage2 demo 的 import、初始化和配置装配**

在 OptKit import 后增加：

```python
from ltx2_stage2_config import resolve_stage2_parallel
```

把分布式初始化段改为：

```python
# ── torchrun 分布式初始化：每进程一卡，Ring/Ulysses 可独立配置并组合 ──
rank = int(os.environ.get("RANK", "0"))
world_size = int(os.environ.get("WORLD_SIZE", "1"))
local_rank = int(os.environ.get("LOCAL_RANK", "0"))
ulysses_degree, ring_degree, ring_rotate_method = resolve_stage2_parallel(world_size)
if world_size > 1 and not dist.is_initialized():
    dist.init_process_group(backend="nccl")
torch.cuda.set_device(local_rank)
device = torch.device(f"cuda:{local_rank}")
```

把 `cfg` 前的过期说明与 `ParallelSpec` 装配改为：

```python
# optkit_v2: Ring/Ulysses + sage + fp8 + compile。只切 video 序列，audio/text
# 全卡复制；video self 走 Ulysses 外层 + Ring 内层；v2a 在完整 CP group 上
# 合并 partial out/LSE，不 gather 长 video K/V，也不被 Ring 二次包装。
parallel = (
    ParallelSpec(
        enabled=True,
        ulysses_degree=ulysses_degree,
        ring_degree=ring_degree,
        ring_rotate_method=ring_rotate_method,
    )
    if world_size > 1
    else None
)
cfg = OptKitConfig(
    parallel=parallel,
    sage=SageSpec(enabled=True) if ENABLE_SAGE else None,
    quant=(
        QuantSpec(
            enabled=True,
            dtype=os.environ.get("OPTKIT_FP8_DTYPE", "float8"),
            auto_skip=True,
        )
        if ENABLE_FP8
        else None
    ),
    compile=CompileSpec(enabled=True) if ENABLE_COMPILE else None,
    rank=rank,
    world_size=world_size,
    device=str(device),
)
apply_warp(pipe, cfg)
_log(
    "warp applied | "
    f"ulysses={ulysses_degree} ring={ring_degree} "
    f"rotate_method={ring_rotate_method} "
    f"sage={ENABLE_SAGE} fp8={ENABLE_FP8} compile={ENABLE_COMPILE}"
)
```

- [x] **Step 4: 运行本地静态验证**

Run:

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX
python3 ltx2_stage2_config_test.py
python3 -m py_compile ltx2_stage2_config.py ltx2.3_demo_opt_stage2.py
rg -n "ulysses=.*ring=.*rotate_method" ltx2.3_demo_opt_stage2.py
```

Expected: 单测 `Ran 5 tests ... OK`；py_compile 成功；`rg` 命中新的统一日志。

- [x] **Step 5: 只提交 Stage2 demo 与新增的单卡测试**

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD
git add LTX/ltx2.3_demo_opt_stage2.py LTX/ltx2_stage2_config_test.py
git commit -m "feat(ltx2): Stage2 支持 Ring 与 Ulysses 组合" -m "AI-Co-Authored-By: Codex"
```

Expected: 不 stage `output*.mp4`、frame 图片、`env.sh`、`sample.txt` 或其他现有脏文件。

---

### Task 3: 用 TDD 增加 video SSIM 与 audio cosine 验收工具

**Files:**

- Create: `TDD/LTX/ltx2_compare_dumps.py`
- Create: `TDD/LTX/ltx2_compare_dumps_test.py`

**Interfaces:**

- Consumes: Stage2 现有 `OPTKIT_DUMP=<prefix>` 生成的 `<prefix>_video.npy` 与 `<prefix>_audio.npy`。
- Produces: `compare_dumps(reference_prefix, candidate_prefix) -> dict[str, float]`；`validate_matrix(reference_prefix, control_prefix, candidates) -> dict`。

- [x] **Step 1: 先写失败单测**

创建 `TDD/LTX/ltx2_compare_dumps_test.py`：

```python
import tempfile
import unittest
from pathlib import Path

import numpy as np

from ltx2_compare_dumps import compare_dumps, validate_matrix


def _save(prefix: Path, video: np.ndarray, audio: np.ndarray) -> None:
    np.save(f"{prefix}_video.npy", video)
    np.save(f"{prefix}_audio.npy", audio)


class CompareDumpsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        rng = np.random.default_rng(7)
        self.video = rng.random((2, 8, 8, 3), dtype=np.float32)
        self.audio = rng.standard_normal(64).astype(np.float32)
        self.ref = root / "ref"
        self.control = root / "control"
        self.good = root / "good"
        self.bad = root / "bad"
        _save(self.ref, self.video, self.audio)
        _save(self.control, self.video.copy(), self.audio.copy())
        _save(self.good, self.video + 1e-4, self.audio.copy())
        _save(self.bad, np.zeros_like(self.video), -self.audio)

    def tearDown(self):
        self.tmp.cleanup()

    def test_identical_dumps_score_one(self):
        metrics = compare_dumps(str(self.ref), str(self.control))
        self.assertAlmostEqual(metrics["video_ssim"], 1.0, places=7)
        self.assertAlmostEqual(metrics["audio_cosine"], 1.0, places=7)

    def test_good_candidate_passes_relative_gate(self):
        report = validate_matrix(
            str(self.ref), str(self.control), [("good", str(self.good))]
        )
        self.assertIn("good", report["candidates"])

    def test_bad_candidate_fails_relative_gate(self):
        with self.assertRaisesRegex(AssertionError, "video_ssim"):
            validate_matrix(
                str(self.ref), str(self.control), [("bad", str(self.bad))]
            )


if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 2: 运行测试并确认按预期失败**

Run: `python3 ltx2_compare_dumps_test.py`

Expected: `ModuleNotFoundError: No module named 'ltx2_compare_dumps'`。

- [x] **Step 3: 写最小验收实现**

创建 `TDD/LTX/ltx2_compare_dumps.py`：

```python
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from skimage.metrics import structural_similarity


def _load(prefix: str, kind: str) -> np.ndarray:
    path = Path(f"{prefix}_{kind}.npy")
    value = np.load(path)
    if value.size == 0:
        raise ValueError(f"{path} 不能为空")
    if not np.isfinite(value).all():
        raise ValueError(f"{path} 包含 NaN/Inf")
    return value


def _video_ssim_parameters(reference: np.ndarray) -> tuple[float, float]:
    ref = reference.astype(np.float64, copy=False)
    ref_min = float(ref.min())
    ref_max = float(ref.max())
    span = ref_max - ref_min
    scale = max(abs(ref_min), abs(ref_max), 1.0)
    if not np.isfinite(scale) or scale <= 0:
        raise ValueError("video reference scale 非有限或非正")
    data_range = max(span, np.finfo(np.float64).eps * scale)
    if not np.isfinite(data_range):
        raise ValueError("video reference data_range 非有限")
    return data_range, scale


def _video_ssim(
    reference: np.ndarray,
    candidate: np.ndarray,
    data_range: float,
    scale: float,
) -> tuple[float, np.ndarray]:
    if reference.shape != candidate.shape:
        raise ValueError(
            f"video shape 不一致: {reference.shape} != {candidate.shape}"
        )
    if reference.ndim != 4 or reference.shape[-1] not in (1, 3, 4):
        raise ValueError(
            "video dump 必须是 [frames, height, width, channels]，"
            f"当前 shape={reference.shape}"
        )
    ref = reference.astype(np.float64, copy=False) / scale
    cand = candidate.astype(np.float64, copy=False) / scale
    scaled_data_range = data_range / scale
    if not np.isfinite(ref).all() or not np.isfinite(cand).all():
        raise ValueError("video 缩放后包含 NaN/Inf")
    if not np.isfinite(scaled_data_range) or scaled_data_range <= 0:
        raise ValueError("video 缩放后 data_range 非有限或非正")
    scores = []
    for frame_index, (ref_frame, cand_frame) in enumerate(zip(ref, cand)):
        score = float(
            structural_similarity(
                ref_frame,
                cand_frame,
                channel_axis=-1,
                data_range=scaled_data_range,
            )
        )
        if not np.isfinite(score):
            raise ValueError(f"video 第 {frame_index} 帧 SSIM 非有限")
        scores.append(score)
    mean_score = float(np.mean(scores))
    if not np.isfinite(mean_score):
        raise ValueError("video 平均 SSIM 非有限")
    return mean_score, np.asarray(scores, dtype=np.float64)


def _audio_cosine(reference: np.ndarray, candidate: np.ndarray) -> float:
    if reference.shape != candidate.shape:
        raise ValueError(
            f"audio shape 不一致: {reference.shape} != {candidate.shape}"
        )
    ref = reference.astype(np.float64, copy=False).reshape(-1)
    cand = candidate.astype(np.float64, copy=False).reshape(-1)
    if not np.isfinite(ref).all() or not np.isfinite(cand).all():
        raise ValueError("audio 转为 float64 后包含 NaN/Inf")

    ref_scale = float(np.max(np.abs(ref)))
    cand_scale = float(np.max(np.abs(cand)))
    if ref_scale == 0 or cand_scale == 0:
        return 1.0 if ref_scale == cand_scale else 0.0

    ref_scaled = ref / ref_scale
    cand_scaled = cand / cand_scale
    ref_norm = float(np.linalg.norm(ref_scaled))
    cand_norm = float(np.linalg.norm(cand_scaled))
    score = float(np.dot(ref_scaled / ref_norm, cand_scaled / cand_norm))
    if not np.isfinite(score):
        raise ValueError("audio cosine 非有限")
    return float(np.clip(score, -1.0, 1.0))


def _compare_candidate(
    ref_video: np.ndarray,
    ref_audio: np.ndarray,
    candidate_prefix: str,
    video_data_range: float,
    video_scale: float,
) -> tuple[dict[str, float], np.ndarray]:
    cand_video = _load(candidate_prefix, "video")
    cand_audio = _load(candidate_prefix, "audio")
    video_ssim, video_frame_ssim = _video_ssim(
        ref_video,
        cand_video,
        video_data_range,
        video_scale,
    )
    return {
        "video_ssim": video_ssim,
        "audio_cosine": _audio_cosine(ref_audio, cand_audio),
    }, video_frame_ssim


def compare_dumps(reference_prefix: str, candidate_prefix: str) -> dict[str, float]:
    ref_video = _load(reference_prefix, "video")
    ref_audio = _load(reference_prefix, "audio")
    video_data_range, video_scale = _video_ssim_parameters(ref_video)
    metrics, _ = _compare_candidate(
        ref_video,
        ref_audio,
        candidate_prefix,
        video_data_range,
        video_scale,
    )
    return metrics


def validate_matrix(
    reference_prefix: str,
    control_prefix: str,
    candidates: list[tuple[str, str]],
) -> dict:
    ref_video = _load(reference_prefix, "video")
    ref_audio = _load(reference_prefix, "audio")
    video_data_range, video_scale = _video_ssim_parameters(ref_video)
    control, control_frame_ssim = _compare_candidate(
        ref_video,
        ref_audio,
        control_prefix,
        video_data_range,
        video_scale,
    )
    report = {"control": control, "candidates": {}}
    failures = []
    for name, prefix in candidates:
        metrics, candidate_frame_ssim = _compare_candidate(
            ref_video,
            ref_audio,
            prefix,
            video_data_range,
            video_scale,
        )
        frame_delta = candidate_frame_ssim - control_frame_ssim
        failed_frames = np.flatnonzero(frame_delta < -0.02)
        worst_frame = int(np.argmin(frame_delta))
        metrics.update(
            {
                "video_ssim_min_delta": float(frame_delta[worst_frame]),
                "video_ssim_worst_frame": worst_frame,
                "video_ssim_failed_frames": int(failed_frames.size),
            }
        )
        report["candidates"][name] = metrics
        if failed_frames.size:
            first_frame = int(failed_frames[0])
            failures.append(
                f"{name}.video_frame[{first_frame}]_ssim="
                f"{candidate_frame_ssim[first_frame]:.6f} < control_frame-0.02="
                f"{control_frame_ssim[first_frame] - 0.02:.6f} "
                f"(failed_frames={failed_frames.size}, worst_frame={worst_frame}, "
                f"min_delta={frame_delta[worst_frame]:.6f})"
            )
        if metrics["audio_cosine"] < control["audio_cosine"] - 1e-3:
            failures.append(
                f"{name}.audio_cosine={metrics['audio_cosine']:.6f} < "
                f"control-1e-3={control['audio_cosine'] - 1e-3:.6f}"
            )
    if failures:
        raise AssertionError("；".join(failures))
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", required=True)
    parser.add_argument("--control", required=True)
    parser.add_argument(
        "--candidate",
        nargs=2,
        action="append",
        metavar=("NAME", "PREFIX"),
        required=True,
    )
    args = parser.parse_args()
    report = validate_matrix(args.reference, args.control, args.candidate)
    print(
        json.dumps(
            report,
            allow_nan=False,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
```

- [x] **Step 4: 运行单测并确认通过**

Run:

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX
python3 ltx2_compare_dumps_test.py
python3 -m py_compile ltx2_compare_dumps.py ltx2_compare_dumps_test.py
```

Expected: 最终加固套件 `Ran 13 tests` 与 `OK`；py_compile 成功。除基础通过/失败用例外，还覆盖空数组、shape 不一致、NaN/Inf、静音边界、极大有限音频、高幅值常量视频、候选极值不能扩大 reference data range、单个坏帧不能被其余帧均值掩盖，以及 JSON 禁止输出非有限数值。

- [x] **Step 5: 只提交验收工具与单测**

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD
git add LTX/ltx2_compare_dumps.py LTX/ltx2_compare_dumps_test.py
git commit -m "test(ltx2): 增加双流并行质量门禁" -m "AI-Co-Authored-By: Codex"
```

---

### Task 4: 对齐 OptKit V2 的 Ring + Ulysses 术语与 LTX2 注释

**Files:**

- Modify: `optkit_v2/components/parallel/__init__.py:1-5`
- Modify: `optkit_v2/components/parallel/component.py:1-25`
- Modify: `optkit_v2/components/parallel/cp_wrappers.py:1-18`
- Modify: `optkit_v2/components/parallel/sequence_dispatcher.py:1-19`
- Modify: `optkit_v2/components/parallel/transformers/ulysses.py:1-14`
- Modify: `optkit_v2/warps/transformers/transformer_ltx2.py:27-46,132-137`
- Modify: `optkit_v2/warps/pipelines/pipeline_ltx2.py:1-7`

**Interfaces:**

- Consumes: 已确认设计中的术语与六路 attention 数据流。
- Produces: 仅注释/文档字符串变化；运行时代码、导入、函数签名与 hook 均不变。

- [x] **Step 1: 记录当前失败的术语扫描**

Run:

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/optkit
rg -n "USP|usp" \
  optkit_v2/components/parallel \
  optkit_v2/warps/transformers/transformer_ltx2.py \
  optkit_v2/warps/pipelines/pipeline_ltx2.py
```

Expected: 命中 `component.py`、`cp_wrappers.py`、`sequence_dispatcher.py`、`ulysses.py`、parallel `__init__.py` 和 LTX2 warp 的旧术语。

- [x] **Step 2: 做最小术语替换**

逐文件使用以下准确表述，不改可执行语句：

```text
USP / usp
→ Ring + Ulysses 组合 / 上游组合分支

“三种模式”
→ “纯 Ring、纯 Ulysses 或二者组合”

“USP 路径需真机 2×2 验证”
→ “Ring + Ulysses 组合已通过 attention 级 u2/r2 验证，仍需 LTX2 真实权重验证”

LTX2 “CP 并行（阶段 2, Ulysses）”
→ “CP 并行（阶段 2, Ring + Ulysses）”

LTX2 “attn1=self_video 走 Ulysses”
→ “attn1=self_video 走 Ulysses 外层 + Ring 内层（按各自 degree 启用）”

LTX2 out-of-scope “Ring / USP”
→ 删除该项；保留 STG、IC-LoRA self mask、MagCache 三项
```

`pipeline_ltx2.py` 的阶段说明改为“sage/fp8/compile/Ring/Ulysses 都在 transformer 内完成”。

- [x] **Step 3: 运行静态回归**

Run:

```bash
python3 -m py_compile \
  optkit_v2/components/parallel/__init__.py \
  optkit_v2/components/parallel/component.py \
  optkit_v2/components/parallel/cp_wrappers.py \
  optkit_v2/components/parallel/sequence_dispatcher.py \
  optkit_v2/components/parallel/transformers/ulysses.py \
  optkit_v2/warps/transformers/transformer_ltx2.py \
  optkit_v2/warps/pipelines/pipeline_ltx2.py
rg -n "USP|usp" \
  optkit_v2/components/parallel \
  optkit_v2/warps/transformers/transformer_ltx2.py \
  optkit_v2/warps/pipelines/pipeline_ltx2.py
git diff --check -- \
  optkit_v2/components/parallel \
  optkit_v2/warps/transformers/transformer_ltx2.py \
  optkit_v2/warps/pipelines/pipeline_ltx2.py
```

Expected: py_compile 成功；`rg` 无输出且退出码为 1；`git diff --check` 无输出。

- [x] **Step 4: 确认没有误改公共契约**

Run:

```bash
git diff --word-diff=porcelain -- \
  optkit_v2/components/parallel \
  optkit_v2/warps/transformers/transformer_ltx2.py \
  optkit_v2/warps/pipelines/pipeline_ltx2.py
```

Expected: 仅注释和 docstring 变化；`ParallelSpec`、`HOOK_ORDER`、`_dispatch_decorate`、`_ATTN_ROLES` 与 processor 分支无变化。

- [x] **Step 5: 只提交本任务的 OptKit 文件**

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/optkit
git add \
  optkit_v2/components/parallel/__init__.py \
  optkit_v2/components/parallel/component.py \
  optkit_v2/components/parallel/cp_wrappers.py \
  optkit_v2/components/parallel/sequence_dispatcher.py \
  optkit_v2/components/parallel/transformers/ulysses.py \
  optkit_v2/warps/transformers/transformer_ltx2.py \
  optkit_v2/warps/pipelines/pipeline_ltx2.py
git commit -m "docs(optkit_v2): 对齐 Ring 与 Ulysses 组合语义" -m "AI-Co-Authored-By: Codex"
```

Expected: 不 stage `CLAUDE.md`、`optkit/components/lora_replace/`、`optkit_v2/core/order.py`、Flux 报告或其他现有脏文件。

---

### Task 5: 同步远端并验证配置与启动前门禁

**Files:**

- Deploy: 本地 `optkit_v2/` → 远端 `/app/czy5/ltxrun/optkit_v2/`
- Deploy: `TDD/LTX/ltx2.3_demo_opt_stage2.py`、`ltx2_stage2_config.py`、`ltx2_stage2_config_test.py` → 远端 `/app/TDD/LTX/`

**Interfaces:**

- Consumes: Task 1–4 的本地提交；有效 SSH 环境变量 `LTX_HOST`。
- Produces: 远端使用当前本地 OptKit V2 与 Stage2 demo；错误 degree 在加载模型前失败。

- [x] **Step 1: 检查本地提交边界和远端连通性**

Run:

```bash
git -C /Users/chenzeyang/MTGIT/optkit-workspace/optkit status --short --branch
git -C /Users/chenzeyang/MTGIT/optkit-workspace/TDD status --short --branch
test -n "$LTX_HOST"
ssh "$LTX_HOST" "nvidia-smi --query-gpu=index,name,memory.total --format=csv,noheader"
```

Expected: optkit 为 `v2`；TDD 为 `master`；SSH 返回至少 4 张可用 GPU。现有无关脏文件可以存在，但不得混入本任务提交。

- [x] **Step 2: 同步 OptKit V2 和 Stage2 文件**

Run:

```bash
scp -r \
  /Users/chenzeyang/MTGIT/optkit-workspace/optkit/optkit_v2 \
  "$LTX_HOST:/app/czy5/ltxrun/"
scp \
  /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX/ltx2.3_demo_opt_stage2.py \
  /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX/ltx2_stage2_config.py \
  /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX/ltx2_stage2_config_test.py \
  "$LTX_HOST:/app/TDD/LTX/"
```

Expected: scp 成功，远端 `PYTHONPATH=/app/czy5/ltxrun` 能 import 当前 `optkit_v2`。

- [x] **Step 3: 运行远端纯配置单测**

Run:

```bash
ssh "$LTX_HOST" "cd /app/TDD/LTX && PYTHONPATH=/app/czy5/ltxrun python3 ltx2_stage2_config_test.py"
```

Expected: `Ran 5 tests` 与 `OK`。

- [x] **Step 4: 验证错误配置在加载模型前失败**

Run:

```bash
ssh "$LTX_HOST" "cd /app/TDD/LTX && WORLD_SIZE=4 OPTKIT_RING_DEGREE=3 PYTHONPATH=/app/czy5/ltxrun python3 ltx2.3_demo_opt_stage2.py"
```

Expected: 在 `LTX2Pipeline.from_pretrained` 之前抛出 `ValueError: world_size=4 不能被 ring_degree=3 整除`，无 GPU 模型加载日志。

---

### Task 6: 远端完成正确性、质量和性能矩阵

**Files:**

- Run: `/app/TDD/LTX/ltx2.3_demo_opt_stage2.py`
- Generate remote evidence: `/tmp/ltx_{single,u2r1,u1r2,u2r2}_{video,audio}.npy`
- Generate local evidence: `TDD/LTX/ltx_{single,u2r1,u1r2,u2r2}.mp4` 与日志

**Interfaces:**

- Consumes: Stage2 新环境变量、现有 `OPTKIT_DUMP`、固定 seed/参数。
- Produces: 单卡参考、Ulysses 控制组、纯 Ring、Ring + Ulysses 四组数组与三组 production timed 数据。

**执行修订：** 原计划先以 compile=0 生成四组正确性数组，但单卡在第一个 denoise step 的 FP8 activation quantization 处因 32 GB 显存容量边界 OOM。只把 compile 改为 1 后单卡成功，故 controller 决定四组统一使用 `OPTKIT_COMPILE=1`，每组只跑一套 warmup + timed，并同时 dump/save；性能取第二趟。下列 compile=0 命令保留为原始计划记录，不再代表最终执行命令。最终矩阵与质量结论见变更设计 §11 和 Task 6 证据报告。

- [x] **Step 1: 跑 compile 关闭的单卡参考**

Run:

```bash
ssh "$LTX_HOST" "bash -lc 'cd /app/TDD/LTX; if [ -f /app/czy5/restore_env.sh ]; then source /app/czy5/restore_env.sh; fi; export PYTHONPATH=/app/czy5/ltxrun; OPTKIT_SAGE=1 OPTKIT_FP8=1 OPTKIT_COMPILE=0 OPTKIT_DUMP=/tmp/ltx_single python3 ltx2.3_demo_opt_stage2.py > /tmp/ltx_single.log 2>&1; cp output_opt_stage2.mp4 /tmp/ltx_single.mp4'"
```

Expected: `/tmp/ltx_single_{video,audio}.npy`、`/tmp/ltx_single.mp4`、`/tmp/ltx_single.log` 存在；日志为 `ulysses=1 ring=1`。

- [x] **Step 2: 跑 2 卡 Ulysses 控制组 `u2/r1`**

Run:

```bash
ssh "$LTX_HOST" "bash -lc 'cd /app/TDD/LTX; if [ -f /app/czy5/restore_env.sh ]; then source /app/czy5/restore_env.sh; fi; export PYTHONPATH=/app/czy5/ltxrun; OPTKIT_SAGE=1 OPTKIT_FP8=1 OPTKIT_COMPILE=0 OPTKIT_ULYSSES_DEGREE=2 OPTKIT_RING_DEGREE=1 OPTKIT_DUMP=/tmp/ltx_u2r1 torchrun --nproc_per_node=2 ltx2.3_demo_opt_stage2.py > /tmp/ltx_u2r1.log 2>&1; cp output_opt_stage2.mp4 /tmp/ltx_u2r1.mp4'"
```

Expected: rank0 日志为 `ulysses=2 ring=1 rotate_method=p2p`；输出齐全。

- [x] **Step 3: 跑 2 卡纯 Ring `u1/r2`**

Run:

```bash
ssh "$LTX_HOST" "bash -lc 'cd /app/TDD/LTX; if [ -f /app/czy5/restore_env.sh ]; then source /app/czy5/restore_env.sh; fi; export PYTHONPATH=/app/czy5/ltxrun; OPTKIT_SAGE=1 OPTKIT_FP8=1 OPTKIT_COMPILE=0 OPTKIT_RING_DEGREE=2 OPTKIT_RING_ROTATE_METHOD=p2p OPTKIT_DUMP=/tmp/ltx_u1r2 torchrun --nproc_per_node=2 ltx2.3_demo_opt_stage2.py > /tmp/ltx_u1r2.log 2>&1; cp output_opt_stage2.mp4 /tmp/ltx_u1r2.mp4'"
```

Expected: rank0 日志为 `ulysses=1 ring=2 rotate_method=p2p`；无 NCCL hang；输出齐全。

- [x] **Step 4: 跑 4 卡 Ring + Ulysses `u2/r2`**

Run:

```bash
ssh "$LTX_HOST" "bash -lc 'cd /app/TDD/LTX; if [ -f /app/czy5/restore_env.sh ]; then source /app/czy5/restore_env.sh; fi; export PYTHONPATH=/app/czy5/ltxrun; OPTKIT_SAGE=1 OPTKIT_FP8=1 OPTKIT_COMPILE=0 OPTKIT_RING_DEGREE=2 OPTKIT_RING_ROTATE_METHOD=p2p OPTKIT_DUMP=/tmp/ltx_u2r2 torchrun --nproc_per_node=4 ltx2.3_demo_opt_stage2.py > /tmp/ltx_u2r2.log 2>&1; cp output_opt_stage2.mp4 /tmp/ltx_u2r2.mp4'"
```

Expected: rank0 日志为 `ulysses=2 ring=2 rotate_method=p2p`；四 rank 正常退出；输出齐全。

- [x] **Step 5: 统一检查日志中的失败信号**

Run:

```bash
ssh "$LTX_HOST" "grep -E 'warp applied|timed|saved|dumped|Traceback|NCCL|NaN|Inf' /tmp/ltx_single.log /tmp/ltx_u2r1.log /tmp/ltx_u1r2.log /tmp/ltx_u2r2.log"
```

Expected: 每组都有 `warp applied`、`timed`、`saved`、`dumped`；无 `Traceback`、NCCL error、NaN 或 Inf。

如果 `p2p` 路径失败，使用相同命令仅把 `OPTKIT_RING_ROTATE_METHOD=p2p` 改为 `allgather` 交叉验证。`allgather` 通过只能证明 attention 数学路径正常，不能替代默认 `p2p` 验收；此时停止完成流程，按 `superpowers:systematic-debugging` 定位 P2P transport。

- [x] **Step 6: 打包并回传数组、MP4 和日志**

Run:

```bash
ssh "$LTX_HOST" "tar -C /tmp -cf /tmp/ltx_ring_validation.tar ltx_single_video.npy ltx_single_audio.npy ltx_single.mp4 ltx_single.log ltx_u2r1_video.npy ltx_u2r1_audio.npy ltx_u2r1.mp4 ltx_u2r1.log ltx_u1r2_video.npy ltx_u1r2_audio.npy ltx_u1r2.mp4 ltx_u1r2.log ltx_u2r2_video.npy ltx_u2r2_audio.npy ltx_u2r2.mp4 ltx_u2r2.log"
scp "$LTX_HOST:/tmp/ltx_ring_validation.tar" /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX/
tar -xf /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX/ltx_ring_validation.tar -C /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX/
```

Expected: 本地四组 npy、MP4、日志齐全。`ltx_ring_validation.tar` 和运行产物作为验收证据保留在 TDD 工作区，不进入 git 提交。

- [ ] **Step 7: 运行视频/音频质量门禁**

Run:

```bash
cd /Users/chenzeyang/MTGIT/optkit-workspace/TDD/LTX
python3 ltx2_compare_dumps.py \
  --reference ltx_single \
  --control ltx_u2r1 \
  --candidate u1r2 ltx_u1r2 \
  --candidate u2r2 ltx_u2r2
```

Expected: 输出 JSON；`u1r2`、`u2r2` 的 video SSIM 均不低于控制组减 `0.02`，audio cosine 均不低于控制组减 `1e-3`；进程退出码 0。随后逐个播放四个 MP4，确认无花屏、爆音、中断或音画错位。

**实际结果：** 官方命令退出码 1；逐帧视频两组均通过，失败帧数都为 0（`u1/r2` 最小同帧差值 `+0.014905`，`u2/r2` 为 `+0.006138`）；`u2/r2` 音频数值门禁通过，只有 `u1/r2.audio_cosine=0.792696 < 0.804666`。中帧目视无花屏；音频完成数组级 shape/finite/逐声道 cosine/RMS/RMSE 检查，但没有主观听音。该失败触发 Task 7 的条件分支：记录 verifying 状态与风险，不标记 done，不放宽阈值。

- [x] **Step 8: 开 compile 跑三种多卡 production 配置**

依次运行以下三个命令：

```bash
ssh "$LTX_HOST" "bash -lc 'cd /app/TDD/LTX; if [ -f /app/czy5/restore_env.sh ]; then source /app/czy5/restore_env.sh; fi; export PYTHONPATH=/app/czy5/ltxrun; OPTKIT_SAGE=1 OPTKIT_FP8=1 OPTKIT_COMPILE=1 OPTKIT_ULYSSES_DEGREE=2 OPTKIT_RING_DEGREE=1 torchrun --nproc_per_node=2 ltx2.3_demo_opt_stage2.py > /tmp/ltx_u2r1_compile.log 2>&1'"
ssh "$LTX_HOST" "bash -lc 'cd /app/TDD/LTX; if [ -f /app/czy5/restore_env.sh ]; then source /app/czy5/restore_env.sh; fi; export PYTHONPATH=/app/czy5/ltxrun; OPTKIT_SAGE=1 OPTKIT_FP8=1 OPTKIT_COMPILE=1 OPTKIT_RING_DEGREE=2 OPTKIT_RING_ROTATE_METHOD=p2p torchrun --nproc_per_node=2 ltx2.3_demo_opt_stage2.py > /tmp/ltx_u1r2_compile.log 2>&1'"
ssh "$LTX_HOST" "bash -lc 'cd /app/TDD/LTX; if [ -f /app/czy5/restore_env.sh ]; then source /app/czy5/restore_env.sh; fi; export PYTHONPATH=/app/czy5/ltxrun; OPTKIT_SAGE=1 OPTKIT_FP8=1 OPTKIT_COMPILE=1 OPTKIT_RING_DEGREE=2 OPTKIT_RING_ROTATE_METHOD=p2p torchrun --nproc_per_node=4 ltx2.3_demo_opt_stage2.py > /tmp/ltx_u2r2_compile.log 2>&1'"
```

Expected: 每份日志均有 `warmup` 与 `timed`，记录 timed 秒数和 peak GB；性能不作为正确性硬门槛。

---

### Task 7: 完成基线文档、PM 状态与推送

**Files:**

- Modify: `PM/optkit/architecture/modules/parallel.md`
- Modify: `PM/optkit/architecture/modules/warps.md`
- Modify: `PM/optkit/architecture/main-design.md`
- Modify: `PM/optkit/architecture/modules/warps/changes/2026-07-16-ltx2-ring-stage2.md`
- Modify: `PM/optkit/project-management.md`

**Interfaces:**

- Consumes: Task 6 的真实权重日志、质量指标、timed 和 peak memory。
- Produces: 已落地基线、完成状态与可追溯证据；推送 optkit `v2` 和项目记忆 `master`。TDD 仓库无 remote，只保留本地任务提交。

- [ ] **Step 1: 只有全部硬门槛通过后才更新基线**

按以下精确内容更新：

```text
parallel.md
- 删除 USP 作为独立模式的表述；改为 Ring 与 Ulysses 两个正交维度，可独立或组合。
- 将组合路径“待 2×2 真机复核”改为 LTX2 u2/r2 的实际验证结论、指标和日志路径。

warps.md
- 标题“已注册 pipeline（13 个）”改为“已注册 pipeline（14 个）”。
- 新增 LTX2Pipeline / LTX2 video+audio / RegionE 否。
- 成熟度新增 LTX2 sage/fp8/compile/Ulysses/Ring/DiCache 的真实权重结论。

main-design.md
- 序列并行能力改为“Ulysses / Ring（可独立配置并组合）”。
- 模型 warp 数量 13 改为 14，并注明 LTX2 双流。

变更设计
- 实施状态 pending 改为 implemented，补 commit、三种拓扑、质量指标、timed、peak GB 和远端日志证据。

project-management.md
- REQ-20260716-ltx2-ring-stage2 状态改为 done。
- 活跃任务移为已完成，Todo 勾选。
- Recent Updates 写入真实指标、commit 与推送状态。
```

如果任何硬门槛未通过，需求状态保持 `verifying`，变更设计标为“已落地、质量验证收口中”；只记录已确认的阻塞与证据，不得标记 done。

- [ ] **Step 2: 运行文档一致性扫描**

Run:

```bash
cd /Users/chenzeyang/zycode/zynode
rg -n "USP|usp|13 个已注册|已注册 pipeline（13 个）" \
  PM/optkit/architecture/main-design.md \
  PM/optkit/architecture/modules/parallel.md \
  PM/optkit/architecture/modules/warps.md
git diff --check -- PM/optkit
```

Expected: `rg` 无输出且退出码为 1；`git diff --check` 无输出。

- [ ] **Step 3: 提交项目记忆完成状态**

```bash
cd /Users/chenzeyang/zycode/zynode
git add \
  PM/optkit/architecture/main-design.md \
  PM/optkit/architecture/modules/parallel.md \
  PM/optkit/architecture/modules/warps.md \
  PM/optkit/architecture/modules/warps/changes/2026-07-16-ltx2-ring-stage2.md \
  PM/optkit/project-management.md
git commit -m "docs(pm): 完成 LTX2 Ring 与 Ulysses 验收" -m "AI-Co-Authored-By: Codex"
```

- [ ] **Step 4: 最终核对三个仓库的提交边界**

Run:

```bash
git -C /Users/chenzeyang/MTGIT/optkit-workspace/optkit show --stat --oneline HEAD
git -C /Users/chenzeyang/MTGIT/optkit-workspace/TDD log -3 --stat --oneline
git -C /Users/chenzeyang/zycode/zynode show --stat --oneline HEAD
```

Expected:

- optkit HEAD 只含 Task 4 的七个 LTX2/parallel 注释文件；
- TDD 最近三笔只含 Stage2 config、demo、质量工具及其测试；
- 项目记忆 HEAD 只含 LTX2 基线、设计状态与 PM 更新。

- [ ] **Step 5: 推送有 remote 的两个仓库**

```bash
git -C /Users/chenzeyang/MTGIT/optkit-workspace/optkit push origin v2
git -C /Users/chenzeyang/zycode/zynode push origin master
```

Expected: 两条 push 成功；TDD 因无 remote 不执行 push。
