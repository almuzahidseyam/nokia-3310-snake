
$content = Get-Content -Raw src/game/engine.ts
$content = $content -replace "export const LCD_BG = .*?;", ""
$content = $content -replace "export const LCD_BG_LIGHT = .*?;", ""
$content = $content -replace "export const LCD_GRID = .*?;", ""
$content = $content -replace "export const LCD_DARK = .*?;", ""
$content = $content -replace "export const LCD_MID = .*?;", ""
$content = $content -replace "export const LCD_FOOD = .*?;", ""

