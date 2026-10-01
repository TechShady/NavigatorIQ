$node22bin = "C:\Users\john.kelly\.fnm\node-versions\v22.23.2\installation"
$env:PATH = "$node22bin;$env:PATH"

$tenants = @(
    "https://guu84124.apps.dynatrace.com",
    "https://rer30726.apps.dynatrace.com"
)

Write-Host "Building app..."
& ".\node_modules\.bin\dt-app.ps1" deploy --environment-url $tenants[0]

foreach ($tenant in $tenants[1..($tenants.Length - 1)]) {
    Write-Host "`nDeploying to $tenant..."
    & ".\node_modules\.bin\dt-app.ps1" deploy --environment-url $tenant --skip-build
}
