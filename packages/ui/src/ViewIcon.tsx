import {
  BadgeDollarSign,
  Bell,
  BookMarked,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  Dumbbell,
  Flame,
  FolderKanban,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Inbox,
  Layers,
  LayoutGrid,
  ListChecks,
  ListTodo,
  MessageCircle,
  MessagesSquare,
  Palette,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Shapes,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  User,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { normalizeColorToken } from "./homeCatalog";

/**
 * A small, deliberately explicit Lucide map. The backend stores a Lucide name;
 * clients draw a circle when they do not know it, so an unknown name never
 * breaks a view.
 */
const ICONS: Record<string, LucideIcon> = {
  bell: Bell,
  "book-marked": BookMarked,
  book: BookOpen,
  "book-open": BookOpen,
  briefcase: Briefcase,
  calendar: Calendar,
  "calendar-days": CalendarDays,
  "calendar-range": CalendarRange,
  check: Check,
  "chevron-down": ChevronDown,
  "clipboard-list": ClipboardList,
  dumbbell: Dumbbell,
  flame: Flame,
  "folder-kanban": FolderKanban,
  "graduation-cap": GraduationCap,
  heart: Heart,
  "heart-pulse": HeartPulse,
  home: House,
  house: House,
  inbox: Inbox,
  layers: Layers,
  "layout-grid": LayoutGrid,
  "list-checks": ListChecks,
  "list-todo": ListTodo,
  "message-circle": MessageCircle,
  "messages-square": MessagesSquare,
  palette: Palette,
  pin: Pin,
  "pin-off": PinOff,
  plus: Plus,
  search: Search,
  settings: Settings,
  shapes: Shapes,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  target: Target,
  trophy: Trophy,
  user: User,
  users: Users,
  wallet: Wallet,
  "badge-dollar-sign": BadgeDollarSign,
  x: X,
};

function iconKey(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function resolveViewIcon(name: string | null | undefined): LucideIcon {
  return ICONS[iconKey(name)] ?? Circle;
}

export function ViewIcon({
  name,
  size = 18,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const Icon = resolveViewIcon(name);
  return (
    <Icon
      aria-hidden="true"
      className={className}
      size={size}
      strokeWidth={1.8}
    />
  );
}

export function colorToken(value: string | null | undefined): string {
  return normalizeColorToken(value);
}
