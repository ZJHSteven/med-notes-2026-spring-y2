# 这个脚本负责把 `心理危机干预与预防/Notes/考试提纲.md`
# 单独编译成一份纸质开卷考试用 PDF。
#
# 它和合订本使用同一份 `pandoc-header.tex`，保证：
# - 页眉页脚样式一致；
# - 字体、行距、段距、列表间距一致；
# - 目录同样带真实页码，适合打印后查找。

$ErrorActionPreference = "Stop"

$BuildDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $BuildDir "..\..\..")

$TinyTexBin = "D:\App\TinyTeX\bin\windows"
if (Test-Path (Join-Path $TinyTexBin "xelatex.exe")) {
    $env:PATH = "$TinyTexBin;$env:PATH"
}

# XeLaTeX 对中文路径不够稳，因此 LaTeX 编译仍放在 ASCII 临时目录。
$TempBuildDir = Join-Path $RepoRoot "tmp\pdfs\psych-crisis-outline"
New-Item -ItemType Directory -Force -Path $TempBuildDir | Out-Null

$SourceMarkdown = Join-Path $RepoRoot "心理危机干预与预防\Notes\考试提纲.md"
$TempTexFile = Join-Path $TempBuildDir "outline.tex"
$TempPdfFile = Join-Path $TempBuildDir "outline.pdf"
$PdfFile = Join-Path $BuildDir "心理危机干预与预防-考试提纲-开卷速查版.pdf"
$TexFile = Join-Path $BuildDir "心理危机干预与预防-考试提纲-开卷速查版.tex"

if (-not (Test-Path $SourceMarkdown)) {
    throw "找不到考试提纲源文件：$SourceMarkdown"
}

# 先转 LaTeX，方便后续排查，也保留一份 .tex 作为可复现中间产物。
pandoc $SourceMarkdown `
    --from markdown+smart+pipe_tables+tex_math_dollars `
    --to latex `
    --standalone `
    --table-of-contents `
    --toc-depth=4 `
    --pdf-engine=xelatex `
    --metadata title="心理危机干预与预防考试提纲开卷速查版" `
    --metadata date="2026-04-21" `
    --variable documentclass=ctexart `
    --variable papersize=a4 `
    --variable colorlinks=false `
    --include-in-header (Join-Path $BuildDir "pandoc-header.tex") `
    --output $TempTexFile

Push-Location $TempBuildDir
try {
    xelatex -interaction=nonstopmode -halt-on-error outline.tex
    xelatex -interaction=nonstopmode -halt-on-error outline.tex
    xelatex -interaction=nonstopmode -halt-on-error outline.tex
}
finally {
    Pop-Location
}

if (-not (Test-Path $TempPdfFile)) {
    throw "PDF 没有生成：$TempPdfFile"
}

Copy-Item -LiteralPath $TempPdfFile -Destination $PdfFile -Force
Copy-Item -LiteralPath $TempTexFile -Destination $TexFile -Force

Write-Host "考试提纲 PDF 已生成：$PdfFile"
