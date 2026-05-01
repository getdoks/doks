// One-line OpenNext config for Cloudflare. Consumers do:
//
//   // open-next.config.ts
//   export { default } from "doks-core/cloudflare/open-next";
//
// That's it. Wires the R2-backed incremental cache, which OpenNext
// requires for SSG pages on Cloudflare. Reads binding name
// `NEXT_INC_CACHE_R2_BUCKET` from your wrangler.jsonc.
//
// Override is one extra line if you need a different cache backend:
//
//   import { defineCloudflareConfig } from "@opennextjs/cloudflare";
//   import myCache from "./my-cache";
//   export default defineCloudflareConfig({ incrementalCache: myCache });

import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
