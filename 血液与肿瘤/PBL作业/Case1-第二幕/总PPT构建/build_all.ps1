<#
文件作用：
1. 一次性执行“安装依赖 → 生成支持页 → 合并总稿”三步。
2. 方便后续用户只运行一个命令，就能在当前顺序配置下重建整套总 PPT。
#>

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $ScriptRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $ScriptRoot "node_modules"))) {
        npm install
    }

    npm run build:support
    & (Join-Path $ScriptRoot "merge_final_deck.ps1")
}
finally {
    Pop-Location
}
