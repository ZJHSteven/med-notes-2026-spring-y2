<#
文件作用：
1. 读取 `build_support_deck.js` 生成的支持页母版和 `deck_order.json` 中定义的顺序。
2. 使用 PowerPoint COM 自动化，把支持页和同学原始 pptx 页面按顺序插入到一个新演示文稿里。
3. 尽量保留同学原始页的动画、版式和对象，而不是把同学页先转成图片再拼接。

为什么用 PowerPoint COM：
- `pptxgenjs` 很适合新建封面页、过渡页和图片页；
- 但如果要“原样粘贴过去”，尤其尽量保留动画，PowerPoint 自己的 `InsertFromFile()` 更合适；
- 所以这里采用“支持页用 JS 生成，最终总稿用 PowerPoint 合并”的双阶段方案。
#>

param()

$ErrorActionPreference = "Stop"

<#
统一根目录。
后续所有相对路径都从脚本所在目录出发，这样双击运行和终端运行都不会乱。
#>
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputDir = Join-Path $ScriptRoot "output"
$SupportManifestPath = Join-Path $OutputDir "support_manifest.json"
$DeckOrderPath = Join-Path $ScriptRoot "deck_order.json"

if (-not (Test-Path -LiteralPath $SupportManifestPath)) {
    throw "缺少支持页清单：$SupportManifestPath。请先运行 build_support_deck.js。"
}

if (-not (Test-Path -LiteralPath $DeckOrderPath)) {
    throw "缺少合并顺序配置：$DeckOrderPath。"
}

<#
读取支持页 manifest 和顺序配置。
manifest 负责告诉我们 support deck 里每个 id 对应第几页；
order.json 负责告诉我们整套总稿该怎么排。
#>
$supportManifest = Get-Content -LiteralPath $SupportManifestPath -Raw | ConvertFrom-Json
$deckOrder = Get-Content -LiteralPath $DeckOrderPath -Raw | ConvertFrom-Json

$supportDeckPath = [System.IO.Path]::GetFullPath($supportManifest.supportDeckPath)
$finalDeckPath = Join-Path $OutputDir $deckOrder.finalDeckName

if (-not (Test-Path -LiteralPath $supportDeckPath)) {
    throw "支持页 PPT 不存在：$supportDeckPath"
}

<#
把 studentFiles 里写的相对路径统一解析成绝对路径。
这样后面执行插页时就不用反复处理路径问题了。
#>
$resolvedStudentFiles = @{}
foreach ($property in $deckOrder.studentFiles.PSObject.Properties) {
    $resolvedStudentFiles[$property.Name] = [System.IO.Path]::GetFullPath((Join-Path $ScriptRoot $property.Value))
}

<#
如果目标总稿文件正在被 WPS / PowerPoint / VS Code 占用，就自动换一个“修订版”文件名继续输出。
这样老师或同学在查看旧稿时，也不会阻塞新的总稿构建。
#>
function Get-WritableOutputPath {
    param(
        [Parameter(Mandatory = $true)] [string] $PreferredPath
    )

    if (-not (Test-Path -LiteralPath $PreferredPath)) {
        return $PreferredPath
    }

    try {
        $fileStream = [System.IO.File]::Open($PreferredPath, "Open", "ReadWrite", "None")
        $fileStream.Close()
        return $PreferredPath
    }
    catch [System.IO.IOException], [System.UnauthorizedAccessException] {
        $directory = Split-Path -Parent $PreferredPath
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($PreferredPath)
        $extension = [System.IO.Path]::GetExtension($PreferredPath)
        $fallbackIndex = 1

        while ($true) {
            $candidatePath = Join-Path $directory ("{0}-修订版{1}{2}" -f $baseName, $fallbackIndex, $extension)

            if (-not (Test-Path -LiteralPath $candidatePath)) {
                return $candidatePath
            }

            $fallbackIndex += 1
        }
    }
}

<#
小工具函数：
给当前总稿末尾插入指定文件的指定页范围。
这里固定插到末尾，逻辑最直观，也最不容易算错偏移量。
#>
function Add-SlideRangeToEnd {
    param(
        [Parameter(Mandatory = $true)] $Presentation,
        [Parameter(Mandatory = $true)] [string] $SourceFilePath,
        [Parameter(Mandatory = $true)] [int] $StartSlide,
        [Parameter(Mandatory = $true)] [int] $EndSlide
    )

    if (-not (Test-Path -LiteralPath $SourceFilePath)) {
        throw "源文件不存在：$SourceFilePath"
    }

    $insertAfterIndex = $Presentation.Slides.Count
    [void]$Presentation.Slides.InsertFromFile($SourceFilePath, $insertAfterIndex, $StartSlide, $EndSlide)
}

<#
开始 PowerPoint 自动化。
注意：
- Add() 往往会先带一个空白页，这里手动删掉；
- 为了防止旧文件占用导致保存失败，先尝试删除旧输出；
- 最后一定 Quit()，否则 PowerPoint 进程容易残留。
#>
$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = $true

try {
    $finalDeckPath = Get-WritableOutputPath -PreferredPath $finalDeckPath

    $finalPresentation = $ppt.Presentations.Add($true)

    if ($finalPresentation.Slides.Count -gt 0) {
        $finalPresentation.Slides.Item(1).Delete()
    }

    foreach ($action in $deckOrder.actions) {
        if ($action.type -eq "support") {
            $supportSlideIndex = [int]$supportManifest.slides.$($action.id)

            if (-not $supportSlideIndex) {
                throw "support_manifest.json 中找不到支持页 id：$($action.id)"
            }

            Add-SlideRangeToEnd -Presentation $finalPresentation -SourceFilePath $supportDeckPath -StartSlide $supportSlideIndex -EndSlide $supportSlideIndex
            Write-Host "[support] 已插入：$($action.label)"
            continue
        }

        if ($action.type -eq "file") {
            $sourceFile = $resolvedStudentFiles[$action.fileKey]

            if (-not $sourceFile) {
                throw "deck_order.json 中找不到 fileKey：$($action.fileKey)"
            }

            Add-SlideRangeToEnd -Presentation $finalPresentation -SourceFilePath $sourceFile -StartSlide ([int]$action.start) -EndSlide ([int]$action.end)
            Write-Host "[student] 已插入：$($action.label)"
            continue
        }

        throw "未知 action.type：$($action.type)"
    }

    <#
    SaveAs 第二个参数用默认文件格式即可，目标扩展名是 .pptx。
    #>
    $finalPresentation.SaveAs($finalDeckPath)

    try {
        $finalPresentation.Close()
    }
    catch {
        Write-Warning "总稿保存成功，但关闭演示文稿时出现警告：$($_.Exception.Message)"
    }

    Write-Host ""
    Write-Host "总汇报 PPT 已生成：$finalDeckPath"
}
finally {
    try {
        $ppt.Quit()
    }
    catch {
        Write-Warning "PowerPoint 退出时出现警告：$($_.Exception.Message)"
    }
}
