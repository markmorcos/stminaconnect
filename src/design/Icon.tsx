/**
 * Curated icon set. Adding a new icon? File a PR — do NOT inline-import
 * lucide icons in feature code, since each ad-hoc import bloats the
 * bundle.
 *
 * The list below is the only set of icons available to feature screens.
 * If your screen needs another icon, ADD IT HERE first (and update the
 * `IconName` union below), then consume `<Icon name="…" />` in the
 * screen.
 */
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Globe,
  Heart,
  Home,
  Info,
  type LucideIcon,
  type LucideProps,
  Menu as MenuIcon,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Share,
  Star,
  Trash,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';

import { useTokens } from './ThemeProvider';
import { spacing } from './tokens';

const ICONS = {
  alertCircle: AlertCircle,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  bell: Bell,
  calendar: Calendar,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  clock: Clock,
  eye: Eye,
  eyeOff: EyeOff,
  filter: Filter,
  globe: Globe,
  heart: Heart,
  home: Home,
  info: Info,
  menu: MenuIcon,
  messageCircle: MessageCircle,
  moreHorizontal: MoreHorizontal,
  plus: Plus,
  search: Search,
  settings: Settings,
  share: Share,
  star: Star,
  trash: Trash,
  user: User,
  userPlus: UserPlus,
  users: Users,
  x: X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<LucideProps, 'size' | 'color'> {
  name: IconName;
  /** Pixel size; defaults to 24 (= spacing.xl + 8 ≈ "lg"). */
  size?: number;
  /** Hex color; defaults to `tokens.colors.text`. */
  color?: string;
}

const DEFAULT_SIZE = 24;

/**
 * Token-aware wrapper around lucide-react-native. Default size is 24,
 * default color resolves to the active theme's `text`.
 */
export function Icon({ name, size = DEFAULT_SIZE, color, ...rest }: IconProps) {
  const { colors } = useTokens();
  const LucideComponent = ICONS[name];
  return <LucideComponent size={size} color={color ?? colors.text} {...rest} />;
}

export const ICON_SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export { spacing as iconSpacing };
