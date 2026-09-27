#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地上传服务：网页上传图片后调用 OpenAI 兼容视觉模型并入库。"""

from __future__ import annotations

import os
import shutil
import json
import urllib.parse
import urllib.request
import uuid
from urllib.parse import quote
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from vision_api import analyze_and_save, ensure_db, export_json, load_dotenv, safe_upload_name


ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"
DB_PATH = ROOT / "wardrobe.db"
WEB_INDEX = ROOT.parent / "index.html"
UPLOAD_DIR = OUTPUT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv(ROOT / ".env")

app = FastAPI(title="智能衣柜视觉识别服务")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/files", StaticFiles(directory=str(OUTPUT_DIR)), name="files")


WEATHER_LABELS = {
    0: "晴朗", 1: "晴间多云", 2: "局部多云", 3: "阴天",
    45: "雾", 48: "雾", 51: "小雨", 53: "小雨", 55: "小雨",
    56: "冻雨", 57: "冻雨", 61: "小雨", 63: "中雨", 65: "大雨",
    66: "冻雨", 67: "冻雨", 71: "小雪", 73: "中雪", 75: "大雪",
    77: "雪粒", 80: "阵雨", 81: "阵雨", 82: "强阵雨",
    85: "阵雪", 86: "阵雪", 95: "雷雨", 96: "雷雨伴冰雹", 99: "雷雨伴冰雹",
}


def _open_meteo_json(url: str) -> dict[str, object]:
    request = urllib.request.Request(url, headers={"User-Agent": "smart-wardrobe/1.0"})
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def _reverse_city(latitude: float, longitude: float) -> str:
    try:
        url = "https://api.bigdatacloud.net/data/reverse-geocode-client?" + urllib.parse.urlencode({
            "latitude": latitude, "longitude": longitude, "localityLanguage": "zh",
        })
        data = _open_meteo_json(url)
        return str(data.get("city") or data.get("locality") or "当前位置")
    except Exception:
        return "当前位置"


def _weather_days(city: str = "", days: int = 7, latitude: float | None = None, longitude: float | None = None) -> dict[str, object]:
    city = (city or "").strip()
    days = max(1, min(int(days), 7))
    if latitude is not None and longitude is not None:
        lat, lon = float(latitude), float(longitude)
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise RuntimeError("定位坐标无效")
        resolved_city = _reverse_city(lat, lon)
        location = {"name": resolved_city, "latitude": lat, "longitude": lon}
    else:
        city = city or "上海"
        geo_url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode({
            "name": city, "count": 1, "language": "zh", "format": "json",
        })
        geo = _open_meteo_json(geo_url)
        results = geo.get("results") or []
        if not results and city.endswith("市"):
            geo_url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode({
                "name": city[:-1], "count": 1, "language": "zh", "format": "json",
            })
            results = (_open_meteo_json(geo_url).get("results") or [])
        if not results:
            raise RuntimeError(f"找不到城市：{city}")
        location = results[0]
        lat = float(location["latitude"])
        lon = float(location["longitude"])
    forecast_url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,apparent_temperature,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
        "timezone": "auto", "forecast_days": days,
    })
    forecast = _open_meteo_json(forecast_url)
    current = forecast.get("current") or {}
    daily = forecast.get("daily") or {}
    dates = daily.get("time") or []
    high = daily.get("temperature_2m_max") or []
    low = daily.get("temperature_2m_min") or []
    rain = daily.get("precipitation_probability_max") or []
    codes = daily.get("weather_code") or []
    winds = daily.get("wind_speed_10m_max") or []
    weather = []
    for i, date in enumerate(dates[:days]):
        code = int(codes[i]) if i < len(codes) and codes[i] is not None else 0
        wind_speed = float(winds[i]) if i < len(winds) and winds[i] is not None else 0
        weather.append({
            "date": date,
            "highC": round(float(high[i]), 1) if i < len(high) else None,
            "lowC": round(float(low[i]), 1) if i < len(low) else None,
            "condition": WEATHER_LABELS.get(code, "多云"),
            "rainProbability": int(rain[i]) if i < len(rain) and rain[i] is not None else 0,
            "windLevel": min(5, round(wind_speed / 10)),
            "feelsLikeC": round(float(current.get("apparent_temperature", high[i] if i < len(high) else 0)), 1) if i == 0 else round((float(high[i]) + float(low[i])) / 2, 1),
        })
    return {
        "city": location.get("name") or city or "当前位置",
        "location": {"name": location.get("name") or city or "当前位置", "latitude": lat, "longitude": lon, "timezone": forecast.get("timezone")},
        "days": weather,
    }


def _wardrobe_items_for_recommendation() -> list[dict[str, object]]:
    conn = ensure_db(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT id, filename, category, color, material, season, cutout_path FROM wardrobe ORDER BY id"
        ).fetchall()
    finally:
        conn.close()
    groups = {
        "top": {"T恤", "衬衫", "Polo", "针织衫", "毛衣", "卫衣", "背心/吊带", "正装衬衫", "马甲"},
        "bottom": {"牛仔裤", "休闲裤", "阔腿裤", "西裤", "西装裤", "西裤/西装裤", "工装裤", "短裤"},
        "outerwear": {"夹克", "牛仔外套", "西装", "风衣", "大衣", "羽绒服/棉服"},
        "dress": {"连衣裙", "半身裙", "百褶裙", "短裙", "长裙", "短裙/长裙"},
    }
    items: list[dict[str, object]] = []
    for row in rows:
        category = str(row[2] or "")
        slot = next((key for key, values in groups.items() if category in values), None)
        if slot == "dress":
            slot = "top"
        if slot is None:
            continue
        stored = Path(str(row[6]))
        try:
            relative = stored.resolve().relative_to(OUTPUT_DIR.resolve()).as_posix()
            image_url = "/files/" + quote(relative, safe="/")
        except ValueError:
            image_url = "/files/cutout/" + quote(stored.name)
        items.append({
            "id": str(row[0]), "name": category or str(row[1]), "image_url": image_url,
            "category": slot, "color": row[3], "material": row[4],
            "season": [row[5]] if row[5] else ["四季"], "status": "available",
            "warmth": 4 if category in {"大衣", "羽绒服/棉服", "毛衣"} else 2,
        })
    return items


@app.get("/api/weather")
def weather(city: str = "", days: int = 7, latitude: float | None = None, longitude: float | None = None) -> dict[str, object]:
    try:
        return _weather_days(city, days, latitude, longitude)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"获取真实天气失败：{exc}") from exc


@app.get("/api/recommendations")
def recommendations(city: str = "", days: int = 7, latitude: float | None = None, longitude: float | None = None) -> dict[str, object]:
    try:
        weather_data = _weather_days(city, days, latitude, longitude)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"获取真实天气失败：{exc}") from exc
    items = _wardrobe_items_for_recommendation()
    plans = []
    for index, day in enumerate(weather_data["days"]):
        slots = []
        for slot_name in ("top", "bottom", "outerwear", "shoes"):
            choices = [item for item in items if item["category"] == slot_name]
            item = choices[index % len(choices)] if choices else None
            slots.append({"category": slot_name, "item": item})
        gaps = [slot["category"] for slot in slots if slot["item"] is None]
        high = float(day.get("highC") or 0)
        rain = int(day.get("rainProbability") or 0)
        reason = f"结合{weather_data['city']}体感 {day.get('feelsLikeC')}° 和衣柜库存推荐。"
        if high < 16:
            reason += "温度偏低，优先选择保暖外套。"
        elif high >= 26:
            reason += "天气偏暖，建议减少叠穿。"
        if rain >= 50:
            reason += "降雨概率较高，出门记得带伞。"
        plans.append({
            "date": day["date"], "weather": day, "scene": {"scene": "自动搭配"}, "slots": slots,
            "scores": {"style": 86, "weather": 68 if rain >= 50 else 91, "scene": 88, "warmth": 78, "activity": 84},
            "reason": reason, "gaps": gaps,
        })
    return {"city": weather_data["city"], "plans": plans}


@app.post("/api/chat")
async def chat(payload: dict[str, object]) -> dict[str, str]:
    message = str(payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="请输入想咨询的穿搭问题")
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="未配置 DeepSeek API key")
    try:
        from openai import OpenAI
        supplied_wardrobe = payload.get("wardrobe")
        wardrobe = supplied_wardrobe if isinstance(supplied_wardrobe, list) else _wardrobe_items_for_recommendation()
        supplied_weather = payload.get("weather")
        client = OpenAI(api_key=api_key, base_url=os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com").strip())
        response = client.chat.completions.create(
            model=os.environ.get("CHAT_MODEL", os.environ.get("VISION_MODEL", "deepseek-chat")),
            temperature=0.4,
            messages=[
                {"role": "system", "content": "你是智能衣柜穿搭顾问。只根据用户衣柜中的衣物给出具体、简洁、可执行的中文建议；如果衣柜没有合适单品，要明确说缺少什么。"},
                {"role": "user", "content": f"当前衣柜数据：{json.dumps(wardrobe, ensure_ascii=False)}\n今日天气：{json.dumps(supplied_weather, ensure_ascii=False)}\n用户问题：{message}"},
            ],
        )
        return {"answer": response.choices[0].message.content or "暂时没有生成建议。"}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"DeepSeek 对话失败：{exc}") from exc


@app.get("/", include_in_schema=False)
def home() -> dict[str, str]:
    return {"service": "smart-wardrobe", "status": "ok", "message": "请从 Outfit App 上传衣物并查看搭配。"}


@app.get("/api/items")
def items() -> list[dict[str, str]]:
    conn = ensure_db(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT filename, category, color, material, season, cutout_path, created_at FROM wardrobe ORDER BY id DESC"
        ).fetchall()
        result = []
        for row in rows:
            stored = Path(row[5])
            try:
                relative = stored.resolve().relative_to(OUTPUT_DIR.resolve()).as_posix()
                image_url = "/files/" + quote(relative, safe="/")
            except ValueError:
                image_url = "/files/uploads/" + quote(stored.name)
            result.append({
                "filename": row[0], "name": row[0], "type": row[1], "category": row[1],
                "color": row[2], "material": row[3], "season": row[4],
                "cutout_path": row[5], "created_at": row[6], "image": image_url,
            })
        return result
    finally:
        conn.close()


@app.get("/api/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "smart-wardrobe", "deepseek_configured": bool(os.environ.get("OPENAI_API_KEY", "").strip())}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)) -> dict[str, object]:
    original_name = safe_upload_name(file.filename or "upload.png")
    suffix = Path(original_name).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        content_type = (file.content_type or "").lower()
        suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(content_type, ".jpg")
        original_name = f"upload_{uuid.uuid4().hex}{suffix}"
    destination = UPLOAD_DIR / original_name
    try:
        with destination.open("wb") as output:
            shutil.copyfileobj(file.file, output)
        result = analyze_and_save(destination, original_name, OUTPUT_DIR, DB_PATH)
    except Exception as exc:
        if destination.exists():
            destination.unlink()
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    cutout = Path(str(result.get("cutout_path", "")))
    try:
        relative = cutout.resolve().relative_to(OUTPUT_DIR.resolve()).as_posix()
        result["image"] = "/files/" + quote(relative, safe="/")
    except ValueError:
        result["image"] = "/files/uploads/" + quote(original_name)
    return {"ok": True, "item": result}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), reload=False)
