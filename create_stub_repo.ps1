# create_stub_repo.ps1
# Idempotent script to create placeholder folders/files for PROTOTYPE
param()

Write-Output "Creating PROTOTYPE public and scripts folders..."
New-Item -ItemType Directory -Force -Path PROTOTYPE\public\avatars | Out-Null
New-Item -ItemType Directory -Force -Path PROTOTYPE\public\sounds | Out-Null
New-Item -ItemType Directory -Force -Path PROTOTYPE\scripts | Out-Null

Write-Output "Adding .gitkeep placeholders..."
"" | Out-File -Encoding utf8 PROTOTYPE\public\avatars\.gitkeep
"" | Out-File -Encoding utf8 PROTOTYPE\public\sounds\.gitkeep

Write-Output "Adding script placeholders..."
"// smoke test placeholder" | Out-File -Encoding utf8 PROTOTYPE\scripts\smoke-test.ts
"// visual test placeholder" | Out-File -Encoding utf8 PROTOTYPE\scripts\visual-test.js
"// visual multi test placeholder" | Out-File -Encoding utf8 PROTOTYPE\scripts\visual-test-multi.js

Write-Output "Adding page and puppeteer placeholders..."
"<html><body>page-dev placeholder</body></html>" | Out-File -Encoding utf8 page-dev.html
"<html><body>page-root placeholder</body></html>" | Out-File -Encoding utf8 page-root.html
"<html><body>page placeholder</body></html>" | Out-File -Encoding utf8 page.html
"puppeteer result placeholder" | Out-File -Encoding utf8 PROTOTYPE\puppeteer-result.txt
"puppeteer result 2 placeholder" | Out-File -Encoding utf8 PROTOTYPE\puppeteer-result2.txt

Write-Output "Staging and committing placeholder files..."
git add PROTOTYPE/public PROTOTYPE/scripts page-dev.html page-root.html page.html PROTOTYPE/puppeteer-result.txt PROTOTYPE/puppeteer-result2.txt pr_body.md 2>$null
try {
    git commit -m "chore: stub missing public assets and scripts for repo stability" | Out-Null
    Write-Output "Committed placeholders"
} catch {
    Write-Output "No commit created (nothing to commit)"
}

Write-Output "Pushing branch to origin/ledger/hardening-snapshot-update..."
git push origin ledger/hardening-snapshot-update

Write-Output "Done."
