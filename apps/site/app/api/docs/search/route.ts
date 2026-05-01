// Search route. Wires the framework's createSearchHandler factory to
// whichever store this project configured in `lib/doks.config.ts`. To
// switch backends, edit that one file.

import { createSearchHandler } from "doks-core";
import { vectorStore } from "@/lib/doks.config";

// SQLite needs the Node runtime. A D1 / edge-compatible store would
// drop or override this line.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { POST, GET } = createSearchHandler(vectorStore);
