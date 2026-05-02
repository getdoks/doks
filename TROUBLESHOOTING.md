# Troubleshooting

Symptoms you might hit while developing, building, or publishing doks, with
the fix for each. Organised by the error message you'll actually see in
your terminal so you can grep this file.

If your problem isn't listed:

- For consumer deploy issues (Vercel, Cloudflare D1, ingest, search panel),
  see [`apps/site/content/docs/guides/deployment.mdx`](./apps/site/content/docs/guides/deployment.mdx).
- File an issue at https://github.com/getdoks/doks/issues with the full
  command and stack trace.

---

## `NODE_MODULE_VERSION` mismatch on `better-sqlite3`

**Symptom**

```
Error: The module '.../node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 137. This version of Node.js requires
NODE_MODULE_VERSION 108.
ERR_DLOPEN_FAILED
```

**Cause**

`better-sqlite3` ships a native `.node` binary compiled for one Node
ABI. You switched Node versions (often via `nvm`) since the last `npm
install`, so the prebuilt binary no longer matches your active runtime.

ABI → Node version mapping:

| `NODE_MODULE_VERSION` | Node major |
|---|---|
| 108 | 18 |
| 115 | 20 |
| 127 | 22 |
| 131 | 23 |
| 137 | 24 |

Note: doks-core declares `"engines": { "node": ">=20" }`. If you're on
Node 18, you're below the supported range — fix that first.

**Fix**

```bash
# 1. Get on a supported Node
nvm use 20            # or 22 / 24
node -v               # confirm v20+

# 2. Recompile the native module for the active runtime
npm rebuild better-sqlite3

# Or rebuild it inside a specific workspace package:
npm rebuild better-sqlite3 -w doks-core
```

If `nvm use 20` errors with "not installed":

```bash
nvm install 20 && nvm use 20
```

Pin the Node version so the project doesn't drift again:

```bash
echo "20" > .nvmrc            # `nvm use` reads this on cd
npm pkg set engines.node=">=20"
```

If a single `npm rebuild` doesn't take, do a full reinstall:

```bash
rm -rf node_modules package-lock.json && npm install
```

---

## `npm publish` returns 404

**Symptom**

```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/doks-core - Not found
npm error 404  'doks-core@0.3.0' is not in this registry.
```

**Cause**

npm returns **404 instead of 401 when you're not authenticated** — they
do this so the registry doesn't leak which packages exist. The error
message is misleading: it's an auth problem, not a "package missing"
problem. Auth tokens expire (commonly after 24h–14d), so a successful
publish yesterday doesn't mean your shell is still logged in today.

**Fix**

```bash
# 1. Confirm
npm whoami
# Errors with ENEEDAUTH or 401 → not logged in

# 2. Re-authenticate
npm login                              # opens browser; complete login + 2FA
# Or, when the browser flow fails:
npm login --auth-type=legacy           # username + password + OTP at terminal

# 3. Verify
npm whoami                             # should print your npm username

# 4. Retry the publish (will prompt for OTP)
npm publish -w doks-core --access public
```

While you're at it, make sure you're hitting the public registry:

```bash
npm config get registry
# Must be: https://registry.npmjs.org/
# If it's a private registry / proxy, reset:
npm config set registry https://registry.npmjs.org/
```

---

## `'getVectorStore' is not exported from '@/lib/doks.config'`

**Symptom**

```
./app/api/docs/search/route.ts
Type error: '"@/lib/doks.config"' has no exported member named 'getVectorStore'.
Did you mean 'vectorStore'?
  1 | import { createSearchHandler } from "doks-core";
> 2 | import { getVectorStore } from "@/lib/doks.config";
    |          ^
```

**Cause**

`app/api/docs/search/route.ts` imports `getVectorStore`, but
`lib/doks.config.ts` exports `vectorStore`. Mismatched names — usually
because the route was hand-edited (or copied from an old guide) while
the config still uses the canonical shape.

doks-core never asks for `getVectorStore`. The factory takes the
`vectorStore` export directly — and accepts both eager stores (SQLite
default) *and* thunks (`() => VectorStore` for D1, where the binding is
per-request).

**Fix**

Restore the canonical route:

```ts
// app/api/docs/search/route.ts
import { createSearchHandler } from "doks-core";
import { vectorStore } from "@/lib/doks.config";

export const runtime = "nodejs";       // drop this for D1 / edge
export const dynamic = "force-dynamic";

export const { POST, GET } = createSearchHandler(vectorStore);
```

For D1 deployments, drop `export const runtime = "nodejs"` and make sure
`lib/doks.config.ts` exports a thunk (run `npx doks deploy:cloudflare`
to wire it).

**Caveat for SQLite on Cloudflare**

If the project deploys to Cloudflare Workers but `lib/doks.config.ts`
uses `createSqliteStore`, `next build` succeeds and doc pages render
(via the bundled-content runtime), but **`/api/docs/search` crashes at
request time** because `better-sqlite3` is a native Node binding that
V8 isolates can't load. Either:

1. Accept the limitation if you don't need search on the worker.
2. Switch to D1 with `npx doks deploy:cloudflare`.

## `lib/doks.config.ts` exists but does not export `vectorStore`

**Symptom**

```
doks: a `lib/doks.config.{ts,js,mjs}` file exists but does not
export a usable `vectorStore`.
Tried:
  - lib/doks.config.ts
Last error: no `vectorStore` export
```

**Cause**

The ingest CLI looks for `export const vectorStore = ...`. Your config
exports something else (default export, different name, or pre-0.2.0
shape from before the adapter split).

**Fix — replace with the canonical SQLite shape**

```bash
cat > lib/doks.config.ts <<'EOF'
import { createSqliteStore } from "doks-core/adapters/sqlite";
import type { VectorStore } from "doks-core";

export const vectorStore: VectorStore = createSqliteStore({
  path: "data/docs.db",
});
EOF
```

Common variants that trip the check:

| Your file says | Why it fails | Fix |
|---|---|---|
| `export default createSqliteStore(...)` | CLI reads `vectorStore` named export | Switch to `export const vectorStore = ...` |
| `export const store = ...` | Wrong name | Rename to `vectorStore` |
| `getCloudflareContext()` D1 thunk | Worker-only API; ingest runs under Node | Add `lib/doks.config.ingest.ts` with `createD1HttpStore`, run `DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest` |

If your ingest config is correct but the file you want loaded is at a
non-default path, point the CLI at it:

```bash
DOKS_CONFIG=lib/some-other.config.ts npm run ingest
```

---

## `npm run ingest` errors with "no config" (pre-0.3.0)

**Symptom**

```
doks: ingest could not load a `vectorStore` from your project.
Expected one of:
  - lib/doks.config.ts
  - lib/doks.config.js
  - lib/doks.config.mjs
```

…and ingest exits with code 1, breaking your build.

**Cause**

You're on a doks-core version older than 0.3.0. The pre-0.3.0 ingest
CLI fails hard when `lib/doks.config.ts` doesn't exist.

**Fix**

Bump doks-core. 0.3.0 exits 0 with a friendly message in this case so
your build pipeline doesn't break:

```bash
npx doks upgrade
```

`upgrade` runs migration `0.2.0.js` (writes `lib/doks.config.ts` with
the SQLite default) and `0.3.0.js` (wires the bundled-content runtime).
Or write the config by hand using the canonical shape from the previous
section.

---

## `bun install --frozen-lockfile` fails on Cloudflare / CI

**Symptom**

```
bun install --frozen-lockfile
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile and commit the updated lockfile
```

**Cause**

You bumped a dependency in `package.json` (e.g., `doks-core` 0.2.x → 0.3.0)
but didn't regenerate `bun.lock` (or `bun.lockb`). `--frozen-lockfile` is
strict: any drift between `package.json` and the lockfile aborts the
install. CI environments use `--frozen-lockfile` by default to keep
reproducible builds.

**Fix — option A (recommended): regenerate the lockfile and commit**

```bash
bun install                      # updates bun.lock to match package.json
git add bun.lock                 # or bun.lockb (older bun versions)
git commit -m "Update bun lockfile"
git push
```

**Fix — option B: switch the project to npm**

```bash
rm -f bun.lock bun.lockb
npm install                      # creates package-lock.json
git rm --cached bun.lock bun.lockb 2>/dev/null
echo "bun.lock"  >> .gitignore
echo "bun.lockb" >> .gitignore
git add .gitignore package-lock.json
git commit -m "Switch to npm lockfile"
```

Then in your host's build settings, override the install / build command
to `npm ci && npm run build` so it doesn't auto-pick bun.

Don't commit *both* lockfiles — they'll drift, and CI will install with
whichever one the platform happens to find first.

## Package manager support (npm / bun / pnpm / yarn)

The `doks` CLI auto-detects which package manager invoked it (via the
`npm_config_user_agent` env var) and adapts:

- `doks ensure-index` runs `<pm> run ingest`.
- `doks upgrade` runs `<pm> add doks-core@<latest>` (or `npm install` etc.).
- `doks deploy:cloudflare` runs `<pm> add -D <peer-deps>` for the
  Cloudflare optional peers.

`create-doks` accepts `--pm <npm|bun|pnpm|yarn>` to force a specific
package manager during scaffolding. Auto-detected from how you ran the
CLI:

```bash
npx create-doks my-docs           # uses npm install
bunx create-doks my-docs          # uses bun install
pnpm dlx create-doks my-docs      # uses pnpm install
```

Override explicitly if needed:

```bash
npx create-doks my-docs --pm bun  # scaffold with npm but install via bun
```

`npx <command>` invocations in the docs (e.g. `npx doks deploy:cloudflare`,
`npx wrangler login`) work universally — `npx` ships with npm, which
ships with Node, so it's available even in bun-only / pnpm-only setups.
Bun users who prefer `bunx` can substitute it freely; both resolve the
same `node_modules/.bin/` entries.

## `cd: no such file or directory: packages/doks-core`

**Symptom**

```
cd packages/doks-core && rm -rf dist && npm run build && ...
cd: no such file or directory: packages/doks-core
```

**Cause**

You're already inside `packages/doks-core/`. The command tries to
descend into `packages/doks-core/packages/doks-core`, which doesn't
exist.

**Fix — go to the workspace root once, then run**

```bash
cd /Users/<you>/PycharmProjects/doks       # workspace root
cd packages/doks-core && ...                # now relative paths resolve
```

Or use npm workspaces flags from anywhere in the repo (preferred):

```bash
npm run build -w doks-core
npm run typecheck -w doks-core
npm test -w doks-core
npm test -w create-doks
```

---

## `next dev` 500s on `/api/docs/search` for D1 setups

**Symptom**

```
Error: getCloudflareContext is not defined
```

…or the search endpoint 500s every time, locally only.

**Cause**

`getCloudflareContext()` reads from a Worker context that doesn't exist
under `next dev`. Without OpenNext's dev hook the binding is undefined
and the route crashes.

**Fix**

Add `initOpenNextCloudflareForDev()` to the top of `next.config.mjs`:

```js
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = { /* ... */ };
export default nextConfig;
```

Or run `npx doks deploy:cloudflare`, which uncomments the scaffold's
ready-made block automatically.

---

## `npm run ingest` errors with `getCloudflareContext is not defined`

**Symptom**

```
ReferenceError: getCloudflareContext is not defined
    at vectorStore (lib/doks.config.ts:...)
```

**Cause**

Your runtime `lib/doks.config.ts` calls `getCloudflareContext()`
(Worker-only). The ingest CLI runs under Node, so the call throws.

**Fix**

Add a Node-friendly ingest config that talks to D1 over HTTP:

```ts
// lib/doks.config.ingest.ts
import { createD1HttpStore } from "doks-core/adapters/d1/http";
import type { VectorStore } from "doks-core";

export const vectorStore: VectorStore = createD1HttpStore({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
});
```

Then point ingest at it:

```bash
CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_DATABASE_ID=... \
CLOUDFLARE_API_TOKEN=... \
DOKS_CONFIG=lib/doks.config.ingest.ts \
npm run ingest
```

Create the API token at
[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
with **Account → D1 → Edit** permission.

---

## Cloudflare: `Service binding 'WORKER_SELF_REFERENCE' references Worker '...' which was not found`

**Symptom**

OpenNext deploy fails to attach because the worker name in the binding
doesn't match the deployed worker.

**Cause**

`wrangler.jsonc` wasn't committed, so OpenNext's `migrate` step
auto-generated a fresh one with mismatched names on every build.

**Fix**

Commit a `wrangler.jsonc` with consistent `name` and
`services[*].service` fields. The fastest way to get a correct one:

```bash
npx doks setup-cloudflare              # prints the snippet
# OR
npx doks deploy:cloudflare              # writes wrangler.jsonc for you
```

Then commit it. OpenNext won't regenerate as long as the file exists.

---

## Doc pages render locally but 404 on Cloudflare (or any edge runtime)

**Symptom**

`next dev` and `next build` on your laptop both render the docs fine.
The exact same code deployed to Cloudflare Workers serves a 404 for
every doc page. Worker logs may show empty results, no errors thrown.

**Cause**

`lib/doks-content.gen.ts` exists and is populated, but **nothing
imports it at runtime**, so `setContentMap()` is never called and the
bundled-content cache stays empty. On Node hosts that's invisible
because the data layer falls back to `fs.readFileSync(content/docs/...)`,
which works locally. On Cloudflare Workers there is no filesystem, so
the fallback returns `null` and `DocPage` calls `notFound()`.

This usually happens when someone bumps `doks-core` to 0.3+ via
`npm install doks-core@latest` (or the bun / pnpm equivalent) instead
of `npx doks upgrade`. The plain install bumps the version but doesn't
run migration `0.3.0.js`, which is what wires the layout import and
the `withDoks` wrapper.

**Fix — option A (idempotent, recommended)**

```bash
npx doks upgrade
```

The migration adds:

1. `import "@/lib/doks-content.gen";` to `app/layout.tsx` (the
   side-effect import that calls `setContentMap` at request time).
2. `withDoks(nextConfig)` wrapper in `next.config.mjs` (regenerates
   the gen file on every build).
3. `predev` / `prebuild` script entries.

It's idempotent — already-applied steps are skipped.

**Fix — option B (manual, if you want to do exactly two edits)**

Add the runtime registration to your root layout:

```tsx
// app/layout.tsx
import "./globals.css";
import "@/lib/doks-content.gen";          // ← add this line
// …rest unchanged
```

And the build-time generator hook to your Next config:

```js
// next.config.mjs
import { withDoks } from "doks-core/next";

const nextConfig = { /* … */ };
export default withDoks(nextConfig);      // ← wrap the export
```

**You need BOTH.** They're not interchangeable:

- The layout import is what registers content with the runtime cache.
  Without it, the cache stays empty and edge runtimes 404.
- `withDoks` is what regenerates the gen file as you edit MDX.
  Without it, the gen file goes stale (or is missing entirely on a
  fresh CI checkout where `lib/doks-content.gen.ts` is gitignored).

## Pages render but search returns empty `{ results: [] }`

**Symptom**

The site loads, doc pages render, but the search panel shows nothing.

**Cause**

`data/docs.db` doesn't exist at runtime (SQLite adapter), or D1 was
never ingested (D1 adapter). The bundled-content runtime in 0.3.0
renders pages without a vector index, so the site looks fine until
someone searches.

**Fix**

```bash
# SQLite (local / Vercel / Node hosts)
npm run ingest

# D1 (Cloudflare)
DOKS_CONFIG=lib/doks.config.ingest.ts npm run ingest
```

For deploy pipelines, add `npm run ingest && ` to your build command,
or commit `data/docs.db` to git (less common; bloats history on
binary-diff churn).

---

## SSG pages 500 in production on Cloudflare with cache-related errors

**Symptom**

Static-rendered pages (the doc tree) 500 in production. Logs mention
incremental cache or `KV`/`R2` not found.

**Cause**

OpenNext's incremental cache binding is missing. Without it,
SSG-pre-rendered pages 500 on cache miss.

**Fix**

Provision the R2 bucket and add the binding:

```bash
npx doks setup-cloudflare --skip-d1     # provision R2 only
```

Or merge this into your `wrangler.jsonc`:

```jsonc
{
  "r2_buckets": [
    {
      "binding": "NEXT_INC_CACHE_R2_BUCKET",
      "bucket_name": "<your-cache-bucket>"
    }
  ]
}
```

The doks-core OpenNext config (`doks-core/cloudflare/open-next`) reads
the binding name `NEXT_INC_CACHE_R2_BUCKET`.

---

## `Cannot find module './lib/chunks'` (pre-0.1.2)

**Symptom**

Published doks-core errors at runtime trying to resolve relative imports
without `.js` extensions.

**Cause**

The 0.1.0 / 0.1.1 tarballs shipped without the postbuild step that
rewrites extension-less relative imports. Node's strict ESM resolver
doesn't auto-resolve `./foo` to `./foo.js`.

**Fix**

Bump:

```bash
npm install doks-core@latest
```

Anything from 0.1.2 onward includes the fix.

---

## `Export GET doesn't exist in target module`

**Symptom**

`next build` fails on `app/api/docs/search/route.ts` with the export
mismatch above.

**Cause**

Your project still has the pre-0.2.0 route shape:

```ts
export { POST, GET } from "doks-core/api/search";
```

…but doks-core 0.2+ ships the search handler as a factory.

**Fix — run the migration**

```bash
npx doks upgrade
```

Migration `0.2.0.js` rewrites the route to the factory form:

```ts
import { createSearchHandler } from "doks-core";
import { vectorStore } from "@/lib/doks.config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { POST, GET } = createSearchHandler(vectorStore);
```
