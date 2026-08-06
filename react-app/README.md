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

The default production target is the custom-domain root. Build and preview it with:

```sh
npm run build
npm run preview
```

Open `http://localhost:4173/`. Output is written to `dist/`.

Build and preview the optional GitHub repository-path target with:

```sh
npm run build:github
npm run preview:github
```

Open `http://localhost:4173/acc/`. Output is written separately to `dist-github/`.

Do not copy either output into the repository root or change GitHub Pages deployment from
`main`. A future preview deployment should upload the appropriate output as an isolated artifact
or publish it to a separate preview environment, never to the existing live site without approval.
