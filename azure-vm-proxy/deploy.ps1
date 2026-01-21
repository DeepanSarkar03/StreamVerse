# StreamVerse Proxy VM Deployment
# Cost: ~$4/month with Spot pricing, ~$8/month regular

param(
    [string]$ResourceGroup = "streamverse-proxy-rg",
    [string]$Location = "eastus",
    [string]$VmName = "streamverse-proxy",
    [switch]$UseSpot = $true
)

Write-Host "🚀 Deploying StreamVerse Proxy VM..." -ForegroundColor Cyan

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please login to Azure first..." -ForegroundColor Yellow
    az login
}

Write-Host "Using subscription: $($account.name)" -ForegroundColor Green

# Create resource group
Write-Host "`n📦 Creating resource group..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --output none

# Generate a secret
$ProxySecret = [System.Guid]::NewGuid().ToString()

# Create VM (B1s = cheapest, ~1GB RAM)
Write-Host "`n🖥️  Creating VM (B1s - ~$4-8/month)..." -ForegroundColor Cyan

$vmArgs = @(
    "vm", "create",
    "--resource-group", $ResourceGroup,
    "--name", $VmName,
    "--image", "Ubuntu2404",
    "--size", "Standard_B1s",
    "--admin-username", "azureuser",
    "--generate-ssh-keys",
    "--public-ip-sku", "Basic",
    "--output", "json"
)

if ($UseSpot) {
    $vmArgs += "--priority", "Spot"
    $vmArgs += "--eviction-policy", "Deallocate"
    $vmArgs += "--max-price", "0.01"
    Write-Host "   Using Spot pricing (~50% cheaper)" -ForegroundColor Green
}

$vmResult = az @vmArgs | ConvertFrom-Json

# Open port 3000
Write-Host "`n🔓 Opening port 3000..." -ForegroundColor Cyan
az vm open-port --port 3000 --resource-group $ResourceGroup --name $VmName --output none

# Get public IP
$publicIp = $vmResult.publicIpAddress
Write-Host "`n✅ VM Created!" -ForegroundColor Green
Write-Host "   IP Address: $publicIp" -ForegroundColor White

# Create setup script
$setupScript = @"
#!/bin/bash
set -e

echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Creating proxy directory..."
mkdir -p ~/proxy
cd ~/proxy

echo "Creating package.json..."
cat > package.json << 'PKGEOF'
{
  "name": "streamverse-proxy",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@azure/storage-blob": "^12.17.0",
    "express": "^4.18.2"
  }
}
PKGEOF

echo "Installing dependencies..."
npm install

echo "Creating proxy server..."
cat > proxy.mjs << 'PROXYEOF'
$(Get-Content -Path ".\proxy.mjs" -Raw)
PROXYEOF

echo "Setting environment variables..."
cat > .env << ENVEOF
PROXY_SECRET=$ProxySecret
AZURE_STORAGE_CONNECTION_STRING="$(Read-Host 'Enter your Azure Storage connection string')"
AZURE_STORAGE_CONTAINER_NAME=movies
ENVEOF

echo "Installing PM2..."
sudo npm install -g pm2

echo "Starting proxy..."
pm2 start proxy.mjs --name streamverse-proxy
pm2 save
sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u azureuser --hp /home/azureuser

echo "Done! Proxy running on port 3000"
"@

Write-Host "`n📋 Setup Instructions:" -ForegroundColor Yellow
Write-Host "1. SSH into the VM:"
Write-Host "   ssh azureuser@$publicIp" -ForegroundColor White
Write-Host ""
Write-Host "2. Run these commands on the VM:" -ForegroundColor Yellow
Write-Host @"

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create and enter directory
mkdir -p ~/proxy && cd ~/proxy

# Create package.json
cat > package.json << 'EOF'
{
  "name": "streamverse-proxy",
  "type": "module",
  "dependencies": {
    "@azure/storage-blob": "^12.17.0",
    "express": "^4.18.2"
  }
}
EOF

# Install deps
npm install

# Download proxy script (or paste it manually)
# Then set environment variables:
export PROXY_SECRET="$ProxySecret"
export AZURE_STORAGE_CONNECTION_STRING="<YOUR_CONNECTION_STRING>"
export AZURE_STORAGE_CONTAINER_NAME="movies"

# Run with PM2
sudo npm install -g pm2
pm2 start proxy.mjs
pm2 save
pm2 startup

"@ -ForegroundColor Gray

Write-Host "`n📝 Add these to your .env.local:" -ForegroundColor Yellow
Write-Host @"
PROXY_VM_URL=http://$publicIp`:3000
PROXY_VM_SECRET=$ProxySecret
"@ -ForegroundColor Green

Write-Host "`n✨ Done! Monthly cost: ~`$4 (Spot) or ~`$8 (Regular)" -ForegroundColor Cyan
