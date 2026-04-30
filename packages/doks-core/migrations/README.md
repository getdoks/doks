# Migrations

Each file here is a one-shot script that adapts a user project from the
previous `doks-core` version to the version named after the file.

## Shape

```js
// e.g. 0.2.0.js. Runs when upgrading TO 0.2.0
export default async function ({ root }) {
  // root is the absolute path to the user's project (cwd of `doks upgrade`)
}
```

## Policy

- Every breaking change to the public API gets a migration.
- Migrations only edit user-owned files (`apps/site/**` in the template;
  equivalent paths in the consumer's repo). Never edit `node_modules/`.
- File name is the **target** version. `0.2.0.js` runs when upgrading TO 0.2.0.
- Migrations run in semver order.
- **Idempotent.** If applied twice, the second invocation must be a no-op.
  Detect "already applied" by feature-checking the file content (e.g.
  `if (src.includes('analyticsKey')) return;`).
- Print one line per change so users see what was touched.

## Example

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function ({ root }) {
  const path = join(root, 'lib/site.config.ts');
  const src = readFileSync(path, 'utf8');
  if (src.includes('analyticsKey')) return; // already applied
  const updated = src.replace(
    'showUpdatedBadge: ',
    'analyticsKey: undefined,\n  showUpdatedBadge: ',
  );
  writeFileSync(path, updated);
  console.log('  + added analyticsKey to site.config.ts');
}
```
