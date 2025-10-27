# Azure Image Uploader (Node.js)

Simple Node.js + Express app to upload images to Azure Blob Storage. The storage account key is fetched from Azure Key Vault.

## Setup

1. Copy `.env.example` to `.env` and fill in values.
2. Ensure the identity you use (developer or managed identity) has access to Key Vault secrets (get permission).
3. Add a secret in Key Vault named as in `STORAGE_KEY_SECRET_NAME` (default `StorageAccountKey`) with your storage account key value.
4. Install dependencies and run:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000 and upload images. View gallery at /gallery.

## Notes
- For production, prefer using Managed Identity and assign the storage account role instead of storing raw keys in Key Vault.
- Secure your app (auth, rate limits) before public use.
