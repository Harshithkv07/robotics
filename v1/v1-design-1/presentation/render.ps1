# Render every slide of a deck to PNG with the installed PowerPoint (faithful fonts and layout).
# usage: pwsh presentation/render.ps1 <deck.pptx> <outDir> [width]
param([string]$Deck, [string]$OutDir, [int]$Width = 1600)
$Deck = (Resolve-Path $Deck).Path
New-Item -ItemType Directory -Force $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path
Get-ChildItem $OutDir -Filter "slide-*.png" -ErrorAction SilentlyContinue | Remove-Item -Force -Confirm:$false
$pp = New-Object -ComObject PowerPoint.Application
try {
    $p = $pp.Presentations.Open($Deck, $true, $false, $false)   # read-only, untitled, no window
    $h = [int]($Width * $p.PageSetup.SlideHeight / $p.PageSetup.SlideWidth)
    foreach ($s in $p.Slides) {
        $f = Join-Path $OutDir ("slide-{0:D2}.png" -f $s.SlideIndex)
        $s.Export($f, "PNG", $Width, $h)
    }
    "exported $($p.Slides.Count) slides to $OutDir"
    $p.Close()
} finally {
    $pp.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($pp) | Out-Null
}
