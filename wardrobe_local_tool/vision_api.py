#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OpenAI 兼容视觉接口 + 衣柜 SQLite 存储。

这里不再加载 FashionCLIP、torch 或本地分类模型。图片只在本地准备后，
由用户配置的 OpenAI 兼容视觉模型返回结构化衣物信息。
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image

CATEGORIES = [
    "T恤", "衬衫", "Polo", "针织衫", "毛衣", "卫衣", "背心/吊带", "正装衬衫", "马甲",
    "牛仔裤", "休闲裤", "阔腿裤", "西裤", "西装裤", "工装裤", "短裤",
    "连衣裙", "半身裙", "百褶裙", "短裙", "长裙", "短裙/长裙",
    "夹克", "牛仔外套", "西装", "风衣", "大衣", "羽绒服/棉服", "其他衣物",
]
COLORS = ["黑色", "白色", "红色", "蓝色", "绿色", "黄色", "粉色", "紫色", "灰色", "棕色", "米色", "卡其色", "橙色", "牛仔蓝"]
SEASONS = ["四季", "春季", "夏季", "秋季", "冬季"]

_cutout_session: Any = None


def load_dotenv(path: Path) -> None:
    """读取简单 .env，不覆盖已经存在的系统环境变量。"""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS wardrobe (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            color TEXT NOT NULL,
            material TEXT NOT NULL,
            season TEXT NOT NULL,
            cutout_path TEXT NOT NULL,
            embedding BLOB NOT NULL DEFAULT X'',
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def export_json(conn: sqlite3.Connection, json_path: Path) -> None:
    rows = conn.execute(
        "SELECT filename, category, color, material, season, cutout_path, created_at FROM wardrobe ORDER BY id"
    ).fetchall()
    data = [
        {
            "filename": row[0], "category": row[1], "color": row[2],
            "material": row[3], "season": row[4], "cutout_path": row[5],
            "created_at": row[6],
        }
        for row in rows
    ]
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _first_allowed(value: Any, allowed: list[str], fallback: str) -> str:
    text = str(value or "").strip()
    if text in allowed:
        return text
    for item in allowed:
        if item in text or text.lower() == item.lower():
            return item
    return fallback


def normalize_result(raw: dict[str, Any], filename: str) -> dict[str, str]:
    category = _first_allowed(raw.get("category"), CATEGORIES, "其他衣物")
    color = _first_allowed(raw.get("color"), COLORS, "未设置")
    season = _first_allowed(raw.get("season"), SEASONS, "四季")
    material = str(raw.get("material") or "未知").strip()[:80]
    description = str(raw.get("description") or "").strip()[:300]
    name = str(raw.get("name") or f"{color}{category}").strip()[:120]
    return {
        "filename": filename,
        "name": name or filename,
        "category": category,
        "color": color,
        "material": material or "未知",
        "season": season,
        "description": description,
    }


def _json_from_text(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        value = json.loads(text)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            raise RuntimeError(f"视觉模型没有返回 JSON：{text[:300]}")
        value = json.loads(match.group(0))
        return value if isinstance(value, dict) else {}


def image_data_url(path: Path) -> str:
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(path.suffix.lower(), "image/png")
    return f"data:{mime};base64,{data}"


def cutout_image(source: Path, target: Path) -> Path:
    """Use BiRefNet through rembg and save an RGBA transparent PNG."""
    global _cutout_session
    try:
        from rembg import new_session, remove
    except ImportError as exc:
        raise RuntimeError("缺少 rembg，请运行 setup.ps1 安装 BiRefNet 抠图依赖。") from exc
    target.parent.mkdir(parents=True, exist_ok=True)
    if _cutout_session is None:
        model_name = os.environ.get("CUTOUT_MODEL", "birefnet-general").strip() or "birefnet-general"
        print(f"[信息] 加载抠图模型 {model_name}（首次运行会下载模型）...", flush=True)
        try:
            _cutout_session = new_session(model_name)
        except Exception as exc:
            raise RuntimeError(f"BiRefNet 模型加载失败：{exc}。请检查网络，或确认模型已缓存。") from exc
    try:
        output = remove(source.read_bytes(), session=_cutout_session)
        with Image.open(io.BytesIO(output)) as image:
            image.convert("RGBA").save(target, format="PNG")
    except Exception as exc:
        raise RuntimeError(f"BiRefNet 抠图失败：{exc}") from exc
    return target


def analyze_image(image_path: Path, filename: str) -> dict[str, str]:
    load_dotenv(Path(__file__).resolve().with_name(".env"))
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("未设置 OPENAI_API_KEY。请在 wardrobe_local_tool/.env 中填写 API key。")
    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("缺少 openai 包，请运行 pip install -r requirements.txt") from exc

    client = OpenAI(
        api_key=api_key,
        base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").strip(),
    )
    prompt = f"""你是衣物识别助手。请识别这张图片中的主要衣物，只返回一个 JSON 对象，不要 Markdown。
字段必须是：name, category, color, material, season, description。
category 必须从以下选项中选一个：{', '.join(CATEGORIES)}。
color 必须从以下选项中选一个：{', '.join(COLORS)}。
season 必须从以下选项中选一个：{', '.join(SEASONS)}。
material 用中文简短描述视觉上推测的面料，例如棉、牛仔、针织、羊毛、皮革、涤纶或未知。
图片文件名是 {filename}。材质只是视觉推测，无法替代实物检测。"""
    try:
        response = client.chat.completions.create(
            model=os.environ.get("VISION_MODEL", "deepseek-flash"),
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url(image_path)}},
                    ],
                }
            ],
        )
    except Exception as exc:
        status = getattr(exc, "status_code", None)
        error_text = str(exc)
        if status == 401 or "invalid_api_key" in error_text or "Incorrect API key" in error_text:
            base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
            raise RuntimeError(
                f"API key 无效或与接口地址不匹配（当前接口：{base_url}）。"
                "请在 .env 中填写该接口对应的有效视觉模型 API key；"
                "如果这串 key 已发到聊天或公开位置，请先在服务商后台撤销并重新生成。"
            ) from exc
        if status in {400, 404, 422} and any(term in error_text.lower() for term in ("image_url", "image input", "vision", "multimodal", "image modality")):
            raise RuntimeError(
                "当前 DeepSeek 接口或模型不支持图片输入。请在控制台选择支持视觉/多模态的模型，"
                "并把模型名填入 .env 的 VISION_MODEL。"
            ) from exc
        raise RuntimeError(f"视觉接口调用失败：{exc}") from exc
    content = response.choices[0].message.content or "{}"
    return normalize_result(_json_from_text(content), filename)


def save_result(conn: sqlite3.Connection, result: dict[str, str], image_path: Path) -> None:
    conn.execute(
        """
        INSERT INTO wardrobe(filename, category, color, material, season, cutout_path, embedding, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET
            category=excluded.category, color=excluded.color, material=excluded.material,
            season=excluded.season, cutout_path=excluded.cutout_path, created_at=excluded.created_at
        """,
        (
            result["filename"], result["category"], result["color"], result["material"],
            result["season"], str(image_path), sqlite3.Binary(b""), utc_now(),
        ),
    )
    conn.commit()


def analyze_and_save(image_path: Path, filename: str, output_dir: Path, db_path: Path) -> dict[str, str]:
    temp_cutout = output_dir / "cutout" / f".processing_{uuid.uuid4().hex}.png"
    cutout_image(image_path, temp_cutout)
    result = analyze_image(temp_cutout, filename)
    # Give both the uploaded source and transparent cutout a useful, searchable name.
    # Example: black T-shirt -> 黑色T恤.jpg / 黑色T恤.png.
    base_name = re.sub(r"[\\/:*?\"<>|]", "", f"{result['color']}{result['category']}").strip() or "未命名衣物"
    extension = Path(filename).suffix.lower() if Path(filename).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
    conn = ensure_db(db_path)
    try:
        existing = {str(row[0]) for row in conn.execute("SELECT filename FROM wardrobe").fetchall()}
    finally:
        conn.close()
    candidate = f"{base_name}{extension}"
    serial = 2
    while candidate in existing:
        candidate = f"{base_name}_{serial}{extension}"
        serial += 1
    renamed_source = image_path.with_name(candidate)
    if image_path != renamed_source:
        image_path.replace(renamed_source)
    cutout_path = output_dir / "cutout" / f"{Path(candidate).stem}.png"
    temp_cutout.replace(cutout_path)
    result["filename"] = candidate
    result["name"] = Path(candidate).stem
    conn = ensure_db(db_path)
    try:
        save_result(conn, result, cutout_path)
        export_json(conn, output_dir / "wardrobe.json")
    finally:
        conn.close()
    result["cutout_path"] = str(cutout_path)
    return result


def safe_upload_name(name: str) -> str:
    cleaned = re.sub(r"[^\w.\-一-龥 ]+", "_", Path(name).name).strip(" .")
    return cleaned or f"upload_{uuid.uuid4().hex}.png"
