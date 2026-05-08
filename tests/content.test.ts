import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('astro:content', () => ({
  getCollection: vi.fn()
}));

import { getCollection } from 'astro:content';
import { getPublished } from '../src/lib/content';

const getCollectionMock = vi.mocked(getCollection);

describe('content queries', () => {
  let tempRoot = '';

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'astro-whono-content-query-'));
    getCollectionMock.mockReset();
  });

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('omits dev content-store entries whose source file has already been deleted', async () => {
    const existingPath = path.join(tempRoot, 'existing.md');
    await writeFile(existingPath, '---\ntitle: Existing\n---\n', 'utf8');

    getCollectionMock.mockResolvedValue([
      {
        id: 'existing',
        filePath: existingPath,
        data: { draft: false }
      },
      {
        id: 'deleted',
        filePath: path.join(tempRoot, 'deleted.md'),
        data: { draft: false }
      }
    ] as never);

    const entries = await getPublished('essay', { includeDraft: true });

    expect(entries.map((entry) => entry.id)).toEqual(['existing']);
  });
});
