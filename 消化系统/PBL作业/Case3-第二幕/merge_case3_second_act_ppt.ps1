param(
    # 说明：
    # 这个脚本专门用于把 Case3-第二幕 的主持人底稿和各位同学原稿
    # 按既定顺序合成一份最终上课可直接播放的整合版 PPT。
    #
    # 默认约定：
    # 1. 张家赫的 `张家赫.pptx` 作为主持人底稿，负责总起、Q1、过渡页和总结页。
    # 2. 其他同学的题目页 / 文献页尽量原样保留，不强行统一重做版式。
    # 3. 王鹤目录里的 `case2第一幕.pptx` 是旧案例文件，明确排除，不参与本次整合。
    [string]$CaseDir = "C:\Users\ZJHSteven\Desktop\大二下笔记\消化系统\PBL作业\Case3-第二幕",

    # 输出路径：
    # 直接写回当前 Case 目录，方便用户马上找到最终稿。
    [string]$OutputPptx = "C:\Users\ZJHSteven\Desktop\大二下笔记\消化系统\PBL作业\Case3-第二幕\Case3-第二幕-PBL汇报整合版.pptx",

    # 预览图导出目录：
    # 每次运行都会整目录重建，作为“合并后逐页目视验收”的证据。
    [string]$PreviewDir = "C:\Users\ZJHSteven\Desktop\大二下笔记\消化系统\PBL作业\Case3-第二幕\qa\Case3-第二幕-PBL汇报整合版-预览"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    # 作用：
    # 在真正打开 PowerPoint 之前先把依赖文件验清楚，
    # 避免执行到一半才因为某个原稿路径写错而中断。
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "缺少文件：$Label -> $Path"
    }
}

function Ensure-CleanDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    # 作用：
    # 预览目录每次都重建，避免上次导出的旧 PNG 误导本次验收。
    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }

    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Insert-SlideRange {
    param(
        [Parameter(Mandatory = $true)]
        $Presentation,
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [int]$AfterIndex,
        [Parameter(Mandatory = $true)]
        [int]$StartSlide,
        [Parameter(Mandatory = $true)]
        [int]$EndSlide,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    # 作用：
    # 把某个原稿里的指定页段插到当前演示文稿的指定页后面。
    #
    # PowerPoint 的 InsertFromFile 行为是“插在 AfterIndex 之后”，
    # 所以这里统一用 AfterIndex 表示“插完之后，前面的最后一页是谁”。
    $expectedCount = $EndSlide - $StartSlide + 1
    $beforeCount = $Presentation.Slides.Count

    [void]$Presentation.Slides.InsertFromFile($FilePath, $AfterIndex, $StartSlide, $EndSlide)

    $afterCount = $Presentation.Slides.Count
    $insertedCount = $afterCount - $beforeCount

    if ($insertedCount -ne $expectedCount) {
        throw "插入页数异常：$Label，期望 $expectedCount 页，实际插入 $insertedCount 页。"
    }

    Write-Host ("[OK] {0} -> 插入 {1} 页（{2} 第 {3}-{4} 页）" -f $Label, $insertedCount, [System.IO.Path]::GetFileName($FilePath), $StartSlide, $EndSlide)
}

# 主持人底稿：
# 这份底稿本身已经包含：
# 1. 总起页
# 2. Q1 的 3 页
# 3. 临床 -> 文献 的过渡页
# 4. 空间转录组文献的 5 页
# 5. 最终总结页
$hostDeck = Join-Path $CaseDir "张家赫.pptx"
Assert-FileExists -Path $hostDeck -Label "主持人底稿"

# 先验证所有要用到的同学原稿都在，缺任何一个都直接停止。
$sourceFiles = @{
    "刘子硕-查体"   = (Join-Path $CaseDir "刘子硕\查体结果与肝硬化失代偿期的关联分析(1).pptx")
    "刘子硕-文献"   = (Join-Path $CaseDir "刘子硕\刘子硕文献分享(1).pptx")
    "刘骐玮-Q3"     = (Join-Path $CaseDir "刘骐玮\新建 PPTX 演示文稿.pptx")
    "刘骐玮-文献"   = (Join-Path $CaseDir "刘骐玮\新建 PPTX 演示文稿 (2).pptx")
    "常瑞琪-问题文献" = (Join-Path $CaseDir "常瑞琪\3.1常瑞琪(1).pptx")
    "张志擎-Q2"     = (Join-Path $CaseDir "张志擎\肝功能合成功能障碍指标及意义.pptx")
    "张志擎-文献"   = (Join-Path $CaseDir "张志擎\黄芪汤通过PI3KAktmTOR通路促进自噬减轻大鼠肝纤维化.pptx")
    "林诚亚-问题文献" = (Join-Path $CaseDir "林诚亚\问题.pptx")
    "王鹤-Case3"    = (Join-Path $CaseDir "王鹤\case3第二幕.pptx")
    "蒋玉梅-问题文献" = (Join-Path $CaseDir "蒋玉梅\Case3 第二幕.pptx")
    "谢尚锦-Q5"     = (Join-Path $CaseDir "谢尚锦\2.问题汇报.pptx")
    "谢尚锦-文献"   = (Join-Path $CaseDir "谢尚锦\2.文献分享.pptx")
    "姚丁睿-Q8"     = (Join-Path $CaseDir "姚丁睿\Q8._20260615_003637_0000(1).pptx")
    "姚丁睿-文献"   = (Join-Path $CaseDir "姚丁睿\Intestinal decontamination with rifaximin attenuates LSEC dysfunction and _20260615_210226_0000(1).pptx")
}

foreach ($label in $sourceFiles.Keys) {
    Assert-FileExists -Path $sourceFiles[$label] -Label $label
}

# 输出目录和预览目录都提前准备好。
if (-not (Test-Path -LiteralPath (Split-Path -Parent $OutputPptx))) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPptx) -Force | Out-Null
}

if (Test-Path -LiteralPath $OutputPptx) {
    Remove-Item -LiteralPath $OutputPptx -Force
}

Copy-Item -LiteralPath $hostDeck -Destination $OutputPptx
Ensure-CleanDirectory -Path $PreviewDir

$powerPoint = $null
$presentation = $null

try {
    # 这里直接调用本机已安装的 PowerPoint，
    # 因为它对“跨文件保真插入原稿页”最稳。
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $powerPoint.Visible = -1
    $presentation = $powerPoint.Presentations.Open($OutputPptx, $false, $false, $false)

    # ---------------------------
    # 第一段：临床问题部分
    # ---------------------------
    # 当前底稿结构（初始）：
    # 1 总起
    # 2-4 张家赫 Q1
    # 5 过渡
    # 6-10 张家赫 文献1
    # 11 总结
    #
    # 目标结构（前半段）：
    # 1 总起
    # 2-3 刘子硕 Q6
    # 4-6 张家赫 Q1
    # 7-8 张志擎 Q2
    # 9 常瑞琪 Q4
    # 10 刘骐玮 Q3
    # 11 谢尚锦 Q5
    # 12 蒋玉梅 Q7
    # 13 姚丁睿 Q8
    # 14 林诚亚 Q9
    # 15 王鹤 Q10
    # 16 过渡
    $clinicalTail = 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["刘子硕-查体"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 2 -Label "Q6 查体结果"
    $clinicalTail += 2

    # 跳过主持人已写好的 Q1 三页。
    $clinicalTail += 3

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["张志擎-Q2"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 2 -Label "Q2 合成功能障碍"
    $clinicalTail += 2

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["常瑞琪-问题文献"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 1 -Label "Q4 凝血指标"
    $clinicalTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["刘骐玮-Q3"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 1 -Label "Q3 解毒功能与血氨"
    $clinicalTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["谢尚锦-Q5"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 1 -Label "Q5 GFR 与下肢水肿"
    $clinicalTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["蒋玉梅-问题文献"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 1 -Label "Q7 B超提示意义"
    $clinicalTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["姚丁睿-Q8"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 1 -Label "Q8 肝占位提示转归"
    $clinicalTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["林诚亚-问题文献"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 1 -Label "Q9 肝占位后续检查"
    $clinicalTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["王鹤-Case3"] -AfterIndex $clinicalTail -StartSlide 1 -EndSlide 1 -Label "Q10 脾切除术后改变"
    $clinicalTail += 1

    # ---------------------------
    # 第二段：文献机制部分
    # ---------------------------
    # 这里先跳过主持人现有的：
    # 1 页过渡 + 5 页空间转录组文献，
    # 再按“大框架 -> 具体机制 -> 干预/综述补充”的顺序插入。
    $literatureTail = $clinicalTail + 1 + 5

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["刘骐玮-文献"] -AfterIndex $literatureTail -StartSlide 1 -EndSlide 2 -Label "文献补充 失代偿病理生理"
    $literatureTail += 2

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["蒋玉梅-问题文献"] -AfterIndex $literatureTail -StartSlide 2 -EndSlide 4 -Label "文献 MIF/CD74"
    $literatureTail += 3

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["刘子硕-文献"] -AfterIndex $literatureTail -StartSlide 1 -EndSlide 2 -Label "文献 DLL4/Notch"
    $literatureTail += 2

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["常瑞琪-问题文献"] -AfterIndex $literatureTail -StartSlide 2 -EndSlide 2 -Label "文献 白细胞跨内皮迁移"
    $literatureTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["姚丁睿-文献"] -AfterIndex $literatureTail -StartSlide 1 -EndSlide 1 -Label "文献 利福昔明 / LSEC"
    $literatureTail += 1

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["林诚亚-问题文献"] -AfterIndex $literatureTail -StartSlide 2 -EndSlide 3 -Label "文献 YAP / EMT"
    $literatureTail += 2

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["张志擎-文献"] -AfterIndex $literatureTail -StartSlide 1 -EndSlide 4 -Label "文献 黄芪汤 / 自噬"
    $literatureTail += 4

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["谢尚锦-文献"] -AfterIndex $literatureTail -StartSlide 1 -EndSlide 9 -Label "文献 MOTS-c / Nrf2"
    $literatureTail += 9

    Insert-SlideRange -Presentation $presentation -FilePath $sourceFiles["王鹤-Case3"] -AfterIndex $literatureTail -StartSlide 2 -EndSlide 2 -Label "文献 HSC 综述补充"
    $literatureTail += 1

    # 最终页数做一次硬校验：
    # 11 页主持人底稿
    # + 14 页临床问题插入
    # + 24 页文献插入
    # = 49 页？不对，需要认真按实际相关页数校验。
    #
    # 实际应为：
    # 主持人底稿 11
    # 临床新增 2+2+1+1+1+1+1+1+1 = 11
    # 文献新增 2+3+2+1+1+2+4+9+1 = 25
    # 总计 47 页。
    $expectedTotalSlides = 47
    $actualTotalSlides = $presentation.Slides.Count
    if ($actualTotalSlides -ne $expectedTotalSlides) {
        throw "最终总页数异常：期望 $expectedTotalSlides 页，实际 $actualTotalSlides 页。"
    }

    # 保存最终稿。
    $presentation.Save()

    # 导出逐页 PNG 预览，方便后续人工抽查是否插错顺序、是否出现空白页。
    $presentation.Export($PreviewDir, "PNG", 1280, 720)

    Write-Host ""
    Write-Host ("[完成] 已生成整合版 PPT：{0}" -f $OutputPptx)
    Write-Host ("[完成] 已导出预览图目录：{0}" -f $PreviewDir)
    Write-Host ("[完成] 最终页数：{0}" -f $presentation.Slides.Count)
}
finally {
    if ($presentation -ne $null) {
        $presentation.Close()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
    }

    if ($powerPoint -ne $null) {
        $powerPoint.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
    }

    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
