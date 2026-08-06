# ACC React foundation

This directory is the isolated Phase 2 React foundation. The Vanilla application at the
repository root remains unchanged and continues to be the production application.

## Local commands

```sh
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

Vite serves development at `/acc/` because the production base is the GitHub repository path.
Use the URL printed by Vite, normally `http://localhost:5173/acc/`. The preview command serves
the production output locally, normally at `http://localhost:4173/acc/`.

Do not copy `dist/` into the repository root or change GitHub Pages deployment from `main`.
A future preview deployment should upload `react-app/dist` as an isolated artifact or publish
it to a separate preview environment, never to the existing live site without approval.
