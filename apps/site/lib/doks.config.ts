// Vector-store configuration for this project. Both the search route
// (`app/api/docs/search/route.ts`) and the ingest CLI read from here, so
// switching backends is a one-file edit.
//
// To deploy on Cloudflare Pages, swap the SQLite import for the D1
// adapter:
//
//   import { createD1Store } from "doks-core/adapters/d1";
//   export const vectorStore = createD1Store(globalThis.env.DB);
//
// To use Postgres, Turso, or any other backend, write or import an
// adapter that implements the `VectorStore` interface from `doks-core`.

import { createSqliteStore } from "doks-core/adapters/sqlite";
import type { VectorStore } from "doks-core";

export const vectorStore: VectorStore = createSqliteStore({
  path: "data/docs.db",
});
