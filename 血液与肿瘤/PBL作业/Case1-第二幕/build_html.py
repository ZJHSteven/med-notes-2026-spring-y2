"""
这个脚本的作用：
1. 将当前目录中的课程作业 Markdown 转成带样式的 HTML。
2. 兼容两种链接写法：
   - 新写法：`[显示文字](链接 "悬浮标题")`
   - 旧写法：`[显示文字][引用名]` / `[引用名]`
3. 保留“问题区前的导语段落”，不再像旧脚本那样直接吞掉。
4. 将 Markdown 的块引用 `>` 渲染成黄色提示框，和总结区保持同一视觉语言。
5. 优先通过 `uv run --with playwright` 调用浏览器内核导出 A4 PDF；
   若本机没有 `uv`，再退回 Edge 命令行打印作为兜底。

使用方式：
1. 在第二幕目录内直接运行：`python build_html.py`
2. 或者显式指定输入文件：`python build_html.py "Case1-第二幕.md"`
3. 若只想生成 HTML、不导出 PDF，可加：`--no-pdf`
"""

from __future__ import annotations

import argparse
import html
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path


# 这个正则专门匹配旧版 Markdown 末尾那种“引用式链接定义”。
# 例如：
# [PubMed]: https://pubmed.ncbi.nlm.nih.gov/xxx "标题"
REFERENCE_DEFINITION_RE = re.compile(
    r"^\[([^\]]+)\]:\s*(\S+)(?:\s+\"([^\"]+)\")?\s*$",
    re.MULTILINE,
)


@dataclass
class ReferenceLink:
    """保存一个引用式链接的目标地址与可选标题。"""

    href: str
    title: str | None = None


@dataclass
class StudentInfo:
    """保存页面顶部的姓名、班级、学号。"""

    name: str = ""
    class_name: str = ""
    student_id: str = ""


@dataclass
class SubSection:
    """保存问题下的一个三级小节，例如“③学习内容”。"""

    title: str
    content: str


@dataclass
class QuestionSection:
    """保存一个完整问题块，以及它前面的引导文字。"""

    title: str
    intro: str = ""
    sub_sections: list[SubSection] = field(default_factory=list)


@dataclass
class DocumentModel:
    """保存整个页面需要的结构化内容。"""

    title: str
    student: StudentInfo
    question_list_title: str
    question_list: list[str]
    keyword_title: str
    keywords: list[str]
    lead_content: str
    questions: list[QuestionSection]
    summary_title: str
    summary_content: str
    refs: dict[str, ReferenceLink]


def parse_args() -> argparse.Namespace:
    """解析命令行参数，让脚本既能默认工作，也能手动指定文件。"""

    # 这里把默认输入设为可选，是为了让脚本放到别的幕次目录里仍然可复用。
    parser = argparse.ArgumentParser(description="将课程作业 Markdown 转成 HTML / PDF。")
    parser.add_argument(
        "input",
        nargs="?",
        help="输入的 Markdown 文件路径；若省略，脚本会在当前目录自动寻找。",
    )
    parser.add_argument(
        "--html",
        help="输出 HTML 路径；若省略，则自动生成“原文件名-美化版.html”。",
    )
    parser.add_argument(
        "--pdf",
        help="输出 PDF 路径；若省略，则自动生成“原文件名-美化版.pdf”。",
    )
    parser.add_argument(
        "--no-pdf",
        action="store_true",
        help="只生成 HTML，不自动导出 PDF。",
    )
    return parser.parse_args()


def discover_default_markdown(script_dir: Path) -> Path:
    """在当前目录自动寻找最像“主作业正文”的 Markdown 文件。"""

    # 先找与目录同名或最接近的 Markdown，这样最符合当前作业目录结构。
    preferred_candidates = []
    for path in sorted(script_dir.glob("*.md")):
        # `temp.md` 这类临时文件不是目标正文，需要优先排除。
        if path.stem.lower() in {"temp", "draft", "notes"}:
            continue
        preferred_candidates.append(path)

    # 若只有一个候选文件，直接返回，避免用户每次都传参。
    if len(preferred_candidates) == 1:
        return preferred_candidates[0]

    # 若存在“Case*.md”这类作业正文，也优先选它。
    for path in preferred_candidates:
        if path.stem.startswith("Case"):
            return path

    # 若一个也找不到，直接抛错，提示用户显式传入。
    raise FileNotFoundError("当前目录下没有找到可用的 Markdown 正文文件，请手动指定输入路径。")


def load_markdown(input_arg: str | None) -> Path:
    """根据命令行参数或目录自动发现输入 Markdown。"""

    # 这里统一转成绝对路径，后续生成 HTML/PDF 时更稳妥。
    if input_arg:
        input_path = Path(input_arg).expanduser().resolve()
    else:
        input_path = discover_default_markdown(Path(__file__).resolve().parent)

    # 输入文件不存在时立刻报错，避免后面出现连锁异常。
    if not input_path.exists():
        raise FileNotFoundError(f"找不到输入文件：{input_path}")

    return input_path


def strip_reference_definitions(markdown_text: str) -> tuple[str, dict[str, ReferenceLink]]:
    """提取并移除旧版引用式链接定义，让正文渲染时不会把它们当普通文本显示。"""

    refs: dict[str, ReferenceLink] = {}

    # 先扫描所有引用定义，把链接地址和悬浮标题都记下来。
    for match in REFERENCE_DEFINITION_RE.finditer(markdown_text):
        key = match.group(1).strip()
        href = match.group(2).strip()
        title = match.group(3).strip() if match.group(3) else None
        refs[key] = ReferenceLink(href=href, title=title)

    # 再把这些定义行整体从正文中删掉，防止页面底部出现一串链接定义文本。
    cleaned_text = REFERENCE_DEFINITION_RE.sub("", markdown_text)
    return cleaned_text, refs


def collect_student_info(markdown_text: str) -> StudentInfo:
    """从正文前部抓取姓名、班级、学号。没有时就留空。"""

    # 这里单独提取，是为了让页面顶部信息区不依赖具体段落位置。
    info = StudentInfo()

    # 每一项都用宽松匹配，避免中英文冒号差异导致提取失败。
    name_match = re.search(r"^姓名[:：]\s*(.+?)\s*$", markdown_text, re.MULTILINE)
    class_match = re.search(r"^班级[:：]\s*(.+?)\s*$", markdown_text, re.MULTILINE)
    student_id_match = re.search(r"^学号[:：]\s*(.+?)\s*$", markdown_text, re.MULTILINE)

    # 提取成功就写入，否则保持空字符串，让 HTML 层决定是否展示。
    if name_match:
        info.name = name_match.group(1).strip()
    if class_match:
        info.class_name = class_match.group(1).strip()
    if student_id_match:
        info.student_id = student_id_match.group(1).strip()

    return info


def find_headings(lines: list[str]) -> list[tuple[int, int, str]]:
    """扫描全文标题，返回 (行号, 级别, 标题文字)。"""

    headings: list[tuple[int, int, str]] = []

    # 只认标准 ATX 标题，即以 # 开头的标题行。
    for index, line in enumerate(lines):
        match = re.match(r"^(#{1,6})\s+(.*\S)\s*$", line)
        if match:
            headings.append((index, len(match.group(1)), match.group(2).strip()))

    return headings


def slice_between(lines: list[str], start_line: int, end_line: int) -> str:
    """按行号切片，并统一去掉首尾空白行。"""

    return "\n".join(lines[start_line:end_line]).strip()


def find_section_body(lines: list[str], headings: list[tuple[int, int, str]], target_text: str) -> tuple[str, str]:
    """找到某个标题后的正文，并返回“标题文字 + 正文内容”。"""

    for i, (line_no, level, heading_text) in enumerate(headings):
        # 这里用 startswith，是为了兼容“①列出所有问题（最终整合版）”与“①列出所有问题”。
        if heading_text.startswith(target_text):
            next_line = len(lines)

            # 只要遇到同级或更高级标题，就说明当前这一节结束了。
            for next_heading_line, next_level, _ in headings[i + 1 :]:
                if next_level <= level:
                    next_line = next_heading_line
                    break

            body = slice_between(lines, line_no + 1, next_line)
            return heading_text, body

    return target_text, ""


def split_question_sections(
    lines: list[str],
    headings: list[tuple[int, int, str]],
    summary_line: int,
    lead_start_line: int,
) -> tuple[str, list[QuestionSection]]:
    """将“问题区前导文字”和多个问题块切出来。"""

    question_heading_indexes = [
        i
        for i, (_, _, heading_text) in enumerate(headings)
        if heading_text.startswith("问题")
    ]

    # 若没有问题标题，就直接返回空结构，让页面至少能生成前两大块和总结。
    if not question_heading_indexes:
        return "", []

    first_question_line = headings[question_heading_indexes[0]][0]
    lead_content = slice_between(lines, lead_start_line, first_question_line)
    questions: list[QuestionSection] = []

    # 逐个问题切片，右边界要么是下一个问题，要么是总结区。
    for position, heading_index in enumerate(question_heading_indexes):
        question_line, question_level, question_title = headings[heading_index]
        next_boundary = summary_line

        if position + 1 < len(question_heading_indexes):
            next_boundary = headings[question_heading_indexes[position + 1]][0]

        question_body = slice_between(lines, question_line + 1, next_boundary)
        questions.append(split_single_question(question_title, question_body, question_level))

    return lead_content, questions


def split_single_question(question_title: str, question_body: str, parent_level: int) -> QuestionSection:
    """将单个问题块再切成“问题前导说明 + 多个三级小节”。"""

    lines = question_body.splitlines()
    sub_heading_matches = []

    # 只把“比问题标题低一级”的标题当作该问题的小节。
    # 当前作业里，问题是 `##`，小节是 `###`，因此这里寻找 `###`。
    for index, line in enumerate(lines):
        match = re.match(rf"^(#{{{parent_level + 1}}})\s+(.*\S)\s*$", line)
        if match:
            sub_heading_matches.append((index, match.group(2).strip()))

    question = QuestionSection(title=question_title)

    # 若问题内部根本没有三级标题，就整块当成问题正文。
    if not sub_heading_matches:
        question.intro = question_body.strip()
        return question

    # 第一个三级标题前的内容，就是本题专属的引导文字。
    question.intro = slice_between(lines, 0, sub_heading_matches[0][0])

    # 依次切出每个三级小节。
    for index, (line_no, sub_title) in enumerate(sub_heading_matches):
        next_line = len(lines)
        if index + 1 < len(sub_heading_matches):
            next_line = sub_heading_matches[index + 1][0]

        sub_content = slice_between(lines, line_no + 1, next_line)
        question.sub_sections.append(SubSection(title=sub_title, content=sub_content))

    return question


def build_document(markdown_text: str, fallback_title: str) -> DocumentModel:
    """把原始 Markdown 解析成页面模板所需的结构化对象。"""

    cleaned_markdown, refs = strip_reference_definitions(markdown_text)
    lines = cleaned_markdown.splitlines()
    headings = find_headings(lines)

    # 主标题默认取正文第一个一级标题；若没有，则退回文件名。
    title = fallback_title
    for _, level, heading_text in headings:
        if level == 1:
            title = heading_text
            break

    student = collect_student_info(cleaned_markdown)
    question_list_title, question_list_body = find_section_body(lines, headings, "①列出所有问题")
    keyword_title, keyword_body = find_section_body(lines, headings, "②整幕关键词")

    # 问题列表按 Markdown 的有序列表行提取；正文里即使换了题目顺序也能自动跟上。
    question_list = [
        match.group(1).strip()
        for line in question_list_body.splitlines()
        if (match := re.match(r"^\d+\.\s+(.+?)\s*$", line.strip()))
    ]

    # 关键词区允许一行或多行，所以先合并，再按常见分隔符拆开。
    keyword_text = " ".join(line.strip() for line in keyword_body.splitlines() if line.strip())
    keywords = [
        item.strip().strip("*")
        for item in re.split(r"[、，,；;]\s*", keyword_text)
        if item.strip()
    ]

    # 总结标题可能叫“本幕总结（当前阶段结论）”，也可能叫“总结第一幕分析结论”。
    summary_heading_line = len(lines)
    summary_title = "总结"
    summary_level = 1
    for line_no, level, heading_text in reversed(headings):
        if "总结" in heading_text:
            summary_heading_line = line_no
            summary_title = heading_text
            summary_level = level
            break

    # lead_start_line 指向“关键词区正文结束之后”的下一行。
    lead_start_line = 0
    for i, (line_no, level, heading_text) in enumerate(headings):
        if heading_text == keyword_title:
            lead_start_line = len(lines)
            for next_heading_line, next_level, _ in headings[i + 1 :]:
                if next_level <= level:
                    lead_start_line = next_heading_line
                    break
            break

    lead_content, questions = split_question_sections(
        lines=lines,
        headings=headings,
        summary_line=summary_heading_line,
        lead_start_line=lead_start_line,
    )

    # 只有真正找到总结标题时，才截总结正文；否则留空。
    if summary_heading_line < len(lines):
        summary_content = slice_between(lines, summary_heading_line + 1, len(lines))
    else:
        summary_content = ""

    # 这里显式保留 summary_level 变量虽然当前未二次使用，
    # 但它说明了解析逻辑依赖的是“最后一个含总结字样的标题”。
    _ = summary_level

    return DocumentModel(
        title=title,
        student=student,
        question_list_title=question_list_title,
        question_list=question_list,
        keyword_title=keyword_title,
        keywords=keywords,
        lead_content=lead_content,
        questions=questions,
        summary_title=summary_title,
        summary_content=summary_content,
        refs=refs,
    )


def format_plain_text(text: str) -> str:
    """处理普通文本里的加粗、斜体、行内代码，并做 HTML 转义。"""

    # 先整体转义，避免正文里的 `<`、`&` 被误当成 HTML。
    escaped = html.escape(text)

    # 行内代码优先处理，因为代码片段里的星号不该再参与粗体/斜体替换。
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)

    # 双星号表示粗体，是当前作业里最常见的强调方式。
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)

    # 单星号表示斜体，常用于期刊名。
    escaped = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<em>\1</em>", escaped)
    return escaped


def build_anchor(display_text: str, href: str, title: str | None) -> str:
    """统一生成带新标签页打开能力的链接 HTML。"""

    safe_href = html.escape(href, quote=True)
    safe_title = html.escape(title, quote=True) if title else ""
    title_attr = f' title="{safe_title}"' if safe_title else ""
    return f'<a href="{safe_href}" target="_blank" rel="noopener noreferrer"{title_attr}>{format_plain_text(display_text)}</a>'


def parse_inline_link_payload(raw_payload: str) -> tuple[str, str | None]:
    """解析 `(url "title")` 内部内容，兼容 `<url>` 包裹写法。"""

    payload = raw_payload.strip()

    # 先拆末尾的标题；若没有标题，title 就保留 None。
    title_match = re.match(r"^(.*?)(?:\s+\"([^\"]+)\")?$", payload)
    if title_match:
        href_part = title_match.group(1).strip()
        title = title_match.group(2).strip() if title_match.group(2) else None
    else:
        href_part = payload
        title = None

    # Markdown 允许把链接写成 `<https://...>`，这里把尖括号剥掉。
    if href_part.startswith("<") and href_part.endswith(">"):
        href_part = href_part[1:-1].strip()

    return href_part, title


def render_inline(text: str, refs: dict[str, ReferenceLink]) -> str:
    """逐字符扫描一行文本，替换链接，保留其余 Markdown 行内语法。"""

    result: list[str] = []
    plain_buffer: list[str] = []
    index = 0

    def flush_plain_buffer() -> None:
        """把当前累计的普通文本一次性做转义与格式化。"""

        if plain_buffer:
            result.append(format_plain_text("".join(plain_buffer)))
            plain_buffer.clear()

    while index < len(text):
        current_char = text[index]

        # 只有遇到 `[`，才有可能是 Markdown 链接。
        if current_char != "[":
            plain_buffer.append(current_char)
            index += 1
            continue

        # 先找到显示文字的右中括号；若找不到，就把当前字符当普通文本处理。
        close_bracket = text.find("]", index + 1)
        if close_bracket == -1:
            plain_buffer.append(current_char)
            index += 1
            continue

        display_text = text[index + 1 : close_bracket]
        next_index = close_bracket + 1

        # 情况一：新式行内链接 `[文字](链接 "标题")`
        if next_index < len(text) and text[next_index] == "(":
            payload_start = next_index + 1
            payload_index = payload_start
            depth = 1

            # 这里手动计算括号深度，是为了兼容 URL 自身包含括号的情况。
            while payload_index < len(text):
                if text[payload_index] == "(":
                    depth += 1
                elif text[payload_index] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                payload_index += 1

            # 如果没有找到配对右括号，就回退成普通文本，避免破坏原文。
            if depth != 0:
                plain_buffer.append(current_char)
                index += 1
                continue

            flush_plain_buffer()
            href, title = parse_inline_link_payload(text[payload_start:payload_index])
            result.append(build_anchor(display_text, href, title))
            index = payload_index + 1
            continue

        # 情况二：旧式引用链接 `[文字][引用名]`
        if next_index < len(text) and text[next_index] == "[":
            ref_end = text.find("]", next_index + 1)
            if ref_end != -1:
                ref_key = text[next_index + 1 : ref_end] or display_text
                ref = refs.get(ref_key)
                if ref:
                    flush_plain_buffer()
                    result.append(build_anchor(display_text, ref.href, ref.title))
                    index = ref_end + 1
                    continue

        # 情况三：旧式隐式引用 `[PubMed]`
        ref = refs.get(display_text)
        if ref:
            flush_plain_buffer()
            result.append(build_anchor(display_text, ref.href, ref.title))
            index = close_bracket + 1
            continue

        # 走到这里，说明并不是合法链接，就按普通文本原样保留。
        plain_buffer.append(current_char)
        index += 1

    flush_plain_buffer()
    return "".join(result)


def render_block_content(block_text: str, refs: dict[str, ReferenceLink]) -> str:
    """把一段 Markdown 正文渲染成 HTML 块级结构。"""

    lines = block_text.splitlines()
    html_blocks: list[str] = []
    index = 0

    while index < len(lines):
        raw_line = lines[index]
        stripped_line = raw_line.strip()

        # 空行只负责断开段落，不直接输出。
        if not stripped_line:
            index += 1
            continue

        # Markdown 分隔线直接转成 `<hr>`。
        if re.fullmatch(r"(?:-{3,}|\*{3,}|_{3,})", stripped_line):
            html_blocks.append("<hr>")
            index += 1
            continue

        # 四级标题通常出现在“学习内容”内部，用作问题内部的小层次。
        heading_match = re.match(r"^####\s+(.*\S)\s*$", raw_line)
        if heading_match:
            html_blocks.append(f'<h4 class="mini-title">{render_inline(heading_match.group(1).strip(), refs)}</h4>')
            index += 1
            continue

        # 块引用 `>` 会被整段包成黄色提示框。
        if stripped_line.startswith(">"):
            quote_lines: list[str] = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote_lines.append(re.sub(r"^>\s?", "", lines[index].rstrip()))
                index += 1
            inner_html = render_block_content("\n".join(quote_lines), refs)
            html_blocks.append(f'<blockquote class="callout">{inner_html}</blockquote>')
            continue

        # 有序列表：例如 `1. xxx`
        ordered_match = re.match(r"^(\d+)\.\s+(.*\S)\s*$", stripped_line)
        if ordered_match:
            items: list[str] = []
            while index < len(lines):
                current = lines[index].strip()
                item_match = re.match(r"^\d+\.\s+(.*\S)\s*$", current)
                if not item_match:
                    break
                items.append(f"<li>{render_inline(item_match.group(1).strip(), refs)}</li>")
                index += 1
            html_blocks.append(f"<ol>{''.join(items)}</ol>")
            continue

        # 无序列表：当前正文里主要用 `* xxx`。
        unordered_match = re.match(r"^[*-]\s+(.*\S)\s*$", stripped_line)
        if unordered_match:
            items = []
            while index < len(lines):
                current = lines[index].strip()
                item_match = re.match(r"^[*-]\s+(.*\S)\s*$", current)
                if not item_match:
                    break
                items.append(f"<li>{render_inline(item_match.group(1).strip(), refs)}</li>")
                index += 1
            html_blocks.append(f"<ul>{''.join(items)}</ul>")
            continue

        # 普通段落：连续的普通文本行会并成一个段落，避免每行都被拆成单独 `<p>`。
        paragraph_lines = [stripped_line]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if not candidate:
                break
            if re.fullmatch(r"(?:-{3,}|\*{3,}|_{3,})", candidate):
                break
            if candidate.startswith(">"):
                break
            if re.match(r"^####\s+", lines[index]):
                break
            if re.match(r"^\d+\.\s+", candidate):
                break
            if re.match(r"^[*-]\s+", candidate):
                break
            paragraph_lines.append(candidate)
            index += 1
        paragraph_text = " ".join(paragraph_lines)
        html_blocks.append(f"<p>{render_inline(paragraph_text, refs)}</p>")

    return "\n".join(html_blocks)


def render_student_info(student: StudentInfo) -> str:
    """生成顶部学生信息区；全空时则不输出该区域。"""

    if not any([student.name, student.class_name, student.student_id]):
        return ""

    rows = []
    if student.name:
        rows.append(f"<p><strong>姓名：</strong>{html.escape(student.name)}</p>")
    if student.class_name:
        rows.append(f"<p><strong>班级：</strong>{html.escape(student.class_name)}</p>")
    if student.student_id:
        rows.append(f"<p><strong>学号：</strong>{html.escape(student.student_id)}</p>")
    return f'<div class="student-info">{"".join(rows)}</div>'


def render_document(document: DocumentModel, css_name: str = "style.css") -> str:
    """根据结构化文档，拼出最终的完整 HTML。"""

    parts: list[str] = []

    # HTML 头部保持简单，样式全部放到独立 CSS，方便复用和打印。
    parts.append("<!DOCTYPE html>")
    parts.append('<html lang="zh-CN">')
    parts.append("<head>")
    parts.append('    <meta charset="UTF-8">')
    parts.append('    <meta name="viewport" content="width=device-width, initial-scale=1.0">')
    parts.append(f"    <title>{html.escape(document.title)}</title>")
    parts.append(f'    <link rel="stylesheet" href="{html.escape(css_name, quote=True)}">')
    parts.append("</head>")
    parts.append("<body>")
    parts.append('    <div class="container">')
    parts.append(f'        <h1 class="main-title">{html.escape(document.title)}</h1>')

    student_html = render_student_info(document.student)
    if student_html:
        parts.append(f"        {student_html}")

    # 第一大块：问题总表。
    parts.append(f'        <h2 class="section-title">{html.escape(document.question_list_title)}</h2>')
    parts.append('        <ol class="question-list">')
    for item in document.question_list:
        parts.append(f"            <li>{render_inline(item, document.refs)}</li>")
    parts.append("        </ol>")

    # 第二大块：整幕关键词。
    parts.append(f'        <h2 class="section-title">{html.escape(document.keyword_title)}</h2>')
    parts.append('        <div class="keyword-bubbles">')
    for keyword in document.keywords:
        parts.append(f'            <span class="keyword">{render_inline(keyword, document.refs)}</span>')
    parts.append("        </div>")

    # 这里专门保留问题区之前的导语内容，解决旧脚本“吞掉这段话”的问题。
    if document.lead_content.strip():
        parts.append('        <section class="lead-section">')
        parts.append('            <div class="lead-text">')
        parts.append(render_block_content(document.lead_content, document.refs))
        parts.append("            </div>")
        parts.append("        </section>")

    # 依次渲染每个问题块。
    for question in document.questions:
        parts.append('        <section class="qa-section">')
        parts.append(f'            <h2 class="qa-title">{render_inline(question.title, document.refs)}</h2>')

        if question.intro.strip():
            parts.append('            <div class="question-intro">')
            parts.append(render_block_content(question.intro, document.refs))
            parts.append("            </div>")

        for sub_section in question.sub_sections:
            parts.append('            <div class="sub-section">')
            parts.append(f'                <h3 class="sub-title">{render_inline(sub_section.title, document.refs)}</h3>')
            parts.append(render_block_content(sub_section.content, document.refs))
            parts.append("            </div>")

        parts.append("        </section>")

    # 总结区保持单独的大标题与黄色框，和用户喜欢的第一幕风格一致。
    if document.summary_content.strip():
        parts.append("        <hr>")
        parts.append(f'        <h2 class="section-title">{html.escape(document.summary_title)}</h2>')
        parts.append('        <div class="summary-text">')
        parts.append(render_block_content(document.summary_content, document.refs))
        parts.append("        </div>")

    parts.append("    </div>")
    parts.append("</body>")
    parts.append("</html>")
    return "\n".join(parts)


def find_edge_executable() -> Path | None:
    """查找本机可用的 Edge 可执行文件，用于无头打印 PDF。"""

    candidates = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path.home() / r"AppData\Local\Microsoft\Edge\Application\msedge.exe",
    ]

    # 依次尝试常见安装位置，找到第一个存在的即可。
    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def export_pdf_with_playwright(html_path: Path, pdf_path: Path, edge_path: Path) -> None:
    """借助 `uv run --with playwright` 临时拉起 Playwright，并调用浏览器原生 PDF 能力。"""

    # 这里不污染当前 Python 环境，完全依赖 uv 的临时依赖能力。
    helper_code = """
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

html_path = Path(sys.argv[1]).resolve()
pdf_path = Path(sys.argv[2]).resolve()
edge_path = Path(sys.argv[3]).resolve()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=str(edge_path), headless=True)
    page = browser.new_page()
    page.goto(html_path.as_uri(), wait_until="networkidle")
    page.pdf(
        path=str(pdf_path),
        format="A4",
        print_background=True,
        prefer_css_page_size=True,
    )
    browser.close()
"""

    # 仍然使用 ASCII 临时文件，是为了进一步规避第三方工具对中文输出文件名的兼容问题。
    with tempfile.TemporaryDirectory(prefix="case1_pdf_") as temp_dir:
        temp_pdf_path = Path(temp_dir) / "export.pdf"
        completed = subprocess.run(
            [
                "uv",
                "run",
                "--with",
                "playwright",
                "python",
                "-c",
                helper_code,
                str(html_path),
                str(temp_pdf_path),
                str(edge_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        if not temp_pdf_path.exists():
            raise RuntimeError(
                "Playwright 导出命令执行后没有生成临时 PDF。"
                f"\nstdout: {completed.stdout.strip()}"
                f"\nstderr: {completed.stderr.strip()}"
            )

        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        temp_pdf_path.replace(pdf_path)


def export_pdf_with_edge(html_path: Path, pdf_path: Path) -> None:
    """调用 Edge 的无头打印能力，将 HTML 导出成 A4 PDF。"""

    edge_path = find_edge_executable()
    if edge_path is None:
        raise FileNotFoundError("未找到 Microsoft Edge，无法自动导出 PDF。")

    # 先删旧文件，避免上一次生成成功、这一次失败时误判。
    if pdf_path.exists():
        pdf_path.unlink()

    # 实测发现：Edge 在 Windows 上直接输出到“带中文文件名的 PDF 路径”时，
    # 可能静默失败却不报错。这里先输出到 ASCII 临时文件，再移动到目标文件名。
    with tempfile.TemporaryDirectory(prefix="case1_pdf_") as temp_dir:
        temp_pdf_path = Path(temp_dir) / "export.pdf"
        command = [
            str(edge_path),
            "--headless",
            "--disable-gpu",
            "--print-to-pdf-no-header",
            f"--print-to-pdf={temp_pdf_path}",
            html_path.resolve().as_uri(),
        ]

        # 这里保留标准输出/错误输出，后面若失败可直接带回错误上下文。
        completed = subprocess.run(command, check=True, capture_output=True, text=True)

        # 最后确认临时 PDF 已生成，再移动到目标位置。
        if not temp_pdf_path.exists():
            raise RuntimeError(
                "Edge 打印命令执行后没有生成临时 PDF。"
                f"\nstdout: {completed.stdout.strip()}"
                f"\nstderr: {completed.stderr.strip()}"
            )

        # 目标目录理论上已经存在，但这里仍做一次兜底，避免跨目录输出时报错。
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        temp_pdf_path.replace(pdf_path)


def export_pdf(html_path: Path, pdf_path: Path) -> None:
    """统一封装 PDF 导出策略：优先 Playwright，失败时再退回 Edge 命令行。"""

    edge_path = find_edge_executable()
    if edge_path is None:
        raise FileNotFoundError("未找到 Microsoft Edge，无法自动导出 PDF。")

    # 如果系统里有 uv，就优先走 Playwright。这条链更接近真正的浏览器“打印为 PDF”。
    if shutil.which("uv"):
        export_pdf_with_playwright(html_path, pdf_path, edge_path)
        return

    # 没有 uv 时，才使用更原始的 Edge 命令行打印作为兜底。
    export_pdf_with_edge(html_path, pdf_path)


def main() -> int:
    """主流程：读取 Markdown -> 解析 -> 写 HTML -> 可选写 PDF。"""

    args = parse_args()

    try:
        input_path = load_markdown(args.input)
        output_html = Path(args.html).expanduser().resolve() if args.html else input_path.with_name(f"{input_path.stem}-美化版.html")
        output_pdf = Path(args.pdf).expanduser().resolve() if args.pdf else input_path.with_name(f"{input_path.stem}-美化版.pdf")

        # 读取原始 Markdown 正文。
        markdown_text = input_path.read_text(encoding="utf-8")

        # 解析成结构化文档，再拼成 HTML。
        document = build_document(markdown_text, fallback_title=input_path.stem)
        final_html = render_document(document)

        # 先把 HTML 写出，这是整个流程的基础产物。
        output_html.write_text(final_html, encoding="utf-8")
        print(f"[成功] HTML 已生成：{output_html}")

        # 若用户显式关闭 PDF 导出，就在这里结束。
        if args.no_pdf:
            print("[提示] 已按参数要求跳过 PDF 导出。")
            return 0

        # 自动导出 PDF；若失败，保留 HTML，并给出明确提示。
        export_pdf(output_html, output_pdf)
        print(f"[成功] PDF 已生成：{output_pdf}")
        return 0

    except Exception as exc:  # noqa: BLE001
        # 这里统一兜底，是为了让初学者运行时能直接看到错误原因。
        print(f"[失败] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
