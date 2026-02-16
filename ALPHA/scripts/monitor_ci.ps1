param(
  [string]$Repo = 'jamesonolitoquit/project-isekai-prototype',
  [int]$IntervalSec = 15,
  [int]$TimeoutSec = 600
)

$endTime = (Get-Date).AddSeconds($TimeoutSec)
Write-Output "Monitoring CI for repo $Repo (timeout $TimeoutSec s, interval $IntervalSec s)..."
while((Get-Date) -lt $endTime) {
  try {
    $branch = gh api repos/$Repo/branches/main -H "Accept: application/vnd.github+json" | ConvertFrom-Json
    $sha = $branch.commit.sha
  } catch {
    Start-Sleep -Seconds $IntervalSec
    continue
  }

  if (-not $sha) { Start-Sleep -Seconds $IntervalSec; continue }

  $checkRunsJson = gh api repos/$Repo/commits/$sha/check-runs -H "Accept: application/vnd.github+json" 2>$null
  $statusJson = gh api repos/$Repo/commits/$sha/status -H "Accept: application/vnd.github+json" 2>$null

  $checkRuns = $null
  $status = $null
  try { $checkRuns = $checkRunsJson | ConvertFrom-Json } catch {}
  try { $status = $statusJson | ConvertFrom-Json } catch {}

  $hasChecks = $false
  if ($checkRuns -and $checkRuns.total_count -gt 0) { $hasChecks = $true }
  if ($status -and $status.statuses.Count -gt 0) { $hasChecks = $true }

  if ($hasChecks) {
    $outDir = Join-Path -Path (Get-Location) -ChildPath 'PROTOTYPE'
    $checkRunsJson | Out-File -FilePath (Join-Path $outDir 'ci_check_runs.json') -Encoding utf8
    $statusJson | Out-File -FilePath (Join-Path $outDir 'ci_status.json') -Encoding utf8
    Write-Output "Found CI contexts for commit $sha. Saved to PROTOTYPE/ci_check_runs.json and PROTOTYPE/ci_status.json"
    exit 0
  }

  Start-Sleep -Seconds $IntervalSec
}

Write-Output "Timeout reached without finding CI contexts."
exit 2
