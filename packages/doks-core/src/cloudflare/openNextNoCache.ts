// In-memory incremental cache for OpenNext on Cloudflare. Use this when
// you don't have R2 enabled (free-tier accounts, dev iteration, etc.).
//
//   // open-next.config.ts
//   export { default } from "doks-core/cloudflare/open-next/no-cache";
//
// Trade-off vs. the R2-backed default: ISR / cache-tag invalidation does
// not persist across worker instances. For docs sites this is usually
// fine — pages are mostly static, and the build emits fresh content
// on every deploy.

import { createOpenNextConfig } from './openNext';

export default createOpenNextConfig({ cache: 'memory' });
