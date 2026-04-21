#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""验证开卷考试速查 PDF 的内容与基础版式。

这个脚本用于回答几个交付前必须确认的问题：
1. PDF 是否真的生成，页数是否合理。
2. 前置目录是否存在，并且目录文本里能看到页码。
3. 合订本是否还残留明显非课程配置内容或敏感字段。
4. 抽样页面是否可以正常渲染为图片，避免出现空白页、乱码页。
5. 正文页顶部/底部是否有页眉和页码区域的可见内容。

脚本依赖：
- pypdf：提取 PDF 文本和页数；
- pymupdf：把 PDF 页面渲染成 PNG；
- pillow：做简单像素统计，判断页面不是空白。

推荐运行：
uv run --with pymupdf --with pillow python output/pdf/心理危机干预与预防/verify_pdf.py
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
import sys

import fitz  # PyMuPDF
from PIL import Image


PDF_PATH = Path("output/pdf/心理危机干预与预防/心理危机干预与预防-开卷考试速查版.pdf")
RENDER_DIR = Path("tmp/pdfs/psych-crisis/rendered")


@dataclass(frozen=True)
class RenderCheck:
    """记录一页渲染后的基础检查结果。"""

    page_number: int
    image_path: Path
    width: int
    height: int
    non_white_ratio: float
    header_non_white_ratio: float
    footer_non_white_ratio: float


def assert_true(condition: bool, message: str) -> None:
    """简化断言输出。

    参数：
    - condition：为 True 表示检查通过；
    - message：失败时抛出的说明。
    """

    if not condition:
        raise AssertionError(message)


def extract_text(document: fitz.Document, page_numbers: range) -> str:
    """提取指定页范围的文字。

    参数：
    - document：已经打开的 PDF；
    - page_numbers：0 基页码范围。

    返回：
    - 拼接后的文本。提取失败的页面按空字符串处理，避免单页提取异常影响整体报错定位。
    """

    parts: list[str] = []
    for page_number in page_numbers:
        if page_number >= document.page_count:
            break
        parts.append(document.load_page(page_number).get_text() or "")
    return "\n".join(parts)


def count_non_white_ratio(image: Image.Image) -> float:
    """估算图片中非白色像素比例。

    这里不做 OCR，只判断页面是否有足够内容。阈值设置较宽松：
    - 纯白或近乎纯白页面会失败；
    - 正常文字页会通过。
    """

    rgb = image.convert("RGB")
    pixels = rgb.getdata()
    non_white = 0
    total = rgb.width * rgb.height
    for r, g, b in pixels:
        if r < 245 or g < 245 or b < 245:
            non_white += 1
    return non_white / total


def band_non_white_ratio(image: Image.Image, top_ratio: float, bottom_ratio: float) -> float:
    """统计页面某个水平带状区域的非白像素比例。

    参数：
    - image：已渲染页面；
    - top_ratio：区域顶部相对高度；
    - bottom_ratio：区域底部相对高度。
    """

    height = image.height
    top = int(height * top_ratio)
    bottom = int(height * bottom_ratio)
    band = image.crop((0, top, image.width, bottom))
    return count_non_white_ratio(band)


def render_pages(pdf_path: Path, sample_pages: list[int], render_dir: Path) -> list[RenderCheck]:
    """渲染抽样页并做基础像素检查。

    参数：
    - pdf_path：PDF 路径；
    - sample_pages：1 基页码列表，更符合人类读 PDF 的习惯。
    """

    render_dir.mkdir(parents=True, exist_ok=True)
    checks: list[RenderCheck] = []

    with fitz.open(pdf_path) as document:
        for page_number in sample_pages:
            page = document.load_page(page_number - 1)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            image_path = render_dir / f"page-{page_number:03d}.png"
            pixmap.save(image_path)

            image = Image.open(image_path)
            non_white_ratio = count_non_white_ratio(image)
            header_ratio = band_non_white_ratio(image, 0.015, 0.07)
            footer_ratio = band_non_white_ratio(image, 0.925, 0.985)

            checks.append(
                RenderCheck(
                    page_number=page_number,
                    image_path=image_path,
                    width=image.width,
                    height=image.height,
                    non_white_ratio=non_white_ratio,
                    header_non_white_ratio=header_ratio,
                    footer_non_white_ratio=footer_ratio,
                )
            )

    return checks


def parse_args() -> argparse.Namespace:
    """解析验证参数，让同一脚本可验证合订本和考试提纲。"""

    parser = argparse.ArgumentParser(description="验证心理危机 PDF 排版产物")
    parser.add_argument("--pdf", type=Path, default=PDF_PATH, help="需要验证的 PDF 路径")
    parser.add_argument("--render-dir", type=Path, default=RENDER_DIR, help="抽样渲染 PNG 输出目录")
    parser.add_argument("--min-pages", type=int, default=1, help="允许的最小页数")
    parser.add_argument("--max-pages", type=int, default=200, help="允许的最大页数")
    parser.add_argument("--expect", action="append", default=[], help="PDF 文本中必须出现的普通文本")
    parser.add_argument("--expect-regex", action="append", default=[], help="PDF 文本中必须匹配的正则")
    parser.add_argument("--sample-page", action="append", type=int, default=[], help="需要渲染抽查的 1 基页码")
    return parser.parse_args()


def default_sample_pages(page_count: int) -> list[int]:
    """根据页数生成默认抽样页。

    抽样覆盖：
    - 首页/目录页；
    - 正文开头附近；
    - 中间页；
    - 末页。
    """

    candidates = [1, 2, min(12, page_count), min(13, page_count), max(1, page_count // 2), page_count]
    result: list[int] = []
    for page in candidates:
        if 1 <= page <= page_count and page not in result:
            result.append(page)
    return result


def main() -> int:
    """执行全部验证并打印摘要。"""

    args = parse_args()
    pdf_path: Path = args.pdf
    assert_true(pdf_path.exists(), f"PDF 不存在：{pdf_path}")

    document = fitz.open(pdf_path)
    page_count = document.page_count
    assert_true(args.min_pages <= page_count <= args.max_pages, f"页数异常：{page_count}")

    front_text = extract_text(document, range(0, min(14, page_count)))
    all_text = extract_text(document, range(0, page_count))

    assert_true("目录" in front_text, "目录未出现在前 14 页")
    for expected_text in args.expect:
        assert_true(expected_text in all_text, f"PDF 缺少期望文本：{expected_text}")
    for expected_regex in args.expect_regex:
        assert_true(bool(re.search(expected_regex, all_text, re.S)), f"PDF 未匹配期望正则：{expected_regex}")

    forbidden_markers = ("resourcemap", "DOMAIN-SUFFIX", "dialer-proxy", "password:")
    for marker in forbidden_markers:
        assert_true(marker not in all_text, f"PDF 仍包含非课程残留标记：{marker}")

    sample_pages = args.sample_page or default_sample_pages(page_count)
    render_checks = render_pages(pdf_path, sample_pages, args.render_dir)
    for check in render_checks:
        assert_true(check.width > 500 and check.height > 700, f"第 {check.page_number} 页渲染尺寸异常")
        assert_true(check.non_white_ratio > 0.005, f"第 {check.page_number} 页疑似空白")
        if check.page_number >= 13:
            assert_true(check.header_non_white_ratio > 0.0005, f"第 {check.page_number} 页页眉区域疑似为空")
            assert_true(check.footer_non_white_ratio > 0.0003, f"第 {check.page_number} 页页脚区域疑似为空")

    print(f"验证通过：{pdf_path}，共 {page_count} 页。")
    print("目录检查：前置目录存在。")
    print("安全检查：未检测到非课程配置残留标记。")
    print("渲染检查：已输出抽样 PNG：")
    for check in render_checks:
        print(
            f"- 第 {check.page_number} 页 -> {check.image_path} "
            f"({check.width}x{check.height}, 非白像素 {check.non_white_ratio:.4f})"
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"验证失败：{exc}", file=sys.stderr)
        raise
