#!/usr/bin/env node
//
// d1-bootstrap: emit the schema the D1 adapter expects.
//
// Pipe into wrangler:
//
//   npx doks-d1-bootstrap | npx wrangler d1 execute <db> --remote --command -
//
// Or write to a file and run it manually:
//
//   npx doks-d1-bootstrap > schema.sql
//   npx wrangler d1 execute <db> --remote --file=./schema.sql
//
// The schema matches what `createD1Store(db).reset()` would produce, so
// you can use either approach. Bootstrap is offered for the case where
// the adapter isn't reachable (e.g. you're scripting from CI).

const SCHEMA = `DROP TABLE IF EXISTS chunks;
CREATE TABLE chunks (
  chunk_id   TEXT PRIMARY KEY,
  page_href  TEXT NOT NULL,
  page_title TEXT NOT NULL,
  heading    TEXT NOT NULL,
  category   TEXT,
  importance REAL NOT NULL,
  tags       TEXT NOT NULL,
  text       TEXT NOT NULL,
  embedding  BLOB NOT NULL
);
`;

process.stdout.write(SCHEMA);
