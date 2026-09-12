$root = Split-Path -Parent $PSScriptRoot
$template = [IO.File]::ReadAllText((Join-Path $root 'src\shell.html'))

$evaluator = {
    param($m)
    $rel = $m.Groups[1].Value
    $path = Join-Path $root $rel
    if (-not (Test-Path $path)) { throw "Missing include: $rel" }
    $text = [IO.File]::ReadAllText($path)
    # an inline </script> would terminate the host block early and silently truncate the module
    if ($text -match '</script') { throw "Include $rel contains a literal </script, which would break inlining" }
    $text
}

$out = [regex]::Replace($template, '/\* @@INCLUDE (\S+) @@ \*/', [Text.RegularExpressions.MatchEvaluator]$evaluator)
$dest = Join-Path $root 'index.html'
[IO.File]::WriteAllText($dest, $out, (New-Object Text.UTF8Encoding $false))
"Assembled index.html ($([math]::Round($out.Length / 1KB)) KB)"
