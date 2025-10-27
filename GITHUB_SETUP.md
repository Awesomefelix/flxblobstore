# Pushing to GitHub - Step by Step Guide

## Option 1: Using GitHub CLI (Easiest)

### 1. Install GitHub CLI (if not already installed)
- Download from: https://cli.github.com/

### 2. Login to GitHub
```bash
gh auth login
```

### 3. Initialize Git and Push
```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Azure Blob Storage Uploader with modern UI"

# Create repository on GitHub and push
gh repo create nodejs-blob-app --public --source=. --remote=origin --push
```

---

## Option 2: Manual Push (Using GitHub Website)

### 1. Initialize Git Repository
```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Azure Blob Storage Uploader with modern UI"
```

### 2. Create Repository on GitHub
1. Go to https://github.com/new
2. Name it: `nodejs-blob-app` (or any name you prefer)
3. Choose Public or Private
4. **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

### 3. Connect and Push
```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/nodejs-blob-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Option 3: If You Already Have a GitHub Repository

If you already created the repository on GitHub, just run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Azure Blob Storage Uploader with modern UI"

# Add your existing GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/nodejs-blob-app.git

# Push
git branch -M main
git push -u origin main
```

---

## Important Notes

### Before Pushing - Verify .env is NOT in the repo:
```bash
# Check if .env file exists (it should NOT be tracked)
git status

# If .env appears, make sure it's in .gitignore (it should be already)
# If needed, add it manually:
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Ensure .env is not tracked"
```

### Verify what will be pushed:
```bash
# See what files will be committed
git status

# You should see files like:
# - server.js
# - package.json
# - azure-pipelines.yml
# - views/
# - public/
# - .gitignore
# - README.md
# - DEPLOYMENT.md
# - .env.example (new file)
# - BUT NO .env file!
```

---

## After Pushing to GitHub

### For Azure DevOps Deployment:
1. Go to your Azure DevOps project
2. Go to Pipelines > New Pipeline
3. Select GitHub
4. Authorize Azure DevOps to access GitHub
5. Select your repository: `nodejs-blob-app`
6. Choose "Existing Azure Pipelines YAML file"
7. Path: `azure-pipelines.yml`
8. Click Run

### Update Pipeline Variables:
Go to Azure DevOps > Pipelines > Library > Create variable group:
- `KEY_VAULT_URL`
- `STORAGE_ACCOUNT_NAME`
- `CONTAINER_NAME`
- `STORAGE_KEY_SECRET_NAME`

---

## Troubleshooting

### "remote: Support for password authentication was removed"
- Use a Personal Access Token instead of password
- Or use GitHub CLI: `gh auth login`

### "fatal: remote origin already exists"
```bash
# Remove existing remote
git remote remove origin

# Add correct remote
git remote add origin https://github.com/YOUR_USERNAME/nodejs-blob-app.git
```

### Authentication issues
```bash
# Use SSH instead of HTTPS
git remote set-url origin git@github.com:YOUR_USERNAME/nodejs-blob-app.git

# Or configure credential manager for HTTPS
```
