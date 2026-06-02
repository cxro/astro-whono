import { describe, expect, it } from 'vitest';
import {
  getContentEditorAdapter
} from '../src/components/admin/editor/content-editor-adapters';
import {
  getPayloadEditorBody,
  getPayloadEditorValues
} from '../src/scripts/admin-content/entry-transport';
import type {
  AdminBitsEditorValues
} from '../src/lib/admin-console/content-shared';

describe('content editor adapters', () => {
  it('keeps essay body image tools separate from bits image array tools', () => {
    const essay = getContentEditorAdapter('essay');
    const bits = getContentEditorAdapter('bits');

    expect(essay.capabilities.bodyImageInsert).toBe(true);
    expect(essay.capabilities.bodyImageUpload).toBe(true);
    expect(essay.capabilities.imageUpload).toBe(false);
    expect(essay.capabilities.imagePicker).toBe(false);
    expect(essay.capabilities.imageArray).toBe(false);

    expect(bits.capabilities.body).toBe(true);
    expect(bits.capabilities.preview).toBe(true);
    expect(bits.capabilities.bodyImageInsert).toBe(false);
    expect(bits.capabilities.bodyImageUpload).toBe(false);
    expect(bits.capabilities.bodyGalleryInsert).toBe(false);
    expect(bits.capabilities.imageUpload).toBe(true);
    expect(bits.capabilities.imagePicker).toBe(true);
    expect(bits.capabilities.imageArray).toBe(true);
    expect(bits.isFrontmatterIssuePath('images[0].src')).toBe(true);
    expect(essay.isFrontmatterIssuePath('images[0].src')).toBe(false);
  });

  it('ignores editor payloads for the wrong collection', () => {
    const bitsValues: AdminBitsEditorValues = {
      title: 'Bit',
      description: '',
      date: '2026-05-26T10:00:00+08:00',
      tagsText: '',
      draft: false,
      authorName: '',
      authorAvatar: '',
      imagesText: ''
    };
    const payload = {
      ok: true,
      payload: {
        collection: 'bits',
        entryId: '2026-05-26-bit',
        publicEntryId: '2026-05-26-bit',
        defaultPublicSlug: '2026-05-26-bit',
        revision: 'rev',
        relativePath: 'src/content/bits/2026-05-26-bit.md',
        writable: true,
        readonlyReason: null,
        bodyText: 'Bit body',
        values: bitsValues
      }
    };

    expect(getPayloadEditorValues(payload, 'bits')).toEqual(bitsValues);
    expect(getPayloadEditorValues(payload, 'essay')).toBeNull();
    expect(getPayloadEditorBody(payload, 'bits')).toBe('Bit body');
    expect(getPayloadEditorBody(payload, 'essay')).toBeNull();
  });
});
