/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile the workspace package so it's compiled at dev time.
  transpilePackages: ['doks-core'],

  // better-sqlite3 + sqlite-vec ship native bindings; never bundle them.
  serverExternalPackages: ['better-sqlite3', 'sqlite-vec'],
};

export default nextConfig;
