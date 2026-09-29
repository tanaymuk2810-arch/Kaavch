#!/usr/bin/env python3
"""
Placeholder GLB generator for the Suraksha Trainer AR modules.

Produces simple tinted boxes (stand-ins for fire extinguisher, gas cylinder,
exit signage, helmet, machinery guard, first-aid kit). Real low-poly Blender
exports (`.glb`, <5k triangles) drop into `android/app/src/main/assets/models/`
with the same filenames and automatically replace these placeholders.

GLB is embedded-glTF: JSON chunk only, buffer as a base64 data-URI.
"""
import base64
import json
import struct
import sys
from pathlib import Path

JSON_CHUNK_TYPE = 0x4E4F534A


def box(center=(0.0, 0.0, 0.0), size=(0.3, 0.3, 0.3), tint=(0.9, 0.1, 0.1)):
    cx, cy, cz = center
    sx, sy, sz = size
    hx, hy, hz = sx / 2, sy / 2, sz / 2

    face_corner = [
        ((-hx, -hy, -hz), (-1, 0, 0)), ((hx, -hy, -hz), (1, 0, 0)),
        ((-hx, hy, -hz), (0, 1, 0)), ((-hx, -hy, -hz), (0, -1, 0)),
        ((-hx, -hy, hz), (0, 0, 1)), ((-hx, -hy, -hz), (0, 0, -1)),
    ]
    face_axes = [
        [(0, 1, 2), (0, 2), (0, 3), (0, 4)],
        [(0, 1, 2), (0, 2), (0, 3), (0, 4)],
        [(0, 1, 2), (0, 2), (0, 3), (0, 4)],
        [(0, 1, 2), (0, 2), (0, 3), (0, 4)],
        [(0, 1, 2), (0, 2), (0, 3), (0, 4)],
        [(0, 1, 2), (0, 2), (0, 3), (0, 4)],
    ]

    positions = []
    normals = []
    indices = []
    v = 0
    for (corner, n), _ in zip(face_corner, face_axes):
        del corner
        if n[0] != 0:  # ±X face
            x = cx + n[0] * hx
            corners = [(x, cy - hy, cz - hz), (x, cy + hy, cz - hz), (x, cy - hy, cz + hz), (x, cy + hy, cz + hz)]
        elif n[1] != 0:  # ±Y face
            y = cy + n[1] * hy
            corners = [(cx - hx, y, cz - hz), (cx + hx, y, cz - hz), (cx - hx, y, cz + hz), (cx + hx, y, cz + hz)]
        else:  # ±Z face
            z = cz + n[2] * hz
            corners = [(cx - hx, cy - hy, z), (cx + hx, cy - hy, z), (cx - hx, cy + hy, z), (cx + hx, cy + hy, z)]
        for c in corners:
            positions.append(c)
            normals.append(n)
        # triangle order so outward normal faces viewer
        if sum(n) > 0:
            indices += [v, v + 1, v + 2, v + 2, v + 1, v + 3]
        else:
            indices += [v, v + 2, v + 1, v + 1, v + 2, v + 3]
        v += 4

    data = bytearray()
    for p in positions:
        data += struct.pack("<3f", *p)
    for n in normals:
        data += struct.pack("<3f", *n)
    for i in indices:
        data += struct.pack("<H", i)

    pos_len = len(positions) * 12
    nrm_len = len(normals) * 12
    idx_len = len(indices) * 2
    total = pos_len + nrm_len + idx_len

    b64 = base64.b64encode(bytes(data)).decode("ascii")
    minp = [min(p[i] for p in positions) for i in range(3)]
    maxp = [max(p[i] for p in positions) for i in range(3)]

    gltf = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
        "buffers": [{"uri": "data:application/octet-stream;base64," + b64, "byteLength": total}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": pos_len, "target": 34962},
            {"buffer": 0, "byteOffset": pos_len, "byteLength": nrm_len, "target": 34962},
            {"buffer": 0, "byteOffset": pos_len + nrm_len, "byteLength": idx_len, "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(positions), "type": "VEC3",
             "min": minp, "max": maxp},
            {"bufferView": 1, "componentType": 5126, "count": len(normals), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5123, "count": len(indices), "type": "SCALAR"},
        ],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [*tint, 1.0]}, "doubleSided": True}],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "

    json_len = len(json_bytes)
    total_len = 12 + 8 + json_len
    header = struct.pack("<III", 0x46546C67, 2, total_len)
    chunk_header = struct.pack("<II", json_len, JSON_CHUNK_TYPE)
    return header + chunk_header + json_bytes


def main():
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "android/app/src/main/assets/models")
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    assets = {
        # red, tall thin box = fire extinguisher
        "extinguisher.glb": dict(size=(0.16, 0.5, 0.16), tint=(0.85, 0.10, 0.10)),
        # grey upright box = gas cylinder
        "gas_cylinder.glb": dict(size=(0.28, 0.6, 0.28), tint=(0.65, 0.65, 0.70)),
        # green flat box = exit safety sign
        "safety_sign.glb": dict(size=(0.4, 0.3, 0.05), tint=(0.05, 0.55, 0.25)),
        # amber box = industrial helmet
        "helmet.glb": dict(size=(0.3, 0.2, 0.3), tint=(0.95, 0.68, 0.05)),
        # orange box = machinery guard
        "machinery_guard.glb": dict(size=(0.4, 0.25, 0.2), tint=(0.95, 0.42, 0.05)),
        # white box with red cross colour = first-aid kit
        "firstaid.glb": dict(size=(0.26, 0.18, 0.2), tint=(0.95, 0.95, 0.95)),
    }

    for name, cfg in assets.items():
        glb = box(size=cfg["size"], tint=cfg["tint"])
        (out_dir / name).write_bytes(glb)
        print(f"wrote {out_dir / name} ({len(glb)} bytes)")


if __name__ == "__main__":
    main()