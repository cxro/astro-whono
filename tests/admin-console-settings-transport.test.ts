import { describe, expect, it } from 'vitest';
import { getPayloadIssues } from '../src/scripts/admin-console/settings-transport';

describe('admin-console/settings-transport getPayloadIssues', () => {
  it('returns the path and message of each server issue', () => {
    const issue = { path: 'home.heroImageSrc', message: 'Hero 图片指向的本地文件不存在：src/assets/x.png' };

    expect(getPayloadIssues({ ok: false, errors: [issue.message], issues: [issue] })).toEqual([issue]);
  });

  it('skips malformed entries', () => {
    const issue = { path: 'site.title', message: '站点标题不能为空' };

    expect(getPayloadIssues({ issues: [issue, null, 'text', { path: 'site.title' }, { message: 'x' }] })).toEqual([issue]);
  });

  it('returns nothing when the payload has no issue list', () => {
    expect(getPayloadIssues({ ok: false, errors: ['x'] })).toEqual([]);
    expect(getPayloadIssues({ issues: 'x' })).toEqual([]);
    expect(getPayloadIssues(null)).toEqual([]);
  });
});
