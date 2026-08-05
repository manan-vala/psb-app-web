import { neon } from '@neondatabase/serverless';

/**
 * Neon's serverless driver talks to Postgres over HTTP rather than a TCP
 * connection, so it works from Vercel's serverless/edge functions without
 * connection-pool exhaustion — each request is a single fetch, no pool to
 * manage or leak.
 *
 * `sql` is a tagged-template query function: `sql\`SELECT * FROM users WHERE
 * id = ${id}\`` — parameters are sent separately from the query text, so this
 * is parameterized (SQL-injection-safe) the same way a placeholder-based
 * driver would be.
 *
 * Server-only: every file that imports this must stay out of the client
 * bundle. Route Handlers and Server Components are the only valid callers.
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env(.local) and fill in the Neon connection string.'
    );
  }
  return url;
}

export const sql = neon(getDatabaseUrl());
