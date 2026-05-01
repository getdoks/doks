// Vector-store configuration. Both the search route and the ingest CLI
// read from here, so switching backends is a one-file edit.
//
// To deploy on Cloudflare Workers, swap the import for the D1 adapter
// AND export a thunk (the D1 binding only exists per-request):
//
//   import { createD1Store } from "doks-core/adapters/d1";
//   import { getCloudflareContext } from "@opennextjs/cloudflare";
//   import type { VectorStore } from "doks-core";
//
//   export const vectorStore = (): VectorStore =>
//     createD1Store(getCloudflareContext().env.DB);
//
// `createSearchHandler` accepts both eager stores and thunks.

import { createSqliteStore } from "doks-core/adapters/sqlite";
import type { VectorStore } from "doks-core";

export const vectorStore: VectorStore = createSqliteStore({
  path: "data/docs.db",
});
