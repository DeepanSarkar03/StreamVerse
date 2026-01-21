# StreamVerse High-Speed Proxy VM

This deploys a cheap Azure VM (~$4-10/month) that downloads files at datacenter speed.

## Quick Deploy

```powershell
# Login to Azure
az login

# Set variables
$RESOURCE_GROUP = "streamverse-proxy-rg"
$LOCATION = "eastus"
$VM_NAME = "streamverse-proxy"
$ADMIN_USER = "azureuser"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create the cheapest VM (B1s = ~$4/month with spot pricing, ~$8/month normal)
az vm create `
  --resource-group $RESOURCE_GROUP `
  --name $VM_NAME `
  --image Ubuntu2404 `
  --size Standard_B1s `
  --admin-username $ADMIN_USER `
  --generate-ssh-keys `
  --public-ip-sku Basic `
  --priority Spot `
  --eviction-policy Deallocate `
  --max-price 0.01

# Open port 3000 for the proxy
az vm open-port --port 3000 --resource-group $RESOURCE_GROUP --name $VM_NAME

# Get the public IP
$IP = az vm show -d -g $RESOURCE_GROUP -n $VM_NAME --query publicIps -o tsv
Write-Host "VM IP: $IP"

# SSH into the VM and run setup
ssh azureuser@$IP
```

## On the VM, run:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create proxy directory
mkdir -p ~/proxy && cd ~/proxy

# Create package.json
cat > package.json << 'EOF'
{
  "name": "streamverse-proxy",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@azure/storage-blob": "^12.17.0",
    "express": "^4.18.2"
  }
}
EOF

# Install dependencies
npm install

# Create the proxy server (paste proxy.mjs content here)
nano proxy.mjs

# Run with PM2 for auto-restart
sudo npm install -g pm2
pm2 start proxy.mjs --name streamverse-proxy
pm2 save
pm2 startup
```

## Cost Breakdown

| VM Type | Monthly Cost | Notes |
|---------|-------------|-------|
| B1s Spot | ~$4/month | Cheapest, may be evicted |
| B1s Normal | ~$8/month | Always on |
| B1ms | ~$15/month | More RAM for large files |

## Environment Variables

Set these in your `.env.local`:
```
PROXY_VM_URL=http://<VM_IP>:3000
PROXY_VM_SECRET=<generate-a-secret>
```
