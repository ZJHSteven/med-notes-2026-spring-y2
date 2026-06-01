#!/usr/bin/env python3
"""
批量规范化《循环系统》课程中的英文词根词缀卡。

文件职责：
1. 读取 `cards.csv` 这类“题头行 + 分块行 + CSV 卡片行”的混合文件。
2. 只处理 `//大二下::循环系统::英文` 题头下的 3 字段英文词根词缀卡。
3. 统一 `BackHtml` 的内部结构，重点清理以下旧版残留：
   - CSV 转义留下的双引号嵌套显示问题
   - “本轮先按整词保留；建议后续人工补更细词源。” 这类回退说明
   - 每张卡尾部机械重复的“构词：整体对应……”尾句
   - 中英文括号、引号与行前缀风格不统一的问题
4. 可选同步导出位 `exports/AnkiTemp.csv`，让主卡库与导出文件保持一致。

设计边界：
1. 本脚本本轮只修“格式一致性”和“明显不合规表述”，不承诺重建 384 张术语的完整词源事实。
2. 本脚本不会修改题头、tag 路径、字段数，也不会跨课程目录操作。
3. 若后续要提升词源质量，应在这个稳定格式底座上继续细化，而不是再次从混乱格式重来。
"""

from __future__ import annotations

import argparse
import csv
import io
import re
from pathlib import Path


# 只处理这一段英文卡块，避免误伤其他章节或其他题型。
ENGLISH_DECK_HEADER = "//大二下::循环系统::英文"

# 旧版批量生成时留下的回退说明；本轮需要彻底清掉。
FALLBACK_TEXT = "本轮先按整词保留；建议后续人工补更细词源。"


def parse_args() -> argparse.Namespace:
    """解析命令行参数。"""

    parser = argparse.ArgumentParser(description="规范化循环系统英文词根词缀卡的内部 HTML 格式")
    parser.add_argument(
        "--anki-dir",
        default=".",
        help="Anki 工作区目录，默认当前目录；脚本会在其中查找 cards.csv 和 exports/AnkiTemp.csv",
    )
    parser.add_argument(
        "--write-export",
        action="store_true",
        help="同时把修正后的 cards.csv 覆盖写入 exports/AnkiTemp.csv",
    )
    return parser.parse_args()


def extract_chinese_definition(back_html: str) -> str:
    """从 BackHtml 中提取“释义：...”这一行的中文释义。

    输入：
    - back_html：当前卡片的第二字段 HTML

    输出：
    - 若成功找到释义行，则返回去掉前缀后的中文释义
    - 若未找到，则返回空字符串，供后续兜底文案使用
    """

    for part in back_html.split("<br>"):
        if part.startswith("释义："):
            return part.removeprefix("释义：").strip()
    return ""


def normalize_wrapped_text(text: str) -> str:
    """统一引号和括号的外观。

    这里不改变正文事实，只把容易导致格式显乱的外层包裹统一成：
    - 中文弯引号：`“...”`
    - ASCII 半角括号：`(...)`
    """

    normalized = text.strip()
    normalized = normalized.replace('""', '"')
    normalized = normalized.replace("（", "(").replace("）", ")")
    return normalized


def infer_fallback_line(label: str, token: str, chinese: str, tags: str) -> str:
    """为旧回退说明生成一个更稳定、可导入的中性说明行。

    说明：
    - 这里故意不捏造新的词源事实。
    - 只把“明显不适合成品”的回退提示，改写成课程词汇层面的稳定说明。
    """

    if label == "缩写":
        return f'缩写：“{token}” ({token} 是当前课程词汇表中的固定缩写写法，对应“{chinese}”。)'

    if "药理学" in tags:
        return f'命名：“{token}” (当前课程词汇表将其作为固定药名术语使用，对应“{chinese}”。)'

    if re.search(r"[A-Z]", token) or "'" in token or "’" in token:
        return f'命名：“{token}” (当前课程词汇表将其作为固定专名术语使用，对应“{chinese}”。)'

    return f'词组：“{token}” (当前课程词汇表将其作为固定术语写法使用，对应“{chinese}”。)'


def normalize_component_line(line: str, chinese: str, tags: str) -> str | None:
    """规范化一条非音标/非释义的内部行。

    处理规则：
    1. 删除机械重复的“构词：整体对应……”尾句，因为这类尾句对记忆帮助很小，且 384 张卡重复率 100%。
    2. 统一 `词组/缩写/词根/词缀/命名` 这些前缀后的引号和括号。
    3. 将旧回退说明改成稳定的课程词汇说明，而不是把“后续再补”留在成品卡里。
    """

    stripped = normalize_wrapped_text(line)

    if stripped.startswith("构词：整体对应"):
        return None

    match = re.match(r"^(词组|缩写|词根|词缀|命名)：[\"“]?(.+?)[\"”]?\((.+)\)$", stripped)
    if match:
        label, token, detail = match.groups()
        token = token.strip().strip('"').strip()
        detail = detail.strip()

        if detail == FALLBACK_TEXT:
            return infer_fallback_line(label, token, chinese, tags)

        return f'{label}：“{token}” ({detail})'

    # 若没有命中结构化前缀，就只做基础清洗后保留。
    # 这样可以最大限度避免误删本来就有价值的内容。
    return stripped


def normalize_back_html(back_html: str, tags: str) -> str:
    """规范化单张卡片的 BackHtml。

    强约束：
    - 第一行保留 `音标：...`
    - 第二行保留 `释义：...`
    - 后续逐行清洗，删除机械尾句，保留有信息量的词组/缩写/词缀说明
    """

    chinese = extract_chinese_definition(back_html)
    raw_parts = [part.strip() for part in back_html.split("<br>") if part.strip()]
    normalized_parts: list[str] = []

    for part in raw_parts:
        if part.startswith("音标："):
            normalized_parts.append(part.strip())
            continue

        if part.startswith("释义："):
            normalized_parts.append(part.strip())
            continue

        cleaned = normalize_component_line(part, chinese, tags)
        if cleaned:
            normalized_parts.append(cleaned)

    return "<br>".join(normalized_parts)


def normalize_cards_file(cards_path: Path) -> tuple[str, int]:
    """读取并重写 `cards.csv` 内容。

    返回：
    - 重写后的整份文本
    - 被实际修改的英文卡数量
    """

    current_header = ""
    changed_count = 0
    output_lines: list[str] = []

    for raw_line in cards_path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()

        if stripped.startswith("//"):
            current_header = stripped
            output_lines.append(raw_line)
            continue

        if not stripped or stripped.endswith("："):
            output_lines.append(raw_line)
            continue

        row = next(csv.reader([raw_line]))
        if current_header != ENGLISH_DECK_HEADER or len(row) != 3:
            output_lines.append(raw_line)
            continue

        front, back_html, tags = row
        normalized_back = normalize_back_html(back_html, tags)

        if normalized_back != back_html:
            changed_count += 1

        buffer = io.StringIO()
        csv.writer(buffer, lineterminator="").writerow([front, normalized_back, tags])
        output_lines.append(buffer.getvalue())

    return "\n".join(output_lines) + "\n", changed_count


def main() -> None:
    """程序入口。"""

    args = parse_args()
    anki_dir = Path(args.anki_dir).expanduser().resolve()
    cards_path = anki_dir / "cards.csv"
    export_path = anki_dir / "exports" / "AnkiTemp.csv"

    if not cards_path.exists():
        raise FileNotFoundError(f"未找到 cards.csv：{cards_path}")

    normalized_text, changed_count = normalize_cards_file(cards_path)
    cards_path.write_text(normalized_text, encoding="utf-8", newline="")

    if args.write_export:
        export_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.write_text(normalized_text, encoding="utf-8", newline="")

    print(f"normalized_cards={changed_count}")
    print(f"cards_path={cards_path}")
    if args.write_export:
        print(f"export_path={export_path}")


if __name__ == "__main__":
    main()
