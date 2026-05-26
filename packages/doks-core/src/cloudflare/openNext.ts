// One-line OpenNext config for Cloudflare. Consumers do:
//
//   // open-next.config.ts
//   export { default } from "doks-core/cloudflare/open-next";
//
// That's it. Wires the R2-backed incremental cache, which OpenNext
// requires for SSG pages on Cloudflare. Reads binding name
// `NEXT_INC_CACHE_R2_BUCKET` from your wrangler.jsonc.
//
// If you don't have R2 (it needs a payment method on file), use the
// no-cache sibling instead — same one-liner, no R2 binding required:
//
//   export { default } from "doks-core/cloudflare/open-next/no-cache";
//
// Override is one extra line if you need a different cache backend:
//
//   import { defineCloudflareConfig } from "@opennextjs/cloudflare";
//   import myCache from "./my-cache";
//   export default defineCloudflareConfig({ incrementalCache: myCache });

import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

export type DoksOpenNextCache = 'r2' | 'memory';

export function createOpenNextConfig(
  { cache = 'r2' }: { cache?: DoksOpenNextCache } = {},
) {
  return cache === 'r2'
    ? defineCloudflareConfig({ incrementalCache: r2IncrementalCache })
    : defineCloudflareConfig({});
}

export default createOpenNextConfig({ cache: 'r2' });
