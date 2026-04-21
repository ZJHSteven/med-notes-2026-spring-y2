# 这个脚本负责把 7 份 Markdown 笔记编译成一份纸质开卷考试用 PDF。
# 设计思路：
# 1. 先调用 Python 脚本生成合并版 Markdown，避免直接修改原始课堂笔记。
# 2. 再用 Pandoc 转成 LaTeX，因为 LaTeX 能稳定生成“带真实页码”的纸质目录。
# 3. 最后用 XeLaTeX 编译两遍，让目录页码、页眉章节名和交叉引用都稳定下来。

$ErrorActionPreference = "Stop"

# 当前脚本所在目录就是本次 PDF 导出工程目录。
$BuildDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 仓库根目录：从 output/pdf/心理危机干预与预防 向上回到项目根目录。
$RepoRoot = Resolve-Path (Join-Path $BuildDir "..\..\..")

# TinyTeX 没有进入 PATH 时，显式把用户已经安装好的 XeLaTeX 目录加入本次进程 PATH。
$TinyTexBin = "D:\App\TinyTeX\bin\windows"
if (Test-Path (Join-Path $TinyTexBin "xelatex.exe")) {
    $env:PATH = "$TinyTexBin;$env:PATH"
}

# 输出文件统一放在本目录，便于后续提交与查找。
$CombinedMarkdown = Join-Path $BuildDir "心理危机干预与预防-合并稿.md"
$TexFile = Join-Path $BuildDir "心理危机干预与预防-开卷考试速查版.tex"
$PdfFile = Join-Path $BuildDir "心理危机干预与预防-开卷考试速查版.pdf"

# 生成合并 Markdown。这个步骤会清理每讲的顶层标题，让目录更像考试索引。
python (Join-Path $BuildDir "prepare_markdown.py") `
    --repo-root $RepoRoot `
    --output $CombinedMarkdown

# Pandoc 只负责把 Markdown 转为 LaTeX，不直接出 PDF。
# 这样如果 XeLaTeX 报错，可以直接检查 .tex 和 .log，排错更清楚。
pandoc $CombinedMarkdown `
    --from markdown+smart+pipe_tables+tex_math_dollars `
    --to latex `
    --standalone `
    --table-of-contents `
    --toc-depth=4 `
    --pdf-engine=xelatex `
    --metadata title="心理危机干预与预防开卷考试速查版" `
    --metadata date="2026-04-21" `
    --variable documentclass=ctexart `
    --variable papersize=a4 `
    --variable fontsize=9pt `
    --variable colorlinks=false `
    --include-in-header (Join-Path $BuildDir "pandoc-header.tex") `
    --output $TexFile

# XeLaTeX 至少编译两遍，第一遍生成目录辅助文件，第二遍把目录页码写准。
xelatex -interaction=nonstopmode -halt-on-error -output-directory=$BuildDir $TexFile
xelatex -interaction=nonstopmode -halt-on-error -output-directory=$BuildDir $TexFile

if (-not (Test-Path $PdfFile)) {
    throw "PDF 没有生成：$PdfFile"
}

Write-Host "PDF 已生成：$PdfFile"
