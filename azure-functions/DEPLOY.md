# StreamVerse Azure Function Deployment Guide

## Why Azure Function?

When you download a file locally:
```
Google Drive → Your PC (50 Mbps) → Azure Blob
= Hours for large files
```

When Azure Function downloads:
```
Google Drive → Azure Function (10+ Gbps) → Azure Blob  
= Seconds/minutes for large files
```

The Azure Function runs INSIDE Azure's datacenter with **internal network speeds**.

---

## Quick Deploy (5 minutes)

### Prerequisites
- Azure CLI installed (`winget install Microsoft.AzureCLI`)
- Azure Functions Core Tools (`npm install -g azure-functions-core-tools@4`)
- An Azure account

### Step 1: Login to Azure
```powershell
az login
```

### Step 2: Create Resources
```powershell
# Set variables
$resourceGroup = "streamverse-rg"
$location = "eastus"
$functionApp = "streamverse-downloader"
$storageAccount = "streamversefunc"  # Must be globally unique, lowercase

# Create resource group
az group create --name $resourceGroup --location $location

# Create storage account for the function
az storage account create --name $storageAccount --resource-group $resourceGroup --location $location --sku Standard_LRS

# Create function app
az functionapp create `
  --name $functionApp `
  --resource-group $resourceGroup `
  --storage-account $storageAccount `
  --consumption-plan-location $location `
  --runtime node `
  --runtime-version 20 `
  --functions-version 4
```

### Step 3: Configure the Function
```powershell
# Set your existing storage connection string (from your .env.local)
$connectionString = "YOUR_AZURE_STORAGE_CONNECTION_STRING"
$downloadSecret = "$(New-Guid)"  # Generate a random secret

az functionapp config appsettings set `
  --name $functionApp `
  --resource-group $resourceGroup `
  --settings `
    "AZURE_STORAGE_CONNECTION_STRING=$connectionString" `
    "AZURE_STORAGE_CONTAINER_NAME=movies" `
    "DOWNLOAD_SECRET=$downloadSecret"

# Get the function URL
$functionUrl = "https://$functionApp.azurewebsites.net"
Write-Host "Function URL: $functionUrl"
Write-Host "Secret: $downloadSecret"
```

### Step 4: Deploy the Function
```powershell
cd azure-functions
npm install
npm run build
func azure functionapp publish $functionApp
```

### Step 5: Update Your .env.local
Add these to your `.env.local`:
```
AZURE_FUNCTION_URL=https://streamverse-downloader.azurewebsites.net
AZURE_FUNCTION_SECRET=your-generated-secret
```

### Step 6: Restart Your App
```powershell
cd ..
npm run dev
```

---

## How It Works

1. **Import Request** → Your Next.js app receives URL
2. **Dispatch to Azure** → Sends request to Azure Function
3. **Datacenter Download** → Function downloads at 10+ Gbps
4. **Direct Storage** → Function uploads to Blob via internal network
5. **Progress Updates** → Your app polls for status updates

---

## Costs

Azure Functions Consumption Plan:
- **First 1 million executions/month**: FREE
- **Memory**: $0.000016/GB-s
- **For video downloads**: ~$0.01-0.10 per large file

Storage egress is free within Azure (Function → Blob = internal traffic).

---

## Troubleshooting

**Function not responding?**
```powershell
az functionapp log tail --name $functionApp --resource-group $resourceGroup
```

**Check function status:**
```powershell
az functionapp show --name $functionApp --resource-group $resourceGroup --query state
```

**Redeploy:**
```powershell
cd azure-functions
func azure functionapp publish $functionApp --force
```
