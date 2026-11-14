import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from './App';
import { BoundedLruCache } from './lib/lruCache';
import { checkSlidingWindowRateLimit, resetRateLimitBuckets } from '../api/security';

describe('React Component Integration Tests (App.test.tsx)', () => {
  beforeEach(() => {
    resetRateLimitBuckets();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, records: [] }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the Civic Air Quality Briefing Studio header and intake controls', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /Civic Air Quality Briefing Studio/i })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Parse, Normalize & Audit Data Quality/i })
    ).toBeTruthy();
  });

  it('shows an accessible validation error alert when parsing empty input', () => {
    render(<App />);
    const parseBtn = screen.getByRole('button', {
      name: /Parse, Normalize & Audit Data Quality/i,
    });
    fireEvent.click(parseBtn);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Input is empty');
  });

  it('loads the test input CSV, normalizes messy rows, and renders the Quality Report ledger', () => {
    render(<App />);
    const loadSampleBtn = screen.getByRole('button', {
      name: /Load Test Input CSV/i,
    });
    fireEvent.click(loadSampleBtn);

    const parseBtn = screen.getByRole('button', {
      name: /Parse, Normalize & Audit Data Quality/i,
    });
    fireEvent.click(parseBtn);

    expect(
      screen.getByRole('heading', { name: /Data Quality & Normalization Report/i })
    ).toBeTruthy();
    expect(screen.getAllByText('R01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('R11').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Run Live Gemini Analysis/i })).toBeTruthy();
  });

  it('verifies BoundedLruCache eviction and TTL expiration', () => {
    const cache = new BoundedLruCache<number>(2, 1000);
    cache.set('a', 1, 100);
    cache.set('b', 2, 200);
    cache.set('c', 3, 300); // evicts 'a'
    expect(cache.get('a', 400)).toBeUndefined();
    expect(cache.get('b', 400)).toBe(2);
    expect(cache.get('b', 1500)).toBeUndefined(); // expired past TTL
  });

  it('verifies sliding-window IP rate limiter blocks excess requests', () => {
    const r1 = checkSlidingWindowRateLimit('10.0.0.1', 60_000, 2, 1000);
    const r2 = checkSlidingWindowRateLimit('10.0.0.1', 60_000, 2, 2000);
    const r3 = checkSlidingWindowRateLimit('10.0.0.1', 60_000, 2, 3000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterSeconds).toBeGreaterThan(0);
  });
});
