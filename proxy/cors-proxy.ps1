
param(
  [string]$Listen = "http://127.0.0.1:9900/",
  [string]$Upstream = "http://127.0.0.1:8085",
  [string]$Root = ".."
)

Add-Type -AssemblyName System.Net.Http
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Listen)
$listener.Start()
Write-Host "CORS proxy listening at $Listen -> $Upstream (serving static from $Root)"

function Send-Bytes($ctx, $bytes, $contentType="application/octet-stream", $code=200) {
  $resp = $ctx.Response
  $resp.StatusCode = $code
  $resp.Headers["Access-Control-Allow-Origin"] = "*"
  $resp.Headers["Access-Control-Allow-Headers"] = "*"
  $resp.ContentType = $contentType
  $resp.OutputStream.Write($bytes,0,$bytes.Length)
  $resp.OutputStream.Flush()
  $resp.Close()
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request

  # Preflight
  if ($req.HttpMethod -eq "OPTIONS") {
    $ctx.Response.StatusCode = 204
    $ctx.Response.Headers["Access-Control-Allow-Origin"] = "*"
    $ctx.Response.Headers["Access-Control-Allow-Headers"] = "*"
    $ctx.Response.Close()
    continue
  }

  $localPath = [IO.Path]::Combine($Root, $req.Url.AbsolutePath.TrimStart('/').Replace('/','\'))
  if ([IO.File]::Exists($localPath)) {
    $bytes = [IO.File]::ReadAllBytes($localPath)
    $ext = [IO.Path]::GetExtension($localPath).ToLower()
    $ct = switch ($ext) {
      ".html" { "text/html; charset=utf-8" }
      ".js"   { "application/javascript; charset=utf-8" }
      ".css"  { "text/css; charset=utf-8" }
      ".png"  { "image/png" }
      ".jpg"  { "image/jpeg" }
      default { "application/octet-stream" }
    }
    Send-Bytes $ctx $bytes $ct 200
    continue
  }

  # Reverse proxy
  try {
    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromMinutes(10)
    $up = $Upstream.TrimEnd('/') + $req.RawUrl

    $method = New-Object System.Net.Http.HttpMethod($req.HttpMethod)
    if ($req.HasEntityBody) {
      $ms = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      $ms.Position = 0
      $content = New-Object System.Net.Http.StreamContent($ms)
      if ($req.ContentType) { $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($req.ContentType) }
      $outReq = New-Object System.Net.Http.HttpRequestMessage($method, $up)
      $outReq.Content = $content
    } else {
      $outReq = New-Object System.Net.Http.HttpRequestMessage($method, $up)
    }

    foreach ($h in $req.Headers.AllKeys) {
      if ($h -in @("Host","Content-Length")) { continue }
      $outReq.Headers.TryAddWithoutValidation($h, $req.Headers[$h]) | Out-Null
    }

    $resp = $client.SendAsync($outReq, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
    $ctx.Response.StatusCode = [int]$resp.StatusCode
    $ctx.Response.Headers["Access-Control-Allow-Origin"] = "*"
    $ctx.Response.Headers["Access-Control-Allow-Headers"] = "*"

    foreach ($h in $resp.Headers) {
      $ctx.Response.Headers[$h.Key] = ($h.Value -join ", ")
    }
    if ($resp.Content -and $resp.Content.Headers.ContentType) {
      $ctx.Response.ContentType = $resp.Content.Headers.ContentType.ToString()
    }

    $s = $resp.Content.ReadAsStreamAsync().Result
    $buf = New-Object byte[] 8192
    while (($n = $s.Read($buf,0,$buf.Length)) -gt 0) {
      $ctx.Response.OutputStream.Write($buf,0,$n)
      $ctx.Response.OutputStream.Flush()
    }
    $ctx.Response.OutputStream.Close()
  } catch {
    $msg = [Text.Encoding]::UTF8.GetBytes("Proxy error: " + $_.Exception.Message)
    Send-Bytes $ctx $msg "text/plain; charset=utf-8" 502
  }
}
