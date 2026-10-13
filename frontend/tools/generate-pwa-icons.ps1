Add-Type -AssemblyName System.Drawing

$frontendRoot = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $frontendRoot 'assets\figma\tripio-logo-white.png'
$iconsPath = Join-Path $frontendRoot 'public\icons'
New-Item -ItemType Directory -Force -Path $iconsPath | Out-Null

$logo = [System.Drawing.Image]::FromFile($logoPath)
try {
  foreach ($size in @(180, 192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#061f4e'))

        $targetWidth = [int]($size * 0.76)
        $targetHeight = [int]($logo.Height * $targetWidth / $logo.Width)
        $left = [int](($size - $targetWidth) / 2)
        $top = [int](($size - $targetHeight) / 2)
        $graphics.DrawImage($logo, $left, $top, $targetWidth, $targetHeight)
      }
      finally {
        $graphics.Dispose()
      }

      $outputPath = Join-Path $iconsPath "tripio-$size.png"
      $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $bitmap.Dispose()
    }
  }
}
finally {
  $logo.Dispose()
}
