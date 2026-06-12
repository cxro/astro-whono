<script lang="ts">
import Bold from '@lucide/svelte/icons/bold';
import BookOpenText from '@lucide/svelte/icons/book-open-text';
import Braces from '@lucide/svelte/icons/braces';
import ArrowDown from '@lucide/svelte/icons/arrow-down';
import ArrowUp from '@lucide/svelte/icons/arrow-up';
import ArrowUpToLine from '@lucide/svelte/icons/arrow-up-to-line';
import BadgeQuestionMark from '@lucide/svelte/icons/badge-question-mark';
import Check from '@lucide/svelte/icons/check';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import CodeXml from '@lucide/svelte/icons/code-xml';
import Columns2 from '@lucide/svelte/icons/columns-2';
import Clock3 from '@lucide/svelte/icons/clock-3';
import Download from '@lucide/svelte/icons/download';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import Heading from '@lucide/svelte/icons/heading';
import Image from '@lucide/svelte/icons/image';
import ImagePlus from '@lucide/svelte/icons/image-plus';
import Images from '@lucide/svelte/icons/images';
import Hash from '@lucide/svelte/icons/hash';
import Info from '@lucide/svelte/icons/info';
import Italic from '@lucide/svelte/icons/italic';
import Link from '@lucide/svelte/icons/link';
import Link2 from '@lucide/svelte/icons/link-2';
import List from '@lucide/svelte/icons/list';
import ListCheck from '@lucide/svelte/icons/list-check';
import ListCollapse from '@lucide/svelte/icons/list-collapse';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import Lock from '@lucide/svelte/icons/lock';
import LockOpen from '@lucide/svelte/icons/lock-open';
import Maximize2 from '@lucide/svelte/icons/maximize-2';
import MessageSquareText from '@lucide/svelte/icons/message-square-text';
import Minimize2 from '@lucide/svelte/icons/minimize-2';
import MSquare from '@lucide/svelte/icons/m-square';
import MapPin from '@lucide/svelte/icons/map-pin';
import NotebookPen from '@lucide/svelte/icons/notebook-pen';
import Minus from '@lucide/svelte/icons/minus';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import Quote from '@lucide/svelte/icons/quote';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import Rows2 from '@lucide/svelte/icons/rows-2';
import SeparatorHorizontal from '@lucide/svelte/icons/separator-horizontal';
import Sigma from '@lucide/svelte/icons/sigma';
import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
import SquareAsterisk from '@lucide/svelte/icons/square-asterisk';
import SquareChartGantt from '@lucide/svelte/icons/square-chart-gantt';
import SquareSigma from '@lucide/svelte/icons/square-sigma';
import SquareUserRound from '@lucide/svelte/icons/square-user-round';
import Smile from '@lucide/svelte/icons/smile';
import Strikethrough from '@lucide/svelte/icons/strikethrough';
import Tag from '@lucide/svelte/icons/tag';
import Table2 from '@lucide/svelte/icons/table-2';
import Trash2 from '@lucide/svelte/icons/trash-2';
import TreePalm from '@lucide/svelte/icons/tree-palm';
import TreePine from '@lucide/svelte/icons/tree-pine';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import Undo2 from '@lucide/svelte/icons/undo-2';
import Upload from '@lucide/svelte/icons/upload';
import X from '@lucide/svelte/icons/x';

const icons = {
  'arrow-up-to-line': ArrowUpToLine,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  'calendar-days': CalendarDays,
  'badge-question-mark': BadgeQuestionMark,
  bold: Bold,
  'book-open-text': BookOpenText,
  check: CircleCheck,
  'check-mark': Check,
  close: X,
  code: CodeXml,
  'code-block': Braces,
  'columns-2': Columns2,
  'clock-3': Clock3,
  download: Download,
  ellipsis: Ellipsis,
  heading: Heading,
  image: Image,
  'image-plus': ImagePlus,
  images: Images,
  hash: Hash,
  info: Info,
  italic: Italic,
  link: Link,
  'link-2': Link2,
  list: List,
  'list-collapse': ListCollapse,
  lock: Lock,
  'lock-open': LockOpen,
  'maximize-2': Maximize2,
  'message-square-text': MessageSquareText,
  'minimize-2': Minimize2,
  'm-square': MSquare,
  'map-pin': MapPin,
  minus: Minus,
  'notebook-pen': NotebookPen,
  'ordered-list': ListOrdered,
  pencil: Pencil,
  plus: Plus,
  quote: Quote,
  'rotate-ccw': RotateCcw,
  'rows-2': Rows2,
  'separator-horizontal': SeparatorHorizontal,
  sigma: Sigma,
  'sliders-horizontal': SlidersHorizontal,
  'square-asterisk': SquareAsterisk,
  'square-chart-gantt': SquareChartGantt,
  'square-sigma': SquareSigma,
  'square-user-round': SquareUserRound,
  smile: Smile,
  strikethrough: Strikethrough,
  tag: Tag,
  table: Table2,
  'task-list': ListCheck,
  trash: Trash2,
  'tree-palm': TreePalm,
  'tree-pine': TreePine,
  'triangle-alert': TriangleAlert,
  'undo-2': Undo2,
  upload: Upload
} as const;

type AdminEditorIconName = keyof typeof icons;

type Props = {
  name: AdminEditorIconName;
  size?: number;
  strokeWidth?: number;
  class?: string;
  ariaHidden?: boolean;
};

let {
  name,
  size = 16,
  strokeWidth = 2,
  class: className = '',
  ariaHidden = true
}: Props = $props();

const IconComponent = $derived(icons[name]);
</script>

<IconComponent
  {size}
  {strokeWidth}
  class={className}
  aria-hidden={ariaHidden ? 'true' : undefined}
/>
