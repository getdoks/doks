# create-doks

Scaffold a new [doks](https://github.com/getdoks/doks) documentation site.

```bash
npx create-doks my-docs
```

You'll be prompted for site name, GitHub URL, and theme. The CLI clones the
`apps/site` template, rewrites `lib/site.config.ts` with your answers, and
runs `npm install`.

## Options

| Flag | Description |
| --- | --- |
| `--template <spec>` | Use a different degit spec (default `getdoks/doks/apps/site`) |
| `--template-path <dir>` | Copy from a local directory instead of degit (used in CI/dev) |
| `--no-install` | Skip `npm install` after scaffolding |
| `-y, --yes` | Accept defaults for all prompts |
| `-h, --help` | Show help |

## After scaffolding

```bash
cd my-docs
npm run ingest   # build the embedding index
npm run dev      # start at http://localhost:3000
```

License: MIT.
