// Ambient type stubs for the optional peer dep `@opennextjs/cloudflare`.
// Kept minimal — the consumer environment supplies the real types.
//
// Without these stubs, `tsc` fails for contributors who haven't opted into
// the Cloudflare peer (the package is `optional: true` in peerDependenciesMeta).

declare module '@opennextjs/cloudflare' {
  export function defineCloudflareConfig(options: {
    incrementalCache?: unknown;
    [key: string]: unknown;
  }): unknown;
}

declare module '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache' {
  const r2IncrementalCache: unknown;
  export default r2IncrementalCache;
}
