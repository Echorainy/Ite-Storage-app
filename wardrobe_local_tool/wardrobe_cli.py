#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量调用同一个视觉 API 处理 input 文件夹。"""

from __future__ import annotations

import argparse
from pathlib import Path

from vision_api import analyze_and_save

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def main() -> int:
    parser = argparse.ArgumentParser(description="智能衣柜视觉 API 批处理")
    parser.add_argument("input_dir", type=Path, help="输入图片文件夹")
    parser.add_argument("--output-dir", type=Path, default=Path("output"))
    parser.add_argument("--db", type=Path, default=Path("wardrobe.db"))
    args = parser.parse_args()
    input_dir = args.input_dir.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()
    db_path = args.db.expanduser().resolve()
    if not input_dir.is_dir():
        print(f"[错误] 输入文件夹不存在：{input_dir}")
        return 2
    files = sorted((p for p in input_dir.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS), key=lambda p: p.name.lower())
    if not files:
        print(f"[提示] 没有找到图片：{input_dir}")
        return 0
    success = 0
    for source in files:
        print(f"[处理中] {source.name} -> 视觉识别", flush=True)
        try:
            result = analyze_and_save(source, source.name, output_dir, db_path)
            print(f"[完成] {source.name}: category={result['category']}, color={result['color']}, material={result['material']}, season={result['season']}", flush=True)
            success += 1
        except Exception as exc:
            print(f"[失败] {source.name}: {exc}")
    print(f"[总结] 成功处理 {success}/{len(files)} 张图片")
    print(f"[总结] 数据库：{db_path}")
    return 0 if success == len(files) else 1


if __name__ == "__main__":
    raise SystemExit(main())
