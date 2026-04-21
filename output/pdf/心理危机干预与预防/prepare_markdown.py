#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成《心理危机干预与预防》合并版 Markdown。

这个脚本只做“排版前处理”，不改变原始 7 份课堂笔记。

为什么需要这个脚本：
1. 原始笔记每一讲的一级标题写法不完全一致，有些是泛称“课堂笔记”，
   如果直接生成目录，纸质目录会出现很多不利于考试检索的标题。
2. 用户需要的是开卷考试速查版 PDF，因此顶层目录应该按“第几讲 + 主题”
   来组织，而不是照搬录音整理时的标题。
3. 目录页码要由 LaTeX 在最终编译时生成，所以本脚本不手写页码，
   只负责让标题层级清晰，后续交给 Pandoc/XeLaTeX 生成真实页码。
"""

from __future__ import annotations

import argparse
from pathlib import Path


# 这里显式列出 7 份笔记，避免按文件系统排序时受到中文冒号、空格等细节影响。
# 每一项的第二个字段是考试目录中使用的“主章节名”。
NOTE_FILES: list[tuple[str, str]] = [
    ("1-心理危机导论.md", "第1讲：心理危机导论"),
    ("2-心理危机的常见原因.md", "第2讲：心理危机的常见原因"),
    ("3-心理危机：表现、应激与自杀.md", "第3讲：心理危机的表现、应激与自杀"),
    ("4-预防、依恋与危机干预.md", "第4讲：预防、依恋与危机干预"),
    ("5-法律伦理、系统视角、树理论与自杀识别.md", "第5讲：法律伦理、系统视角、树理论与自杀识别"),
    ("6-学生心理危机三级预防.md", "第6讲：学生心理危机三级预防"),
    ("7-心理问题的客观存在、主观加工与应对思路.md", "第7讲：心理问题的客观存在、主观加工与应对思路"),
]


# 原始第 1 讲尾部混入过非课程内容。这里不修改原始笔记，
# 只在合订本生成阶段发现这些标记后停止读取当前文件的剩余内容。
# 这样可以避免把与考试无关的配置片段或敏感字段打印进 PDF。
NON_COURSE_TAIL_MARKERS: tuple[str, ...] = (
    "你把后半段转写继续发来",
    "resourcemap.lol/sub?",
    "DOMAIN-SUFFIX",
    "dialer-proxy",
    "Clash Verge Rev",
)


def normalize_heading_line(line: str, is_first_heading: bool) -> str | None:
    """整理单行标题。

    参数：
    - line：原始 Markdown 的一行。
    - is_first_heading：是否为当前文件遇到的第一个标题。

    返回：
    - `None`：表示这行应跳过。例如每份原始笔记开头的泛化一级标题。
    - `str`：表示清理后的行。

    核心逻辑：
    - 每讲的主标题由脚本统一写入，所以原文件第一个一级标题跳过。
    - 后续如果再遇到一级标题，通常是“本节英文术语索引”，应降为二级标题，
      否则目录会误以为它是新的一讲。
    - 其他标题保持原级别，尽量保留老师课堂笔记中的检索入口。
    """

    stripped = line.lstrip()
    if not stripped.startswith("#"):
        return line

    # 原文件第一行常是“课堂笔记”类标题，脚本会用更适合考试检索的标题替代。
    if is_first_heading and stripped.startswith("# "):
        return None

    # 如果某份笔记后面还有一级标题，把它降为二级标题，保证每个文件只有一个顶层章节。
    if stripped.startswith("# "):
        return "#" + line

    return line


def build_combined_markdown(repo_root: Path) -> str:
    """读取 7 份笔记并生成合并版 Markdown 文本。

    参数：
    - repo_root：当前笔记仓库根目录。

    返回：
    - 合并后的 Markdown 字符串。

    生成结果包含：
    - Pandoc 元数据区；
    - 每讲统一主标题；
    - 每讲之间的 LaTeX 换页命令，方便纸质版翻找；
    - 原始正文内容。
    """

    notes_dir = repo_root / "心理危机干预与预防" / "Notes"
    chunks: list[str] = [
        "---",
        "title: 心理危机干预与预防开卷考试速查版",
        "date: 2026-04-21",
        "lang: zh-CN",
        "---",
        "",
        "> 说明：本 PDF 由 `心理危机干预与预防/Notes/` 下 7 份 Markdown 笔记合并生成。目录页码由 XeLaTeX 编译得到，适合打印后按页码查找。",
        "",
    ]

    for index, (filename, lecture_title) in enumerate(NOTE_FILES):
        source = notes_dir / filename
        if not source.exists():
            raise FileNotFoundError(f"找不到笔记文件：{source}")

        # 每讲另起新页，考试翻找时边界更清楚；第一讲前不额外换页。
        if index > 0:
            chunks.extend(["", r"\clearpage", ""])

        chunks.extend([f"# {lecture_title}", ""])

        seen_first_heading = False
        for raw_line in source.read_text(encoding="utf-8-sig").splitlines():
            if any(marker in raw_line for marker in NON_COURSE_TAIL_MARKERS):
                chunks.extend(
                    [
                        "",
                        "> 排版备注：原始笔记此处之后检测到非课程内容残留，合订本已自动略去。",
                        "",
                    ]
                )
                break

            is_heading = raw_line.lstrip().startswith("#")
            cleaned = normalize_heading_line(raw_line, is_first_heading=is_heading and not seen_first_heading)

            if is_heading and not seen_first_heading:
                seen_first_heading = True

            if cleaned is not None:
                chunks.append(cleaned)

        chunks.append("")

    return "\n".join(chunks)


def main() -> None:
    """命令行入口：解析参数，写出合并 Markdown。"""

    parser = argparse.ArgumentParser(description="生成心理危机干预与预防合并版 Markdown")
    parser.add_argument("--repo-root", required=True, type=Path, help="笔记仓库根目录")
    parser.add_argument("--output", required=True, type=Path, help="合并 Markdown 输出路径")
    args = parser.parse_args()

    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(build_combined_markdown(args.repo_root), encoding="utf-8")
    print(f"已生成合并稿：{output}")


if __name__ == "__main__":
    main()
