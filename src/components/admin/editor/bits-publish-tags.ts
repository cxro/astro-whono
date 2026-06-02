const LOCATION_TAG_PREFIX = 'loc:';

export type BitsPublishTagsParts = {
  locationText: string;
  inlineTagsText: string;
};

const splitTagsText = (text: string): string[] =>
  text
    .split(/\r\n|\r|\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const isLocationTag = (tag: string): boolean =>
  tag.toLowerCase().startsWith(LOCATION_TAG_PREFIX);

const normalizeTagText = (tag: string): string => tag.trim().replace(/^#+/, '');

export const normalizeBitsLocationInput = (text: string): string =>
  text.trim().replace(/^loc:/i, '').trim();

export const toInlineBitsTags = (tags: readonly string[]): string =>
  tags
    .map(normalizeTagText)
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(' ');

export const fromInlineBitsTags = (text: string): string[] =>
  text
    .split(/[\s,，]+/)
    .map(normalizeTagText)
    .filter((tag) => Boolean(tag) && !isLocationTag(tag));

export const splitBitsPublishTagsText = (text: string): BitsPublishTagsParts => {
  const tags = splitTagsText(text);
  const locationTag = tags.find(isLocationTag) ?? '';
  const normalTags = tags.filter((tag) => !isLocationTag(tag));

  return {
    locationText: locationTag ? normalizeBitsLocationInput(locationTag.slice(LOCATION_TAG_PREFIX.length)) : '',
    inlineTagsText: toInlineBitsTags(normalTags)
  };
};

export const mergeBitsPublishTagsText = (locationText: string, inlineTagsText: string): string => {
  const location = normalizeBitsLocationInput(locationText);
  const tags = fromInlineBitsTags(inlineTagsText);
  return [
    ...(location ? [`${LOCATION_TAG_PREFIX}${location}`] : []),
    ...tags
  ].join('\n');
};
