export type MarkdownSyntaxIcon =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'quote'
  | 'link'
  | 'image'
  | 'code'
  | 'code-block'
  | 'list'
  | 'ordered-list'
  | 'task-list'
  | 'table'
  | 'message-square-text';

export type MarkdownSyntaxExample = {
  label: string;
  syntax: string;
  icon?: MarkdownSyntaxIcon;
  marker?: string;
};

export type MarkdownShortcutExample = {
  label: string;
  shortcut: string;
  icon?: MarkdownSyntaxIcon;
};

export const MARKDOWN_SYNTAX_EXAMPLES: readonly MarkdownSyntaxExample[] = [
  { label: '小节标题', marker: 'H2', syntax: '## 标题' },
  { label: '三级标题', marker: 'H3', syntax: '### 标题' },
  { label: '粗体', icon: 'bold', syntax: '**粗体文本**' },
  { label: '斜体', icon: 'italic', syntax: '*斜体文本*' },
  { label: '删除线', icon: 'strikethrough', syntax: '~~文本~~' },
  { label: '链接', icon: 'link', syntax: '[链接描述](url)' },
  { label: '图片', icon: 'image', syntax: '![alt](url "图片描述")' },
  { label: '引用', icon: 'quote', syntax: '> 引用文本' },
  { label: '提示块', icon: 'message-square-text', syntax: ':::note[标题]' },
  { label: '代码', icon: 'code', syntax: '`代码`' },
  { label: '代码块', icon: 'code-block', syntax: '```语言' },
  { label: '无序列表', icon: 'list', syntax: '- 项目' },
  { label: '有序列表', icon: 'ordered-list', syntax: '1. 项目' },
  { label: '任务列表', icon: 'task-list', syntax: '- [ ] 待办事项' },
  { label: '表格', icon: 'table', syntax: '| 标题 | 标题 |' },
  { label: '分割线', marker: '---', syntax: '---' }
] as const;

export const MARKDOWN_SHORTCUT_EXAMPLES: readonly MarkdownShortcutExample[] = [
  { label: '粗体', icon: 'bold', shortcut: 'Ctrl + B' },
  { label: '斜体', icon: 'italic', shortcut: 'Ctrl + I' },
  { label: '链接', icon: 'link', shortcut: 'Ctrl + K' }
] as const;
