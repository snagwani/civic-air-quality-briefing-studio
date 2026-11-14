import { z } from 'zod';

const ServerEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  API_ACCESS_TOKEN: z.string().default('civic-trust-verified-session-v1'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(25),
});

export interface ServerConfig {
  geminiApiKey: string;
  apiAccessToken: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  candidateModels: readonly string[];
}

/**
 * Loads and validates server-side configuration from environment variables using Zod.
 * Centralizes configuration access so handlers never read process.env directly.
 *
 * @param env - Environment dictionary (defaults to process.env)
 * @returns Validated ServerConfig object or null if GEMINI_API_KEY is missing
 */
export function getServerConfig(
  env: Record<string, string | undefined> = process.env
): ServerConfig | null {
  const parsed = ServerEnvSchema.safeParse(env);
  if (!parsed.success) {
    return null;
  }
  return {
    geminiApiKey: parsed.data.GEMINI_API_KEY,
    apiAccessToken: parsed.data.API_ACCESS_TOKEN,
    rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: parsed.data.RATE_LIMIT_MAX_REQUESTS,
    candidateModels: ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'] as const,
  };
}
