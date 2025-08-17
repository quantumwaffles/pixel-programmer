# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building (Static Site)

This project is configured with `@sveltejs/adapter-static` so it exports a static site suitable for GitHub Pages.

Build output goes to `build/` (default from adapter-static):

```sh
npm run build
```

Preview locally:
```sh
npm run preview
```

### Deploying to GitHub Pages

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is included. On pushes to `main` (or `master`) it will:
1. Install dependencies
2. Build with `GH_PAGES_BASE` set to `/<repo-name>` (so asset paths work on project Pages)
3. Publish the `build/` folder to Pages

If your repository is named `pixel-programmer`, after enabling Pages (Settings → Pages → Build and deployment → GitHub Actions) the site will appear at:
```
https://<your-username>.github.io/pixel-programmer/
```

If you serve from a custom domain remove/adjust `GH_PAGES_BASE` env and optionally set a `CNAME` file.

### Local Base Path Testing

To emulate the GitHub Pages base path locally:
```sh
set GH_PAGES_BASE=/pixel-programmer
npm run build
npm run preview
```
On PowerShell use:
```powershell
$env:GH_PAGES_BASE='/pixel-programmer'; npm run build; npm run preview
```

Then visit `http://localhost:4173/pixel-programmer/`.
