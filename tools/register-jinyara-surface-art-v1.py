#!/usr/bin/env python3
"""One-off authoring tool for registering the approved Jinyara illustration.

This tool never talks to Supabase. It accepts an exact local source PNG, measures
its macro-geographic alignment against canonical Jinyara cartography, performs a
seam-aware conservative warp into canonical equirectangular UV space, bakes the
repository-local WebP derivative, and promotes a v1 surface-art manifest entry.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.cluster.vq import kmeans2
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parents[1]
CANONICAL_PATH = Path("data/planet-cartography/thebes/jinyara.json")
INTAKE_PATH = Path("data/surface-art/intake/thebes/jinyara.json")
MANIFEST_PATH = Path("data/surface-art/manifest.json")
REPORT_PATH = Path("data/surface-art/registration-reports/thebes/jinyara.json")
RUNTIME_PATH = Path("assets/body-textures/thebes/jinyara.webp")
EXPECTED_FINGERPRINT = "375d0440032e4c3c4480"
EXPECTED_SOURCE_SHA256 = "65efc7f9ffdd6bee7f15dfe36ee5f1bc2d5e994a09d86f80a73ae57ee2e83b38"
EXPECTED_WIDTH = 1774
EXPECTED_HEIGHT = 887
EXPECTED_BYTES = 3831433
CONTRACT_ID = "orphaned-sun.surface-art-registration.v1"
SOURCE_LOGICAL_REF = "lancer-gm-kit://orphaned-sun-generated-maps/generated-map-375d0440032e4c3c4480/cb4fdeae-019c-4d5e-b651-2229c4622080"

TARGET_PROJECTION = {
    "type": "equirectangular",
    "widthToHeightRatio": 2,
    "latitudeDomainDeg": "[-90,90]",
    "longitudeDomainDeg": "[-180,180)",
    "northUp": True,
    "eastRight": True,
    "primeMeridianDeg": 0,
    "seamLongitudeDeg": 180,
    "seamPolicy": "wrap-longitude",
    "uvConvention": "u=(wrap(lon)+180)/360; v=(90-lat)/180",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    full = ROOT / path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def canonical_ocean_mask(world: dict) -> np.ndarray:
    lat_count = int(world["grid"]["latCount"])
    lon_count = int(world["grid"]["lonCount"])
    elevation = np.asarray(world["raster"]["elevationM"], dtype=np.float32).reshape(lat_count, lon_count)
    # Canonical storage runs south-to-north; source art is north-up.
    return np.flipud(elevation <= 0)


def resize_mask(mask: np.ndarray, width: int, height: int) -> np.ndarray:
    image = Image.fromarray((mask.astype(np.uint8) * 255), mode="L")
    return np.asarray(image.resize((width, height), Image.Resampling.NEAREST)) >= 128


def shift_vertical(mask: np.ndarray, dy: int) -> np.ndarray:
    if dy == 0:
        return mask
    out = np.zeros_like(mask)
    if dy > 0:
        out[dy:] = mask[:-dy]
    else:
        out[:dy] = mask[-dy:]
    return out


def balanced_accuracy(reference: np.ndarray, candidate: np.ndarray) -> float:
    ref = reference.astype(bool)
    cand = candidate.astype(bool)
    tp = np.count_nonzero(ref & cand)
    tn = np.count_nonzero(~ref & ~cand)
    p = max(1, np.count_nonzero(ref))
    n = max(1, np.count_nonzero(~ref))
    return 0.5 * (tp / p + tn / n)


def jaccard(reference: np.ndarray, candidate: np.ndarray) -> float:
    inter = np.count_nonzero(reference & candidate)
    union = np.count_nonzero(reference | candidate)
    return inter / max(1, union)


def cluster_source_ocean(source_rgb: np.ndarray, canonical: np.ndarray, clusters: int = 7) -> tuple[np.ndarray, dict]:
    pixels = source_rgb.reshape(-1, 3).astype(np.float32) / 255.0
    rng = np.random.default_rng(375044)
    sample_count = min(60000, len(pixels))
    sample = pixels[rng.choice(len(pixels), size=sample_count, replace=False)]
    centroids, _ = kmeans2(sample, clusters, minit="++", iter=30, seed=375044)
    distances = ((pixels[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2)
    labels = distances.argmin(axis=1).reshape(source_rgb.shape[:2])

    canonical_fraction = float(canonical.mean())
    cluster_stats = []
    for idx in range(clusters):
        member = labels == idx
        count = int(member.sum())
        if count == 0:
            purity = 0.0
            coverage = 0.0
        else:
            purity = float(canonical[member].mean())
            coverage = count / labels.size
        rgb = (centroids[idx] * 255).clip(0, 255)
        blue_excess = float(rgb[2] - 0.5 * (rgb[0] + rgb[1]))
        cluster_stats.append({
            "index": idx,
            "count": count,
            "coverage": coverage,
            "canonicalOceanPurity": purity,
            "centroidRgb": [round(float(v), 2) for v in rgb],
            "blueExcess": round(blue_excess, 2),
        })

    ranked = sorted(cluster_stats, key=lambda item: (item["canonicalOceanPurity"], item["blueExcess"]), reverse=True)
    selected: list[int] = []
    covered = 0.0
    # Select the clusters that best agree with canonical ocean until approximate
    # canonical ocean coverage is reached. This is intentionally geometry-led,
    # not a hard-coded blue threshold.
    for item in ranked:
        if item["canonicalOceanPurity"] < 0.52 and covered >= canonical_fraction * 0.82:
            break
        selected.append(item["index"])
        covered += item["coverage"]
        if covered >= canonical_fraction * 1.08:
            break

    mask = np.isin(labels, selected)
    normal = balanced_accuracy(canonical, mask)
    inverted = balanced_accuracy(canonical, ~mask)
    if inverted > normal:
        mask = ~mask
        selected = [idx for idx in range(clusters) if idx not in selected]
        normal = inverted

    return mask, {
        "clusterCount": clusters,
        "selectedOceanClusters": selected,
        "canonicalOceanFraction": canonical_fraction,
        "sourceOceanFraction": float(mask.mean()),
        "initialBalancedAccuracy": float(normal),
        "clusters": cluster_stats,
    }


def solve_global_shift(canonical: np.ndarray, source: np.ndarray, max_dx: int = 28, max_dy: int = 14) -> dict:
    best = {"score": -1.0, "dx": 0, "dy": 0, "jaccard": 0.0}
    for dy in range(-max_dy, max_dy + 1):
        vertical = shift_vertical(source, dy)
        for dx in range(-max_dx, max_dx + 1):
            shifted = np.roll(vertical, dx, axis=1)
            score = balanced_accuracy(canonical, shifted)
            if score > best["score"]:
                best = {"score": float(score), "dx": dx, "dy": dy, "jaccard": float(jaccard(canonical, shifted))}
    return best


def extract_wrapped_patch(mask: np.ndarray, cx: int, cy: int, radius: int) -> np.ndarray | None:
    h, w = mask.shape
    if cy - radius < 0 or cy + radius >= h:
        return None
    ys = np.arange(cy - radius, cy + radius + 1)
    xs = np.mod(np.arange(cx - radius, cx + radius + 1), w)
    return mask[np.ix_(ys, xs)]


def patch_complexity(patch: np.ndarray) -> float:
    fraction = float(patch.mean())
    if fraction < 0.08 or fraction > 0.92:
        return 0.0
    edges = np.count_nonzero(patch[:, 1:] != patch[:, :-1]) + np.count_nonzero(patch[1:, :] != patch[:-1, :])
    return edges / patch.size


def local_anchor_observations(intake: dict, canonical: np.ndarray, source: np.ndarray, global_shift: dict) -> list[dict]:
    h, w = canonical.shape
    radius = 14
    search = 6
    observations = []
    for anchor in intake["selectedAnchors"]:
        c = anchor["canonical"]
        cx = int(round(c["u"] * (w - 1)))
        cy = int(round(c["v"] * (h - 1)))
        ref = extract_wrapped_patch(canonical, cx, cy, radius)
        if ref is None:
            continue
        complexity = patch_complexity(ref)
        if complexity < 0.028:
            continue

        trials = []
        base_x = cx - int(global_shift["dx"])
        base_y = cy - int(global_shift["dy"])
        for ddy in range(-search, search + 1):
            for ddx in range(-search, search + 1):
                patch = extract_wrapped_patch(source, base_x + ddx, base_y + ddy, radius)
                if patch is None:
                    continue
                score = balanced_accuracy(ref, patch)
                trials.append((score, ddx, ddy))
        if not trials:
            continue
        trials.sort(reverse=True)
        score, ddx, ddy = trials[0]
        second = trials[min(8, len(trials) - 1)][0]
        confidence = max(0.0, score - second)
        if score < 0.63:
            continue

        # source position = canonical position minus the source->canonical shift,
        # plus the locally measured residual offset.
        source_x = (cx - int(global_shift["dx"]) + ddx) % w
        source_y = min(h - 1, max(0, cy - int(global_shift["dy"]) + ddy))
        observations.append({
            "id": anchor["id"],
            "kind": anchor["kind"],
            "ref": anchor["ref"] or anchor["id"],
            "label": anchor["label"],
            "weight": anchor["weight"],
            "canonical": anchor["canonical"],
            "sourceDs": {"x": source_x, "y": source_y},
            "localResidualDs": {"dx": ddx, "dy": ddy},
            "matchScore": float(score),
            "confidence": float(confidence),
            "complexity": float(complexity),
        })

    observations.sort(key=lambda item: (item["matchScore"], item["confidence"], item["complexity"]), reverse=True)
    return observations


def tier_weight(tier: str) -> float:
    return {"hard": 1.0, "strong": 0.72, "soft": 0.45}.get(tier, 0.4)


def fit_displacement(observations: list[dict], ds_width: int, ds_height: int, width: int, height: int) -> tuple[np.ndarray, np.ndarray, dict]:
    scale_x = width / ds_width
    scale_y = height / ds_height
    points = []
    values = []
    weights = []
    for obs in observations:
        c = obs["canonical"]
        tx = c["u"] * (width - 1)
        ty = c["v"] * (height - 1)
        sx = obs["sourceDs"]["x"] * scale_x
        sy = obs["sourceDs"]["y"] * scale_y
        dx = sx - tx
        if dx > width / 2:
            dx -= width
        elif dx < -width / 2:
            dx += width
        dy = sy - ty
        point = np.array([tx / width, ty / height])
        value = np.array([dx, dy])
        # Duplicate each anchor across the seam so the field is longitude-periodic.
        for seam_offset in (-1.0, 0.0, 1.0):
            points.append([point[0] + seam_offset, point[1]])
            values.append(value)
            weights.append(tier_weight(obs["weight"]) * max(0.25, obs["matchScore"]))

    points_np = np.asarray(points, dtype=np.float64)
    values_np = np.asarray(values, dtype=np.float64)
    # RBFInterpolator has no explicit sample weights. Repeating high-weight
    # anchors would overfit, so weights are retained for quality reporting while
    # smoothing keeps the field conservative.
    rbf = RBFInterpolator(points_np, values_np, kernel="thin_plate_spline", smoothing=0.004)

    # Evaluate on a coarse field and upscale; the target is conservative broad
    # registration, not pixel-level rubber sheeting.
    field_w = 192
    field_h = 96
    gx = np.linspace(0, 1, field_w, endpoint=False)
    gy = np.linspace(0, 1, field_h)
    mx, my = np.meshgrid(gx, gy)
    query = np.column_stack([mx.ravel(), my.ravel()])
    displacement = rbf(query).reshape(field_h, field_w, 2)
    displacement[..., 0] = np.clip(displacement[..., 0], -64.0, 64.0)
    displacement[..., 1] = np.clip(displacement[..., 1], -48.0, 48.0)

    dx_img = Image.fromarray(displacement[..., 0].astype(np.float32), mode="F").resize((width, height), Image.Resampling.BILINEAR)
    dy_img = Image.fromarray(displacement[..., 1].astype(np.float32), mode="F").resize((width, height), Image.Resampling.BILINEAR)
    dx = np.asarray(dx_img, dtype=np.float32)
    dy = np.asarray(dy_img, dtype=np.float32)

    return dx, dy, {
        "method": "periodic-thin-plate-spline",
        "fieldGrid": [field_w, field_h],
        "smoothing": 0.004,
        "maxAbsDxPx": float(np.max(np.abs(dx))),
        "maxAbsDyPx": float(np.max(np.abs(dy))),
        "meanAbsDxPx": float(np.mean(np.abs(dx))),
        "meanAbsDyPx": float(np.mean(np.abs(dy))),
        "sampleWeightMean": float(np.mean(weights)),
    }


def warp_image(source: np.ndarray, dx: np.ndarray, dy: np.ndarray) -> np.ndarray:
    h, w = source.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    sx = np.mod(xx + dx, w)
    sy = np.clip(yy + dy, 0, h - 1)
    out = np.empty_like(source)
    for channel in range(source.shape[2]):
        out[..., channel] = map_coordinates(source[..., channel], [sy, sx], order=1, mode="nearest")
    return out


def sample_displacement(dx: np.ndarray, dy: np.ndarray, u: float, v: float) -> tuple[float, float]:
    h, w = dx.shape
    x = int(round(u * (w - 1))) % w
    y = min(h - 1, max(0, int(round(v * (h - 1)))))
    return float(dx[y, x]), float(dy[y, x])


def manifest_anchor(obs: dict, width: int, height: int, scale_x: float, scale_y: float) -> dict:
    c = obs["canonical"]
    sx = (obs["sourceDs"]["x"] * scale_x) % width
    sy = min(height - 1, max(0.0, obs["sourceDs"]["y"] * scale_y))
    return {
        "id": obs["id"],
        "featureRef": str(obs["ref"]),
        "featureClass": obs["kind"],
        "tier": obs["weight"],
        "weight": tier_weight(obs["weight"]),
        "canonical": {"latDeg": c["lat"], "lonDeg": c["lon"]},
        "sourceUv": {"u": round(float(sx / (width - 1)), 8), "v": round(float(sy / (height - 1)), 8)},
        "observation": {
            "method": "local-land-water-shape-correlation",
            "matchScore": round(obs["matchScore"], 6),
            "confidence": round(obs["confidence"], 6),
        },
    }


def update_intake(intake: dict, source_sha: str, byte_size: int, observations: list[dict], report: dict) -> dict:
    intake["stage"] = "registered-and-promoted"
    intake["sourceArtwork"]["bytes"] = byte_size
    intake["sourceArtwork"]["sha256"] = source_sha
    intake["sourceArtwork"]["checksumStatus"] = "verified-exact-source-bytes"
    by_id = {obs["id"]: obs for obs in observations}
    for anchor in intake["selectedAnchors"]:
        obs = by_id.get(anchor["id"])
        if not obs:
            continue
        anchor["sourceObservation"] = {
            "status": "measured",
            "method": "local-land-water-shape-correlation",
            "u": report["manifestAnchorsById"][anchor["id"]]["sourceUv"]["u"],
            "v": report["manifestAnchorsById"][anchor["id"]]["sourceUv"]["v"],
            "tolerancePixels": round(max(3.0, (1.0 - obs["matchScore"]) * 40.0), 2),
            "matchScore": round(obs["matchScore"], 6),
        }
    intake["registrationReadiness"] = {
        "sourceLinked": True,
        "registered": True,
        "promoted": True,
        "blockers": [],
    }
    intake["targetRuntime"]["status"] = "baked-and-promoted"
    intake["targetRuntime"]["sha256"] = report["runtime"]["sha256"]
    intake["targetRuntime"]["bytes"] = report["runtime"]["bytes"]
    intake["registrationReportPath"] = str(REPORT_PATH)
    return intake


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    source_bytes = args.source.read_bytes()
    source_sha = sha256_bytes(source_bytes)
    if source_sha != EXPECTED_SOURCE_SHA256:
        raise SystemExit(f"Jinyara source SHA-256 mismatch: {source_sha}")
    if len(source_bytes) != EXPECTED_BYTES:
        raise SystemExit(f"Jinyara source byte-size mismatch: {len(source_bytes)}")

    source_image = Image.open(args.source).convert("RGB")
    if source_image.size != (EXPECTED_WIDTH, EXPECTED_HEIGHT):
        raise SystemExit(f"Jinyara source dimensions mismatch: {source_image.size}")
    source_np = np.asarray(source_image, dtype=np.uint8)

    world = read_json(CANONICAL_PATH)
    intake = read_json(INTAKE_PATH)
    if world["sourceFingerprint"] != EXPECTED_FINGERPRINT:
        raise SystemExit("Canonical Jinyara fingerprint drifted")

    ds_width = 443
    ds_height = 222
    canonical_small = resize_mask(canonical_ocean_mask(world), ds_width, ds_height)
    source_small_rgb = np.asarray(source_image.resize((ds_width, ds_height), Image.Resampling.LANCZOS))
    source_ocean, segmentation = cluster_source_ocean(source_small_rgb, canonical_small)
    global_shift = solve_global_shift(canonical_small, source_ocean)
    aligned = np.roll(shift_vertical(source_ocean, global_shift["dy"]), global_shift["dx"], axis=1)
    segmentation["postShiftBalancedAccuracy"] = balanced_accuracy(canonical_small, aligned)
    segmentation["postShiftJaccard"] = jaccard(canonical_small, aligned)

    observations = local_anchor_observations(intake, canonical_small, source_ocean, global_shift)
    # Keep only the strongest spatially useful observations. Twelve is plenty for
    # a smooth broad warp and keeps local painterly irregularities from becoming
    # geometry authority.
    observations = observations[:18]
    if len(observations) < 6:
        raise SystemExit(f"Insufficient reliable semantic correspondences: {len(observations)}")

    dx, dy, warp_meta = fit_displacement(observations, ds_width, ds_height, EXPECTED_WIDTH, EXPECTED_HEIGHT)
    warped = warp_image(source_np, dx, dy)

    runtime_full = ROOT / RUNTIME_PATH
    runtime_full.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(warped, mode="RGB").save(runtime_full, format="WEBP", quality=90, method=6)
    runtime_bytes = runtime_full.read_bytes()
    runtime_sha = sha256_bytes(runtime_bytes)

    scale_x = EXPECTED_WIDTH / ds_width
    scale_y = EXPECTED_HEIGHT / ds_height
    anchors = [manifest_anchor(obs, EXPECTED_WIDTH, EXPECTED_HEIGHT, scale_x, scale_y) for obs in observations]

    residuals = []
    for obs, anchor in zip(observations, anchors):
        c = obs["canonical"]
        tx = c["u"] * (EXPECTED_WIDTH - 1)
        ty = c["v"] * (EXPECTED_HEIGHT - 1)
        observed_x = anchor["sourceUv"]["u"] * (EXPECTED_WIDTH - 1)
        observed_y = anchor["sourceUv"]["v"] * (EXPECTED_HEIGHT - 1)
        pdx, pdy = sample_displacement(dx, dy, c["u"], c["v"])
        predicted_x = (tx + pdx) % EXPECTED_WIDTH
        predicted_y = ty + pdy
        ddx = abs(predicted_x - observed_x)
        ddx = min(ddx, EXPECTED_WIDTH - ddx)
        residuals.append(math.hypot(ddx, predicted_y - observed_y))

    rms = math.sqrt(sum(value * value for value in residuals) / len(residuals))
    max_error = max(residuals)
    if rms > 18 or max_error > 36:
        raise SystemExit(f"Registration residuals exceed conservative gate: rms={rms:.2f}, max={max_error:.2f}")
    if segmentation["postShiftBalancedAccuracy"] < 0.62:
        raise SystemExit(f"Macro-geographic alignment too weak: {segmentation['postShiftBalancedAccuracy']:.3f}")

    canonical_sha = sha256_bytes((ROOT / CANONICAL_PATH).read_bytes())
    entry = {
        "schemaVersion": 1,
        "contractId": CONTRACT_ID,
        "id": "thebes--jinyara",
        "stage": "promoted",
        "system": "Thebes",
        "body": "Jinyara",
        "canonical": {
            "cartographyPath": str(CANONICAL_PATH),
            "sourceSha256": canonical_sha,
            "sourceFingerprint": EXPECTED_FINGERPRINT,
            "projection": "equirectangular",
        },
        "sourceArtwork": {
            "authority": "lancer-gm-kit",
            "repository": "jonkellyrice-cmyk/Lancer-GM-Kit",
            "logicalRef": SOURCE_LOGICAL_REF,
            "sha256": source_sha,
            "mimeType": "image/png",
            "widthPx": EXPECTED_WIDTH,
            "heightPx": EXPECTED_HEIGHT,
        },
        "targetProjection": TARGET_PROJECTION,
        "registration": {
            "method": "seam-aware-anchor-warp",
            "algorithmVersion": 1,
            "seamPolicy": "wrap-longitude",
            "deformationPolicy": "anchor-weighted-low-information-sinks",
            "anchors": anchors,
            "quality": {
                "rmsAnchorErrorPx": round(rms, 4),
                "maxAnchorErrorPx": round(max_error, 4),
                "macroBalancedAccuracy": round(segmentation["postShiftBalancedAccuracy"], 6),
                "macroOceanJaccard": round(segmentation["postShiftJaccard"], 6),
                "reliableAnchorCount": len(anchors),
            },
            "solver": warp_meta,
        },
        "runtimeTexture": {
            "format": "webp",
            "repositoryPath": str(RUNTIME_PATH),
            "widthPx": EXPECTED_WIDTH,
            "heightPx": EXPECTED_HEIGHT,
            "sha256": runtime_sha,
        },
        "provenance": {
            "promotionTool": "tools/register-jinyara-surface-art-v1.py",
            "sourceAcquisition": "authenticated-authoring-bridge; no runtime dependency",
        },
    }

    report = {
        "schemaVersion": 1,
        "system": "Thebes",
        "body": "Jinyara",
        "source": {
            "sha256": source_sha,
            "bytes": len(source_bytes),
            "width": EXPECTED_WIDTH,
            "height": EXPECTED_HEIGHT,
        },
        "segmentation": segmentation,
        "globalShiftDownsampledPx": global_shift,
        "warp": warp_meta,
        "quality": entry["registration"]["quality"],
        "observedAnchors": [{
            "id": obs["id"],
            "kind": obs["kind"],
            "tier": obs["weight"],
            "label": obs["label"],
            "matchScore": round(obs["matchScore"], 6),
            "confidence": round(obs["confidence"], 6),
            "localResidualDs": obs["localResidualDs"],
        } for obs in observations],
        "runtime": {
            "path": str(RUNTIME_PATH),
            "sha256": runtime_sha,
            "bytes": len(runtime_bytes),
        },
        "manifestAnchorsById": {anchor["id"]: anchor for anchor in anchors},
    }

    if args.check_only:
        print(json.dumps({
            "sourceSha256": source_sha,
            "sourceBytes": len(source_bytes),
            "globalShift": global_shift,
            "reliableAnchors": len(observations),
            "rmsAnchorErrorPx": rms,
            "maxAnchorErrorPx": max_error,
            "macroBalancedAccuracy": segmentation["postShiftBalancedAccuracy"],
            "runtimeBytes": len(runtime_bytes),
            "runtimeSha256": runtime_sha,
        }, indent=2))
        return

    manifest = read_json(MANIFEST_PATH)
    manifest["entries"] = [item for item in manifest["entries"] if item.get("id") != entry["id"]]
    manifest["entries"].append(entry)
    manifest["entries"].sort(key=lambda item: item["id"])

    update_intake(intake, source_sha, len(source_bytes), observations, report)
    write_json(INTAKE_PATH, intake)
    write_json(REPORT_PATH, report)
    write_json(MANIFEST_PATH, manifest)

    print(json.dumps({
        "sourceSha256": source_sha,
        "sourceBytes": len(source_bytes),
        "globalShift": global_shift,
        "reliableAnchors": len(observations),
        "rmsAnchorErrorPx": round(rms, 4),
        "maxAnchorErrorPx": round(max_error, 4),
        "macroBalancedAccuracy": round(segmentation["postShiftBalancedAccuracy"], 6),
        "macroOceanJaccard": round(segmentation["postShiftJaccard"], 6),
        "runtimeBytes": len(runtime_bytes),
        "runtimeSha256": runtime_sha,
    }, indent=2))


if __name__ == "__main__":
    main()
