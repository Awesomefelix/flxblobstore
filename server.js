import express from 'express';
import multer from 'multer';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { AppConfigurationClient } from '@azure/app-configuration';
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
// Check for storage account key directly in environment
const storageAccountKey = process.env.STORAGE_ACCOUNT_KEY;
const storageKeySecretName = process.env.STORAGE_KEY_SECRET_NAME || 'StorageAccountKey';
const appConfigEndpoint = process.env.APP_CONFIG_ENDPOINT; // e.g. https://<your-config>.azconfig.io

if (!storageAccountName) {
  console.error('Missing STORAGE_ACCOUNT_NAME in environment.');
  process.exit(1);
}

console.log('Configuration loaded:');
console.log('  Key Vault URL:', keyVaultUrl);
console.log('  Storage Account:', storageAccountName);
console.log('  Container:', containerName);
console.log('  Secret Name:', storageKeySecretName);
console.log('  Has Storage Key in env:', !!storageAccountKey);
console.log('  App Config Endpoint:', appConfigEndpoint);

const credential = new DefaultAzureCredential();
const secretClient = new SecretClient(keyVaultUrl, credential);

// ------ Feature Flags (Azure App Configuration) ------
let featureFlags = { };
let appConfigClient = null;

if (appConfigEndpoint) {
  try {
    appConfigClient = new AppConfigurationClient(appConfigEndpoint, credential);
    console.log('App Configuration client initialized');
  } catch (err) {
    console.error('Failed to initialize App Configuration client:', err.message);
  }
}

async function refreshFeatureFlags() {
  if (!appConfigClient) return;
  try {
    const flags = { };
    const iter = appConfigClient.listConfigurationSettings({ keyFilter: '.appconfig.featureflag/*' });
    for await (const setting of iter) {
      try {
        const parsed = JSON.parse(setting.value);
        // setting.key looks like .appconfig.featureflag/<name>
        const name = setting.key.split('/')[1];
        flags[name] = !!parsed.enabled;
      } catch (e) {
        // ignore invalid flag entries
      }
    }
    featureFlags = flags;
    console.log('Feature flags refreshed:', featureFlags);
  } catch (err) {
    console.error('Failed to refresh feature flags:', err.message);
  }
}

// Initial load and periodic refresh (every 5 minutes)
refreshFeatureFlags();
setInterval(refreshFeatureFlags, 5 * 60 * 1000);

// Expose flags to templates
app.use((req, res, next) => {
  res.locals.flags = featureFlags;
  next();
});

async function getStorageCredentials() {
  let accountKey;
  
  // First, check if we have the storage account key directly in STORAGE_ACCOUNT_KEY environment variable
  if (storageAccountKey) {
    accountKey = storageAccountKey;
    console.log('Using storage account key from STORAGE_ACCOUNT_KEY environment variable');
  } else if (keyVaultUrl) {
    // Try to read from Key Vault
    try {
      const secret = await secretClient.getSecret(storageKeySecretName);
      accountKey = secret.value;
      console.log('Successfully retrieved storage account key from Key Vault');
    } catch (err) {
      console.error('Failed to retrieve key from Key Vault:', err.message);
      throw new Error('Unable to get storage account credentials. Please set STORAGE_ACCOUNT_KEY environment variable.');
    }
  } else {
    throw new Error('No storage account credentials found. Set STORAGE_ACCOUNT_KEY or configure Key Vault.');
  }

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

// Simple gallery to list blobs (guarded by feature flag 'enableGallery')
app.get('/gallery', async (req, res) => {
  if (featureFlags.enableGallery === false) {
    return res.status(404).send('Gallery is disabled');
  }
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
