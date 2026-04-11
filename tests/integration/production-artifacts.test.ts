import { describe, expect, it } from 'vitest';
import { runProductionArtifactCheck } from '../../scripts/check-production-artifacts.mjs';

describe('production artifacts', () => {
  it('passes the full production artifact verification suite', async () => {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      console.warn('[integration] SKIP: SITE_URL is not set');
      return;
    }
    await expect(
      runProductionArtifactCheck({ siteUrl })
    ).resolves.not.toThrow();
  });
});
