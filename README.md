# ACC React application

This repository contains the production React + TypeScript ACC PWA deployed at
<https://acc.dbuilder.eu/>. The former Vanilla runtime has been removed from production; its three
calculation files retained under `src/test/legacy/source/` are test fixtures only.

## Data safety

- The React application uses only IndexedDB database `acc-react-db`.
- It never opens, upgrades, clears, or writes to the legacy `acc-db` database.
- A new installation starts empty. Legacy data is restored manually from an ACC JSON backup.
- Replace and Merge operate only on `acc-react-db`.
- An import is validated and normalized before writing. A failed validation does not write data.
- A restore is verified inside the same Dexie transaction. A failed post-write verification rolls
  the transaction back.

The React database schema is version 1:

| Table      | Key    | Contents                                       |
| ---------- | ------ | ---------------------------------------------- |
| `modeData` | `mode` | Separate Personal and Work people arrays       |
| `settings` | `key`  | Active mode and theme                          |
| `metadata` | `key`  | Backup metadata and application schema version |

React components use the typed Zustand store. Only repository and service modules access Dexie.

## Development

Install dependencies and run the development server:

```sh
npm install
npm run dev
```

Run all verification:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:dist
npm run build:github
```

## Production build and preview

The normal build targets the custom-domain root (`/`):

```sh
npm run build
npm run verify:dist
npm run preview
```

Open `http://localhost:4173/`. Output is written to `dist/`.

The optional GitHub repository-path build targets `/acc/` and has separate output:

```sh
npm run build:github
npm run preview:github
```

Open `http://localhost:4173/acc/`. Output is written to `dist-github/`.

## Import a saved legacy backup

1. Preview the React application locally.
2. Open **Data & Backup** using the top-left data button.
3. Select **Choose backup** and choose the saved legacy ACC `.json` file.
4. Review the filename, export date, validation status, Personal count, Work count, and total entry
   count before continuing.
5. Choose **Merge with current data** to apply the verified legacy merge rules, or select the
   explicit acknowledgement and choose **Replace all React data** to replace only `acc-react-db`.
6. Do not close the sheet until **Restore verified successfully** is shown.
7. Check Personal and Work lists, archived records, currencies, balances, payroll panels, and
   statistics against the legacy application.
8. Use **Export JSON** to create a fresh post-import safety backup.

Accepted backups use the existing unversioned format:

```ts
{
  personal: LegacyPerson[];
  work: LegacyPerson[];
  exportDate?: string;
}
```

IDs, archived state, currencies, salary anchors/baselines, legacy stages, `[Salary]` detection, and
unknown person/stage/entry fields are preserved. Export remains consumable by the same import path.

## Deployment targets

- Default/custom domain: Vite base `/`, manifest `start_url` `/`, manifest scope `/`.
- GitHub preview: Vite base `/acc/`, manifest `start_url` `/acc/`, manifest scope `/acc/`.
- PWA updates use a prompt. Existing clients are not force-reloaded while work may be unsaved.
- Regular and maskable ACC icons are copied from the legacy application without redesign.

Pushes to `main` run `.github/workflows/deploy-pages.yml`. Formatting, lint, strict TypeScript,
all tests, the root production build, and production-output verification must pass before `dist/`
is deployed to GitHub Pages. `public/CNAME` publishes the custom domain with the artifact.
