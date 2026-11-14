import { z } from 'zod';

const ClientConfigSchema = z.object({
  apiEndpoint: z.string().default('/api/gemini'),
  recordsEndpoint: z.string().default('/api/records'),
  sessionToken: z.string().default('civic-trust-verified-session-v1'),
  requestTimeoutMs: z.number().default(45_000),
  maxInputBytes: z.number().default(512 * 1024),
  maxRows: z.number().default(500),
  lruCacheMaxEntries: z.number().default(30),
  lruCacheTtlMs: z.number().default(10 * 60 * 1000),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;

/**
 * Returns validated client-side runtime configuration settings.
 *
 * @returns Validated ClientConfig object
 */
export function getClientConfig(): ClientConfig {
  return ClientConfigSchema.parse({});
}
