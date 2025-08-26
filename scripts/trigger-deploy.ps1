Param(
  [string]$Message = "ci: trigger deploy"
)

# Creates an empty commit to trigger GitHub Actions deployment workflow
git commit --allow-empty -m $Message
git push origin main
Write-Host "Triggered deploy with message: $Message"
