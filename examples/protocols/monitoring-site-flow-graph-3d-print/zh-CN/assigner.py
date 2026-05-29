from __future__ import annotations

import csv
import html
import io
import math
from typing import Any

from airalogy import Airalogy
from airalogy.assigner import AssignerResult, DefaultAssigner, assigner


EARTH_RADIUS_M = 6371008.8
_AIRALOGY_CLIENT = None
DEFAULT_SITES = [
    {
        "site_id": "S01",
        "site_name": "上游坡面站",
        "latitude": 30.0000,
        "longitude": 120.0000,
        "elevation_m": 128.0,
        "site_type": "河流",
        "elevation_accuracy_m": 2.0,
        "priority": 1,
        "note": "示例高程较高",
    },
    {
        "site_id": "S02",
        "site_name": "中游汇流站",
        "latitude": 30.0060,
        "longitude": 120.0040,
        "elevation_m": 104.0,
        "site_type": "河流",
        "elevation_accuracy_m": 2.0,
        "priority": 1,
        "note": "示例中游",
    },
    {
        "site_id": "S03",
        "site_name": "支沟站",
        "latitude": 30.0040,
        "longitude": 119.9960,
        "elevation_m": 116.0,
        "site_type": "溪沟",
        "elevation_accuracy_m": 2.0,
        "priority": 2,
        "note": "示例支流",
    },
    {
        "site_id": "S04",
        "site_name": "下游控制站",
        "latitude": 30.0120,
        "longitude": 120.0060,
        "elevation_m": 82.0,
        "site_type": "河流",
        "elevation_accuracy_m": 2.0,
        "priority": 1,
        "note": "示例下游",
    },
]
DEFAULT_DEPENDENT_DATA = {
    "site_csv_file": "",
    "monitoring_sites": DEFAULT_SITES,
    "max_link_distance_km": 2.0,
    "min_link_distance_m": 10.0,
    "min_elevation_drop_m": 1.0,
    "max_slope_m_per_km": 200.0,
    "min_slope_m_per_km": 0.2,
    "max_downstream_edges_per_site": 2,
    "prefer_nearest_lower_site": True,
    "avoid_crossing_edges": True,
    "allow_equal_elevation_edges": False,
    "manual_edges": [],
    "blocked_edges": [],
    "inferred_edges": [],
    "printer_type": "FDM",
    "print_material": "PLA",
    "print_bed_x_mm": 220.0,
    "print_bed_y_mm": 220.0,
    "max_model_height_mm": 80.0,
    "print_margin_mm": 12.0,
    "base_thickness_mm": 3.0,
    "min_node_diameter_mm": 4.0,
    "max_node_diameter_mm": 8.0,
    "edge_strut_diameter_mm": 2.0,
    "min_printable_feature_mm": 1.2,
    "z_exaggeration": 2.0,
    "label_height_mm": 1.0,
}


def _client() -> Airalogy:
    global _AIRALOGY_CLIENT
    if _AIRALOGY_CLIENT is None:
        _AIRALOGY_CLIENT = Airalogy()
    return _AIRALOGY_CLIENT


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    if isinstance(row, dict):
        return row.get(key, default)
    return getattr(row, key, default)


def _as_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value
    return str(value)


def _as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on", "是"}


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        if math.isfinite(parsed):
            return parsed
    except Exception:
        pass
    return default


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _round(value: float, digits: int = 3) -> float:
    return round(float(value), digits)


def _normalize_sites(raw_sites: Any) -> list[dict[str, Any]]:
    rows = raw_sites if isinstance(raw_sites, list) else []
    sites: list[dict[str, Any]] = []
    seen: set[str] = set()
    for idx, row in enumerate(rows, start=1):
        site_id = _as_text(_row_get(row, "site_id"), f"S{idx:02d}").strip() or f"S{idx:02d}"
        if site_id in seen:
            site_id = f"{site_id}_{idx}"
        seen.add(site_id)
        sites.append(
            {
                "site_id": site_id,
                "site_name": _as_text(_row_get(row, "site_name"), site_id),
                "latitude": _as_float(_row_get(row, "latitude")),
                "longitude": _as_float(_row_get(row, "longitude")),
                "elevation_m": _as_float(_row_get(row, "elevation_m")),
                "site_type": _as_text(_row_get(row, "site_type"), "其他"),
                "elevation_accuracy_m": max(0.0, _as_float(_row_get(row, "elevation_accuracy_m"), 0.0)),
                "priority": max(1, _as_int(_row_get(row, "priority"), 1)),
                "note": _as_text(_row_get(row, "note")),
            }
        )
    return sites


def _read_sites_from_csv(file_id: str) -> list[dict[str, Any]]:
    raw_bytes = _client().download_file_bytes(file_id)
    text = raw_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV 文件缺少表头")

    rows = list(reader)
    if not rows:
        raise ValueError("CSV 文件没有站点数据行")

    required = ["site_id", "latitude", "longitude", "elevation_m"]
    missing = [field for field in required if field not in reader.fieldnames]
    if missing:
        raise ValueError(f"CSV 缺少必要字段：{', '.join(missing)}")
    return rows


def _resolve_sites(dependent_fields: dict[str, Any]) -> list[dict[str, Any]]:
    file_id = _as_text(dependent_fields.get("site_csv_file")).strip()
    if file_id:
        return _normalize_sites(_read_sites_from_csv(file_id))
    return _normalize_sites(dependent_fields.get("monitoring_sites"))


def _project_sites(sites: list[dict[str, Any]]) -> dict[str, tuple[float, float]]:
    if not sites:
        return {}
    lat0 = math.radians(sum(site["latitude"] for site in sites) / len(sites))
    lon0 = math.radians(sum(site["longitude"] for site in sites) / len(sites))
    result: dict[str, tuple[float, float]] = {}
    for site in sites:
        lat = math.radians(site["latitude"])
        lon = math.radians(site["longitude"])
        x = EARTH_RADIUS_M * (lon - lon0) * math.cos(lat0)
        y = EARTH_RADIUS_M * (lat - lat0)
        result[site["site_id"]] = (x, y)
    return result


def _distance_m(site_a: dict[str, Any], site_b: dict[str, Any], xy: dict[str, tuple[float, float]]) -> float:
    ax, ay = xy[site_a["site_id"]]
    bx, by = xy[site_b["site_id"]]
    return math.hypot(ax - bx, ay - by)


def _blocked_set(raw_edges: Any) -> set[tuple[str, str]]:
    edges = raw_edges if isinstance(raw_edges, list) else []
    return {
        (_as_text(_row_get(edge, "from_site_id")).strip(), _as_text(_row_get(edge, "to_site_id")).strip())
        for edge in edges
        if _as_text(_row_get(edge, "from_site_id")).strip() and _as_text(_row_get(edge, "to_site_id")).strip()
    }


def _segments_cross(
    edge_a: dict[str, Any],
    edge_b: dict[str, Any],
    xy: dict[str, tuple[float, float]],
) -> bool:
    if {
        edge_a["from_site_id"],
        edge_a["to_site_id"],
    } & {
        edge_b["from_site_id"],
        edge_b["to_site_id"],
    }:
        return False

    p1 = xy[edge_a["from_site_id"]]
    p2 = xy[edge_a["to_site_id"]]
    q1 = xy[edge_b["from_site_id"]]
    q2 = xy[edge_b["to_site_id"]]

    def orient(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    o1 = orient(p1, p2, q1)
    o2 = orient(p1, p2, q2)
    o3 = orient(q1, q2, p1)
    o4 = orient(q1, q2, p2)
    return (o1 * o2 < 0) and (o3 * o4 < 0)


def _edge_confidence(distance_km: float, drop_m: float, slope_m_per_km: float, max_distance_km: float, max_slope: float) -> float:
    distance_score = max(0.0, min(1.0, 1.0 - distance_km / max(max_distance_km, 0.001)))
    drop_score = max(0.0, min(1.0, drop_m / 20.0))
    slope_score = max(0.0, min(1.0, slope_m_per_km / max(max_slope, 0.001)))
    return max(0.0, min(1.0, 0.45 * distance_score + 0.30 * drop_score + 0.25 * slope_score))


def _infer_edges(dependent_fields: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, tuple[float, float]]]:
    sites = _resolve_sites(dependent_fields)
    site_by_id = {site["site_id"]: site for site in sites}
    xy = _project_sites(sites)

    max_distance_km = max(0.001, _as_float(dependent_fields.get("max_link_distance_km"), 2.0))
    min_distance_m = max(0.0, _as_float(dependent_fields.get("min_link_distance_m"), 10.0))
    min_drop_m = _as_float(dependent_fields.get("min_elevation_drop_m"), 1.0)
    max_slope = max(0.001, _as_float(dependent_fields.get("max_slope_m_per_km"), 200.0))
    min_slope = max(0.0, _as_float(dependent_fields.get("min_slope_m_per_km"), 0.2))
    max_edges = max(1, _as_int(dependent_fields.get("max_downstream_edges_per_site"), 2))
    prefer_nearest = _as_bool(dependent_fields.get("prefer_nearest_lower_site"), True)
    avoid_crossing = _as_bool(dependent_fields.get("avoid_crossing_edges"), True)
    allow_equal = _as_bool(dependent_fields.get("allow_equal_elevation_edges"), False)
    blocked = _blocked_set(dependent_fields.get("blocked_edges"))

    diagnostics = {
        "site_count": len(sites),
        "candidate_count": 0,
        "rejected_blocked": 0,
        "rejected_distance": 0,
        "rejected_elevation": 0,
        "rejected_slope": 0,
        "removed_crossing": 0,
        "manual_edges_added": 0,
    }

    candidates_by_from: dict[str, list[dict[str, Any]]] = {}
    for source in sites:
        for target in sites:
            if source["site_id"] == target["site_id"]:
                continue
            diagnostics["candidate_count"] += 1
            pair = (source["site_id"], target["site_id"])
            if pair in blocked:
                diagnostics["rejected_blocked"] += 1
                continue
            distance_m = _distance_m(source, target, xy)
            if distance_m < min_distance_m or distance_m > max_distance_km * 1000:
                diagnostics["rejected_distance"] += 1
                continue
            drop_m = source["elevation_m"] - target["elevation_m"]
            required_drop = 0.0 if allow_equal else min_drop_m
            if drop_m < required_drop:
                diagnostics["rejected_elevation"] += 1
                continue
            distance_km = distance_m / 1000
            slope = drop_m / max(distance_km, 0.001)
            if slope < min_slope or slope > max_slope:
                diagnostics["rejected_slope"] += 1
                continue
            confidence = _edge_confidence(distance_km, drop_m, slope, max_distance_km, max_slope)
            candidates_by_from.setdefault(source["site_id"], []).append(
                {
                    "from_site_id": source["site_id"],
                    "to_site_id": target["site_id"],
                    "distance_km": distance_km,
                    "elevation_drop_m": drop_m,
                    "slope_m_per_km": slope,
                    "confidence_score": confidence,
                    "rule_status": "auto_pass",
                    "note": "满足距离、高程差和坡度约束",
                }
            )

    selected: list[dict[str, Any]] = []
    for from_site_id, candidates in candidates_by_from.items():
        if prefer_nearest:
            candidates.sort(key=lambda item: (item["distance_km"], -item["confidence_score"]))
        else:
            candidates.sort(key=lambda item: (-item["confidence_score"], item["distance_km"]))
        selected.extend(candidates[:max_edges])

    manual_edges = dependent_fields.get("manual_edges") if isinstance(dependent_fields.get("manual_edges"), list) else []
    existing_pairs = {(edge["from_site_id"], edge["to_site_id"]) for edge in selected}
    for raw_edge in manual_edges:
        from_id = _as_text(_row_get(raw_edge, "from_site_id")).strip()
        to_id = _as_text(_row_get(raw_edge, "to_site_id")).strip()
        if not from_id or not to_id or from_id not in site_by_id or to_id not in site_by_id:
            continue
        if (from_id, to_id) in blocked or (from_id, to_id) in existing_pairs:
            continue
        source = site_by_id[from_id]
        target = site_by_id[to_id]
        distance_m = _distance_m(source, target, xy)
        distance_km = distance_m / 1000
        drop_m = source["elevation_m"] - target["elevation_m"]
        slope = drop_m / max(distance_km, 0.001)
        status_notes = ["manual"]
        if drop_m < min_drop_m and not allow_equal:
            status_notes.append("violates_elevation")
        if distance_m > max_distance_km * 1000:
            status_notes.append("beyond_distance")
        if slope < min_slope or slope > max_slope:
            status_notes.append("slope_review")
        selected.append(
            {
                "from_site_id": from_id,
                "to_site_id": to_id,
                "distance_km": distance_km,
                "elevation_drop_m": drop_m,
                "slope_m_per_km": slope,
                "confidence_score": 1.0 if status_notes == ["manual"] else 0.4,
                "rule_status": ";".join(status_notes),
                "note": _as_text(_row_get(raw_edge, "note"), "人工强制边"),
            }
        )
        existing_pairs.add((from_id, to_id))
        diagnostics["manual_edges_added"] += 1

    if avoid_crossing:
        keep = [True] * len(selected)
        changed = True
        while changed:
            changed = False
            for i in range(len(selected)):
                if not keep[i]:
                    continue
                for j in range(i + 1, len(selected)):
                    if not keep[j]:
                        continue
                    if not _segments_cross(selected[i], selected[j], xy):
                        continue
                    left = selected[i]
                    right = selected[j]
                    remove_idx = i if (left["confidence_score"], -left["distance_km"]) < (right["confidence_score"], -right["distance_km"]) else j
                    keep[remove_idx] = False
                    diagnostics["removed_crossing"] += 1
                    changed = True
                    break
                if changed:
                    break
        selected = [edge for edge, is_kept in zip(selected, keep) if is_kept]

    selected.sort(key=lambda item: (item["from_site_id"], item["to_site_id"]))
    for idx, edge in enumerate(selected, start=1):
        edge["edge_id"] = f"E{idx:03d}"
        edge["distance_km"] = _round(edge["distance_km"], 4)
        edge["elevation_drop_m"] = _round(edge["elevation_drop_m"], 3)
        edge["slope_m_per_km"] = _round(edge["slope_m_per_km"], 3)
        edge["confidence_score"] = _round(edge["confidence_score"], 3)

    return selected, {"sites": sites, "diagnostics": diagnostics}, xy


def _adjacency_markdown(edges: list[dict[str, Any]], sites: list[dict[str, Any]]) -> str:
    by_from: dict[str, list[str]] = {site["site_id"]: [] for site in sites}
    for edge in edges:
        by_from.setdefault(edge["from_site_id"], []).append(f"{edge['to_site_id']}({edge['edge_id']}, {edge['distance_km']} km)")
    lines = ["| 站点 | 下游候选 |", "| --- | --- |"]
    for site in sites:
        downstream = "；".join(by_from.get(site["site_id"], [])) or "无直接下游候选"
        lines.append(f"| {site['site_id']} | {downstream} |")
    return "\n".join(lines)


def _graph_diagnostics_markdown(edges: list[dict[str, Any]], sites: list[dict[str, Any]], diagnostics: dict[str, Any]) -> str:
    site_ids = {site["site_id"] for site in sites}
    outgoing = {edge["from_site_id"] for edge in edges}
    incoming = {edge["to_site_id"] for edge in edges}
    sources = sorted(site_ids - incoming)
    sinks = sorted(site_ids - outgoing)
    isolated = sorted(site_ids - incoming - outgoing)
    return "\n".join(
        [
            f"- 站点数：{len(sites)}",
            f"- 输出边数：{len(edges)}",
            f"- 原始候选方向数：{diagnostics['candidate_count']}",
            f"- 因禁用边剔除：{diagnostics['rejected_blocked']}",
            f"- 因距离剔除：{diagnostics['rejected_distance']}",
            f"- 因高程规则剔除：{diagnostics['rejected_elevation']}",
            f"- 因坡度规则剔除：{diagnostics['rejected_slope']}",
            f"- 因平面交叉删除：{diagnostics['removed_crossing']}",
            f"- 人工强制边加入：{diagnostics['manual_edges_added']}",
            f"- 无入边源头候选：{', '.join(sources) if sources else '无'}",
            f"- 无出边汇出口候选：{', '.join(sinks) if sinks else '无'}",
            f"- 孤立站点：{', '.join(isolated) if isolated else '无'}",
        ]
    )


def _mermaid_text(value: Any) -> str:
    return _as_text(value).replace('"', "'").replace("\n", " ").replace("|", "/")


def _graph_mermaid_preview(edges: list[dict[str, Any]], sites: list[dict[str, Any]]) -> str:
    node_ids = {site["site_id"]: f"N{idx:03d}" for idx, site in enumerate(sites, start=1)}
    lines = ["flowchart TD"]
    for site in sites:
        label = _mermaid_text(f"{site['site_id']}<br/>{site['site_name']}<br/>{_round(site['elevation_m'], 1)} m")
        lines.append(f'  {node_ids[site["site_id"]]}["{label}"]')
    if edges:
        for edge in edges:
            if edge["from_site_id"] not in node_ids or edge["to_site_id"] not in node_ids:
                continue
            edge_label = _mermaid_text(
                f"{edge['distance_km']} km / 高差 {edge['elevation_drop_m']} m / c {edge['confidence_score']}"
            )
            lines.append(f"  {node_ids[edge['from_site_id']]} -->|{edge_label}| {node_ids[edge['to_site_id']]}")
    else:
        lines.append("  %% 未生成候选边")
    return "```mermaid\n" + "\n".join(lines) + "\n```"


def _svg_color_for_elevation(elevation: float, min_elev: float, max_elev: float) -> str:
    span = max(max_elev - min_elev, 0.001)
    t = max(0.0, min(1.0, (elevation - min_elev) / span))
    low = (37, 99, 235)
    high = (249, 115, 22)
    rgb = tuple(round(low[i] + (high[i] - low[i]) * t) for i in range(3))
    return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"


def _graph_svg_code(edges: list[dict[str, Any]], sites: list[dict[str, Any]], xy: dict[str, tuple[float, float]]) -> str:
    width = 980
    height = 680
    margin = 82
    if not sites:
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="980" height="240" viewBox="0 0 980 240">'
            '<rect width="980" height="240" fill="#ffffff"/>'
            '<text x="40" y="80" font-family="Arial, sans-serif" font-size="24" fill="#334155">没有可视化的站点数据</text>'
            "</svg>"
        )

    xs = [xy[site["site_id"]][0] for site in sites]
    ys = [xy[site["site_id"]][1] for site in sites]
    elevations = [site["elevation_m"] for site in sites]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_elev, max_elev = min(elevations), max(elevations)
    range_x = max(max_x - min_x, 1.0)
    range_y = max(max_y - min_y, 1.0)
    scale = min((width - 2 * margin) / range_x, (height - 2 * margin - 70) / range_y)
    plot_height = height - 2 * margin - 70

    def point(site_id: str) -> tuple[float, float]:
        x_m, y_m = xy[site_id]
        x = margin + (x_m - min_x) * scale
        y = margin + 70 + plot_height - (y_m - min_y) * scale
        return x, y

    site_by_id = {site["site_id"]: site for site in sites}
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        "<defs>",
        '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">',
        '<path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"/>',
        "</marker>",
        "</defs>",
        '<text x="32" y="38" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#0f172a">监测站点物理约束流向图</text>',
        '<text x="32" y="66" font-family="Arial, sans-serif" font-size="14" fill="#475569">节点按经纬度近似投影；颜色从蓝色低程到橙色高程；箭头表示候选流向；线越粗表示置信度越高。</text>',
        f'<text x="32" y="{height - 28}" font-family="Arial, sans-serif" font-size="13" fill="#64748b">站点数 {len(sites)}；候选边 {len(edges)}；海拔范围 {_round(min_elev, 1)}-{_round(max_elev, 1)} m。正式解释前需用 DEM、河网、管网或现场资料复核。</text>',
    ]

    for edge in edges:
        from_site = site_by_id.get(edge["from_site_id"])
        to_site = site_by_id.get(edge["to_site_id"])
        if from_site is None or to_site is None:
            continue
        x1, y1 = point(from_site["site_id"])
        x2, y2 = point(to_site["site_id"])
        confidence = max(0.0, min(1.0, _as_float(edge.get("confidence_score"), 0.5)))
        stroke_width = 1.6 + confidence * 3.2
        opacity = 0.38 + confidence * 0.52
        parts.append(
            f'<line x1="{_round(x1, 2)}" y1="{_round(y1, 2)}" x2="{_round(x2, 2)}" y2="{_round(y2, 2)}" stroke="#334155" stroke-width="{_round(stroke_width, 2)}" stroke-opacity="{_round(opacity, 2)}" stroke-linecap="round" marker-end="url(#arrow)"/>'
        )
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        parts.append(
            f'<text x="{_round(mx + 6, 2)}" y="{_round(my - 6, 2)}" font-family="Arial, sans-serif" font-size="11" fill="#334155">{html.escape(_as_text(edge.get("edge_id"), ""))}</text>'
        )

    for site in sites:
        x, y = point(site["site_id"])
        priority = max(1, _as_int(site.get("priority"), 1))
        radius = max(7.0, 12.0 - min(priority - 1, 4) * 1.1)
        fill = _svg_color_for_elevation(site["elevation_m"], min_elev, max_elev)
        site_id = html.escape(site["site_id"])
        site_name = html.escape(site["site_name"])
        elevation = html.escape(f"{_round(site['elevation_m'], 1)} m")
        parts.extend(
            [
                f'<circle cx="{_round(x, 2)}" cy="{_round(y, 2)}" r="{_round(radius, 2)}" fill="{fill}" stroke="#0f172a" stroke-width="1.2"/>',
                f'<text x="{_round(x + radius + 5, 2)}" y="{_round(y - 4, 2)}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#0f172a">{site_id}</text>',
                f'<text x="{_round(x + radius + 5, 2)}" y="{_round(y + 12, 2)}" font-family="Arial, sans-serif" font-size="11" fill="#475569">{site_name} · {elevation}</text>',
            ]
        )

    parts.append("</svg>")
    return "\n".join(parts)


def _graph_visual_legend(svg_file_id: str) -> str:
    svg_note = "SVG 文件已生成，可直接查看。" if svg_file_id else "当前运行环境未返回 SVG 文件 ID，请重新运行或检查文件上传配置。"
    return "\n".join(
        [
            "- Mermaid 流向图适合快速看拓扑关系，重点看谁流向谁。",
            "- SVG 平面示意图适合看空间位置关系，节点按经纬度近似投影，默认北向上。",
            "- 节点颜色表示海拔：蓝色较低，橙色较高；箭头由高程较高站点指向低程候选站点。",
            "- 连线粗细和透明度表示置信度，越粗越深代表距离、高差和坡度组合更符合规则。",
            f"- {svg_note}",
        ]
    )


def _try_upload_svg(svg_code: str) -> str:
    try:
        uploaded = _client().upload_file_bytes(
            file_name="monitoring_site_flow_graph.svg",
            file_bytes=svg_code.encode("utf-8"),
        )
        return _as_text(uploaded.get("id")) if isinstance(uploaded, dict) else ""
    except Exception:
        return ""


@assigner(
    assigned_fields=[
        "graph_generation_note",
    ],
    dependent_fields=[
        "site_csv_file",
        "monitoring_sites",
        "max_link_distance_km",
        "min_link_distance_m",
        "min_elevation_drop_m",
        "max_slope_m_per_km",
        "min_slope_m_per_km",
        "max_downstream_edges_per_site",
        "prefer_nearest_lower_site",
        "avoid_crossing_edges",
        "allow_equal_elevation_edges",
        "manual_edges",
        "blocked_edges",
    ],
    mode="manual",
)
def generate_physical_graph(dependent_fields) -> AssignerResult:
    try:
        edges, context, xy = _infer_edges(dependent_fields)
        sites = context["sites"]
        diagnostics = context["diagnostics"]
        svg_code = _graph_svg_code(edges, sites, xy)
        svg_file_id = _try_upload_svg(svg_code)
        graph_summary = (
            f"共读取 {len(sites)} 个站点，按距离、高程差、坡度和出边数量约束生成 {len(edges)} 条有向候选边。"
            "边方向表示几何上可能由高程较高站点流向低程站点，仍需 DEM、河网、管网或现场资料复核。"
        )
        recommendations = "\n".join(
            [
                "- 对低坡度、低高程差或人工强制边，优先用 DEM、实测流向、河网或管网资料复核。",
                "- 对无出边站点，判断其是否为真实汇出口、湖库、断面终点，或是否因为最大距离过小导致断连。",
                "- 对无入边站点，判断其是否为真实源头、坡面输入点，或是否缺失上游站点。",
                "- 如果海拔精度接近最小高程差，应提高最小高程差阈值或使用更高精度 DEM。",
            ]
        )
        return AssignerResult(
            assigned_fields={
                "graph_generation_note": "物理约束图生成完成，已同步生成 Mermaid 流向图和 SVG 平面示意图。",
                "graph_summary": graph_summary,
                "inferred_edges": edges,
                "adjacency_list": _adjacency_markdown(edges, sites),
                "graph_visual_legend": _graph_visual_legend(svg_file_id),
                "graph_mermaid_preview": _graph_mermaid_preview(edges, sites),
                "graph_svg_file": svg_file_id,
                "graph_diagnostics": _graph_diagnostics_markdown(edges, sites, diagnostics),
                "graph_review_recommendations": recommendations,
            }
        )
    except Exception as exc:
        return AssignerResult(
            assigned_fields={
                "graph_generation_note": f"物理约束图生成失败：{exc}",
                "graph_summary": "",
                "inferred_edges": [],
                "adjacency_list": "",
                "graph_visual_legend": "",
                "graph_mermaid_preview": "",
                "graph_svg_file": "",
                "graph_diagnostics": "",
                "graph_review_recommendations": "",
            }
        )


def _existing_or_generated_edges(dependent_fields: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, tuple[float, float]]]:
    sites = _resolve_sites(dependent_fields)
    xy = _project_sites(sites)
    raw_edges = dependent_fields.get("inferred_edges")
    if isinstance(raw_edges, list) and raw_edges:
        edges: list[dict[str, Any]] = []
        for idx, row in enumerate(raw_edges, start=1):
            from_id = _as_text(_row_get(row, "from_site_id")).strip()
            to_id = _as_text(_row_get(row, "to_site_id")).strip()
            if not from_id or not to_id:
                continue
            edges.append(
                {
                    "edge_id": _as_text(_row_get(row, "edge_id"), f"E{idx:03d}"),
                    "from_site_id": from_id,
                    "to_site_id": to_id,
                    "confidence_score": _as_float(_row_get(row, "confidence_score"), 0.5),
                    "distance_km": _as_float(_row_get(row, "distance_km"), 0.0),
                }
            )
        return edges, sites, xy
    edges, context, xy = _infer_edges(dependent_fields)
    return edges, context["sites"], xy


@assigner(
    assigned_fields=[
        "print_parameter_summary",
    ],
    dependent_fields=[
        "site_csv_file",
        "monitoring_sites",
        "inferred_edges",
        "max_link_distance_km",
        "min_link_distance_m",
        "min_elevation_drop_m",
        "max_slope_m_per_km",
        "min_slope_m_per_km",
        "max_downstream_edges_per_site",
        "prefer_nearest_lower_site",
        "avoid_crossing_edges",
        "allow_equal_elevation_edges",
        "manual_edges",
        "blocked_edges",
        "printer_type",
        "print_material",
        "print_bed_x_mm",
        "print_bed_y_mm",
        "max_model_height_mm",
        "print_margin_mm",
        "base_thickness_mm",
        "min_node_diameter_mm",
        "max_node_diameter_mm",
        "edge_strut_diameter_mm",
        "min_printable_feature_mm",
        "z_exaggeration",
        "label_height_mm",
    ],
    mode="manual",
)
def generate_3d_print_parameters(dependent_fields) -> AssignerResult:
    try:
        edges, sites, xy = _existing_or_generated_edges(dependent_fields)
        if not sites:
            raise ValueError("至少需要一个站点才能生成打印参数")

        bed_x = _as_float(dependent_fields.get("print_bed_x_mm"), 220.0)
        bed_y = _as_float(dependent_fields.get("print_bed_y_mm"), 220.0)
        max_height = _as_float(dependent_fields.get("max_model_height_mm"), 80.0)
        margin = _as_float(dependent_fields.get("print_margin_mm"), 12.0)
        base = _as_float(dependent_fields.get("base_thickness_mm"), 3.0)
        min_node = _as_float(dependent_fields.get("min_node_diameter_mm"), 4.0)
        max_node = max(min_node, _as_float(dependent_fields.get("max_node_diameter_mm"), 8.0))
        strut = _as_float(dependent_fields.get("edge_strut_diameter_mm"), 2.0)
        min_feature = _as_float(dependent_fields.get("min_printable_feature_mm"), 1.2)
        z_exaggeration = _as_float(dependent_fields.get("z_exaggeration"), 2.0)
        label_height = _as_float(dependent_fields.get("label_height_mm"), 1.0)

        xs = [xy[site["site_id"]][0] for site in sites]
        ys = [xy[site["site_id"]][1] for site in sites]
        elevations = [site["elevation_m"] for site in sites]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        min_elev, max_elev = min(elevations), max(elevations)
        range_x = max(max_x - min_x, 1.0)
        range_y = max(max_y - min_y, 1.0)
        range_elev = max(max_elev - min_elev, 0.001)
        usable_x = max(bed_x - 2 * margin, 1.0)
        usable_y = max(bed_y - 2 * margin, 1.0)
        xy_scale = min(usable_x / range_x, usable_y / range_y)
        usable_z = max(max_height - base - max_node / 2 - label_height, 1.0)
        z_scale = min(usable_z / range_elev, xy_scale * max(z_exaggeration, 0.001))
        model_x = range_x * xy_scale + 2 * margin
        model_y = range_y * xy_scale + 2 * margin
        model_z = base + range_elev * z_scale + max_node / 2 + label_height

        print_nodes: list[dict[str, Any]] = []
        for site in sites:
            x_m, y_m = xy[site["site_id"]]
            priority = max(1, int(site["priority"]))
            diameter = max(min_node, max_node - (priority - 1) * 1.0)
            print_nodes.append(
                {
                    "site_id": site["site_id"],
                    "x_mm": _round(margin + (x_m - min_x) * xy_scale, 3),
                    "y_mm": _round(margin + (y_m - min_y) * xy_scale, 3),
                    "z_mm": _round(base + (site["elevation_m"] - min_elev) * z_scale, 3),
                    "node_diameter_mm": _round(diameter, 3),
                    "label": site["site_id"],
                }
            )

        node_ids = {node["site_id"] for node in print_nodes}
        print_edges = [
            {
                "edge_id": edge.get("edge_id", f"E{idx:03d}"),
                "from_site_id": edge["from_site_id"],
                "to_site_id": edge["to_site_id"],
                "strut_diameter_mm": _round(max(strut, min_feature), 3),
                "print_note": "连杆表示候选流向；箭头方向由高程较高站点指向低程站点",
            }
            for idx, edge in enumerate(edges, start=1)
            if edge["from_site_id"] in node_ids and edge["to_site_id"] in node_ids
        ]

        node_block = ",\n  ".join(
            f'["{node["site_id"]}", {node["x_mm"]}, {node["y_mm"]}, {node["z_mm"]}, {node["node_diameter_mm"]}]'
            for node in print_nodes
        )
        edge_block = ",\n  ".join(
            f'["{edge["edge_id"]}", "{edge["from_site_id"]}", "{edge["to_site_id"]}", {edge["strut_diameter_mm"]}]'
            for edge in print_edges
        )
        openscad = f"""// Units: mm. Use these arrays as a CAD/OpenSCAD parameter block.
base_size = [{_round(model_x, 3)}, {_round(model_y, 3)}, {_round(base, 3)}];
node_data = [
  {node_block}
];
edge_data = [
  {edge_block}
];
label_height = {_round(label_height, 3)};
xy_scale_mm_per_m = {_round(xy_scale, 6)};
z_scale_mm_per_m = {_round(z_scale, 6)};
"""

        risks: list[str] = []
        if strut < min_feature:
            risks.append(f"边线直径 {strut} mm 小于最小可打印特征 {min_feature} mm，已在输出中提升到最小特征。")
        if min_node < min_feature:
            risks.append(f"节点直径下限 {min_node} mm 小于最小可打印特征 {min_feature} mm，建议增大节点。")
        if model_x > bed_x or model_y > bed_y:
            risks.append("模型平面尺寸超过打印床，请增大打印床、减小边距或缩小 XY 比例。")
        if model_z > max_height:
            risks.append("模型高度超过最大模型高度，请降低 Z 轴夸张系数或最大节点直径。")
        if not risks:
            risks.append("当前参数满足床面尺寸和最小特征的基本检查；正式打印前仍需在切片软件中检查悬空、连杆角度和标签可读性。")

        summary = "\n".join(
            [
                f"- 打印机类型：{_as_text(dependent_fields.get('printer_type'), 'FDM')}；材料：{_as_text(dependent_fields.get('print_material'), 'PLA')}",
                f"- 模型平面尺寸：{_round(model_x, 2)} mm x {_round(model_y, 2)} mm",
                f"- 模型高度估计：{_round(model_z, 2)} mm",
                f"- XY 比例：{_round(xy_scale, 6)} mm/m",
                f"- Z 比例：{_round(z_scale, 6)} mm/m",
                f"- 节点数：{len(print_nodes)}；连杆数：{len(print_edges)}",
                f"- 底板厚度：{_round(base, 2)} mm；连杆直径：{_round(max(strut, min_feature), 2)} mm",
            ]
        )
        return AssignerResult(
            assigned_fields={
                "print_parameter_summary": summary,
                "print_nodes": print_nodes,
                "print_edges": print_edges,
                "openscad_parameter_block": openscad,
                "print_risk_note": "\n".join(f"- {risk}" for risk in risks),
            }
        )
    except Exception as exc:
        return AssignerResult(
            assigned_fields={
                "print_parameter_summary": f"3D 打印参数生成失败：{exc}",
                "print_nodes": [],
                "print_edges": [],
                "openscad_parameter_block": "",
                "print_risk_note": "",
            }
        )


class Assigner:
    @classmethod
    def all_assigned_fields(cls) -> dict[str, dict[str, object]]:
        return DefaultAssigner.all_assigned_fields()

    @classmethod
    def export_dependency_graph_to_dict(cls) -> dict[str, object]:
        return DefaultAssigner.export_dependency_graph_to_dict()

    @classmethod
    def get_dependent_fields_of_assigned_key(cls, assigned_key: str) -> list[str]:
        return DefaultAssigner.get_dependent_fields_of_assigned_key(assigned_key)

    @classmethod
    def assign(cls, assigned_key: str, dependent_data: dict) -> AssignerResult:
        merged = dict(DEFAULT_DEPENDENT_DATA)
        if isinstance(dependent_data, dict):
            merged.update({key: value for key, value in dependent_data.items() if value is not None})
        return DefaultAssigner.assign(assigned_key, merged)
