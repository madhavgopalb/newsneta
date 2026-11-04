param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$brandDir = Join-Path $root "assets\brand\v1"
$appDir = Join-Path $root "assets\app"
$androidDir = Join-Path $root "android\branding"
New-Item -ItemType Directory -Force -Path $brandDir, $appDir, $androidDir | Out-Null

$sourceAsset = Join-Path $brandDir "newsneta-official-source.jpg"
Copy-Item -LiteralPath $SourcePath -Destination $sourceAsset -Force

$source = [System.Drawing.Image]::FromFile($sourceAsset)
$sourceBitmap = New-Object System.Drawing.Bitmap($source)
$sampledRed = $sourceBitmap.GetPixel([int]($source.Width / 2), 24)
$brandRed = [System.Drawing.Color]::FromArgb(255, $sampledRed.R, $sampledRed.G, $sampledRed.B)

function New-Canvas([int]$Width, [int]$Height, [System.Drawing.Color]$Color) {
  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear($Color)
  $graphics.Dispose()
  return $bitmap
}

function Set-Quality([System.Drawing.Graphics]$Graphics) {
  $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
}

function Save-Png([System.Drawing.Bitmap]$Bitmap, [string]$Path) {
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Bitmap.Dispose()
}

function New-FittedAsset([int]$Width, [int]$Height, [string]$Path, [int]$Padding = 0, [System.Drawing.Color]$Background = $brandRed) {
  $canvas = New-Canvas $Width $Height $Background
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  Set-Quality $graphics
  $availableWidth = $Width - (2 * $Padding)
  $availableHeight = $Height - (2 * $Padding)
  $scale = [Math]::Min($availableWidth / $source.Width, $availableHeight / $source.Height)
  $drawWidth = [int][Math]::Round($source.Width * $scale)
  $drawHeight = [int][Math]::Round($source.Height * $scale)
  $x = [int](($Width - $drawWidth) / 2)
  $y = [int](($Height - $drawHeight) / 2)
  $graphics.DrawImage($source, $x, $y, $drawWidth, $drawHeight)
  $graphics.Dispose()
  Save-Png $canvas $Path
}

function New-CompactIcon([int]$Size, [string]$Path, [double]$SafeArea = 0.82) {
  # Exact crop of the first large Telugu glyph from the supplied official artwork.
  # It remains recognizable at favicon and launcher sizes without recreating lettering.
  $crop = New-Object System.Drawing.Rectangle(64, 92, 214, 294)
  $canvas = New-Canvas $Size $Size $brandRed
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  Set-Quality $graphics
  $available = [int][Math]::Round($Size * $SafeArea)
  $scale = [Math]::Min($available / $crop.Width, $available / $crop.Height)
  $targetWidth = [int][Math]::Round($crop.Width * $scale)
  $targetHeight = [int][Math]::Round($crop.Height * $scale)
  $targetRect = New-Object System.Drawing.Rectangle([int](($Size - $targetWidth) / 2), [int](($Size - $targetHeight) / 2), $targetWidth, $targetHeight)
  $graphics.DrawImage($source, $targetRect, $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $graphics.Dispose()
  Save-Png $canvas $Path
}

New-FittedAsset 1280 552 (Join-Path $brandDir "wordmark-desktop.png")
New-FittedAsset 720 310 (Join-Path $brandDir "wordmark-mobile.png")
New-FittedAsset 640 276 (Join-Path $brandDir "email-header.png")
New-FittedAsset 1200 630 (Join-Path $brandDir "social-share-1200x630.png") 56
New-FittedAsset 1242 2688 (Join-Path $brandDir "splash-1242x2688.png") 120

New-CompactIcon 32 (Join-Path $brandDir "favicon-32.png") 0.90
New-CompactIcon 48 (Join-Path $brandDir "favicon-48.png") 0.88
New-CompactIcon 180 (Join-Path $brandDir "apple-touch-icon-180.png") 0.84
New-CompactIcon 192 (Join-Path $appDir "icon-192.png") 0.82
New-CompactIcon 512 (Join-Path $appDir "icon-512.png") 0.82
New-CompactIcon 192 (Join-Path $appDir "maskable-192.png") 0.64
New-CompactIcon 512 (Join-Path $appDir "maskable-512.png") 0.64
New-CompactIcon 512 (Join-Path $androidDir "launcher-512.png") 0.82
New-CompactIcon 512 (Join-Path $androidDir "launcher-maskable-512.png") 0.64

# Keep compatibility paths official while older installed clients age out.
Copy-Item -LiteralPath (Join-Path $brandDir "wordmark-desktop.png") -Destination (Join-Path $root "assets\newsneta-logo-header.png") -Force
Copy-Item -LiteralPath (Join-Path $brandDir "wordmark-mobile.png") -Destination (Join-Path $root "assets\newsneta-logo-transparent.png") -Force
Copy-Item -LiteralPath $sourceAsset -Destination (Join-Path $root "assets\newsneta-logo.jpg") -Force

$source.Dispose()
$sourceBitmap.Dispose()
Write-Output "Generated NewsNeta brand assets in assets/brand/v1, assets/app, and android/branding."
