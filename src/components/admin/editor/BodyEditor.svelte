<script lang="ts">
import { onMount } from 'svelte';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { Compartment, EditorSelection, EditorState, Transaction, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, type KeyBinding } from '@codemirror/view';
import {
  getEditorBodyValueSyncReplacement,
  normalizeEditorBodyValue
} from './editor-shell-helpers';
import {
  getMarkdownOutlineSelectionRange,
  type MarkdownOutlineJumpCommand
} from './editor-outline-helpers';
import {
  applyMarkdownToolbarCommandToText,
  applyMarkdownToolToText,
  type EditorTextSelection,
  type MarkdownTextEdit
} from './editor-markdown-transforms';
import {
  findEditableImageBlockAtSelection,
  type EditableImageBlock
} from './editor-image-blocks';
import type { EditableGalleryBlock } from './editor-gallery-blocks';
import { getImageEditTooltipExtension } from './editor-image-edit-tooltip';
import { getMarkdownCodeDecorationsExtension } from './editor-markdown-code-decorations';
import { getMarkdownHighlightExtension } from './editor-markdown-highlight-extension';
import type {
  MarkdownToolbarCommand,
  MarkdownToolId
} from './markdown-tools';

type Props = {
  value: string;
  disabled?: boolean;
  toolbarCommand?: MarkdownToolbarCommand | null;
  outlineJumpCommand?: MarkdownOutlineJumpCommand | null;
  lineNumbersEnabled?: boolean;
  mediaEditEnabled?: boolean;
  galleryEditEnabled?: boolean;
  onScrollElementChange?: (element: HTMLElement | null) => void;
  onOutlineJump?: (element: HTMLElement) => void;
  onImageToolRequest?: (block: EditableImageBlock | null) => void;
  onGalleryEditRequest?: (block: EditableGalleryBlock) => void;
  onChange?: (value: string) => void;
  onShortcutTool?: (toolId: MarkdownToolId) => void;
};

let {
  value = $bindable(''),
  disabled = false,
  toolbarCommand = null,
  outlineJumpCommand = null,
  lineNumbersEnabled = false,
  mediaEditEnabled = true,
  galleryEditEnabled = true,
  onScrollElementChange,
  onOutlineJump,
  onImageToolRequest,
  onGalleryEditRequest,
  onChange,
  onShortcutTool
}: Props = $props();

let editorHostEl = $state<HTMLDivElement | null>(null);
let view = $state<EditorView | null>(null);
let appliedToolbarCommandId = 0;
let appliedOutlineJumpCommandId = 0;
let lastKnownEditorValue = '';

const readOnlyCompartment = new Compartment();
const editableCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();

const getEditorSelection = (editorView: EditorView): EditorTextSelection => {
  const selection = editorView.state.selection.main;
  return {
    from: selection.from,
    to: selection.to
  };
};

const dispatchMarkdownEdit = (edit: MarkdownTextEdit) => {
  if (!view) return;

  const currentSelection = view.state.selection.main;
  if (
    edit.from === edit.to
    && edit.insert === ''
    && edit.selection.from === currentSelection.from
    && edit.selection.to === currentSelection.to
  ) {
    return;
  }

  const nextLength = view.state.doc.length - (edit.to - edit.from) + edit.insert.length;
  view.dispatch({
    changes: {
      from: edit.from,
      to: edit.to,
      insert: edit.insert
    },
    selection: {
      anchor: Math.min(edit.selection.from, nextLength),
      head: Math.min(edit.selection.to, nextLength)
    },
    scrollIntoView: true
  });
  view.focus();
};

const getOutlineScrollYMargin = (
  scroller: HTMLElement,
  targetOffsetRatio: number | undefined
): number => {
  if (!targetOffsetRatio) return 0;
  return Math.max(0, Math.round(scroller.clientHeight * targetOffsetRatio));
};

const applyOutlineJumpCommand = (
  editorView: EditorView,
  command: MarkdownOutlineJumpCommand
) => {
  const source = normalizeEditorBodyValue(editorView.state.doc.toString());
  const { selectionStart: from, selectionEnd: to } = getMarkdownOutlineSelectionRange(source, command.item);
  const selectionRange = EditorSelection.range(from, to);

  editorView.dispatch({
    selection: { anchor: from, head: to },
    effects: EditorView.scrollIntoView(selectionRange, {
      y: 'start',
      yMargin: getOutlineScrollYMargin(editorView.scrollDOM, command.targetOffsetRatio)
    })
  });
  editorView.focus();
  onOutlineJump?.(editorView.scrollDOM);
};

const applyMarkdownTool = (toolId: MarkdownToolId): boolean => {
  if (disabled || !view) return false;

  dispatchMarkdownEdit(
    applyMarkdownToolToText(
      view.state.doc.toString(),
      getEditorSelection(view),
      toolId
    )
  );
  return true;
};

const applyToolbarCommand = (command: MarkdownToolbarCommand) => {
  if (disabled || !view) return;

  if (command.kind === 'tool' && command.toolId === 'image') {
    if (!mediaEditEnabled) return;
    onImageToolRequest?.(
      findEditableImageBlockAtSelection(
        view.state.doc.toString(),
        getEditorSelection(view)
      )
    );
    return;
  }

  dispatchMarkdownEdit(
    applyMarkdownToolbarCommandToText(
      view.state.doc.toString(),
      getEditorSelection(view),
      command
    )
  );
};

const applyShortcutTool = (toolId: MarkdownToolId): boolean => {
  if (disabled) return false;
  if (onShortcutTool) {
    onShortcutTool(toolId);
    return true;
  }

  return applyMarkdownTool(toolId);
};

const markdownKeymap: readonly KeyBinding[] = [
  { key: 'Mod-b', run: () => applyShortcutTool('bold') },
  { key: 'Mod-i', run: () => applyShortcutTool('italic') },
  { key: 'Mod-k', run: () => applyShortcutTool('link') }
];

const createMediaEditExtensions = (): Extension[] => {
  if (!mediaEditEnabled) return [];

  return [
    getImageEditTooltipExtension({
      isDisabled: () => disabled,
      onEditImageBlock: (block) => {
        onImageToolRequest?.(block);
      },
      ...(galleryEditEnabled
        ? {
            onEditGalleryBlock: (block: EditableGalleryBlock) => {
              onGalleryEditRequest?.(block);
            }
          }
        : {})
    })
  ];
};

const createEditorExtensions = (): Extension[] => [
  markdown({
    completeHTMLTags: false,
    pasteURLAsLink: true
  }),
  getMarkdownHighlightExtension(),
  getMarkdownCodeDecorationsExtension(),
  ...createMediaEditExtensions(),
  history(),
  EditorView.lineWrapping,
  lineNumbersCompartment.of(lineNumbersEnabled ? lineNumbers() : []),
  EditorView.contentAttributes.of({
    'aria-label': 'Markdown 正文',
    spellcheck: 'false'
  }),
  keymap.of([
    ...markdownKeymap,
    ...historyKeymap,
    ...defaultKeymap
  ]),
  readOnlyCompartment.of(EditorState.readOnly.of(disabled)),
  editableCompartment.of(EditorView.editable.of(!disabled)),
  EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;

    const nextValue = normalizeEditorBodyValue(update.state.doc.toString());
    lastKnownEditorValue = nextValue;
    if (nextValue !== value) {
      value = nextValue;
    }
    if (!update.transactions.some((transaction) => transaction.annotation(Transaction.addToHistory) === false)) {
      onChange?.(nextValue);
    }
  })
];

onMount(() => {
  if (!editorHostEl) return;

  const initialValue = normalizeEditorBodyValue(value);
  if (initialValue !== value) {
    value = initialValue;
  }
  lastKnownEditorValue = initialValue;

  const editorView = new EditorView({
    state: EditorState.create({
      doc: initialValue,
      extensions: createEditorExtensions()
    }),
    parent: editorHostEl
  });

  view = editorView;
  onScrollElementChange?.(editorView.scrollDOM);

  return () => {
    onScrollElementChange?.(null);
    editorView.destroy();
    view = null;
  };
});

$effect(() => {
  const editorView = view;
  if (!editorView) return;

  editorView.dispatch({
    effects: [
      readOnlyCompartment.reconfigure(EditorState.readOnly.of(disabled)),
      editableCompartment.reconfigure(EditorView.editable.of(!disabled))
    ]
  });
});

$effect(() => {
  const editorView = view;
  if (!editorView) return;

  editorView.dispatch({
    effects: lineNumbersCompartment.reconfigure(lineNumbersEnabled ? lineNumbers() : [])
  });
});

$effect(() => {
  const editorView = view;
  if (!editorView) return;

  const normalizedValue = normalizeEditorBodyValue(value);
  if (normalizedValue !== value) {
    value = normalizedValue;
    return;
  }
  if (normalizedValue === lastKnownEditorValue) return;

  const replacement = getEditorBodyValueSyncReplacement(editorView.state.doc.toString(), normalizedValue);
  if (replacement === null) {
    lastKnownEditorValue = normalizedValue;
    return;
  }

  lastKnownEditorValue = replacement;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: replacement
    },
    annotations: Transaction.addToHistory.of(false)
  });
});

$effect(() => {
  const command = toolbarCommand;
  if (!command || command.id === appliedToolbarCommandId) return;

  appliedToolbarCommandId = command.id;
  applyToolbarCommand(command);
});

$effect(() => {
  const command = outlineJumpCommand;
  const editorView = view;
  if (!command || !editorView || command.id === appliedOutlineJumpCommandId) return;

  appliedOutlineJumpCommandId = command.id;
  applyOutlineJumpCommand(editorView, command);
});
</script>

<section class="admin-editor-body" aria-label="Markdown body editor">
  <div class="admin-field admin-editor-body__field">
    <span class="admin-sr-only">Markdown 正文</span>
    <div
      class="admin-editor-body__codemirror"
      bind:this={editorHostEl}
    ></div>
  </div>
</section>
