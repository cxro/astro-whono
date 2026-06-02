import { describe, expect, it } from 'vitest';
import {
  getEditableBitsImageRows,
  parseBitsImageRows,
  serializeBitsImageRows
} from '../src/components/admin/editor/bits-image-rows';

describe('bits image row helpers', () => {
  it('parses editable rows from existing bits images JSON', () => {
    expect(parseBitsImageRows(JSON.stringify([
      {
        src: 'bits/demo.webp',
        width: 800,
        height: '600',
        alt: 'Demo'
      },
      'invalid'
    ]))).toEqual([
      {
        src: 'bits/demo.webp',
        width: '800',
        height: '600',
        alt: 'Demo'
      }
    ]);
  });

  it('keeps one empty editable row when the stored value has no images', () => {
    expect(getEditableBitsImageRows('')).toEqual([
      {
        src: '',
        width: '',
        height: '',
        alt: ''
      }
    ]);
    expect(getEditableBitsImageRows('{not json')).toHaveLength(1);
  });

  it('serializes only meaningful row fields back to imagesText', () => {
    expect(serializeBitsImageRows([
      {
        src: ' bits/demo.webp ',
        width: '800',
        height: '',
        alt: ' Demo '
      },
      {
        src: '',
        width: '',
        height: '',
        alt: ''
      }
    ])).toBe(JSON.stringify([
      {
        src: 'bits/demo.webp',
        width: '800',
        alt: 'Demo'
      }
    ], null, 2));
  });
});
