<script lang="ts">
import type { BitsCardViewModel } from '../../../lib/bits-card-view-model';
import { getBitAnchorId } from '../../../lib/bits-public-routing';

type Props = {
  viewModel: BitsCardViewModel;
  previewHtml?: string;
  previewBusy?: boolean;
  previewError?: string;
  onScrollElementChange?: (element: HTMLElement | null) => void;
};

let {
  viewModel,
  previewHtml = '',
  previewBusy = false,
  previewError = '',
  onScrollElementChange
}: Props = $props();

let previewScrollElement = $state<HTMLElement | null>(null);

const maxVisible = 4;
const hiddenImageCount = $derived(Math.max(0, viewModel.totalImages - maxVisible));

const handleAvatarError = (event: Event) => {
  const image = event.currentTarget as HTMLImageElement;
  image.parentElement?.classList.add('is-fallback');
  image.remove();
};

$effect(() => {
  const element = previewScrollElement;
  onScrollElementChange?.(element);
  return () => {
    onScrollElementChange?.(null);
  };
});
</script>

<section class="admin-bits-preview" aria-label="卡片预览">
  <div
    class="admin-bits-preview__scroller"
    data-refreshing={previewBusy && previewHtml ? 'true' : undefined}
    bind:this={previewScrollElement}
  >
    <div class="admin-bits-preview__list">
      <article
        class="bit-card"
        id={getBitAnchorId(viewModel.id)}
        data-bit
        data-bit-key={viewModel.id}
        data-slug={viewModel.slug}
      >
        <div class="bit-author">
          <div class={`avatar${viewModel.authorAvatar ? ' avatar--image' : ' is-fallback'}`} aria-hidden="true">
            {#if viewModel.authorAvatar}
              <img
                src={viewModel.authorAvatar}
                alt=""
                width="32"
                height="32"
                loading="lazy"
                decoding="async"
                onerror={handleAvatarError}
              />
            {/if}
            <span class="avatar-fallback">{viewModel.avatarLetter}</span>
          </div>
          <div class="name">{viewModel.authorName}</div>
        </div>

        {#if previewError}
          <div class="bit-body">
            <p class="admin-bits-preview__feedback" data-tone="error">{previewError}</p>
          </div>
        {:else if viewModel.body.shouldRenderFull && previewHtml}
          <div class="bit-body">
            {@html previewHtml}
          </div>
        {:else if viewModel.body.excerpt}
          <div class="bit-body">
            <p>{viewModel.body.excerpt}</p>
          </div>
        {/if}

        {#if viewModel.firstImage}
          <div class="bit-media bit-media--single">
            <div
              class="bit-media-item bit-media-item--single"
            >
              <img
                src={viewModel.firstImage.src}
                alt={viewModel.firstImage.alt}
                width={viewModel.firstImage.width}
                height={viewModel.firstImage.height}
                loading="lazy"
              />
            </div>
          </div>
        {:else if viewModel.imageItems.length > 1}
          <div class="bit-media bit-media--grid">
            <div class="bit-media-grid">
              {#each viewModel.visibleImages as image, index}
                <div
                  class={`bit-media-item${index === viewModel.wideIndex ? ' bit-media-item--wide' : ''}${index === maxVisible - 1 && hiddenImageCount > 0 ? ' bit-media-item--more' : ''}`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                  />
                  {#if index === maxVisible - 1 && hiddenImageCount > 0}
                    <span class="bit-media-more" aria-hidden="true">
                      <span class="bit-media-more-short">+ {hiddenImageCount}</span>
                      <span class="bit-media-more-full">查看其余{hiddenImageCount}张</span>
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if viewModel.imageItems.length}
          <div hidden aria-hidden="true">
            {#each viewModel.imageItems as image}
              <span
                data-bit-image-item
                data-bit-image-src={image.src}
                data-bit-image-alt={image.alt}
                data-bit-image-width={image.width}
                data-bit-image-height={image.height}
              ></span>
            {/each}
          </div>
        {/if}

        <div class="bit-meta">
          {#if viewModel.hasTags}
            <div class="bit-tags">
              {#if viewModel.placeText}
                <span class="bit-tag bit-tag--place">
                  <span class="bit-tag-icon" aria-hidden="true">📍</span>
                  <span class="bit-tag-text">{viewModel.placeText}</span>
                </span>
              {/if}
              {#if viewModel.normalTagItems.length}
                <span class="bit-tag bit-tag--normal">
                  <span class="bit-tag-icon" aria-hidden="true">❤</span>
                  <span class="bit-tag-list">
                    {#each viewModel.normalTagItems as tag}
                      <span class="bit-tag-token">{tag}</span>
                    {/each}
                  </span>
                </span>
              {/if}
            </div>
          {/if}
          <div>{viewModel.dateLabel}</div>
        </div>
      </article>
    </div>
  </div>
</section>
