import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getServerConfig } from './config.js';
import { enforceApiSecurity } from './security.js';

const StoredBriefSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  label: z.string(),
  language: z.enum(['English', 'Hindi', 'Marathi']),
  readingLevel: z.enum(['Simple', 'Detailed']),
  overallReliabilityScore: z.number(),
  averageAqi: z.number().nullable(),
  peakAqi: z.number().nullable(),
  reliableRowsCount: z.number(),
  totalRowsCount: z.number(),
  wardBreakdown: z.record(
    z.string(),
    z.object({
      avgAqi: z.number().nullable(),
      category: z.string(),
      reliability: z.number(),
    })
  ),
  hotspotLocations: z.array(z.string()),
  analysis: z.record(z.string(), z.unknown()),
  brief: z.record(z.string(), z.unknown()),
});

type StoredBrief = z.infer<typeof StoredBriefSchema>;

let serverBriefStore: StoredBrief[] = [];

/**
 * Serverless persistence endpoint for syncing historical air quality briefs across devices.
 * Complements browser localStorage so longitudinal brief comparisons persist server-side.
 *
 * @param req - Incoming Vercel serverless request (GET, POST, or DELETE)
 * @param res - Outgoing Vercel serverless response
 */
export default async function recordsHandler(req: VercelRequest, res: VercelResponse) {
  const config = getServerConfig();
  if (!config) {
    return res.status(500).json({
      error: 'Server configuration error: GEMINI_API_KEY is missing in environment variables.',
    });
  }

  const passedSecurity = enforceApiSecurity(req, res, {
    expectedToken: config.apiAccessToken,
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  });
  if (!passedSecurity) return;

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, records: serverBriefStore });
  }

  if (req.method === 'POST') {
    const parsed = StoredBriefSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid brief record payload.',
        details: parsed.error.issues.map((i) => i.message),
      });
    }
    const deduplicated = serverBriefStore.filter((item) => item.id !== parsed.data.id);
    serverBriefStore = [parsed.data, ...deduplicated].slice(0, 20);
    return res.status(200).json({ ok: true, records: serverBriefStore });
  }

  if (req.method === 'DELETE') {
    serverBriefStore = [];
    return res.status(200).json({ ok: true, records: [] });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
