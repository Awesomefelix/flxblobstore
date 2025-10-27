# Azure DevOps Deployment Guide

This guide explains how to deploy the Node.js Blob Storage Uploader to Azure App Service using Azure DevOps.

## Prerequisites

1. Azure DevOps organization and project
2. Azure subscription with:
   - Azure App Service (Linux)
   - Azure Key Vault
   - Azure Storage Account
3. Service connection in Azure DevOps to your Azure subscription

## Setup Instructions

### 1. Configure Azure Resources

#### Create App Service Plan and App Service (if not already created)
```bash
# Login to Azure
az login

# Create resource group (if needed)
az group create --name your-resource-group --location eastus

# Create App Service Plan (if needed)
az appservice plan create --name your-app-plan --resource-group your-resource-group --sku B1 --is-linux

# Create App Service
az webapp create --name your-app-service-name --resource-group your-resource-group --plan your-app-plan --runtime "NODE:20-lts"
```

### 2. Configure Azure DevOps

#### Create Service Connection
1. Go to Azure DevOps project
2. Navigate to **Project Settings** > **Service connections**
3. Click **New service connection**
4. Select **Azure Resource Manager**
5. Choose **Service principal (automatic)**
6. Select your subscription and resource group
7. Give it a name (e.g., "Azure Connection")
8. Click **Save**

#### Create Pipeline Variables
1. Go to **Pipelines** > **Library**
2. Create a new **Variable group** named "Azure Deployment Variables"
3. Add the following variables:
   - `KEY_VAULT_URL`: Your Key Vault URL (e.g., https://your-keyvault.vault.azure.net/)
   - `STORAGE_ACCOUNT_NAME`: Your storage account name
   - `CONTAINER_NAME`: Your blob container name (default: images)
   - `STORAGE_KEY_SECRET_NAME`: Name of the secret in Key Vault (default: StorageAccountKey)

#### Link Variable Group to Pipeline
In `azure-pipelines.yml`, add this section after `variables:`:
```yaml
variables:
  - group: 'Azure Deployment Variables'  # Add this line
  azureSubscription: 'your-azure-service-connection'
  # ... rest of variables
```

### 3. Update Pipeline Configuration

Edit `azure-pipelines.yml` and update these values:

```yaml
variables:
  azureSubscription: 'your-azure-service-connection'  # Name from step 2
  appName: 'your-app-service-name'                    # Your App Service name
  resourceGroup: 'your-resource-group'                # Your resource group name
```

### 4. Configure Managed Identity (Recommended)

For better security, use Managed Identity instead of storing secrets:

#### Enable Managed Identity on App Service
```bash
az webapp identity assign --name your-app-service-name --resource-group your-resource-group
```

#### Grant Access to Key Vault
```bash
# Get the principal ID
PRINCIPAL_ID=$(az webapp identity show --name your-app-service-name --resource-group your-resource-group --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy --name your-keyvault-name --object-id $PRINCIPAL_ID --secret-permissions get list
```

#### Grant Access to Storage Account
```bash
# Get the principal ID
PRINCIPAL_ID=$(az webapp identity show --name your-app-service-name --resource-group your-resource-group --query principalId -o tsv)

# Get storage account ID
STORAGE_ID=$(az storage account show --name your-storage-account --resource-group your-resource-group --query id -o tsv)

# Assign Storage Blob Data Contributor role
az role assignment create --assignee $PRINCIPAL_ID --role "Storage Blob Data Contributor" --scope $STORAGE_ID
```

### 5. Create and Run Pipeline

1. Go to **Pipelines** in Azure DevOps
2. Click **New pipeline**
3. Select your repository (GitHub, Azure Repos, etc.)
4. Choose **Existing Azure Pipelines YAML file**
5. Select the branch (main/master) and path: `azure-pipelines.yml`
6. Click **Run**
7. Monitor the pipeline execution

### 6. Configure App Service Settings (First Time)

On first deployment, you may need to set these in Azure Portal:

1. Go to your App Service in Azure Portal
2. Navigate to **Configuration** > **Application settings**
3. Add:
   - `KEY_VAULT_URL`
   - `STORAGE_ACCOUNT_NAME`
   - `CONTAINER_NAME`
   - `STORAGE_KEY_SECRET_NAME`
4. Click **Save**

Or use the Azure CLI:
```bash
az webapp config appsettings set --name your-app-service-name --resource-group your-resource-group --settings \
  KEY_VAULT_URL="https://your-keyvault.vault.azure.net/" \
  STORAGE_ACCOUNT_NAME="your-storage-account" \
  CONTAINER_NAME="images" \
  STORAGE_KEY_SECRET_NAME="StorageAccountKey"
```

## Continuous Deployment

Once configured, the pipeline will automatically trigger on pushes to `main` or `master` branch.

To deploy manually:
1. Go to **Pipelines** in Azure DevOps
2. Select your pipeline
3. Click **Run pipeline**
4. Choose branch and click **Run**

## Monitoring

- View pipeline runs: Azure DevOps > Pipelines
- View app logs: Azure Portal > App Service > Log stream
- View application insights (if configured)

## Troubleshooting

### Build Fails
- Check Node.js version compatibility
- Verify all dependencies in `package.json`

### Deployment Fails
- Verify service connection permissions
- Check App Service is running
- Verify resource group and app name

### App Won't Start
- Check Application Insights for errors
- Review Log stream in Azure Portal
- Verify environment variables are set correctly
- Ensure Key Vault access permissions are correct

### Authentication Errors
- Verify Managed Identity is enabled
- Check Key Vault access policies
- Verify Storage Account role assignments

## Next Steps

- Set up staging slots for blue-green deployments
- Configure Application Insights for monitoring
- Add security scanning in pipeline
- Set up automated testing before deployment
