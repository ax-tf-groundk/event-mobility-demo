# Deploy to GitHub Pages

## 1. Re-authenticate GitHub CLI

```powershell
gh auth login -h github.com
```

Choose:

- GitHub.com
- HTTPS
- Login with a web browser

## 2. Create a repository and push

Run these commands inside this folder:

```powershell
git init
git add .
git commit -m "Add event mobility demo"
gh repo create event-mobility-demo --public --source . --remote origin --push
```

## 3. Enable GitHub Pages

The repository includes `.github/workflows/pages.yml`.

After the first push:

1. Open the repository on GitHub.
2. Go to `Settings` → `Pages`.
3. Set `Source` to `GitHub Actions`.
4. Run the workflow or push to `main` again.

The URL will look like:

```text
https://<github-username>.github.io/event-mobility-demo/
```

## 4. Later API integration

Replace the mock calculation layer in `app.js` with API-backed connectors:

- Incheon Airport OpenAPI
- ITS National Transport Information Center
- Seoul Open Data Plaza
- KMA weather API

