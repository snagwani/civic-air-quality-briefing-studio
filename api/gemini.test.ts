import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import handler, {
  extractCleanJson,
  isTransientUpstreamError,
  keepValidCitations,
  normalizeRawGeminiJson,
} from './gemini';
import {
  checkSlidingWindowRateLimit,
  isCrossSiteRequest,
  resetRateLimitBuckets,
  verifyRequestAuthToken,
} from './security';
import { ServerResponseCache, hashRequestKey } from './serverCache';

const row = {
  rowId: 'R01',
  rawStation: 'Test Station',
  ward: 'Ward A',
  normalizedTimestamp: '2026-11-14T08:00',
  pm25UgM3: 120,
  pm10UgM3: 200,
  no2UgM3: 40,
  so2UgM3: 10,
  aqi: 301,
  aqiCategory: 'Very Poor',
  dominantPollutant: 'PM2.5',
  isReliable: true,
  issues: [],
};

const analyzeBody = (reliability = 90) => ({
  mode: 'analyze',
  overallReliabilityScore: reliability,
  hasEnoughReliableData: true,
  rows: [row],
});

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as typeof res & VercelResponse;
}

function mockReq(body: unknown, headers: Record<string, string> = {}): VercelRequest {
  return {
    method: 'POST',
    body,
    headers: {
      authorization: 'Bearer civic-trust-verified-session-v1',
      'x-forwarded-for': '9.9.9.9',
      ...headers,
    },
  } as unknown as VercelRequest;
}

const validAnalysis = {
  overallAssessment: 'Very poor air at Ward A.',
  insufficientDataNotice: null,
  trends: [
    { id: 'T1', title: 'Rise', summary: 'PM2.5 up', citedRowIds: ['R01'], confidence: 'High', dataCaveat: null },
  ],
  hotspots: [
    { id: 'H1', location: 'Ward A', severity: 'Critical', likelyCause: 'Traffic', explanation: 'High PM2.5', citedRowIds: ['R01'], confidence: 'High' },
  ],
  actions: [
    { id: 'A1', audience: 'Ward Officer', priority: 'Immediate (0-6 hrs)', action: 'Sprinkle water', rationale: 'Dust', citedRowIds: ['R01'], confidence: 'High' },
  ],
};

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  resetRateLimitBuckets();
  generateContent.mockReset();
});

describe('Gemini response normalization (api/gemini.ts)', () => {
  it('extracts JSON from markdown fences', () => {
    expect(extractCleanJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractCleanJson('{"b":2}')).toEqual({ b: 2 });
  });

  it('canonicalizes enum spellings and nulls without inventing content', () => {
    const out = normalizeRawGeminiJson(
      {
        trends: [{ title: 't', summary: 's', citedRowIds: ['R01'], confidence: 'high', dataCaveat: null }],
        hotspots: [],
        actions: [{ action: 'a', rationale: 'r', citedRowIds: ['R01'], audience: 'school principal', priority: 'immediate', confidence: 'MEDIUM' }],
      },
      { mode: 'analyze' }
    ) as { trends: Array<Record<string, unknown>>; actions: Array<Record<string, unknown>> };
    expect(out.trends[0].confidence).toBe('High');
    expect(out.trends[0].dataCaveat).toBeUndefined();
    expect(out.actions[0].audience).toBe('School Principal');
    expect(out.actions[0].priority).toBe('Immediate (0-6 hrs)');
  });

  it('never fabricates missing brief fields (validation must fail instead)', () => {
    const out = normalizeRawGeminiJson({ internalBriefingNote: {} }, { mode: 'brief', language: 'Hindi', readingLevel: 'Simple' }) as Record<string, unknown>;
    expect(out.internalBriefingNote).toEqual({});
    expect(out.language).toBe('Hindi');
  });

  it('drops invalid citations and rejects findings with none', () => {
    const valid = new Set(['R01', 'R02']);
    expect(keepValidCitations(['R01', 'R99'], valid, true)).toEqual(['R01']);
    expect(() => keepValidCitations(['R99'], valid, true)).toThrow();
    expect(keepValidCitations(['R99'], valid, false)).toEqual([]);
  });

  it('detects transient upstream overload errors', () => {
    expect(isTransientUpstreamError(new Error('{"error":{"code":503}}'))).toBe(true);
    expect(isTransientUpstreamError('RESOURCE_EXHAUSTED')).toBe(true);
    expect(isTransientUpstreamError(new Error('schema failed'))).toBe(false);
  });
});

describe('Security helpers (api/security.ts)', () => {
  it('verifies Bearer tokens and blocks cross-site browser requests', () => {
    const ok = mockReq({}, {});
    expect(verifyRequestAuthToken(ok, 'civic-trust-verified-session-v1')).toBe(true);
    expect(verifyRequestAuthToken(mockReq({}, { authorization: 'Bearer wrong' }), 'civic-trust-verified-session-v1')).toBe(false);
    expect(isCrossSiteRequest(mockReq({}, { 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(isCrossSiteRequest(mockReq({}, { 'sec-fetch-site': 'same-origin' }))).toBe(false);
  });

  it('resets the sliding window after it elapses', () => {
    checkSlidingWindowRateLimit('1.1.1.1', 1000, 1, 0);
    expect(checkSlidingWindowRateLimit('1.1.1.1', 1000, 1, 500).allowed).toBe(false);
    expect(checkSlidingWindowRateLimit('1.1.1.1', 1000, 1, 1500).allowed).toBe(true);
  });
});

describe('Server response cache (api/serverCache.ts)', () => {
  it('evicts least-recently-used entries and expires by TTL', () => {
    const cache = new ServerResponseCache<number>(2, 1000);
    cache.set('a', 1, 0);
    cache.set('b', 2, 0);
    cache.get('a', 10);
    cache.set('c', 3, 20);
    expect(cache.get('b', 30)).toBeUndefined();
    expect(cache.get('a', 30)).toBe(1);
    expect(cache.get('a', 5000)).toBeUndefined();
    expect(hashRequestKey('x')).toHaveLength(64);
  });
});

describe('/api/gemini handler', () => {
  it('rejects missing auth with 401 and cross-site requests with 403', async () => {
    const res401 = mockRes();
    await handler(mockReq(analyzeBody(), { authorization: '' }), res401);
    expect(res401.statusCode).toBe(401);

    const res403 = mockRes();
    await handler(mockReq(analyzeBody(), { 'sec-fetch-site': 'cross-site' }), res403);
    expect(res403.statusCode).toBe(403);
  });

  it('rejects invalid payloads with 400 and oversized strings', async () => {
    const res = mockRes();
    await handler(mockReq({ mode: 'analyze' }), res);
    expect(res.statusCode).toBe(400);

    const big = mockRes();
    await handler(mockReq({ ...analyzeBody(), rows: [{ ...row, rawStation: 'x'.repeat(500) }] }), big);
    expect(big.statusCode).toBe(400);
  });

  it('returns Zod-validated analysis and serves identical repeats from the cache', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(validAnalysis) });
    const res1 = mockRes();
    await handler(mockReq(analyzeBody(71)), res1);
    expect(res1.statusCode).toBe(200);
    expect((res1.body as { ok: boolean }).ok).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(1);

    const res2 = mockRes();
    await handler(mockReq(analyzeBody(71)), res2);
    expect((res2.body as { cached?: boolean }).cached).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries once on schema failure and then returns a validated response', async () => {
    generateContent
      .mockResolvedValueOnce({ text: '{"overallAssessment": 5}' })
      .mockResolvedValueOnce({ text: JSON.stringify(validAnalysis) });
    const res = mockRes();
    await handler(mockReq(analyzeBody(72)), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { attempt: number }).attempt).toBe(2);
  });

  it('returns an honest 502 when Gemini output never validates', async () => {
    generateContent.mockResolvedValue({ text: '{"overallAssessment": 5}' });
    const res = mockRes();
    await handler(mockReq(analyzeBody(73)), res);
    expect(res.statusCode).toBe(502);
  });
});
