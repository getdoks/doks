// Cloudflare-only: this config is read by `opennextjs-cloudflare build`.
// SQLite consumers can ignore the file; it has no effect on `next build`,
// `next dev`, or any non-Cloudflare host.
//
// `doks-core/cloudflare/open-next` ships a default config that wires the
// R2-backed incremental cache (binding `NEXT_INC_CACHE_R2_BUCKET`).
// Provision the R2 bucket + binding with `npx doks setup-cloudflare`.

export { default } from 'doks-core/cloudflare/open-next';
