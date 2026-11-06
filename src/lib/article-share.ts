import type { ArticleSharePlatformId } from './theme-settings';

type ArticleShareLinkId = Exclude<ArticleSharePlatformId, 'poster' | 'copy'>;

type ArticleShareLink = {
  id: ArticleShareLinkId;
  label: string;
  href: string;
};

// 用 encodeURIComponent 而非 URLSearchParams：后者把空格编码成 +，mailto 不会还原。
// poster 和 copy 不是链接，由页面渲染为按钮。
export const getArticleShareLinks = (
  url: string,
  title: string,
  platforms: readonly ArticleSharePlatformId[]
): ArticleShareLink[] => {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const links: Record<ArticleShareLinkId, Omit<ArticleShareLink, 'id'>> = {
    x: {
      label: '分享到 X',
      href: `https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`
    },
    facebook: {
      label: '分享到 Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    },
    weibo: {
      label: '分享到微博',
      href: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedTitle}`
    },
    telegram: {
      label: '分享到 Telegram',
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`
    },
    linkedin: {
      label: '分享到 LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    },
    email: {
      label: '通过邮件分享',
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
    }
  };

  return platforms.flatMap((id) => (id === 'poster' || id === 'copy' ? [] : [{ id, ...links[id] }]));
};
