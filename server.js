import express from 'express';
import multer from 'multer';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Only load .env file in development (not in production on Azure)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = process.env.PORT || 8080;
const host = process.env.WEBSITE_HOSTNAME ? '0.0.0.0' : 'localhost';

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Serve static files
app.use(express.static('public'));

// Config from env
const keyVaultUrl = process.env.KEY_VAULT_URL;
const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;
const containerName = process.env.CONTAINER_NAME || 'images';
const storageKeySecretName = process.env.STORAGE_KEY_SECRET_NAME || 'StorageAccountKey';

if (!keyVaultUrl || !storageAccountName) {
  console.error('Missing KEY_VAULT_URL or STORAGE_ACCOUNT_NAME in environment.');
  process.exit(1);
}

const credential = new DefaultAzureCredential();
const secretClient = new SecretClient(keyVaultUrl, credential);

async function getStorageCredentials() {
  // Read storage key from Key Vault
  const secret = await secretClient.getSecret(storageKeySecretName);
  const accountKey = secret.value;

  // Create StorageSharedKeyCredential for BlobServiceClient
  const sharedKeyCredential = new StorageSharedKeyCredential(storageAccountName, accountKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net`,
    sharedKeyCredential
  );
  return blobServiceClient;
}

// Landing page
app.get('/', (req, res) => {
  res.render('index');
});

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  try {
    const blobServiceClient = await getStorageCredentials();
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();

    // Sanitize filename for blob storage (remove invalid characters)
    const safeFilename = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace invalid chars with underscore
      .replace(/\s+/g, '_')              // Replace spaces with underscore
      .replace(/_{2,}/g, '_')            // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '');          // Remove leading/trailing underscores
    
    const blobName = Date.now() + '-' + safeFilename;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    const url = blockBlobClient.url;
    res.send(`<div class="success-message"><h2>✅ Uploaded: <a href="${url}" target="_blank">${blobName}</a></h2><p><a href="/">Upload another</a> | <a href="/gallery">View Gallery</a></p></div><style>${fs.readFileSync(path.join(process.cwd(), 'public/css/style.css'), 'utf8')}</style>`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Upload failed: ' + (err.message || err));
  }
});

// Simple gallery to list blobs
app.get('/gallery', async (req, res) => {
  try {
    const blobServiceClient = await getStorageCredentials();
    const containerClient = blobServiceClient.getContainerClient(containerName);
    let items = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const url = `https://${storageAccountName}.blob.core.windows.net/${containerName}/${blob.name}`;
      items.push({ name: blob.name, url });
    }
    res.render('gallery', { files: items });
  } catch (err) {
    console.error('Gallery error:', err);
    res.status(500).send('Failed to list images: ' + (err.message || err));
  }
});

const listener = app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});

export default listener;
