'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Safari handles controls inside this fixed overlay reliably only with a non-native dialog wrapper. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  BookUser,
  CalendarPlus,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Calculator,
  ChevronDown,
  ChevronUp,
  Download,
  DollarSign,
  Eye,
  ExternalLink,
  FileText,
  Flame,
  Gamepad2,
  GripVertical,
  House,
  ImagePlus,
  Leaf,
  ListChecks,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu as MenuIcon,
  MessageCircle,
  Monitor,
  Minus,
  Move,
  Pencil,
  Play,
  Pin,
  PinOff,
  Plus,
  Reply,
  Send,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Share2,
  ShoppingBag,
  Smile,
  Smartphone,
  Sparkles,
  SquarePlus,
  Trash2,
  Upload,
  UtensilsCrossed,
  UsersRound,
  UserPlus,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

type EventResource = { id: string; name: string; capacity: number };
type EventType = 'meal' | 'movie' | 'game' | 'birthday' | 'custom';
type EventPalette = 'wine' | 'midnight' | 'forest' | 'celebration' | 'twilight';
type BackgroundFocus = { x: number; y: number };
type BackgroundEditorState = {
  target: 'new' | 'existing';
  imageUrl: string;
  focus: BackgroundFocus;
  zoom: number;
};
type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  prepMinutes?: number;
  maxServings?: number;
  soldOut?: boolean;
  requirements?: Record<string, number>;
  imageUrl?: string;
  imagePath?: string;
  dietary?: string;
  featured?: boolean;
};
type EventMenu = {
  id: string;
  publicPath?: string;
  publicPathClaimId?: string;
  title: string;
  date: string;
  startsAt?: string;
  address?: string;
  welcome: string;
  accepting: boolean;
  rsvpOpen?: boolean;
  chatOpen?: boolean;
  requireGuestApproval?: boolean;
  eventType?: EventType;
  customEventType?: string;
  backgroundImageUrl?: string;
  backgroundFocus?: BackgroundFocus;
  backgroundZoom?: number;
  colorPalette?: EventPalette;
  maxAdditionalGuests?: number;
  categories?: string[];
  resources?: EventResource[];
  ownerUid?: string;
  updatedAt?: number;
  items: MenuItem[];
};
type OrderStatus = 'new' | 'preparing' | 'served' | 'cancelled' | 'rejected';
type TaskStatus = 'waiting' | 'preparing' | 'ready' | 'served' | 'rejected';
type OrderTask = {
  id: string;
  itemId: string;
  status: TaskStatus;
  sequence: number;
  startedAt?: number;
  estimatedReadyAt?: number;
  finishedAt?: number;
  servedAt?: number;
};
type OrderTaskRef = { orderId: string; taskId: string };
type Order = {
  id: string;
  guestName: string;
  guestLabel?: string;
  selections: Record<string, number>;
  note: string;
  status: OrderStatus;
  tasks?: OrderTask[];
  createdAt: number;
  updatedAt?: number;
  cancelledAt?: number;
  readyAt?: number;
  guestUid?: string;
  revision?: number;
};
type Rsvp = {
  guestUid: string;
  guestName: string;
  guestPhone: string;
  status: 'yes' | 'maybe' | 'no';
  approvalStatus?: 'pending' | 'approved' | 'declined';
  companions?: Array<string | { name: string; phone?: string }>;
  activeOrderCount: number;
  createdAt: number;
  updatedAt?: number;
};
type ChatActor = {
  uid: string;
  name: string;
  role: 'host' | 'guest';
};
type GameParticipant = {
  id: string;
  name: string;
};
type PushNotificationState = 'unsupported' | 'disabled' | 'blocked' | 'enabled';
type NightsNativeAuthBridge = {
  completeGoogle: (idToken: string, accessToken: string) => void;
  completeApple: (idToken: string, rawNonce: string) => void;
  fail: (message: string) => void;
};
type NightsNativeWindow = Window & {
  __nightsNativeAuth?: NightsNativeAuthBridge;
  webkit?: {
    messageHandlers?: {
      nightsAuth?: {
        postMessage: (message: { provider: 'google' | 'apple' }) => void;
      };
      nightsTheme?: {
        postMessage: (color: string) => void;
      };
    };
  };
};
type AccountProfile = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  phone: string;
  guestUid: string;
  membershipTier: 'free' | 'plus' | 'pro';
  membershipStatus: 'active' | 'trialing' | 'past_due' | 'cancelled';
  mutedEventIds: string[];
  emailVerified?: boolean;
  verificationExpiresAt?: number | null;
  createdAt: number;
  updatedAt?: number;
};
type AccountUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
  providerIds: string[];
};
type AccountAuthMode = 'signin' | 'signup' | 'profile' | 'recovery';
type EventInvitation = {
  eventId: string;
  eventTitle?: string;
  hostUid: string;
  recipientUid: string;
  recipientGuestUid: string;
  recipientEmail: string;
  recipientPhone: string;
  recipientName?: string;
  createdAt: number;
  updatedAt?: number;
  pendingAccount?: boolean;
  invitationId?: string;
};
type ExpenseParticipant = {
  id: string;
  accountUid: string;
  primaryGuestUid: string;
  name: string;
  role: 'host' | 'guest' | 'companion';
  status: 'host' | 'invited' | 'yes' | 'maybe' | 'no';
  approvalStatus: 'pending' | 'approved' | 'declined';
  createdAt: number;
  updatedAt?: number;
};
type ExpenseAllocation = { participantUid: string; multiplier: number };
type ExpenseSplitParticipant = {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'companion' | 'external';
};
type ExpenseLineItem = {
  id: string;
  name: string;
  amountCents: number;
  allocations: ExpenseAllocation[];
};
type EventExpense = {
  id: string;
  kind: 'manual' | 'receipt';
  title: string;
  items: ExpenseLineItem[];
  taxCents: number;
  feesCents: number;
  submittedByAccountUid: string;
  submittedByUid: string;
  submittedByName: string;
  submittedByRole: 'host' | 'guest';
  participants?: ExpenseSplitParticipant[];
  receiptUrl?: string;
  receiptPath?: string;
  receiptName?: string;
  createdAt: number;
  updatedAt?: number;
};
type GeneratedGameRuntime = {
  instructions: string;
  logicSource: string;
  uiNotes: string;
};
type EventGame = {
  id: string;
  title: string;
  summary: string;
  status: 'draft' | 'published';
  playerArrangement: string;
  interfaceDescription: string;
  rules: string;
  scoring: string;
  timing: string;
  hiddenInformation: string;
  winCondition: string;
  minPlayers: number;
  maxPlayers: number;
  runtime: GeneratedGameRuntime | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  version: number;
};
type GameTeam = {
  id: string;
  name: string;
  playerIds: string[];
};
type EventGameSession = {
  gameId: string;
  gameVersion: number;
  hostId: string;
  revision: number;
  joinedPlayers: GameParticipant[];
  teams: GameTeam[];
  state: Record<string, unknown>;
  updatedBy: string;
  updatedAt: string;
};
type MoneyDetail = {
  id: string;
  direction: 'owed' | 'owes';
  eventId: string;
  eventTitle: string;
  personId: string;
  personName: string;
  amountCents: number;
  expenseTitles: string[];
};
type AccountMoney = {
  balance: number;
  owed: number;
  owes: number;
  owedDetails: MoneyDetail[];
  owesDetails: MoneyDetail[];
};
type ExpenseActor = {
  accountUid: string;
  participantUid: string;
  name: string;
  role: 'host' | 'guest';
};
type HostContact = {
  accountUid: string;
  guestUid: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  inviteCount: number;
  eventIds: string[];
  lastInvitedAt: number;
};
type ChatReply = { id: string; authorName: string; text: string };
type ChatPollOption = {
  id: string;
  text: string;
  addedByUid: string;
  addedByName: string;
};
type ChatReaction = string | { emoji: string; name: string };
type ChatPollVote = string | string[];
type ChatMessage = {
  id: string;
  type: 'message' | 'poll';
  authorUid: string;
  authorName: string;
  authorRole: 'host' | 'guest';
  text: string;
  createdAt: number;
  updatedAt?: number;
  edited: boolean;
  replyTo: ChatReply | null;
  reactions: Record<string, ChatReaction>;
  pollQuestion: string;
  pollOptions: ChatPollOption[];
  pollVotes: Record<string, ChatPollVote>;
  pollVoterNames?: Record<string, string>;
  allowGuestOptions: boolean;
  allowMultipleVotes?: boolean;
  pollBumpedAt?: number;
  pinned?: boolean;
  pinnedAt?: number;
  pinnedByName?: string;
  deleted?: boolean;
  lastActorUid?: string;
  lastActorRole?: 'host' | 'guest';
};
let chatAudioContext: AudioContext | null = null;
const primeChatAudio = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  chatAudioContext ||= new AudioContextConstructor();
  if (chatAudioContext.state === 'suspended') void chatAudioContext.resume();
  return chatAudioContext;
};
const playChatSound = () => {
  const context = primeChatAudio();
  if (!context) return;
  const chime = () => {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    gain.connect(context.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.08);
      oscillator.stop(context.currentTime + 0.24 + index * 0.08);
    });
  };
  if (context.state === 'running') chime();
  else void context.resume().then(chime).catch(() => undefined);
};
const eventTimestamp = () => Date.now();
const EVENT_TYPES: Array<{ value: EventType; label: string; description: string }> = [
  { value: 'meal', label: 'Catering / Meal', description: 'Dinner, brunch, tasting, or catered gathering' },
  { value: 'movie', label: 'Movie Night', description: 'A cozy screening with friends' },
  { value: 'game', label: 'Game Night', description: 'Board games, cards, or tournament play' },
  { value: 'birthday', label: 'Birthday Party', description: 'A celebration centered on someone special' },
  { value: 'custom', label: 'Something else', description: 'Name your own kind of gathering' },
];
const EVENT_BACKGROUNDS: Record<EventType, string> = {
  meal: '/gathering/gather-dinner-hero.jpg',
  movie: '/gathering/gather-movie-night-hero.jpg',
  game: '/gathering/gather-game-night-hero.jpg',
  birthday: '/gathering/gather-birthday-party-hero.jpg',
  custom: '/gathering/gather-custom-event-hero.jpg',
};
const EVENT_MOBILE_BACKGROUNDS: Record<EventType, string> = {
  meal: '/gathering/gather-dinner-hero-mobile.jpg',
  movie: '/gathering/gather-movie-night-hero-mobile.jpg',
  game: '/gathering/gather-game-night-hero-mobile.jpg',
  birthday: '/gathering/gather-birthday-party-hero-mobile.jpg',
  custom: '/gathering/gather-custom-event-hero-mobile.jpg',
};
const EVENT_MOBILE_BACKGROUND_FOCUS: Record<EventType, BackgroundFocus> = {
  meal: { x: 52, y: 50 },
  movie: { x: 50, y: 48 },
  game: { x: 51, y: 48 },
  birthday: { x: 51, y: 48 },
  custom: { x: 50, y: 50 },
};
const EVENT_PALETTES: Array<{
  value: EventPalette;
  label: string;
  colors: [string, string, string];
  theme: Record<string, string>;
}> = [
  {
    value: 'wine',
    label: 'Warm burgundy',
    colors: ['#4b111d', '#d9543d', '#f2a68e'],
    theme: {
      '--cream': '#f7f2e8', '--ink': '#20231f', '--tomato': '#d9543d', '--sage': '#55725b',
      '--sage-light': '#e6eee5', '--paper': '#fffdf8', '--wine': '#4b111d', '--wine-deep': '#25090f',
      '--night': '#11130f', '--parchment': '#f3ecdf', '--acid': '#d8f06a', '--peach': '#f2a68e',
      '--theme-rgb': '75 17 29', '--theme-deep-rgb': '24 3 8',
    },
  },
  {
    value: 'midnight',
    label: 'Midnight blue',
    colors: ['#263f61', '#4d78a8', '#9ec5ee'],
    theme: {
      '--cream': '#edf1f5', '--ink': '#1d2530', '--tomato': '#4d78a8', '--sage': '#5b7187',
      '--sage-light': '#dde7f0', '--paper': '#f9fbfd', '--wine': '#263f61', '--wine-deep': '#111c2d',
      '--night': '#0e1724', '--parchment': '#e8edf3', '--acid': '#b9d7f4', '--peach': '#9ec5ee',
      '--theme-rgb': '38 63 97', '--theme-deep-rgb': '14 25 41',
    },
  },
  {
    value: 'forest',
    label: 'Forest table',
    colors: ['#1c5148', '#39695d', '#e7bd86'],
    theme: {
      '--cream': '#eef1e8', '--ink': '#1c2925', '--tomato': '#bd7442', '--sage': '#39695d',
      '--sage-light': '#dce9e2', '--paper': '#fbfcf8', '--wine': '#1c5148', '--wine-deep': '#0a2521',
      '--night': '#0d1c19', '--parchment': '#e8eee7', '--acid': '#a9d9b7', '--peach': '#e7bd86',
      '--theme-rgb': '28 81 72', '--theme-deep-rgb': '10 37 33',
    },
  },
  {
    value: 'celebration',
    label: 'Celebration rose',
    colors: ['#73304f', '#ca607d', '#f1cf78'],
    theme: {
      '--cream': '#f8eef2', '--ink': '#2d2029', '--tomato': '#ca607d', '--sage': '#7b6075',
      '--sage-light': '#eee0ea', '--paper': '#fffafd', '--wine': '#73304f', '--wine-deep': '#321322',
      '--night': '#211019', '--parchment': '#f4e7ed', '--acid': '#f1cf78', '--peach': '#f2afbd',
      '--theme-rgb': '115 48 79', '--theme-deep-rgb': '50 19 34',
    },
  },
  {
    value: 'twilight',
    label: 'Twilight violet',
    colors: ['#443b6a', '#7465aa', '#dfc978'],
    theme: {
      '--cream': '#f1eff7', '--ink': '#252238', '--tomato': '#7465aa', '--sage': '#625d81',
      '--sage-light': '#e5e1f0', '--paper': '#fcfbff', '--wine': '#443b6a', '--wine-deep': '#1b172b',
      '--night': '#14111f', '--parchment': '#ece9f4', '--acid': '#dfc978', '--peach': '#c5b9ec',
      '--theme-rgb': '68 59 106', '--theme-deep-rgb': '27 23 43',
    },
  },
];
const DEFAULT_EVENT_PALETTE: Record<EventType, EventPalette> = {
  meal: 'wine', movie: 'midnight', game: 'forest', birthday: 'celebration', custom: 'twilight',
};
const eventPalette = (menu: Pick<EventMenu, 'eventType' | 'colorPalette'>) =>
  menu.colorPalette || DEFAULT_EVENT_PALETTE[menu.eventType || 'meal'];
const eventThemeStyle = (menu: Pick<EventMenu, 'eventType' | 'colorPalette'>) =>
  EVENT_PALETTES.find((palette) => palette.value === eventPalette(menu))?.theme as CSSProperties;
const eventThemeChromeColor = (menu: Pick<EventMenu, 'eventType' | 'colorPalette'>) =>
  EVENT_PALETTES.find((palette) => palette.value === eventPalette(menu))?.theme['--wine-deep'] || '#10282b';
const eventTypeLabel = (menu: EventMenu) =>
  menu.eventType === 'custom' && menu.customEventType?.trim()
    ? menu.customEventType.trim()
    : EVENT_TYPES.find((type) => type.value === (menu.eventType || 'meal'))?.label || 'Gathering';
const eventBackground = (menu: EventMenu) =>
  menu.backgroundImageUrl || EVENT_BACKGROUNDS[menu.eventType || 'meal'];
const centerBackgroundFocus = (): BackgroundFocus => ({ x: 50, y: 50 });
const eventBackgroundFocus = (menu: Pick<EventMenu, 'backgroundFocus'>): BackgroundFocus => ({
  x: Math.min(100, Math.max(0, menu.backgroundFocus?.x ?? 50)),
  y: Math.min(100, Math.max(0, menu.backgroundFocus?.y ?? 50)),
});
const eventBackgroundZoom = (menu: Pick<EventMenu, 'backgroundZoom'>) =>
  Math.min(3, Math.max(1, menu.backgroundZoom ?? 1));
const approvalStatus = (rsvp?: Rsvp | null) => rsvp?.approvalStatus || 'approved';
const guestIsApproved = (menu: EventMenu, rsvp?: Rsvp | null) =>
  !menu.requireGuestApproval || rsvp?.status !== 'yes' || approvalStatus(rsvp) === 'approved';
const companionName = (companion: string | { name: string; phone?: string }) =>
  typeof companion === 'string' ? companion : companion.name;
const phoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};
const formatPhone = (value: string) => {
  const digits = phoneDigits(value);
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : value;
};
const formatPhoneInput = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};
const companionPhone = (companion: string | { name: string; phone?: string }) =>
  typeof companion === 'string' ? '' : formatPhone(companion.phone || '');
const normalizeOptionalPhone = (value: string) => {
  if (!value.trim()) return '';
  const digits = phoneDigits(value);
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : null;
};
type GuestProfile = {
  guestUid: string;
  accountUid?: string;
  guestName: string;
  guestPhone: string;
  pinHash?: string;
  createdAt: number;
  updatedAt?: number;
};
type GuestSession = Pick<GuestProfile, 'guestUid' | 'guestName' | 'guestPhone'> & {
  authUid?: string;
  email?: string;
  pinHash?: string;
};
type GuestEventAccess = {
  event: EventMenu;
  profile: GuestProfile;
  rsvp: Rsvp | null;
  invitation?: EventInvitation;
  hosted?: boolean;
};
type EventActivity = {
  id: string;
  eventId: string;
  kind: 'invitation' | 'schedule' | 'location' | 'expense' | 'event';
  title: string;
  detail: string;
  createdAt: number;
  read: boolean;
};
type Receipt = {
  eventId: string;
  orderId: string;
  createdAt: number;
  expiresAt: number;
};
const expensePreviewKey = (eventId: string) => `gather-demo-expenses:${eventId}`;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const formatCents = (cents: number) => money.format(Math.max(0, cents) / 100);
const formatBalance = (cents: number) => cents < 0
  ? `-${money.format(Math.abs(cents) / 100)}`
  : money.format(cents / 100);
const parseMoneyCents = (value: string) => {
  const amount = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
};
const companionParticipantId = (guestUid: string, index: number) => `${guestUid}--companion-${index + 1}`;
const allocateCents = (amountCents: number, allocations: ExpenseAllocation[]) => {
  const active = allocations
    .filter((allocation) => allocation.multiplier > 0)
    .map((allocation) => ({ ...allocation, multiplier: Math.max(1, Math.round(allocation.multiplier)) }));
  const result: Record<string, number> = {};
  const totalWeight = active.reduce((sum, allocation) => sum + allocation.multiplier, 0);
  if (!totalWeight || amountCents <= 0) return result;
  let assigned = 0;
  active.forEach((allocation) => {
    const share = Math.floor(amountCents * allocation.multiplier / totalWeight);
    result[allocation.participantUid] = (result[allocation.participantUid] || 0) + share;
    assigned += share;
  });
  let remainder = amountCents - assigned;
  for (let index = 0; remainder > 0; index = (index + 1) % active.length, remainder -= 1) {
    const participantUid = active[index].participantUid;
    result[participantUid] = (result[participantUid] || 0) + 1;
  }
  return result;
};
const expenseShares = (expense: EventExpense) => {
  const shares: Record<string, number> = {};
  expense.items.forEach((item) => {
    Object.entries(allocateCents(item.amountCents, item.allocations)).forEach(([participantUid, cents]) => {
      shares[participantUid] = (shares[participantUid] || 0) + cents;
    });
  });
  const extras = Math.max(0, expense.taxCents) + Math.max(0, expense.feesCents);
  const weighted = Object.entries(shares).map(([participantUid, cents]) => ({
    participantUid,
    multiplier: Math.max(1, cents),
  }));
  Object.entries(allocateCents(extras, weighted)).forEach(([participantUid, cents]) => {
    shares[participantUid] = (shares[participantUid] || 0) + cents;
  });
  return shares;
};
const expenseTotal = (expense: Pick<EventExpense, 'items' | 'taxCents' | 'feesCents'>) =>
  expense.items.reduce((sum, item) => sum + Math.max(0, item.amountCents), 0)
  + Math.max(0, expense.taxCents)
  + Math.max(0, expense.feesCents);
const emptyAccountMoney = (): AccountMoney => ({ balance: 0, owed: 0, owes: 0, owedDetails: [], owesDetails: [] });
const groupMoneyDetails = (details: MoneyDetail[]) => {
  const grouped = new Map<string, MoneyDetail>();
  details.forEach((detail) => {
    const key = `${detail.direction}:${detail.eventId}:${detail.personId}`;
    const current = grouped.get(key);
    if (current) {
      current.amountCents += detail.amountCents;
      current.expenseTitles = [...new Set([...current.expenseTitles, ...detail.expenseTitles])];
    } else grouped.set(key, { ...detail, expenseTitles: [...detail.expenseTitles] });
  });
  return [...grouped.values()].sort((a, b) => b.amountCents - a.amountCents
    || a.eventTitle.localeCompare(b.eventTitle)
    || a.personName.localeCompare(b.personName));
};
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

const demoMenu: EventMenu = {
  id: 'garden-supper',
  title: 'A Garden Supper',
  date: 'Saturday, Oct 17 · 6:30 PM',
  startsAt: '2026-10-17T18:30',
  address: 'The garden table',
  welcome: 'Choose your favorites and we’ll have your plate ready.',
  accepting: true,
  requireGuestApproval: false,
  eventType: 'meal',
  categories: ['To begin', 'Main plates', 'Something sweet'],
  resources: [
    { id: 'oven', name: 'Oven space', capacity: 1 },
    { id: 'burner', name: 'Stovetop burners', capacity: 2 },
    { id: 'prep', name: 'Prep stations', capacity: 2 },
  ],
  items: [
    {
      id: 'tomato',
      name: 'Heirloom tomato toast',
      description: 'Whipped feta, basil oil, sourdough',
      category: 'To begin',
      price: 0,
      prepMinutes: 8,
      requirements: { prep: 1 },
      dietary: 'Vegetarian',
      featured: true,
    },
    {
      id: 'salmon',
      name: 'Cedar-roasted salmon',
      description: 'Charred lemon, spring herbs, new potatoes',
      category: 'Main plates',
      price: 0,
      prepMinutes: 24,
      requirements: { oven: 1, prep: 1 },
      dietary: 'Gluten-free',
      featured: true,
    },
    {
      id: 'risotto',
      name: 'Sweet pea risotto',
      description: 'Lemon, parmesan, garden shoots',
      category: 'Main plates',
      price: 0,
      prepMinutes: 20,
      requirements: { burner: 1 },
      dietary: 'Vegetarian',
    },
    {
      id: 'chicken',
      name: 'Herb-roasted chicken',
      description: 'Pan jus, warm farro, market greens',
      category: 'Main plates',
      price: 0,
      prepMinutes: 28,
      requirements: { oven: 1 },
    },
    {
      id: 'tart',
      name: 'Strawberry almond tart',
      description: 'Vanilla cream, toasted almond',
      category: 'Something sweet',
      price: 0,
      prepMinutes: 6,
      requirements: { prep: 1 },
      dietary: 'Vegetarian',
    },
  ],
};
const EMPTY_EVENT_ID = 'no-event-selected';
const emptyEventMenu: EventMenu = {
  id: EMPTY_EVENT_ID,
  title: 'Nights',
  date: '',
  welcome: 'Open an event link to see its invitation.',
  accepting: false,
  rsvpOpen: false,
  chatOpen: false,
  items: [],
};
const sampleOrders: Order[] = [
  {
    id: 'o1',
    guestName: 'Maya',
    selections: { salmon: 1, tart: 1 },
    note: 'No onions, please',
    status: 'new',
    createdAt: Date.now() - 120000,
  },
  {
    id: 'o2',
    guestName: 'Theo + Sam',
    selections: { risotto: 1, chicken: 1, tomato: 2 },
    note: '',
    status: 'preparing',
    tasks: [
      {
        id: 'o2-risotto-0',
        itemId: 'risotto',
        status: 'preparing',
        sequence: 0,
        startedAt: Date.now() - 120000,
        estimatedReadyAt: Date.now() + 1080000,
      },
      {
        id: 'o2-chicken-0',
        itemId: 'chicken',
        status: 'preparing',
        sequence: 1,
        startedAt: Date.now() - 120000,
        estimatedReadyAt: Date.now() + 1560000,
      },
      {
        id: 'o2-tomato-0',
        itemId: 'tomato',
        status: 'preparing',
        sequence: 2,
        startedAt: Date.now() - 120000,
        estimatedReadyAt: Date.now() + 360000,
      },
      { id: 'o2-tomato-1', itemId: 'tomato', status: 'waiting', sequence: 3 },
    ],
    createdAt: Date.now() - 540000,
  },
];
const firebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
);
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || '';
const PUSH_NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_PUSH_NOTIFICATIONS_ENABLED === 'true';
const PUSH_API_URL = 'https://gaemaj.tech/api/push';
const GAME_API_URL = 'https://gaemaj.tech/api/games';
const callPushApi = async (
  path: 'subscribe' | 'send' | 'invite' | 'expense' | 'account',
  method: 'POST' | 'DELETE',
  body: Record<string, unknown>,
  authToken = '',
) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  const response = await fetch(`${PUSH_API_URL}/${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error || 'Notification service is unavailable.');
  }
  return response.json().catch(() => ({ ok: true })) as Promise<Record<string, unknown>>;
};
const callGameGenerator = async (
  eventId: string,
  definition: Pick<EventGame,
    'title' | 'summary' | 'playerArrangement' | 'interfaceDescription' | 'rules'
    | 'scoring' | 'timing' | 'hiddenInformation' | 'winCondition' | 'minPlayers' | 'maxPlayers'>,
  authToken: string,
) => {
  const response = await fetch(`${GAME_API_URL}/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ eventId, definition }),
  });
  const result = await response.json().catch(() => null) as {
    game?: GeneratedGameRuntime;
    error?: string;
    remainingToday?: number;
  } | null;
  if (!response.ok || !result?.game)
    throw new Error(result?.error || 'The game designer is unavailable right now.');
  return result;
};
const callGameSession = async (
  eventId: string,
  gameId: string,
  operation: 'ensure' | 'read' | 'join' | 'teams' | 'state',
  authToken: string,
  payload: Record<string, unknown> = {},
) => {
  const response = await fetch(`${GAME_API_URL}/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ eventId, gameId, operation, ...payload }),
  });
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    session?: EventGameSession;
    error?: string;
  } | null;
  if (!response.ok || !result?.session) {
    const failure = new Error(result?.error || 'The shared game could not be updated.') as Error & { session?: EventGameSession };
    failure.session = result?.session;
    throw failure;
  }
  return result.session;
};
const HOST_EMAIL = process.env.NEXT_PUBLIC_HOST_EMAIL?.trim().toLowerCase();
const LEGACY_HOST_UID = process.env.NEXT_PUBLIC_LEGACY_HOST_UID?.trim()
  || 'W2T8SwFA1pdg8wxm23E5kQqbEHv2';
const guestIdentityKey = (eventId: string) => `gather-guest-identity:${eventId}`;
const GUEST_SESSION_KEY = 'nights-guest-session-v1';
const GUEST_EVENTS_CACHE_KEY = 'nights-guest-events-v1';
const GLOBAL_PUSH_KEY = 'nights-global-push-v1';
const NOTIFICATION_PROMPT_KEY = 'nights-notification-prompt-v1';
const PENDING_GUEST_EVENT_KEY = 'nights-pending-guest-event-v1';
const TRUSTED_GUEST_ROUTE_KEY = 'nights-selected-guest-route-v1';
const LAST_EVENT_KEY = 'gather-last-event';
const CREATE_EVENT_INTENT_KEY = 'nights-create-event-intent-v1';
const CREATE_EVENT_RETURN_ROUTE_KEY = 'nights-create-event-return-route-v1';
const HOST_PREVIEW_RETURN_ROUTE_KEY = 'nights-host-preview-return-route-v1';
const eventActivityKey = (accountUid: string) => `nights-event-activity-v1:${accountUid}`;
const eventActivityMarkerKey = (accountUid: string, activityId: string) =>
  `nights-event-activity-seen-v1:${accountUid}:${activityId}`;
const APP_BADGE_CACHE = 'nights-chat-badge-v1';
const APP_BADGE_STATE_PATH = '/__nights_chat_badge_state__';
type AppBadgeState = { events: Record<string, number> };
type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};
const readAppBadgeState = async (): Promise<AppBadgeState> => {
  if (typeof window === 'undefined' || !('caches' in window)) return { events: {} };
  try {
    const cache = await caches.open(APP_BADGE_CACHE);
    const response = await cache.match(new URL(APP_BADGE_STATE_PATH, window.location.origin));
    return response ? await response.json() as AppBadgeState : { events: {} };
  } catch {
    return { events: {} };
  }
};
const applyAppBadge = async (state: AppBadgeState) => {
  const badgeNavigator = navigator as BadgeNavigator;
  const count = Object.values(state.events).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
  try {
    if (count > 0) await badgeNavigator.setAppBadge?.(count);
    else await badgeNavigator.clearAppBadge?.();
  } catch {
    // Badging is optional and can be disabled in the device's notification settings.
  }
};
const setEventAppBadge = async (eventId: string, count: number) => {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const state = await readAppBadgeState();
  if (count > 0) state.events[eventId] = count;
  else delete state.events[eventId];
  try {
    const cache = await caches.open(APP_BADGE_CACHE);
    await cache.put(
      new URL(APP_BADGE_STATE_PATH, window.location.origin),
      new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json' } }),
    );
  } catch {
    // Keep the chat functional when Cache Storage is unavailable.
  }
  await applyAppBadge(state);
};
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{2,120}$/;
const EVENT_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]{0,59}$/;
const RESERVED_EVENT_PATHS = new Set([
  '_next',
  'gathering',
  'nights-guests',
  'nights-guest',
  'nights-host',
  'icons',
  'favicon.svg',
  'manifest.webmanifest',
  'og.png',
  'sw.js',
]);
type PendingGuestEvent = {
  route: string;
  eventId?: string;
  publicPath?: string;
  savedAt: number;
};
const isGuestPortalUrl = (url: URL) => {
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).toLowerCase());
  if (segments[0] === 'gathering') segments.shift();
  return segments[0] === 'nights-guest'
    || segments[0] === 'nights-guests'
    || url.searchParams.get('guest') === '1';
};
const isHostPortalUrl = (url: URL) => {
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).toLowerCase());
  if (segments[0] === 'gathering') segments.shift();
  return segments[0] === 'nights-host' || url.searchParams.get('view') === 'host';
};
const eventIdFromUrl = (url: URL) => {
  const queryEventId = url.searchParams.get('event')?.trim();
  if (queryEventId && EVENT_ID_PATTERN.test(queryEventId)) return queryEventId;
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  if (segments[0] === 'gathering') segments.shift();
  const pathEventId = segments.length === 1 ? segments[0] : '';
  return pathEventId
    && !RESERVED_EVENT_PATHS.has(pathEventId)
    && EVENT_ID_PATTERN.test(pathEventId)
    ? pathEventId
    : null;
};
const eventPublicPathFromUrl = (url: URL) => {
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).toLowerCase());
  if (segments[0] === 'gathering') segments.shift();
  if (segments[0] === 'nights-guest' || segments[0] === 'nights-guests' || segments[0] === 'nights-host') return null;
  return segments.length === 2
    && segments.every((segment) => EVENT_PATH_SEGMENT_PATTERN.test(segment))
    ? segments.join('/')
    : null;
};
const currentEventId = () => eventIdFromUrl(new URL(window.location.href));
const currentEventPublicPath = () => eventPublicPathFromUrl(new URL(window.location.href));
const usesCleanEventUrls = () =>
  typeof window !== 'undefined'
  && (window.location.hostname === 'gaemaj.tech' || window.location.hostname.endsWith('.gaemaj.tech'));
const normalizeEventPathSegment = (value: string, fallback = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || fallback;
const defaultEventPathCategory = (eventType: EventType) => ({
  meal: 'meal',
  movie: 'movie-night',
  game: 'game-night',
  birthday: 'birthday',
  custom: 'event',
})[eventType];
const dateEventPathSegment = (value: string) => {
  const [year, month, day] = value.split('T')[0]?.split('-').map(Number) || [];
  if (!year || !month || !day) return '';
  const monthName = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
  return `${monthName}${day}`.toLowerCase();
};
const normalizedPublicEventPath = (value?: string) => {
  if (!value) return '';
  const parts = value.split('/').map((part) => normalizeEventPathSegment(part));
  return parts.length === 2 && parts.every(Boolean) ? parts.join('/') : '';
};
const automaticPublicEventPath = (event: Pick<EventMenu, 'title' | 'startsAt' | 'date' | 'publicPath'>) => {
  const explicitPath = normalizedPublicEventPath(event.publicPath);
  if (explicitPath) return explicitPath;
  const category = normalizeEventPathSegment(event.title, 'event');
  const occurrence = dateEventPathSegment(event.startsAt || '');
  return occurrence ? `${category}/${occurrence}` : '';
};
const eventRoute = (
  eventId: string,
  view: 'guest' | 'host' = 'guest',
  publicPath?: string,
) => {
  const encodedEventId = encodeURIComponent(eventId);
  const cleanPath = normalizedPublicEventPath(publicPath);
  if (usesCleanEventUrls()) {
    if (view === 'host') return `/nights-host/?event=${encodedEventId}`;
    return `/${cleanPath || encodedEventId}`;
  }
  return view === 'host'
    ? `?view=host&event=${encodedEventId}`
    : `?event=${encodedEventId}`;
};
const hostPreviewRoute = (eventId: string, publicPath?: string) => {
  const route = eventRoute(eventId, 'guest', publicPath);
  return `${route}${route.includes('?') ? '&' : '?'}preview=host`;
};
const hostHomeRoute = () => usesCleanEventUrls() ? '/nights-host/' : '?view=host';
const guestHomeRoute = () => usesCleanEventUrls() ? '/nights-guest/' : '?guest=1';
const newEventHostRoute = () => {
  const route = hostHomeRoute();
  return `${route}${route.includes('?') ? '&' : '?'}create=1`;
};
const isAppleMobileDevice = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const serviceWorkerLocation = () => usesCleanEventUrls()
  ? { url: new URL('/sw.js?v=47', window.location.origin), scope: '/' }
  : { url: new URL('sw.js?v=47', document.baseURI), scope: './' };
const guestEventUrl = (eventId: string, publicPath?: string) =>
  new URL(`${guestHomeRoute()}${guestHomeRoute().includes('?') ? '&' : '?'}invite=${encodeURIComponent(
    normalizedPublicEventPath(publicPath) || eventId,
  )}`, window.location.origin).toString();
const manualInvitationMessage = (event: EventMenu, guestName?: string) =>
  `${guestName?.trim() ? `Hi ${guestName.trim()}, you’re` : 'You’re'} invited to ${event.title} on Nights. Open this link to sign in or create your account: ${guestEventUrl(event.id, event.publicPath)}`;
const openManualInvitation = async (event: EventMenu, phone: string, guestName?: string) => {
  const message = manualInvitationMessage(event, guestName);
  const digits = phoneDigits(phone);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile) {
    const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
    window.location.href = `sms:${digits}${separator}body=${encodeURIComponent(message)}`;
    return 'message';
  }
  await navigator.clipboard.writeText(message);
  return 'clipboard';
};
const pushSubscriptionKey = (eventId: string, actorUid: string) =>
  `gather-chat-push-v2:${eventId}:${actorUid}`;
const globalPushKey = (authUid: string) => `${GLOBAL_PUSH_KEY}:${authUid}`;
const notificationPromptKey = (authUid: string) => `${NOTIFICATION_PROMPT_KEY}:${authUid}`;
const accountDisplayName = (profile: Pick<AccountProfile, 'firstName' | 'lastName' | 'displayName'>) =>
  profile.displayName?.trim() || `${profile.firstName} ${profile.lastName}`.trim();
const accountNeedsEmailVerification = (user: AccountUser | null) => Boolean(
  user && user.providerIds.includes('password') && !user.emailVerified,
);
const accountCanManageEvent = (event: EventMenu, authUid?: string, email?: string) =>
  Boolean(authUid) && (
    event.ownerUid === authUid
    || Boolean(
      HOST_EMAIL
      && email?.trim().toLowerCase() === HOST_EMAIL
      && event.ownerUid === LEGACY_HOST_UID
    )
  );
const sessionCanManageEvent = (event: EventMenu, session: Pick<GuestSession, 'authUid' | 'email'>) =>
  accountCanManageEvent(event, session.authUid, session.email);
const ensureOwnedEventGuestAccess = async (event: EventMenu, session: GuestSession) => {
  if (!firebaseConfigured || !session.authUid || !sessionCanManageEvent(event, session)) return;
  const [{ getApp }, store] = await Promise.all([
    import('firebase/app'), import('firebase/firestore'),
  ]);
  const db = store.getFirestore(getApp());
  const invitationRef = store.doc(db, 'users', session.authUid, 'invitations', event.id);
  const profileRef = store.doc(db, 'events', event.id, 'guests', session.guestUid);
  const rsvpRef = store.doc(db, 'events', event.id, 'rsvps', session.guestUid);
  const participantRef = store.doc(db, 'events', event.id, 'expense-participants', session.guestUid);
  await store.runTransaction(db, async (transaction) => {
    const [invitation, profile, rsvp, participant] = await Promise.all([
      transaction.get(invitationRef), transaction.get(profileRef),
      transaction.get(rsvpRef), transaction.get(participantRef),
    ]);
    if (invitation.exists() && profile.exists() && rsvp.exists() && participant.exists()) return;
    const guestName = profile.data()?.guestName || session.guestName;
    if (!invitation.exists()) transaction.set(invitationRef, {
      eventId: event.id,
      eventTitle: event.title,
      hostUid: session.authUid,
      recipientUid: session.authUid,
      recipientGuestUid: session.guestUid,
      recipientEmail: session.email || '',
      recipientPhone: session.guestPhone,
      createdAt: store.serverTimestamp(),
      updatedAt: store.serverTimestamp(),
    });
    if (!profile.exists()) transaction.set(profileRef, {
      guestUid: session.guestUid,
      accountUid: session.authUid,
      guestName,
      guestPhone: session.guestPhone,
      createdAt: store.serverTimestamp(),
      updatedAt: store.serverTimestamp(),
    });
    if (!rsvp.exists()) transaction.set(rsvpRef, {
      guestUid: session.guestUid,
      guestName,
      guestPhone: session.guestPhone,
      status: 'yes',
      companions: [],
      activeOrderCount: 0,
      approvalStatus: 'approved',
      createdAt: store.serverTimestamp(),
      updatedAt: store.serverTimestamp(),
    });
    transaction.set(participantRef, {
      id: session.guestUid,
      accountUid: session.authUid,
      primaryGuestUid: session.guestUid,
      name: guestName,
      role: 'host',
      status: 'host',
      approvalStatus: 'approved',
      createdAt: participant.data()?.createdAt || store.serverTimestamp(),
      updatedAt: store.serverTimestamp(),
    });
  });
};
const normalizedAccountEmail = (value: string) => value.trim().toLowerCase();
const DEMO_EVENTS_KEY = 'gather-demo-events-v2';
const demoOrdersKey = (eventId: string) => `gather-demo-orders-v2:${eventId}`;
const DEMO_CHANNEL = 'gather-demo-sync';
const RECEIPTS_KEY = 'gather-order-receipts';
const RECEIPT_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const DESCRIPTION_EXAMPLE = 'Add a short, tempting description';
const readGuestSession = (): GuestSession | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_SESSION_KEY) || 'null') as GuestSession | null;
    return saved?.guestUid && saved.guestName && saved.guestPhone && (saved.authUid || saved.pinHash)
      ? saved
      : null;
  } catch {
    return null;
  }
};
const writeGuestSession = (session: GuestSession | null) => {
  if (session) localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(GUEST_SESSION_KEY);
};
const readPendingGuestEvent = (): PendingGuestEvent | null => {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_GUEST_EVENT_KEY) || 'null') as PendingGuestEvent | null;
    return pending?.route && Date.now() - pending.savedAt < 7 * 24 * 60 * 60 * 1000 ? pending : null;
  } catch {
    return null;
  }
};
const writePendingGuestEvent = (pending: PendingGuestEvent | null) => {
  if (pending) localStorage.setItem(PENDING_GUEST_EVENT_KEY, JSON.stringify(pending));
  else localStorage.removeItem(PENDING_GUEST_EVENT_KEY);
};
const readGuestEventCache = (session: GuestSession): GuestEventAccess[] => {
  try {
    const cached = JSON.parse(localStorage.getItem(GUEST_EVENTS_CACHE_KEY) || 'null') as {
      guestUid?: string;
      authUid?: string;
      pinHash?: string;
      events?: GuestEventAccess[];
    } | null;
    const sameIdentity = cached?.guestUid === session.guestUid
      && (session.authUid
        ? cached.authUid === session.authUid
        : cached.pinHash === session.pinHash);
    return sameIdentity
      ? cached.events || []
      : [];
  } catch {
    return [];
  }
};
const writeGuestEventCache = (session: GuestSession, events: GuestEventAccess[]) => {
  localStorage.setItem(GUEST_EVENTS_CACHE_KEY, JSON.stringify({
    guestUid: session.guestUid,
    authUid: session.authUid,
    pinHash: session.pinHash,
    events,
  }));
};
const guestEventMatchesPending = (access: GuestEventAccess, pending: PendingGuestEvent) =>
  Boolean(
    (pending.eventId && access.event.id === pending.eventId)
    || (pending.publicPath && automaticPublicEventPath(access.event) === pending.publicPath),
  );
const menuCategories = (menu: EventMenu) => [
  ...new Set(
    [
      ...(menu.categories || []),
      ...menu.items.map((item) => item.category),
    ].filter(Boolean),
  ),
];
const itemDescription = (item: MenuItem) =>
  item.description === DESCRIPTION_EXAMPLE
    ? ''
    : item.description || '';
const menuHasPublishedItems = (menu: EventMenu) =>
  menu.items.some((item) => item.name.trim());
const withoutUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => withoutUndefined(entry)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, withoutUndefined(entry)]),
    ) as T;
  }
  return value;
};
const unfinishedMenuItem = (item: MenuItem) =>
  !item.name.trim() && Boolean(
    item.description.trim()
    || item.imageUrl
    || item.imagePath
    || Object.keys(item.requirements || {}).length,
  );
const itemPrepMinutes = (item?: MenuItem) =>
  Math.max(1, item?.prepMinutes || 10);
const reservedServings = (orders: Order[], itemId: string) =>
  orders
    .filter((order) => order.status !== 'cancelled' && order.status !== 'rejected')
    .reduce((total, order) => total + (order.selections[itemId] || 0), 0);
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replace(' at ', ' · ');

function createOrderTasks(order: Order): OrderTask[] {
  let sequence = 0;
  return Object.entries(order.selections).flatMap(([itemId, quantity]) =>
    Array.from({ length: quantity }, (_, unit) => ({
      id: `${order.id}-${itemId}-${unit}`,
      itemId,
      status: 'waiting' as TaskStatus,
      sequence: sequence++,
    })),
  );
}

function resourceUsage(orders: Order[], menu: EventMenu) {
  const usage: Record<string, number> = Object.fromEntries(
    (menu.resources || []).map((resource) => [resource.id, 0]),
  );
  for (const order of orders)
    for (const task of order.tasks || [])
      if (task.status === 'preparing') {
        const item = menu.items.find((entry) => entry.id === task.itemId);
        for (const [resourceId, units] of Object.entries(
          item?.requirements || {},
        ))
          usage[resourceId] = (usage[resourceId] || 0) + units;
      }
  return usage;
}

function planResourceQueue(
  source: Order[],
  menu: EventMenu,
) {
  const next = source.map((order) => ({
    ...order,
    tasks: order.tasks?.map((task) => ({ ...task })),
  }));
  const usage = resourceUsage(next, menu);
  const reserved: Record<string, number> = {};
  const resources = Object.fromEntries(
    (menu.resources || []).map((resource) => [resource.id, resource]),
  );
  type QueueEntry = {
    order: Order;
    task: OrderTask;
    requirements: [string, number][];
  };
  const queued = next
    .flatMap<QueueEntry>((order) => {
      if (order.status !== 'new' && order.status !== 'preparing') return [];
      const tasks = order.tasks?.length ? order.tasks : createOrderTasks(order);
      return tasks
        .filter((task) => task.status === 'waiting')
        .map((task) => {
          const item = menu.items.find((entry) => entry.id === task.itemId);
          return {
            order,
            task,
            requirements: Object.entries(item?.requirements || {}).filter(
              ([, units]) => units > 0,
            ),
          };
        });
    })
    .sort(
      (a, b) =>
        a.order.createdAt - b.order.createdAt ||
        a.task.sequence - b.task.sequence,
    );
  const availableTaskIds = new Set<string>();
  for (const entry of queued) {
    const { requirements } = entry;
    const possible = requirements.every(
      ([resourceId, units]) =>
        resources[resourceId] && units <= resources[resourceId].capacity,
    );
    const canStart =
      possible &&
      requirements.every(
        ([resourceId, units]) =>
          (usage[resourceId] || 0) + (reserved[resourceId] || 0) + units <=
          resources[resourceId].capacity,
      );
    if (!canStart && requirements.length) {
      if (possible)
        for (const [resourceId, units] of requirements) {
          const free = Math.max(
            0,
            resources[resourceId].capacity -
              (usage[resourceId] || 0) -
              (reserved[resourceId] || 0),
          );
          reserved[resourceId] =
            (reserved[resourceId] || 0) + Math.min(units, free);
        }
      continue;
    }
    availableTaskIds.add(entry.task.id);
    for (const [resourceId, units] of requirements)
      reserved[resourceId] = (reserved[resourceId] || 0) + units;
  }
  return { orders: next, availableTaskIds };
}

type DemoUpdate =
  | { type: 'orders'; eventId: string; value: Order[] }
  | { type: 'rsvps'; eventId: string; value: Rsvp[] }
  | { type: 'profile'; eventId: string; value: GuestProfile | null }
  | { type: 'events'; value: EventMenu[] };

function shareDemoUpdate(update: DemoUpdate) {
  const key =
    update.type === 'orders' ? demoOrdersKey(update.eventId)
      : update.type === 'rsvps' ? `gather-demo-rsvps:${update.eventId}`
        : update.type === 'profile' ? `gather-demo-profile:${update.eventId}` : DEMO_EVENTS_KEY;
  const value = update.value;
  localStorage.setItem(key, JSON.stringify(value));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(DEMO_CHANNEL);
    channel.postMessage(update);
    channel.close();
  }
}

function readReceipts(eventId: string): Receipt[] {
  try {
    const receipts = JSON.parse(
      localStorage.getItem(RECEIPTS_KEY) || '{}',
    ) as Record<string, Receipt | Receipt[]>;
    // Older versions saved one receipt per event. Preserve it while migrating
    // to a list, so existing guests do not lose their tracking link.
    const saved = receipts[eventId];
    const active = (Array.isArray(saved) ? saved : saved ? [saved] : []).filter(
      (receipt) => receipt.expiresAt > Date.now(),
    );
    if (active.length !== (Array.isArray(saved) ? saved.length : saved ? 1 : 0)) {
      receipts[eventId] = active;
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
    }
    return active;
  } catch {
    return [];
  }
}

function saveReceipt(eventId: string, orderId: string, createdAt: number) {
  const receipts = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || '{}') as Record<
    string,
    Receipt | Receipt[]
  >;
  const receipt = {
    eventId,
    orderId,
    createdAt,
    expiresAt: createdAt + RECEIPT_LIFETIME,
  };
  const prior = receipts[eventId];
  const eventReceipts = Array.isArray(prior) ? prior : prior ? [prior] : [];
  receipts[eventId] = [...eventReceipts.filter((entry) => entry.orderId !== orderId), receipt];
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  return receipt;
}

const guestNameKey = (name: string) => name.trim().toLocaleLowerCase();
const guestDisplayName = (order: Order) => order.guestLabel || order.guestName;
async function sha256Text(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function guestNameIndexId(name: string) {
  return sha256Text(guestNameKey(name));
}

function vapidKeyBytes(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function guestPinHash(guestUid: string, pin: string) {
  return guestNameIndexId(`${guestUid}:${pin}`);
}

async function resizeImageFile(file: Blob, longestEdge: number, quality: number) {
  return new Promise<string>((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      try {
        const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
        if (!longestSide) throw new Error('Image has no readable dimensions');
        const scale = Math.min(1, longestEdge / longestSide);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image canvas unavailable');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        reject(new Error('Could not prepare that image'));
      } finally {
        URL.revokeObjectURL(source);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('Could not read image'));
    };
    image.src = source;
  });
}

const heicFile = (file: File) =>
  /\.(heic|heif)$/i.test(file.name)
  || ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(file.type.toLowerCase());

async function browserReadableImage(file: File): Promise<File> {
  if (!heicFile(file)) return file;
  if (typeof window === 'undefined')
    throw new Error('HEIC conversion is only available in the browser');
  try {
    const { default: convert } = await import('heic2any');
    if (typeof convert !== 'function') throw new Error('HEIC converter unavailable');
    const converted = await convert({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const firstFrame = Array.isArray(converted) ? converted[0] : converted;
    if (!(firstFrame instanceof Blob)) throw new Error('No usable image found');
    return new File(
      [firstFrame],
      `${file.name.replace(/\.(heic|heif)$/i, '') || 'image'}.jpg`,
      { type: 'image/jpeg', lastModified: file.lastModified },
    );
  } catch {
    throw new Error('Could not convert that HEIC or HEIF photo');
  }
}

async function compressImageForDocument(file: File, maxDataUrlLength: number) {
  const readable = await browserReadableImage(file);
  const attempts = [
    [2000, 0.82],
    [1800, 0.76],
    [1600, 0.7],
    [1400, 0.64],
    [1200, 0.58],
    [1000, 0.52],
    [840, 0.48],
    [720, 0.44],
  ] as const;
  for (const [longestEdge, quality] of attempts) {
    const imageUrl = await resizeImageFile(readable, longestEdge, quality);
    if (imageUrl.length <= maxDataUrlLength) return imageUrl;
  }
  throw new Error('This photo could not be compressed safely. Try a cropped copy');
}

export default function Home() {
  const [mode, setMode] = useState<'guest' | 'host'>('guest');
  const [menu, setMenu] = useState<EventMenu>(firebaseConfigured ? emptyEventMenu : demoMenu);
  const [events, setEvents] = useState<EventMenu[]>(firebaseConfigured ? [] : [demoMenu]);
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [eventIncomingCounts, setEventIncomingCounts] = useState<Record<string, number>>({});
  const [eventNotificationCounts, setEventNotificationCounts] = useState<Record<string, number>>({});
  const [eventActivities, setEventActivities] = useState<EventActivity[]>([]);
  const [activityCenterOpen, setActivityCenterOpen] = useState(false);
  const [eventReady, setEventReady] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [guestName, setGuestName] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(false);
  const [hostUser, setHostUser] = useState<string | null>(null);
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [accountAuthReady, setAccountAuthReady] = useState(!firebaseConfigured);
  const [accountAuthBusy, setAccountAuthBusy] = useState(false);
  const [accountAuthMode, setAccountAuthMode] = useState<AccountAuthMode>('signin');
  const [accountRecoverySentTo, setAccountRecoverySentTo] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountFirstName, setAccountFirstName] = useState('');
  const [accountLastName, setAccountLastName] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileEditorBusy, setProfileEditorBusy] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [accountMoney, setAccountMoney] = useState<AccountMoney>(emptyAccountMoney);
  const [moneyDetailsOpen, setMoneyDetailsOpen] = useState<'owed' | 'owes' | null>(null);
  const [moneyDetailsReturnTo, setMoneyDetailsReturnTo] = useState<'menu' | 'editor' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [expenseEditRequest, setExpenseEditRequest] = useState<{ id: string; nonce: number } | null>(null);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [notificationsDefaultEnabled, setNotificationsDefaultEnabled] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [, setReceipts] = useState<Receipt[]>([]);
  const [rememberedOrder, setRememberedOrder] = useState<Order | null>(null);
  const [rememberedOrders, setRememberedOrders] = useState<Order[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [myRsvp, setMyRsvp] = useState<Rsvp | null>(null);
  const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);
  const [editingGuestProfile, setEditingGuestProfile] = useState(false);
  const [changingGuestPhone, setChangingGuestPhone] = useState(false);
  const [rsvpPanelOpen, setRsvpPanelOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [pushNotificationState, setPushNotificationState] =
    useState<PushNotificationState>('disabled');
  const [pushNotificationBusy, setPushNotificationBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [rsvpChoice, setRsvpChoice] = useState<Rsvp['status']>('yes');
  const [rsvpCompanionNames, setRsvpCompanionNames] = useState<string[]>([]);
  const [rsvpCompanionPhones, setRsvpCompanionPhones] = useState<string[]>([]);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [guestUid, setGuestUid] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'created' | 'updated'>(
    'created',
  );
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<EventMenu | null>(null);
  const [backgroundEditor, setBackgroundEditor] = useState<BackgroundEditorState | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isNativeIOSApp, setIsNativeIOSApp] = useState(false);
  const [appEnvironmentReady, setAppEnvironmentReady] = useState(false);
  const [hostPreview, setHostPreview] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [guestPin, setGuestPin] = useState('');
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [guestEvents, setGuestEvents] = useState<GuestEventAccess[]>([]);
  const [guestEventsBusy, setGuestEventsBusy] = useState(false);
  const [guestEventPickerOpen, setGuestEventPickerOpen] = useState(false);
  const [hostContacts, setHostContacts] = useState<HostContact[]>([]);
  const [hostInvitations, setHostInvitations] = useState<EventInvitation[]>([]);
  const [pendingHostInvitations, setPendingHostInvitations] = useState<EventInvitation[]>([]);
  const [pendingGuestEvent, setPendingGuestEvent] = useState<PendingGuestEvent | null>(null);
  const pendingEnrollmentRef = useRef('');
  const ensuredHostMembershipsRef = useRef(new Set<string>());
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    publicPathCategory: 'meal',
    publicPathEvent: '',
    address: '',
    maxAdditionalGuests: 0,
    requireGuestApproval: false,
    eventType: 'meal' as EventType,
    customEventType: '',
    backgroundImageUrl: '',
    backgroundFocus: centerBackgroundFocus(),
    backgroundZoom: 1,
    colorPalette: '' as EventPalette | '',
    welcome: 'Choose what you’d like and send your order to the host.',
  });
  const addEventActivity = useCallback((activity: Omit<EventActivity, 'read'>) => {
    if (!accountUser) return;
    const marker = eventActivityMarkerKey(accountUser.uid, activity.id);
    if (localStorage.getItem(marker)) return;
    localStorage.setItem(marker, '1');
    setEventActivities((current) => {
      const next = [{ ...activity, read: false }, ...current]
        .filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index)
        .slice(0, 250);
      localStorage.setItem(eventActivityKey(accountUser.uid), JSON.stringify(next));
      return next;
    });
  }, [accountUser]);

  useEffect(() => {
    if (!settingsOpen && !moneyDetailsOpen && !profileEditorOpen) return;
    const appScroller = document.querySelector<HTMLElement>('.app-root.native-ios-app');
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousAppOverflow = appScroller?.style.overflow || '';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (appScroller) appScroller.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      if (appScroller) appScroller.style.overflow = previousAppOverflow;
    };
  }, [moneyDetailsOpen, profileEditorOpen, settingsOpen]);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let stopProfile = () => {};
    let stopAuth = () => {};
    void (async () => {
      const [appModule, authModule, store] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = appModule.getApps().some((candidate) => candidate.name === '[DEFAULT]')
        ? appModule.getApp()
        : appModule.initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          });
      const auth = authModule.getAuth(app);
      await authModule.setPersistence(auth, authModule.browserLocalPersistence);
      void authModule.getRedirectResult(auth).catch((error: { code?: string }) => {
        setToast(error.code === 'auth/operation-not-allowed'
          ? 'That sign-in provider still needs to be enabled in Firebase Authentication.'
          : 'Sign-in could not be completed. Please try again.');
      });
      const db = store.getFirestore(app);
      stopAuth = authModule.onAuthStateChanged(auth, (user) => {
        stopProfile();
        stopProfile = () => {};
        if (!user) {
          setAccountUser(null);
          setAccountProfile(null);
          setHostUser(null);
          writeGuestSession(null);
          setGuestSession(null);
          setGuestEvents([]);
          setAccountAuthReady(true);
          return;
        }
        setAccountUser({
          uid: user.uid,
          email: user.email || '',
          emailVerified: user.emailVerified,
          providerIds: user.providerData.map((provider) => provider.providerId),
        });
        stopProfile = store.onSnapshot(store.doc(db, 'users', user.uid), (snapshot) => {
          const data = snapshot.data();
          const profile = data ? {
            ...data,
            uid: user.uid,
            email: data.email || user.email || '',
            mutedEventIds: Array.isArray(data.mutedEventIds) ? data.mutedEventIds : [],
            membershipTier: data.membershipTier || 'free',
            membershipStatus: data.membershipStatus || 'active',
            emailVerified: data.emailVerified,
            verificationExpiresAt: data.verificationExpiresAt?.toMillis?.() ?? null,
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: data.updatedAt?.toMillis?.(),
          } as AccountProfile : null;
          setAccountProfile(profile);
          const verificationRequired = user.providerData.some((provider) => provider.providerId === 'password')
            && !user.emailVerified;
          setHostUser(profile && !verificationRequired ? user.uid : null);
          if (profile) void (async () => {
            const email = normalizedAccountEmail(profile.email || user.email || '');
            if (!email) return;
            const directory = {
              uid: user.uid,
              email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              displayName: accountDisplayName(profile),
              phone: profile.phone,
              guestUid: profile.guestUid,
              updatedAt: store.serverTimestamp(),
            };
            await Promise.all([
              store.setDoc(store.doc(db, 'account-directory', user.uid), directory, { merge: true }),
              guestNameIndexId(email).then((emailHash) => store.setDoc(
                store.doc(db, 'account-emails', emailHash),
                {
                  accountUid: user.uid,
                  email,
                  guestUid: profile.guestUid,
                  updatedAt: store.serverTimestamp(),
                },
                { merge: true },
              )),
            ]);
          })().catch(() => undefined);
          if (!profile) {
            const displayParts = (user.displayName || '').trim().split(/\s+/);
            setAccountFirstName(displayParts[0] || '');
            setAccountLastName(displayParts.slice(1).join(' '));
            setAccountEmail(user.email || '');
            setAccountAuthMode('profile');
          }
          setAccountAuthReady(true);
        }, () => {
          setAccountProfile(null);
          setHostUser(null);
          setAccountAuthReady(true);
        });
      });
    })().catch(() => setAccountAuthReady(true));
    return () => {
      stopAuth();
      stopProfile();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'host' || !hostUser || !accountProfile) return;
    const url = new URL(window.location.href);
    const shouldCreate = url.searchParams.get('create') === '1'
      || sessionStorage.getItem(CREATE_EVENT_INTENT_KEY) === '1';
    if (!shouldCreate) return;
    sessionStorage.removeItem(CREATE_EVENT_INTENT_KEY);
    url.searchParams.delete('create');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    queueMicrotask(() => setCreatingEvent(true));
  }, [accountProfile, hostUser, mode]);

  const loadGuestEvents = useCallback(async (session: GuestSession) => {
    setGuestEventsBusy(true);
    try {
      let matches: GuestEventAccess[] = [];
      if (firebaseConfigured) {
        const [appModule, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        const app = appModule.getApps().some((candidate) => candidate.name === '[DEFAULT]')
          ? appModule.getApp()
          : appModule.initializeApp({
              apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
              authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
              projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
              appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        });
        const db = store.getFirestore(app);
        const [eventSnapshot, invitationSnapshot] = await Promise.all([
          store.getDocs(store.collection(db, 'events')),
          session.authUid
            ? store.getDocs(store.collection(db, 'users', session.authUid, 'invitations'))
            : Promise.resolve(null),
        ]);
        const invitations = new Map<string, EventInvitation>(
          (invitationSnapshot?.docs || []).map((document) => {
            const data = document.data();
            return [document.id, {
              ...data,
              eventId: document.id,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.(),
            } as EventInvitation];
          }),
        );
        const candidates = await Promise.all(eventSnapshot.docs.map(async (eventDocument) => {
          const event = { id: eventDocument.id, ...eventDocument.data() } as EventMenu;
          const isOwner = sessionCanManageEvent(event, session);
          if (isOwner) await ensureOwnedEventGuestAccess(event, session).catch(() => undefined);
          const invitation = invitations.get(event.id) || (isOwner ? {
            eventId: event.id,
            eventTitle: event.title,
            hostUid: session.authUid,
            recipientUid: session.authUid,
            recipientGuestUid: session.guestUid,
            recipientEmail: '',
            recipientPhone: session.guestPhone,
            createdAt: Date.now(),
          } as EventInvitation : undefined);
          const [profileDocument, rsvpDocument] = await Promise.all([
            store.getDoc(store.doc(db, 'events', event.id, 'guests', session.guestUid)),
            store.getDoc(store.doc(db, 'events', event.id, 'rsvps', session.guestUid)),
          ]);
          const profileData = profileDocument.data();
          if (
            (!profileData && !invitation && !isOwner)
            || (!session.authUid && profileData?.pinHash !== session.pinHash)
            || (profileData?.accountUid && session.authUid && profileData.accountUid !== session.authUid)
          ) return null;
          const rsvpData = rsvpDocument.data();
          if (
            session.authUid
            && profileData
            && (
              profileData.guestName !== session.guestName
              || profileData.guestPhone !== session.guestPhone
              || rsvpData?.guestName !== session.guestName
              || rsvpData?.guestPhone !== session.guestPhone
            )
          ) {
            try {
              const nextNameHash = await guestNameIndexId(session.guestName);
              const nextPhoneHash = await guestNameIndexId(session.guestPhone);
              await store.runTransaction(db, async (transaction) => {
                const profileRef = store.doc(db, 'events', event.id, 'guests', session.guestUid);
                const rsvpRef = store.doc(db, 'events', event.id, 'rsvps', session.guestUid);
                const savedProfile = await transaction.get(profileRef);
                const savedRsvp = await transaction.get(rsvpRef);
                if (!savedProfile.exists()) return;
                const oldName = savedProfile.data().guestName || '';
                const oldPhone = savedProfile.data().guestPhone || '';
                const nextNameRef = store.doc(db, 'events', event.id, 'guest-names', nextNameHash);
                const nextPhoneRef = store.doc(db, 'events', event.id, 'guest-phones', nextPhoneHash);
                const oldNameRef = oldName && guestNameKey(oldName) !== guestNameKey(session.guestName)
                  ? store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(oldName))
                  : null;
                const oldPhoneRef = oldPhone && oldPhone !== session.guestPhone
                  ? store.doc(db, 'events', event.id, 'guest-phones', await guestNameIndexId(oldPhone))
                  : null;
                const [nextNameClaim, nextPhoneClaim, oldNameClaim, oldPhoneClaim] = await Promise.all([
                  transaction.get(nextNameRef), transaction.get(nextPhoneRef),
                  oldNameRef ? transaction.get(oldNameRef) : Promise.resolve(null),
                  oldPhoneRef ? transaction.get(oldPhoneRef) : Promise.resolve(null),
                ]);
                if (nextNameClaim.exists() && nextNameClaim.data().guestUid !== session.guestUid)
                  throw new Error('event-name-taken');
                if (nextPhoneClaim.exists() && nextPhoneClaim.data().guestUid !== session.guestUid)
                  throw new Error('event-phone-taken');
                if (!nextNameClaim.exists()) transaction.set(nextNameRef, {
                  guestUid: session.guestUid,
                  guestName: session.guestName,
                  createdAt: store.serverTimestamp(),
                });
                if (!nextPhoneClaim.exists()) transaction.set(nextPhoneRef, {
                  guestUid: session.guestUid,
                  guestPhone: session.guestPhone,
                  createdAt: store.serverTimestamp(),
                });
                if (oldNameRef && oldNameClaim?.data()?.guestUid === session.guestUid)
                  transaction.delete(oldNameRef);
                if (oldPhoneRef && oldPhoneClaim?.data()?.guestUid === session.guestUid)
                  transaction.delete(oldPhoneRef);
                transaction.update(profileRef, {
                  guestName: session.guestName,
                  guestPhone: session.guestPhone,
                  updatedAt: store.serverTimestamp(),
                });
                if (savedRsvp.exists()) transaction.update(rsvpRef, {
                  guestName: session.guestName,
                  guestPhone: session.guestPhone,
                  approvalStatus: savedRsvp.data().approvalStatus || (
                    !event.requireGuestApproval
                    || savedRsvp.data().status !== 'yes'
                    || Boolean(invitation)
                    || isOwner
                      ? 'approved'
                      : 'pending'
                  ),
                  updatedAt: store.serverTimestamp(),
                });
              });
              profileData.guestName = session.guestName;
              profileData.guestPhone = session.guestPhone;
              if (rsvpData) {
                rsvpData.guestName = session.guestName;
                rsvpData.guestPhone = session.guestPhone;
              }
            } catch {
              // Keep the event usable with its existing identity if a duplicate claim blocks reconciliation.
            }
          }
          return {
            event,
            hosted: isOwner,
            profile: profileData ? {
              ...profileData,
              guestUid: session.guestUid,
              createdAt: profileData.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: profileData.updatedAt?.toMillis?.(),
            } as GuestProfile : {
              guestUid: session.guestUid,
              accountUid: session.authUid,
              guestName: session.guestName,
              guestPhone: session.guestPhone,
              createdAt: invitation?.createdAt || Date.now(),
            },
            rsvp: rsvpData ? {
              ...rsvpData,
              guestUid: session.guestUid,
              activeOrderCount: rsvpData.activeOrderCount || 0,
              createdAt: rsvpData.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: rsvpData.updatedAt?.toMillis?.(),
            } as Rsvp : isOwner ? {
              guestUid: session.guestUid,
              guestName: session.guestName,
              guestPhone: session.guestPhone,
              status: 'yes',
              companions: [],
              activeOrderCount: 0,
              approvalStatus: 'approved',
              createdAt: Date.now(),
            } : null,
            ...(invitation ? { invitation } : {}),
          } satisfies GuestEventAccess;
        }));
        matches = candidates.filter(Boolean) as GuestEventAccess[];
      } else {
        const previewEvents = JSON.parse(localStorage.getItem(DEMO_EVENTS_KEY) || '[]') as EventMenu[];
        matches = previewEvents.flatMap((event) => {
          const profile = JSON.parse(
            localStorage.getItem(`gather-demo-profile:${event.id}`) || 'null',
          ) as GuestProfile | null;
          if (
            !profile
            || profile.guestUid !== session.guestUid
            || (!session.authUid && profile.pinHash !== session.pinHash)
          )
            return [];
          const eventRsvps = JSON.parse(
            localStorage.getItem(`gather-demo-rsvps:${event.id}`) || '[]',
          ) as Rsvp[];
          return [{
            event,
            hosted: false,
            profile,
            rsvp: eventRsvps.find((entry) => entry.guestUid === session.guestUid) || null,
          }];
        });
      }
      matches.sort((left, right) => {
        const leftTime = Date.parse(left.event.startsAt || '') || Number.MAX_SAFE_INTEGER;
        const rightTime = Date.parse(right.event.startsAt || '') || Number.MAX_SAFE_INTEGER;
        const now = Date.now();
        const leftUpcoming = leftTime >= now;
        const rightUpcoming = rightTime >= now;
        if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
        return (leftUpcoming ? leftTime - rightTime : rightTime - leftTime)
          || left.event.title.localeCompare(right.event.title);
      });
      setGuestEvents(matches);
      writeGuestEventCache(session, matches);
      return matches;
    } catch {
      setToast('Could not load your events. Check your connection and try again.');
      return [];
    } finally {
      setGuestEventsBusy(false);
    }
  }, []);

  const enrollPendingGuestEvent = useCallback(async (
    session: GuestSession,
    pending: PendingGuestEvent,
    knownEvents: GuestEventAccess[],
  ) => {
    const existing = knownEvents.find((access) => guestEventMatchesPending(access, pending));
    if (existing) return existing;
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'), import('firebase/firestore'),
        ]);
        const db = store.getFirestore(getApp());
        let eventDocument = pending.eventId
          ? await store.getDoc(store.doc(db, 'events', pending.eventId))
          : null;
        if ((!eventDocument || !eventDocument.exists()) && pending.publicPath) {
          const exact = await store.getDocs(store.query(
            store.collection(db, 'events'),
            store.where('publicPath', '==', pending.publicPath),
            store.limit(1),
          ));
          eventDocument = exact.docs[0] || null;
          if (!eventDocument) {
            const allEvents = await store.getDocs(store.collection(db, 'events'));
            eventDocument = allEvents.docs.find((candidate) => {
              const event = { id: candidate.id, ...candidate.data() } as EventMenu;
              return automaticPublicEventPath(event) === pending.publicPath;
            }) || null;
          }
        }
        if (!eventDocument?.exists()) throw new Error('event-not-found');
        const event = { id: eventDocument.id, ...eventDocument.data() } as EventMenu;
        const profileRef = store.doc(db, 'events', event.id, 'guests', session.guestUid);
        const rsvpRef = store.doc(db, 'events', event.id, 'rsvps', session.guestUid);
        const nameRef = store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(session.guestName));
        const phoneRef = store.doc(db, 'events', event.id, 'guest-phones', session.guestUid);
        await store.runTransaction(db, async (transaction) => {
          const [profileDocument, nameClaim, phoneClaim] = await Promise.all([
            transaction.get(profileRef),
            transaction.get(nameRef),
            transaction.get(phoneRef),
          ]);
          if (profileDocument.exists()) {
            if (!session.authUid && profileDocument.data().pinHash !== session.pinHash)
              throw new Error('invalid-pin');
            if (
              session.authUid
              && profileDocument.data().accountUid
              && profileDocument.data().accountUid !== session.authUid
            ) throw new Error('account-mismatch');
            if (!session.authUid && guestNameKey(profileDocument.data().guestName) !== guestNameKey(session.guestName))
              throw new Error('name-mismatch');
            if (session.authUid && profileDocument.data().accountUid !== session.authUid)
              transaction.update(profileRef, {
                accountUid: session.authUid,
                updatedAt: store.serverTimestamp(),
              });
            return;
          }
          if (nameClaim.exists() && nameClaim.data().guestUid !== session.guestUid)
            throw new Error('name-taken');
          if (phoneClaim.exists() && phoneClaim.data().guestUid !== session.guestUid)
            throw new Error('phone-taken');
          if (!nameClaim.exists()) transaction.set(nameRef, {
            guestUid: session.guestUid,
            guestName: session.guestName,
            createdAt: store.serverTimestamp(),
          });
          if (!phoneClaim.exists()) transaction.set(phoneRef, {
            guestUid: session.guestUid,
            guestPhone: session.guestPhone,
            createdAt: store.serverTimestamp(),
          });
          transaction.set(profileRef, {
            guestUid: session.guestUid,
            ...(session.authUid ? { accountUid: session.authUid } : {}),
            guestName: session.guestName,
            guestPhone: session.guestPhone,
            ...(session.pinHash ? { pinHash: session.pinHash } : {}),
            createdAt: store.serverTimestamp(),
            updatedAt: store.serverTimestamp(),
          });
        });
        const [profileDocument, rsvpDocument] = await Promise.all([
          store.getDoc(profileRef), store.getDoc(rsvpRef),
        ]);
        const profileData = profileDocument.data();
        if (!profileData) throw new Error('profile-not-found');
        const rsvpData = rsvpDocument.data();
        const access: GuestEventAccess = {
          event,
          hosted: sessionCanManageEvent(event, session),
          profile: {
            ...profileData,
            guestUid: session.guestUid,
            createdAt: profileData.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: profileData.updatedAt?.toMillis?.(),
          } as GuestProfile,
          rsvp: rsvpData ? {
            ...rsvpData,
            guestUid: session.guestUid,
            activeOrderCount: rsvpData.activeOrderCount || 0,
            createdAt: rsvpData.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: rsvpData.updatedAt?.toMillis?.(),
          } as Rsvp : null,
        };
        const nextEvents = [...knownEvents.filter((entry) => entry.event.id !== event.id), access];
        setGuestEvents(nextEvents);
        writeGuestEventCache(session, nextEvents);
        return access;
      }
      const previewEvents = JSON.parse(localStorage.getItem(DEMO_EVENTS_KEY) || '[]') as EventMenu[];
      const event = previewEvents.find((candidate) =>
        (pending.eventId && candidate.id === pending.eventId)
        || (pending.publicPath && automaticPublicEventPath(candidate) === pending.publicPath));
      if (!event) throw new Error('event-not-found');
      const profile: GuestProfile = {
        ...session,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem(`gather-demo-profile:${event.id}`, JSON.stringify(profile));
      const access: GuestEventAccess = { event, hosted: false, profile, rsvp: null };
      const nextEvents = [...knownEvents.filter((entry) => entry.event.id !== event.id), access];
      setGuestEvents(nextEvents);
      writeGuestEventCache(session, nextEvents);
      return access;
    } catch (error) {
      const reason = (error as Error).message;
      setToast(reason === 'name-taken'
        ? 'That Display Name is already used for this event. Choose another Display Name.'
        : reason === 'name-mismatch'
          ? 'That Display Name does not match this guest profile.'
          : reason === 'invalid-pin'
            ? 'That PIN does not match the guest profile for this invitation.'
            : 'This invitation could not be added. Ask the host for a current link.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!accountUser || !accountProfile) return;
    const session: GuestSession = {
      authUid: accountUser.uid,
      email: accountProfile.email,
      guestUid: accountProfile.guestUid,
      guestName: accountDisplayName(accountProfile),
      guestPhone: accountProfile.phone,
    };
    writeGuestSession(session);
    queueMicrotask(() => {
      setGuestSession(session);
      setGuestName(session.guestName);
      setPhoneNumber(formatPhone(session.guestPhone));
      void loadGuestEvents(session);
    });
  }, [accountProfile, accountUser, loadGuestEvents]);

  useEffect(() => {
    if (!firebaseConfigured || !accountUser || !accountProfile) return;
    let unsubscribe = () => {};
    const notifiedPrefix = `nights-invitation-notified:${accountUser.uid}:`;
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      const session: GuestSession = {
        authUid: accountUser.uid,
        email: accountProfile.email,
        guestUid: accountProfile.guestUid,
        guestName: accountDisplayName(accountProfile),
        guestPhone: accountProfile.phone,
      };
      unsubscribe = store.onSnapshot(
        store.collection(db, 'users', accountUser.uid, 'invitations'),
        (snapshot) => {
          void loadGuestEvents(session);
          snapshot.docChanges().filter((change) => change.type === 'added').forEach((change) => {
            const invitationData = change.doc.data();
            const invitation = invitationData as EventInvitation;
            const marker = `${notifiedPrefix}${change.doc.id}:${invitationData.updatedAt?.toMillis?.() || invitation.updatedAt || ''}`;
            if (localStorage.getItem(marker)) return;
            localStorage.setItem(marker, '1');
            const title = invitation.eventTitle || 'a new event';
            setToast(`You were invited to ${title}`);
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && 'serviceWorker' in navigator)
              void navigator.serviceWorker.ready.then((registration) => registration.showNotification('You’re invited', {
                body: `${title} is now waiting on your Nights home page.`,
                icon: '/gathering/icons/nights-app-icon-192.png',
                badge: '/gathering/icons/nights-favicon-48.png',
                data: { url: guestHomeRoute() },
              })).catch(() => undefined);
          });
        },
      );
    })();
    return () => unsubscribe();
  }, [accountProfile, accountUser, loadGuestEvents]);

  useEffect(() => {
    if (!accountUser) {
      queueMicrotask(() => setEventActivities([]));
      return;
    }
    queueMicrotask(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(eventActivityKey(accountUser.uid)) || '[]') as EventActivity[];
        setEventActivities(saved.filter((activity) => activity?.eventId && activity?.title));
      } catch {
        setEventActivities([]);
      }
    });
  }, [accountUser]);

  useEffect(() => {
    if (!accountUser) return;
    guestEvents.forEach((access) => {
      if (!access.invitation || access.rsvp || access.hosted) return;
      addEventActivity({
        id: `invitation:${access.event.id}:${access.invitation.createdAt}`,
        eventId: access.event.id,
        kind: 'invitation',
        title: 'New invitation',
        detail: `You were invited to ${access.event.title}.`,
        createdAt: access.invitation.createdAt || Date.now(),
      });
    });
  }, [accountUser, addEventActivity, guestEvents]);

  const guestEventIdentity = guestEvents.map((access) => access.event.id).sort().join('|');
  useEffect(() => {
    if (accountUser && accountProfile && guestEventIdentity) return;
    queueMicrotask(() => setAccountMoney(emptyAccountMoney()));
  }, [accountProfile, accountUser, guestEventIdentity]);

  useEffect(() => {
    if (!firebaseConfigured || !accountUser || !accountProfile || !guestEventIdentity) return;
    const stops: Array<() => void> = [];
    const moneyByEvent = new Map<string, { owedDetails: MoneyDetail[]; owesDetails: MoneyDetail[] }>();
    const updateAccountBalance = () => {
      const owedDetails = groupMoneyDetails([...moneyByEvent.values()].flatMap((eventMoney) => eventMoney.owedDetails));
      const owesDetails = groupMoneyDetails([...moneyByEvent.values()].flatMap((eventMoney) => eventMoney.owesDetails));
      const owed = owedDetails.reduce((sum, detail) => sum + detail.amountCents, 0);
      const owes = owesDetails.reduce((sum, detail) => sum + detail.amountCents, 0);
      setAccountMoney({ balance: owed - owes, owed, owes, owedDetails, owesDetails });
    };
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      guestEvents.forEach((access) => {
        stops.push(store.onSnapshot(store.doc(db, 'events', access.event.id), (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          const nextEvent = {
            ...data,
            id: snapshot.id,
            updatedAt: data.updatedAt?.toMillis?.() ?? data.updatedAt,
          } as EventMenu;
          setGuestEvents((current) => current.map((entry) => {
            if (entry.event.id !== nextEvent.id) return entry;
            if ((entry.event.startsAt || entry.event.date) !== (nextEvent.startsAt || nextEvent.date))
              addEventActivity({
                id: `schedule:${nextEvent.id}:${nextEvent.startsAt || nextEvent.date}`,
                eventId: nextEvent.id,
                kind: 'schedule',
                title: 'Date or time changed',
                detail: `${nextEvent.title} is now scheduled for ${nextEvent.date}.`,
                createdAt: Date.now(),
              });
            if ((entry.event.address || '') !== (nextEvent.address || ''))
              addEventActivity({
                id: `location:${nextEvent.id}:${nextEvent.address || 'removed'}`,
                eventId: nextEvent.id,
                kind: 'location',
                title: 'Location changed',
                detail: nextEvent.address
                  ? `${nextEvent.title} will be at ${nextEvent.address}.`
                  : `The location for ${nextEvent.title} was removed.`,
                createdAt: Date.now(),
              });
            return { ...entry, event: nextEvent };
          }));
        }));
        stops.push(store.onSnapshot(
          store.doc(db, 'events', access.event.id, 'rsvps', accountProfile.guestUid),
          (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            const nextRsvp = {
              ...data,
              guestUid: accountProfile.guestUid,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
            } as Rsvp;
            setGuestEvents((current) => current.map((entry) => {
              if (entry.event.id !== access.event.id) return entry;
              const previousApproval = entry.rsvp ? approvalStatus(entry.rsvp) : '';
              const nextApproval = approvalStatus(nextRsvp);
              if (previousApproval && previousApproval !== nextApproval)
                addEventActivity({
                  id: `rsvp-approval:${access.event.id}:${nextApproval}:${nextRsvp.updatedAt}`,
                  eventId: access.event.id,
                  kind: 'event',
                  title: nextApproval === 'approved' ? 'RSVP approved' : nextApproval === 'declined' ? 'RSVP not approved' : 'RSVP awaiting approval',
                  detail: `${access.event.title}: your Going response is ${nextApproval}.`,
                  createdAt: nextRsvp.updatedAt || Date.now(),
                });
              return { ...entry, rsvp: nextRsvp };
            }));
          },
          () => undefined,
        ));
        stops.push(store.onSnapshot(
          store.query(store.collection(db, 'events', access.event.id, 'orders'), store.where('guestUid', '==', accountProfile.guestUid)),
          (snapshot) => snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') return;
            const data = change.doc.data();
            const status = data.status as OrderStatus;
            const readyItems = (data.tasks as OrderTask[] | undefined)?.filter((task) => task.status === 'ready').length || 0;
            if (!['served', 'rejected', 'cancelled'].includes(status) && readyItems === 0) return;
            const updatedAt = data.updatedAt?.toMillis?.() ?? data.updatedAt
              ?? data.readyAt?.toMillis?.() ?? data.readyAt ?? Date.now();
            addEventActivity({
              id: `order:${access.event.id}:${change.doc.id}:${status}:${readyItems}:${updatedAt}`,
              eventId: access.event.id,
              kind: 'event',
              title: readyItems > 0 ? 'Order item ready' : status === 'served' ? 'Order completed' : status === 'rejected' ? 'Order rejected' : 'Order cancelled',
              detail: readyItems > 0 ? `${readyItems} item${readyItems === 1 ? '' : 's'} from your order ${readyItems === 1 ? 'is' : 'are'} ready.` : `Your order for ${access.event.title} is ${status}.`,
              createdAt: typeof updatedAt === 'number' ? updatedAt : Date.now(),
            });
          }),
          () => undefined,
        ));
        stops.push(store.onSnapshot(store.collection(db, 'events', access.event.id, 'expenses'), (snapshot) => {
          const expensesById = new Map(snapshot.docs.map((document) => {
            const data = document.data();
            return [document.id, {
              ...data,
              id: document.id,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
            } as EventExpense] as const;
          }));
          moneyByEvent.set(access.event.id, [...expensesById.values()].reduce((eventMoney, expense) => {
            const shares = expenseShares(expense);
            const myShare = shares[accountProfile.guestUid] || 0;
            const submittedByMe = expense.submittedByAccountUid === accountUser.uid
              || expense.submittedByUid === accountProfile.guestUid;
            if (submittedByMe) Object.entries(shares).forEach(([participantUid, amountCents]) => {
              if (participantUid === accountProfile.guestUid || amountCents <= 0) return;
              const participant = expense.participants?.find((entry) => entry.id === participantUid);
              eventMoney.owedDetails.push({
                id: `${access.event.id}:${expense.id}:${participantUid}`,
                direction: 'owed',
                eventId: access.event.id,
                eventTitle: access.event.title,
                personId: participantUid,
                personName: participant?.name || 'Guest',
                amountCents,
                expenseTitles: [expense.title],
              });
            });
            else if (myShare > 0) eventMoney.owesDetails.push({
              id: `${access.event.id}:${expense.id}:${expense.submittedByUid || expense.submittedByAccountUid}`,
              direction: 'owes',
              eventId: access.event.id,
              eventTitle: access.event.title,
              personId: expense.submittedByUid || expense.submittedByAccountUid || 'organizer',
              personName: expense.submittedByName || 'Event organizer',
              amountCents: myShare,
              expenseTitles: [expense.title],
            });
            return eventMoney;
          }, { owedDetails: [], owesDetails: [] } as { owedDetails: MoneyDetail[]; owesDetails: MoneyDetail[] }));
          updateAccountBalance();
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') return;
            const expense = expensesById.get(change.doc.id);
            if (!expense) return;
            const share = expenseShares(expense)[accountProfile.guestUid] || 0;
            if (share <= 0) return;
            addEventActivity({
              id: `expense:${access.event.id}:${expense.id}:${expense.updatedAt || expense.createdAt}`,
              eventId: access.event.id,
              kind: 'expense',
              title: 'Expense assigned to you',
              detail: `${expense.title}: your share is ${formatCents(share)}.`,
              createdAt: expense.updatedAt || expense.createdAt || Date.now(),
            });
          });
        }, () => undefined));
      });
    })();
    return () => stops.forEach((stop) => stop());
  // The ID signature intentionally keeps listeners stable when event content refreshes.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [accountProfile, accountUser, addEventActivity, guestEventIdentity]);

  useEffect(() => {
    if (!firebaseConfigured || !accountUser) {
      queueMicrotask(() => setHostContacts([]));
      return;
    }
    let unsubscribe = () => {};
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      unsubscribe = store.onSnapshot(
        store.collection(store.getFirestore(getApp()), 'users', accountUser.uid, 'contacts'),
        (snapshot) => setHostContacts(snapshot.docs
          .map((document) => {
            const data = document.data();
            return {
              ...data,
              accountUid: document.id,
              lastInvitedAt: data.lastInvitedAt?.toMillis?.() ?? 0,
            } as HostContact;
          })
          .sort((left, right) => right.lastInvitedAt - left.lastInvitedAt)),
      );
    })();
    return () => unsubscribe();
  }, [accountUser]);

  useEffect(() => {
    if (!firebaseConfigured || !accountUser || !accountProfile || mode !== 'host') return;
    const ownedEvents = events.filter((event) =>
      accountCanManageEvent(event, accountUser.uid, accountProfile.email));
    ownedEvents.forEach((event) => {
      if (ensuredHostMembershipsRef.current.has(event.id)) return;
      ensuredHostMembershipsRef.current.add(event.id);
      void (async () => {
        try {
          const [{ getApp }, store] = await Promise.all([
            import('firebase/app'), import('firebase/firestore'),
          ]);
          const db = store.getFirestore(getApp());
          const guestUid = accountProfile.guestUid;
          const displayName = accountDisplayName(accountProfile);
          const fallbackName = `${displayName} · Host`;
          const invitationRef = store.doc(db, 'users', accountUser.uid, 'invitations', event.id);
          const profileRef = store.doc(db, 'events', event.id, 'guests', guestUid);
          const rsvpRef = store.doc(db, 'events', event.id, 'rsvps', guestUid);
          const participantRef = store.doc(db, 'events', event.id, 'expense-participants', guestUid);
          const primaryNameRef = store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(displayName));
          const fallbackNameRef = store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(fallbackName));
          const phoneRef = store.doc(db, 'events', event.id, 'guest-phones', await guestNameIndexId(accountProfile.phone));
          await store.runTransaction(db, async (transaction) => {
            const [invitation, profile, rsvp, participant, primaryName, fallbackClaim, phoneClaim] = await Promise.all([
              transaction.get(invitationRef), transaction.get(profileRef), transaction.get(rsvpRef),
              transaction.get(participantRef), transaction.get(primaryNameRef), transaction.get(fallbackNameRef),
              transaction.get(phoneRef),
            ]);
            if (invitation.exists() && profile.exists() && rsvp.exists() && participant.exists()) return;
            const guestName = profile.data()?.guestName
              || (!primaryName.exists() || primaryName.data().guestUid === guestUid ? displayName : fallbackName);
            const nameRef = guestName === displayName ? primaryNameRef : fallbackNameRef;
            const nameClaim = guestName === displayName ? primaryName : fallbackClaim;
            if (!invitation.exists()) transaction.set(invitationRef, {
              eventId: event.id,
              eventTitle: event.title,
              hostUid: accountUser.uid,
              recipientUid: accountUser.uid,
              recipientGuestUid: guestUid,
              recipientEmail: accountProfile.email,
              recipientPhone: accountProfile.phone,
              createdAt: store.serverTimestamp(),
              updatedAt: store.serverTimestamp(),
            });
            if (!nameClaim.exists()) transaction.set(nameRef, {
              guestUid, guestName, createdAt: store.serverTimestamp(),
            });
            if (!phoneClaim.exists()) transaction.set(phoneRef, {
              guestUid, guestPhone: accountProfile.phone, createdAt: store.serverTimestamp(),
            });
            if (!profile.exists()) transaction.set(profileRef, {
              guestUid,
              accountUid: accountUser.uid,
              guestName,
              guestPhone: accountProfile.phone,
              createdAt: store.serverTimestamp(),
              updatedAt: store.serverTimestamp(),
            });
            if (!rsvp.exists()) transaction.set(rsvpRef, {
              guestUid,
              guestName,
              guestPhone: accountProfile.phone,
              status: 'yes',
              companions: [],
              activeOrderCount: 0,
              approvalStatus: 'approved',
              createdAt: store.serverTimestamp(),
              updatedAt: store.serverTimestamp(),
            });
            transaction.set(participantRef, {
              id: guestUid,
              accountUid: accountUser.uid,
              primaryGuestUid: guestUid,
              name: guestName,
              role: 'host',
              status: 'host',
              approvalStatus: 'approved',
              createdAt: participant.data()?.createdAt || store.serverTimestamp(),
              updatedAt: store.serverTimestamp(),
            });
          });
        } catch {
          ensuredHostMembershipsRef.current.delete(event.id);
        }
      })();
    });
  }, [accountProfile, accountUser, events, mode]);

  useEffect(() => {
    if (!firebaseConfigured || !accountUser) {
      queueMicrotask(() => setHostInvitations([]));
      return;
    }
    let unsubscribe = () => {};
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const invitationQuery = store.query(
        store.collectionGroup(store.getFirestore(getApp()), 'invitations'),
        store.where('hostUid', '==', accountUser.uid),
      );
      unsubscribe = store.onSnapshot(invitationQuery, (snapshot) => {
        setHostInvitations(snapshot.docs.map((document) => {
          const data = document.data();
          return {
            ...data,
            eventId: data.eventId || document.id,
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: data.updatedAt?.toMillis?.(),
          } as EventInvitation;
        }));
      }, () => setHostInvitations([]));
    })();
    return () => unsubscribe();
  }, [accountUser]);

  useEffect(() => {
    if (!firebaseConfigured || !accountUser) {
      queueMicrotask(() => setPendingHostInvitations([]));
      return;
    }
    let unsubscribe = () => {};
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      unsubscribe = store.onSnapshot(
        store.collection(store.getFirestore(getApp()), 'users', accountUser.uid, 'phone-invitations'),
        (snapshot) => setPendingHostInvitations(snapshot.docs.map((document) => {
          const data = document.data();
          return {
            ...data,
            recipientUid: data.recipientUid || `phone:${data.recipientGuestUid}`,
            recipientEmail: '',
            pendingAccount: true,
            invitationId: document.id,
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: data.updatedAt?.toMillis?.(),
          } as EventInvitation;
        })),
        () => setPendingHostInvitations([]),
      );
    })();
    return () => unsubscribe();
  }, [accountUser]);

  useEffect(() => {
    const prime = () => primeChatAudio();
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const currentUrl = new URL(window.location.href);
    const legacyHostView = parameters.get('view') === 'host';
    const hostView = isHostPortalUrl(currentUrl);
    const guestPortal = isGuestPortalUrl(currentUrl);
    const hostPreviewRequested = !hostView && parameters.get('preview') === 'host';
    queueMicrotask(() => setHostPreview(hostPreviewRequested));
    if (usesCleanEventUrls()) {
      const role = hostView ? 'host' : 'guest';
      document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
        ?.setAttribute('href', `/gathering/manifest-${role}.webmanifest`);
      document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
        ?.setAttribute('content', hostView ? 'Nights Host' : 'Nights');
    }
    if (
      legacyHostView
      && usesCleanEventUrls()
      && !currentUrl.pathname.startsWith('/nights-host')
    ) {
      parameters.delete('view');
      const query = parameters.toString();
      window.location.replace(`${hostHomeRoute()}${query ? `?${query}` : ''}`);
      return;
    }
    const storedSession = readGuestSession();
    const savedSession = firebaseConfigured && !storedSession?.authUid ? null : storedSession;
    if (firebaseConfigured && storedSession && !storedSession.authUid) writeGuestSession(null);
    if (savedSession) {
      const cachedEvents = readGuestEventCache(savedSession);
      queueMicrotask(() => {
        setGuestSession(savedSession);
        setGuestName(savedSession.guestName);
        setPhoneNumber(formatPhone(savedSession.guestPhone));
        setGuestEvents(cachedEvents);
      });
    }
    if (hostView)
      queueMicrotask(() => setMode('host'));
    const linkedEventId = currentEventId();
    const linkedPublicPath = currentEventPublicPath();
    if (guestPortal) {
      const invitation = parameters.get('invite')?.trim() || '';
      const invitationPublicPath = normalizedPublicEventPath(invitation);
      const invitationEventId = !invitationPublicPath && EVENT_ID_PATTERN.test(invitation)
        ? invitation
        : undefined;
      const pending = invitationPublicPath || invitationEventId
        ? {
            route: invitationPublicPath ? `/${invitationPublicPath}` : eventRoute(invitationEventId || ''),
            eventId: invitationEventId,
            publicPath: invitationPublicPath || undefined,
            savedAt: Date.now(),
          }
        : readPendingGuestEvent();
      if (pending) writePendingGuestEvent(pending);
      queueMicrotask(() => {
        setPendingGuestEvent(pending);
        setMenu(emptyEventMenu);
        setEventReady(true);
        if (parameters.get('install') === '1') setShowInstallGuide(true);
      });
      return;
    }
    if (!hostView && !hostPreviewRequested && (linkedEventId || linkedPublicPath)) {
      const trustedGuestUid = linkedEventId
        ? localStorage.getItem(guestIdentityKey(linkedEventId))
        : null;
      const trustedPublicRoute = linkedPublicPath
        ? localStorage.getItem(TRUSTED_GUEST_ROUTE_KEY) === currentUrl.pathname
        : false;
      if (
        !savedSession
        || (linkedEventId && trustedGuestUid !== savedSession.guestUid)
        || (linkedPublicPath && !trustedPublicRoute)
      ) {
        const pending = {
          route: `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
          eventId: linkedEventId || undefined,
          publicPath: linkedPublicPath || undefined,
          savedAt: Date.now(),
        };
        writePendingGuestEvent(pending);
        window.location.replace(guestHomeRoute());
        return;
      }
    }
    const rememberedEventId = localStorage.getItem(LAST_EVENT_KEY);
    const eventId = linkedEventId
      || rememberedEventId
      || (firebaseConfigured ? EMPTY_EVENT_ID : demoMenu.id);
    if (linkedEventId) localStorage.setItem(LAST_EVENT_KEY, linkedEventId);
    else if (rememberedEventId && !linkedPublicPath) {
      history.replaceState(
        {},
        '',
        eventRoute(rememberedEventId, hostView ? 'host' : 'guest'),
      );
    }
    if (!linkedPublicPath) {
      queueMicrotask(() => setReceipts(readReceipts(eventId)));
      const savedGuestUid = localStorage.getItem(guestIdentityKey(eventId));
      if (savedGuestUid) queueMicrotask(() => setGuestUid(savedGuestUid));
    }
  }, [loadGuestEvents]);

  useEffect(() => {
    if (
      mode !== 'guest'
      || !guestSession
      || !isGuestPortalUrl(new URL(window.location.href))
    ) return;
    const enrollmentKey = `${guestSession.guestUid}:${pendingGuestEvent?.route || 'events'}`;
    if (pendingEnrollmentRef.current === enrollmentKey) return;
    pendingEnrollmentRef.current = enrollmentKey;
    void (async () => {
      const matches = await loadGuestEvents(guestSession);
      if (!pendingGuestEvent) return;
      const access = matches.find((entry) => guestEventMatchesPending(entry, pendingGuestEvent))
        || await enrollPendingGuestEvent(guestSession, pendingGuestEvent, matches);
      if (!access) return;
      localStorage.setItem(guestIdentityKey(access.event.id), guestSession.guestUid);
      localStorage.setItem(LAST_EVENT_KEY, access.event.id);
      const nextRoute = eventRoute(access.event.id, 'guest', automaticPublicEventPath(access.event));
      localStorage.setItem(TRUSTED_GUEST_ROUTE_KEY, new URL(nextRoute, window.location.origin).pathname);
      writePendingGuestEvent(null);
      setPendingGuestEvent(null);
      window.location.assign(nextRoute);
    })();
  }, [enrollPendingGuestEvent, guestSession, loadGuestEvents, mode, pendingGuestEvent]);

  useEffect(() => {
    if (
      mode !== 'guest'
      || !guestSession
      || menu.id === EMPTY_EVENT_ID
      || !guestEvents.some((entry) => entry.event.id === menu.id)
    ) return;
    localStorage.setItem(guestIdentityKey(menu.id), guestSession.guestUid);
    if (guestUid !== guestSession.guestUid)
      queueMicrotask(() => setGuestUid(guestSession.guestUid));
  }, [guestEvents, guestSession, guestUid, menu.id, mode]);

  useEffect(() => {
    if (firebaseConfigured || mode !== 'guest' || accountUser || guestSession || !guestProfile?.pinHash) return;
    const session: GuestSession = {
      guestUid: guestProfile.guestUid,
      guestName: guestProfile.guestName,
      guestPhone: guestProfile.guestPhone,
      pinHash: guestProfile.pinHash,
    };
    writeGuestSession(session);
    queueMicrotask(() => {
      setGuestSession(session);
      void loadGuestEvents(session);
    });
  }, [accountUser, guestProfile, guestSession, loadGuestEvents, mode]);

  useEffect(() => {
    const savedGuestUid = localStorage.getItem(guestIdentityKey(menu.id));
    queueMicrotask(() => {
      setRsvpPanelOpen(false);
      setEditingGuestProfile(false);
      setChangingGuestPhone(false);
      setGuestName('');
      setPhoneNumber('');
      setGuestPin('');
      setRsvpChoice('yes');
      setGuestProfile(null);
      setMyRsvp(null);
      setGuestUid(savedGuestUid);
    });
  }, [menu.id]);

  useEffect(() => {
    const nativeIOSApp = navigator.userAgent.includes('Nights-iOS/');
    document.documentElement.classList.toggle('native-ios-shell', nativeIOSApp);
    document.body.classList.toggle('native-ios-shell', nativeIOSApp);
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone) ||
      nativeIOSApp;
    queueMicrotask(() => {
      setIsStandalone(installed);
      setIsNativeIOSApp(nativeIOSApp);
      setAppEnvironmentReady(true);
      if (nativeIOSApp) setShowInstallGuide(false);
    });
    if (!nativeIOSApp && location.protocol === 'https:' && 'serviceWorker' in navigator) {
      // Changing this release marker causes a prompt service-worker update on
      // GitHub Pages, rather than waiting for the browser's periodic check.
      const serviceWorker = serviceWorkerLocation();
      void navigator.serviceWorker
        .register(serviceWorker.url.href, { scope: serviceWorker.scope, updateViaCache: 'none' })
        .then(async () => {
          const desiredScope = new URL(serviceWorker.scope, serviceWorker.url).href;
          const workerPath = serviceWorker.url.pathname;
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations
            .filter((registration) => registration.scope !== desiredScope)
            .filter((registration) => {
              const scriptUrl = registration.active?.scriptURL
                || registration.waiting?.scriptURL
                || registration.installing?.scriptURL;
              return Boolean(scriptUrl && new URL(scriptUrl).pathname === workerPath);
            })
            .map((registration) => registration.unregister()));
        })
        .catch(() => undefined);
    }
    return () => {
      document.documentElement.classList.remove('native-ios-shell');
      document.body.classList.remove('native-ios-shell');
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'guest') return;
    let active = true;
    const syncNotificationCounts = () => void readAppBadgeState().then((state) => {
      if (active) setEventNotificationCounts((current) => {
        const next = { ...current };
        Object.entries(state.events).forEach(([eventId, count]) => {
          if (count > 0) next[eventId] = Math.max(next[eventId] || 0, count);
        });
        return next;
      });
    });
    const receivePush = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'nights-chat-push') syncNotificationCounts();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncNotificationCounts();
    };
    syncNotificationCounts();
    window.addEventListener('focus', syncNotificationCounts);
    document.addEventListener('visibilitychange', handleVisibility);
    navigator.serviceWorker?.addEventListener('message', receivePush);
    return () => {
      active = false;
      window.removeEventListener('focus', syncNotificationCounts);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker?.removeEventListener('message', receivePush);
    };
  }, [menu.id, mode]);

  useEffect(() => {
    const color = mode === 'guest'
      ? menu.id === EMPTY_EVENT_ID ? '#061b2a' : eventThemeChromeColor(menu)
      : '#0e100d';
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = color;
    document.documentElement.style.background = color;
    document.body.style.background = color;
    (window as NightsNativeWindow).webkit?.messageHandlers?.nightsTheme?.postMessage(color);
  }, [menu, mode]);

  useEffect(() => {
    if (
      !isStandalone
      || isNativeIOSApp
      || !accountUser
      || !accountProfile
      || typeof Notification === 'undefined'
      || Notification.permission === 'denied'
      || localStorage.getItem(globalPushKey(accountUser.uid))
      || localStorage.getItem(notificationPromptKey(accountUser.uid))
    ) return;
    queueMicrotask(() => setShowNotificationPrompt(true));
  }, [accountProfile, accountUser, isNativeIOSApp, isStandalone]);

  useEffect(() => {
    const dialog = document.getElementById(
      'checkout',
    ) as HTMLDialogElement | null;
    if (!dialog) return;
    const handleClose = () => {
      if (editingOrderId) {
        setEditingOrderId(null);
        setCart({});
      }
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [editingOrderId]);

  useEffect(() => {
    if (firebaseConfigured) return;
    const eventId = currentEventId() || menu.id;
    const applyOrders = (next: Order[]) => {
      setOrders(next);
      const savedReceipts = readReceipts(eventId);
      setReceipts(savedReceipts);
      setRememberedOrders(
        savedReceipts
          .map((receipt) => next.find((order) => order.id === receipt.orderId))
          .filter((order): order is Order => Boolean(order)),
      );
    };
    const applyEvents = (next: EventMenu[]) => {
      setEvents(next);
      const selected = next.find((event) => event.id === eventId);
      if (selected) setMenu(selected);
    };
    const loadSharedPreview = () => {
      const storedEvents = localStorage.getItem(DEMO_EVENTS_KEY);
      const nextEvents = storedEvents
        ? (JSON.parse(storedEvents) as EventMenu[])
        : [demoMenu];
      applyEvents(nextEvents);
      if (!storedEvents) shareDemoUpdate({ type: 'events', value: nextEvents });
      const storedOrders = localStorage.getItem(demoOrdersKey(eventId));
      const nextOrders = storedOrders
        ? (JSON.parse(storedOrders) as Order[])
        : eventId === demoMenu.id
          ? sampleOrders
          : [];
      applyOrders(nextOrders);
      const savedRsvps = JSON.parse(localStorage.getItem(`gather-demo-rsvps:${eventId}`) || '[]') as Rsvp[];
      setRsvps(savedRsvps);
      const savedProfile = JSON.parse(localStorage.getItem(`gather-demo-profile:${eventId}`) || 'null') as GuestProfile | null;
      setGuestProfile(savedProfile);
      setMyRsvp(savedProfile
        ? savedRsvps.find((entry) => entry.guestUid === savedProfile.guestUid) || null
        : null);
      if (savedProfile) {
        setGuestName(savedProfile.guestName);
        setPhoneNumber(formatPhone(savedProfile.guestPhone));
      }
      if (!storedOrders)
        shareDemoUpdate({ type: 'orders', eventId, value: nextOrders });
      setEventReady(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === demoOrdersKey(eventId) && event.newValue)
        applyOrders(JSON.parse(event.newValue) as Order[]);
      if (event.key === DEMO_EVENTS_KEY && event.newValue)
        applyEvents(JSON.parse(event.newValue) as EventMenu[]);
      if (event.key === `gather-demo-rsvps:${eventId}` && event.newValue)
        setRsvps(JSON.parse(event.newValue) as Rsvp[]);
      if (event.key === `gather-demo-profile:${eventId}`)
        setGuestProfile(event.newValue ? JSON.parse(event.newValue) as GuestProfile : null);
    };
    const channel =
      'BroadcastChannel' in window ? new BroadcastChannel(DEMO_CHANNEL) : null;
    if (channel)
      channel.onmessage = (event: MessageEvent<DemoUpdate>) => {
        if (event.data.type === 'orders' && event.data.eventId === eventId)
          applyOrders(event.data.value);
        if (event.data.type === 'events') applyEvents(event.data.value);
        if (event.data.type === 'rsvps' && event.data.eventId === eventId)
          setRsvps(event.data.value);
        if (event.data.type === 'profile' && event.data.eventId === eventId)
          setGuestProfile(event.data.value);
      };
    queueMicrotask(loadSharedPreview);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [menu.id]);

  useEffect(() => {
    const modalSelector = [
      'dialog[open]',
      '[aria-modal="true"]',
      '.background-crop-backdrop',
      '.delete-account-backdrop',
      '.guest-event-picker-backdrop',
      '.invite-dialog-backdrop',
      '.guest-list-backdrop',
      '.guest-rsvp-backdrop',
      '.expense-backdrop',
    ].join(',');
    let scrollLocked = false;
    let lockedScrollY = 0;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyLeft = document.body.style.left;
    const originalBodyRight = document.body.style.right;
    const originalBodyWidth = document.body.style.width;
    const setScrollLocked = (locked: boolean) => {
      if (locked === scrollLocked) return;
      scrollLocked = locked;
      if (locked) {
        lockedScrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        return;
      }
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.left = originalBodyLeft;
      document.body.style.right = originalBodyRight;
      document.body.style.width = originalBodyWidth;
      window.scrollTo({ top: lockedScrollY, behavior: 'auto' });
    };
    const syncScrollLock = () => {
      const overlayOpen = Boolean(document.querySelector(modalSelector));
      document.documentElement.classList.toggle('app-overlay-open', overlayOpen);
      document.body.classList.toggle('app-overlay-open', overlayOpen);
      setScrollLocked(overlayOpen);
    };
    const observer = new MutationObserver(syncScrollLock);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'aria-modal'],
    });
    syncScrollLock();
    return () => {
      observer.disconnect();
      setScrollLocked(false);
      document.documentElement.classList.remove('app-overlay-open');
      document.body.classList.remove('app-overlay-open');
    };
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    if (mode === 'guest' && isGuestPortalUrl(new URL(window.location.href))) {
      queueMicrotask(() => setEventReady(true));
      return;
    }
    let stop = () => {};
    (async () => {
      const [appModule, store] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ]);
      const app = appModule.getApps().some((candidate) => candidate.name === '[DEFAULT]')
        ? appModule.getApp()
        : appModule.initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          });
      let hostAuthUser: { email: string | null; uid: string } | null = null;
      if (mode === 'host') {
        const authModule = await import('firebase/auth');
        const auth = authModule.getAuth(app);
        await authModule.setPersistence(auth, authModule.browserLocalPersistence);
        await auth.authStateReady();
        hostAuthUser = auth.currentUser;
      }
      const db = store.getFirestore(app);
      const linkedPublicPath = currentEventPublicPath();
      let eventId = currentEventId()
        || (!linkedPublicPath ? localStorage.getItem(LAST_EVENT_KEY) : null)
        || menu.id;
      if (linkedPublicPath) {
        const aliasSnapshot = await store.getDocs(
          store.query(
            store.collection(db, 'events'),
            store.where('publicPath', '==', linkedPublicPath),
            store.limit(1),
          ),
        );
        const explicitAlias = aliasSnapshot.docs[0];
        const eventsSnapshot = explicitAlias
          ? null
          : await store.getDocs(store.collection(db, 'events'));
        const aliasedEvent = explicitAlias || eventsSnapshot?.docs.find((eventDocument) => {
            const event = { id: eventDocument.id, ...eventDocument.data() } as EventMenu;
            return automaticPublicEventPath(event) === linkedPublicPath;
          });
        if (!aliasedEvent) {
          setEventReady(true);
          setToast('This event link does not exist. Ask the host for the current link.');
          return;
        }
        eventId = aliasedEvent.id;
        localStorage.setItem(LAST_EVENT_KEY, eventId);
      }
      const eventCollection = store.collection(db, 'events');
      const managesLegacyEvents = Boolean(
        mode === 'host'
        && hostAuthUser
        && HOST_EMAIL
        && hostAuthUser.email?.trim().toLowerCase() === HOST_EMAIL
        && hostAuthUser.uid !== LEGACY_HOST_UID,
      );
      const ownedEventSource = mode === 'host' && hostAuthUser
        ? managesLegacyEvents
          ? store.query(
              eventCollection,
              store.where('ownerUid', 'in', [hostAuthUser.uid, LEGACY_HOST_UID]),
            )
          : store.query(eventCollection, store.where('ownerUid', '==', hostAuthUser.uid))
        : null;
      if (mode === 'host' && hostAuthUser && hostUser && ownedEventSource) {
        const initialOwnedSnapshot = await store.getDocs(ownedEventSource);
        const initialOwnedEvents = initialOwnedSnapshot.docs.map(
          (document) => ({ id: document.id, ...document.data() }) as EventMenu,
        );
        const selectedEvent = initialOwnedEvents.find((event) => event.id === eventId);
        if (!selectedEvent) {
          const fallbackEvent = initialOwnedEvents[0];
          eventId = fallbackEvent?.id || EMPTY_EVENT_ID;
          if (fallbackEvent) {
            localStorage.setItem(LAST_EVENT_KEY, fallbackEvent.id);
            history.replaceState(
              {},
              '',
              eventRoute(fallbackEvent.id, 'host', automaticPublicEventPath(fallbackEvent)),
            );
          } else {
            setMenu(emptyEventMenu);
          }
        }
      }
      const unsubMenu = eventId === EMPTY_EVENT_ID
        ? () => {}
        : store.onSnapshot(
            store.doc(db, 'events', eventId),
            (snap) => {
              if (snap.exists()) setMenu({ id: snap.id, ...snap.data() } as EventMenu);
              setEventReady(true);
            },
          );
      if (eventId === EMPTY_EVENT_ID) setEventReady(true);
      let unsubOrders = () => {};
      let unsubRsvps = () => {};
      let unsubMyRsvp = () => {};
      let unsubGuestProfile = () => {};
      let unsubEvents = () => {};
      let unsubEventOrderCounts: (() => void)[] = [];
      const unsubRememberedOrders: (() => void)[] = [];
      if (mode === 'host' && hostAuthUser && hostUser && ownedEventSource) {
        unsubEvents = store.onSnapshot(
          ownedEventSource,
          (snap) => {
            const ownedEvents = snap.docs.map(
              (d) => ({ id: d.id, ...d.data() }) as EventMenu,
            );
            setEvents(ownedEvents);
            unsubEventOrderCounts.forEach((unsubscribe) => unsubscribe());
            unsubEventOrderCounts = ownedEvents.map((event) =>
              store.onSnapshot(
                store.collection(db, 'events', event.id, 'orders'),
                (ordersSnapshot) => {
                  const eventOrders = ordersSnapshot.docs.map(
                    (entry) => ({ id: entry.id, ...entry.data() }) as Order,
                  );
                  const eventQueue = planResourceQueue(
                    eventOrders,
                    event,
                  );
                  setEventIncomingCounts((current) => ({
                    ...current,
                    [event.id]: eventOrders.filter(
                      (order) => {
                        if (order.status !== 'new' && order.status !== 'preparing') return false;
                        const tasks = order.tasks?.length ? order.tasks : createOrderTasks(order);
                        return tasks.some((task) =>
                          task.status === 'waiting' && eventQueue.availableTaskIds.has(task.id),
                        );
                      },
                    ).length,
                  }));
                },
              ),
            );
            if (
              ownedEvents.length &&
              !ownedEvents.some((event) => event.id === eventId)
            ) {
              setMenu(ownedEvents[0]);
              history.replaceState(
                {},
                '',
                eventRoute(ownedEvents[0].id, 'host', automaticPublicEventPath(ownedEvents[0])),
              );
            }
          },
        );
        if (eventId !== EMPTY_EVENT_ID) unsubOrders = store.onSnapshot(
          store.collection(db, 'events', eventId, 'orders'),
          (snap) =>
            setOrders(
              snap.docs.map(
                (d) =>
                  ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
                    updatedAt: d.data().updatedAt?.toMillis?.(),
                    cancelledAt: d.data().cancelledAt?.toMillis?.(),
                    readyAt: d.data().readyAt?.toMillis?.(),
                  }) as Order,
              ).sort((left, right) => right.createdAt - left.createdAt),
            ),
        );
        if (eventId !== EMPTY_EVENT_ID) unsubRsvps = store.onSnapshot(
          store.query(
            store.collection(db, 'events', eventId, 'rsvps'),
            store.orderBy('createdAt', 'desc'),
          ),
          (snap) =>
            setRsvps(
              snap.docs.map(
                (d) => ({
                  ...d.data(),
                  guestUid: d.id,
                  activeOrderCount: d.data().activeOrderCount || 0,
                  createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
                  updatedAt: d.data().updatedAt?.toMillis?.(),
                }) as Rsvp,
              ),
            ),
        );
      }
      if (mode === 'guest' && guestUid) {
        const uid = guestUid;
        unsubGuestProfile = store.onSnapshot(
          store.doc(db, 'events', eventId, 'guests', uid),
          (snap) => {
            const data = snap.data();
            const profile = data ? {
              ...data,
              guestUid: uid,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.(),
            } as GuestProfile : null;
            setGuestProfile(profile);
            if (profile) {
              setGuestName(profile.guestName);
              setPhoneNumber(formatPhone(profile.guestPhone));
              setEditingGuestProfile(false);
            }
          },
        );
        unsubMyRsvp = store.onSnapshot(
          store.doc(db, 'events', eventId, 'rsvps', uid),
          (snap) => {
            const data = snap.data();
            setMyRsvp(data ? {
              ...data,
              guestUid: uid,
              activeOrderCount: data.activeOrderCount || 0,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.(),
            } as Rsvp : null);
            if (data) {
              setRsvpChoice(data.status);
            }
          },
        );
        unsubOrders = store.onSnapshot(
          store.query(
            store.collection(db, 'events', eventId, 'orders'),
            store.where('guestUid', '==', uid),
          ),
          (snap) => setRememberedOrders(snap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id, ...data,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.(),
              cancelledAt: data.cancelledAt?.toMillis?.(),
              readyAt: data.readyAt?.toMillis?.(),
            } as Order;
          }).sort((a, b) => b.createdAt - a.createdAt)),
        );
      }
      stop = () => {
        unsubMenu();
        unsubEvents();
        unsubEventOrderCounts.forEach((unsubscribe) => unsubscribe());
        unsubOrders();
        unsubRsvps();
        unsubMyRsvp();
        unsubGuestProfile();
        unsubRememberedOrders.forEach((unsubscribe) => unsubscribe());
      };
    })().catch(() =>
      setToast('Could not connect to the live event. Check your connection and reload.'),
    );
    return () => stop();
  }, [mode, hostUser, guestUid, menu.id]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'stage_guest_order',
          title: 'Choose menu items',
          description:
            'Select quantities from the visible event menu before the guest reviews and submits their order.',
          inputSchema: {
            type: 'object',
            properties: {
              selections: {
                type: 'object',
                additionalProperties: {
                  type: 'integer',
                  minimum: 0,
                  maximum: 20,
                },
              },
            },
            required: ['selections'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (!myRsvp || myRsvp.status !== 'yes' || !menu.accepting || !guestIsApproved(menu, myRsvp))
              throw new Error('A Going RSVP, host approval, and open ordering are required.');
            const candidate = input as { selections?: Record<string, number> };
            if (
              !candidate.selections ||
              typeof candidate.selections !== 'object'
            )
              throw new Error('Selections are required.');
            const known = new Set(menu.items.map((item) => item.id));
            const next: Record<string, number> = {};
            for (const [id, quantity] of Object.entries(candidate.selections)) {
              if (
                !known.has(id) ||
                !Number.isInteger(quantity) ||
                quantity < 0 ||
                quantity > 20
              )
                throw new Error(`Invalid selection: ${id}`);
              next[id] = quantity;
            }
            setCart(next);
            return {
              selectedItems: Object.values(next).reduce(
                (sum, quantity) => sum + quantity,
                0,
              ),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [menu, myRsvp]);

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const hasMenu = menuHasPublishedItems(menu);
  const effectiveGuestProfile = useMemo(() => {
    const savedProfile = guestProfile || (myRsvp ? {
      guestUid: myRsvp.guestUid,
      guestName: myRsvp.guestName,
      guestPhone: myRsvp.guestPhone,
      createdAt: myRsvp.createdAt,
      updatedAt: myRsvp.updatedAt,
    } : null);
    if (!accountProfile) return savedProfile;
    return {
      ...savedProfile,
      accountUid: accountProfile.uid,
      guestUid: accountProfile.guestUid,
      guestName: accountDisplayName(accountProfile),
      guestPhone: accountProfile.phone,
      createdAt: savedProfile?.createdAt || accountProfile.createdAt,
      updatedAt: savedProfile?.updatedAt || accountProfile.updatedAt,
    };
  }, [accountProfile, guestProfile, myRsvp]);
  const currentInvitation = guestEvents.find((access) => access.event.id === menu.id)?.invitation;
  const accountManagesCurrentEvent = !firebaseConfigured
    || accountCanManageEvent(menu, accountUser?.uid, accountUser?.email);
  const guestHasEventAccess = guestIsApproved(menu, myRsvp)
    || (hostPreview && accountManagesCurrentEvent);
  const rsvpButtonLabel = myRsvp
    ? menu.requireGuestApproval && myRsvp.status === 'yes' && approvalStatus(myRsvp) === 'pending'
      ? 'RSVP: Pending approval'
      : menu.requireGuestApproval && myRsvp.status === 'yes' && approvalStatus(myRsvp) === 'declined'
        ? 'RSVP: Not approved'
        : `RSVP: ${myRsvp.status === 'yes' ? 'Going' : myRsvp.status === 'maybe' ? 'Maybe' : 'Not Going'}`
    : 'RSVP';
  const canManageCurrentEvent = mode === 'host' && accountManagesCurrentEvent;
  const canManageGame = canManageCurrentEvent || (hostPreview && accountManagesCurrentEvent);
  const chatActor: ChatActor | null = useMemo(() => mode === 'host'
    ? ((hostUser && canManageCurrentEvent) || !firebaseConfigured)
      ? { uid: hostUser || 'host', name: 'Host', role: 'host' }
      : null
    : myRsvp?.status === 'yes' && guestHasEventAccess && effectiveGuestProfile
      ? { uid: effectiveGuestProfile.guestUid, name: effectiveGuestProfile.guestName, role: 'guest' }
      : null,
  [canManageCurrentEvent, effectiveGuestProfile, guestHasEventAccess, hostUser, mode, myRsvp?.status]);
  // Use the live authorized host uid so the client roster matches the
  // server-side game-session actor, including legacy-owned events.
  const gameHostId = accountManagesCurrentEvent && accountUser?.uid
    ? accountUser.uid
    : menu.ownerUid || 'event-host';
  const gameViewer = useMemo<GameParticipant | null>(() => hostPreview && accountManagesCurrentEvent && accountUser
    ? { id: accountUser.uid, name: 'Host' }
    : chatActor
      ? { id: chatActor.uid, name: chatActor.name }
      : null,
  [accountManagesCurrentEvent, accountUser, chatActor, hostPreview]);
  const gameParticipants = useMemo(() => {
    const participants = new Map<string, GameParticipant>();
    participants.set(gameHostId, { id: gameHostId, name: 'Host' });
    rsvps.forEach((rsvp) => {
      if (rsvp.status !== 'yes' || approvalStatus(rsvp) !== 'approved') return;
      participants.set(rsvp.guestUid, { id: rsvp.guestUid, name: rsvp.guestName });
    });
    if (gameViewer) participants.set(gameViewer.id, gameViewer);
    return Array.from(participants.values());
  }, [gameHostId, gameViewer, rsvps]);
  const expenseActor: ExpenseActor | null = useMemo(() => {
    if (!firebaseConfigured && mode === 'host' && menu.id !== EMPTY_EVENT_ID) return {
      accountUid: 'preview-host',
      participantUid: 'preview-host',
      name: 'Host',
      role: 'host',
    };
    if (!accountUser || !accountProfile || menu.id === EMPTY_EVENT_ID) return null;
    if (mode === 'host') return canManageCurrentEvent ? {
        accountUid: accountUser.uid,
        participantUid: accountProfile.guestUid,
        name: accountDisplayName(accountProfile),
        role: 'host',
      } : null;
    if (myRsvp?.status !== 'yes' || !guestHasEventAccess || !effectiveGuestProfile) return null;
    return {
      accountUid: accountUser.uid,
      participantUid: effectiveGuestProfile.guestUid,
      name: effectiveGuestProfile.guestName,
      role: 'guest',
    };
  }, [accountProfile, accountUser, canManageCurrentEvent, effectiveGuestProfile, guestHasEventAccess, menu.id, mode, myRsvp?.status]);
  const chatActorUid = chatActor?.uid;
  useEffect(() => {
    if (!chatActorUid) return;
    queueMicrotask(() => {
      setChatStarted(true);
      if (new URLSearchParams(window.location.search).get('chat') === '1') setChatOpen(true);
    });
  }, [chatActorUid]);
  useEffect(() => {
    if (!expenseActor) return;
    if (new URLSearchParams(window.location.search).get('expenses') === '1')
      queueMicrotask(() => setExpensesOpen(true));
  }, [expenseActor]);
  const openRsvpPanel = () => {
    setGuestName(effectiveGuestProfile?.guestName || '');
    setPhoneNumber(formatPhone(effectiveGuestProfile?.guestPhone || ''));
    setGuestPin('');
    setRsvpChoice(myRsvp?.status || 'yes');
    const companions = (myRsvp?.companions || []).slice(0, menu.maxAdditionalGuests || 0);
    setRsvpCompanionNames(companions.map(companionName));
    setRsvpCompanionPhones(companions.map(companionPhone));
    setChangingGuestPhone(false);
    setEditingGuestProfile(!effectiveGuestProfile && !accountProfile);
    setRsvpPanelOpen(true);
  };
  const closeRsvpPanel = () => {
    setGuestName(effectiveGuestProfile?.guestName || '');
    setPhoneNumber(formatPhone(effectiveGuestProfile?.guestPhone || ''));
    setGuestPin('');
    setRsvpChoice(myRsvp?.status || 'yes');
    const companions = (myRsvp?.companions || []).slice(0, menu.maxAdditionalGuests || 0);
    setRsvpCompanionNames(companions.map(companionName));
    setRsvpCompanionPhones(companions.map(companionPhone));
    setChangingGuestPhone(false);
    setEditingGuestProfile(false);
    setRsvpPanelOpen(false);
  };
  const categories = useMemo(
    () => [...new Set(menu.items.map((i) => i.category))],
    [menu.items],
  );
  const setQty = (id: string, delta: number) =>
    setCart((current) => {
      if (!myRsvp || myRsvp.status !== 'yes' || !menu.accepting || !guestHasEventAccess) return current;
      const item = menu.items.find((entry) => entry.id === id);
      const alreadyReserved = reservedServings(
        rememberedOrders.filter((order) => order.id !== editingOrderId),
        id,
      );
      const limit = item?.soldOut
        ? 0
        : item?.maxServings == null
          ? undefined
          : Math.max(0, item.maxServings - alreadyReserved);
      const next = Math.max(0, (current[id] || 0) + delta);
      return { ...current, [id]: limit == null ? next : Math.min(limit, next) };
    });
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  };
  const activityUnreadCounts = useMemo(() => eventActivities.reduce<Record<string, number>>((counts, activity) => {
    if (!activity.read) counts[activity.eventId] = (counts[activity.eventId] || 0) + 1;
    return counts;
  }, {}), [eventActivities]);
  const openActivityCenter = () => {
    if (menu.id === EMPTY_EVENT_ID) return;
    setActivityCenterOpen(true);
    if (!accountUser) return;
    setEventActivities((current) => {
      const next = current.map((activity) => activity.eventId === menu.id
        ? { ...activity, read: true }
        : activity);
      localStorage.setItem(eventActivityKey(accountUser.uid), JSON.stringify(next));
      return next;
    });
    setEventMenuOpen(false);
  };
  const notificationTargets = useMemo(() => {
    if (!accountUser || !accountProfile) return [] as Array<{ event: EventMenu; actor: ChatActor }>;
    const targets = new Map<string, { event: EventMenu; actor: ChatActor }>();
    guestEvents.forEach((access) => {
      const hosted = Boolean(access.hosted
        || accountCanManageEvent(access.event, accountUser.uid, accountUser.email));
      if (hosted) {
        targets.set(access.event.id, {
          event: access.event,
          actor: { uid: accountUser.uid, name: 'Host', role: 'host' },
        });
        return;
      }
      if (
        access.rsvp?.status === 'yes'
        && guestIsApproved(access.event, access.rsvp)
      ) targets.set(access.event.id, {
        event: access.event,
        actor: {
          uid: access.profile.guestUid,
          name: access.profile.guestName,
          role: 'guest',
        },
      });
    });
    events.forEach((event) => {
      if (accountCanManageEvent(event, accountUser.uid, accountUser.email))
        targets.set(event.id, {
          event,
          actor: { uid: accountUser.uid, name: 'Host', role: 'host' },
        });
    });
    if (
      chatActor
      && menu.id !== EMPTY_EVENT_ID
      && !targets.has(menu.id)
      && (chatActor.role === 'guest' || chatActor.uid === accountUser.uid)
    )
      targets.set(menu.id, { event: menu, actor: chatActor });
    return [...targets.values()];
  }, [accountProfile, accountUser, chatActor, events, guestEvents, menu]);
  const chatUnreadTargetIdentity = notificationTargets
    .map(({ event, actor }) => `${event.id}:${actor.uid}`)
    .sort()
    .join('|');
  useEffect(() => {
    if (!firebaseConfigured || !accountUser || !chatUnreadTargetIdentity) {
      queueMicrotask(() => setEventNotificationCounts({}));
      return;
    }
    const stops: Array<() => void> = [];
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      notificationTargets.forEach(({ event, actor }) => {
        const query = store.query(
          store.collection(db, 'events', event.id, 'chat'),
          store.orderBy('createdAt', 'asc'),
        );
        stops.push(store.onSnapshot(query, (snapshot) => {
          const messages = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          } as ChatMessage));
          const lastReadId = localStorage.getItem(`gather-chat-read:${event.id}:${actor.uid}`);
          const lastReadIndex = lastReadId
            ? messages.findIndex((message) => message.id === lastReadId)
            : -1;
          const unread = messages
            .slice(lastReadIndex + 1)
            .filter((message) => message.authorUid !== actor.uid && !message.deleted)
            .length;
          setEventNotificationCounts((current) => current[event.id] === unread
            ? current
            : { ...current, [event.id]: unread });
        }, () => undefined));
      });
    })();
    return () => stops.forEach((stop) => stop());
  // The identity string keeps listeners stable while event objects receive live updates.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [accountUser, chatUnreadTargetIdentity]);
  const currentEventMuted = Boolean(accountProfile?.mutedEventIds.includes(menu.id));
  const pushActorUid = chatActorUid;
  useEffect(() => {
    queueMicrotask(() => setNotificationsDefaultEnabled(Boolean(
      accountUser && localStorage.getItem(globalPushKey(accountUser.uid)),
    )));
  }, [accountUser]);
  useEffect(() => {
    let nextState: PushNotificationState = 'disabled';
    if (!pushActorUid) {
      queueMicrotask(() => setPushNotificationState(nextState));
      return;
    }
    if (
      typeof Notification === 'undefined'
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
    ) {
      nextState = 'unsupported';
    } else if (Notification.permission === 'denied') {
      nextState = 'blocked';
    } else {
      const enabled = !currentEventMuted
        && Notification.permission === 'granted'
        && Boolean(localStorage.getItem(pushSubscriptionKey(menu.id, pushActorUid)));
      nextState = enabled ? 'enabled' : 'disabled';
    }
    queueMicrotask(() => setPushNotificationState(nextState));
  }, [accountUser, currentEventMuted, menu.id, pushActorUid]);

  const saveMutedEvents = useCallback(async (mutedEventIds: string[]) => {
    if (!accountUser) return;
    const [{ getApp }, store] = await Promise.all([
      import('firebase/app'), import('firebase/firestore'),
    ]);
    await store.updateDoc(store.doc(store.getFirestore(getApp()), 'users', accountUser.uid), {
      mutedEventIds,
      updatedAt: store.serverTimestamp(),
    });
  }, [accountUser]);

  const ensureBrowserPushSubscription = useCallback(async () => {
    const serviceWorker = serviceWorkerLocation();
    const registration = await navigator.serviceWorker.register(serviceWorker.url.href, {
      scope: serviceWorker.scope,
      updateViaCache: 'none',
    });
    await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    return existing || registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY),
    });
  }, []);

  const registerPushTarget = useCallback(async (
    target: { event: EventMenu; actor: ChatActor },
    serialized: PushSubscriptionJSON,
    subscriptionId: string,
  ) => {
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth)
      throw new Error('The browser returned an incomplete push subscription.');
    const [{ getApp }, store] = await Promise.all([
      import('firebase/app'), import('firebase/firestore'),
    ]);
    await store.setDoc(
      store.doc(store.getFirestore(getApp()), 'events', target.event.id, 'pushSubscriptions', subscriptionId),
      {
        endpoint: serialized.endpoint,
        expirationTime: serialized.expirationTime ?? null,
        keys: { p256dh: serialized.keys.p256dh, auth: serialized.keys.auth },
        actorUid: target.actor.uid,
        actorRole: target.actor.role,
        actorName: target.actor.name,
        createdAt: store.serverTimestamp(),
        updatedAt: store.serverTimestamp(),
      },
    );
    await callPushApi('subscribe', 'POST', {
      eventId: target.event.id,
      subscriptionId,
      subscription: serialized,
      actorUid: target.actor.uid,
      actorRole: target.actor.role,
      actorName: target.actor.name,
    });
    localStorage.setItem(pushSubscriptionKey(target.event.id, target.actor.uid), subscriptionId);
  }, []);

  const syncGlobalPushTargets = useCallback(async () => {
    if (
      isNativeIOSApp
      || typeof Notification === 'undefined'
      || !accountUser
      || Notification.permission !== 'granted'
      || !localStorage.getItem(globalPushKey(accountUser.uid))
    ) return;
    const subscription = await ensureBrowserPushSubscription();
    const serialized = subscription.toJSON();
    if (!serialized.endpoint) return;
    const subscriptionId = await sha256Text(serialized.endpoint);
    const muted = new Set(accountProfile?.mutedEventIds || []);
    await Promise.allSettled(notificationTargets
      .filter((target) => !muted.has(target.event.id))
      .map((target) => registerPushTarget(target, serialized, subscriptionId)));
  }, [accountProfile?.mutedEventIds, accountUser, ensureBrowserPushSubscription, isNativeIOSApp, notificationTargets, registerPushTarget]);

  useEffect(() => {
    if (isNativeIOSApp || !accountUser || !accountProfile || !notificationTargets.length) return;
    void syncGlobalPushTargets().catch(() => undefined);
  }, [accountProfile, accountUser, isNativeIOSApp, notificationTargets, syncGlobalPushTargets]);

  const notificationPermissionReady = () => {
    if (isNativeIOSApp) {
      notify('Notifications are managed by the iPhone app, not browser Web Push.');
      return false;
    }
    if (!firebaseConfigured || !VAPID_PUBLIC_KEY || !PUSH_NOTIFICATIONS_ENABLED) {
      notify('Push notifications are not configured for this release yet.');
      return false;
    }
    if (
      typeof Notification === 'undefined'
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
    ) {
      setPushNotificationState('unsupported');
      notify('This browser does not support web-app notifications.');
      return false;
    }
    if (isAppleMobileDevice() && !isStandalone) {
      notify('On iPhone or iPad, install Nights on the Home Screen before enabling notifications.');
      return false;
    }
    return true;
  };

  const enableChatNotifications = async () => {
    if (!accountUser || !chatActor || pushNotificationBusy || !notificationPermissionReady()) return;
    setPushNotificationBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushNotificationState(permission === 'denied' ? 'blocked' : 'disabled');
        notify(permission === 'denied'
          ? 'Notifications are blocked. Enable them for Nights in iPhone Settings.'
          : 'Notification permission was not enabled.');
        return;
      }
      const subscription = await ensureBrowserPushSubscription();
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth)
        throw new Error('The browser returned an incomplete push subscription.');
      const subscriptionId = await sha256Text(serialized.endpoint);
      if (currentEventMuted)
        await saveMutedEvents((accountProfile?.mutedEventIds || []).filter((eventId) => eventId !== menu.id));
      await registerPushTarget({ event: menu, actor: chatActor }, serialized, subscriptionId);
      setPushNotificationState('enabled');
      setShowNotificationPrompt(false);
      localStorage.setItem(notificationPromptKey(accountUser.uid), 'enabled');
      notify('Notifications are on for this event.');
    } catch (error) {
      setPushNotificationState('disabled');
      notify(error instanceof Error ? error.message : 'Could not enable notifications.');
    } finally {
      setPushNotificationBusy(false);
    }
  };

  const enableDefaultNotifications = async () => {
    if (!accountUser || pushNotificationBusy || !notificationPermissionReady()) return;
    setPushNotificationBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushNotificationState(permission === 'denied' ? 'blocked' : 'disabled');
        notify(permission === 'denied'
          ? 'Notifications are blocked. Enable them for Nights in device settings.'
          : 'Notification permission was not enabled.');
        return;
      }
      const subscription = await ensureBrowserPushSubscription();
      const serialized = subscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth)
        throw new Error('The browser returned an incomplete push subscription.');
      const subscriptionId = await sha256Text(serialized.endpoint);
      localStorage.setItem(globalPushKey(accountUser.uid), subscriptionId);
      setNotificationsDefaultEnabled(true);
      const muted = new Set(accountProfile?.mutedEventIds || []);
      await Promise.allSettled(notificationTargets
        .filter((target) => !muted.has(target.event.id))
        .map((target) => registerPushTarget(target, serialized, subscriptionId)));
      setShowNotificationPrompt(false);
      localStorage.setItem(notificationPromptKey(accountUser.uid), 'enabled');
      notify('New eligible events will notify you by default.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not enable default notifications.');
    } finally {
      setPushNotificationBusy(false);
    }
  };

  const disableDefaultNotifications = async () => {
    if (!accountUser || pushNotificationBusy) return;
    setPushNotificationBusy(true);
    try {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      await Promise.allSettled(notificationTargets.map(async (target) => {
        const storageKey = pushSubscriptionKey(target.event.id, target.actor.uid);
        const subscriptionId = localStorage.getItem(storageKey);
        if (!subscriptionId) return;
        try {
          await Promise.allSettled([
            store.deleteDoc(store.doc(db, 'events', target.event.id, 'pushSubscriptions', subscriptionId)),
            callPushApi('subscribe', 'DELETE', { eventId: target.event.id, subscriptionId }),
          ]);
        } finally {
          localStorage.removeItem(storageKey);
        }
      }));
      localStorage.removeItem(globalPushKey(accountUser.uid));
      await saveMutedEvents([]);
      setNotificationsDefaultEnabled(false);
      setPushNotificationState('disabled');
      notify('Default notifications are off. You can still enable individual events.');
    } finally {
      setPushNotificationBusy(false);
    }
  };

  const disableChatNotifications = async () => {
    if (!chatActor || !accountProfile || pushNotificationBusy) return;
    const storageKey = pushSubscriptionKey(menu.id, chatActor.uid);
    const subscriptionId = localStorage.getItem(storageKey);
    setPushNotificationBusy(true);
    try {
      if (firebaseConfigured && subscriptionId) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        await store.deleteDoc(store.doc(
          store.getFirestore(getApp()),
          'events',
          menu.id,
          'pushSubscriptions',
          subscriptionId,
        ));
        await callPushApi('subscribe', 'DELETE', { eventId: menu.id, subscriptionId });
      }
      localStorage.removeItem(storageKey);
      if (notificationsDefaultEnabled)
        await saveMutedEvents([...new Set([...accountProfile.mutedEventIds, menu.id])]);
      setPushNotificationState('disabled');
      notify('Notifications are off for this event.');
    } catch {
      notify('Could not turn off notifications. Try again.');
    } finally {
      setPushNotificationBusy(false);
    }
  };
  const adjustDemoRsvpActiveCount = (uid: string | undefined, delta: number) => {
    if (!uid) return;
    const nextRsvps = rsvps.map((entry) => entry.guestUid === uid
      ? { ...entry, activeOrderCount: Math.max(0, (entry.activeOrderCount || 0) + delta), updatedAt: Date.now() }
      : entry);
    setRsvps(nextRsvps);
    shareDemoUpdate({ type: 'rsvps', eventId: menu.id, value: nextRsvps });
    if (myRsvp?.guestUid === uid)
      setMyRsvp({ ...myRsvp, activeOrderCount: Math.max(0, (myRsvp.activeOrderCount || 0) + delta) });
  };
  const openInstallGuide = () => {
    if (mode === 'guest' && menu.id !== EMPTY_EVENT_ID) {
      const guestHome = guestHomeRoute();
      window.location.assign(`${guestHome}${guestHome.includes('?') ? '&' : '?'}install=1`);
      return;
    }
    setShowInstallGuide(true);
  };

  const normalizedAccountFields = () => {
    const firstName = accountFirstName.trim().replace(/\s+/g, ' ');
    const lastName = accountLastName.trim().replace(/\s+/g, ' ');
    const displayName = `${firstName} ${lastName}`.trim();
    const enteredPhone = normalizeOptionalPhone(accountPhone);
    if (firstName.length < 1 || firstName.length > 50) throw new Error('Enter your first name.');
    if (lastName.length < 1 || lastName.length > 60) throw new Error('Enter your last name.');
    if (!enteredPhone) throw new Error('Enter a 10-digit phone number, like 555-555-5555.');
    return { firstName, lastName, displayName, phone: `+1${phoneDigits(enteredPhone)}` };
  };

  const saveAccountProfile = async (accountOverride?: AccountUser) => {
    const currentAccount = accountOverride || accountUser;
    if (!currentAccount) throw new Error('Sign in before completing your profile.');
    const fields = normalizedAccountFields();
    const guestUid = await guestNameIndexId(fields.phone);
    const [{ getApp }, authModule, store] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const auth = authModule.getAuth(getApp());
    if (!auth.currentUser || auth.currentUser.uid !== currentAccount.uid)
      throw new Error('Your sign-in session expired. Sign in again.');
    const db = store.getFirestore(getApp());
    const email = normalizedAccountEmail(auth.currentUser.email || accountEmail);
    const profileRef = store.doc(db, 'users', currentAccount.uid);
    const identityRef = store.doc(db, 'guest-identities', guestUid);
    const phoneRef = store.doc(db, 'account-phones', await guestNameIndexId(fields.phone));
    const emailRef = store.doc(db, 'account-emails', await guestNameIndexId(email));
    const directoryRef = store.doc(db, 'account-directory', currentAccount.uid);
    const verificationExpiresAt = currentAccount.emailVerified
      ? null
      : store.Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60 * 1000);
    try {
      await store.runTransaction(db, async (transaction) => {
        const [existing, identity, phoneIdentity] = await Promise.all([
          transaction.get(profileRef),
          transaction.get(identityRef),
          transaction.get(phoneRef),
        ]);
        if (identity.exists() && identity.data().accountUid !== currentAccount.uid)
          throw new Error('That phone number is already connected to another Nights account.');
        if (phoneIdentity.exists() && phoneIdentity.data().accountUid !== currentAccount.uid)
          throw new Error('That phone number is already connected to another Nights account.');
        if (!identity.exists()) transaction.set(identityRef, {
          accountUid: currentAccount.uid,
          phone: fields.phone,
          createdAt: store.serverTimestamp(),
        });
        transaction.set(phoneRef, {
          accountUid: currentAccount.uid,
          guestUid,
          phone: fields.phone,
          updatedAt: store.serverTimestamp(),
        });
        transaction.set(profileRef, {
          uid: currentAccount.uid,
          email,
          ...fields,
          guestUid,
          membershipTier: 'free' as const,
          membershipStatus: 'active' as const,
          mutedEventIds: existing.exists() && Array.isArray(existing.data().mutedEventIds)
            ? existing.data().mutedEventIds
            : [],
          emailVerified: currentAccount.emailVerified,
          verificationExpiresAt,
          createdAt: existing.exists() ? existing.data().createdAt : store.serverTimestamp(),
          updatedAt: store.serverTimestamp(),
        });
        transaction.set(emailRef, {
          accountUid: currentAccount.uid,
          email,
          guestUid,
          updatedAt: store.serverTimestamp(),
        }, { merge: true });
        transaction.set(directoryRef, {
          uid: currentAccount.uid,
          email,
          ...fields,
          guestUid,
          updatedAt: store.serverTimestamp(),
        }, { merge: true });
      });
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      if (code === 'permission-denied' || code === 'firestore/permission-denied')
        throw new Error('That phone number is connected to an account with a different email address.');
      throw error;
    }
    await authModule.updateProfile(auth.currentUser, {
      displayName: fields.displayName,
    });
    setAccountAuthMode('signin');
    if (!accountNeedsEmailVerification(currentAccount))
      notify('Your Nights account is ready.');
  };

  const accountActionUrl = (action: 'verify' | 'reset') => {
    const route = mode === 'host' ? hostHomeRoute() : guestHomeRoute();
    const url = new URL(route, window.location.origin);
    url.searchParams.set(action, '1');
    return url.toString();
  };

  const signUpWithEmail = async () => {
    const email = accountEmail.trim().toLowerCase();
    let verificationSent = false;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notify('Enter a valid email address.');
      return;
    }
    if (accountPassword.length < 8) {
      notify('Use a password with at least 8 characters.');
      return;
    }
    try {
      normalizedAccountFields();
      setAccountAuthBusy(true);
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      const auth = authModule.getAuth(getApp());
      const credential = await authModule.createUserWithEmailAndPassword(auth, email, accountPassword);
      setAccountUser({
        uid: credential.user.uid,
        email,
        emailVerified: credential.user.emailVerified,
        providerIds: credential.user.providerData.map((provider) => provider.providerId),
      });
      await authModule.updateProfile(credential.user, {
        displayName: `${accountFirstName.trim()} ${accountLastName.trim()}`,
      });
      await authModule.sendEmailVerification(credential.user);
      verificationSent = true;
      await saveAccountProfile({
        uid: credential.user.uid,
        email,
        emailVerified: credential.user.emailVerified,
        providerIds: credential.user.providerData.map((provider) => provider.providerId),
      });
      setAccountPassword('');
      notify(`Verification email sent to ${email}.`);
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      if (verificationSent) {
        setAccountPassword('');
        notify(`Verification email sent to ${email}. Finish verification, then complete your profile.`);
      } else notify(code === 'auth/email-already-in-use'
        ? 'That email already has an account. Sign in instead.'
        : code === 'auth/operation-not-allowed'
          ? 'Email sign-up still needs to be enabled in Firebase Authentication.'
          : code === 'auth/too-many-requests'
            ? 'Too many verification attempts. Wait a few minutes and try again.'
          : error instanceof Error ? error.message : 'Could not create your account.');
    } finally {
      setAccountAuthBusy(false);
    }
  };

  const signInWithEmail = async () => {
    const email = accountEmail.trim().toLowerCase();
    if (!email || !accountPassword) {
      notify('Enter your email and password.');
      return;
    }
    setAccountAuthBusy(true);
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      await authModule.signInWithEmailAndPassword(
        authModule.getAuth(getApp()), email, accountPassword,
      );
      setAccountPassword('');
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(code === 'auth/operation-not-allowed'
        ? 'Email sign-in still needs to be enabled in Firebase Authentication.'
        : 'That email and password did not match.');
    } finally {
      setAccountAuthBusy(false);
    }
  };

  const signInWithProvider = async (providerName: 'google' | 'apple') => {
    setAccountAuthBusy(true);
    const nativeAuth = providerName === 'google' && typeof window !== 'undefined'
      && navigator.userAgent.includes('Nights-iOS/')
      ? (window as NightsNativeWindow).webkit?.messageHandlers?.nightsAuth
      : undefined;
    if (nativeAuth) {
      try {
        nativeAuth.postMessage({ provider: providerName });
      } catch {
        setAccountAuthBusy(false);
        notify(`${providerName === 'apple' ? 'Apple' : 'Google'} sign-in could not be opened.`);
      }
      return;
    }
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      const provider = providerName === 'google'
        ? new authModule.GoogleAuthProvider()
        : new authModule.OAuthProvider('apple.com');
      provider.setCustomParameters(providerName === 'google'
        ? { prompt: 'select_account' }
        : { locale: 'en' });
      if (providerName === 'apple' && provider instanceof authModule.OAuthProvider)
        provider.addScope('email');
      const auth = authModule.getAuth(getApp());
      const result = await authModule.signInWithPopup(auth, provider);
      if (!result.user.email) notify('Add an email to your Apple account before continuing.');
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(code === 'auth/popup-closed-by-user'
        ? 'Sign-in was closed before it finished.'
        : code === 'auth/popup-blocked'
          ? 'Allow pop-ups for Nights, then try signing in again.'
        : code === 'auth/operation-not-allowed'
          ? `${providerName === 'apple' ? 'Apple' : 'Google'} sign-in still needs to be enabled in Firebase Authentication.`
          : code === 'auth/account-exists-with-different-credential'
            ? 'An account already exists for that email. Sign in with its original method first.'
            : `${providerName === 'apple' ? 'Apple' : 'Google'} sign-in could not be completed.`);
    } finally {
      setAccountAuthBusy(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.userAgent.includes('Nights-iOS/')) return;
    const nativeWindow = window as NightsNativeWindow;
    nativeWindow.__nightsNativeAuth = {
      completeGoogle: (idToken, accessToken) => {
        void (async () => {
          try {
            const [{ getApp }, authModule] = await Promise.all([
              import('firebase/app'), import('firebase/auth'),
            ]);
            const credential = authModule.GoogleAuthProvider.credential(idToken, accessToken);
            await authModule.signInWithCredential(authModule.getAuth(getApp()), credential);
          } catch (error) {
            const code = (error as { code?: string }).code || '';
            notify(code === 'auth/account-exists-with-different-credential'
              ? 'An account already exists for that email. Sign in with its original method first.'
              : 'Google sign-in could not be completed.');
          } finally {
            setAccountAuthBusy(false);
          }
        })();
      },
      completeApple: (idToken, rawNonce) => {
        void (async () => {
          try {
            const [{ getApp }, authModule] = await Promise.all([
              import('firebase/app'), import('firebase/auth'),
            ]);
            const provider = new authModule.OAuthProvider('apple.com');
            const credential = provider.credential({ idToken, rawNonce });
            const result = await authModule.signInWithCredential(authModule.getAuth(getApp()), credential);
            if (!result.user.email) notify('Add an email to your Apple account before continuing.');
          } catch (error) {
            const code = (error as { code?: string }).code || '';
            notify(code === 'auth/account-exists-with-different-credential'
              ? 'An account already exists for that email. Sign in with its original method first.'
              : 'Apple sign-in could not be completed.');
          } finally {
            setAccountAuthBusy(false);
          }
        })();
      },
      fail: message => {
        setAccountAuthBusy(false);
        notify(message || 'Sign-in could not be completed.');
      },
    };
    return () => {
      delete nativeWindow.__nightsNativeAuth;
    };
  }, []);

  const resetAccountPassword = async () => {
    const email = accountEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notify('Enter your email first, then choose Forgot password.');
      return;
    }
    setAccountAuthBusy(true);
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      await authModule.sendPasswordResetEmail(authModule.getAuth(getApp()), email, {
        url: accountActionUrl('reset'),
        handleCodeInApp: false,
      });
      setAccountRecoverySentTo(email);
      notify('If that email has a password account, a recovery link is on its way.');
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      notify(code === 'auth/invalid-email'
        ? 'Enter a valid email address.'
        : code === 'auth/too-many-requests'
          ? 'Too many recovery attempts. Wait a few minutes and try again.'
          : 'Could not send the recovery email. Try again.');
    } finally {
      setAccountAuthBusy(false);
    }
  };

  const resendAccountVerification = async () => {
    setAccountAuthBusy(true);
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      const user = authModule.getAuth(getApp()).currentUser;
      if (!user) throw new Error('Sign in again to verify your email.');
      await authModule.sendEmailVerification(user);
      notify(`A new verification email was sent to ${user.email || accountEmail}.`);
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      notify(code === 'auth/too-many-requests'
        ? 'Too many verification emails were requested. Wait a few minutes and try again.'
        : error instanceof Error ? error.message : 'Could not resend the verification email.');
    } finally {
      setAccountAuthBusy(false);
    }
  };

  const changeUnverifiedAccountEmail = async (replacementEmail: string) => {
    const email = normalizedAccountEmail(replacementEmail);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      notify('Enter a valid email address.');
      return;
    }
    setAccountAuthBusy(true);
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      const user = authModule.getAuth(getApp()).currentUser;
      if (!user || user.uid !== accountUser?.uid) throw new Error('Sign in again before changing your email.');
      if (email === normalizedAccountEmail(user.email || ''))
        throw new Error('Enter a different email address.');
      await authModule.verifyBeforeUpdateEmail(user, email, {
        url: accountActionUrl('verify'),
        handleCodeInApp: false,
      });
      notify(`Verification sent to ${email}. Open that email to finish the change.`);
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      notify(code === 'auth/email-already-in-use'
        ? 'That email already belongs to another account.'
        : code === 'auth/requires-recent-login'
          ? 'Sign out, sign back in with your current email and password, then change the email.'
          : code === 'auth/invalid-new-email'
            ? 'Enter a valid email address.'
            : error instanceof Error ? error.message : 'Could not send the replacement verification email.');
    } finally {
      setAccountAuthBusy(false);
    }
  };

  const openAccountProfileEditor = () => {
    if (!accountProfile || !accountUser) return;
    setProfileFirstName(accountProfile.firstName || '');
    setProfileLastName(accountProfile.lastName || '');
    setProfileDisplayName(accountDisplayName(accountProfile));
    setProfilePhone(formatPhone(accountProfile.phone || ''));
    setProfileEmail(accountUser.email || accountProfile.email || '');
    setProfileMenuOpen(false);
    setProfileEditorOpen(true);
  };

  const openMoneyDetails = (direction: 'owed' | 'owes', returnTo: 'menu' | 'editor') => {
    setMoneyDetailsReturnTo(returnTo);
    setProfileMenuOpen(false);
    setProfileEditorOpen(false);
    setMoneyDetailsOpen(direction);
  };

  const closeMoneyDetails = () => {
    const returnTo = moneyDetailsReturnTo;
    setMoneyDetailsOpen(null);
    setMoneyDetailsReturnTo(null);
    if (returnTo === 'menu') setProfileMenuOpen(true);
    if (returnTo === 'editor') setProfileEditorOpen(true);
  };

  const saveAccountProfileEdits = async () => {
    if (!accountProfile || !accountUser) return;
    const firstName = profileFirstName.trim().replace(/\s+/g, ' ');
    const lastName = profileLastName.trim().replace(/\s+/g, ' ');
    const displayName = profileDisplayName.trim().replace(/\s+/g, ' ') || `${firstName} ${lastName}`.trim();
    const enteredPhone = normalizeOptionalPhone(profilePhone);
    const email = normalizedAccountEmail(profileEmail);
    if (firstName.length < 1 || firstName.length > 50) return notify('Enter your first name.');
    if (lastName.length < 1 || lastName.length > 60) return notify('Enter your last name.');
    if (displayName.length < 2 || displayName.length > 80) return notify('Enter a display name between 2 and 80 characters.');
    if (!enteredPhone) return notify('Enter a 10-digit phone number, like 555-555-5555.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return notify('Enter a valid email address.');
    const phone = `+1${phoneDigits(enteredPhone)}`;
    const emailChanged = email !== normalizedAccountEmail(accountUser.email || accountProfile.email);
    setProfileEditorBusy(true);
    try {
      const [{ getApp }, authModule, store] = await Promise.all([
        import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
      ]);
      const auth = authModule.getAuth(getApp());
      const user = auth.currentUser;
      if (!user || user.uid !== accountUser.uid) throw new Error('Sign in again before editing your profile.');
      const db = store.getFirestore(getApp());
      const userRef = store.doc(db, 'users', accountUser.uid);
      const directoryRef = store.doc(db, 'account-directory', accountUser.uid);
      const identityRef = store.doc(db, 'guest-identities', accountProfile.guestUid);
      const oldPhoneRef = store.doc(db, 'account-phones', await guestNameIndexId(accountProfile.phone));
      const nextPhoneRef = store.doc(db, 'account-phones', await guestNameIndexId(phone));
      const connectedEventIds = [...new Set(guestEvents.map((access) => access.event.id))];
      const nextEventNameHash = await guestNameIndexId(displayName);
      const eventNameClaims = await Promise.all(connectedEventIds.map((eventId) => store.getDoc(
        store.doc(db, 'events', eventId, 'guest-names', nextEventNameHash),
      )));
      if (eventNameClaims.some((claim) => claim.exists() && claim.data().guestUid !== accountProfile.guestUid))
        throw new Error('event-name-taken');
      await store.runTransaction(db, async (transaction) => {
        const [nextPhoneIndex, oldPhoneIndex] = await Promise.all([
          transaction.get(nextPhoneRef), transaction.get(oldPhoneRef),
        ]);
        if (nextPhoneIndex.exists() && nextPhoneIndex.data().accountUid !== accountUser.uid)
          throw new Error('phone-taken');
        transaction.update(identityRef, { phone });
        transaction.update(userRef, {
          firstName, lastName, displayName, phone, updatedAt: store.serverTimestamp(),
        });
        transaction.set(directoryRef, {
          uid: accountUser.uid,
          email: accountUser.email,
          firstName,
          lastName,
          displayName,
          phone,
          guestUid: accountProfile.guestUid,
          updatedAt: store.serverTimestamp(),
        });
        transaction.set(nextPhoneRef, {
          accountUid: accountUser.uid,
          guestUid: accountProfile.guestUid,
          phone,
          updatedAt: store.serverTimestamp(),
        });
        if (oldPhoneRef.path !== nextPhoneRef.path && oldPhoneIndex.exists()
          && oldPhoneIndex.data().accountUid === accountUser.uid) transaction.delete(oldPhoneRef);
      });
      const eventSyncResults = await Promise.allSettled(connectedEventIds.map((eventId) =>
        store.runTransaction(db, async (transaction) => {
          const eventAccess = guestEvents.find((access) => access.event.id === eventId);
          const profileRef = store.doc(db, 'events', eventId, 'guests', accountProfile.guestUid);
          const rsvpRef = store.doc(db, 'events', eventId, 'rsvps', accountProfile.guestUid);
          const [savedProfile, savedRsvp] = await Promise.all([
            transaction.get(profileRef), transaction.get(rsvpRef),
          ]);
          if (!savedProfile.exists() && !savedRsvp.exists()) return;
          const oldName = savedProfile.data()?.guestName || savedRsvp.data()?.guestName || '';
          const oldPhone = savedProfile.data()?.guestPhone || savedRsvp.data()?.guestPhone || '';
          const nextNameRef = store.doc(db, 'events', eventId, 'guest-names', nextEventNameHash);
          const nextPhoneRef = store.doc(db, 'events', eventId, 'guest-phones', await guestNameIndexId(phone));
          const oldNameRef = oldName && guestNameKey(oldName) !== guestNameKey(displayName)
            ? store.doc(db, 'events', eventId, 'guest-names', await guestNameIndexId(oldName))
            : null;
          const oldEventPhoneRef = oldPhone && oldPhone !== phone
            ? store.doc(db, 'events', eventId, 'guest-phones', await guestNameIndexId(oldPhone))
            : null;
          const [nextNameClaim, nextPhoneClaim, oldNameClaim, oldPhoneClaim] = await Promise.all([
            transaction.get(nextNameRef), transaction.get(nextPhoneRef),
            oldNameRef ? transaction.get(oldNameRef) : Promise.resolve(null),
            oldEventPhoneRef ? transaction.get(oldEventPhoneRef) : Promise.resolve(null),
          ]);
          if (nextNameClaim.exists() && nextNameClaim.data().guestUid !== accountProfile.guestUid)
            throw new Error('event-name-taken');
          if (nextPhoneClaim.exists() && nextPhoneClaim.data().guestUid !== accountProfile.guestUid)
            throw new Error('event-phone-taken');
          if (!nextNameClaim.exists()) transaction.set(nextNameRef, {
            guestUid: accountProfile.guestUid,
            guestName: displayName,
            createdAt: store.serverTimestamp(),
          });
          if (!nextPhoneClaim.exists()) transaction.set(nextPhoneRef, {
            guestUid: accountProfile.guestUid,
            guestPhone: phone,
            createdAt: store.serverTimestamp(),
          });
          if (oldNameRef && oldNameClaim?.data()?.guestUid === accountProfile.guestUid)
            transaction.delete(oldNameRef);
          if (oldEventPhoneRef && oldPhoneClaim?.data()?.guestUid === accountProfile.guestUid)
            transaction.delete(oldEventPhoneRef);
          if (savedProfile.exists()) transaction.update(profileRef, {
            guestName: displayName,
            guestPhone: phone,
            updatedAt: store.serverTimestamp(),
          });
          if (savedRsvp.exists()) transaction.update(rsvpRef, {
            guestName: displayName,
            guestPhone: phone,
            approvalStatus: savedRsvp.data().approvalStatus || (
              !eventAccess?.event.requireGuestApproval
              || savedRsvp.data().status !== 'yes'
              || Boolean(eventAccess.invitation)
              || Boolean(eventAccess.hosted)
                ? 'approved'
                : 'pending'
            ),
            updatedAt: store.serverTimestamp(),
          });
        }),
      ));
      if (eventSyncResults.some((result) => result.status === 'rejected'))
        throw new Error('Your account was updated, but one event could not refresh your guest ticket. Try saving once more.');
      await authModule.updateProfile(user, { displayName });
      const nextSession: GuestSession = {
        ...guestSession,
        authUid: accountUser.uid,
        email: accountUser.email,
        guestUid: accountProfile.guestUid,
        guestName: displayName,
        guestPhone: phone,
      };
      writeGuestSession(nextSession);
      setGuestSession(nextSession);
      setGuestName(displayName);
      setPhoneNumber(formatPhone(phone));
      setGuestProfile((current) => current ? { ...current, guestName: displayName, guestPhone: phone } : current);
      setMyRsvp((current) => current ? { ...current, guestName: displayName, guestPhone: phone } : current);
      setGuestEvents((current) => current.map((access) => ({
        ...access,
        profile: { ...access.profile, guestName: displayName, guestPhone: phone },
        rsvp: access.rsvp ? { ...access.rsvp, guestName: displayName, guestPhone: phone } : null,
      })));
      setProfileEditorOpen(false);
      if (emailChanged) {
        await changeUnverifiedAccountEmail(email);
      } else {
        notify('Profile updated.');
      }
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      notify((error as Error).message === 'phone-taken'
        ? 'That phone number is already connected to another Nights account.'
        : (error as Error).message === 'event-name-taken'
          ? 'That display name is already used in one of your events. Choose a different display name.'
        : code.includes('permission-denied')
          ? 'Your profile could not be updated. Refresh and try again.'
          : error instanceof Error ? error.message : 'Profile could not be updated.');
    } finally {
      setProfileEditorBusy(false);
    }
  };

  const checkAccountVerification = async () => {
    setAccountAuthBusy(true);
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      const auth = authModule.getAuth(getApp());
      if (!auth.currentUser) throw new Error('Sign in again to verify your email.');
      await authModule.reload(auth.currentUser);
      const user = auth.currentUser;
      if (!user.emailVerified) {
        notify('Email is not verified yet. Open the link in your email, then check again.');
        return;
      }
      await user.getIdToken(true);
      const verifiedEmail = normalizedAccountEmail(user.email || '');
      if (accountProfile && verifiedEmail && normalizedAccountEmail(accountProfile.email) !== verifiedEmail) {
        const store = await import('firebase/firestore');
        const db = store.getFirestore(getApp());
        const oldEmail = normalizedAccountEmail(accountProfile.email);
        const oldEmailRef = store.doc(db, 'account-emails', await guestNameIndexId(oldEmail));
        const newEmailRef = store.doc(db, 'account-emails', await guestNameIndexId(verifiedEmail));
        const userRef = store.doc(db, 'users', user.uid);
        const directoryRef = store.doc(db, 'account-directory', user.uid);
        await store.runTransaction(db, async (transaction) => {
          const [oldEmailDocument, newEmailDocument] = await Promise.all([
            transaction.get(oldEmailRef), transaction.get(newEmailRef),
          ]);
          if (newEmailDocument.exists() && newEmailDocument.data().accountUid !== user.uid)
            throw new Error('That email is already connected to another Nights account.');
          transaction.update(userRef, {
            email: verifiedEmail,
            emailVerified: true,
            verificationExpiresAt: null,
            updatedAt: store.serverTimestamp(),
          });
          transaction.set(directoryRef, {
            uid: user.uid,
            email: verifiedEmail,
            firstName: accountProfile.firstName,
            lastName: accountProfile.lastName,
            displayName: accountDisplayName(accountProfile),
            phone: accountProfile.phone,
            guestUid: accountProfile.guestUid,
            updatedAt: store.serverTimestamp(),
          });
          transaction.set(newEmailRef, {
            accountUid: user.uid,
            email: verifiedEmail,
            guestUid: accountProfile.guestUid,
            updatedAt: store.serverTimestamp(),
          });
          if (oldEmailDocument.exists() && oldEmailDocument.data().accountUid === user.uid)
            transaction.delete(oldEmailRef);
        });
        setAccountEmail(verifiedEmail);
      } else if (accountProfile) {
        const store = await import('firebase/firestore');
        await store.updateDoc(store.doc(store.getFirestore(getApp()), 'users', user.uid), {
          emailVerified: true,
          verificationExpiresAt: null,
          updatedAt: store.serverTimestamp(),
        });
      }
      const verifiedAccount: AccountUser = {
        uid: user.uid,
        email: user.email || '',
        emailVerified: true,
        providerIds: user.providerData.map((provider) => provider.providerId),
      };
      setAccountUser(verifiedAccount);
      if (accountProfile) setHostUser(user.uid);
      const url = new URL(window.location.href);
      url.searchParams.delete('verify');
      history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      notify('Email verified. Welcome to Nights.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not confirm email verification.');
    } finally {
      setAccountAuthBusy(false);
    }
  };

  const completeProviderProfile = async () => {
    setAccountAuthBusy(true);
    try {
      await saveAccountProfile();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setAccountAuthBusy(false);
    }
  };

  const signOutAccount = async () => {
    const destination = mode === 'host' ? hostHomeRoute() : guestHomeRoute();
    if (firebaseConfigured) {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'), import('firebase/auth'),
      ]);
      await authModule.signOut(authModule.getAuth(getApp()));
    }
    writeGuestSession(null);
    setGuestSession(null);
    setAccountProfile(null);
    setAccountUser(null);
    setHostUser(null);
    window.location.assign(destination);
  };
  const deleteAccountPermanently = async () => {
    if (!accountUser) return;
    setDeleteAccountBusy(true);
    try {
      const [{ getApp }, authModule, store, storageModule] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
        import('firebase/storage'),
      ]);
      const auth = authModule.getAuth(getApp());
      const user = auth.currentUser;
      if (!user || user.uid !== accountUser.uid) throw new Error('Sign in again before deleting your account.');
      const signedInAt = Date.parse(user.metadata.lastSignInTime || '');
      if (!Number.isFinite(signedInAt) || Date.now() - signedInAt > 4 * 60 * 1000) {
        if (accountUser.providerIds.includes('password')) {
          throw new Error('For security, sign out and sign in again immediately before deleting your account.');
        } else if (accountUser.providerIds.includes('google.com')) {
          await authModule.reauthenticateWithPopup(user, new authModule.GoogleAuthProvider());
        } else if (accountUser.providerIds.includes('apple.com')) {
          const provider = new authModule.OAuthProvider('apple.com');
          provider.addScope('email');
          await authModule.reauthenticateWithPopup(user, provider);
        } else {
          throw new Error('Sign out, sign back in, and delete the account within four minutes.');
        }
      }

      if (!accountProfile) {
        await authModule.deleteUser(user);
        Object.keys(localStorage)
          .filter((key) => key.startsWith('gather-') || key.startsWith('nights-'))
          .forEach((key) => localStorage.removeItem(key));
        window.location.assign(guestHomeRoute());
        return;
      }

      const idToken = await user.getIdToken(true);
      await callPushApi('account', 'DELETE', { guestUid: accountProfile.guestUid }, idToken);

      const db = store.getFirestore(getApp());
      const userRef = store.doc(db, 'users', accountUser.uid);
      type DocumentReference = typeof userRef;
      const deleteRefs = new Map<string, DocumentReference>();
      const addDelete = (reference: DocumentReference) => deleteRefs.set(reference.path, reference);
      const messageUpdates: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
      const commitDeletes = async (references: DocumentReference[]) => {
        for (let index = 0; index < references.length; index += 400) {
          const batch = store.writeBatch(db);
          references.slice(index, index + 400).forEach((reference) => batch.delete(reference));
          await batch.commit();
        }
      };
      const commitUpdates = async () => {
        for (let index = 0; index < messageUpdates.length; index += 300) {
          const batch = store.writeBatch(db);
          messageUpdates.slice(index, index + 300).forEach(({ ref, data }) => batch.update(ref, data));
          await batch.commit();
        }
      };

      const [eventSnapshot, receivedInvitations, ownContacts, sentInvitations, referringContacts] = await Promise.all([
        store.getDocs(store.collection(db, 'events')),
        store.getDocs(store.collection(db, 'users', accountUser.uid, 'invitations')),
        store.getDocs(store.collection(db, 'users', accountUser.uid, 'contacts')),
        store.getDocs(store.query(
          store.collectionGroup(db, 'invitations'),
          store.where('hostUid', '==', accountUser.uid),
        )),
        store.getDocs(store.query(
          store.collectionGroup(db, 'contacts'),
          store.where('accountUid', '==', accountUser.uid),
        )),
      ]);
      receivedInvitations.docs.forEach((document) => addDelete(document.ref));
      ownContacts.docs.forEach((document) => addDelete(document.ref));
      sentInvitations.docs.forEach((document) => addDelete(document.ref));
      referringContacts.docs.forEach((document) => addDelete(document.ref));

      for (const eventDocument of eventSnapshot.docs) {
        const event = { id: eventDocument.id, ...eventDocument.data() } as EventMenu;
        const legacyOwned = event.ownerUid === LEGACY_HOST_UID
          && normalizedAccountEmail(accountProfile.email) === normalizedAccountEmail(HOST_EMAIL || '');
        if (event.ownerUid === accountUser.uid || legacyOwned) {
          const collections = await Promise.all([
            'orders', 'rsvps', 'guests', 'guest-names', 'guest-phones',
            'name-index', 'pushSubscriptions', 'chat', 'expense-participants', 'expenses',
          ].map((collectionName) => store.getDocs(
            store.collection(db, 'events', event.id, collectionName),
          )));
          await Promise.allSettled(collections.flatMap((snapshot) => snapshot.docs)
            .map((document) => document.data().receiptPath as string | undefined)
            .filter((path): path is string => Boolean(path))
            .map((path) => storageModule.deleteObject(storageModule.ref(storageModule.getStorage(getApp()), path))));
          collections.flatMap((snapshot) => snapshot.docs).forEach((document) => addDelete(document.ref));
          const publicPath = normalizedPublicEventPath(event.publicPath);
          const claimId = event.publicPathClaimId || (publicPath ? await guestNameIndexId(publicPath) : '');
          if (claimId) addDelete(store.doc(db, 'public-paths', claimId));
          addDelete(eventDocument.ref);
          continue;
        }

        const profileRef = store.doc(db, 'events', event.id, 'guests', accountProfile.guestUid);
        const rsvpRef = store.doc(db, 'events', event.id, 'rsvps', accountProfile.guestUid);
        const [profileDocument, rsvpDocument, orderSnapshot, chatSnapshot, participantSnapshot, expenseSnapshot] = await Promise.all([
          store.getDoc(profileRef),
          store.getDoc(rsvpRef),
          store.getDocs(store.query(
            store.collection(db, 'events', event.id, 'orders'),
            store.where('guestUid', '==', accountProfile.guestUid),
          )),
          store.getDocs(store.collection(db, 'events', event.id, 'chat')),
          store.getDocs(store.query(
            store.collection(db, 'events', event.id, 'expense-participants'),
            store.where('accountUid', '==', accountUser.uid),
          )),
          store.getDocs(store.query(
            store.collection(db, 'events', event.id, 'expenses'),
            store.where('submittedByAccountUid', '==', accountUser.uid),
          )),
        ]);
        const profile = profileDocument.data();
        const authoredMessageIds = new Set(chatSnapshot.docs
          .filter((document) => document.data().authorUid === accountProfile.guestUid)
          .map((document) => document.id));
        chatSnapshot.docs.forEach((document) => {
          const message = document.data() as ChatMessage;
          if (message.authorUid === accountProfile.guestUid) {
            addDelete(document.ref);
            return;
          }
          const reactions = { ...message.reactions };
          const pollVotes = { ...message.pollVotes };
          const pollVoterNames = { ...message.pollVoterNames };
          let changed = false;
          if (accountProfile.guestUid in reactions) { delete reactions[accountProfile.guestUid]; changed = true; }
          if (accountProfile.guestUid in pollVotes) { delete pollVotes[accountProfile.guestUid]; changed = true; }
          if (accountProfile.guestUid in pollVoterNames) { delete pollVoterNames[accountProfile.guestUid]; changed = true; }
          const removeReply = Boolean(message.replyTo?.id && authoredMessageIds.has(message.replyTo.id));
          if (removeReply) changed = true;
          if (changed) messageUpdates.push({
            ref: document.ref,
            data: {
              reactions,
              pollVotes,
              pollVoterNames,
              ...(removeReply ? { replyTo: null } : {}),
              updatedAt: store.serverTimestamp(),
              lastActorUid: accountProfile.guestUid,
              lastActorRole: 'guest',
            },
          });
        });
        orderSnapshot.docs.forEach((document) => addDelete(document.ref));
        participantSnapshot.docs.forEach((document) => addDelete(document.ref));
        expenseSnapshot.docs.forEach((document) => addDelete(document.ref));
        await Promise.allSettled(expenseSnapshot.docs
          .map((document) => document.data().receiptPath as string | undefined)
          .filter((path): path is string => Boolean(path))
          .map((path) => storageModule.deleteObject(storageModule.ref(storageModule.getStorage(getApp()), path))));
        if (profile) {
          const nameClaimRef = store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(profile.guestName));
          const phoneClaimRef = store.doc(db, 'events', event.id, 'guest-phones', await guestNameIndexId(profile.guestPhone));
          const [nameClaim, phoneClaim] = await Promise.all([
            store.getDoc(nameClaimRef), store.getDoc(phoneClaimRef),
          ]);
          if (nameClaim.exists()) addDelete(nameClaimRef);
          if (phoneClaim.exists()) addDelete(phoneClaimRef);
        }
        const subscriptionId = localStorage.getItem(pushSubscriptionKey(event.id, accountProfile.guestUid));
        if (subscriptionId) {
          const subscriptionRef = store.doc(db, 'events', event.id, 'pushSubscriptions', subscriptionId);
          const subscription = await store.getDoc(subscriptionRef);
          if (subscription.exists()) addDelete(subscriptionRef);
        }
        if (rsvpDocument.exists()) addDelete(rsvpRef);
        if (profileDocument.exists()) addDelete(profileRef);
      }

      await commitUpdates();
      await commitDeletes([...deleteRefs.values()]);
      const finalBatch = store.writeBatch(db);
      const accountEmailRef = store.doc(db, 'account-emails', await guestNameIndexId(normalizedAccountEmail(accountProfile.email)));
      const directoryRef = store.doc(db, 'account-directory', accountUser.uid);
      const [accountEmailDocument, directoryDocument] = await Promise.all([
        store.getDoc(accountEmailRef), store.getDoc(directoryRef),
      ]);
      if (accountEmailDocument.exists()) finalBatch.delete(accountEmailRef);
      if (directoryDocument.exists()) finalBatch.delete(directoryRef);
      finalBatch.delete(store.doc(db, 'account-phones', await guestNameIndexId(accountProfile.phone)));
      finalBatch.delete(store.doc(db, 'guest-identities', accountProfile.guestUid));
      finalBatch.delete(userRef);
      await finalBatch.commit();
      await authModule.deleteUser(user);

      Object.keys(localStorage)
        .filter((key) => key.startsWith('gather-') || key.startsWith('nights-'))
        .forEach((key) => localStorage.removeItem(key));
      setDeleteAccountOpen(false);
      window.location.assign(guestHomeRoute());
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      notify(code === 'auth/requires-recent-login'
        ? 'Sign out, sign back in, then delete the account again.'
        : error instanceof Error ? error.message : 'Account deletion could not be completed.');
    } finally {
      setDeleteAccountBusy(false);
    }
  };
  const inviteRegisteredGuest = async (event: EventMenu, identifier: string, optionalName = '') => {
    if (!accountUser || !accountProfile) return false;
    const value = identifier.trim();
    const isEmail = value.includes('@');
    const formattedPhone = isEmail ? null : normalizeOptionalPhone(value);
    const email = isEmail ? normalizedAccountEmail(value) : '';
    if ((isEmail && !/^\S+@\S+\.\S+$/.test(email)) || (!isEmail && !formattedPhone)) {
      notify('Enter a registered email or a complete phone number');
      return false;
    }
    try {
      const [{ getApp }, authModule, store] = await Promise.all([
        import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      let targetUid = '';
      if (isEmail) {
        const emailIndex = await store.getDoc(
          store.doc(db, 'account-emails', await guestNameIndexId(email)),
        );
        targetUid = emailIndex.data()?.accountUid || '';
      } else {
        const normalizedPhone = `+1${phoneDigits(formattedPhone || '')}`;
        const phoneHash = await guestNameIndexId(normalizedPhone);
        const phoneIndex = await store.getDoc(store.doc(db, 'account-phones', phoneHash));
        const legacyPhoneIndex = phoneIndex.exists()
          ? null
          : await store.getDoc(store.doc(db, 'guest-identities', phoneHash));
        targetUid = phoneIndex.data()?.accountUid || legacyPhoneIndex?.data()?.accountUid || '';
      }
      if (!targetUid) {
        if (isEmail) throw new Error('not-registered-email');
        const normalizedPhone = `+1${phoneDigits(formattedPhone || '')}`;
        const recipientGuestUid = await guestNameIndexId(normalizedPhone);
        const invitationId = `${event.id}--${recipientGuestUid}`;
        const contactUid = `phone-${recipientGuestUid}`;
        const invitationRef = store.doc(db, 'users', accountUser.uid, 'phone-invitations', invitationId);
        const contactRef = store.doc(db, 'users', accountUser.uid, 'contacts', contactUid);
        const [existingInvitation, existingContact] = await Promise.all([
          store.getDoc(invitationRef),
          store.getDoc(contactRef),
        ]);
        const batch = store.writeBatch(db);
        batch.set(invitationRef, {
          eventId: event.id,
          eventTitle: event.title,
          hostUid: accountUser.uid,
          recipientUid: contactUid,
          recipientGuestUid,
          recipientPhone: normalizedPhone,
          recipientName: optionalName.trim().slice(0, 80),
          inviteUrl: guestEventUrl(event.id, event.publicPath),
          createdAt: existingInvitation.data()?.createdAt || store.serverTimestamp(),
          updatedAt: store.serverTimestamp(),
        });
        batch.set(contactRef, {
          accountUid: contactUid,
          guestUid: recipientGuestUid,
          email: '',
          phone: normalizedPhone,
          firstName: optionalName.trim() || 'Guest',
          lastName: optionalName.trim() ? '' : phoneDigits(normalizedPhone).slice(-4),
          inviteCount: (existingContact.data()?.inviteCount || 0) + 1,
          eventIds: [...new Set([...(existingContact.data()?.eventIds || []), event.id])],
          lastInvitedAt: store.serverTimestamp(),
        });
        await batch.commit();
        try {
          const delivery = await openManualInvitation(event, normalizedPhone, optionalName);
          notify(delivery === 'message'
            ? `Invitation saved. Review the message and tap Send.`
            : `Invitation saved and copied. Send it to ${formatPhone(normalizedPhone)}.`);
        } catch {
          notify(`Invitation saved. Copy the event link and send it to ${formatPhone(normalizedPhone)}.`);
        }
        return true;
      }
      if (targetUid === accountUser.uid) throw new Error('self');
      const directoryRef = store.doc(db, 'account-directory', targetUid);
      const directorySnapshot = await store.getDoc(directoryRef);
      if (!directorySnapshot.exists()) throw new Error('directory-missing');
      const directory = directorySnapshot.data() as {
        uid: string;
        email: string;
        firstName: string;
        lastName: string;
        phone: string;
        guestUid: string;
      };
      const displayName = `${directory.firstName || ''} ${directory.lastName || ''}`.trim();
      const invitationRef = store.doc(db, 'users', targetUid, 'invitations', event.id);
      const contactRef = store.doc(db, 'users', accountUser.uid, 'contacts', targetUid);
      const pendingInvitationRef = store.doc(
        db,
        'users',
        accountUser.uid,
        'phone-invitations',
        `${event.id}--${directory.guestUid}`,
      );
      const pendingContactRef = store.doc(
        db,
        'users',
        accountUser.uid,
        'contacts',
        `phone-${directory.guestUid}`,
      );
      const [invitation, contact] = await Promise.all([
        store.getDoc(invitationRef),
        store.getDoc(contactRef),
      ]);
      const batch = store.writeBatch(db);
      batch.set(invitationRef, {
        eventId: event.id,
        eventTitle: event.title,
        hostUid: accountUser.uid,
        recipientUid: targetUid,
        recipientGuestUid: directory.guestUid,
        recipientEmail: directory.email,
        recipientPhone: directory.phone,
        createdAt: invitation.exists() ? invitation.data().createdAt : store.serverTimestamp(),
        updatedAt: store.serverTimestamp(),
      });
      batch.set(contactRef, {
        accountUid: targetUid,
        guestUid: directory.guestUid,
        email: directory.email,
        phone: directory.phone,
        firstName: directory.firstName,
        lastName: directory.lastName,
        inviteCount: (contact.data()?.inviteCount || 0) + 1,
        eventIds: [...new Set([...(contact.data()?.eventIds || []), event.id])],
        lastInvitedAt: store.serverTimestamp(),
      });
      batch.delete(pendingInvitationRef);
      batch.delete(pendingContactRef);
      await batch.commit();
      const currentUser = authModule.getAuth(getApp()).currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        await callPushApi('invite', 'POST', {
          eventId: event.id,
          recipientUid: targetUid,
        }, idToken).catch(() => undefined);
      }
      notify(`${displayName || directory.email} was invited`);
      return true;
    } catch (error) {
      const firebaseCode = (error as { code?: string }).code || '';
      const reason = (error as Error).message;
      notify(reason === 'not-registered-email' || reason === 'directory-missing'
        ? 'No completed Nights account matches that email address. Use a phone number to prepare a manual invitation.'
        : reason === 'self'
          ? 'You already host this event'
          : reason === 'permission-denied' || firebaseCode === 'permission-denied' || firebaseCode === 'firestore/permission-denied'
            ? 'Invitations need the updated Firebase rules before they can be sent'
            : 'The invitation could not be sent. Try again.');
      return false;
    }
  };
  const revokeRegisteredGuest = async (event: EventMenu, invitation: EventInvitation) => {
    if (!accountUser || invitation.hostUid !== accountUser.uid) return false;
    try {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      if (invitation.pendingAccount && invitation.invitationId) {
        await store.deleteDoc(store.doc(
          db,
          'users',
          accountUser.uid,
          'phone-invitations',
          invitation.invitationId,
        ));
        notify(`Invitation to ${formatPhone(invitation.recipientPhone)} was revoked`);
        return true;
      }
      const invitationRef = store.doc(db, 'users', invitation.recipientUid, 'invitations', event.id);
      const profileRef = store.doc(db, 'events', event.id, 'guests', invitation.recipientGuestUid);
      const rsvpRef = store.doc(db, 'events', event.id, 'rsvps', invitation.recipientGuestUid);
      const [profileDocument, orderSnapshot, subscriptionSnapshot] = await Promise.all([
        store.getDoc(profileRef),
        store.getDocs(store.query(
          store.collection(db, 'events', event.id, 'orders'),
          store.where('guestUid', '==', invitation.recipientGuestUid),
        )),
        store.getDocs(store.query(
          store.collection(db, 'events', event.id, 'pushSubscriptions'),
          store.where('actorUid', '==', invitation.recipientGuestUid),
        )),
      ]);
      const profile = profileDocument.data();
      const batch = store.writeBatch(db);
      batch.delete(invitationRef);
      batch.delete(rsvpRef);
      batch.delete(profileRef);
      const companionParticipants = await store.getDocs(store.query(
        store.collection(db, 'events', event.id, 'expense-participants'),
        store.where('primaryGuestUid', '==', invitation.recipientGuestUid),
      ));
      companionParticipants.docs.forEach((document) => batch.delete(document.ref));
      orderSnapshot.docs.forEach((document) => batch.delete(document.ref));
      subscriptionSnapshot.docs.forEach((document) => batch.delete(document.ref));
      if (profile?.guestName) {
        const nameRef = store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(profile.guestName));
        const nameClaim = await store.getDoc(nameRef);
        if (nameClaim.data()?.guestUid === invitation.recipientGuestUid) batch.delete(nameRef);
      }
      if (profile?.guestPhone) {
        const phoneRef = store.doc(db, 'events', event.id, 'guest-phones', await guestNameIndexId(profile.guestPhone));
        const phoneClaim = await store.getDoc(phoneRef);
        if (phoneClaim.data()?.guestUid === invitation.recipientGuestUid) batch.delete(phoneRef);
      }
      await batch.commit();
      await Promise.allSettled(subscriptionSnapshot.docs.map((document) => callPushApi(
        'subscribe',
        'DELETE',
        { eventId: event.id, subscriptionId: document.id },
      )));
      notify(`Invitation to ${invitation.recipientEmail || formatPhone(invitation.recipientPhone)} was revoked`);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The invitation could not be revoked.');
      return false;
    }
  };
  const selectGuestEvent = (access: GuestEventAccess) => {
    if (!guestSession) return;
    const hosted = access.hosted
      || accountCanManageEvent(access.event, accountUser?.uid, accountUser?.email);
    if (hosted) {
      localStorage.setItem(LAST_EVENT_KEY, access.event.id);
      setGuestEventPickerOpen(false);
      window.location.assign(eventRoute(
        access.event.id,
        'host',
        automaticPublicEventPath(access.event),
      ));
      return;
    }
    localStorage.setItem(guestIdentityKey(access.event.id), guestSession.guestUid);
    localStorage.setItem(LAST_EVENT_KEY, access.event.id);
    const nextRoute = eventRoute(access.event.id, 'guest', automaticPublicEventPath(access.event));
    localStorage.setItem(TRUSTED_GUEST_ROUTE_KEY, new URL(nextRoute, window.location.origin).pathname);
    writePendingGuestEvent(null);
    setPendingGuestEvent(null);
    setGuestEventPickerOpen(false);
    if (access.event.id === menu.id) {
      setGuestUid(guestSession.guestUid);
      setGuestProfile(access.profile);
      setMyRsvp(access.rsvp);
      if (access.rsvp) setRsvpChoice(access.rsvp.status);
      return;
    }
    window.location.assign(nextRoute);
  };
  const clearGuestAccess = () => {
    void signOutAccount();
    writeGuestSession(null);
    localStorage.removeItem(GUEST_EVENTS_CACHE_KEY);
    localStorage.removeItem(TRUSTED_GUEST_ROUTE_KEY);
    guestEvents.forEach((entry) => localStorage.removeItem(guestIdentityKey(entry.event.id)));
    localStorage.removeItem(guestIdentityKey(menu.id));
    setGuestSession(null);
    setGuestEvents([]);
    setGuestUid(null);
    setGuestProfile(null);
    setMyRsvp(null);
    setRememberedOrder(null);
    setRememberedOrders([]);
    setCart({});
    setChatOpen(false);
    setGuestName('');
    setPhoneNumber('');
    setGuestPin('');
    setGuestEventPickerOpen(false);
    setPendingGuestEvent(readPendingGuestEvent());
    pendingEnrollmentRef.current = '';
    if (!isGuestPortalUrl(new URL(window.location.href))) window.location.assign(guestHomeRoute());
  };
  function selectHostEvent(event: EventMenu) {
    setMenu(event);
    setEditing(false);
    setCart({});
    setRememberedOrder(null);
    setRememberedOrders([]);
    setReceipts([]);
    const nextOrders = firebaseConfigured
      ? []
      : (JSON.parse(
          localStorage.getItem(demoOrdersKey(event.id)) || '[]',
        ) as Order[]);
    setOrders(nextOrders);
    localStorage.setItem(LAST_EVENT_KEY, event.id);
    history.replaceState({}, '', eventRoute(event.id, 'host', automaticPublicEventPath(event)));
  }

  async function createEvent() {
    const pathCategory = normalizeEventPathSegment(newEvent.publicPathCategory);
    const pathEvent = normalizeEventPathSegment(newEvent.publicPathEvent);
    if (!newEvent.title.trim() || !newEvent.date.trim() || !pathCategory || !pathEvent) {
      notify('Add an event name, date, and both parts of its web address');
      return;
    }
    const publicPath = `${pathCategory}/${pathEvent}`;
    if (events.some((existingEvent) => existingEvent.publicPath === publicPath)) {
      notify('That event web address is already in use. Change either part of the link');
      return;
    }
    const baseSlug = normalizeEventPathSegment(newEvent.title, 'event').slice(0, 36);
    const eventId = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;
    const publicPathClaimId = await guestNameIndexId(publicPath);
    const event = withoutUndefined<EventMenu>({
      id: eventId,
      publicPath,
      publicPathClaimId,
      title: newEvent.title.trim(),
      date: formatDateTime(newEvent.date),
      startsAt: newEvent.date,
      address: newEvent.address.trim(),
      welcome: newEvent.welcome.trim(),
      accepting: false,
      rsvpOpen: true,
      chatOpen: true,
      requireGuestApproval: newEvent.requireGuestApproval,
      eventType: newEvent.eventType,
      customEventType: newEvent.eventType === 'custom' ? newEvent.customEventType.trim() : '',
      backgroundImageUrl: newEvent.backgroundImageUrl,
      backgroundFocus: newEvent.backgroundFocus,
      backgroundZoom: newEvent.backgroundZoom,
      colorPalette: newEvent.colorPalette || undefined,
      maxAdditionalGuests: newEvent.maxAdditionalGuests,
      categories: ['Main plates'],
      resources: [],
      items: [
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          category: 'Main plates',
          price: 0,
          prepMinutes: 15,
        },
      ],
    });
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store, authModule] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
          import('firebase/auth'),
        ]);
        const user = authModule.getAuth(getApp()).currentUser;
        if (!user || user.isAnonymous) {
          notify('Sign in to your Nights account before creating an event');
          return;
        }
        event.ownerUid = user.uid;
        const db = store.getFirestore(getApp());
        const duplicate = await store.getDocs(store.query(
          store.collection(db, 'events'),
          store.where('publicPath', '==', publicPath),
          store.limit(1),
        ));
        if (!duplicate.empty) throw new Error('path-taken');
        const eventRef = store.doc(db, 'events', event.id);
        const pathRef = store.doc(db, 'public-paths', publicPathClaimId);
        await store.runTransaction(db, async (transaction) => {
          const pathClaim = await transaction.get(pathRef);
          if (pathClaim.exists()) throw new Error('path-taken');
          transaction.set(pathRef, {
            eventId: event.id,
            ownerUid: user.uid,
            publicPath,
            createdAt: store.serverTimestamp(),
          });
          transaction.set(eventRef, event);
        });
      } else {
        const nextEvents = [...events, event];
        setEvents(nextEvents);
        shareDemoUpdate({ type: 'events', value: nextEvents });
        shareDemoUpdate({ type: 'orders', eventId: event.id, value: [] });
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(
        (error as Error).message === 'path-taken'
          ? 'That event web address is already in use. Choose another link.'
          : code === 'permission-denied'
          ? 'Firebase rules have not yet allowed this host account to create events.'
          : 'The event could not be created. Please try again.',
      );
      return;
    }
    setMenu(event);
    setOrders([]);
    setEditing(true);
    sessionStorage.removeItem(CREATE_EVENT_RETURN_ROUTE_KEY);
    setCreatingEvent(false);
    setNewEvent({
      title: '',
      date: '',
      publicPathCategory: 'meal',
      publicPathEvent: '',
      address: '',
      maxAdditionalGuests: 0,
      requireGuestApproval: false,
      eventType: 'meal',
      customEventType: '',
      backgroundImageUrl: '',
      backgroundFocus: centerBackgroundFocus(),
      backgroundZoom: 1,
      colorPalette: '',
      welcome: 'Choose what you’d like and send your order to the host.',
    });
    localStorage.setItem(LAST_EVENT_KEY, event.id);
    history.replaceState({}, '', eventRoute(event.id, 'host', automaticPublicEventPath(event)));
    notify('Event created — now finish the menu');
  }

  function beginOrderEdit(order: Order) {
    setCart({ ...order.selections });
    setNote(order.note);
    setEditingOrderId(order.id);
    (document.getElementById('checkout') as HTMLDialogElement)?.showModal();
  }

  function showSubmissionConfirmation(action: 'created' | 'updated') {
    setLastAction(action);
    setEditingOrderId(null);
    (document.getElementById('checkout') as HTMLDialogElement | null)?.close();
    setSubmitted(true);
    window.setTimeout(() => {
      setSubmitted(false);
      setCart({});
      setNote('');
    }, 2400);
  }

  async function submitOrder() {
    if (!menu.accepting) {
      notify('This event is not accepting orders right now');
      return;
    }
    if (!myRsvp || myRsvp.status !== 'yes') {
      notify('RSVP Yes before placing an order');
      return;
    }
    if (!guestIsApproved(menu, myRsvp)) {
      notify('The host must approve your RSVP before you can order');
      return;
    }
    if (count === 0) return;
    const existing = !editingOrderId ? rememberedOrders.find((order) => order.status === 'new') : null;
    const target = editingOrderId
      ? rememberedOrders.find((order) => order.id === editingOrderId)
      : existing;
    const createdAt = Date.now();
    const orderId = target?.id || crypto.randomUUID();
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'), import('firebase/firestore'),
        ]);
        const uid = myRsvp.guestUid;
        const db = store.getFirestore(getApp());
        const orderRef = store.doc(db, 'events', menu.id, 'orders', orderId);
        await store.runTransaction(db, async (transaction) => {
          const rsvp = await transaction.get(store.doc(db, 'events', menu.id, 'rsvps', uid));
          if (
            !rsvp.exists() ||
            rsvp.data().status !== 'yes' ||
            (menu.requireGuestApproval && (rsvp.data().approvalStatus || 'approved') !== 'approved')
          ) throw new Error('rsvp');
          const prior = target ? await transaction.get(orderRef) : null;
          if (target && (!prior?.exists() || prior.data().status !== 'new' || prior.data().guestUid !== uid))
            throw new Error('order-changed');
          if (prior?.exists()) {
            const selections = editingOrderId ? cart : { ...prior.data().selections } as Record<string, number>;
            if (!editingOrderId) Object.entries(cart).forEach(([itemId, quantity]) => {
              selections[itemId] = (selections[itemId] || 0) + quantity;
            });
            transaction.update(orderRef, {
              selections,
              note: editingOrderId ? note.trim() : [prior.data().note, note.trim()].filter(Boolean).join(' · ').slice(0, 500),
              updatedAt: store.serverTimestamp(),
              revision: (prior.data().revision || 1) + 1,
            });
          } else {
            transaction.set(orderRef, {
              id: orderId, guestUid: uid, guestName: rsvp.data().guestName,
              selections: cart, note: note.trim(), status: 'new', revision: 1,
              createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp(),
            });
            transaction.update(store.doc(db, 'events', menu.id, 'rsvps', uid), {
              activeOrderCount: (rsvp.data().activeOrderCount || 0) + 1,
              updatedAt: store.serverTimestamp(),
            });
          }
        });
      } else {
        const nextOrder: Order = target
          ? {
              ...target,
              selections: editingOrderId ? cart : Object.fromEntries(
                [...new Set([...Object.keys(target.selections), ...Object.keys(cart)])].map((id) =>
                  [id, (target.selections[id] || 0) + (cart[id] || 0)]),
              ),
              note: editingOrderId ? note.trim() : [target.note, note.trim()].filter(Boolean).join(' · ').slice(0, 500),
              updatedAt: createdAt,
            }
          : {
              id: orderId, guestName: myRsvp.guestName, guestUid: myRsvp.guestUid,
              selections: cart, note: note.trim(), status: 'new',
              createdAt, updatedAt: createdAt, revision: 1,
            };
        const next = [nextOrder, ...orders.filter((order) => order.id !== orderId)];
        setOrders(next);
        shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
        setRememberedOrders([nextOrder, ...rememberedOrders.filter((order) => order.id !== orderId)]);
        if (!target) adjustDemoRsvpActiveCount(myRsvp?.guestUid, 1);
      }
      const savedReceipt = saveReceipt(menu.id, orderId, createdAt);
      setReceipts((current) => [...current.filter((entry) => entry.orderId !== orderId), savedReceipt]);
      showSubmissionConfirmation(target ? 'updated' : 'created');
    } catch (error) {
      notify((error as Error).message === 'order-changed'
        ? 'That order changed. Refresh and try again.'
        : 'Order was not sent. Check your RSVP and try again.');
    }
  }
  async function saveGuestProfile() {
    const establishingAccess = !effectiveGuestProfile || changingGuestPhone;
    const name = guestName.trim().replace(/\s+/g, ' ');
    const enteredPhone = accountProfile
      ? formatPhone(accountProfile.phone)
      : normalizeOptionalPhone(phoneNumber);
    const normalizedPhone = accountProfile?.phone
      || (enteredPhone ? `+1${phoneDigits(enteredPhone)}` : '');
    if (name.length < 2 || name.length > 80) {
      notify('Enter a name between 2 and 80 characters');
      return;
    }
    if (!enteredPhone) {
      notify('Enter a 10-digit phone number, like 555-555-5555');
      return;
    }
    if (!accountProfile && !/^\d{4}$/.test(guestPin)) {
      notify('Enter a 4-digit PIN');
      return;
    }
    setProfileBusy(true);
    try {
      const uid = accountProfile?.guestUid || await guestNameIndexId(normalizedPhone);
      const pinHash = accountProfile ? undefined : await guestPinHash(uid, guestPin);
      const session: GuestSession = {
        ...(accountUser ? { authUid: accountUser.uid, email: accountUser.email } : {}),
        guestUid: uid,
        guestName: name,
        guestPhone: normalizedPhone,
        ...(pinHash ? { pinHash } : {}),
      };
      const savedProfile: GuestProfile = {
        guestUid: uid,
        ...(accountUser ? { accountUid: accountUser.uid } : {}),
        guestName: name,
        guestPhone: normalizedPhone,
        ...(pinHash ? { pinHash } : {}),
        createdAt: changingGuestPhone ? Date.now() : guestProfile?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'), import('firebase/firestore'),
        ]);
        if (guestProfile && !changingGuestPhone && guestProfile.guestUid !== uid) throw new Error('phone-locked');
        const db = store.getFirestore(getApp());
        const profileRef = store.doc(db, 'events', menu.id, 'guests', uid);
        const rsvpRef = store.doc(db, 'events', menu.id, 'rsvps', uid);
        const participantRef = store.doc(db, 'events', menu.id, 'expense-participants', uid);
        const nameRef = store.doc(db, 'events', menu.id, 'guest-names', await guestNameIndexId(name));
        const phoneRef = store.doc(db, 'events', menu.id, 'guest-phones', await guestNameIndexId(normalizedPhone));
        await store.runTransaction(db, async (transaction) => {
          const prior = await transaction.get(profileRef);
          const priorProfile = prior.data();
          const priorRsvp = await transaction.get(rsvpRef);
          const priorParticipant = await transaction.get(participantRef);
          const nameClaim = await transaction.get(nameRef);
          const phoneClaim = await transaction.get(phoneRef);
          const previous = prior.exists() ? priorProfile : priorRsvp.data();
          if (!accountUser && priorProfile?.pinHash && priorProfile.pinHash !== pinHash)
            throw new Error('invalid-pin');
          const oldNameRef = previous && guestNameKey(previous.guestName) !== guestNameKey(name)
            ? store.doc(db, 'events', menu.id, 'guest-names', await guestNameIndexId(previous.guestName)) : null;
          const oldPhoneRef = previous && typeof previous.guestPhone === 'string' && previous.guestPhone !== normalizedPhone
            ? store.doc(db, 'events', menu.id, 'guest-phones', await guestNameIndexId(previous.guestPhone)) : null;
          const oldClaim = oldNameRef ? await transaction.get(oldNameRef) : null;
          const oldPhoneClaim = oldPhoneRef ? await transaction.get(oldPhoneRef) : null;
          if (nameClaim.exists() && nameClaim.data().guestUid !== uid) throw new Error('name-taken');
          if (phoneClaim.exists() && phoneClaim.data().guestUid !== uid) throw new Error('phone-taken');
          if (!nameClaim.exists()) transaction.set(nameRef, {
            guestUid: uid, guestName: name, createdAt: store.serverTimestamp(),
          });
          if (!phoneClaim.exists()) transaction.set(phoneRef, {
            guestUid: uid, guestPhone: normalizedPhone, createdAt: store.serverTimestamp(),
          });
          if (oldNameRef && oldClaim?.data()?.guestUid === uid) transaction.delete(oldNameRef);
          if (oldPhoneRef && oldPhoneClaim?.data()?.guestUid === uid) transaction.delete(oldPhoneRef);
          transaction.set(profileRef, {
            guestUid: uid,
            ...(accountUser ? { accountUid: accountUser.uid } : {}),
            guestName: name,
            guestPhone: normalizedPhone,
            ...(priorProfile?.pinHash
              ? { pinHash: priorProfile.pinHash }
              : pinHash ? { pinHash } : {}),
            createdAt: priorProfile?.createdAt || store.serverTimestamp(),
            updatedAt: store.serverTimestamp(),
          });
          if (priorRsvp.exists()) transaction.update(rsvpRef, {
            guestName: name, guestPhone: normalizedPhone,
            activeOrderCount: priorRsvp.data().activeOrderCount || 0,
            updatedAt: store.serverTimestamp(),
          });
          if (priorParticipant.exists()) transaction.update(participantRef, {
            name,
            updatedAt: store.serverTimestamp(),
          });
        });
        localStorage.setItem(guestIdentityKey(menu.id), uid);
        setGuestUid(uid);
        setGuestProfile(savedProfile);
      } else {
        const others = rsvps.filter((entry) => entry.guestUid !== uid);
        if (others.some((entry) => guestNameKey(entry.guestName) === guestNameKey(name))) throw new Error('name-taken');
        if (others.some((entry) => entry.guestPhone === normalizedPhone)) throw new Error('phone-taken');
        if (!accountUser && guestProfile?.pinHash && guestProfile.pinHash !== pinHash) throw new Error('invalid-pin');
        const saved: GuestProfile = { guestUid: uid, ...(accountUser ? { accountUid: accountUser.uid } : {}), guestName: name, guestPhone: normalizedPhone, ...(pinHash ? { pinHash } : {}), createdAt: guestProfile?.createdAt || Date.now(), updatedAt: Date.now() };
        localStorage.setItem(guestIdentityKey(menu.id), uid);
        setGuestUid(uid);
        setGuestProfile(saved);
        shareDemoUpdate({ type: 'profile', eventId: menu.id, value: saved });
      }
      if (changingGuestPhone) {
        setMyRsvp(null);
        setRememberedOrders([]);
        setRememberedOrder(null);
        setCart({});
      }
      writeGuestSession(session);
      setGuestSession(session);
      const accessibleEvents = await loadGuestEvents(session);
      setChangingGuestPhone(false);
      setEditingGuestProfile(false);
      setGuestPin('');
      if (establishingAccess && accessibleEvents.length) {
        setRsvpPanelOpen(false);
        setGuestEventPickerOpen(true);
        notify(`${accessibleEvents.length} event${accessibleEvents.length === 1 ? '' : 's'} found — choose an event`);
      } else notify('Guest profile updated');
    } catch (error) {
      notify((error as Error).message === 'name-taken'
        ? 'That name is already used for this event. Please choose a different name.'
        : (error as Error).message === 'phone-taken'
          ? 'That phone number already belongs to another guest for this event.'
          : (error as Error).message === 'invalid-pin'
            ? 'That PIN does not match this guest profile.'
          : (error as Error).message === 'phone-locked'
            ? 'This guest profile is tied to its phone number. Reload the page to use another number.'
          : 'Guest profile was not saved. Please try again.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function saveRsvp() {
    const profile = effectiveGuestProfile;
    if (!profile) {
      notify('Create your guest profile before responding');
      return;
    }
    if (menu.rsvpOpen === false) {
      notify('RSVPs are closed for this event');
      return;
    }
    const maxCompanions = Math.max(0, menu.maxAdditionalGuests || 0);
    const companionNames = rsvpChoice === 'no'
      ? []
      : rsvpCompanionNames.slice(0, maxCompanions).map((name) => name.trim());
    if (companionNames.some((name) => name.length < 2 || name.length > 80)) {
      notify('Enter a name between 2 and 80 characters for each additional guest');
      return;
    }
    const companionPhones = rsvpCompanionPhones
      .slice(0, companionNames.length)
      .map((phone) => normalizeOptionalPhone(phone));
    const invalidPhoneIndex = companionPhones.findIndex((phone) => phone === null);
    if (invalidPhoneIndex >= 0) {
      notify(`Enter a complete phone number for friend ${invalidPhoneIndex + 1}`);
      return;
    }
    const companions = companionNames.map((name, index) => {
      const phone = companionPhones[index] || '';
      return phone ? { name, phone } : { name };
    });
    const activeOrders = rememberedOrders.filter((order) => order.status === 'new' || order.status === 'preparing');
    if (myRsvp?.status === 'yes' && rsvpChoice !== 'yes' && activeOrders.length) {
      setRsvpChoice(myRsvp.status);
      notify('Cancel new orders and wait until accepted food is served before changing your RSVP');
      return;
    }
    const nextApprovalStatus: NonNullable<Rsvp['approvalStatus']> = !menu.requireGuestApproval || rsvpChoice !== 'yes' || Boolean(currentInvitation)
      ? 'approved'
      : myRsvp?.status === 'yes'
        ? (myRsvp.approvalStatus || 'pending')
        : 'pending';
    setRsvpBusy(true);
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'), import('firebase/firestore'),
        ]);
        const uid = profile.guestUid;
        const db = store.getFirestore(getApp());
        const profileRef = store.doc(db, 'events', menu.id, 'guests', uid);
        const rsvpRef = store.doc(db, 'events', menu.id, 'rsvps', uid);
        const participantRef = store.doc(db, 'events', menu.id, 'expense-participants', uid);
        const nameRef = store.doc(db, 'events', menu.id, 'guest-names', await guestNameIndexId(profile.guestName));
        const phoneRef = store.doc(db, 'events', menu.id, 'guest-phones', await guestNameIndexId(profile.guestPhone));
        await store.runTransaction(db, async (transaction) => {
          const [savedProfile, prior] = await Promise.all([
            transaction.get(profileRef), transaction.get(rsvpRef),
          ]);
          const priorProfile = savedProfile.data();
          const oldNameRef = priorProfile && guestNameKey(priorProfile.guestName) !== guestNameKey(profile.guestName)
            ? store.doc(db, 'events', menu.id, 'guest-names', await guestNameIndexId(priorProfile.guestName))
            : null;
          const oldPhoneRef = priorProfile && priorProfile.guestPhone !== profile.guestPhone
            ? store.doc(db, 'events', menu.id, 'guest-phones', await guestNameIndexId(priorProfile.guestPhone))
            : null;
          const [nameClaim, phoneClaim, oldNameClaim, oldPhoneClaim] = await Promise.all([
            transaction.get(nameRef),
            transaction.get(phoneRef),
            oldNameRef ? transaction.get(oldNameRef) : Promise.resolve(null),
            oldPhoneRef ? transaction.get(oldPhoneRef) : Promise.resolve(null),
          ]);
          if (nameClaim.exists() && nameClaim.data().guestUid !== uid) throw new Error('name-taken');
          if (phoneClaim.exists() && phoneClaim.data().guestUid !== uid) throw new Error('phone-taken');
          if (!nameClaim.exists()) transaction.set(nameRef, {
            guestUid: uid, guestName: profile.guestName, createdAt: store.serverTimestamp(),
          });
          if (!phoneClaim.exists()) transaction.set(phoneRef, {
            guestUid: uid, guestPhone: profile.guestPhone, createdAt: store.serverTimestamp(),
          });
          if (oldNameRef && oldNameClaim?.data()?.guestUid === uid) transaction.delete(oldNameRef);
          if (oldPhoneRef && oldPhoneClaim?.data()?.guestUid === uid) transaction.delete(oldPhoneRef);
          if (savedProfile.exists()) transaction.update(profileRef, {
            guestName: profile.guestName,
            guestPhone: profile.guestPhone,
            updatedAt: store.serverTimestamp(),
          });
          else transaction.set(profileRef, {
            guestUid: uid, ...(accountUser ? { accountUid: accountUser.uid } : {}), guestName: profile.guestName, guestPhone: profile.guestPhone,
            createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp(),
          });
          const activeOrderCount = prior.exists() ? prior.data().activeOrderCount || 0 : 0;
          if (prior.exists() && prior.data().status === 'yes' && rsvpChoice !== 'yes' && activeOrderCount > 0)
            throw new Error('active-orders');
          transaction.set(rsvpRef, {
            guestUid: uid, guestName: profile.guestName, guestPhone: profile.guestPhone,
            status: rsvpChoice, companions, activeOrderCount,
            approvalStatus: !menu.requireGuestApproval || rsvpChoice !== 'yes' || Boolean(currentInvitation)
              ? 'approved'
              : prior.exists() && prior.data().status === 'yes'
                ? (prior.data().approvalStatus || 'pending')
                : 'pending',
            createdAt: prior.exists() ? prior.data().createdAt : store.serverTimestamp(),
            updatedAt: store.serverTimestamp(),
          });
        });
        // RSVP is the primary action. Expense participants are synchronized only
        // after it succeeds so a missing ledger row can never roll back an RSVP.
        const upsertParticipant = async (
          reference: ReturnType<typeof store.doc>,
          data: Omit<ExpenseParticipant, 'createdAt' | 'updatedAt'>,
        ) => {
          try {
            await store.updateDoc(reference, {
              accountUid: data.accountUid,
              name: data.name,
              status: data.status,
              approvalStatus: data.approvalStatus,
              updatedAt: store.serverTimestamp(),
            });
          } catch {
            await store.setDoc(reference, {
              ...data,
              createdAt: store.serverTimestamp(),
              updatedAt: store.serverTimestamp(),
            });
          }
        };
        const accountUid = accountUser?.uid || '';
        const primaryRole = canManageCurrentEvent ? 'host' : 'guest';
        const priorCompanionCount = myRsvp?.companions?.length || 0;
        await Promise.allSettled([
          upsertParticipant(participantRef, {
            id: uid,
            accountUid,
            primaryGuestUid: uid,
            name: profile.guestName,
            role: primaryRole,
            status: primaryRole === 'host' ? 'host' : rsvpChoice,
            approvalStatus: nextApprovalStatus,
          }),
          ...companions.map((companion, index) => {
            const id = companionParticipantId(uid, index);
            return upsertParticipant(
              store.doc(db, 'events', menu.id, 'expense-participants', id),
              {
                id,
                accountUid,
                primaryGuestUid: uid,
                name: companion.name,
                role: 'companion',
                status: rsvpChoice,
                approvalStatus: nextApprovalStatus,
              },
            );
          }),
          ...Array.from({ length: Math.max(0, priorCompanionCount - companions.length) }, (_, offset) =>
            store.deleteDoc(store.doc(
              db,
              'events',
              menu.id,
              'expense-participants',
              companionParticipantId(uid, companions.length + offset),
            ))),
        ]);
      } else {
        const others = rsvps.filter((entry) => entry.guestUid !== profile.guestUid);
        const saved: Rsvp = {
          guestUid: profile.guestUid, guestName: profile.guestName, guestPhone: profile.guestPhone,
          status: rsvpChoice, companions, activeOrderCount: myRsvp?.activeOrderCount || 0,
          approvalStatus: nextApprovalStatus,
          createdAt: myRsvp?.createdAt || Date.now(), updatedAt: Date.now(),
        };
        const next = [saved, ...others];
        setRsvps(next);
        setMyRsvp(saved);
        shareDemoUpdate({ type: 'rsvps', eventId: menu.id, value: next });
      }
      setMyRsvp({
        guestUid: profile.guestUid,
        guestName: profile.guestName,
        guestPhone: profile.guestPhone,
        status: rsvpChoice,
        companions,
        approvalStatus: nextApprovalStatus,
        activeOrderCount: myRsvp?.activeOrderCount || 0,
        createdAt: myRsvp?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
      setRsvpPanelOpen(false);
      const waitingForApproval = menu.requireGuestApproval
        && rsvpChoice === 'yes'
        && nextApprovalStatus !== 'approved';
      notify(waitingForApproval
        ? 'RSVP sent — the host will review your request'
        : `RSVP saved: ${rsvpChoice === 'yes' ? 'Going' : rsvpChoice === 'maybe' ? 'Maybe' : 'Not going'}`);
    } catch (error) {
      if ((error as Error).message === 'active-orders' && myRsvp) setRsvpChoice(myRsvp.status);
      notify((error as Error).message === 'active-orders'
        ? 'Your active order must be completed or cancelled before changing your RSVP.'
        : (error as Error).message === 'name-taken'
          ? 'That display name is already used for this event. Edit your profile and choose a different display name.'
          : (error as Error).message === 'phone-taken'
            ? 'That phone number is already connected to another guest for this event.'
        : 'RSVP was not saved. Please try again.');
    } finally {
      setRsvpBusy(false);
    }
  }
  async function persistScheduledOrders(next: Order[]) {
    setOrders(next);
    if (!firebaseConfigured) {
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
      return;
    }
    const [{ getApp }, store] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ]);
    const db = store.getFirestore(getApp());
    const batch = store.writeBatch(db);
    next
      .filter((order) => order.status !== 'new' && order.status !== 'cancelled')
      .forEach((order) =>
        batch.update(store.doc(db, 'events', menu.id, 'orders', order.id), {
          status: order.status,
          tasks: order.tasks || [],
        }),
      );
    await batch.commit();
  }

  async function acceptTasks(taskRefs: OrderTaskRef[]) {
    const eligible = planResourceQueue(orders, menu).availableTaskIds;
    const selectedByOrder = taskRefs.reduce<Record<string, Set<string>>>((groups, ref) => {
      if (eligible.has(ref.taskId)) (groups[ref.orderId] ||= new Set()).add(ref.taskId);
      return groups;
    }, {});
    const startedAt = Date.now();
    const accepted = orders.map((entry) => {
      const selected = selectedByOrder[entry.id];
      if (!selected?.size) return entry;
      const tasks = entry.tasks?.length ? entry.tasks : createOrderTasks(entry);
      return {
        ...entry,
        status: 'preparing' as OrderStatus,
        tasks: tasks.map((task) => {
          if (!selected.has(task.id) || task.status !== 'waiting') return task;
          const item = menu.items.find((menuItem) => menuItem.id === task.itemId);
          return {
            ...task,
            status: 'preparing' as TaskStatus,
            startedAt,
            estimatedReadyAt: startedAt + itemPrepMinutes(item) * 60000,
          };
        }),
      };
    });
    await persistScheduledOrders(accepted);
    notify('Accepted items are now in progress');
  }

  async function rejectOrder(order: Order) {
    const rejected = { ...order, status: 'rejected' as OrderStatus, updatedAt: Date.now() };
    if (firebaseConfigured) {
      const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
      const db = store.getFirestore(getApp());
      const orderRef = store.doc(db, 'events', menu.id, 'orders', order.id);
      const rsvpRef = order.guestUid ? store.doc(db, 'events', menu.id, 'rsvps', order.guestUid) : null;
      await store.runTransaction(db, async (transaction) => {
        const rsvp = rsvpRef ? await transaction.get(rsvpRef) : null;
        transaction.update(orderRef, { status: 'rejected', updatedAt: store.serverTimestamp() });
        if (rsvp?.exists() && rsvpRef) transaction.update(rsvpRef, {
          activeOrderCount: Math.max(0, (rsvp.data().activeOrderCount || 0) - 1),
          updatedAt: store.serverTimestamp(),
        });
      });
    } else {
      const next = orders.map((entry) => entry.id === order.id ? rejected : entry);
      setOrders(next);
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
      adjustDemoRsvpActiveCount(order.guestUid, -1);
    }
    notify(`${order.guestName}'s order was rejected`);
  }

  async function rejectWaitingItems(order: Order, itemId: string) {
    const storedTasks = order.tasks || [];
    if (
      order.status === 'new' ||
      !storedTasks.length ||
      storedTasks.every((task) => task.status === 'waiting')
    ) {
      await rejectOrder(order);
      return;
    }
    const rejectedCount = storedTasks.filter(
      (task) => task.itemId === itemId && task.status === 'waiting',
    ).length;
    if (!rejectedCount) return;
    const next = orders.map((entry) =>
      entry.id === order.id
        ? {
            ...entry,
            tasks: (entry.tasks || []).map((task) =>
              task.itemId === itemId && task.status === 'waiting'
                ? { ...task, status: 'rejected' as TaskStatus }
                : task,
            ),
          }
        : entry,
    );
    await persistScheduledOrders(next);
    notify(`${rejectedCount} waiting item${rejectedCount === 1 ? '' : 's'} rejected`);
  }

  async function clearOrderHistory() {
    if (!window.confirm(`Clear all ${orders.length} orders for ${menu.title}? This keeps the menu but permanently removes the order history.`)) return;
    if (firebaseConfigured) {
      const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
      const db = store.getFirestore(getApp());
      const snapshot = await store.getDocs(store.collection(db, 'events', menu.id, 'orders'));
      const docs = [...snapshot.docs];
      while (docs.length) {
        const batch = store.writeBatch(db);
        docs.splice(0, 450).forEach((entry) => batch.delete(entry.ref));
        await batch.commit();
      }
      const rsvpSnapshot = await store.getDocs(store.collection(db, 'events', menu.id, 'rsvps'));
      for (let index = 0; index < rsvpSnapshot.docs.length; index += 450) {
        const batch = store.writeBatch(db);
        rsvpSnapshot.docs.slice(index, index + 450).forEach((entry) =>
          batch.update(entry.ref, { activeOrderCount: 0, updatedAt: store.serverTimestamp() }));
        await batch.commit();
      }
    } else {
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: [] });
      const unlockedRsvps = rsvps.map((entry) => ({ ...entry, activeOrderCount: 0, updatedAt: Date.now() }));
      setRsvps(unlockedRsvps);
      shareDemoUpdate({ type: 'rsvps', eventId: menu.id, value: unlockedRsvps });
      if (myRsvp) setMyRsvp({ ...myRsvp, activeOrderCount: 0 });
    }
    setOrders([]);
    setRememberedOrders([]);
    notify('Order history cleared');
  }

  async function deleteGuest(rsvp: Rsvp) {
    if (menu.ownerUid && accountProfile?.guestUid === rsvp.guestUid) {
      notify('The event host stays on their own guest list');
      return;
    }
    if ((rsvp.activeOrderCount || 0) > 0) {
      notify('Finish or clear this guest’s active orders before deleting them');
      return;
    }
    if (!window.confirm(`Delete ${rsvp.guestName} from this event? Their RSVP and temporary guest profile will be removed.`)) return;
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'), import('firebase/firestore'),
        ]);
        const db = store.getFirestore(getApp());
        const participantSnapshot = await store.getDocs(store.query(
          store.collection(db, 'events', menu.id, 'expense-participants'),
          store.where('primaryGuestUid', '==', rsvp.guestUid),
        ));
        const batch = store.writeBatch(db);
        batch.delete(store.doc(db, 'events', menu.id, 'rsvps', rsvp.guestUid));
        batch.delete(store.doc(db, 'events', menu.id, 'guests', rsvp.guestUid));
        batch.delete(store.doc(db, 'events', menu.id, 'guest-names', await guestNameIndexId(rsvp.guestName)));
        batch.delete(store.doc(db, 'events', menu.id, 'guest-phones', await guestNameIndexId(rsvp.guestPhone)));
        participantSnapshot.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
      } else {
        const next = rsvps.filter((entry) => entry.guestUid !== rsvp.guestUid);
        setRsvps(next);
        shareDemoUpdate({ type: 'rsvps', eventId: menu.id, value: next });
        if (guestProfile?.guestUid === rsvp.guestUid) {
          setGuestProfile(null);
          setMyRsvp(null);
          shareDemoUpdate({ type: 'profile', eventId: menu.id, value: null });
        }
      }
      notify(`${rsvp.guestName} was removed from this event`);
    } catch {
      notify('Guest could not be deleted');
    }
  }

  async function setGuestApproval(
    rsvp: Rsvp,
    nextStatus: 'approved' | 'declined',
  ) {
    if (nextStatus === 'declined' && (rsvp.activeOrderCount || 0) > 0) {
      notify('Finish or clear this guest’s active orders before removing access');
      return;
    }
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'), import('firebase/firestore'),
        ]);
        const db = store.getFirestore(getApp());
        const participantSnapshot = await store.getDocs(store.query(
          store.collection(db, 'events', menu.id, 'expense-participants'),
          store.where('primaryGuestUid', '==', rsvp.guestUid),
        ));
        const batch = store.writeBatch(db);
        batch.update(store.doc(db, 'events', menu.id, 'rsvps', rsvp.guestUid), {
          approvalStatus: nextStatus,
          updatedAt: store.serverTimestamp(),
        });
        participantSnapshot.docs.forEach((document) => batch.update(document.ref, {
          approvalStatus: nextStatus,
          updatedAt: store.serverTimestamp(),
        }));
        await batch.commit();
      } else {
        const next = rsvps.map((entry) => entry.guestUid === rsvp.guestUid
          ? { ...entry, approvalStatus: nextStatus, updatedAt: Date.now() }
          : entry);
        setRsvps(next);
        shareDemoUpdate({ type: 'rsvps', eventId: menu.id, value: next });
        if (myRsvp?.guestUid === rsvp.guestUid)
          setMyRsvp({ ...myRsvp, approvalStatus: nextStatus, updatedAt: Date.now() });
      }
      notify(nextStatus === 'approved'
        ? `${rsvp.guestName} can now see the event and participate`
        : `${rsvp.guestName} was not approved`);
    } catch {
      notify('Guest access could not be updated');
    }
  }

  async function finishTask(orderId: string, taskId: string) {
    const released = orders.map((order) =>
      order.id === orderId
        ? {
            ...order,
            tasks: (order.tasks || []).map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status: 'ready' as TaskStatus,
                    finishedAt: Date.now(),
                  }
                : task,
            ),
          }
        : order,
    );
    await persistScheduledOrders(released);
    notify('Item ready — the next eligible item moved to Incoming');
  }

  async function serveTask(orderId: string, taskId: string) {
    const previous = orders.find((order) => order.id === orderId);
    const next = orders.map((order) => {
      if (order.id !== orderId) return order;
      const tasks = (order.tasks || []).map((task) =>
        task.id === taskId
          ? { ...task, status: 'served' as TaskStatus, servedAt: Date.now() }
          : task,
      );
      return {
        ...order,
        tasks,
        status:
          tasks.length > 0 && tasks.every((task) => task.status === 'served' || task.status === 'rejected')
            ? ('served' as OrderStatus)
            : order.status,
      };
    });
    await persistScheduledOrders(next);
    const completed = next.find((order) => order.id === orderId);
    if (firebaseConfigured && previous?.status !== 'served' && completed?.status === 'served' && completed.guestUid) {
      const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
      const db = store.getFirestore(getApp());
      const rsvpRef = store.doc(db, 'events', menu.id, 'rsvps', completed.guestUid);
      await store.runTransaction(db, async (transaction) => {
        const rsvp = await transaction.get(rsvpRef);
        if (rsvp.exists()) transaction.update(rsvpRef, {
          activeOrderCount: Math.max(0, (rsvp.data().activeOrderCount || 0) - 1),
          updatedAt: store.serverTimestamp(),
        });
      });
    }
    if (!firebaseConfigured && previous?.status !== 'served' && completed?.status === 'served')
      adjustDemoRsvpActiveCount(completed.guestUid, -1);
    notify('Item served');
  }
  async function cancelRememberedOrder() {
    if (!rememberedOrder || rememberedOrder.status !== 'new') return;
    const cancelled: Order = {
      ...rememberedOrder,
      status: 'cancelled',
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
      revision: (rememberedOrder.revision || 1) + 1,
    };
    if (firebaseConfigured) {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      const orderRef = store.doc(db, 'events', menu.id, 'orders', rememberedOrder.id);
      const rsvpRef = store.doc(db, 'events', menu.id, 'rsvps', rememberedOrder.guestUid!);
      await store.runTransaction(db, async (transaction) => {
        const [orderSnapshot, rsvpSnapshot] = await Promise.all([
          transaction.get(orderRef), transaction.get(rsvpRef),
        ]);
        if (!orderSnapshot.exists() || orderSnapshot.data().status !== 'new') throw new Error('order-changed');
        transaction.update(orderRef, {
          status: 'cancelled',
          cancelledAt: store.serverTimestamp(),
          updatedAt: store.serverTimestamp(),
          revision: store.increment(1),
        });
        if (rsvpSnapshot.exists()) transaction.update(rsvpRef, {
          activeOrderCount: Math.max(0, (rsvpSnapshot.data().activeOrderCount || 0) - 1),
          updatedAt: store.serverTimestamp(),
        });
      });
    } else {
      const next = orders.map((order) =>
        order.id === cancelled.id ? cancelled : order,
      );
      setOrders(next);
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
      setRememberedOrder(cancelled);
      adjustDemoRsvpActiveCount(cancelled.guestUid, -1);
    }
    setRememberedOrders((current) => current.map((order) =>
      order.id === cancelled.id ? cancelled : order));
    setConfirmingCancel(false);
    notify('Your order was cancelled');
  }
  async function saveMenu() {
    if (menu.items.some(unfinishedMenuItem)) {
      notify('Name or delete the unfinished menu item before saving');
      return;
    }
    const cleanPublicPath = normalizedPublicEventPath(menu.publicPath)
      || automaticPublicEventPath({ ...menu, publicPath: undefined });
    if (!cleanPublicPath) {
      notify('The guest link needs two parts, such as movie-night/oct4');
      return;
    }
    if (cleanPublicPath && events.some(
      (event) => event.id !== menu.id && normalizedPublicEventPath(event.publicPath) === cleanPublicPath,
    )) {
      notify('That guest link is already assigned to another event');
      return;
    }
    const cleanedMenu = withoutUndefined<EventMenu>({
      ...menu,
      publicPath: cleanPublicPath || undefined,
      items: menu.items.filter((item) => item.name.trim()).map((item) => ({
        ...item,
        description: itemDescription(item),
      })),
    });
    setMenu(cleanedMenu);
    if (!firebaseConfigured) {
      const nextEvents = events.some((event) => event.id === cleanedMenu.id)
        ? events.map((event) =>
            event.id === cleanedMenu.id ? cleanedMenu : event,
          )
        : [...events, cleanedMenu];
      setEvents(nextEvents);
      setOrders(orders);
      shareDemoUpdate({ type: 'events', value: nextEvents });
      shareDemoUpdate({
        type: 'orders',
        eventId: cleanedMenu.id,
        value: orders,
      });
      setEditing(false);
      notify('Event and menu saved for every open tab');
      return;
    }
    try {
      const [{ getApp }, store, authModule] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
        import('firebase/auth'),
      ]);
      const user = authModule.getAuth(getApp()).currentUser;
      if (!user || user.isAnonymous) {
        notify('Sign in to your Nights account before saving');
        return;
      }
      const db = store.getFirestore(getApp());
      const eventRef = store.doc(db, 'events', cleanedMenu.id);
      const savedEvent = await store.getDoc(eventRef);
      if (!savedEvent.exists()) throw new Error('event-missing');
      if (cleanPublicPath) {
        const duplicate = await store.getDocs(store.query(
          store.collection(db, 'events'),
          store.where('publicPath', '==', cleanPublicPath),
          store.limit(2),
        ));
        if (duplicate.docs.some((document) => document.id !== cleanedMenu.id))
          throw new Error('path-taken');
      }
      const savedData = savedEvent.data() as EventMenu;
      const ownerUid = savedData.ownerUid || cleanedMenu.ownerUid || user.uid;
      const previousPublicPath = normalizedPublicEventPath(savedData.publicPath);
      const previousClaimId = savedData.publicPathClaimId
        || (previousPublicPath ? await guestNameIndexId(previousPublicPath) : '');
      const nextClaimId = cleanPublicPath ? await guestNameIndexId(cleanPublicPath) : '';
      const previousClaimRef = previousClaimId
        ? store.doc(db, 'public-paths', previousClaimId)
        : null;
      const nextClaimRef = nextClaimId
        ? store.doc(db, 'public-paths', nextClaimId)
        : null;
      await store.runTransaction(db, async (transaction) => {
        const previousClaim = previousClaimRef ? await transaction.get(previousClaimRef) : null;
        const nextClaim = nextClaimRef && nextClaimId !== previousClaimId
          ? await transaction.get(nextClaimRef)
          : previousClaim;
        if (nextClaim?.exists() && nextClaim.data().eventId !== cleanedMenu.id)
          throw new Error('path-taken');
        if (previousClaimRef && previousClaim?.exists() && previousClaim.data().eventId === cleanedMenu.id && previousClaimId !== nextClaimId)
          transaction.delete(previousClaimRef);
        if (nextClaimRef && !nextClaim?.exists()) transaction.set(nextClaimRef, {
          eventId: cleanedMenu.id,
          ownerUid,
          publicPath: cleanPublicPath,
          createdAt: store.serverTimestamp(),
        });
        transaction.set(eventRef, withoutUndefined({
          ...cleanedMenu,
          ownerUid,
          publicPathClaimId: nextClaimId || undefined,
        }), { merge: true });
      });
      await persistScheduledOrders(orders);
      setEditing(false);
      notify('Menu saved');
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(
        (error as Error).message === 'path-taken'
          ? 'That guest link belongs to another event. Choose a different web address.'
          : code === 'permission-denied'
          ? 'This host account does not have permission to save the event.'
          : code === 'resource-exhausted'
            ? 'The event is too large to save. Remove an image and try again.'
            : 'The event could not be saved. Your edits are still here — please try again.',
      );
    }
  }
  async function cancelMenuEdits() {
    let savedMenu = events.find((event) => event.id === menu.id);
    if (firebaseConfigured) {
      try {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        const snapshot = await store.getDoc(
          store.doc(store.getFirestore(getApp()), 'events', menu.id),
        );
        if (snapshot.exists())
          savedMenu = { id: snapshot.id, ...snapshot.data() } as EventMenu;
      } catch {
        notify('Could not reload the saved menu. Your draft is still open.');
        return;
      }
    }
    if (savedMenu) setMenu(savedMenu);
    setEditing(false);
    notify('Changes discarded — the saved menu is restored');
  }

  async function setEventAccepting(accepting: boolean) {
    const previousMenu = menu;
    const previousEvents = events;
    const updatedMenu = { ...menu, accepting };
    const updatedEvents = events.map((event) =>
      event.id === menu.id ? updatedMenu : event,
    );
    setMenu(updatedMenu);
    setEvents(updatedEvents);
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        await store.updateDoc(
          store.doc(store.getFirestore(getApp()), 'events', menu.id),
          { accepting },
        );
      } else shareDemoUpdate({ type: 'events', value: updatedEvents });
      notify(
        accepting
          ? 'Ordering is open — guests can submit now'
          : 'Ordering stopped — existing orders are still here',
      );
    } catch {
      setMenu(previousMenu);
      setEvents(previousEvents);
      notify('Could not change ordering status');
    }
  }

  async function setEventRsvpOpen(rsvpOpen: boolean) {
    const previousMenu = menu;
    const previousEvents = events;
    const updatedMenu = { ...menu, rsvpOpen };
    const updatedEvents = events.map((event) =>
      event.id === menu.id ? updatedMenu : event,
    );
    setMenu(updatedMenu);
    setEvents(updatedEvents);
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        await store.updateDoc(
          store.doc(store.getFirestore(getApp()), 'events', menu.id),
          { rsvpOpen },
        );
      } else shareDemoUpdate({ type: 'events', value: updatedEvents });
      notify(
        rsvpOpen
          ? 'RSVPs are open — guests can respond now'
          : 'RSVPs are locked — existing responses are preserved',
      );
    } catch {
      setMenu(previousMenu);
      setEvents(previousEvents);
      notify('Could not change RSVP status');
    }
  }

  async function setEventChatOpen(chatIsOpen: boolean) {
    const previousMenu = menu;
    const previousEvents = events;
    const updatedMenu = { ...menu, chatOpen: chatIsOpen };
    const updatedEvents = events.map((event) =>
      event.id === menu.id ? updatedMenu : event,
    );
    setMenu(updatedMenu);
    setEvents(updatedEvents);
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        await store.updateDoc(
          store.doc(store.getFirestore(getApp()), 'events', menu.id),
          { chatOpen: chatIsOpen },
        );
      } else shareDemoUpdate({ type: 'events', value: updatedEvents });
      notify(chatIsOpen ? 'Chat is open' : 'Chat is locked — history stays visible');
    } catch {
      setMenu(previousMenu);
      setEvents(previousEvents);
      notify('Could not change chat status');
    }
  }

  async function prepareEventBackground(file: File, maxDataUrlLength = 360_000) {
    if (!file.type.startsWith('image/') && !heicFile(file))
      throw new Error('Choose a JPEG, PNG, WebP, HEIC, or HEIF image');
    if (file.size > 40 * 1024 * 1024)
      throw new Error('The original photo is over 40 MB. Export a smaller copy first');
    return compressImageForDocument(file, maxDataUrlLength);
  }

  async function chooseNewEventBackground(file?: File) {
    if (!file) return;
    try {
      notify(heicFile(file) ? 'Converting HEIC photo…' : 'Optimizing background photo…');
      const backgroundImageUrl = await prepareEventBackground(file);
      setBackgroundEditor({
        target: 'new',
        imageUrl: backgroundImageUrl,
        focus: centerBackgroundFocus(),
        zoom: 1,
      });
      notify('Photo ready — adjust the framing');
    } catch (error) {
      notify((error as Error).message || 'Could not use that image');
    }
  }

  async function uploadEventBackground(file: File) {
    try {
      notify(heicFile(file) ? 'Converting HEIC photo…' : 'Optimizing background photo…');
      const itemImageBytes = menu.items.reduce(
        (total, item) => total + (item.imageUrl?.startsWith('data:') ? item.imageUrl.length : 0),
        0,
      );
      const availableForBackground = Math.min(360_000, 900_000 - itemImageBytes);
      if (availableForBackground < 90_000)
        throw new Error('Remove a menu-item photo before adding this background');
      const backgroundImageUrl = await prepareEventBackground(file, availableForBackground);
      setBackgroundEditor({
        target: 'existing',
        imageUrl: backgroundImageUrl,
        focus: centerBackgroundFocus(),
        zoom: 1,
      });
      notify('Photo ready — adjust the framing');
    } catch (error) {
      notify((error as Error).message || 'Could not use that image');
    }
  }

  function applyBackgroundFraming(focus: BackgroundFocus, zoom: number) {
    if (!backgroundEditor) return;
    if (backgroundEditor.target === 'new') {
      setNewEvent((current) => ({
        ...current,
        backgroundImageUrl: backgroundEditor.imageUrl,
        backgroundFocus: focus,
        backgroundZoom: zoom,
      }));
      notify('Custom event background ready');
    } else {
      setMenu((current) => ({
        ...current,
        backgroundImageUrl: backgroundEditor.imageUrl,
        backgroundFocus: focus,
        backgroundZoom: zoom,
      }));
      notify('Background updated — save the event when ready');
    }
    setBackgroundEditor(null);
  }

  async function uploadItemImage(itemId: string, file: File) {
    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Please choose an image smaller than 5 MB');
      return;
    }
    // Keep item art in the event document. This makes images work on GitHub Pages
    // without requiring a paid Firebase Storage bucket. Resize first so a menu
    // remains comfortably below Firestore's 1 MB document limit.
    const imageUrl = await resizeImageFile(file, 900, 0.72);
    const otherImageBytes = menu.items
      .filter((item) => item.id !== itemId)
      .reduce((total, item) => total + (item.imageUrl?.startsWith('data:') ? item.imageUrl.length : 0), 0);
    const heroImageBytes = menu.backgroundImageUrl?.startsWith('data:')
      ? menu.backgroundImageUrl.length
      : 0;
    if (imageUrl.length > 180_000 || otherImageBytes + heroImageBytes + imageUrl.length > 900_000) {
      notify('This menu is at its image limit — choose a smaller photo or remove another image');
      return;
    }
    setMenu((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, imageUrl, imagePath: undefined } : item,
      ),
    }));
    notify('Image added — save the menu when ready');
  }

  async function deleteEvent(event: EventMenu) {
    if (firebaseConfigured) {
      const [{ getApp }, store, storageModule] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
        import('firebase/storage'),
      ]);
      const app = getApp();
      const db = store.getFirestore(app);
      await Promise.all(
        event.items
          .filter((item) => item.imagePath)
          .map(async (item) => {
            try {
              await storageModule.deleteObject(
                storageModule.ref(
                  storageModule.getStorage(app),
                  item.imagePath!,
                ),
              );
            } catch {
              /* Missing images do not block event deletion. */
            }
          }),
      );
      const eventDocuments = (await Promise.all(
        ['orders', 'rsvps', 'guests', 'guest-names', 'guest-phones', 'name-index', 'expense-participants', 'expenses'].map((collectionName) =>
          store.getDocs(store.collection(db, 'events', event.id, collectionName)),
        ),
      )).flatMap((snapshot) => snapshot.docs);
      await Promise.allSettled(eventDocuments
        .map((document) => document.data().receiptPath as string | undefined)
        .filter((path): path is string => Boolean(path))
        .map((path) => storageModule.deleteObject(storageModule.ref(storageModule.getStorage(app), path))));
      for (let index = 0; index < eventDocuments.length; index += 400) {
        const batch = store.writeBatch(db);
        eventDocuments
          .slice(index, index + 400)
          .forEach((document) => batch.delete(document.ref));
        await batch.commit();
      }
      const deleteBatch = store.writeBatch(db);
      const publicPath = normalizedPublicEventPath(event.publicPath);
      const claimId = event.publicPathClaimId
        || (publicPath ? await guestNameIndexId(publicPath) : '');
      if (claimId) deleteBatch.delete(store.doc(db, 'public-paths', claimId));
      deleteBatch.delete(store.doc(db, 'events', event.id));
      await deleteBatch.commit();
    } else {
      localStorage.removeItem(demoOrdersKey(event.id));
      const nextEvents = events.filter((item) => item.id !== event.id);
      setEvents(nextEvents);
      shareDemoUpdate({ type: 'events', value: nextEvents });
    }
    const remaining = events.filter((item) => item.id !== event.id);
    setEvents(remaining);
    setDeletingEvent(null);
    setEditing(false);
    setOrders([]);
    if (remaining[0]) selectHostEvent(remaining[0]);
    else history.replaceState({}, '', hostHomeRoute());
    notify('Event deleted');
  }

  const guestEventView = mode === 'guest' && menu.id !== EMPTY_EVENT_ID;
  const guestHomeView = mode === 'guest' && menu.id === EMPTY_EVENT_ID;
  const openHostPreview = () => {
    sessionStorage.setItem(
      HOST_PREVIEW_RETURN_ROUTE_KEY,
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    window.location.replace(hostPreviewRoute(menu.id, automaticPublicEventPath(menu)));
  };
  const navigateBack = () => {
    if (hostPreview) {
      const returnRoute = sessionStorage.getItem(HOST_PREVIEW_RETURN_ROUTE_KEY)
        || eventRoute(menu.id, 'host', automaticPublicEventPath(menu));
      sessionStorage.removeItem(HOST_PREVIEW_RETURN_ROUTE_KEY);
      window.location.replace(returnRoute);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(mode === 'host' ? hostHomeRoute() : guestHomeRoute());
  };
  const navigateHome = () => {
    sessionStorage.removeItem(CREATE_EVENT_INTENT_KEY);
    sessionStorage.removeItem(CREATE_EVENT_RETURN_ROUTE_KEY);
    window.location.assign(hostPreview
      ? eventRoute(menu.id, 'host', automaticPublicEventPath(menu))
      : guestHomeRoute());
  };
  const createNewEvent = () => {
    sessionStorage.setItem(CREATE_EVENT_INTENT_KEY, '1');
    sessionStorage.setItem(
      CREATE_EVENT_RETURN_ROUTE_KEY,
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    window.location.assign(newEventHostRoute());
  };
  const cancelCreatingEvent = () => {
    const returnRoute = sessionStorage.getItem(CREATE_EVENT_RETURN_ROUTE_KEY);
    sessionStorage.removeItem(CREATE_EVENT_INTENT_KEY);
    sessionStorage.removeItem(CREATE_EVENT_RETURN_ROUTE_KEY);
    setCreatingEvent(false);
    if (returnRoute) window.location.replace(returnRoute);
  };
  const openEventChat = () => {
    if (!chatActor) {
      notify(mode === 'guest'
        ? 'RSVP Going before joining this event chat.'
        : 'Sign in before joining this event chat.');
      return;
    }
    primeChatAudio();
    setChatStarted(true);
    setChatOpen(true);
    setEventMenuOpen(false);
  };
  const updateCurrentChatUnread = useCallback((unread: number) => {
    if (menu.id === EMPTY_EVENT_ID) return;
    setEventNotificationCounts((current) => current[menu.id] === unread
      ? current
      : { ...current, [menu.id]: unread });
  }, [menu.id]);

  if (!eventReady) {
    return (
      <main className="event-loading" aria-live="polite">
        <span><UtensilsCrossed size={22} /></span>
        <p>Loading your event…</p>
      </main>
    );
  }

  return (
    <main
      className={`app-root min-h-screen ${mode === 'host' ? 'host-mode' : 'guest-mode'} ${guestHomeView ? 'guest-home-view' : ''} ${editing ? 'is-editing' : ''} ${isNativeIOSApp ? 'native-ios-app' : ''}`}
      style={mode === 'guest' ? eventThemeStyle(menu) : undefined}
    >
      <header className="app-header sticky top-0 z-30 border-b border-black/8 bg-[var(--cream)]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5">
          <div className="app-header-brand">
            <button
              onClick={() => window.location.assign(
                hostPreview
                  ? eventRoute(menu.id, 'host', automaticPublicEventPath(menu))
                  : mode === 'host' ? hostHomeRoute() : guestHomeRoute(),
              )}
              className="app-brand-button flex items-center gap-3"
              aria-label={hostPreview ? 'Return to this event in Nights Host' : mode === 'host' ? 'Nights Host home' : 'Open guest events'}
            >
              <span className="app-logo-frame grid size-9 place-items-center overflow-hidden rounded-xl bg-[var(--tomato)] text-white">
                <Image src="/gathering/icons/nights-app-icon-180.png" alt="" width={36} height={36} />
              </span>
              <span className="whitespace-nowrap font-display text-xl font-semibold tracking-tight">
                {mode === 'host' ? 'Nights Host' : 'Nights'}
              </span>
            </button>
          </div>
          <div className="app-header-actions flex items-center gap-2">
            {mode === 'guest' && appEnvironmentReady && !isStandalone && !isNativeIOSApp && (
              <button
                onClick={openInstallGuide}
                className="install-app-button"
                aria-label="Install Nights on iPhone"
              >
                <Smartphone size={15} />
                <span>Install app</span>
              </button>
            )}
            {mode === 'host' && isStandalone && !isNativeIOSApp && (
              <span className="host-app-badge">
                <Smartphone size={14} /> Nights Host
              </span>
            )}
            {accountUser && <button
              type="button"
              className="persistent-profile-button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              aria-label="Open user profile"
              aria-expanded={profileMenuOpen}
              title={accountUser.email}
            >
              {accountProfile
                ? `${accountProfile.firstName?.[0] || ''}${accountProfile.lastName?.[0] || ''}`.toUpperCase()
                : <UsersRound size={17} />}
            </button>}
            {menu.id !== EMPTY_EVENT_ID && !isNativeIOSApp && <button
              type="button"
              onClick={() => {
                if (!chatActor) {
                  notify(mode === 'guest'
                    ? 'RSVP Going before enabling notifications for this event.'
                    : 'Sign in before enabling event notifications.');
                  return;
                }
                void (pushNotificationState === 'enabled'
                  ? disableChatNotifications()
                  : enableChatNotifications());
              }}
              disabled={pushNotificationBusy}
              className={`chat-header-button ${pushNotificationState === 'enabled' ? 'notification-enabled' : ''}`}
              title={pushNotificationState === 'enabled' ? 'Mute this event' : currentEventMuted ? 'Unmute this event' : 'Turn on notifications for this event'}
              aria-label={pushNotificationState === 'enabled' ? 'Mute this event' : currentEventMuted ? 'Unmute this event' : 'Turn on notifications for this event'}
            >
              {pushNotificationState === 'enabled' ? <BellRing size={16} /> : currentEventMuted ? <BellOff size={16} /> : <Bell size={16} />}
              <span>{pushNotificationState === 'enabled' ? 'Notifications on' : currentEventMuted ? 'Unmute event' : 'Notify me'}</span>
            </button>}
          </div>
        </div>
      </header>

      {eventMenuOpen && <button type="button" className="event-menu-scrim" onClick={() => setEventMenuOpen(false)} aria-label="Close event menu" />}

      {mode === 'guest' ? (
        menu.id === EMPTY_EVENT_ID ? (
          <GuestAccessPortal
            authReady={accountAuthReady}
            user={accountUser}
            profile={accountProfile}
            authMode={accountAuthMode}
            email={accountEmail}
            password={accountPassword}
            firstName={accountFirstName}
            lastName={accountLastName}
            phone={accountPhone}
            recoverySentTo={accountRecoverySentTo}
            events={guestEvents}
            chatUnreadCounts={eventNotificationCounts}
            activityUnreadCounts={activityUnreadCounts}
            pendingEvent={pendingGuestEvent}
            busy={accountAuthBusy || guestEventsBusy}
            setAuthMode={setAccountAuthMode}
            setEmail={setAccountEmail}
            setPassword={setAccountPassword}
            setFirstName={setAccountFirstName}
            setLastName={setAccountLastName}
            setPhone={(value) => setAccountPhone(formatPhoneInput(value))}
            signInEmail={() => void signInWithEmail()}
            signUpEmail={() => void signUpWithEmail()}
            signInGoogle={() => void signInWithProvider('google')}
            signInApple={() => void signInWithProvider('apple')}
            resetPassword={() => void resetAccountPassword()}
            resendVerification={() => void resendAccountVerification()}
            checkVerification={() => void checkAccountVerification()}
            changeEmail={(email) => void changeUnverifiedAccountEmail(email)}
            signOut={() => void signOutAccount()}
            completeProfile={() => void completeProviderProfile()}
            selectEvent={selectGuestEvent}
          />
        ) : (
          <GuestMenu
            menu={menu}
            categories={categories}
            cart={cart}
            reserved={rememberedOrders.filter((order) => order.id !== editingOrderId)}
            canOrder={myRsvp?.status === 'yes' && menu.accepting && guestHasEventAccess}
            accessGranted={guestHasEventAccess}
            rsvpStatus={myRsvp?.status || null}
            rsvpApprovalStatus={myRsvp ? approvalStatus(myRsvp) : null}
            setQty={setQty}
            rsvpButtonLabel={rsvpButtonLabel}
            onOpenRsvp={openRsvpPanel}
          />
        )
      ) : (
        <HostWorkspace
          events={events}
          menu={menu}
          orders={orders}
          rsvps={rsvps}
          contacts={hostContacts}
          invitations={[...hostInvitations, ...pendingHostInvitations]}
          eventIncomingCounts={eventIncomingCounts}
          editing={editing}
          setEditing={setEditing}
          setMenu={setMenu}
          selectEvent={selectHostEvent}
          onPreview={openHostPreview}
          setCreatingEvent={setCreatingEvent}
          setDeletingEvent={setDeletingEvent}
          saveMenu={saveMenu}
          cancelMenuEdits={cancelMenuEdits}
          uploadItemImage={uploadItemImage}
          uploadEventBackground={uploadEventBackground}
          adjustEventBackground={() => menu.backgroundImageUrl && setBackgroundEditor({
            target: 'existing',
            imageUrl: menu.backgroundImageUrl,
            focus: eventBackgroundFocus(menu),
            zoom: eventBackgroundZoom(menu),
          })}
          acceptTasks={acceptTasks}
          rejectOrder={rejectOrder}
          rejectWaitingItems={rejectWaitingItems}
          clearOrderHistory={clearOrderHistory}
          deleteGuest={deleteGuest}
          setGuestApproval={setGuestApproval}
          finishTask={finishTask}
          serveTask={serveTask}
          setAccepting={setEventAccepting}
          setRsvpOpen={setEventRsvpOpen}
          setChatOpen={setEventChatOpen}
          inviteGuest={inviteRegisteredGuest}
          revokeInvitation={revokeRegisteredGuest}
          notify={notify}
        />
      )}

      {mode === 'guest' && guestEventPickerOpen && guestSession && (
        <GuestEventPicker
          events={guestEvents}
          currentEventId={menu.id}
          guestName={guestSession.guestName}
          busy={guestEventsBusy}
          onSelect={selectGuestEvent}
          onClose={() => setGuestEventPickerOpen(false)}
          onUseAnotherGuest={clearGuestAccess}
        />
      )}

      {profileMenuOpen && accountUser && (
        <>
          <button type="button" className="profile-menu-scrim" onClick={() => setProfileMenuOpen(false)} aria-label="Close user profile" />
          <section className="profile-menu" aria-label="User profile">
            <button type="button" className="profile-menu-identity" onClick={openAccountProfileEditor}>
              <span>{accountProfile ? `${accountProfile.firstName?.[0] || ''}${accountProfile.lastName?.[0] || ''}`.toUpperCase() : <UsersRound size={17} />}</span>
              <div>
                <strong>{accountProfile ? accountDisplayName(accountProfile) : 'Account setup'}</strong>
                <small>{accountUser.email}</small>
              </div>
              <Pencil size={14} aria-hidden="true" />
            </button>
            <section className="profile-money-summary profile-menu-money" aria-label="Expense balances">
              <span className={`profile-balance ${accountMoney.balance < 0 ? 'negative' : accountMoney.balance > 0 ? 'positive' : ''}`}>
                <span>Balance</span><b>{formatBalance(accountMoney.balance)}</b><i aria-hidden="true" />
              </span>
              <button type="button" className="profile-balance positive" onClick={() => openMoneyDetails('owed', 'menu')}>
                <span>Owed to you</span><b>{formatCents(accountMoney.owed)}</b><ChevronRight size={13} />
              </button>
              <button type="button" className="profile-balance negative" onClick={() => openMoneyDetails('owes', 'menu')}>
                <span>You owe</span><b>{accountMoney.owes ? `-${formatCents(accountMoney.owes)}` : formatCents(0)}</b><ChevronRight size={13} />
              </button>
            </section>
            <button type="button" className="profile-menu-action" onClick={() => {
              setProfileMenuOpen(false);
              setSettingsOpen(true);
            }}><Settings2 size={16} /><span><strong>Settings</strong><small>Notifications and app preferences</small></span></button>
            <button type="button" className="profile-menu-action" onClick={() => void signOutAccount()}>
              <LogOut size={16} /><span><strong>Sign out</strong><small>Return to the login page</small></span>
            </button>
            <button type="button" className="profile-menu-delete" onClick={() => {
              setProfileMenuOpen(false);
              setDeleteAccountOpen(true);
            }}><Trash2 size={16} /><span><strong>Delete account</strong><small>Permanently remove your account and data</small></span></button>
          </section>
        </>
      )}

      {settingsOpen && accountUser && createPortal(
        <div className="delete-account-backdrop settings-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !pushNotificationBusy) setSettingsOpen(false);
        }}>
          <dialog open className="delete-account-dialog settings-dialog" aria-labelledby="settings-title">
            <span className="settings-dialog-icon"><Settings2 size={24} /></span>
            <p className="eyebrow">Account preferences</p>
            <h2 id="settings-title" className="font-display">Settings</h2>
            {isNativeIOSApp ? (
              <section className="settings-notification-row native-notification-status">
                <div><strong>iPhone notifications</strong><small>Native notifications will appear here after the App Store notification service is connected. Browser Web Push is disabled inside the app.</small></div>
                <span>App managed</span>
              </section>
            ) : (
              <section className="settings-notification-row">
                <div><strong>Default notifications</strong><small>Automatically notify this device about messages in every eligible event. Event-level Notify Me controls can override this.</small></div>
                <button
                  type="button"
                  className={`settings-notification-switch ${notificationsDefaultEnabled ? 'enabled' : ''}`}
                  role="switch"
                  aria-checked={notificationsDefaultEnabled}
                  aria-label="Default notifications"
                  disabled={pushNotificationBusy}
                  onClick={() => void (notificationsDefaultEnabled
                    ? disableDefaultNotifications()
                    : enableDefaultNotifications())}
                >
                  <span>{pushNotificationBusy ? 'Updating…' : notificationsDefaultEnabled ? 'On' : 'Off'}</span>
                  <i className="notification-switch-track" aria-hidden="true"><b /></i>
                </button>
              </section>
            )}
            <div className="delete-account-actions single-action">
              <button type="button" onClick={() => setSettingsOpen(false)} disabled={pushNotificationBusy}>Done</button>
            </div>
          </dialog>
        </div>,
        document.body,
      )}

      {profileEditorOpen && accountUser && accountProfile && createPortal(
        <div className="delete-account-backdrop profile-editor-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !profileEditorBusy) setProfileEditorOpen(false);
        }}>
          <dialog open className="delete-account-dialog profile-editor-dialog" aria-labelledby="profile-editor-title">
            <span className="settings-dialog-icon"><Pencil size={24} /></span>
            <p className="eyebrow">Your Nights identity</p>
            <h2 id="profile-editor-title" className="font-display">Edit profile</h2>
            <p>Your display name is what guests see. Your legal name is not required.</p>
            <section className="profile-editor-balance" aria-label="Expense balances">
              <span><DollarSign size={17} /></span>
              <div className={accountMoney.balance < 0 ? 'negative' : accountMoney.balance > 0 ? 'positive' : ''}><small>My balance</small><strong>{formatBalance(accountMoney.balance)}</strong></div>
              <button type="button" className="positive" onClick={() => openMoneyDetails('owed', 'editor')}><small>Owed to me</small><strong>{formatCents(accountMoney.owed)}</strong><ChevronRight size={14} /></button>
              <button type="button" className="negative" onClick={() => openMoneyDetails('owes', 'editor')}><small>I owe</small><strong>{accountMoney.owes ? `-${formatCents(accountMoney.owes)}` : formatCents(0)}</strong><ChevronRight size={14} /></button>
            </section>
            <div className="profile-editor-name-grid">
              <label className="field-label">First name<input className="field-input" value={profileFirstName} onChange={(event) => setProfileFirstName(event.target.value)} /></label>
              <label className="field-label">Last name<input className="field-input" value={profileLastName} onChange={(event) => setProfileLastName(event.target.value)} /></label>
            </div>
            <label className="field-label">Display name<input className="field-input" value={profileDisplayName} onChange={(event) => setProfileDisplayName(event.target.value)} placeholder={`${profileFirstName} ${profileLastName}`.trim()} /></label>
            <label className="field-label">Phone number<input className="field-input" value={profilePhone} onChange={(event) => setProfilePhone(formatPhoneInput(event.target.value))} inputMode="tel" autoComplete="tel" maxLength={12} placeholder="555-555-5555" /></label>
            <label className="field-label">Email address<input className="field-input" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} /></label>
            {normalizedAccountEmail(profileEmail) !== normalizedAccountEmail(accountUser.email) && (
              <p className="profile-email-note">We’ll send a verification link to the new address. Your current email stays active until you verify the replacement.</p>
            )}
            <div className="delete-account-actions">
              <button type="button" onClick={() => setProfileEditorOpen(false)} disabled={profileEditorBusy}>Cancel</button>
              <button type="button" className="primary-button" onClick={() => void saveAccountProfileEdits()} disabled={profileEditorBusy}>{profileEditorBusy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </dialog>
        </div>,
        document.body,
      )}

      {moneyDetailsOpen && createPortal(
        <div className="money-details-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeMoneyDetails();
        }}>
          <dialog open className="money-details-dialog" aria-labelledby="money-details-title">
            <header>
              <div>
                <p className="eyebrow">Expense breakdown</p>
                <h2 id="money-details-title" className="font-display">{moneyDetailsOpen === 'owed' ? 'Owed to me' : 'I owe'}</h2>
                <span>{moneyDetailsOpen === 'owed' ? formatCents(accountMoney.owed) : formatCents(accountMoney.owes)} total</span>
              </div>
              <button type="button" onClick={closeMoneyDetails} aria-label="Close balance details"><XCircle size={21} /></button>
            </header>
            <div className="money-details-list">
              {(moneyDetailsOpen === 'owed' ? accountMoney.owedDetails : accountMoney.owesDetails).map((detail) => (
                <article key={`${detail.direction}:${detail.eventId}:${detail.personId}`}>
                  <span>{detail.personName.trim().slice(0, 1).toUpperCase() || '?'}</span>
                  <div>
                    <strong>{detail.personName}</strong>
                    <small><CalendarPlus size={12} />{detail.eventTitle}</small>
                    <p>{detail.expenseTitles.join(' · ')}</p>
                  </div>
                  <b>{formatCents(detail.amountCents)}</b>
                </article>
              ))}
              {!(moneyDetailsOpen === 'owed' ? accountMoney.owedDetails : accountMoney.owesDetails).length && (
                <div className="money-details-empty"><DollarSign size={25} /><strong>Nothing here yet</strong><span>Expense shares will appear here by person and event.</span></div>
              )}
            </div>
          </dialog>
        </div>,
        document.body,
      )}

      {expensesOpen && expenseActor && (
        <div onPointerDownCapture={(event) => {
          const control = (event.target as Element).closest<HTMLElement>('[data-expense-action]');
          if (!control) return;
          const action = control.dataset.expenseAction;
          if (action === 'close') {
            event.preventDefault();
            event.stopPropagation();
            setExpensesOpen(false);
            return;
          }
          if (action === 'edit' && control.dataset.expenseId) {
            event.preventDefault();
            event.stopPropagation();
            setExpenseEditRequest({ id: control.dataset.expenseId, nonce: Date.now() });
          }
        }}>
          <ExpensePanel
            key={menu.id}
            menu={menu}
            actor={expenseActor}
            canManage={canManageCurrentEvent}
            fallbackRsvps={rsvps}
            editRequest={expenseEditRequest}
            onClose={() => setExpensesOpen(false)}
            notify={notify}
          />
        </div>
      )}

      {appEnvironmentReady && gamesOpen && menu.id !== EMPTY_EVENT_ID && createPortal(
        <GamePanel
          key={menu.id}
          menu={menu}
          canManage={canManageGame}
          accountUid={accountUser?.uid || ''}
          participants={gameParticipants}
          viewer={gameViewer}
          hostId={gameHostId}
          onClose={() => {
            setEventMenuOpen(false);
            setGamesOpen(false);
          }}
          notify={notify}
        />,
        document.body,
      )}

      {activityCenterOpen && (
        <div className="activity-center-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setActivityCenterOpen(false);
        }}>
          <dialog open className="activity-center-dialog" aria-labelledby="activity-center-title">
            <header>
              <div><p className="eyebrow">{menu.title}</p><h2 id="activity-center-title" className="font-display">Notifications</h2></div>
              <button type="button" onClick={() => setActivityCenterOpen(false)} aria-label="Close notifications"><XCircle size={22} /></button>
            </header>
            <p className="activity-center-note">Event updates and expenses appear here. Chat messages stay in Chat.</p>
            <div className="activity-center-list">
              {eventActivities.filter((activity) => activity.eventId === menu.id).length ? eventActivities
                .filter((activity) => activity.eventId === menu.id)
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((activity) => (
                  <article key={activity.id}>
                    <span>{activity.kind === 'expense' ? <DollarSign size={17} /> : activity.kind === 'location' ? <MapPin size={17} /> : activity.kind === 'schedule' ? <Clock3 size={17} /> : <Bell size={17} />}</span>
                    <div><strong>{activity.title}</strong><p>{activity.detail}</p><time>{new Date(activity.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
                  </article>
                )) : <div className="activity-center-empty"><Bell size={24} /><strong>You’re caught up</strong><span>New event activity will appear here.</span></div>}
            </div>
          </dialog>
        </div>
      )}

      {deleteAccountOpen && accountUser && (
        <div className="delete-account-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deleteAccountBusy) setDeleteAccountOpen(false);
        }}>
          <dialog open className="delete-account-dialog" aria-labelledby="delete-account-title">
            <span className="delete-account-icon"><Trash2 size={24} /></span>
            <p className="eyebrow">Permanent account deletion</p>
            <h2 id="delete-account-title" className="font-display">Are you sure?</h2>
            <p>Your account, RSVPs, orders, messages, notification registrations, and events you host will be permanently removed. Your RSVP will disappear from each host’s guest list. This cannot be undone.</p>
            <div className="delete-account-actions">
              <button type="button" onClick={() => setDeleteAccountOpen(false)} disabled={deleteAccountBusy}>Cancel</button>
              <button type="button" className="danger-button" onClick={() => void deleteAccountPermanently()} disabled={deleteAccountBusy}>
                {deleteAccountBusy ? 'Deleting account…' : 'Yes, I’m sure — delete'}
              </button>
            </div>
          </dialog>
        </div>
      )}

      {backgroundEditor && (
        <BackgroundCropModal
          editor={backgroundEditor}
          onCancel={() => setBackgroundEditor(null)}
          onApply={applyBackgroundFraming}
        />
      )}

      {chatStarted && chatActor && (
        <EventChat
          key={menu.id}
          menu={menu}
          actor={chatActor}
          visible={chatOpen}
          onMinimize={() => setChatOpen(false)}
          onUnreadChange={updateCurrentChatUnread}
          pushNotificationState={pushNotificationState}
          eventMuted={currentEventMuted}
          pushNotificationBusy={pushNotificationBusy}
          pushAvailable={!isNativeIOSApp}
          onTogglePush={() => void (pushNotificationState === 'enabled'
            ? disableChatNotifications()
            : enableChatNotifications())}
          notify={notify}
        />
      )}

      {mode === 'host' && firebaseConfigured && (!accountAuthReady || !hostUser) && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--cream)]/96 p-6 backdrop-blur">
          <AccountAuthCard
            context="host"
            authReady={accountAuthReady}
            user={accountUser}
            profile={accountProfile}
            authMode={accountAuthMode}
            email={accountEmail}
            password={accountPassword}
            firstName={accountFirstName}
            lastName={accountLastName}
            phone={accountPhone}
            recoverySentTo={accountRecoverySentTo}
            busy={accountAuthBusy}
            setAuthMode={setAccountAuthMode}
            setEmail={setAccountEmail}
            setPassword={setAccountPassword}
            setFirstName={setAccountFirstName}
            setLastName={setAccountLastName}
            setPhone={(value) => setAccountPhone(formatPhoneInput(value))}
            signInEmail={() => void signInWithEmail()}
            signUpEmail={() => void signUpWithEmail()}
            signInGoogle={() => void signInWithProvider('google')}
            signInApple={() => void signInWithProvider('apple')}
            resetPassword={() => void resetAccountPassword()}
            resendVerification={() => void resendAccountVerification()}
            checkVerification={() => void checkAccountVerification()}
            changeEmail={(email) => void changeUnverifiedAccountEmail(email)}
            signOut={() => void signOutAccount()}
            completeProfile={() => void completeProviderProfile()}
          />
        </div>
      )}
      {mode === 'guest' && firebaseConfigured && menu.id !== EMPTY_EVENT_ID && accountNeedsEmailVerification(accountUser) && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[var(--cream)]/96 p-6 backdrop-blur">
          <AccountAuthCard
            context="guest"
            authReady={accountAuthReady}
            user={accountUser}
            profile={accountProfile}
            authMode={accountAuthMode}
            email={accountEmail}
            password={accountPassword}
            firstName={accountFirstName}
            lastName={accountLastName}
            phone={accountPhone}
            recoverySentTo={accountRecoverySentTo}
            busy={accountAuthBusy}
            setAuthMode={setAccountAuthMode}
            setEmail={setAccountEmail}
            setPassword={setAccountPassword}
            setFirstName={setAccountFirstName}
            setLastName={setAccountLastName}
            setPhone={(value) => setAccountPhone(formatPhoneInput(value))}
            signInEmail={() => void signInWithEmail()}
            signUpEmail={() => void signUpWithEmail()}
            signInGoogle={() => void signInWithProvider('google')}
            signInApple={() => void signInWithProvider('apple')}
            resetPassword={() => void resetAccountPassword()}
            resendVerification={() => void resendAccountVerification()}
            checkVerification={() => void checkAccountVerification()}
            changeEmail={(email) => void changeUnverifiedAccountEmail(email)}
            signOut={() => void signOutAccount()}
            completeProfile={() => void completeProviderProfile()}
          />
        </div>
      )}
      {creatingEvent && (
        <div className="new-event-backdrop fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/45 p-5 backdrop-blur-sm">
          <section className="new-event-dialog w-full max-w-xl rounded-3xl bg-[var(--cream)] p-7 shadow-2xl sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">New event</p>
                <h2 className="font-display mt-2 text-4xl font-semibold">
                  Start with the essentials
                </h2>
                <p className="mt-2 text-sm leading-6 text-black/55">
                  You’ll build the dishes immediately after this step.
                </p>
              </div>
              <div className="new-event-dialog-actions">
                <button
                  onClick={cancelCreatingEvent}
                  className="icon-button"
                  aria-label="Close new event"
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>
            <label className="field-label mt-7">
              Event name
              <input
                value={newEvent.title}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, title: e.target.value })
                }
                className="field-input"
                placeholder="Sunday birthday brunch"
              />
            </label>
            <fieldset className="event-link-builder">
              <legend className="field-label">Guest link</legend>
              <div className="event-link-inputs">
                <span>gaemaj.tech/</span>
                <input
                  value={newEvent.publicPathCategory}
                  onChange={(event) => setNewEvent({
                    ...newEvent,
                    publicPathCategory: normalizeEventPathSegment(event.target.value),
                  })}
                  className="field-input"
                  placeholder="movie-night"
                  aria-label="Event link first part"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <span>/</span>
                <input
                  value={newEvent.publicPathEvent}
                  onChange={(event) => setNewEvent({
                    ...newEvent,
                    publicPathEvent: normalizeEventPathSegment(event.target.value),
                  })}
                  className="field-input"
                  placeholder="oct4"
                  aria-label="Event link second part"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <small>Use the first part for the kind of gathering and the second for this specific event.</small>
            </fieldset>
            <fieldset className="new-event-type-picker">
              <legend className="field-label">What kind of gathering is this?</legend>
              <div>
                {EVENT_TYPES.map((type) => (
                  <label key={type.value} className={newEvent.eventType === type.value ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="event-type"
                      value={type.value}
                      checked={newEvent.eventType === type.value}
                      onChange={() => {
                        const previousDefault = defaultEventPathCategory(newEvent.eventType);
                        setNewEvent({
                          ...newEvent,
                          eventType: type.value,
                          publicPathCategory:
                            !newEvent.publicPathCategory || newEvent.publicPathCategory === previousDefault
                              ? defaultEventPathCategory(type.value)
                              : newEvent.publicPathCategory,
                          backgroundImageUrl: '',
                          backgroundFocus: centerBackgroundFocus(),
                          backgroundZoom: 1,
                          colorPalette: '',
                        });
                      }}
                    />
                    <strong>{type.label}</strong>
                    <small>{type.description}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            {newEvent.eventType === 'custom' && (
              <label className="field-label mt-4">
                Name this type of gathering
                <input
                  value={newEvent.customEventType}
                  onChange={(event) => setNewEvent({ ...newEvent, customEventType: event.target.value })}
                  className="field-input"
                  placeholder="Book club, housewarming, watch party…"
                  maxLength={80}
                />
              </label>
            )}
            <section className="new-event-appearance">
              <BackgroundPositionPreview
                className="new-event-background-preview"
                theme={eventThemeStyle({ eventType: newEvent.eventType, colorPalette: newEvent.colorPalette || undefined })}
                imageUrl={newEvent.backgroundImageUrl || EVENT_BACKGROUNDS[newEvent.eventType]}
                focus={newEvent.backgroundFocus}
                zoom={newEvent.backgroundZoom}
                onOpen={newEvent.backgroundImageUrl ? () => setBackgroundEditor({
                  target: 'new',
                  imageUrl: newEvent.backgroundImageUrl,
                  focus: newEvent.backgroundFocus,
                  zoom: newEvent.backgroundZoom,
                }) : undefined}
                label={newEvent.customEventType || EVENT_TYPES.find((type) => type.value === newEvent.eventType)?.label || 'Gathering'}
                shadeOpacity={0.88}
              />
              <div>
                <strong>Event background</strong>
                <small>Use the curated image or upload your own. Custom framing opens in a dedicated editor.</small>
                <label className="secondary-button">
                  <ImagePlus size={15} /> Choose image
                  <input
                    type="file"
                    accept="image/*,.heic,.heif,image/heic,image/heif"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      void chooseNewEventBackground(file);
                    }}
                  />
                </label>
                {newEvent.backgroundImageUrl && <button type="button" onClick={() => setBackgroundEditor({ target: 'new', imageUrl: newEvent.backgroundImageUrl, focus: newEvent.backgroundFocus, zoom: newEvent.backgroundZoom })}><Move size={15} /> Adjust framing</button>}
                {newEvent.backgroundImageUrl && <button type="button" onClick={() => setNewEvent({ ...newEvent, backgroundImageUrl: '', backgroundFocus: centerBackgroundFocus(), backgroundZoom: 1 })}>Use curated image</button>}
              </div>
            </section>
            <EventBackgroundChoices
              selectedType={newEvent.eventType}
              usingCustomImage={Boolean(newEvent.backgroundImageUrl)}
              onSelect={(eventType) => {
                const previousDefault = defaultEventPathCategory(newEvent.eventType);
                setNewEvent({
                  ...newEvent,
                  eventType,
                  publicPathCategory:
                    !newEvent.publicPathCategory || newEvent.publicPathCategory === previousDefault
                      ? defaultEventPathCategory(eventType)
                      : newEvent.publicPathCategory,
                  customEventType: eventType === 'custom' ? newEvent.customEventType : '',
                  backgroundImageUrl: '',
                  backgroundFocus: centerBackgroundFocus(),
                  backgroundZoom: 1,
                  colorPalette: '',
                });
              }}
            />
            {newEvent.backgroundImageUrl && (
              <EventPalettePicker
                value={newEvent.colorPalette || DEFAULT_EVENT_PALETTE[newEvent.eventType]}
                onChange={(colorPalette) => setNewEvent({ ...newEvent, colorPalette })}
              />
            )}
            <div className="new-event-schedule-grid">
              <label className="field-label">
                Event date and time
                <input
                  type="datetime-local"
                  value={newEvent.date}
                  onChange={(e) => {
                    const previousDatePath = dateEventPathSegment(newEvent.date);
                    setNewEvent({
                      ...newEvent,
                      date: e.target.value,
                      publicPathEvent:
                        !newEvent.publicPathEvent || newEvent.publicPathEvent === previousDatePath
                          ? dateEventPathSegment(e.target.value)
                          : newEvent.publicPathEvent,
                    });
                  }}
                  className="field-input date-time-input"
                />
              </label>
              <label className="field-label compact-integer-field">
                Max friends per guest
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={newEvent.maxAdditionalGuests}
                  onChange={(event) =>
                    setNewEvent({
                      ...newEvent,
                      maxAdditionalGuests: Math.min(20, Math.max(0, Number(event.target.value) || 0)),
                    })
                  }
                  className="field-input"
                />
              </label>
            </div>
            <label className="field-label mt-5">
              Address
              <input
                value={newEvent.address}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, address: e.target.value })
                }
                className="field-input"
                placeholder="123 Main Street, Los Angeles, CA"
                autoComplete="street-address"
              />
            </label>
            <label className="invite-approval-option" aria-label="Require host approval for guests">
              <input
                type="checkbox"
                checked={newEvent.requireGuestApproval}
                onChange={(event) => setNewEvent({ ...newEvent, requireGuestApproval: event.target.checked })}
              />
              <span>
                <strong>Approve guests before revealing event details</strong>
                <small>Only Going responses wait for approval. Maybe and Not going are saved immediately.</small>
              </span>
            </label>
            <label className="field-label mt-5">
              Guest welcome message
              <textarea
                value={newEvent.welcome}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, welcome: e.target.value })
                }
                className="field-input min-h-32 resize-y"
                placeholder="Add a welcome message for your guests…"
              />
            </label>
            <button
              disabled={!newEvent.title.trim() || !newEvent.date.trim() || !newEvent.publicPathCategory || !newEvent.publicPathEvent || (newEvent.eventType === 'custom' && !newEvent.customEventType.trim())}
              onClick={() => void createEvent()}
              className="primary-button mt-7 w-full justify-center py-3.5 disabled:opacity-40"
            >
              <CalendarPlus size={17} /> Create event and build menu
            </button>
          </section>
        </div>
      )}
      {deletingEvent && (
        <div className="fixed inset-0 z-[75] grid place-items-center bg-black/50 p-5 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-3xl bg-[var(--cream)] p-8 text-center shadow-2xl">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-red-100 text-red-700">
              <Trash2 size={24} />
            </span>
            <h2 className="font-display mt-5 text-3xl font-semibold">
              Delete “{deletingEvent.title}”?
            </h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              The event, its orders, and uploaded item images will be
              permanently removed.
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button
                onClick={() => setDeletingEvent(null)}
                className="secondary-button"
              >
                Keep event
              </button>
              <button
                onClick={() => void deleteEvent(deletingEvent)}
                className="danger-button"
              >
                <Trash2 size={15} /> Delete event
              </button>
            </div>
          </section>
        </div>
      )}
      {showNotificationPrompt && !isNativeIOSApp && (
        <div className="fixed inset-0 z-[85] grid place-items-end bg-black/45 p-3 backdrop-blur-sm sm:place-items-center sm:p-5">
          <section className="notification-onboarding-card">
            <span className="notification-onboarding-icon"><BellRing size={25} /></span>
            <p className="eyebrow">Stay in the loop</p>
            <h2 className="font-display">Turn on Nights notifications</h2>
            <p>Get chat and event updates for all of your events. You can mute any single event without affecting the others.</p>
            <button type="button" className="primary-button" disabled={pushNotificationBusy} onClick={() => void enableDefaultNotifications()}>
              <Bell size={17} /> {pushNotificationBusy ? 'Turning on…' : 'Turn on notifications'}
            </button>
            <button type="button" className="notification-onboarding-later" onClick={() => {
              if (accountUser)
                localStorage.setItem(notificationPromptKey(accountUser.uid), 'dismissed');
              setShowNotificationPrompt(false);
            }}>Not now</button>
            <small>{typeof Notification !== 'undefined' && Notification.permission === 'granted'
              ? 'This updates your existing notification setup to cover every eligible event.'
              : 'Your phone requires this tap before Nights can show the system permission request.'}</small>
          </section>
        </div>
      )}
      {showInstallGuide && appEnvironmentReady && !isNativeIOSApp && (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-black/45 p-3 backdrop-blur-sm sm:place-items-center sm:p-5">
          <section className="install-guide">
            <div className="flex items-start justify-between gap-4">
              <span className="install-guide-icon">
                <Image src="/gathering/icons/nights-app-icon-180.png" alt="Nights app icon" width={54} height={54} />
              </span>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="icon-button"
                aria-label="Close installation instructions"
              >
                <XCircle size={18} />
              </button>
            </div>
            <p className="eyebrow mt-6">iPhone app</p>
            <h2 className="font-display mt-2 text-3xl font-semibold">
              {mode === 'host' ? 'Add Nights Host to your Home Screen' : 'Add Nights to your Home Screen'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              {mode === 'host'
                ? 'Open this host page in Safari, then follow these two steps.'
                : 'In Safari, follow these steps to install your guest home, where you can open and switch between all your events.'}
            </p>
            <ol className="install-steps">
              <li>
                <span>
                  <Share2 size={19} />
                </span>
                <div>
                  <strong>Tap Share</strong>
                  <small>Use the Share button in Safari’s toolbar.</small>
                </div>
              </li>
              <li>
                <span>
                  <SquarePlus size={19} />
                </span>
                <div>
                  <strong>Add to Home Screen</strong>
                  <small>Choose “Add to Home Screen,” then tap Add.</small>
                </div>
              </li>
            </ol>
            <p className="install-note">
              {mode === 'host'
                ? 'The Nights icon will reopen this event in the host view. '
                : 'The blue and green Nights icon will reopen your guest dashboard at gaemaj.tech/nights-guest/. '}
              If an older Nights shortcut is already installed, remove it first—iOS does not refresh an existing Home Screen icon.
            </p>
            <button
              onClick={() => setShowInstallGuide(false)}
              className="primary-button mt-6 w-full justify-center py-3.5"
            >
              Got it
            </button>
          </section>
        </div>
      )}
      {appEnvironmentReady && guestEventView && !profileEditorOpen && createPortal(
        <div className="guest-event-dock" style={eventThemeStyle(menu)}>
          <div className="guest-cart-bar">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em]">Your table</p>
                <p className="font-display text-lg font-semibold">
                  {!hasMenu ? 'No menu for this event'
                    : menu.requireGuestApproval && myRsvp?.status === 'yes' && !guestHasEventAccess
                      ? approvalStatus(myRsvp) === 'pending'
                        ? 'Waiting for host approval'
                        : 'This invitation was not approved'
                      : menu.accepting && myRsvp?.status === 'yes'
                        ? count
                          ? `${count} dish${count === 1 ? '' : 'es'} selected`
                          : 'Choose what calls to you'
                        : !menu.accepting ? 'Ordering is closed' : myRsvp ? 'RSVP Going to order' : 'RSVP to order'}
                </p>
              </div>
              <div className="guest-cart-actions">
                <button type="button" onClick={openRsvpPanel} className="guest-rsvp-button">
                  <ListChecks size={17} /> {rsvpButtonLabel}
                </button>
                <button
                  disabled={!hasMenu || !count || !menu.accepting || myRsvp?.status !== 'yes' || !guestHasEventAccess}
                  onClick={() => (document.getElementById('checkout') as HTMLDialogElement)?.showModal()}
                  className="primary-button min-w-48 justify-center disabled:opacity-40"
                >
                  <ShoppingBag size={17} /> Review order{' '}
                  {count > 0 && <span className="count-badge">{count}</span>}
                </button>
              </div>
            </div>
          </div>
          <nav className="guest-event-nav" aria-label="Event navigation">
            <button type="button" onClick={navigateBack} aria-label="Back">
              <ArrowLeft size={20} /><span>Back</span>
            </button>
            <button type="button" onClick={createNewEvent} disabled={!accountProfile || hostPreview} aria-label="Create new event">
              <CalendarPlus size={20} /><span>New event</span>
            </button>
            <button type="button" onClick={navigateHome} disabled={hostPreview} aria-label="Home">
              <House size={20} /><span>Home</span>
            </button>
            <button type="button" onClick={openEventChat} disabled={!chatActor} aria-label={`Open event chat${eventNotificationCounts[menu.id] ? `, ${eventNotificationCounts[menu.id]} unread` : ''}`}>
              <span className="event-nav-icon"><MessageCircle size={20} />
                {eventNotificationCounts[menu.id] > 0 && <b>{eventNotificationCounts[menu.id] > 9 ? '9+' : eventNotificationCounts[menu.id]}</b>}
              </span><span>Chat</span>
            </button>
            <div className="event-menu-control guest-event-options">
              <button
                type="button"
                className={eventMenuOpen ? 'event-menu-active' : ''}
                onClick={() => setEventMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={eventMenuOpen}
                aria-label={`Event options${activityUnreadCounts[menu.id] ? `, ${activityUnreadCounts[menu.id]} unread notification${activityUnreadCounts[menu.id] === 1 ? '' : 's'}` : ''}`}
              >
                <span className="event-nav-icon"><MenuIcon size={21} />
                  {activityUnreadCounts[menu.id] > 0 && <b>{activityUnreadCounts[menu.id] > 9 ? '9+' : activityUnreadCounts[menu.id]}</b>}
                </span><span>Options</span>
              </button>
              {eventMenuOpen && <div className="event-feature-menu" role="menu" aria-label={`${menu.title} features`}>
                <button type="button" role="menuitem" onClick={openActivityCenter}>
                  <span><Bell size={18} /></span>
                  <div><strong>Notification center</strong><small>Invitations, event changes and expenses</small></div>
                  {activityUnreadCounts[menu.id] > 0 && <b className="event-option-count">{activityUnreadCounts[menu.id] > 9 ? '9+' : activityUnreadCounts[menu.id]}</b>}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!expenseActor}
                  onClick={() => {
                    setExpensesOpen(true);
                    setEventMenuOpen(false);
                  }}
                  title={!expenseActor ? 'RSVP Going and receive approval to use expenses' : undefined}
                >
                  <span><DollarSign size={18} /></span>
                  <div><strong>Expenses</strong><small>{expenseActor ? 'Receipts, splits and guest balances' : 'Available to approved Going guests'}</small></div>
                </button>
                <button type="button" role="menuitem" onClick={() => {
                  setGamesOpen(true);
                  setEventMenuOpen(false);
                }}>
                  <span><Gamepad2 size={18} /></span>
                  <div><strong>Games</strong><small>Play event games or build a new one</small></div>
                </button>
              </div>}
            </div>
          </nav>
        </div>,
        document.body,
      )}
      {appEnvironmentReady && guestHomeView && accountProfile && !profileEditorOpen && createPortal(
        <nav className="guest-event-nav guest-home-dock" aria-label="Home actions">
          <button type="button" onClick={createNewEvent} aria-label="Create a new event">
            <CalendarPlus size={20} /><span>Create new event</span>
          </button>
        </nav>,
        document.body,
      )}
      {appEnvironmentReady && mode === 'host' && !profileEditorOpen && createPortal(
        <div className="host-event-dock">
          <nav className="guest-event-nav" aria-label="Host navigation">
            <button type="button" onClick={() => creatingEvent ? cancelCreatingEvent() : navigateBack()} aria-label="Back">
              <ArrowLeft size={20} /><span>Back</span>
            </button>
            <button
              type="button"
              disabled={creatingEvent || menu.id === EMPTY_EVENT_ID}
              onClick={openHostPreview}
              aria-label="Preview event"
            >
              <Eye size={20} /><span>Preview</span>
            </button>
            <button type="button" onClick={() => window.location.assign(guestHomeRoute())} aria-label="Home">
              <House size={20} /><span>Home</span>
            </button>
            <button type="button" onClick={openEventChat} disabled={creatingEvent || !chatActor} aria-label={`Open event chat${eventNotificationCounts[menu.id] ? `, ${eventNotificationCounts[menu.id]} unread` : ''}`}>
              <span className="event-nav-icon"><MessageCircle size={20} />
                {eventNotificationCounts[menu.id] > 0 && <b>{eventNotificationCounts[menu.id] > 9 ? '9+' : eventNotificationCounts[menu.id]}</b>}
              </span><span>Chat</span>
            </button>
            <div className="event-menu-control guest-event-options">
              <button
                type="button"
                className={eventMenuOpen ? 'event-menu-active' : ''}
                disabled={creatingEvent || menu.id === EMPTY_EVENT_ID}
                onClick={() => setEventMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={eventMenuOpen}
                aria-label={`Event options${activityUnreadCounts[menu.id] ? `, ${activityUnreadCounts[menu.id]} unread notification${activityUnreadCounts[menu.id] === 1 ? '' : 's'}` : ''}`}
              >
                <span className="event-nav-icon"><MenuIcon size={21} />
                  {activityUnreadCounts[menu.id] > 0 && <b>{activityUnreadCounts[menu.id] > 9 ? '9+' : activityUnreadCounts[menu.id]}</b>}
                </span><span>Options</span>
              </button>
              {eventMenuOpen && <div className="event-feature-menu" role="menu" aria-label={`${menu.title} features`}>
                <button type="button" role="menuitem" onClick={openActivityCenter}>
                  <span><Bell size={18} /></span>
                  <div><strong>Notification center</strong><small>Invitations, event changes and expenses</small></div>
                  {activityUnreadCounts[menu.id] > 0 && <b className="event-option-count">{activityUnreadCounts[menu.id] > 9 ? '9+' : activityUnreadCounts[menu.id]}</b>}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!expenseActor}
                  onClick={() => {
                    setExpensesOpen(true);
                    setEventMenuOpen(false);
                  }}
                >
                  <span><DollarSign size={18} /></span>
                  <div><strong>Expenses</strong><small>Receipts, splits and guest balances</small></div>
                </button>
                <button type="button" role="menuitem" onClick={() => {
                  setGamesOpen(true);
                  setEventMenuOpen(false);
                }}>
                  <span><Gamepad2 size={18} /></span>
                  <div><strong>Games</strong><small>Manage and play this event’s games</small></div>
                </button>
              </div>}
            </div>
          </nav>
        </div>,
        document.body,
      )}
      {mode === 'guest' && rsvpPanelOpen && (
        <div className="guest-rsvp-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeRsvpPanel();
        }}>
          <dialog open className="guest-rsvp-dialog" aria-label="Your RSVP">
            <button type="button" className="guest-rsvp-close" onClick={closeRsvpPanel} aria-label="Close RSVP">
              <XCircle size={22} />
            </button>
            {(!effectiveGuestProfile || editingGuestProfile) ? (
              <div className="guest-rsvp-panel guest-account-panel">
                <div className="guest-rsvp-heading">
                  <div><p className="eyebrow">Your details</p><h2 className="font-display">{changingGuestPhone ? 'Use another guest profile' : effectiveGuestProfile ? 'Edit your guest profile' : 'Tell us who you are'}</h2></div>
                </div>
                <p className="guest-rsvp-explainer">Your Nights account keeps your identity consistent across devices. Your display name can be different for this event.</p>
                <div className="guest-rsvp-form">
                  <label className="field-label">Display Name<input value={guestName} onChange={(event) => setGuestName(event.target.value)} className="field-input" placeholder="How guests will see you" autoComplete="name" /></label>
                  <label className="field-label">Phone number<input value={phoneNumber} className="field-input" inputMode="tel" autoComplete="tel" placeholder="555-555-5555" maxLength={12} readOnly /></label>
                  <div className="guest-profile-actions">
                    <button type="button" className="secondary-button" onClick={() => {
                      setGuestName(effectiveGuestProfile?.guestName || '');
                      setPhoneNumber(formatPhone(effectiveGuestProfile?.guestPhone || ''));
                      setGuestPin('');
                      setChangingGuestPhone(false);
                      if (effectiveGuestProfile) setEditingGuestProfile(false);
                      else closeRsvpPanel();
                    }}>Cancel</button>
                    <button type="button" onClick={() => void saveGuestProfile()} disabled={profileBusy || !guestName.trim() || !phoneNumber.trim() || !accountProfile} className="primary-button">{effectiveGuestProfile && !changingGuestPhone ? 'Save details' : 'Continue'}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="guest-rsvp-panel">
                <div className="guest-rsvp-heading">
                  <div>
                    <p className="eyebrow">Your response</p>
                    <div className="guest-rsvp-title-line">
                      <h2 className="font-display">RSVP for {menu.title}</h2>
                      {myRsvp && <span className={`rsvp-status ${menu.requireGuestApproval && myRsvp.status === 'yes' ? `approval-${approvalStatus(myRsvp)}` : `rsvp-${myRsvp.status}`}`}>{menu.requireGuestApproval && myRsvp.status === 'yes' && approvalStatus(myRsvp) !== 'approved' ? (approvalStatus(myRsvp) === 'pending' ? 'Pending approval' : 'Not approved') : myRsvp.status === 'yes' ? 'Going' : myRsvp.status === 'maybe' ? 'Maybe' : 'Not going'}</span>}
                    </div>
                  </div>
                </div>
                <div className="guest-profile-summary">
                  <div><strong>{effectiveGuestProfile.guestName}</strong><span>{formatPhone(effectiveGuestProfile.guestPhone)}</span></div>
                </div>
                <p className="guest-rsvp-explainer">{menu.requireGuestApproval ? 'Going responses need host approval. Maybe and Not going are saved immediately; only approved Going guests can chat or order.' : 'Choose Going to place orders. You can still update your RSVP when ordering is closed.'}</p>
                <div className="guest-rsvp-form rsvp-only-form">
                  <div className="rsvp-choices" role="radiogroup" aria-label="RSVP response">
                    {([['yes', 'Going'], ['maybe', 'Maybe'], ['no', 'Not going']] as const).map(([value, label]) => (
                      <label key={value} className={rsvpChoice === value ? 'selected' : ''}><input type="radio" name="rsvp-status" value={value} checked={rsvpChoice === value} onChange={() => setRsvpChoice(value)} disabled={menu.rsvpOpen === false} />{label}</label>
                    ))}
                  </div>
                  {rsvpChoice !== 'no' && (
                    <section className="rsvp-companions" aria-label="Additional guests">
                      {(menu.maxAdditionalGuests || 0) > 0 ? (
                        <>
                          <label className="field-label">
                            Friends you’re bringing
                            <select
                              className="field-input"
                              value={rsvpCompanionNames.length}
                              disabled={menu.rsvpOpen === false}
                              onChange={(event) => {
                                const count = Number(event.target.value);
                                setRsvpCompanionNames((current) =>
                                  Array.from({ length: count }, (_, index) => current[index] || ''),
                                );
                                setRsvpCompanionPhones((current) =>
                                  Array.from({ length: count }, (_, index) => current[index] || ''),
                                );
                              }}
                            >
                              {Array.from({ length: (menu.maxAdditionalGuests || 0) + 1 }, (_, count) => (
                                <option key={count} value={count}>
                                  {count === 0 ? 'Just me' : `${count} friend${count === 1 ? '' : 's'}`}
                                </option>
                              ))}
                            </select>
                          </label>
                          {rsvpCompanionNames.map((name, index) => (
                            <div className="rsvp-companion-row" key={index}>
                              <label className="field-label">
                                Friend {index + 1} name
                                <input
                                  className="field-input"
                                  value={name}
                                  disabled={menu.rsvpOpen === false}
                                  maxLength={80}
                                  placeholder="Full name"
                                  autoComplete="off"
                                  onChange={(event) =>
                                    setRsvpCompanionNames((current) =>
                                      current.map((entry, nameIndex) =>
                                        nameIndex === index ? event.target.value : entry,
                                      ),
                                    )
                                  }
                                />
                              </label>
                              <label className="field-label">
                                Phone <em>(optional)</em>
                                <input
                                  className="field-input"
                                  value={rsvpCompanionPhones[index] || ''}
                                  disabled={menu.rsvpOpen === false}
                                  maxLength={12}
                                  placeholder="555-555-5555"
                                  inputMode="tel"
                                  autoComplete="off"
                                  onChange={(event) =>
                                    setRsvpCompanionPhones((current) =>
                                      current.map((entry, phoneIndex) =>
                                        phoneIndex === index
                                          ? formatPhoneInput(event.target.value)
                                          : entry,
                                      ),
                                    )
                                  }
                                />
                              </label>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p>This invitation is for you only.</p>
                      )}
                    </section>
                  )}
                  <button type="button" onClick={() => void saveRsvp()} disabled={rsvpBusy || menu.rsvpOpen === false} className="primary-button">{menu.rsvpOpen === false ? 'RSVPs closed' : myRsvp ? 'Update RSVP' : 'Save RSVP'}</button>
                </div>
                {menu.rsvpOpen === false && <p className="rsvp-closed-note">The host has locked RSVPs. Your saved response remains unchanged.</p>}
                {menu.requireGuestApproval && myRsvp?.status === 'yes' && approvalStatus(myRsvp) === 'pending' && <p className="rsvp-approval-note pending">Your Going response is with the host. The event name, time, and location remain visible while you wait.</p>}
                {menu.requireGuestApproval && myRsvp?.status === 'yes' && approvalStatus(myRsvp) === 'declined' && <p className="rsvp-approval-note declined">The host has not approved this Going response. You can choose Maybe or Not going without approval.</p>}
                {myRsvp?.activeOrderCount ? <p className="rsvp-order-lock">Your RSVP is locked while {myRsvp.activeOrderCount} active order{myRsvp.activeOrderCount === 1 ? '' : 's'} is being handled.</p> : null}
              </div>
            )}
          </dialog>
        </div>
      )}
      <dialog id="checkout" className="checkout-dialog">
        <form method="dialog" className="p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="eyebrow">
                {editingOrderId ? 'Make a change' : 'Almost there'}
              </p>
              <h2 className="font-display mt-1 text-3xl font-semibold">
                {editingOrderId ? 'Edit your order' : 'Review your order'}
              </h2>
            </div>
            <button className="icon-button" aria-label="Close">
              <ArrowLeft size={18} />
            </button>
          </div>
          <p className="text-sm text-black/60">Ordering as <strong className="text-black">{myRsvp?.guestName || guestName}</strong></p>
          <label className="field-label mt-5">
            Anything we should know?{' '}
            <span className="font-normal text-black/35">Optional</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field-input min-h-24 resize-none"
              placeholder="Allergies, preferences, or a note for the host"
            />
          </label>
          <div className="mt-6 rounded-2xl bg-black/[.035] p-4 text-sm">
            {menu.items
              .filter((i) => editingOrderId || cart[i.id])
              .map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span>{i.name}</span>
                  <div className="qty shrink-0">
                    <button
                      type="button"
                      disabled={!cart[i.id]}
                      onClick={() => setQty(i.id, -1)}
                      aria-label={`Remove ${i.name} from order`}
                    >
                      <Minus size={13} />
                    </button>
                    <strong>{cart[i.id] || 0}</strong>
                    <button
                      type="button"
                      onClick={() => setQty(i.id, 1)}
                      aria-label={`Add another ${i.name} to order`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
          <button
            type="button"
            disabled={myRsvp?.status !== 'yes' || count === 0}
            onClick={() => void submitOrder()}
            className="primary-button mt-6 w-full justify-center py-3.5 disabled:opacity-40"
          >
            {editingOrderId ? 'Save changes' : 'Send my order'}{' '}
            <Check size={17} />
          </button>
        </form>
      </dialog>
      {submitted && (
        <div className="submission-flash fixed inset-0 z-50 grid place-items-center p-6">
          <div className="max-w-md text-center">
            <span>
              <Check size={38} />
            </span>
            <p className="eyebrow mt-8">
              {lastAction === 'updated' ? 'Order updated' : 'Order received'}
            </p>
            <h2 className="font-display mt-2">
              {lastAction === 'updated'
                ? 'Your changes are saved.'
                : `You’re all set, ${guestName}.`}
            </h2>
            <p>Your host has it. Returning you to the menu…</p>
            <i />
          </div>
        </div>
      )}
      {mode === 'guest' && rememberedOrders.length > 0 && !submitted && (
        <RememberedOrderCard
          orders={rememberedOrders}
          menu={menu}
          onEdit={beginOrderEdit}
          onCancel={(order) => {
            setRememberedOrder(order);
            setConfirmingCancel(true);
          }}
        />
      )}
      {confirmingCancel && rememberedOrder && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-5 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-3xl bg-[var(--cream)] p-7 text-center shadow-2xl">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-red-100 text-red-700">
              <XCircle size={26} />
            </span>
            <h2 className="font-display mt-5 text-3xl font-semibold">
              Cancel your order?
            </h2>
            <p className="mt-2 text-sm leading-6 text-black/55">
              Your host will see that it was cancelled. This can’t be undone
              from the guest page.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setConfirmingCancel(false)}
                className="secondary-button"
              >
                Keep order
              </button>
              <button
                onClick={() => void cancelRememberedOrder()}
                className="danger-button"
              >
                Yes, cancel
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <output className="toast">
          <Check size={15} />
          {toast}
        </output>
      )}
    </main>
  );
}

type AccountAuthCardProps = {
  context: 'guest' | 'host';
  authReady: boolean;
  user: AccountUser | null;
  profile: AccountProfile | null;
  authMode: AccountAuthMode;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  recoverySentTo: string;
  busy: boolean;
  setAuthMode: (mode: AccountAuthMode) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setFirstName: (value: string) => void;
  setLastName: (value: string) => void;
  setPhone: (value: string) => void;
  signInEmail: () => void;
  signUpEmail: () => void;
  signInGoogle: () => void;
  signInApple: () => void;
  resetPassword: () => void;
  resendVerification: () => void;
  checkVerification: () => void;
  changeEmail: (email: string) => void;
  signOut: () => void;
  completeProfile: () => void;
};

function AccountAuthCard(props: AccountAuthCardProps) {
  const [changingEmail, setChangingEmail] = useState(false);
  const [replacementEmail, setReplacementEmail] = useState('');
  const verificationRequired = accountNeedsEmailVerification(props.user);
  const profileRequired = Boolean(props.user && !props.profile);
  const mode = profileRequired ? 'profile' : props.authMode;
  if (!props.authReady) {
    return (
      <section className="account-auth-card account-auth-loading" aria-live="polite">
        <span className="account-auth-logo"><Image src="/gathering/icons/nights-app-icon-180.png" alt="" width={58} height={58} /></span>
        <h2 className="font-display">Opening Nights…</h2>
      </section>
    );
  }
  if (verificationRequired) {
    return (
      <section className="account-auth-card account-verification-card" aria-live="polite">
        <div className="account-verification-icon"><Send size={25} /></div>
        <p className="eyebrow">One last step</p>
        <h2 className="font-display">Verify your email</h2>
        <p>We sent a verification link to <strong>{props.user?.email}</strong>. Open it, then return here and confirm.</p>
        <button type="button" className="primary-button account-auth-submit" disabled={props.busy} onClick={props.checkVerification}>{props.busy ? 'Checking…' : 'I verified my email'}</button>
        {changingEmail && (
          <div className="account-change-email">
            <label className="field-label">New email address
              <input
                type="email"
                value={replacementEmail}
                onChange={(event) => setReplacementEmail(event.target.value)}
                className="field-input"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && replacementEmail.trim()) props.changeEmail(replacementEmail);
                  if (event.key === 'Escape') { setChangingEmail(false); setReplacementEmail(''); }
                }}
              />
            </label>
            <div className="account-change-email-actions">
              <button type="button" disabled={props.busy} onClick={() => { setChangingEmail(false); setReplacementEmail(''); }}>Cancel</button>
              <button type="button" className="primary-button" disabled={props.busy || !replacementEmail.trim()} onClick={() => props.changeEmail(replacementEmail)}>
                {props.busy ? 'Sending…' : 'Verify new email'}
              </button>
            </div>
          </div>
        )}
        <div className="account-auth-links">
          <button type="button" disabled={props.busy} onClick={props.resendVerification}>Resend email</button>
          <button type="button" disabled={props.busy} onClick={() => { setChangingEmail(true); setReplacementEmail(''); }}>Use a different email</button>
          <button type="button" disabled={props.busy} onClick={props.signOut}>Use another account</button>
        </div>
        <small className="account-verification-help">Check spam or junk if it does not arrive. Verification links can only be used once. Unverified accounts are automatically removed after 90 days.</small>
      </section>
    );
  }
  return (
    <section className="account-auth-card">
      <div className="account-auth-heading">
        <span className="account-auth-logo"><Image src="/gathering/icons/nights-app-icon-180.png" alt="" width={58} height={58} /></span>
        <p className="eyebrow">{props.context === 'host' ? 'Nights Host' : 'Your nights, in one place'}</p>
        <h2 className="font-display">
          {mode === 'signup' ? 'Create your account' : mode === 'profile' ? 'Complete your profile' : mode === 'recovery' ? 'Recover your account' : 'Welcome back'}
        </h2>
        <p>
          {mode === 'signup'
            ? 'One account keeps your invitations, RSVPs, orders, and chats together.'
            : mode === 'profile'
              ? 'Add the details other guests and hosts will recognize.'
              : mode === 'recovery'
                ? 'Enter your account email and we’ll send a secure password-reset link.'
              : props.context === 'host'
                ? 'Sign in to create and manage your own events.'
                : 'Sign in to see every event you are invited to.'}
        </p>
      </div>
      {mode !== 'profile' && mode !== 'recovery' && (
        <>
          <div className="account-provider-buttons">
            <button type="button" onClick={props.signInGoogle} disabled={props.busy} className="account-provider-button"><b>G</b> Continue with Google</button>
            <button type="button" onClick={props.signInApple} disabled={props.busy} className="account-provider-button account-provider-apple"><b>●</b> Continue with Apple</button>
          </div>
          <div className="account-auth-divider"><span>or use email</span></div>
        </>
      )}
      <div className="account-auth-fields">
        {mode !== 'signin' && mode !== 'recovery' && (
          <div className="account-name-row">
            <label className="field-label">First name<input value={props.firstName} onChange={(event) => props.setFirstName(event.target.value)} className="field-input" autoComplete="name" /></label>
            <label className="field-label">Last name<input value={props.lastName} onChange={(event) => props.setLastName(event.target.value)} className="field-input" autoComplete="name" /></label>
          </div>
        )}
        {mode !== 'profile' && <label className="field-label">Email<input type="email" value={props.email} onChange={(event) => props.setEmail(event.target.value)} className="field-input" autoComplete="email" inputMode="email" placeholder="you@example.com" /></label>}
        {mode !== 'profile' && mode !== 'recovery' && <label className="field-label">Password<input type="password" value={props.password} onChange={(event) => props.setPassword(event.target.value)} className="field-input" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} onKeyDown={(event) => { if (event.key === 'Enter') (mode === 'signup' ? props.signUpEmail : props.signInEmail)(); }} /></label>}
        {mode !== 'signin' && mode !== 'recovery' && <label className="field-label">Phone number<input value={props.phone} onChange={(event) => props.setPhone(event.target.value)} className="field-input" autoComplete="tel" inputMode="tel" placeholder="555-555-5555" maxLength={12} /></label>}
      </div>
      {mode === 'signin' ? (
        <>
          <button type="button" className="primary-button account-auth-submit" disabled={props.busy || !props.email || !props.password} onClick={props.signInEmail}>{props.busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="account-auth-links"><button type="button" onClick={() => props.setAuthMode('recovery')}>Forgot password?</button><button type="button" onClick={() => props.setAuthMode('signup')}>Create account</button></div>
        </>
      ) : mode === 'signup' ? (
        <>
          <button type="button" className="primary-button account-auth-submit" disabled={props.busy || !props.email || props.password.length < 8 || !props.firstName || !props.lastName || !props.phone} onClick={props.signUpEmail}>{props.busy ? 'Creating account…' : 'Create account'}</button>
          <div className="account-auth-links"><span>Already have an account?</span><button type="button" onClick={() => props.setAuthMode('signin')}>Sign in</button></div>
        </>
      ) : mode === 'recovery' ? (
        <div className="account-recovery-actions">
          {props.recoverySentTo && <div className="account-recovery-sent"><Check size={17} /><span><strong>Check your inbox</strong><small>If a password account exists for {props.recoverySentTo}, the email contains the reset link.</small></span></div>}
          <button type="button" className="primary-button account-auth-submit" disabled={props.busy || !props.email} onClick={props.resetPassword}>{props.busy ? 'Sending…' : props.recoverySentTo ? 'Send another link' : 'Send recovery link'}</button>
          <div className="account-auth-links"><button type="button" onClick={() => props.setAuthMode('signin')}>Back to sign in</button></div>
        </div>
      ) : (
        <button type="button" className="primary-button account-auth-submit" disabled={props.busy || !props.firstName || !props.lastName || !props.phone} onClick={props.completeProfile}>{props.busy ? 'Saving profile…' : 'Continue to Nights'}</button>
      )}
      <small className="account-auth-terms">By continuing, you agree to use Nights responsibly. Subscription features will be clearly identified before they are introduced.</small>
    </section>
  );
}

function GuestAccessPortal({
  authReady,
  user,
  profile,
  authMode,
  email,
  password,
  firstName,
  lastName,
  phone,
  recoverySentTo,
  events,
  chatUnreadCounts,
  activityUnreadCounts,
  pendingEvent,
  busy,
  setAuthMode,
  setEmail,
  setPassword,
  setFirstName,
  setLastName,
  setPhone,
  signInEmail,
  signUpEmail,
  signInGoogle,
  signInApple,
  resetPassword,
  resendVerification,
  checkVerification,
  changeEmail,
  signOut,
  completeProfile,
  selectEvent,
}: Omit<AccountAuthCardProps, 'context'> & {
  events: GuestEventAccess[];
  chatUnreadCounts: Record<string, number>;
  activityUnreadCounts: Record<string, number>;
  pendingEvent: PendingGuestEvent | null;
  selectEvent: (event: GuestEventAccess) => void;
}) {
  const [dateOrder, setDateOrder] = useState<'asc' | 'desc'>('asc');
  const [dateScope, setDateScope] = useState<'all' | 'upcoming' | 'past'>('all');
  const [ownershipScope, setOwnershipScope] = useState<'all' | 'hosting' | 'invited'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterReferenceTime] = useState(() => Date.now());
  const activeFilterCount = (dateOrder === 'desc' ? 1 : 0) + (dateScope === 'all' ? 0 : 1) + (ownershipScope === 'all' ? 0 : 1);
  useEffect(() => {
    if (!filtersOpen) return;
    const appScroller = document.querySelector<HTMLElement>('.app-root.native-ios-app');
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousAppOverflow = appScroller?.style.overflow || '';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (appScroller) appScroller.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      if (appScroller) appScroller.style.overflow = previousAppOverflow;
    };
  }, [filtersOpen]);
  const visibleEvents = useMemo(() => {
    const eventTime = (access: GuestEventAccess) => {
      const parsed = Date.parse(access.event.startsAt || access.event.date || '');
      return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
    };
    return events
      .filter((access) => dateScope === 'all'
        || (dateScope === 'past' ? eventTime(access) < filterReferenceTime : eventTime(access) >= filterReferenceTime))
      .filter((access) => ownershipScope === 'all'
        || (ownershipScope === 'hosting' ? Boolean(access.hosted) : !access.hosted))
      .sort((a, b) => (eventTime(a) - eventTime(b)) * (dateOrder === 'asc' ? 1 : -1));
  }, [dateOrder, dateScope, events, filterReferenceTime, ownershipScope]);
  return (
    <section className="guest-access-portal">
      <div className="guest-access-intro">
        <span className="guest-access-mark"><Image src="/gathering/icons/nights-app-icon-180.png" alt="" width={62} height={62} /></span>
        <p className="eyebrow">Your nights, in one place</p>
        <h1 className="font-display">Your events</h1>
        <p>Use one secure account for every event you host, invitation, RSVP, order, and event chat.</p>
      </div>
      {!profile || accountNeedsEmailVerification(user) ? (
        <div className="guest-access-auth-shell">
          {pendingEvent && <div className="guest-invitation-cached"><Check size={17} /><span><strong>Invitation saved</strong><small>Sign in and this event will be added to your event list.</small></span></div>}
          <AccountAuthCard context="guest" authReady={authReady} user={user} profile={profile} authMode={authMode} email={email} password={password} firstName={firstName} lastName={lastName} phone={phone} recoverySentTo={recoverySentTo} busy={busy} setAuthMode={setAuthMode} setEmail={setEmail} setPassword={setPassword} setFirstName={setFirstName} setLastName={setLastName} setPhone={setPhone} signInEmail={signInEmail} signUpEmail={signUpEmail} signInGoogle={signInGoogle} signInApple={signInApple} resetPassword={resetPassword} resendVerification={resendVerification} checkVerification={checkVerification} changeEmail={changeEmail} signOut={signOut} completeProfile={completeProfile} />
        </div>
      ) : (
        <div className="guest-access-events">
          <div className="guest-access-signed-in">
            <span>Welcome, <strong>{accountDisplayName(profile)}</strong></span>
            <div className="guest-filter-control">
              <button type="button" className={`guest-filter-button ${activeFilterCount ? 'active' : ''}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="guest-event-filter-popover">
                <SlidersHorizontal size={16} /><span>Filter</span>{activeFilterCount > 0 && <b>{activeFilterCount}</b>}
              </button>
              {filtersOpen && createPortal(
                <div className="guest-filter-overlay" role="presentation" onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setFiltersOpen(false);
                }}>
                <section id="guest-event-filter-popover" className="guest-event-filter-popover" role="dialog" aria-modal="true" aria-label="Filter and sort events">
                  <header><div><strong>Filter events</strong><small>Choose what appears on your home screen.</small></div><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close event filters"><XCircle size={18} /></button></header>
                  <div className="guest-event-filters">
                    <label><span>Sort by date</span><select value={dateOrder} onChange={(event) => setDateOrder(event.target.value as 'asc' | 'desc')}><option value="asc">Soonest first</option><option value="desc">Latest first</option></select></label>
                    <label><span>When</span><select value={dateScope} onChange={(event) => setDateScope(event.target.value as 'all' | 'upcoming' | 'past')}><option value="all">All dates</option><option value="upcoming">Upcoming only</option><option value="past">Past only</option></select></label>
                    <label><span>Relationship</span><select value={ownershipScope} onChange={(event) => setOwnershipScope(event.target.value as 'all' | 'hosting' | 'invited')}><option value="all">All events</option><option value="hosting">Events I host</option><option value="invited">Events I’m invited to</option></select></label>
                  </div>
                  <footer><button type="button" onClick={() => { setDateOrder('asc'); setDateScope('all'); setOwnershipScope('all'); }}>Reset</button><button type="button" className="primary-button" onClick={() => setFiltersOpen(false)}>Show events</button></footer>
                </section>
                </div>,
                document.body,
              )}
            </div>
          </div>
          {events.length ? (
            <div className="guest-event-card-grid">
              {visibleEvents.map((access) => (
                <GuestEventCard
                  key={access.event.id}
                  access={access}
                  chatUnreadCount={chatUnreadCounts[access.event.id] || 0}
                  activityUnreadCount={activityUnreadCounts[access.event.id] || 0}
                  hosted={Boolean(access.hosted || accountCanManageEvent(access.event, user?.uid, user?.email))}
                  invited={Boolean(access.invitation || (pendingEvent && guestEventMatchesPending(access, pendingEvent)))}
                  onSelect={() => selectEvent(access)}
                />
              ))}
              {!visibleEvents.length && <p className="guest-access-loading">No events match these filters.</p>}
            </div>
          ) : <p className="guest-access-loading">{busy ? 'Loading your events…' : 'No invitations or RSVPs were found for this guest profile.'}</p>}
          {busy && events.length > 0 && <p className="guest-access-refreshing">Refreshing your events…</p>}
        </div>
      )}
    </section>
  );
}

function GuestEventCard({
  access,
  current = false,
  invited = false,
  hosted = false,
  chatUnreadCount = 0,
  activityUnreadCount = 0,
  onSelect,
}: {
  access: GuestEventAccess;
  current?: boolean;
  invited?: boolean;
  hosted?: boolean;
  chatUnreadCount?: number;
  activityUnreadCount?: number;
  onSelect: () => void;
}) {
  const response = hosted
    ? 'Open host view'
    : access.rsvp
    ? access.rsvp.status === 'yes' ? 'Going' : access.rsvp.status === 'maybe' ? 'Maybe' : 'Not going'
    : invited ? 'New invitation' : 'Invited · RSVP not sent';
  const newInvitation = invited && !access.rsvp && !hosted;
  const hasUnread = chatUnreadCount > 0 || activityUnreadCount > 0;
  return (
    <button type="button" className={`guest-event-card ${current ? 'current' : ''} ${hosted ? 'hosted' : ''} ${newInvitation ? 'new-invitation' : ''} ${hasUnread ? 'has-notifications' : ''}`} onClick={onSelect}>
      <span className="guest-event-card-art" style={{ backgroundImage: `linear-gradient(145deg, rgb(32 157 139 / 0.82), rgb(31 88 163 / 0.82)), url(${eventBackground(access.event)})` }} />
      {newInvitation && <span className="guest-event-new-badge">New</span>}
      {hasUnread && <span className="guest-event-unread-badges">
        {chatUnreadCount > 0 && <span aria-label={`${chatUnreadCount} unread chat message${chatUnreadCount === 1 ? '' : 's'}`}><MessageCircle size={13} /><b>{chatUnreadCount > 9 ? '9+' : chatUnreadCount}</b></span>}
        {activityUnreadCount > 0 && <span aria-label={`${activityUnreadCount} unread event notification${activityUnreadCount === 1 ? '' : 's'}`}><Bell size={13} /><b>{activityUnreadCount > 9 ? '9+' : activityUnreadCount}</b></span>}
      </span>}
      <span className="guest-event-card-copy">
        <small>{eventTypeLabel(access.event)}{current ? ' · Current event' : ''}</small>
        {hosted && <em className="guest-event-hosting-mark font-display">Your event</em>}
        <strong className="font-display">{access.event.title}</strong>
        <span><Clock3 size={13} /> {access.event.date}</span>
        {access.event.address && <span><MapPin size={13} /> {access.event.address}</span>}
      </span>
      <span className="guest-event-card-status">{response}<ChevronRight size={16} /></span>
    </button>
  );
}

function GuestEventPicker({
  events,
  currentEventId,
  guestName,
  busy,
  onSelect,
  onClose,
  onUseAnotherGuest,
}: {
  events: GuestEventAccess[];
  currentEventId: string;
  guestName: string;
  busy: boolean;
  onSelect: (event: GuestEventAccess) => void;
  onClose: () => void;
  onUseAnotherGuest: () => void;
}) {
  return (
    <div className="guest-event-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <dialog open className="guest-event-picker" aria-label="Choose an event">
        <header>
          <div><p className="eyebrow">{guestName}&apos;s events</p><h2 className="font-display">Switch event</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close event picker"><XCircle size={20} /></button>
        </header>
        {busy ? <p className="guest-access-loading">Refreshing your invitations…</p> : events.length ? (
          <div className="guest-event-picker-list">
            {events.map((access) => (
              <GuestEventCard key={access.event.id} access={access} hosted={Boolean(access.hosted)} current={access.event.id === currentEventId} invited={Boolean(access.invitation)} onSelect={() => onSelect(access)} />
            ))}
          </div>
        ) : <p className="guest-access-loading">No invitations or RSVPs were found.</p>}
        <footer><button type="button" onClick={onUseAnotherGuest}>Sign out of Nights</button></footer>
      </dialog>
    </div>
  );
}

function GuestMenu({
  menu,
  categories,
  cart,
  reserved,
  canOrder,
  accessGranted,
  rsvpStatus,
  rsvpApprovalStatus,
  setQty,
  rsvpButtonLabel,
  onOpenRsvp,
}: {
  menu: EventMenu;
  categories: string[];
  cart: Record<string, number>;
  reserved: Order[];
  canOrder: boolean;
  accessGranted: boolean;
  rsvpStatus: Rsvp['status'] | null;
  rsvpApprovalStatus: Rsvp['approvalStatus'] | null;
  setQty: (id: string, delta: number) => void;
  rsvpButtonLabel: string;
  onOpenRsvp: () => void;
}) {
  const hasMenu = menuHasPublishedItems(menu);
  const eventActionOpen = hasMenu ? menu.accepting : menu.rsvpOpen !== false;
  const backgroundFocus = eventBackgroundFocus(menu);
  const mobileBackgroundFocus = menu.backgroundImageUrl
    ? backgroundFocus
    : EVENT_MOBILE_BACKGROUND_FOCUS[menu.eventType || 'meal'];
  const mobileBackground = menu.backgroundImageUrl
    ? eventBackground(menu)
    : EVENT_MOBILE_BACKGROUNDS[menu.eventType || 'meal'];
  const backgroundZoom = eventBackgroundZoom(menu);
  return (
    <div className={`guest-experience has-event-dock ${hasMenu ? 'has-menu' : 'invitation-only'}`}>
      <section className="guest-hero">
        <div
          className={`guest-hero-photo ${menu.backgroundImageUrl ? 'custom-background' : 'curated-background'}`}
          style={{
            backgroundImage: `url(${eventBackground(menu)})`,
            backgroundPosition: `${backgroundFocus.x}% ${backgroundFocus.y}%`,
            '--mobile-background-image': `url(${mobileBackground})`,
            '--mobile-background-position': `${mobileBackgroundFocus.x}% ${mobileBackgroundFocus.y}%`,
            '--background-zoom': backgroundZoom,
            '--background-backdrop-zoom': backgroundZoom * 1.12,
            '--background-zoom-start': backgroundZoom * 1.015,
            '--background-zoom-end': backgroundZoom * 1.045,
            '--background-origin-x': `${backgroundFocus.x}%`,
            '--background-origin-y': `${backgroundFocus.y}%`,
          } as CSSProperties}
        />
        <div className="guest-hero-shade" />
        <div className="guest-hero-content">
          <div className="guest-invite-mark">
            <span>{eventTypeLabel(menu)}</span>
            <i />
          </div>
          <p className="guest-kicker">You’re invited</p>
          <h1 className="font-display">{menu.title}</h1>
          {accessGranted && <p className="guest-welcome">{menu.welcome}</p>}
          <div className="guest-event-meta">
            <div className="guest-event-detail">
              <span>When</span>
              <strong>{menu.date}</strong>
            </div>
            {menu.address && (
              <div className="guest-event-detail">
                <span>Where</span>
                <strong>{menu.address}</strong>
              </div>
            )}
            <div
              className={`guest-order-state ${eventActionOpen ? 'open' : 'closed'}`}
            >
              <i />
              {!accessGranted
                ? rsvpApprovalStatus === 'declined' ? 'Access not approved' : 'Host approval required'
                : !hasMenu
                  ? menu.rsvpOpen === false ? 'RSVPs are closed' : 'RSVPs are open'
                  : menu.accepting ? 'Orders are open' : 'Ordering has closed'}
            </div>
            {!hasMenu && (
              <button type="button" onClick={onOpenRsvp} className="guest-rsvp-button guest-hero-rsvp">
                <ListChecks size={17} /> {rsvpButtonLabel}
              </button>
            )}
          </div>
        </div>
        {hasMenu && accessGranted && (
          <div className="guest-scroll-cue">
            <span>Explore the menu</span>
            <i />
          </div>
        )}
      </section>
      {hasMenu && (
      <section className="guest-menu-shell">
        {!accessGranted ? (
          <div className="guest-access-gate">
            <span><LockKeyhole size={24} /></span>
            <p className="eyebrow">Private event</p>
            <h2 className="font-display">
              {rsvpApprovalStatus === 'pending'
                ? 'Your request is with the host.'
                : rsvpApprovalStatus === 'declined'
                  ? 'This invitation was not approved.'
                  : 'RSVP to request access.'}
            </h2>
            <p>
              {rsvpApprovalStatus === 'pending'
                ? 'You’ll see the welcome message, event menu, ordering, and chat here as soon as the host approves you.'
                : rsvpApprovalStatus === 'declined'
                  ? 'The event name, time, and location remain available above. Contact the host if you believe this was a mistake.'
                  : 'Share your name, phone number, RSVP, and temporary PIN. The host will review the request before revealing the rest of the event.'}
            </p>
          </div>
        ) : (
          <>
        <header className="guest-menu-intro">
          <div>
            <p className="eyebrow">Tonight’s table</p>
            <h2 className="font-display">
              Choose your
              <br />
              <em>perfect plate.</em>
            </h2>
          </div>
          <p>
            Each dish moves independently from kitchen to table, so you can
            enjoy it the moment it is ready.
          </p>
        </header>
        {!menu.accepting && (
          <div className="ordering-closed-banner">
            <XCircle size={20} />
            <div>
              <strong>This table is no longer taking orders.</strong>
              <span>
                You can still browse the menu, but new selections are paused by
                the host.
              </span>
            </div>
          </div>
        )}
        {menu.accepting && rsvpStatus !== 'yes' && (
          <div className="ordering-closed-banner rsvp-required-banner">
            <XCircle size={20} />
            <div>
              <strong>{rsvpStatus ? `Your RSVP is ${rsvpStatus === 'maybe' ? 'Maybe' : 'Not going'}.` : 'RSVP when you’re ready to order.'}</strong>
              <span>Menu browsing is available, but ordering requires a Going RSVP.</span>
            </div>
          </div>
        )}
        {menu.items.length === 0 && (
          <div className="guest-empty">
            <UtensilsCrossed />
            <h2 className="font-display">The menu is coming soon</h2>
            <p>The host is putting the finishing touches on the table.</p>
          </div>
        )}
        {categories.map((category, categoryIndex) => (
          <section key={category} className="guest-course">
            <header>
              <span>{String(categoryIndex + 1).padStart(2, '0')}</span>
              <h2 className="font-display">{category}</h2>
              <i />
            </header>
            <div className="guest-dish-grid">
              {menu.items
                .filter((i) => i.category === category)
                .map((item, itemIndex) => (
                  (() => {
                    const unavailable = Boolean(item.soldOut);
                    const remaining = item.maxServings == null
                      ? undefined
                      : Math.max(0, item.maxServings - reservedServings(reserved, item.id));
                    const atGuestLimit = remaining != null && (cart[item.id] || 0) >= remaining;
                    return (
                  <article
                    key={item.id}
                    className={`menu-card ${item.imageUrl ? 'has-image' : ''} ${cart[item.id] ? 'selected' : ''} ${unavailable ? 'sold-out' : ''}`}
                  >
                    {item.imageUrl && (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={600}
                        height={600}
                        unoptimized
                        className="menu-item-image"
                      />
                    )}
                    <div className="menu-card-copy">
                      <span className="dish-number">
                        {String(itemIndex + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display">{item.name}</h3>
                          {item.featured && <Sparkles size={15} />}
                          {unavailable && <span className="sold-out-badge">Sold out</span>}
                          {!unavailable && remaining === 0 && <span className="sold-out-badge">Sold out</span>}
                        </div>
                        {itemDescription(item) && (
                          <p>{itemDescription(item)}</p>
                        )}
                        <div className="dish-tags">
                          {item.dietary && (
                            <span>
                              <Leaf size={11} />
                              {item.dietary}
                            </span>
                          )}
                          <span>
                            <Clock3 size={11} />
                            {itemPrepMinutes(item)} min
                          </span>
                          {remaining != null && !unavailable && (
                            <span className={remaining === 0 ? 'availability-empty' : ''}>
                              {remaining === 0 ? 'Sold out' : `${remaining} left`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="qty">
                      <button
                        onClick={() => setQty(item.id, -1)}
                        disabled={!cart[item.id] || !canOrder || unavailable}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Minus size={15} />
                      </button>
                      <span>{cart[item.id] || 0}</span>
                      <button
                        onClick={() => setQty(item.id, 1)}
                        disabled={!canOrder || unavailable || remaining === 0 || atGuestLimit}
                        aria-label={`Add ${item.name}`}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </article>
                    );
                  })()
                ))}
            </div>
          </section>
        ))}
          </>
        )}
      </section>
      )}
    </div>
  );
}

const gamePreviewKey = (eventId: string) => `nights-preview-games-v1:${eventId}`;
const newGameDraft = (accountUid = ''): EventGame => ({
  id: '',
  title: '',
  summary: '',
  status: 'draft',
  playerArrangement: '',
  interfaceDescription: '',
  rules: '',
  scoring: '',
  timing: '',
  hiddenInformation: '',
  winCondition: '',
  minPlayers: 2,
  maxPlayers: 12,
  runtime: null,
  createdBy: accountUid,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
});

const GAME_RUNTIME_FORBIDDEN_PATTERN = String.raw`\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|import|require|eval|Function|globalThis|self|postMessage|close|Worker|Blob|URL|WebAssembly|Atomics|SharedArrayBuffer|navigator|caches|indexedDB|document|window|parent|top|opener|localStorage|sessionStorage|constructor|__proto__|prototype|setTimeout|setInterval|queueMicrotask|crypto|performance|Date|Promise|async|await|while)\b`;
const GAME_WORKER_SOURCE = String.raw`
const game = /*__NIGHTS_GAME__*/ null;
self.onmessage = ({ data }) => {
  try {
    const ui = {
      screen: (children) => ({ type: 'screen', children }),
      heading: (text) => ({ type: 'heading', text }),
      text: (text) => ({ type: 'text', text }),
      card: (title, children) => ({ type: 'card', title, children }),
      button: (label, action, tone = 'primary') => ({ type: 'button', label, action, tone }),
      timer: (deadline, label = 'Time remaining') => ({ type: 'timer', deadline, label }),
      teams: (teams) => ({ type: 'teams', teams }),
      scoreboard: (scores) => ({ type: 'scoreboard', scores }),
      list: (items) => ({ type: 'list', items }),
      grid: (columns, children) => ({ type: 'grid', columns, children }),
      secret: (label, value) => ({ type: 'secret', label, value }),
      input: (label, key, placeholder = '') => ({ type: 'input', label, key, placeholder }),
    };
    const players = Array.isArray(data.players) ? data.players : [];
    const viewer = data.viewer && typeof data.viewer === 'object' ? data.viewer : players[0] || { id: 'preview-player', name: 'You' };
    const context = Object.freeze({
      players: Object.freeze({ list: () => structuredClone(players) }),
      host: Object.freeze({ id: data.hostId || players[0]?.id || viewer.id }),
      teams: Object.freeze({
        randomize: (count, playerIds) => {
          const size = Math.max(1, Math.min(8, Math.floor(Number(count) || 2)));
          const allowed = Array.isArray(playerIds) ? new Set(playerIds.map(String)) : null;
          const shuffled = players.filter(player => !allowed || allowed.has(String(player.id))).sort(() => Math.random() - 0.5);
          return Array.from({ length: size }, (_, index) => ({
            id: 'team-' + (index + 1),
            name: 'Team ' + (index + 1),
            players: shuffled.filter((_, playerIndex) => playerIndex % size === index),
          }));
        },
      }),
      random: Object.freeze({
        pick: (items) => items[Math.floor(Math.random() * items.length)],
        shuffle: (items) => [...items].sort(() => Math.random() - 0.5),
      }),
      clock: Object.freeze({ now: () => Date.now() }),
    });
    if (!game || typeof game.setup !== 'function' || typeof game.onAction !== 'function' || typeof game.view !== 'function')
      throw new Error('The generated game does not implement the Nights game contract.');
    let state = data.task === 'setup'
      ? game.setup(context)
      : data.task === 'render'
        ? structuredClone(data.state)
        : game.onAction(structuredClone(data.state), structuredClone(data.action), context);
    if (state === undefined) throw new Error('The game returned no state.');
    const view = game.view(structuredClone(state), structuredClone(viewer), ui);
    self.postMessage({ ok: true, state, view });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Game runtime failed.' });
  }
};`;

const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
const gameSandboxDocument = (game: EventGame, participants: GameParticipant[], currentViewer: GameParticipant | null, hostId: string, canManage: boolean) => {
  const runtime = game.runtime || { instructions: '', logicSource: '', uiNotes: '' };
  const players = participants.length ? participants : [{ id: hostId || 'event-host', name: 'Host' }];
  const viewer = currentViewer && players.some((player) => player.id === currentViewer.id)
    ? currentViewer
    : players[0];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none';"><style>
  :root{color-scheme:dark;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b2425;color:#f7f2e8}*{box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}body{margin:0;background:radial-gradient(circle at 10% 0%,#1c5b54 0,transparent 38%),linear-gradient(155deg,#102d2e,#071718);padding:20px}.shell{width:min(720px,100%);height:100%;margin:auto;overflow:hidden}.brand{margin:0 0 16px;color:#9ce6cf;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}.screen{display:grid;gap:14px}.heading{font-family:Georgia,serif;font-size:clamp(28px,7vw,52px);line-height:.95}.text{color:#c5d4cd;line-height:1.55}.card{display:grid;gap:12px;border:1px solid #ffffff1c;border-radius:22px;background:#ffffff0d;padding:18px;box-shadow:0 20px 60px #0004}.card h3{margin:0;color:#9ce6cf;font-size:12px;letter-spacing:.12em;text-transform:uppercase}.button{width:100%;border:0;border-radius:15px;background:#98dbc7;color:#092421;padding:14px 17px;font:inherit;font-weight:900}.button.secondary{background:#ffffff12;color:#f7f2e8;border:1px solid #ffffff20}.timer{display:flex;align-items:center;justify-content:space-between;border-radius:17px;background:#081719;padding:14px 16px}.timer b{font-size:24px}.teams,.scoreboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.team,.score{border-radius:16px;background:#ffffff0a;padding:13px}.team strong,.score strong{display:block;margin-bottom:6px;color:#9ce6cf}.team span{display:block;color:#c5d4cd;font-size:13px}.score b{font-size:30px}.list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.list li{border-radius:12px;background:#ffffff0a;padding:10px 12px}.grid{display:grid;grid-template-columns:repeat(var(--columns,3),minmax(0,1fr));gap:10px}.grid>.button{aspect-ratio:1;min-height:0;border-radius:18px;padding:8px;font-size:clamp(24px,8vw,54px)}.secret{border:1px dashed #f0c77b88;border-radius:16px;background:#f0c77b12;padding:14px}.secret small{display:block;color:#f0c77b}.secret strong{display:block;margin-top:5px;font-size:22px}.input{display:grid;gap:7px}.input span{color:#b7c9c1;font-size:12px;font-weight:800}.input input{width:100%;border:1px solid #ffffff22;border-radius:13px;background:#071719;color:#fff;padding:13px;font:inherit}.error{border:1px solid #ff8d8d55;border-radius:16px;background:#ff6d6d18;padding:16px;color:#ffd4d4}.loading{padding:50px 10px;text-align:center;color:#9ce6cf}@media(max-width:480px){body{padding:12px}.brand{margin-bottom:10px}.card{border-radius:18px;padding:15px}.grid{gap:7px}.grid>.button{border-radius:13px}}
  .notice{margin:0 0 12px;border:1px solid #f0c77b55;border-radius:14px;background:#f0c77b18;color:#f7dfae;padding:11px 14px;font-size:13px;font-weight:800}.notice[hidden]{display:none}.button.blocked{opacity:.58}
  </style></head><body><main class="shell"><p class="brand">Nights · Sandboxed game</p><p id="notice" class="notice" role="status" hidden></p><div id="root" class="loading">Preparing ${String(game.title).replace(/[<>&]/g, '')}…</div></main><script>
  const source=${inlineJson(runtime.logicSource)}; const players=${inlineJson(players)}; const viewer=${inlineJson(viewer)}; const hostId=${inlineJson(hostId)}; const controller=${inlineJson(canManage)}; const gameId=${inlineJson(game.id)}; const workerTemplate=${inlineJson(GAME_WORKER_SOURCE)}; const forbidden=new RegExp(${inlineJson(GAME_RUNTIME_FORBIDDEN_PATTERN)}); let state=null; let view=null; let revision=0; let bridge=null; const inputs={}; let timerHandle=0;
  const root=document.getElementById('root'); const notice=document.getElementById('notice');
  const clearNotice=()=>{notice.hidden=true;notice.textContent=''};
  const blockedMessage=(action)=>{if(action?.type!=='PLAY_MOVE')return 'That action is not available right now.';const index=Number(action.index);if(Number.isInteger(index)&&state?.board?.[index])return 'That tile is already taken.';const mark=state?.playerMarks?.[viewer.id];if(!mark)return 'Join a team before playing.';const turn=Number(state?.turnIndex||0)%2===0?'X':'O';if(mark!==turn)return 'It is the other team’s turn.';return 'That move is not available.'};
  const showNotice=(message)=>{notice.textContent=message;notice.hidden=false};
  const resolveInputs=(value)=>{if(value==='$viewer:id')return viewer.id;if(value==='$viewer:name')return viewer.name;if(typeof value==='string'&&value.startsWith('$input:'))return inputs[value.slice(7)]||'';if(Array.isArray(value))return value.map(resolveInputs);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolveInputs(item)]));return value};
  const run=(task,action)=>new Promise((resolve,reject)=>{if(typeof source!=='string'||forbidden.test(source)){reject(new Error('This game requested a capability that Nights does not allow.'));return}const workerSource=workerTemplate.replace('/*__NIGHTS_GAME__*/ null',source);const blob=new Blob([workerSource],{type:'text/javascript'});const url=URL.createObjectURL(blob);const worker=new Worker(url);const timeout=setTimeout(()=>{worker.terminate();URL.revokeObjectURL(url);reject(new Error('This game took too long and was stopped safely.'))},350);worker.onmessage=({data})=>{clearTimeout(timeout);worker.terminate();URL.revokeObjectURL(url);data.ok?resolve(data):reject(new Error(data.error||'Game runtime failed.'))};worker.onerror=()=>{clearTimeout(timeout);worker.terminate();URL.revokeObjectURL(url);reject(new Error('The isolated game worker could not load the generated module.'))};worker.postMessage({task,action,state,players,viewer,hostId})});
  const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=String(text);return element};
  const renderNode=(item)=>{if(!item||typeof item!=='object')return node('div','text',item??'');const type=item.type; if(type==='screen'){const el=node('div','screen');(item.children||[]).forEach(child=>el.append(renderNode(child)));return el}if(type==='heading')return node('div','heading',item.text);if(type==='text')return node('div','text',item.text);if(type==='card'){const el=node('section','card');if(item.title)el.append(node('h3','',item.title));const children=item.children||[];const possibleCells=children.length===1&&children[0]&&children[0].type==='list'?(children[0].items||[]):children;const columns=Math.sqrt(possibleCells.length);const isBoard=/board|grid|tiles|matrix/i.test(String(item.title||''))&&Number.isInteger(columns)&&possibleCells.length>=4&&possibleCells.every(child=>child&&child.type==='button');if(isBoard){const grid=node('div','grid');grid.style.setProperty('--columns',String(columns));possibleCells.forEach(child=>grid.append(renderNode(child)));el.append(grid)}else children.forEach(child=>el.append(renderNode(child)));return el}if(type==='button'){const el=node('button','button '+(item.tone==='secondary'?'secondary':''),item.label);el.type='button';el.onclick=()=>dispatch(resolveInputs(item.action||{}));return el}if(type==='timer'){const el=node('div','timer');el.append(node('span','',item.label||'Time remaining'));const remaining=node('b','','');const update=()=>{const seconds=Math.max(0,Math.ceil((Number(item.deadline||0)-Date.now())/1000));remaining.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')};update();timerHandle=setInterval(update,250);el.append(remaining);return el}if(type==='teams'){const el=node('div','teams');(item.teams||[]).forEach(team=>{const teamEl=node('div','team');teamEl.append(node('strong','',team.name));(team.players||[]).forEach(player=>teamEl.append(node('span','',player.name||player)));el.append(teamEl)});return el}if(type==='scoreboard'){const el=node('div','scoreboard');Object.entries(item.scores||{}).forEach(([label,score])=>{const scoreEl=node('div','score');scoreEl.append(node('strong','',label),node('b','',score));el.append(scoreEl)});return el}if(type==='list'){const el=node('ul','list');(item.items||[]).forEach(value=>{const row=node('li','');row.append(typeof value==='object'?renderNode(value):document.createTextNode(String(value)));el.append(row)});return el}if(type==='grid'){const el=node('div','grid');el.style.setProperty('--columns',String(Math.max(1,Math.min(8,Number(item.columns)||3))));(item.children||[]).forEach(child=>el.append(renderNode(child)));return el}if(type==='secret'){const el=node('div','secret');el.append(node('small','',item.label||'Private'),node('strong','',item.value));return el}if(type==='input'){const label=node('label','input');label.append(node('span','',item.label));const input=node('input','','');input.placeholder=item.placeholder||'';input.value=inputs[item.key]||'';input.oninput=event=>{inputs[item.key]=event.target.value};label.append(input);return label}return node('div','text','Unsupported game element')};
  const fit=()=>{root.style.transform='';root.style.width='';const available=Math.max(1,innerHeight-root.offsetTop-2);const scale=Math.min(1,available/Math.max(1,root.scrollHeight));if(scale<1){root.style.transformOrigin='top left';root.style.transform='scale('+scale+')';root.style.width=(100/scale)+'%'}};
  const draw=()=>{clearInterval(timerHandle);root.className='';root.replaceChildren(renderNode(view));requestAnimationFrame(fit)};
  const fail=(error)=>{root.className='error';root.textContent=error.message||'The game could not start.'};
  const dispatch=async(action)=>{try{if(!bridge||!state)throw new Error('The shared game is not connected yet.');root.style.pointerEvents='none';const before=JSON.stringify(state);const result=await run('action',action);if(JSON.stringify(result.state)===before){showNotice(blockedMessage(action));return}clearNotice();state=result.state;view=result.view;draw();bridge.postMessage({type:'state',gameId,revision,state})}catch(error){fail(error)}finally{root.style.pointerEvents=''}};
  const initialize=async()=>{try{const result=await run('setup',null);state=result.state;view=result.view;draw();bridge.postMessage({type:'ready',gameId,state})}catch(error){fail(error)}};
  const synchronize=async(message)=>{try{state=message.state;revision=Number(message.revision)||0;if(controller)state={...state,hostId:viewer.id};const hasTeams=Array.isArray(state?.teams)&&state.teams.some(team=>Array.isArray(team?.players)&&team.players.length);const orderedIds=hasTeams?state.teams.flatMap(team=>(team.players||[]).map(player=>String(player.id||player))):[];const lobby=/^(?:lobby|setup|waiting)$/i.test(String(state?.phase||''));const mappedIds=Object.keys(state?.playerMarks||{});const rosterChanged=orderedIds.some(id=>!mappedIds.includes(id))||mappedIds.some(id=>!orderedIds.includes(id));if(controller&&hasTeams&&(lobby||rosterChanged)){if(orderedIds.length)state={...state,joinedPlayerIds:orderedIds};const actions=[{type:'NIGHTS_TEAMS_ASSIGNED',teams:state.teams},{type:'MANUAL_ASSIGN'},{type:'RANDOM_ASSIGN'}];for(const action of actions){const before=JSON.stringify(state);const result=await run('action',action);if(JSON.stringify(result.state)!==before){state=result.state;view=result.view;draw();bridge.postMessage({type:'state',gameId,revision,state});return}}}const result=await run('render',null);state=result.state;view=result.view;draw()}catch(error){fail(error)}};
  addEventListener('message',event=>{if(event.data?.type!=='nights-game-connect'||event.data.gameId!==gameId||!event.ports[0])return;if(bridge)bridge.close();bridge=event.ports[0];bridge.onmessage=({data})=>{if(data?.type==='initialize')void initialize();if(data?.type==='sync')void synchronize(data)};bridge.start();bridge.postMessage({type:'connected',gameId})});
  addEventListener('resize',()=>requestAnimationFrame(fit));
  </script></body></html>`;
};

function GameSandbox({ eventId, game, participants, viewer, hostId, canManage, onClose }: { eventId: string; game: EventGame; participants: GameParticipant[]; viewer: GameParticipant | null; hostId: string; canManage: boolean; onClose: () => void }) {
  const [session, setSession] = useState<EventGameSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [teamCount, setTeamCount] = useState(2);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<MessagePort | null>(null);
  const sessionRef = useRef<EventGameSession | null>(null);
  const initializingRef = useRef(false);
  const documentSource = useMemo(
    () => gameSandboxDocument(game, participants, viewer, hostId, canManage),
    [canManage, game, hostId, participants, viewer],
  );

  const updateSession = useCallback(async (operation: 'ensure' | 'read' | 'join' | 'teams' | 'state', payload: Record<string, unknown> = {}) => {
    if (!firebaseConfigured) return null;
    const [{ getApp }, authModule] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const user = authModule.getAuth(getApp()).currentUser;
    if (!user) throw new Error('Sign in again to play.');
    return callGameSession(eventId, game.id, operation, await user.getIdToken(), payload);
  }, [eventId, game.id]);

  const applySession = useCallback((next: EventGameSession | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next && next.gameVersion === game.version)
      bridgeRef.current?.postMessage({ type: 'sync', state: next.state, revision: next.revision });
  }, [game.version]);

  useEffect(() => {
    if (!firebaseConfigured) {
      queueMicrotask(() => setSessionReady(true));
      return;
    }
    let stop = () => {};
    void (async () => {
      const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
      const reference = store.doc(store.getFirestore(getApp()), 'events', eventId, 'games', game.id, 'sessions', 'live');
      stop = store.onSnapshot(reference, (snapshot) => {
        applySession(snapshot.exists() ? snapshot.data() as EventGameSession : null);
        setSessionReady(true);
        setSyncError('');
      }, () => {
        setSessionReady(true);
        setSyncError('The shared game could not be loaded.');
      });
    })();
    return () => stop();
  }, [applySession, eventId, game.id]);

  const connectSandbox = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    bridgeRef.current?.close();
    const channel = new MessageChannel();
    bridgeRef.current = channel.port1;
    channel.port1.onmessage = ({ data }) => {
      if (!data || data.gameId !== game.id) return;
      if (data.type === 'connected') {
        const current = sessionRef.current;
        channel.port1.postMessage(current && current.gameVersion === game.version
          ? { type: 'sync', state: current.state, revision: current.revision }
          : { type: 'initialize' });
        return;
      }
      if (data.type === 'ready') {
        const current = sessionRef.current;
        if (current && current.gameVersion === game.version) {
          channel.port1.postMessage({ type: 'sync', state: current.state, revision: current.revision });
          return;
        }
        if (initializingRef.current) return;
        initializingRef.current = true;
        setSyncing(true);
        void updateSession('ensure', { state: data.state, expectedRevision: current?.revision || 0 })
          .then((saved) => saved && applySession(saved))
          .catch((error) => setSyncError(error instanceof Error ? error.message : 'The shared game could not start.'))
          .finally(() => {
            initializingRef.current = false;
            setSyncing(false);
          });
        return;
      }
      if (data.type === 'state') {
        const current = sessionRef.current;
        if (!current) return;
        setSyncing(true);
        void updateSession('state', { state: data.state, expectedRevision: data.revision })
          .then((saved) => saved && applySession(saved))
          .catch((error: Error & { session?: EventGameSession }) => {
            if (error.session) {
              applySession(error.session);
              setSyncError('');
              return;
            }
            setSyncError(error.message || 'That move could not be synchronized.');
          })
          .finally(() => setSyncing(false));
      }
    };
    channel.port1.start();
    target.postMessage({ type: 'nights-game-connect', gameId: game.id }, '*', [channel.port2]);
  }, [applySession, game.id, game.version, updateSession]);

  useEffect(() => () => {
    bridgeRef.current?.close();
    bridgeRef.current = null;
  }, []);

  const joined = Boolean(viewer && session?.joinedPlayers?.some((player) => player.id === viewer.id));
  const assignTeams = async (teams: GameTeam[]) => {
    if (!session) return;
    setSyncing(true);
    try {
      const saved = await updateSession('teams', { teams, expectedRevision: session.revision });
      if (saved) applySession(saved);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Teams could not be updated.');
    } finally {
      setSyncing(false);
    }
  };
  const randomizeTeams = () => {
    if (!session) return;
    const shuffled = [...session.joinedPlayers].sort(() => Math.random() - 0.5);
    const teams = Array.from({ length: teamCount }, (_, index) => ({
      id: `team-${index + 1}`,
      name: `Team ${index + 1}`,
      playerIds: shuffled.filter((_, playerIndex) => playerIndex % teamCount === index).map((player) => player.id),
    }));
    void assignTeams(teams);
  };
  const manuallyAssign = (playerId: string, teamId: string) => {
    if (!session) return;
    const existingTeams = session.teams.length
      ? session.teams
      : Array.from({ length: teamCount }, (_, index) => ({ id: `team-${index + 1}`, name: `Team ${index + 1}`, playerIds: [] }));
    void assignTeams(existingTeams.map((team) => ({
      ...team,
      playerIds: [...team.playerIds.filter((id) => id !== playerId), ...(team.id === teamId ? [playerId] : [])],
    })));
  };
  return (
    <div className="game-sandbox-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="game-sandbox-shell" role="dialog" aria-modal="true" aria-label={`Play ${game.title}`}>
        <header><div><p className="eyebrow">Isolated preview</p><h3 className="font-display">{game.title}</h3></div><button type="button" onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }} aria-label="Close game"><XCircle size={22} /></button></header>
        <section className="game-session-bar">
          <div className="game-session-status">
            <strong>{session?.joinedPlayers?.length || 0} joined</strong>
            <span>{syncing ? 'Synchronizing…' : session ? 'Live on every device' : sessionReady ? 'Starting shared game…' : 'Connecting…'}</span>
          </div>
          {viewer && !joined && session && <button type="button" disabled={syncing} onClick={() => {
            setSyncing(true);
            void updateSession('join', { expectedRevision: session.revision })
              .then((saved) => saved && applySession(saved))
              .catch((error) => setSyncError(error instanceof Error ? error.message : 'Could not join the game.'))
              .finally(() => setSyncing(false));
          }}><Plus size={15} /> Join game</button>}
          {joined && <span className="game-joined"><Check size={14} /> Joined</span>}
          {canManage && session && <div className="game-team-controls">
            <label><span>Teams</span><select value={teamCount} onChange={(event) => setTeamCount(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
            <button type="button" disabled={syncing || !session.joinedPlayers.length} onClick={randomizeTeams}><Sparkles size={14} /> Assign randomly</button>
            <div className="game-manual-assignments">{session.joinedPlayers.map((player) => <label key={player.id}><span>{player.name}</span><select value={session.teams.find((team) => team.playerIds.includes(player.id))?.id || ''} onChange={(event) => manuallyAssign(player.id, event.target.value)}><option value="">Unassigned</option>{(session.teams.length ? session.teams : Array.from({ length: teamCount }, (_, index) => ({ id: `team-${index + 1}`, name: `Team ${index + 1}`, playerIds: [] }))).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>)}</div>
          </div>}
          {syncError && <p>{syncError}</p>}
        </section>
        <iframe ref={iframeRef} title={`${game.title} game`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={documentSource} onLoad={connectSandbox} />
        <footer><ShieldCheck size={15} /><span>This game runs without access to Nights, Firebase, your camera, or the network.</span></footer>
      </div>
    </div>
  );
}

function GamePanel({
  menu,
  canManage,
  accountUid,
  participants,
  viewer,
  hostId,
  onClose,
  notify,
}: {
  menu: EventMenu;
  canManage: boolean;
  accountUid: string;
  participants: GameParticipant[];
  viewer: GameParticipant | null;
  hostId: string;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [games, setGames] = useState<EventGame[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<EventGame>(() => newGameDraft(accountUid));
  const [playing, setPlaying] = useState<EventGame | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseConfigured) {
      try {
        const saved = JSON.parse(localStorage.getItem(gamePreviewKey(menu.id)) || '[]') as EventGame[];
        queueMicrotask(() => {
          setGames(saved);
          setLoading(false);
        });
      } catch {
        queueMicrotask(() => setLoading(false));
      }
      return;
    }
    let stop = () => {};
    void (async () => {
      const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
      const gamesCollection = store.collection(store.getFirestore(getApp()), 'events', menu.id, 'games');
      const gamesQuery = canManage
        ? store.query(gamesCollection, store.orderBy('updatedAt', 'desc'))
        : store.query(gamesCollection, store.where('status', '==', 'published'));
      stop = store.onSnapshot(
        gamesQuery,
        (snapshot) => {
          setGames(snapshot.docs.map((document) => {
            const data = document.data();
            return {
              ...data,
              id: document.id,
              runtime: data.runtime || null,
              createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
              updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
            } as EventGame;
          }));
          setLoading(false);
        },
        () => {
          setError('Games could not be loaded.');
          setLoading(false);
        },
      );
    })();
    return () => stop();
  }, [canManage, menu.id]);

  const visibleGames = canManage ? games : games.filter((game) => game.status === 'published');
  const updateDraft = <K extends keyof EventGame>(key: K, value: EventGame[K]) =>
    setDraft((current) => ({
      ...current,
      [key]: value,
      runtime: key === 'runtime'
        ? value as EventGame['runtime']
        : ['playerArrangement', 'interfaceDescription', 'rules', 'scoring', 'timing', 'hiddenInformation', 'winCondition', 'minPlayers', 'maxPlayers'].includes(key)
          ? null
          : current.runtime,
    }));
  const beginCreate = () => {
    setDraft(newGameDraft(accountUid));
    setError('');
    setEditorOpen(true);
  };
  const beginEdit = (game: EventGame) => {
    setDraft({ ...game });
    setError('');
    setEditorOpen(true);
  };
  const validateDraft = () => {
    if (!draft.title.trim()) return 'Give the game a name.';
    if (!draft.playerArrangement.trim()) return 'Describe how players or teams are arranged.';
    if (!draft.rules.trim()) return 'Describe the game rules.';
    if (!draft.interfaceDescription.trim()) return 'Describe what players need to see and control.';
    if (draft.minPlayers < 1 || draft.maxPlayers < draft.minPlayers) return 'Check the player limits.';
    return '';
  };
  const generate = async () => {
    const validation = validateDraft();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!firebaseConfigured) throw new Error('Connect the production backend to generate a game.');
      const [{ getApp }, authModule] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
      const user = authModule.getAuth(getApp()).currentUser;
      if (!user) throw new Error('Sign in again before generating a game.');
      const result = await callGameGenerator(menu.id, draft, await user.getIdToken());
      const generatedDraft: EventGame = { ...draft, runtime: result.game || null };
      setDraft(generatedDraft);
      setPlaying(generatedDraft);
      notify(`Playable draft generated${typeof result.remainingToday === 'number' ? ` · ${result.remainingToday} AI generations left today` : ''}.`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Game generation failed.');
    } finally {
      setBusy(false);
    }
  };
  const persist = async (status: EventGame['status']) => {
    const validation = validateDraft();
    if (validation) {
      setError(validation);
      return;
    }
    if (status === 'published' && !draft.runtime?.logicSource) {
      setError('Generate and preview a playable draft before publishing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const gameId = draft.id || `game-${crypto.randomUUID()}`;
      const next: EventGame = {
        ...draft,
        id: gameId,
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        status,
        createdBy: draft.createdBy || accountUid,
        createdAt: draft.createdAt || Date.now(),
        updatedAt: Date.now(),
        version: Math.max(1, draft.version || 1) + (draft.id ? 1 : 0),
      };
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
        const reference = store.doc(store.getFirestore(getApp()), 'events', menu.id, 'games', gameId);
        const { createdAt: _createdAt, updatedAt: _updatedAt, ...storedGame } = next;
        await store.setDoc(reference, draft.id
          ? { ...storedGame, updatedAt: store.serverTimestamp() }
          : { ...storedGame, createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp() },
        { merge: true });
        setGames((current) => [next, ...current.filter((game) => game.id !== gameId)]);
      } else {
        const updated = [next, ...games.filter((game) => game.id !== gameId)];
        localStorage.setItem(gamePreviewKey(menu.id), JSON.stringify(updated));
        setGames(updated);
      }
      setDraft(next);
      setEditorOpen(false);
      notify(status === 'published' ? 'Game published for this event.' : 'Game draft saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Game could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const removeGame = async (game: EventGame) => {
    if (!window.confirm(`Delete “${game.title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
        await store.deleteDoc(store.doc(store.getFirestore(getApp()), 'events', menu.id, 'games', game.id));
      } else {
        const updated = games.filter((entry) => entry.id !== game.id);
        localStorage.setItem(gamePreviewKey(menu.id), JSON.stringify(updated));
        setGames(updated);
      }
      notify('Game deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Game could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="game-panel-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="game-panel" role="dialog" aria-modal="true" aria-labelledby="game-panel-title">
        <header className="game-panel-header">
          <div><p className="eyebrow">{menu.title}</p><h2 id="game-panel-title" className="font-display">Games</h2><span>Small, custom games designed for the people at this event.</span></div>
          <button type="button" onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }} aria-label="Close games"><XCircle size={22} /></button>
        </header>
        {!editorOpen ? <>
          {canManage && <section className="game-create-callout">
            <span><Sparkles size={22} /></span>
            <div><strong>Describe any simple gathering game</strong><p>Nights turns your rules, teams, timers, private information and scoring into an isolated playable draft.</p></div>
            <button type="button" onClick={beginCreate}><Plus size={17} /> Create game</button>
          </section>}
          {error && <p className="game-panel-error">{error}</p>}
          <section className="game-library" aria-label="Event games">
            <header><div><p className="eyebrow">Game shelf</p><h3 className="font-display">{canManage ? 'Your event games' : 'Ready to play'}</h3></div><span>{visibleGames.length}</span></header>
            {loading ? <div className="game-empty"><Sparkles size={24} /><strong>Loading games…</strong></div> : visibleGames.length ? <div className="game-card-grid">{visibleGames.map((game) => (
              <article key={game.id} className="game-card">
                <div className="game-card-art"><Gamepad2 size={27} /><span>{game.minPlayers}–{game.maxPlayers} players</span></div>
                <div className="game-card-copy"><div><span className={`game-status ${game.status}`}>{game.status}</span><small>v{game.version}</small></div><h4 className="font-display">{game.title}</h4><p>{game.summary || game.rules}</p></div>
                <footer>
                  <button type="button" className="game-play" disabled={!game.runtime?.logicSource} onClick={() => setPlaying(game)}><Play size={15} /> Play</button>
                  {canManage && <><button type="button" onClick={() => beginEdit(game)}><Pencil size={15} /> Edit</button><button type="button" className="game-delete" onClick={() => void removeGame(game)} disabled={busy} aria-label={`Delete ${game.title}`}><Trash2 size={15} /></button></>}
                </footer>
              </article>
            ))}</div> : <div className="game-empty"><Gamepad2 size={29} /><strong>{canManage ? 'No games yet' : 'The host has not published a game yet'}</strong><span>{canManage ? 'Create one from the rules your group already has in mind.' : 'Published games will appear here.'}</span></div>}
          </section>
        </> : <section className="game-editor">
          <header><div><p className="eyebrow">{draft.id ? 'Edit game' : 'New game'}</p><h3 className="font-display">Define the experience</h3><span>Be specific, then generate and test. You can revise these fields and regenerate as often as needed.</span></div><button type="button" onClick={() => setEditorOpen(false)} disabled={busy}>Back to games</button></header>
          {error && <p className="game-panel-error">{error}</p>}
          <div className="game-editor-grid">
            <label className="game-field game-field-title"><span>Game name</span><input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Reverse Charades" maxLength={90} /></label>
            <div className="game-player-limits"><label><span>Minimum players</span><input type="number" min="1" max="100" value={draft.minPlayers} onChange={(event) => updateDraft('minPlayers', Math.max(1, Number(event.target.value) || 1))} /></label><label><span>Maximum players</span><input type="number" min={draft.minPlayers} max="100" value={draft.maxPlayers} onChange={(event) => updateDraft('maxPlayers', Math.max(draft.minPlayers, Number(event.target.value) || draft.minPlayers))} /></label></div>
            <label className="game-field game-field-wide"><span>Short description</span><textarea value={draft.summary} onChange={(event) => updateDraft('summary', event.target.value)} placeholder="What kind of game is this, and what makes it fun?" rows={2} /></label>
            <label className="game-field"><span>Players and teams</span><textarea value={draft.playerArrangement} onChange={(event) => updateDraft('playerArrangement', event.target.value)} placeholder="Two teams. Assign attendees randomly, but allow the host to move players before starting." rows={5} /></label>
            <label className="game-field"><span>Interface</span><textarea value={draft.interfaceDescription} onChange={(event) => updateDraft('interfaceDescription', event.target.value)} placeholder="Show both teams, whose turn it is, a large timer, and a private word card for the opposing team." rows={5} /></label>
            <label className="game-field"><span>Rules</span><textarea value={draft.rules} onChange={(event) => updateDraft('rules', event.target.value)} placeholder="Describe setup, each turn, allowed actions, what stays hidden, and when a turn ends." rows={7} /></label>
            <label className="game-field"><span>Scoring</span><textarea value={draft.scoring} onChange={(event) => updateDraft('scoring', event.target.value)} placeholder="One point for a correct guess. No point when the timer expires." rows={4} /></label>
            <label className="game-field"><span>Turns and timing</span><textarea value={draft.timing} onChange={(event) => updateDraft('timing', event.target.value)} placeholder="Teams alternate. Each turn lasts 60 seconds." rows={4} /></label>
            <label className="game-field"><span>Private or hidden information</span><textarea value={draft.hiddenInformation} onChange={(event) => updateDraft('hiddenInformation', event.target.value)} placeholder="The acting word is hidden from the guessing team until the turn ends." rows={4} /></label>
            <label className="game-field game-field-wide"><span>How the game ends</span><textarea value={draft.winCondition} onChange={(event) => updateDraft('winCondition', event.target.value)} placeholder="After five rounds, the team with the highest score wins. Ties go to one sudden-death round." rows={3} /></label>
          </div>
          {draft.runtime && <div className="game-runtime-ready"><ShieldCheck size={19} /><div><strong>Playable sandbox ready</strong><span>{draft.runtime.instructions}</span></div><button type="button" onClick={() => setPlaying(draft)}><Play size={15} /> Preview</button></div>}
          <footer className="game-editor-actions">
            <button type="button" onClick={() => setEditorOpen(false)} disabled={busy}>Cancel</button>
            <button type="button" className="game-generate" onClick={() => void generate()} disabled={busy}><Sparkles size={16} />{busy ? 'Designing…' : draft.runtime ? 'Regenerate' : 'Generate playable draft'}</button>
            <button type="button" onClick={() => void persist('draft')} disabled={busy}><Save size={16} /> Save draft</button>
            <button type="button" className="game-publish" onClick={() => void persist('published')} disabled={busy || !draft.runtime}><Check size={16} /> Publish</button>
          </footer>
        </section>}
      </div>
      {playing && <GameSandbox eventId={menu.id} game={playing} participants={participants} viewer={viewer} hostId={hostId} canManage={canManage} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function ExpensePanel({
  menu,
  actor,
  canManage,
  fallbackRsvps,
  editRequest,
  onClose,
  notify,
}: {
  menu: EventMenu;
  actor: ExpenseActor;
  canManage: boolean;
  fallbackRsvps: Rsvp[];
  editRequest: { id: string; nonce: number } | null;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  type DraftItem = { id: string; name: string; amount: string; allocations: Record<string, number> };
  const [expenses, setExpenses] = useState<EventExpense[]>([]);
  const [participants, setParticipants] = useState<ExpenseParticipant[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState('');
  const [title, setTitle] = useState('');
  const [tax, setTax] = useState('');
  const [fees, setFees] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [expandedItemId, setExpandedItemId] = useState('');
  const [outsideParticipants, setOutsideParticipants] = useState<ExpenseSplitParticipant[]>([]);
  const [outsideParticipantName, setOutsideParticipantName] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileDevice, setMobileDevice] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const expenseComposerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    queueMicrotask(() => setMobileDevice(
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    ));
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      const previewParticipants: ExpenseParticipant[] = [{
        id: actor.participantUid,
        accountUid: actor.accountUid,
        primaryGuestUid: actor.participantUid,
        name: actor.name,
        role: actor.role,
        status: actor.role === 'host' ? 'host' : 'yes',
        approvalStatus: 'approved',
        createdAt: Date.now(),
      }];
      fallbackRsvps.forEach((rsvp) => {
        if (rsvp.status === 'no' || approvalStatus(rsvp) === 'declined') return;
        previewParticipants.push({
          id: rsvp.guestUid,
          accountUid: '',
          primaryGuestUid: rsvp.guestUid,
          name: rsvp.guestName,
          role: 'guest',
          status: rsvp.status,
          approvalStatus: approvalStatus(rsvp),
          createdAt: rsvp.createdAt,
        });
        (rsvp.companions || []).forEach((companion, index) => previewParticipants.push({
          id: companionParticipantId(rsvp.guestUid, index),
          accountUid: '',
          primaryGuestUid: rsvp.guestUid,
          name: companionName(companion),
          role: 'companion',
          status: rsvp.status,
          approvalStatus: approvalStatus(rsvp),
          createdAt: rsvp.createdAt,
        }));
      });
      const unique = [...new Map(previewParticipants.map((participant) => [participant.id, participant])).values()];
      queueMicrotask(() => {
        setParticipants(unique);
        setExpenses(JSON.parse(localStorage.getItem(expensePreviewKey(menu.id)) || '[]') as EventExpense[]);
      });
      return;
    }
    let stopParticipants = () => {};
    let stopExpenses = () => {};
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const db = store.getFirestore(getApp());
      stopParticipants = store.onSnapshot(
        store.collection(db, 'events', menu.id, 'expense-participants'),
        (snapshot) => setParticipants(snapshot.docs.map((document) => {
          const data = document.data();
          return {
            ...data,
            id: document.id,
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: data.updatedAt?.toMillis?.(),
          } as ExpenseParticipant;
        })),
      );
      stopExpenses = store.onSnapshot(
        store.collection(db, 'events', menu.id, 'expenses'),
        (snapshot) => setExpenses(snapshot.docs.map((document) => {
          const data = document.data();
          return {
            ...data,
            id: document.id,
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: data.updatedAt?.toMillis?.(),
          } as EventExpense;
        }).sort((left, right) => right.createdAt - left.createdAt)),
      );
    })().catch(() => setExpenses([]));
    return () => {
      stopParticipants();
      stopExpenses();
    };
  }, [actor, fallbackRsvps, menu.id]);

  const eligibleParticipants = useMemo(() => {
    const filtered = participants.filter((participant) =>
      participant.status !== 'no' && participant.approvalStatus !== 'declined');
    if (!filtered.some((participant) => participant.id === actor.participantUid)) filtered.push({
      id: actor.participantUid,
      accountUid: actor.accountUid,
      primaryGuestUid: actor.participantUid,
      name: actor.name,
      role: actor.role,
      status: actor.role === 'host' ? 'host' : 'yes',
      approvalStatus: 'approved',
      createdAt: 0,
    });
    return filtered.sort((left, right) =>
      Number(right.role === 'host') - Number(left.role === 'host') || left.name.localeCompare(right.name));
  }, [actor, participants]);
  const draftParticipants = useMemo<ExpenseSplitParticipant[]>(() => [
    ...eligibleParticipants.map(({ id, name, role }) => ({ id, name, role })),
    ...outsideParticipants,
  ], [eligibleParticipants, outsideParticipants]);

  const newDraftItem = (people: ExpenseSplitParticipant[] = eligibleParticipants): DraftItem => ({
    id: crypto.randomUUID(),
    name: '',
    amount: '',
    allocations: Object.fromEntries(people.map((participant) => [participant.id, 1])),
  });
  const beginManualExpense = () => {
    const item = newDraftItem(eligibleParticipants);
    setTitle('');
    setTax('');
    setFees('');
    setOutsideParticipants([]);
    setOutsideParticipantName('');
    setEditingExpenseId('');
    setItems([item]);
    setExpandedItemId(item.id);
    setManualOpen(true);
  };
  const updateItem = (itemId: string, build: (item: DraftItem) => DraftItem) =>
    setItems((current) => current.map((item) => item.id === itemId ? build(item) : item));
  const addOutsideParticipant = (itemId?: string) => {
    const name = outsideParticipantName.trim().replace(/\s+/g, ' ');
    if (!name) {
      notify('Enter the person’s name');
      return;
    }
    const existing = draftParticipants.find((participant) => participant.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0);
    if (existing) {
      if (itemId)
        updateItem(itemId, (current) => ({ ...current, allocations: { ...current.allocations, [existing.id]: current.allocations[existing.id] || 1 } }));
      else
        setItems((current) => current.map((item) => ({ ...item, allocations: { ...item.allocations, [existing.id]: item.allocations[existing.id] || 1 } })));
      setOutsideParticipantName('');
      notify(`${existing.name} is included in ${itemId ? 'this item' : 'the expense'}`);
      return;
    }
    const participant: ExpenseSplitParticipant = {
      id: `external-${crypto.randomUUID()}`,
      name,
      role: 'external',
    };
    setOutsideParticipants((current) => [...current, participant]);
    if (itemId)
      updateItem(itemId, (current) => ({ ...current, allocations: { ...current.allocations, [participant.id]: 1 } }));
    else
      setItems((current) => current.map((item) => ({ ...item, allocations: { ...item.allocations, [participant.id]: 1 } })));
    setOutsideParticipantName('');
  };
  const removeOutsideParticipant = (participantUid: string) => {
    setOutsideParticipants((current) => current.filter((participant) => participant.id !== participantUid));
    setItems((current) => current.map((item) => {
      const allocations = { ...item.allocations };
      delete allocations[participantUid];
      return { ...item, allocations };
    }));
  };
  const closeExpenseComposer = () => {
    setManualOpen(false);
    setEditingExpenseId('');
    setOutsideParticipants([]);
    setOutsideParticipantName('');
  };
  const beginEditExpense = (expense: EventExpense) => {
    if (expense.kind !== 'manual') return;
    const savedParticipants = expense.participants || [];
    setTitle(expense.title);
    setTax(expense.taxCents ? (expense.taxCents / 100).toFixed(2) : '');
    setFees(expense.feesCents ? (expense.feesCents / 100).toFixed(2) : '');
    const currentParticipantIds = new Set(eligibleParticipants.map((participant) => participant.id));
    setOutsideParticipants(savedParticipants.filter((participant) =>
      participant.role === 'external' || !currentParticipantIds.has(participant.id)));
    setOutsideParticipantName('');
    setItems(expense.items.map((item) => ({
      id: item.id,
      name: item.name,
      amount: (item.amountCents / 100).toFixed(2),
      allocations: Object.fromEntries(item.allocations.map((allocation) => [allocation.participantUid, allocation.multiplier])),
    })));
    setExpandedItemId(expense.items[0]?.id || '');
    setEditingExpenseId(expense.id);
    setManualOpen(true);
    requestAnimationFrame(() => expenseComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  useEffect(() => {
    if (!editRequest) return;
    const expense = expenses.find((entry) => entry.id === editRequest.id);
    if (expense) queueMicrotask(() => beginEditExpense(expense));
    // The request nonce intentionally makes each tap distinct. The expense list
    // is already populated before an edit control can be rendered.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest]);

  const persistExpense = async (expense: EventExpense) => {
    if (firebaseConfigured) {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
      ]);
      const expenseRef = store.doc(store.getFirestore(getApp()), 'events', menu.id, 'expenses', expense.id);
      const existing = expenses.some((entry) => entry.id === expense.id);
      if (existing) {
        const { createdAt: _createdAt, updatedAt: _updatedAt, ...editableExpense } = expense;
        await store.updateDoc(expenseRef, { ...editableExpense, updatedAt: store.serverTimestamp() });
      } else {
        await store.setDoc(expenseRef, {
          ...expense,
          createdAt: store.serverTimestamp(),
          updatedAt: store.serverTimestamp(),
        });
      }
      return;
    }
    const next = [expense, ...expenses.filter((entry) => entry.id !== expense.id)];
    setExpenses(next);
    localStorage.setItem(expensePreviewKey(menu.id), JSON.stringify(next));
  };

  const notifyExpenseParticipants = async (expenseId: string) => {
    if (!firebaseConfigured) return;
    const [{ getApp }, { getAuth }] = await Promise.all([
      import('firebase/app'), import('firebase/auth'),
    ]);
    const user = getAuth(getApp()).currentUser;
    if (!user) throw new Error('Sign in again to notify guests.');
    const result = await callPushApi('expense', 'POST', {
      eventId: menu.id,
      expenseId,
    }, await user.getIdToken());
    return typeof result.deliveries === 'number' ? result.deliveries : 0;
  };

  const saveManualExpense = async () => {
    const preparedItems: ExpenseLineItem[] = items.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      amountCents: parseMoneyCents(item.amount),
      allocations: Object.entries(item.allocations)
        .filter(([, multiplier]) => multiplier > 0)
        .map(([participantUid, multiplier]) => ({ participantUid, multiplier })),
    }));
    if (!title.trim()) {
      notify('Add an expense name');
      return;
    }
    if (!preparedItems.length || preparedItems.some((item) => !item.name || item.amountCents <= 0)) {
      notify('Every item needs a name and price');
      return;
    }
    if (preparedItems.some((item) => !item.allocations.length)) {
      notify('Choose at least one person for every item');
      return;
    }
    setBusy(true);
    try {
      const now = Date.now();
      const existingExpense = expenses.find((expense) => expense.id === editingExpenseId);
      const usedParticipantIds = new Set(preparedItems.flatMap((item) => item.allocations.map((allocation) => allocation.participantUid)));
      const savedExpense: EventExpense = {
        id: existingExpense?.id || crypto.randomUUID(),
        kind: 'manual',
        title: title.trim(),
        items: preparedItems,
        taxCents: parseMoneyCents(tax),
        feesCents: parseMoneyCents(fees),
        submittedByAccountUid: actor.accountUid,
        submittedByUid: actor.participantUid,
        submittedByName: actor.name,
        submittedByRole: actor.role,
        participants: draftParticipants.filter((participant) => usedParticipantIds.has(participant.id)),
        createdAt: existingExpense?.createdAt || now,
        updatedAt: now,
      };
      await persistExpense(savedExpense);
      let notificationFailed = false;
      let notificationDeliveries = 0;
      if (!existingExpense) {
        try {
          notificationDeliveries = await notifyExpenseParticipants(savedExpense.id) || 0;
        } catch {
          notificationFailed = true;
        }
      }
      closeExpenseComposer();
      notify(existingExpense
        ? 'Expense updated'
        : notificationFailed
          ? 'Expense added, but guest notifications could not be sent'
          : notificationDeliveries > 0
            ? `Expense added · sent to ${notificationDeliveries} notification-enabled device${notificationDeliveries === 1 ? '' : 's'}`
            : 'Expense added · no involved guests have notifications enabled');
    } catch {
      notify('The expense could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const uploadReceipt = async (file: File) => {
    if (file.size > 40 * 1024 * 1024) {
      notify('The original receipt image must be smaller than 40 MB');
      return;
    }
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      notify('Choose a JPEG, PNG, WebP, HEIC, or HEIF receipt image');
      return;
    }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const receiptUrl = await compressImageForDocument(file, 600_000);
      const now = Date.now();
      await persistExpense({
        id,
        kind: 'receipt',
        title: file.name.replace(/\.[^.]+$/, '') || 'Receipt',
        items: [],
        taxCents: 0,
        feesCents: 0,
        submittedByAccountUid: actor.accountUid,
        submittedByUid: actor.participantUid,
        submittedByName: actor.name,
        submittedByRole: actor.role,
        participants: [],
        receiptUrl,
        receiptPath: '',
        receiptName: file.name,
        createdAt: now,
        updatedAt: now,
      });
      notify('Receipt uploaded — item processing can be added next');
    } catch {
      notify('The receipt could not be uploaded.');
    } finally {
      setBusy(false);
      if (receiptInputRef.current) receiptInputRef.current.value = '';
    }
  };

  const deleteExpense = async (expense: EventExpense) => {
    if (!canManage && expense.submittedByAccountUid !== actor.accountUid) return;
    if (!window.confirm(`Delete “${expense.title}”?`)) return;
    setBusy(true);
    try {
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'), import('firebase/firestore'),
        ]);
        await store.deleteDoc(store.doc(store.getFirestore(getApp()), 'events', menu.id, 'expenses', expense.id));
      } else {
        const next = expenses.filter((entry) => entry.id !== expense.id);
        setExpenses(next);
        localStorage.setItem(expensePreviewKey(menu.id), JSON.stringify(next));
      }
      notify('Expense deleted');
    } catch {
      notify('The expense could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  const balances = useMemo(() => {
    const result: Record<string, number> = {};
    expenses.forEach((expense) => Object.entries(expenseShares(expense)).forEach(([participantUid, cents]) => {
      result[participantUid] = (result[participantUid] || 0) + cents;
    }));
    return result;
  }, [expenses]);
  const ledgerParticipants = useMemo<ExpenseSplitParticipant[]>(() => {
    const directory = new Map<string, ExpenseSplitParticipant>();
    eligibleParticipants.forEach(({ id, name, role }) => directory.set(id, { id, name, role }));
    expenses.forEach((expense) => expense.participants?.forEach((participant) => directory.set(participant.id, participant)));
    return [...directory.values()].filter((participant) => (balances[participant.id] || 0) > 0 || participant.id === actor.participantUid);
  }, [actor.participantUid, balances, eligibleParticipants, expenses]);
  const total = expenses.reduce((sum, expense) => sum + expenseTotal(expense), 0);

  return (
    <div className="expense-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="expense-panel" role="dialog" aria-modal="true" aria-labelledby="expense-panel-title">
        <header className="expense-panel-header">
          <div><p className="eyebrow">{menu.title}</p><h2 id="expense-panel-title" className="font-display">Expenses</h2><span>Receipts, shared items and a clear total for every guest.</span></div>
          <button
            type="button"
            data-expense-action="close"
            onPointerDown={(event) => {
              event.stopPropagation();
              onClose();
            }}
            onClick={onClose}
            aria-label="Close expenses"
          ><XCircle size={22} /></button>
        </header>

        <section className="expense-summary">
          <div className="expense-total"><span>Total recorded</span><strong>{formatCents(total)}</strong><small>{expenses.length} entr{expenses.length === 1 ? 'y' : 'ies'}</small></div>
          <div className="expense-guest-shares" aria-label="Guest expense shares">
            {ledgerParticipants.map((participant) => (
              <article key={participant.id} className={participant.id === actor.participantUid ? 'current' : ''}>
                <span>{participant.name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{participant.name}{participant.role === 'host' ? ' · Host' : ''}</strong><small>{participant.id === actor.participantUid ? 'Your share' : 'Share'}</small></div>
                <b>{formatCents(balances[participant.id] || 0)}</b>
              </article>
            ))}
          </div>
        </section>

        <section className="expense-actions" aria-label="Add an expense">
          <button type="button" onClick={beginManualExpense} disabled={busy}><Calculator size={18} /><span><strong>Add manually</strong><small>Items, tax, fees and weighted shares</small></span></button>
          <button type="button" disabled className="camera-coming-soon receipt-upload-disabled" title="Receipt processing is coming next"><Upload size={18} /><span><strong>Upload receipt</strong><small>Coming soon</small></span></button>
          {mobileDevice && <button type="button" disabled className="camera-coming-soon"><Camera size={18} /><span><strong>Take a picture</strong><small>Camera capture coming next</small></span></button>}
          <input ref={receiptInputRef} type="file" hidden accept="image/*,.heic,.heif" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadReceipt(file);
          }} />
        </section>

        {manualOpen && <section ref={expenseComposerRef} className="expense-composer">
          <header><div><p className="eyebrow">{editingExpenseId ? 'Edit expense' : 'Manual entry'}</p><h3 className="font-display">{editingExpenseId ? 'Update the split' : 'Build the expense'}</h3></div><button type="button" onClick={closeExpenseComposer} disabled={busy}>Cancel</button></header>
          <label className="expense-title-field"><span>Expense name</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Groceries, movie tickets…" /></label>
          <div className="expense-add-outsider expense-add-outsider-global">
            <label><span>Add someone without a Nights account</span><input value={outsideParticipantName} onChange={(event) => setOutsideParticipantName(event.target.value)} placeholder="Name (for this expense only)" maxLength={80} onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addOutsideParticipant();
              }
            }} /></label>
            <button type="button" onClick={() => addOutsideParticipant()} disabled={!outsideParticipantName.trim()}><Plus size={15} /> Add person</button>
          </div>
          {outsideParticipants.length > 0 && <div className="expense-outsider-chips" aria-label="People without Nights accounts">
            {outsideParticipants.map((participant) => <span key={participant.id}>{participant.name}<button type="button" onClick={() => removeOutsideParticipant(participant.id)} aria-label={`Remove ${participant.name}`}><XCircle size={13} /></button></span>)}
          </div>}
          <div className="expense-item-list">
            {items.map((item, itemIndex) => {
              const selectedCount = Object.values(item.allocations).filter((multiplier) => multiplier > 0).length;
              return <article key={item.id} className="expense-item-editor">
                <div className="expense-item-fields">
                  <label><span>Item {itemIndex + 1}</span><input value={item.name} onChange={(event) => updateItem(item.id, (current) => ({ ...current, name: event.target.value }))} placeholder="Item name" /></label>
                  <label><span>Price</span><div className="money-input"><DollarSign size={14} /><input inputMode="decimal" value={item.amount} onChange={(event) => updateItem(item.id, (current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></div></label>
                  <button type="button" className="expense-split-toggle" onClick={() => setExpandedItemId((current) => current === item.id ? '' : item.id)}>
                    <UsersRound size={15} /><span>Split between {selectedCount} guest{selectedCount === 1 ? '' : 's'}</span>{expandedItemId === item.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button type="button" className="expense-remove-item" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} disabled={items.length === 1} aria-label={`Remove item ${itemIndex + 1}`}><Trash2 size={15} /></button>
                </div>
                {expandedItemId === item.id && <div className="expense-split-editor">
                  <div className="expense-split-tools">
                    <button type="button" onClick={() => updateItem(item.id, (current) => ({ ...current, allocations: Object.fromEntries(draftParticipants.map((participant) => [participant.id, 1])) }))}><Check size={14} /> Select all</button>
                    <button type="button" onClick={() => updateItem(item.id, (current) => ({ ...current, allocations: {} }))}><XCircle size={14} /> Deselect all</button>
                    <button type="button" onClick={() => updateItem(item.id, (current) => ({ ...current, allocations: Object.fromEntries(Object.keys(current.allocations).filter((participantUid) => current.allocations[participantUid] > 0).map((participantUid) => [participantUid, 1])) }))}><Calculator size={14} /> Share equally</button>
                  </div>
                  <div className="expense-participant-options">
                    {draftParticipants.map((participant) => {
                      const multiplier = item.allocations[participant.id] || 0;
                      return <div key={participant.id} className={multiplier ? 'selected' : ''}>
                        <label><input type="checkbox" aria-label={`Include ${participant.name} in this item`} checked={multiplier > 0} onChange={(event) => updateItem(item.id, (current) => {
                          const allocations = { ...current.allocations };
                          if (event.target.checked) allocations[participant.id] = 1;
                          else delete allocations[participant.id];
                          return { ...current, allocations };
                        })} /><span><strong>{participant.name}</strong><small>{participant.role === 'host' ? 'Host' : participant.role === 'companion' ? 'Additional guest' : participant.role === 'external' ? 'Not on guest list' : 'Guest'}</small></span></label>
                        <div className="expense-person-actions">
                          {multiplier > 0 && <div className="share-multiplier" aria-label={`${participant.name} shares`}><button type="button" onClick={() => updateItem(item.id, (current) => ({ ...current, allocations: { ...current.allocations, [participant.id]: Math.max(1, multiplier - 1) } }))} disabled={multiplier <= 1}><Minus size={13} /></button><b>{multiplier}×</b><button type="button" onClick={() => updateItem(item.id, (current) => ({ ...current, allocations: { ...current.allocations, [participant.id]: Math.min(99, multiplier + 1) } }))}><Plus size={13} /></button></div>}
                          {participant.role === 'external' && <button type="button" className="expense-remove-person" onClick={() => removeOutsideParticipant(participant.id)} aria-label={`Remove ${participant.name}`}><Trash2 size={13} /></button>}
                        </div>
                      </div>;
                    })}
                  </div>
                </div>}
              </article>;
            })}
          </div>
          <button type="button" className="expense-add-item" onClick={() => {
            const item = newDraftItem(draftParticipants);
            setItems((current) => [...current, item]);
            setExpandedItemId(item.id);
          }}><Plus size={15} /> Add another item</button>
          <div className="expense-extras">
            <label><span>Tax</span><div className="money-input"><DollarSign size={14} /><input inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} placeholder="0.00" /></div></label>
            <label><span>Fees</span><div className="money-input"><DollarSign size={14} /><input inputMode="decimal" value={fees} onChange={(event) => setFees(event.target.value)} placeholder="0.00" /></div></label>
            <div><span>Expense total</span><strong>{formatCents(items.reduce((sum, item) => sum + parseMoneyCents(item.amount), 0) + parseMoneyCents(tax) + parseMoneyCents(fees))}</strong><small>Tax and fees follow each guest’s item share.</small></div>
          </div>
          <button type="button" className="primary-button expense-save" onClick={() => void saveManualExpense()} disabled={busy}>{busy ? 'Saving…' : editingExpenseId ? 'Update expense & split' : 'Save expense & split'}</button>
        </section>}

        <section className="expense-history">
          <header><div><p className="eyebrow">Shared ledger</p><h3 className="font-display">Event expenses</h3></div><span>{expenses.length}</span></header>
          {expenses.length === 0 ? <div className="expense-empty"><FileText size={25} /><strong>No expenses yet</strong><span>Add a manual expense or upload the first receipt.</span></div> : expenses.map((expense) => {
            const shares = expenseShares(expense);
            const expenseParticipantNames = new Map([
              ...eligibleParticipants.map((participant) => [participant.id, participant.name] as const),
              ...(expense.participants || []).map((participant) => [participant.id, participant.name] as const),
            ]);
            return <article key={expense.id} className="expense-history-card">
              <div className="expense-history-title">
                <span>{expense.kind === 'receipt' ? <FileText size={18} /> : <DollarSign size={18} />}</span>
                <div><strong>{expense.title}</strong><small>Added by {expense.submittedByName} · {new Date(expense.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>
                <b>{expense.kind === 'receipt' ? 'Pending' : formatCents(expenseTotal(expense))}</b>
                {(canManage || expense.submittedByAccountUid === actor.accountUid) && <div className="expense-history-actions">
                  {expense.kind === 'manual' && <button type="button" data-expense-action="edit" data-expense-id={expense.id} onClick={() => beginEditExpense(expense)} disabled={busy} aria-label={`Edit ${expense.title}`}><Pencil size={15} /></button>}
                  <button type="button" className="delete" onClick={() => void deleteExpense(expense)} disabled={busy} aria-label={`Delete ${expense.title}`}><Trash2 size={15} /></button>
                </div>}
              </div>
              {expense.kind === 'receipt' ? <div className="receipt-awaiting"><span>Awaiting itemization</span>{expense.receiptUrl && <a href={expense.receiptUrl} target="_blank" rel="noreferrer">View receipt <ExternalLink size={13} /></a>}</div> : <>
                <ul className="expense-line-summary">{expense.items.map((item) => <li key={item.id}><span>{item.name}</span><b>{formatCents(item.amountCents)}</b></li>)}{expense.taxCents > 0 && <li><span>Tax</span><b>{formatCents(expense.taxCents)}</b></li>}{expense.feesCents > 0 && <li><span>Fees</span><b>{formatCents(expense.feesCents)}</b></li>}</ul>
                <div className="expense-share-chips">{Object.entries(shares).map(([participantUid, cents]) => <span key={participantUid}><b>{expenseParticipantNames.get(participantUid) || 'Guest'}</b>{formatCents(cents)}</span>)}</div>
              </>}
            </article>;
          })}
        </section>
      </div>
    </div>
  );
}

function EventChat({
  menu,
  actor,
  visible,
  onMinimize,
  onUnreadChange,
  pushNotificationState,
  eventMuted,
  pushNotificationBusy,
  pushAvailable,
  onTogglePush,
  notify,
}: {
  menu: EventMenu;
  actor: ChatActor;
  visible: boolean;
  onMinimize: () => void;
  onUnreadChange: (unread: number) => void;
  pushNotificationState: PushNotificationState;
  eventMuted: boolean;
  pushNotificationBusy: boolean;
  pushAvailable: boolean;
  onTogglePush: () => void;
  notify: (message: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatReply | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [reactionDetailsFor, setReactionDetailsFor] = useState<string | null>(null);
  const [pollVotersFor, setPollVotersFor] = useState<string | null>(null);
  const [messageMenuFor, setMessageMenuFor] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [allowGuestOptions, setAllowGuestOptions] = useState(false);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [addingOptionFor, setAddingOptionFor] = useState<string | null>(null);
  const [newOption, setNewOption] = useState('');
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});
  const highlightTimerRef = useRef<number | null>(null);
  const knownMessageIds = useRef<Set<string> | null>(null);
  const restoredForOpen = useRef(false);
  const previewKey = `gather-demo-chat:${menu.id}`;
  const readPositionKey = `gather-chat-read:${menu.id}:${actor.uid}`;
  const locked = menu.chatOpen === false;

  const scrollStreamToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.scrollTo({ top: stream.scrollHeight, behavior });
  }, []);

  const scrollMessageInsideStream = useCallback((message: HTMLElement, behavior: ScrollBehavior = 'auto') => {
    const stream = streamRef.current;
    if (!stream) return;
    const streamBounds = stream.getBoundingClientRect();
    const messageBounds = message.getBoundingClientRect();
    const nextTop = stream.scrollTop
      + messageBounds.top
      - streamBounds.top
      - (stream.clientHeight - messageBounds.height) / 2;
    stream.scrollTo({ top: Math.max(0, nextTop), behavior });
  }, []);

  useEffect(() => {
    let active = true;
    void readAppBadgeState().then((state) => {
      if (!active) return;
      if (visible) void setEventAppBadge(menu.id, 0);
      else setUnread(state.events[menu.id] || 0);
    });
    return () => { active = false; };
  }, [menu.id, visible]);

  useEffect(() => {
    onUnreadChange(unread);
  }, [onUnreadChange, unread]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const receivePush = (event: MessageEvent<{ type?: string; eventId?: string }>) => {
      if (event.data?.type !== 'nights-chat-push' || event.data.eventId !== menu.id) return;
      if (visible) void setEventAppBadge(menu.id, 0);
      else void readAppBadgeState().then((state) => setUnread(state.events[menu.id] || 0));
    };
    navigator.serviceWorker.addEventListener('message', receivePush);
    return () => navigator.serviceWorker.removeEventListener('message', receivePush);
  }, [menu.id, visible]);

  const rememberReadPosition = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const bounds = stream.getBoundingClientRect();
    const visibleMessages = Array.from(
      stream.querySelectorAll<HTMLElement>('[data-chat-message-id]'),
    ).filter((element) => {
      const box = element.getBoundingClientRect();
      return box.bottom > bounds.top && box.top < bounds.bottom;
    });
    const lastVisible = visibleMessages.at(-1)?.dataset.chatMessageId;
    if (lastVisible) localStorage.setItem(readPositionKey, lastVisible);
  }, [readPositionKey]);

  useEffect(() => {
    knownMessageIds.current = null;
    queueMicrotask(() => setUnread(0));
    if (!firebaseConfigured) {
      const load = () => {
        try {
          setMessages(JSON.parse(localStorage.getItem(previewKey) || '[]') as ChatMessage[]);
        } catch {
          setMessages([]);
        }
      };
      load();
      const handleStorage = (event: StorageEvent) => {
        if (event.key === previewKey) load();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
    let unsubscribe = () => {};
    void (async () => {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ]);
      const query = store.query(
        store.collection(store.getFirestore(getApp()), 'events', menu.id, 'chat'),
        store.orderBy('createdAt', 'asc'),
      );
      unsubscribe = store.onSnapshot(query, (snapshot) => {
        setMessages(snapshot.docs.map((entry) => {
          const data = entry.data();
          return {
            id: entry.id,
            ...data,
            createdAt: data.createdAt?.toMillis?.() ?? eventTimestamp(),
            updatedAt: data.updatedAt?.toMillis?.(),
          } as ChatMessage;
        }));
      });
    })().catch(() => undefined);
    return () => unsubscribe();
  }, [menu.id, previewKey]);

  useEffect(() => {
    if (!visible || !restoredForOpen.current) return;
    scrollStreamToBottom('smooth');
  }, [messages.length, scrollStreamToBottom, visible]);

  useEffect(() => {
    if (!visible) {
      restoredForOpen.current = false;
      return;
    }
    if (restoredForOpen.current || messages.length === 0) return;
    restoredForOpen.current = true;
    const savedMessageId = localStorage.getItem(readPositionKey);
    requestAnimationFrame(() => {
      if (!savedMessageId) {
        scrollStreamToBottom();
        return;
      }
      const chronological = [...messages].sort(
        (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
      );
      const savedIndex = chronological.findIndex((message) => message.id === savedMessageId);
      const target = chronological[savedIndex + 1] || chronological[savedIndex];
      const targetElement = target ? messageRefs.current[target.id] : null;
      if (targetElement) scrollMessageInsideStream(targetElement);
      else scrollStreamToBottom();
      requestAnimationFrame(rememberReadPosition);
    });
  }, [messages, readPositionKey, rememberReadPosition, scrollMessageInsideStream, scrollStreamToBottom, visible]);

  useEffect(() => {
    const currentIds = new Set(messages.map((message) => message.id));
    if (knownMessageIds.current) {
      const incoming = messages.filter(
        (message) => !knownMessageIds.current?.has(message.id) && message.authorUid !== actor.uid,
      );
      if (incoming.length) {
        playChatSound();
        if (!visible) setUnread((current) => current + incoming.length);
      }
    }
    knownMessageIds.current = currentIds;
  }, [messages, actor.uid, visible]);

  useEffect(() => {
    if (visible) queueMicrotask(() => {
      setUnread(0);
      void setEventAppBadge(menu.id, 0);
    });
  }, [menu.id, visible]);

  useEffect(() => () => {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
  }, []);

  const focusComposer = () => requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }));

  const jumpToMessage = (messageId: string) => {
    const message = messageRefs.current[messageId];
    if (!message) return;
    scrollMessageInsideStream(message, 'smooth');
    setHighlightedMessageId(messageId);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedMessageId(null), 1800);
  };

  const resolveActor = async (): Promise<ChatActor> => {
    if (actor.role === 'guest' || !firebaseConfigured) return actor;
    const [{ getApp }, authModule] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const user = authModule.getAuth(getApp()).currentUser;
    if (!user) throw new Error('host-sign-in');
    return { uid: user.uid, name: 'Host', role: 'host' };
  };
  const savePreview = (next: ChatMessage[]) => {
    setMessages(next);
    localStorage.setItem(previewKey, JSON.stringify(next));
  };
  const updateMessage = async (
    messageId: string,
    build: (current: ChatMessage, resolvedActor: ChatActor) => Partial<ChatMessage>,
  ) => {
    if (locked) return;
    const resolvedActor = await resolveActor();
    if (!firebaseConfigured) {
      savePreview(messages.map((message) => message.id === messageId
        ? { ...message, ...build(message, resolvedActor), updatedAt: eventTimestamp(), lastActorUid: resolvedActor.uid, lastActorRole: resolvedActor.role }
        : message));
      return;
    }
    const [{ getApp }, store] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
    ]);
    const ref = store.doc(store.getFirestore(getApp()), 'events', menu.id, 'chat', messageId);
    await store.runTransaction(store.getFirestore(getApp()), async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) return;
      const current = { id: snapshot.id, ...snapshot.data() } as ChatMessage;
      transaction.update(ref, {
        ...build(current, resolvedActor),
        updatedAt: store.serverTimestamp(),
        lastActorUid: resolvedActor.uid,
        lastActorRole: resolvedActor.role,
      });
    });
  };
  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || locked || busy) return;
    setBusy(true);
    try {
      const resolvedActor = await resolveActor();
      if (editing) {
        if (editing.authorUid !== resolvedActor.uid) throw new Error('not-author');
        await updateMessage(editing.id, () => ({ text: text.slice(0, 2000), edited: true }));
      } else {
        const id = crypto.randomUUID();
        const message: ChatMessage = {
          id,
          type: 'message',
          authorUid: resolvedActor.uid,
          authorName: resolvedActor.name,
          authorRole: resolvedActor.role,
          text: text.slice(0, 2000),
          createdAt: eventTimestamp(),
          updatedAt: eventTimestamp(),
          edited: false,
          replyTo,
          reactions: {},
          pollQuestion: '',
          pollOptions: [],
          pollVotes: {},
          pollVoterNames: {},
          allowGuestOptions: false,
          allowMultipleVotes: false,
          pollBumpedAt: 0,
          pinned: false,
          pinnedAt: 0,
          pinnedByName: '',
          deleted: false,
          lastActorUid: resolvedActor.uid,
          lastActorRole: resolvedActor.role,
        };
        if (firebaseConfigured) {
          const [{ getApp }, store] = await Promise.all([
            import('firebase/app'),
            import('firebase/firestore'),
          ]);
          await store.setDoc(
            store.doc(store.getFirestore(getApp()), 'events', menu.id, 'chat', id),
            { ...message, createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp() },
          );
          void callPushApi('send', 'POST', { eventId: menu.id, messageId: id }).catch(() => undefined);
        } else savePreview([...messages, message]);
      }
      setDraft('');
      setReplyTo(null);
      setEditing(null);
      focusComposer();
    } catch {
      notify('Message could not be saved');
    } finally {
      setBusy(false);
    }
  };
  const createPoll = async () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (actor.role !== 'host' || !question || options.length < 2 || locked || busy) return;
    setBusy(true);
    try {
      const resolvedActor = await resolveActor();
      const id = crypto.randomUUID();
      const now = eventTimestamp();
      const message: ChatMessage = {
        id,
        type: 'poll',
        authorUid: resolvedActor.uid,
        authorName: resolvedActor.name,
        authorRole: 'host',
        text: '',
        createdAt: now,
        updatedAt: now,
        edited: false,
        replyTo: null,
        reactions: {},
        pollQuestion: question.slice(0, 300),
        pollOptions: options.slice(0, 12).map((text, index) => ({
          id: `${id}-${index}`,
          text: text.slice(0, 120),
          addedByUid: resolvedActor.uid,
          addedByName: 'Host',
        })),
        pollVotes: {},
        pollVoterNames: {},
        allowGuestOptions,
        allowMultipleVotes,
        pollBumpedAt: 0,
        pinned: false,
        pinnedAt: 0,
        pinnedByName: '',
        deleted: false,
        lastActorUid: resolvedActor.uid,
        lastActorRole: 'host',
      };
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        await store.setDoc(
          store.doc(store.getFirestore(getApp()), 'events', menu.id, 'chat', id),
          { ...message, createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp() },
        );
        void callPushApi('send', 'POST', { eventId: menu.id, messageId: id }).catch(() => undefined);
      } else savePreview([...messages, message]);
      setPollQuestion('');
      setPollOptions(['', '']);
      setAllowGuestOptions(false);
      setAllowMultipleVotes(false);
      setPollOpen(false);
      focusComposer();
    } catch {
      notify('Poll could not be created');
    } finally {
      setBusy(false);
    }
  };
  const react = async (message: ChatMessage, emoji: string) => {
    await updateMessage(message.id, (current, resolvedActor) => {
      const reactions = { ...current.reactions };
      const existing = reactions[resolvedActor.uid];
      const existingEmoji = typeof existing === 'string' ? existing : existing?.emoji;
      if (existingEmoji === emoji) delete reactions[resolvedActor.uid];
      else reactions[resolvedActor.uid] = { emoji, name: resolvedActor.name };
      return { reactions };
    });
    setReactionFor(null);
    focusComposer();
  };
  const vote = async (message: ChatMessage, optionId: string) => {
    await updateMessage(message.id, (current, resolvedActor) => {
      const pollVotes = { ...current.pollVotes };
      const pollVoterNames = { ...current.pollVoterNames };
      const currentVote = pollVotes[resolvedActor.uid];
      if (current.allowMultipleVotes) {
        const selected = Array.isArray(currentVote)
          ? currentVote
          : typeof currentVote === 'string' && currentVote
            ? [currentVote]
            : [];
        const next = selected.includes(optionId)
          ? selected.filter((entry) => entry !== optionId)
          : [...selected, optionId];
        if (next.length) {
          pollVotes[resolvedActor.uid] = next;
          pollVoterNames[resolvedActor.uid] = resolvedActor.name;
        } else {
          delete pollVotes[resolvedActor.uid];
          delete pollVoterNames[resolvedActor.uid];
        }
      } else {
        const selected = Array.isArray(currentVote) ? currentVote[0] : currentVote;
        if (selected === optionId) {
          delete pollVotes[resolvedActor.uid];
          delete pollVoterNames[resolvedActor.uid];
        } else {
          pollVotes[resolvedActor.uid] = optionId;
          pollVoterNames[resolvedActor.uid] = resolvedActor.name;
        }
      }
      return { pollVotes, pollVoterNames };
    });
    focusComposer();
  };
  const addPollOption = async (message: ChatMessage) => {
    const text = newOption.trim();
    if (!text || (!message.allowGuestOptions && actor.role !== 'host')) return;
    await updateMessage(message.id, (current, resolvedActor) => ({
      pollOptions: [...(current.pollOptions || []), {
        id: crypto.randomUUID(),
        text: text.slice(0, 120),
        addedByUid: resolvedActor.uid,
        addedByName: resolvedActor.name,
      }].slice(0, 20),
      pollBumpedAt: eventTimestamp(),
    }));
    setNewOption('');
    setAddingOptionFor(null);
    focusComposer();
  };
  const togglePinned = async (message: ChatMessage) => {
    if (actor.role !== 'host' || locked || message.deleted) return;
    await updateMessage(message.id, (current, resolvedActor) => ({
      pinned: !current.pinned,
      pinnedAt: current.pinned ? 0 : eventTimestamp(),
      pinnedByName: current.pinned ? '' : resolvedActor.name,
    }));
    setMessageMenuFor(null);
    focusComposer();
  };
  const deleteMessage = async (message: ChatMessage) => {
    if (locked || message.deleted) return;
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    const resolvedActor = await resolveActor();
    if (resolvedActor.role !== 'host' && message.authorUid !== resolvedActor.uid) return;
    await updateMessage(message.id, () => ({
      text: '',
      pollQuestion: '',
      pollOptions: [],
      pollVotes: {},
      pollVoterNames: {},
      pollBumpedAt: 0,
      reactions: {},
      replyTo: null,
      edited: false,
      pinned: false,
      pinnedAt: 0,
      pinnedByName: '',
      deleted: true,
    }));
    setMessageMenuFor(null);
    if (editing?.id === message.id) {
      setEditing(null);
      setDraft('');
    }
    focusComposer();
  };
  const orderedMessages = messages
    .flatMap((message) => {
      const original = {
        ...message,
        _displayKey: message.id,
        _displayAt: message.createdAt,
        _pollRepeat: false,
      };
      return message.type === 'poll' && (message.pollBumpedAt || 0) > message.createdAt
        ? [
            original,
            {
              ...message,
              _displayKey: `${message.id}-poll-update-${message.pollBumpedAt}`,
              _displayAt: message.pollBumpedAt || message.updatedAt || message.createdAt,
              _pollRepeat: true,
            },
          ]
        : [original];
    })
    .sort((left, right) => left._displayAt - right._displayAt);
  const pinnedMessages = messages
    .filter((message) => message.pinned && !message.deleted)
    .sort((left, right) => (right.pinnedAt || right.createdAt) - (left.pinnedAt || left.createdAt));
  const visiblePinnedIndex = Math.min(pinnedIndex, Math.max(0, pinnedMessages.length - 1));
  const visiblePinnedMessage = pinnedMessages[visiblePinnedIndex];

  if (!visible) {
    return null;
  }

  return (
    <div className={`chat-float-layer ${actor.role}`}>
      <dialog open className="event-chat" aria-labelledby="event-chat-title">
        <div className="chat-top">
          <header className="chat-header">
            <div>
              <p className="eyebrow">{menu.title}</p>
              <h2 id="event-chat-title" className="font-display">Event chat</h2>
              <span>{locked ? 'Locked by host · conversation is read-only' : `${actor.role === 'host' ? 'Chatting as Host' : `Chatting as ${actor.name}`}`}</span>
            </div>
            <div className="chat-header-actions">
              {PUSH_NOTIFICATIONS_ENABLED && pushAvailable && (
                <button
                  type="button"
                  className={pushNotificationState === 'enabled' ? 'enabled' : ''}
                  onClick={onTogglePush}
                  disabled={pushNotificationBusy}
                  aria-label={pushNotificationState === 'enabled'
                    ? 'Mute notifications for this event'
                    : eventMuted ? 'Unmute notifications for this event' : 'Turn on notifications for this event'}
                  title={pushNotificationState === 'enabled'
                    ? 'Notifications on'
                    : eventMuted
                      ? 'Notifications muted for this event'
                    : pushNotificationState === 'blocked'
                      ? 'Notifications blocked in device settings'
                      : pushNotificationState === 'unsupported'
                        ? 'Notifications are not supported here'
                        : 'Notify me about new messages'}
                >
                  {pushNotificationState === 'enabled'
                    ? <BellRing size={18} />
                    : pushNotificationState === 'blocked' || eventMuted
                      ? <BellOff size={18} />
                      : <Bell size={18} />}
                </button>
              )}
              <button type="button" onClick={() => { rememberReadPosition(); onMinimize(); }} aria-label="Minimize chat"><Minus size={20} /></button>
            </div>
          </header>
          {visiblePinnedMessage && (
            <aside className="chat-pinned-banner" aria-label="Pinned messages">
              <button
                type="button"
                className="chat-pinned-jump"
                onClick={() => jumpToMessage(visiblePinnedMessage.id)}
                title="Jump to pinned message"
              >
                <Pin size={14} />
                <span>
                  <small>Pinned by {visiblePinnedMessage.pinnedByName || 'Host'}</small>
                  <strong>{visiblePinnedMessage.authorName}: {visiblePinnedMessage.type === 'poll' ? visiblePinnedMessage.pollQuestion : visiblePinnedMessage.text}</strong>
                </span>
              </button>
              {pinnedMessages.length > 1 && (
                <div className="chat-pinned-navigation">
                  <span>{visiblePinnedIndex + 1}/{pinnedMessages.length}</span>
                  <button type="button" aria-label="Previous pinned message" onClick={() => setPinnedIndex((current) => (current - 1 + pinnedMessages.length) % pinnedMessages.length)}><ChevronLeft size={15} /></button>
                  <button type="button" aria-label="Next pinned message" onClick={() => setPinnedIndex((current) => (current + 1) % pinnedMessages.length)}><ChevronRight size={15} /></button>
                </div>
              )}
            </aside>
          )}
        </div>
        <div ref={streamRef} className="chat-stream" aria-live="polite" onScroll={rememberReadPosition}>
          {messages.length === 0 && (
            <div className="chat-empty"><MessageCircle size={28} /><strong>No messages yet</strong><span>Start the conversation for this event.</span></div>
          )}
          {orderedMessages.map((message) => {
            const displayKey = message._displayKey;
            const mine = message.authorUid === actor.uid || (actor.role === 'host' && message.authorRole === 'host');
            const reactionEntries = Object.entries(message.reactions || {}).map(([uid, reaction]) => ({
              uid,
              emoji: typeof reaction === 'string' ? reaction : reaction.emoji,
              name: typeof reaction === 'string'
                ? messages.find((candidate) => candidate.authorUid === uid)?.authorName || 'Guest'
                : reaction.name,
            }));
            const reactionGroups = reactionEntries.reduce<Array<{ emoji: string; names: string[] }>>((groups, reaction) => {
              const existing = groups.find((group) => group.emoji === reaction.emoji);
              if (existing) existing.names.push(reaction.name);
              else groups.push({ emoji: reaction.emoji, names: [reaction.name] });
              return groups;
            }, []);
            const myReaction = message.reactions?.[actor.uid];
            const myReactionEmoji = typeof myReaction === 'string' ? myReaction : myReaction?.emoji;
            const voterCount = Object.keys(message.pollVotes || {}).length;
            const votersByOption = (message.pollOptions || []).map((option) => ({
              option,
              names: Object.entries(message.pollVotes || {})
                .filter(([, value]) => Array.isArray(value) ? value.includes(option.id) : value === option.id)
                .map(([uid]) => message.pollVoterNames?.[uid]
                  || messages.find((candidate) => candidate.authorUid === uid)?.authorName
                  || 'Guest'),
            }));
            const isLatestPollInstance = !message.pollBumpedAt || message._pollRepeat;
            return (
              <article
                key={displayKey}
                data-chat-message-id={message.id}
                ref={(node) => { messageRefs.current[message.id] = node; }}
                className={`chat-message ${mine ? 'mine' : ''} ${message.type === 'poll' ? 'poll-message' : ''} ${message._pollRepeat ? 'poll-repeat' : ''} ${message.pinned ? 'pinned' : ''} ${highlightedMessageId === message.id ? 'highlighted' : ''} ${message.deleted ? 'deleted' : ''}`}
                onPointerUp={(event) => {
                  if (event.button !== 0) return;
                  if ((event.target as HTMLElement).closest('button, input, textarea, label')) return;
                  setMessageMenuFor(messageMenuFor === displayKey ? null : displayKey);
                }}
              >
                <div className="chat-message-meta">
                  <strong>{message.authorName}</strong>
                  {message.authorRole === 'host' && <b>Host</b>}
                  {message.pinned && <b className="chat-pinned-badge"><Pin size={10} /> Pinned</b>}
                  <time>{new Date(message._displayAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                  {message.edited && <em>edited</em>}
                  {!message.deleted && !locked && <button type="button" className="chat-message-options" aria-label={`Options for ${message.authorName}'s message`} onClick={() => setMessageMenuFor(messageMenuFor === displayKey ? null : displayKey)}>•••</button>}
                </div>
                {messageMenuFor === displayKey && !locked && (
                  <div className="chat-message-menu">
                    {!message.deleted && <button type="button" onClick={() => { setReplyTo({ id: message.id, authorName: message.authorName, text: (message.type === 'poll' ? message.pollQuestion : message.text).slice(0, 300) }); setMessageMenuFor(null); focusComposer(); }}><Reply size={14} /> Reply</button>}
                    {mine && message.type === 'message' && !message.deleted && <button type="button" onClick={() => { setEditing(message); setDraft(message.text); setReplyTo(null); setMessageMenuFor(null); focusComposer(); }}><Pencil size={14} /> Edit</button>}
                    {actor.role === 'host' && !message.deleted && <button type="button" onClick={() => void togglePinned(message)}>{message.pinned ? <PinOff size={14} /> : <Pin size={14} />}{message.pinned ? 'Unpin message' : 'Pin message'}</button>}
                    {(mine || actor.role === 'host') && !message.deleted && <button type="button" className="danger" onClick={() => void deleteMessage(message)}><Trash2 size={14} /> Delete</button>}
                  </div>
                )}
                {message.replyTo && !message.deleted && (
                  <button type="button" className="chat-reply-context" onClick={() => jumpToMessage(message.replyTo!.id)} title="Jump to replied message"><strong>{message.replyTo.authorName}</strong><span>{message.replyTo.text}</span></button>
                )}
                {message.deleted ? <p className="chat-deleted-copy">Message deleted</p> : message.type === 'message' ? <p>{message.text}</p> : (
                  <div className="chat-poll">
                    {message._pollRepeat && <span className="chat-poll-update"><Sparkles size={12} /> Poll updated · new option added</span>}
                    <strong>{message.pollQuestion}</strong>
                    <span>{voterCount} voter{voterCount === 1 ? '' : 's'} · {message.allowMultipleVotes ? 'Choose any that apply' : 'Choose one'} · {message.allowGuestOptions ? 'Guests can add options' : 'Fixed options'}</span>
                    <div className="chat-poll-options">
                      {(message.pollOptions || []).map((option) => {
                        const votes = Object.values(message.pollVotes || {}).filter((value) => Array.isArray(value) ? value.includes(option.id) : value === option.id).length;
                        const myVotes = message.pollVotes?.[actor.uid];
                        const selected = Array.isArray(myVotes) ? myVotes.includes(option.id) : myVotes === option.id;
                        return (
                          <button key={option.id} type="button" disabled={locked} className={selected ? 'selected' : ''} onClick={() => void vote(message, option.id)}>
                            <span>{option.text}{option.addedByName !== 'Host' && <small>Added by {option.addedByName}</small>}</span>
                            <b>{votes}</b>
                          </button>
                        );
                      })}
                    </div>
                    <button type="button" className="chat-poll-voters-toggle" onClick={() => setPollVotersFor(pollVotersFor === displayKey ? null : displayKey)}><UsersRound size={13} /> {pollVotersFor === displayKey ? 'Hide voters' : 'Who voted'}</button>
                    {pollVotersFor === displayKey && (
                      <div className="chat-poll-voters">
                        {votersByOption.map(({ option, names }) => (
                          <div key={option.id}>
                            <strong>{option.text}</strong>
                            <span>{names.length ? names.join(', ') : 'No votes yet'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!locked && isLatestPollInstance && (message.allowGuestOptions || actor.role === 'host') && (
                      addingOptionFor === displayKey ? (
                        <div className="chat-add-option"><input value={newOption} onChange={(event) => setNewOption(event.target.value)} maxLength={120} placeholder="New poll option" autoFocus /><button type="button" onClick={() => void addPollOption(message)}>Add</button><button type="button" onClick={() => { setAddingOptionFor(null); setNewOption(''); }}>Cancel</button></div>
                      ) : <button type="button" className="chat-add-option-trigger" onClick={() => setAddingOptionFor(displayKey)}><Plus size={14} /> Add an option</button>
                    )}
                  </div>
                )}
                {!message.deleted && reactionGroups.length > 0 && (
                  <div className="chat-reaction-summary">
                    {reactionGroups.slice(0, 3).map(({ emoji, names }) => <button type="button" disabled={locked} className={myReactionEmoji === emoji ? 'selected' : ''} key={emoji} data-tooltip={`${names.join(', ')} reacted ${emoji}`} aria-label={`${names.join(', ')} reacted ${emoji}`} onClick={() => void react(message, emoji)}>{emoji} {names.length}</button>)}
                    {reactionGroups.length > 3 && <button type="button" className="chat-reaction-more" onClick={() => setReactionDetailsFor(reactionDetailsFor === displayKey ? null : displayKey)}>+{reactionGroups.length - 3}</button>}
                    {reactionDetailsFor === displayKey && (
                      <div className="chat-reaction-details">
                        {reactionEntries.map((reaction) => <span key={reaction.uid}><strong>{reaction.name}</strong><b>{reaction.emoji}</b></span>)}
                      </div>
                    )}
                  </div>
                )}
                {!locked && !message.deleted && (
                  <div className="chat-message-actions">
                    <button type="button" onClick={() => { setReplyTo({ id: message.id, authorName: message.authorName, text: (message.type === 'poll' ? message.pollQuestion : message.text).slice(0, 300) }); focusComposer(); }}><Reply size={13} /> Reply</button>
                    {mine && message.type === 'message' && <button type="button" onClick={() => { setEditing(message); setDraft(message.text); setReplyTo(null); focusComposer(); }}><Pencil size={13} /> Edit</button>}
                    <button type="button" onClick={() => setReactionFor(reactionFor === displayKey ? null : displayKey)}><Smile size={13} /> React</button>
                    {reactionFor === displayKey && <div className="chat-reaction-picker full-emoji-picker"><EmojiPicker theme={Theme.DARK} emojiStyle={EmojiStyle.NATIVE} width="100%" height={330} autoFocusSearch={false} lazyLoadEmojis previewConfig={{ showPreview: false }} onEmojiClick={(emojiData) => { void react(message, emojiData.emoji); focusComposer(); }} /></div>}
                  </div>
                )}
              </article>
            );
          })}
          <div ref={endRef} />
        </div>
        {pollOpen && actor.role === 'host' && !locked && (
          <section className="chat-poll-composer">
            <div><strong>Create a poll</strong><button type="button" onClick={() => setPollOpen(false)}><XCircle size={18} /></button></div>
            <input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} maxLength={300} placeholder="What should everyone vote on?" />
            {pollOptions.map((option, index) => <div key={index}><input value={option} onChange={(event) => setPollOptions((current) => current.map((value, optionIndex) => optionIndex === index ? event.target.value : value))} maxLength={120} placeholder={`Option ${index + 1}`} />{pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}><XCircle size={16} /></button>}</div>)}
            {pollOptions.length < 12 && <button type="button" className="chat-add-option-trigger" onClick={() => setPollOptions((current) => [...current, ''])}><Plus size={14} /> Add option</button>}
            <label><input type="checkbox" checked={allowGuestOptions} onChange={(event) => setAllowGuestOptions(event.target.checked)} /> Let guests add poll options</label>
            <label><input type="checkbox" checked={allowMultipleVotes} onChange={(event) => setAllowMultipleVotes(event.target.checked)} /> Guests can select multiple choices</label>
            <button type="button" className="primary-button" disabled={busy || !pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2} onClick={() => void createPoll()}>Publish poll</button>
          </section>
        )}
        {locked ? <div className="chat-locked"><LockKeyhole size={16} /> The host has locked this chat.</div> : (
          <footer className="chat-composer">
            {(replyTo || editing) && <div className="chat-composer-context"><span>{editing ? 'Editing your message' : <>Replying to <strong>{replyTo?.authorName}</strong></>}</span><button type="button" onClick={() => { setReplyTo(null); setEditing(null); setDraft(''); focusComposer(); }}><XCircle size={16} /></button></div>}
            <div className={`chat-composer-row ${actor.role}`}>
              <button type="button" className="chat-tool-button" onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Add emoji"><Smile size={19} /></button>
              {actor.role === 'host' && <button type="button" className="chat-tool-button" onClick={() => setPollOpen(!pollOpen)} aria-label="Create poll"><ListChecks size={19} /></button>}
              <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={1} placeholder={editing ? 'Edit message' : 'Message everyone going…'} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
              <button type="button" className="chat-send" disabled={busy || !draft.trim()} onClick={() => void sendMessage()} aria-label="Send message"><Send size={18} /></button>
            </div>
            {emojiOpen && <div className="chat-emoji-picker full-emoji-picker"><EmojiPicker theme={Theme.DARK} emojiStyle={EmojiStyle.NATIVE} width="100%" height={350} autoFocusSearch={false} lazyLoadEmojis previewConfig={{ showPreview: false }} onEmojiClick={(emojiData) => { setDraft((current) => `${current}${emojiData.emoji}`); setEmojiOpen(false); focusComposer(); }} /></div>}
          </footer>
        )}
      </dialog>
    </div>
  );
}

function HostWorkspace({
  events,
  menu,
  orders,
  rsvps,
  contacts,
  invitations,
  eventIncomingCounts,
  editing,
  setEditing,
  setMenu,
  selectEvent,
  onPreview,
  setCreatingEvent,
  setDeletingEvent,
  saveMenu,
  cancelMenuEdits,
  uploadItemImage,
  uploadEventBackground,
  adjustEventBackground,
  acceptTasks,
  rejectOrder,
  rejectWaitingItems,
  clearOrderHistory,
  deleteGuest,
  setGuestApproval,
  finishTask,
  serveTask,
  setAccepting,
  setRsvpOpen,
  setChatOpen,
  inviteGuest,
  revokeInvitation,
  notify,
}: {
  events: EventMenu[];
  menu: EventMenu;
  orders: Order[];
  rsvps: Rsvp[];
  contacts: HostContact[];
  invitations: EventInvitation[];
  eventIncomingCounts: Record<string, number>;
  editing: boolean;
  setEditing: (value: boolean) => void;
  setMenu: (menu: EventMenu) => void;
  selectEvent: (event: EventMenu) => void;
  onPreview: () => void;
  setCreatingEvent: (value: boolean) => void;
  setDeletingEvent: (event: EventMenu | null) => void;
  saveMenu: () => Promise<void>;
  cancelMenuEdits: () => Promise<void>;
  uploadItemImage: (itemId: string, file: File) => Promise<void>;
  uploadEventBackground: (file: File) => Promise<void>;
  adjustEventBackground: () => void;
  acceptTasks: (taskRefs: OrderTaskRef[]) => Promise<void>;
  rejectOrder: (order: Order) => Promise<void>;
  rejectWaitingItems: (order: Order, itemId: string) => Promise<void>;
  clearOrderHistory: () => Promise<void>;
  deleteGuest: (rsvp: Rsvp) => Promise<void>;
  setGuestApproval: (rsvp: Rsvp, status: 'approved' | 'declined') => Promise<void>;
  finishTask: (orderId: string, taskId: string) => Promise<void>;
  serveTask: (orderId: string, taskId: string) => Promise<void>;
  setAccepting: (accepting: boolean) => Promise<void>;
  setRsvpOpen: (rsvpOpen: boolean) => Promise<void>;
  setChatOpen: (chatOpen: boolean) => Promise<void>;
  inviteGuest: (event: EventMenu, identifier: string, optionalName?: string) => Promise<boolean>;
  revokeInvitation: (event: EventMenu, invitation: EventInvitation) => Promise<boolean>;
  notify: (message: string) => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState('');
  const eventInvitations = invitations.filter((invitation) => invitation.eventId === menu.id);
  const activeOrders = orders.filter(
    (order) => order.status === 'new' || order.status === 'preparing',
  ).length;
  return (
    <div className="host-workspace">
      <div className="host-inner">
        <header className="host-page-heading">
          <div>
            <p className="eyebrow">Nights Host</p>
            <h1 className="font-display">The pass</h1>
            <p>Your live command center for every table.</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem(CREATE_EVENT_RETURN_ROUTE_KEY);
              setCreatingEvent(true);
            }}
            className="host-new-event"
          >
            <CalendarPlus size={17} /> New event
          </button>
        </header>
        {events.length === 0 ? (
          <section className="host-empty">
            <span>
              <CalendarPlus size={26} />
            </span>
            <h2 className="font-display">Set your first table</h2>
            <p>
              Add the date and dishes once, then share the guest link. Orders
              arrive here automatically.
            </p>
          </section>
        ) : (
          <>
            <div className="event-switcher" aria-label="Choose an event">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => selectEvent(event)}
                  className={`event-switcher-card ${event.id === menu.id ? 'active' : ''}`}
                  aria-current={event.id === menu.id ? 'true' : undefined}
                >
                  <strong className="font-display">{event.title}</strong>
                  <small>
                    {eventIncomingCounts[event.id]
                      ? `${eventIncomingCounts[event.id]} incoming · `
                      : ''}
                    {event.date}
                  </small>
                </button>
              ))}
            </div>
            <section className="host-command-card">
              <div className="host-command-main">
                <p className="host-label">Now serving</p>
                <h2 className="font-display">{menu.title}</h2>
                <div className="host-command-meta">
                  <span>
                    <Clock3 size={14} />
                    {menu.date}
                  </span>
                  <span>
                    {activeOrders} active order{activeOrders === 1 ? '' : 's'}
                  </span>
                    <span>Link · /{automaticPublicEventPath(menu) || menu.id}</span>
                </div>
              </div>
              <div className="event-gates">
                <div className={`order-gate ${menu.accepting ? 'open' : 'closed'}`}>
                  <div>
                    <span className="order-gate-light" />
                    <p>{menu.accepting ? 'Guest ordering is live' : 'Guest ordering is paused'}</p>
                    <small>{menu.accepting ? 'New orders appear instantly.' : 'Existing tickets stay active.'}</small>
                  </div>
                  <button onClick={() => void setAccepting(!menu.accepting)}>
                    {menu.accepting ? <><XCircle size={17} /> Stop orders</> : <><Sparkles size={17} /> Open orders</>}
                  </button>
                </div>
                <div className={`order-gate rsvp-gate ${menu.rsvpOpen === false ? 'closed' : 'open'}`}>
                  <div>
                    <span className="order-gate-light" />
                    <p>{menu.rsvpOpen === false ? 'RSVPs are locked' : 'RSVPs are open'}</p>
                    <small>{menu.rsvpOpen === false ? 'Saved responses stay visible.' : 'Guests can respond or update.'}</small>
                  </div>
                  <button onClick={() => void setRsvpOpen(menu.rsvpOpen === false)}>
                    {menu.rsvpOpen === false ? <><UsersRound size={17} /> Open RSVPs</> : <><XCircle size={17} /> Lock RSVPs</>}
                  </button>
                </div>
                <div className={`order-gate chat-gate ${menu.chatOpen === false ? 'closed' : 'open'}`}>
                  <div>
                    <span className="order-gate-light" />
                    <p>{menu.chatOpen === false ? 'Event chat is locked' : 'Event chat is open'}</p>
                    <small>{menu.chatOpen === false ? 'Conversation history stays visible.' : 'Going guests can message and vote.'}</small>
                  </div>
                  <button onClick={() => void setChatOpen(menu.chatOpen === false)}>
                    {menu.chatOpen === false ? <><MessageCircle size={17} /> Open chat</> : <><LockKeyhole size={17} /> Lock chat</>}
                  </button>
                </div>
              </div>
              <div className="host-actions">
                <button type="button" onClick={onPreview}>
                  <ExternalLink size={16} />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="invite"
                >
                  <UserPlus size={16} />
                  <span>Invite</span>
                </button>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(
                      guestEventUrl(menu.id, automaticPublicEventPath(menu)),
                    );
                    notify('Guest link copied');
                  }}
                >
                  <Copy size={16} />
                  <span>Copy link</span>
                </button>
                <button
                  onClick={() =>
                    editing ? void cancelMenuEdits() : setEditing(true)
                  }
                  className="edit"
                >
                  <Settings2 size={16} />
                  <span>{editing ? 'Orders' : 'Edit menu'}</span>
                </button>
                <button
                  onClick={() => setDeletingEvent(menu)}
                  className="delete"
                >
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              </div>
            </section>
            {editing ? (
              <MenuEditor
                menu={menu}
                orders={orders}
                setMenu={setMenu}
                saveMenu={saveMenu}
                cancelMenuEdits={cancelMenuEdits}
                uploadItemImage={uploadItemImage}
                uploadEventBackground={uploadEventBackground}
                adjustEventBackground={adjustEventBackground}
              />
            ) : (
              <>
                <header className="order-board-heading">
                  <div>
                    <p className="eyebrow">Live kitchen</p>
                    <h2 className="font-display">Production pipeline</h2>
                  </div>
                  <div className="live-sync">
                    <i /> Auto scheduling
                  </div>
                </header>
                <SchedulerBoard
                  orders={orders}
                  rsvps={rsvps}
                  menu={menu}
                  acceptTasks={acceptTasks}
                  rejectOrder={rejectOrder}
                  rejectWaitingItems={rejectWaitingItems}
                  clearOrderHistory={clearOrderHistory}
                  deleteGuest={deleteGuest}
                  setGuestApproval={setGuestApproval}
                  finishTask={finishTask}
                  serveTask={serveTask}
                />
              </>
            )}
          </>
        )}
      </div>
      {inviteOpen && createPortal(
        <div className="invite-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !inviteBusy) setInviteOpen(false);
        }}>
          <dialog open className="invite-dialog" aria-label={`Invite guests to ${menu.title}`}>
            <header>
              <div><p className="eyebrow">Invite to</p><h2 className="font-display">{menu.title}</h2></div>
              <button type="button" className="icon-button" onClick={() => setInviteOpen(false)} disabled={inviteBusy} aria-label="Close invitations"><XCircle size={20} /></button>
            </header>
            <p className="invite-dialog-copy">Invite a Nights member by email or phone. If the phone number is not registered yet, Nights will save their place and prepare a text message for you to send.</p>
            <div className="invite-entry-row">
              <div className="invite-entry-fields">
                <label>
                  <span>Email or phone number</span>
                  <input
                    value={inviteIdentifier}
                    onChange={(event) => setInviteIdentifier(event.target.value)}
                    placeholder="guest@example.com or 555-555-5555"
                    autoComplete="off"
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || !inviteIdentifier.trim() || inviteBusy) return;
                      event.preventDefault();
                      setInviteBusy(true);
                      void inviteGuest(menu, inviteIdentifier, inviteName).then((sent) => {
                        if (sent) { setInviteIdentifier(''); setInviteName(''); }
                      }).finally(() => setInviteBusy(false));
                    }}
                  />
                </label>
                <label>
                  <span>Guest name (optional)</span>
                  <input
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="Alex"
                    autoComplete="off"
                    maxLength={80}
                  />
                </label>
              </div>
              <button type="button" className="primary-button" disabled={inviteBusy || !inviteIdentifier.trim()} onClick={() => {
                setInviteBusy(true);
                void inviteGuest(menu, inviteIdentifier, inviteName).then((sent) => {
                  if (sent) { setInviteIdentifier(''); setInviteName(''); }
                }).finally(() => setInviteBusy(false));
              }}><Send size={16} /> {inviteBusy ? 'Sending…' : 'Send invite'}</button>
            </div>
            <section className="host-invitation-list">
              <div className="host-contact-list-heading"><Send size={17} /><div><strong>Invited guests</strong><span>Revoke an invitation and remove that guest’s event access</span></div></div>
              {eventInvitations.length ? (
                <div className="host-invitation-list-scroll">
                  {eventInvitations.map((invitation) => {
                    const label = invitation.recipientEmail || formatPhone(invitation.recipientPhone);
                    const isHostMembership = invitation.recipientUid === menu.ownerUid;
                    return (
                      <div key={`${invitation.recipientUid}:${invitation.eventId}`} className="host-invitation-row">
                        <span><strong>{invitation.recipientName || label}</strong><small>{invitation.pendingAccount ? `${label} · account not created yet` : formatPhone(invitation.recipientPhone)}</small></span>
                        {isHostMembership ? <b className="host-membership-label">Host</b> : <div className="host-invitation-actions">
                          {invitation.pendingAccount && <button type="button" className="send-link" onClick={() => {
                            void openManualInvitation(menu, invitation.recipientPhone, invitation.recipientName).then((delivery) => notify(
                              delivery === 'message' ? 'Review the message and tap Send.' : 'Invitation copied.',
                            )).catch(() => notify('Copy the event link and send it to this guest.'));
                          }}><Send size={13} /> Send</button>}
                          <button type="button" className="danger-link" disabled={Boolean(revokeBusy)} onClick={() => {
                            setRevokeBusy(invitation.recipientUid);
                            void revokeInvitation(menu, invitation).finally(() => setRevokeBusy(''));
                          }}>{revokeBusy === invitation.recipientUid ? 'Revoking…' : 'Revoke'}</button>
                        </div>}
                      </div>
                    );
                  })}
                </div>
              ) : <p className="host-contact-empty">No active invitations for this event.</p>}
            </section>
            <section className="host-contact-list">
              <div className="host-contact-list-heading"><BookUser size={17} /><div><strong>Contacts</strong><span>People you have invited before</span></div></div>
              {contacts.length ? (
                <div className="host-contact-list-scroll">
                  {contacts.map((contact) => {
                    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
                    const identifier = contact.email || formatPhone(contact.phone);
                    const invited = eventInvitations.some((invitation) => invitation.recipientUid === contact.accountUid);
                    return (
                      <button
                        type="button"
                        key={contact.accountUid}
                        className={invited ? 'invited' : ''}
                        disabled={invited}
                        onClick={() => setInviteIdentifier(identifier)}
                      >
                        <span className="host-contact-avatar">{name.slice(0, 1).toUpperCase()}</span>
                        <span><strong>{name}</strong><small>{contact.email}</small><small>{formatPhone(contact.phone)}</small></span>
                        <b>{invited ? <><Check size={13} /> Invited</> : 'Invite'}</b>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="host-contact-empty">Your contacts will appear here after the first invitation.</p>}
            </section>
          </dialog>
        </div>,
        document.body,
      )}
    </div>
  );
}

function RememberedOrderCard({
  orders,
  menu,
  onEdit,
  onCancel,
}: {
  orders: Order[];
  menu: EventMenu;
  onEdit: (order: Order) => void;
  onCancel: (order: Order) => void;
}) {
  const [activeOrderId, setActiveOrderId] = useState(orders[0]?.id || '');
  const [minimized, setMinimized] = useState(false);
  const order = orders.find((entry) => entry.id === activeOrderId) || orders[0];
  const acknowledgementKey = `gather-ready-ack:${order?.id || ''}`;
  const [acknowledgedTasks, setAcknowledgedTasks] = useState<string[]>([]);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setAcknowledgedTasks(
          JSON.parse(
            localStorage.getItem(acknowledgementKey) || '[]',
          ) as string[],
        );
      } catch {
        setAcknowledgedTasks([]);
      }
    });
  }, [acknowledgementKey]);
  if (!order) return null;
  const editable = order.status === 'new';
  const statusLabel: Record<OrderStatus, string> = {
    new: 'Received',
    preparing: 'Preparing',
    served: 'Served',
    cancelled: 'Cancelled',
    rejected: 'Not accepted',
  };
  const readyTasks = (order.tasks || []).filter(
    (task) =>
      (task.status === 'ready' || task.status === 'served') &&
      !acknowledgedTasks.includes(task.id),
  );
  const progressTasks =
    order.tasks?.length
      ? order.tasks
      : Object.entries(order.selections)
          .filter(([, quantity]) => quantity > 0)
          .flatMap(([itemId, quantity]) =>
            Array.from({ length: quantity }, (_, index) => ({
              id: `${itemId}-${index}`,
              itemId,
              status:
                order.status === 'cancelled' || order.status === 'rejected'
                  ? ('served' as TaskStatus)
                  : ('waiting' as TaskStatus),
            })),
          );
  const acknowledgeReady = () => {
    const next = [
      ...new Set([...acknowledgedTasks, ...readyTasks.map((task) => task.id)]),
    ];
    setAcknowledgedTasks(next);
    localStorage.setItem(acknowledgementKey, JSON.stringify(next));
  };
  const orderTabLabel = (entry: Order) => {
    const name = entry.guestName || 'Guest';
    const identity = entry.guestUid || guestNameKey(name);
    const guestOrders = orders
      .filter((candidate) =>
        (candidate.guestUid || guestNameKey(candidate.guestName || 'Guest')) === identity,
      )
      .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
    if (guestOrders.length < 2) return name;
    return `${name} #${guestOrders.findIndex((candidate) => candidate.id === entry.id) + 1}`;
  };
  if (minimized) {
    return (
      <button
        className="remembered-order-minimized"
        onClick={() => setMinimized(false)}
        aria-label="Show your order summary"
      >
        <ShoppingBag size={20} />
      </button>
    );
  }
  return (
    <aside
      className={`remembered-order ${readyTasks.length ? 'has-ready-items' : ''}`}
      aria-label="Your saved order"
    >
      {orders.length > 1 && (
        <nav className="guest-order-tabs" aria-label="Your orders">
          <span>{orders.length} orders on this device</span>
          <div>
            {orders.map((entry) => (
              <button
                key={entry.id}
                className={entry.id === order.id ? 'active' : ''}
                onClick={() => setActiveOrderId(entry.id)}
              >
                <span>{orderTabLabel(entry)}</span>
                <small suppressHydrationWarning>
                  {new Date(entry.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </small>
              </button>
            ))}
          </div>
        </nav>
      )}
      <button
        className="minimize-order-button"
        onClick={() => setMinimized(true)}
        aria-label="Minimize your order summary"
        title="Minimize"
      >
        <XCircle size={18} />
      </button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {readyTasks.length ? 'Ready for you' : 'Welcome back'}
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold">
            {readyTasks.length ? 'Come and get it' : 'Your order'}
          </h2>
        </div>
        <span
          className={`status-pill ${readyTasks.length ? 'status-ready' : `status-${order.status}`}`}
        >
          {readyTasks.length ? 'Ready' : statusLabel[order.status]}
        </span>
      </div>
      {readyTasks.length > 0 && (
        <div className="guest-ready-message">
          <strong>
            {readyTasks.length === 1
              ? 'Your item is ready'
              : `${readyTasks.length} items are ready`}
          </strong>
          <ul>
            {readyTasks.map((task) => (
              <li key={task.id}>
                {menu.items.find((item) => item.id === task.itemId)?.name ||
                  'Menu item'}
              </li>
            ))}
          </ul>
          <button onClick={acknowledgeReady}>
            <Check size={15} /> OK
          </button>
        </div>
      )}
      <section className="guest-order-progress" aria-label="Order item status">
        <div>
          <strong>Your items</strong>
          <span>{progressTasks.length} item{progressTasks.length === 1 ? '' : 's'}</span>
        </div>
        <ul>
          {progressTasks.map((task, index) => {
            const label: Record<TaskStatus, string> = {
              waiting: 'Queued',
              preparing: 'Cooking',
              ready: 'Ready',
              served: 'Served',
              rejected: 'Not accepted',
            };
            return (
              <li key={task.id} className={`item-status-${task.status}`}>
                <span>
                  {menu.items.find((item) => item.id === task.itemId)?.name ||
                    'Menu item'}
                  {progressTasks.filter((entry) => entry.itemId === task.itemId)
                    .length > 1 && ` · ${index + 1}`}
                </span>
                <b>{order.status === 'cancelled' ? 'Cancelled' : order.status === 'rejected' ? 'Not accepted' : label[task.status]}</b>
              </li>
            );
          })}
        </ul>
      </section>
      {order.note && (
        <p className="mt-3 text-xs italic text-black/50">“{order.note}”</p>
      )}
      {order.updatedAt && order.updatedAt > order.createdAt && (
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-black/35">
          Updated{' '}
          {new Date(order.updatedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      )}
      {editable ? (
        <div className="mt-5 flex gap-2">
          <button onClick={() => onEdit(order)} className="secondary-button">
            <Pencil size={14} /> Edit
          </button>
          <button onClick={() => onCancel(order)} className="cancel-link">
            <XCircle size={14} /> Cancel
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-black/45">
          {order.status === 'cancelled' || order.status === 'rejected'
            ? order.status === 'rejected' ? 'This order was not accepted.' : 'This order has been cancelled.'
            : 'Your host is working through your items. We’ll tell you as each one is ready.'}
        </p>
      )}
    </aside>
  );
}

function SchedulerBoard({
  orders,
  rsvps,
  menu,
  acceptTasks,
  rejectOrder,
  rejectWaitingItems,
  clearOrderHistory,
  deleteGuest,
  setGuestApproval,
  finishTask,
  serveTask,
}: {
  orders: Order[];
  rsvps: Rsvp[];
  menu: EventMenu;
  acceptTasks: (taskRefs: OrderTaskRef[]) => Promise<void>;
  rejectOrder: (order: Order) => Promise<void>;
  rejectWaitingItems: (order: Order, itemId: string) => Promise<void>;
  clearOrderHistory: () => Promise<void>;
  deleteGuest: (rsvp: Rsvp) => Promise<void>;
  setGuestApproval: (rsvp: Rsvp, status: 'approved' | 'declined') => Promise<void>;
  finishTask: (orderId: string, taskId: string) => Promise<void>;
  serveTask: (orderId: string, taskId: string) => Promise<void>;
}) {
  const [now, setNow] = useState(0);
  const [guestListOpen, setGuestListOpen] = useState(false);
  const [guestListNotice, setGuestListNotice] = useState('');
  useEffect(() => {
    queueMicrotask(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const usage = resourceUsage(orders, menu);
  const queuePlan = planResourceQueue(orders, menu);
  const sortedRsvps = [...rsvps].sort((left, right) => {
    if (menu.requireGuestApproval) {
      const accessOrder = { pending: 0, approved: 1, declined: 2 };
      const leftAccess = left.status === 'yes' ? accessOrder[approvalStatus(left)] : 3;
      const rightAccess = right.status === 'yes' ? accessOrder[approvalStatus(right)] : 3;
      const accessDifference = leftAccess - rightAccess;
      if (accessDifference) return accessDifference;
    }
    const statusOrder = { yes: 0, maybe: 1, no: 2 };
    return statusOrder[left.status] - statusOrder[right.status]
      || left.guestName.localeCompare(right.guestName);
  });
  const partySize = (rsvp: Rsvp) =>
    rsvp.status === 'no' ? 0 : 1 + (rsvp.companions?.length || 0);
  const attendingCount = sortedRsvps
    .filter((rsvp) => rsvp.status === 'yes' && guestIsApproved(menu, rsvp))
    .reduce((total, rsvp) => total + partySize(rsvp), 0);
  const pendingApprovalCount = menu.requireGuestApproval
    ? sortedRsvps.filter((rsvp) => rsvp.status === 'yes' && approvalStatus(rsvp) === 'pending').length
    : 0;
  const rsvpAccessLabel = (rsvp: Rsvp) =>
    menu.requireGuestApproval && rsvp.status === 'yes'
      ? approvalStatus(rsvp)
      : 'Not required';
  const downloadGuestFile = (content: string, extension: 'csv' | 'vcf', type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${menu.id}-guest-list.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setGuestListNotice(extension === 'csv' ? 'Guest CSV downloaded' : 'Contact file downloaded');
  };
  const downloadGuestCsv = () => {
    const escapeCell = (value: string | number) => {
      const raw = String(value);
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = sortedRsvps.flatMap((rsvp) => {
      const response = rsvp.status === 'yes' ? 'Going' : rsvp.status === 'maybe' ? 'Maybe' : 'Not going';
      return [
        [rsvp.guestName, formatPhone(rsvp.guestPhone), 'Primary guest', '', response, rsvpAccessLabel(rsvp), partySize(rsvp), rsvp.activeOrderCount || 0],
        ...(rsvp.companions || []).map((companion) => [
          companionName(companion),
          companionPhone(companion),
          'Additional guest',
          rsvp.guestName,
          response,
          rsvpAccessLabel(rsvp),
          '',
          '',
        ]),
      ];
    });
    downloadGuestFile([
      ['Name', 'Phone', 'Guest type', 'Invited by', 'RSVP', 'Access', 'Party size', 'Active orders'].map(escapeCell).join(','),
      ...rows.map((row) => row.map(escapeCell).join(',')),
    ].join('\n'), 'csv', 'text/csv;charset=utf-8');
  };
  const downloadGuestContacts = () => downloadGuestFile(sortedRsvps.flatMap((rsvp) => {
    const response = rsvp.status === 'yes' ? 'Going' : rsvp.status === 'maybe' ? 'Maybe' : 'Not going';
    const card = (name: string, phone: string, note: string) => [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${name.replaceAll('\n', ' ')}`,
      ...(phone ? [`TEL;TYPE=CELL:${formatPhone(phone)}`] : []),
      `NOTE:${note}`,
      'END:VCARD',
    ].join('\n');
    return [
      card(rsvp.guestName, rsvp.guestPhone, `${menu.title} — ${response} — Primary guest`),
      ...(rsvp.companions || []).map((companion) => card(
        companionName(companion),
        companionPhone(companion),
        `${menu.title} — ${response} — Invited by ${rsvp.guestName}`,
      )),
    ];
  }).join('\n'), 'vcf', 'text/vcard;charset=utf-8');
  const copyGuestPhones = async () => {
    const phones = sortedRsvps.flatMap((rsvp) => [
      formatPhone(rsvp.guestPhone),
      ...(rsvp.companions || []).map(companionPhone).filter(Boolean),
    ]);
    await navigator.clipboard.writeText(phones.join(', '));
    setGuestListNotice('Phone numbers copied');
  };
  const queuedTaskViews = orders
    .filter((order) => order.status === 'new' || order.status === 'preparing')
    .flatMap((order) => {
      const tasks = order.tasks?.length ? order.tasks : createOrderTasks(order);
      return tasks
        .filter((task) => task.status === 'waiting')
        .map((task) => ({
          order,
          task,
          item: menu.items.find((item) => item.id === task.itemId),
          pending: order.status === 'new',
        }));
    })
    .sort((left, right) =>
      left.order.createdAt - right.order.createdAt ||
      left.task.sequence - right.task.sequence,
    );
  const incomingTaskViews = queuedTaskViews.filter((view) =>
    queuePlan.availableTaskIds.has(view.task.id),
  );
  const waitingTaskViews = queuedTaskViews.filter((view) =>
    !queuePlan.availableTaskIds.has(view.task.id),
  );
  const incomingTickets = Object.values(
    incomingTaskViews.reduce<
      Record<
        string,
        {
          guestName: string;
          orders: Order[];
          taskRefs: OrderTaskRef[];
          selections: Record<string, number>;
          createdAt: number;
          notes: string[];
        }
      >
    >((groups, view) => {
      const { order, task } = view;
      const key = order.guestUid || guestNameKey(order.guestName) || 'unnamed guest';
      const ticket = groups[key] || {
        guestName: guestDisplayName(order),
        orders: [],
        taskRefs: [],
        selections: {},
        createdAt: order.createdAt,
        notes: [],
      };
      if (!ticket.orders.some((entry) => entry.id === order.id)) ticket.orders.push(order);
      ticket.taskRefs.push({ orderId: order.id, taskId: task.id });
      ticket.createdAt = Math.min(ticket.createdAt, order.createdAt);
      if (order.note && !ticket.notes.includes(order.note)) ticket.notes.push(order.note);
      ticket.selections[task.itemId] = (ticket.selections[task.itemId] || 0) + 1;
      groups[key] = ticket;
      return groups;
    }, {}),
  ).sort((left, right) => left.createdAt - right.createdAt);
  const activeTaskViews = orders.flatMap((order) =>
    (order.tasks || [])
      .filter((task) => task.status !== 'waiting')
      .map((task) => ({
        order,
        task,
        item: menu.items.find((item) => item.id === task.itemId),
        pending: false,
      })),
  );
  const taskViews = [...activeTaskViews, ...waitingTaskViews];
  const waitingGroups = Object.values(
    waitingTaskViews.reduce<
      Record<string, {
        order: Order;
        item?: MenuItem;
        tasks: OrderTask[];
        pending: boolean;
      }>
    >((groups, view) => {
      const key = `${view.order.id}:${view.task.itemId}`;
      const group = groups[key] || {
        order: view.order,
        item: view.item,
        tasks: [],
        pending: view.pending,
      };
      group.tasks.push(view.task);
      groups[key] = group;
      return groups;
    }, {}),
  ).sort((left, right) =>
    left.order.createdAt - right.order.createdAt ||
    left.tasks[0].sequence - right.tasks[0].sequence,
  );
  const orderHistory = [...orders].sort(
    (left, right) => right.createdAt - left.createdAt,
  );
  const guestHistory = Object.values(
    orderHistory.reduce<
      Record<
        string,
        {
          guestName: string;
          orders: Order[];
          selections: Record<string, number>;
          latestAt: number;
        }
      >
    >((groups, order) => {
      const key = order.guestUid || guestDisplayName(order).trim().toLowerCase() || 'unnamed guest';
      const group = groups[key] || {
        guestName: guestDisplayName(order),
        orders: [],
        selections: {},
        latestAt: order.createdAt,
      };
      group.orders.push(order);
      group.latestAt = Math.max(group.latestAt, order.createdAt);
      Object.entries(order.selections).forEach(([itemId, quantity]) => {
        group.selections[itemId] = (group.selections[itemId] || 0) + quantity;
      });
      groups[key] = group;
      return groups;
    }, {}),
  ).sort((left, right) => right.latestAt - left.latestAt);
  const productionTotals = orderHistory
    .filter((order) => order.status === 'preparing' || order.status === 'served')
    .flatMap((order) => Object.entries(order.selections))
    .filter(([, quantity]) => quantity > 0)
    .reduce<Record<string, number>>((totals, [itemId, quantity]) => {
      totals[itemId] = (totals[itemId] || 0) + quantity;
      return totals;
    }, {});
  const lanes: {
    status: TaskStatus;
    label: string;
    hint: string;
    icon: typeof Flame;
  }[] = [
    {
      status: 'preparing',
      label: 'In progress',
      hint: 'Accepted · actively preparing',
      icon: Flame,
    },
    {
      status: 'waiting',
      label: 'Waiting',
      hint: 'Resources unavailable · first come, first served',
      icon: Clock3,
    },
    {
      status: 'ready',
      label: 'Ready',
      hint: 'Serve whenever you like',
      icon: Sparkles,
    },
  ];
  const sortedTasks = (status: TaskStatus) =>
    taskViews
      .filter((view) => view.task.status === status)
      .sort((a, b) =>
        status === 'preparing'
          ? (a.task.estimatedReadyAt || Infinity) -
              (b.task.estimatedReadyAt || Infinity) ||
            a.order.createdAt - b.order.createdAt
          : a.order.createdAt - b.order.createdAt ||
            a.task.sequence - b.task.sequence,
      );
  const resourcesFor = (item?: MenuItem) =>
    Object.entries(item?.requirements || {})
      .filter(([, units]) => units > 0)
      .map(([resourceId, units]) => ({
        resource: menu.resources?.find((entry) => entry.id === resourceId),
        units,
      }));
  const waitReason = (item?: MenuItem) => {
    const needed = resourcesFor(item);
    const impossible = needed.filter(
      ({ resource, units }) => !resource || units > resource.capacity,
    );
    if (impossible.length)
      return `Needs more ${impossible.map(({ resource, units }) => `${resource?.name || 'resource capacity'} (${units} needed, ${resource?.capacity || 0} available)`).join(' + ')}`;
    const blocked = needed.filter(
      ({ resource, units }) =>
        !resource || resource.capacity - (usage[resource.id] || 0) < units,
    );
    return blocked.length
      ? `Waiting for ${blocked.map(({ resource }) => resource?.name || 'a removed resource').join(' + ')}`
      : 'Waiting behind an earlier order';
  };
  const guestAccessControls = (rsvp: Rsvp) => {
    if (!menu.requireGuestApproval || rsvp.status !== 'yes') return null;
    const status = approvalStatus(rsvp);
    return (
      <div className="guest-approval-controls">
        <span className={`approval-badge ${status}`}>{status === 'pending' ? 'Awaiting review' : status === 'approved' ? 'Approved' : 'Declined'}</span>
        {status !== 'approved' && <button type="button" className="approve" onClick={() => void setGuestApproval(rsvp, 'approved')}><Check size={13} /> Accept</button>}
        {status !== 'declined' && <button type="button" className="decline" onClick={() => void setGuestApproval(rsvp, 'declined')}><XCircle size={13} /> Decline</button>}
      </div>
    );
  };
  return (
    <div className="scheduler-shell">
      <section className="resource-rack">
        <header>
          <div>
            <p className="scheduler-label">Guest list</p>
            <h3 className="font-display">RSVPs</h3>
          </div>
          <div className="rsvp-header-actions">
            <span>{pendingApprovalCount ? `${pendingApprovalCount} awaiting approval · ` : ''}{attendingCount} approved attending · {rsvps.filter((rsvp) => rsvp.status === 'yes').length} going RSVPs · {rsvps.filter((rsvp) => rsvp.status === 'maybe').length} maybe · {rsvps.filter((rsvp) => rsvp.status === 'no').length} not going</span>
            <button type="button" onClick={() => setGuestListOpen(true)} disabled={!rsvps.length}><ListChecks size={15} /> Open guest list</button>
          </div>
        </header>
        {rsvps.length ? (
          <div className="resource-meter-grid rsvp-card-strip">
            {sortedRsvps.map((rsvp) => (
              <article key={rsvp.guestUid} className="rsvp-ticket">
                <div className="rsvp-ticket-copy">
                  <div className="rsvp-ticket-title">
                    <strong>{rsvp.guestName}</strong>
                    <button className="rsvp-delete" type="button" onClick={() => void deleteGuest(rsvp)} aria-label={`Delete ${rsvp.guestName}`} title="Delete test guest"><Trash2 size={14} /></button>
                  </div>
                  <span className="rsvp-ticket-meta">{formatPhone(rsvp.guestPhone)} · {rsvp.status === 'yes' ? 'Going' : rsvp.status === 'maybe' ? 'Maybe' : 'Not going'} · party of {partySize(rsvp)}</span>
                  {rsvp.companions?.length ? <small>Bringing: {rsvp.companions.map(companionName).join(', ')}</small> : null}
                </div>
                {guestAccessControls(rsvp)}
              </article>
            ))}
          </div>
        ) : <p className="resource-empty-note">Guests appear here as soon as they RSVP.</p>}
      </section>
      {guestListOpen && (
        <div className="guest-list-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setGuestListOpen(false);
        }}>
          <dialog open className="guest-list-dialog" aria-labelledby="guest-list-title">
            <header>
              <div><p className="scheduler-label">{menu.title}</p><h3 id="guest-list-title" className="font-display">Guest list</h3></div>
              <button type="button" className="guest-list-close" onClick={() => setGuestListOpen(false)} aria-label="Close guest list"><XCircle size={22} /></button>
            </header>
            <div className="guest-list-toolbar">
              <button type="button" onClick={downloadGuestCsv}><Download size={15} /> Download CSV</button>
              <button type="button" onClick={downloadGuestContacts}><UsersRound size={15} /> Download contacts</button>
              <button type="button" onClick={() => void copyGuestPhones()}><Copy size={15} /> Copy numbers</button>
            </div>
            {guestListNotice && <output className="guest-list-notice">{guestListNotice}</output>}
            <div className="guest-list-scroll">
              {sortedRsvps.map((rsvp) => (
                <article key={rsvp.guestUid}>
                  <div className="guest-list-copy">
                    <div className="rsvp-ticket-title">
                      <strong>{rsvp.guestName}</strong>
                      <button className="rsvp-delete" type="button" onClick={() => void deleteGuest(rsvp)} aria-label={`Delete ${rsvp.guestName}`} title="Delete test guest"><Trash2 size={14} /></button>
                    </div>
                    <a href={`tel:${phoneDigits(rsvp.guestPhone)}`}>{formatPhone(rsvp.guestPhone)}</a>
                    {rsvp.companions?.length ? (
                      <details className="guest-companion-details">
                        <summary>Bringing: {rsvp.companions.map(companionName).join(', ')}</summary>
                        <div>
                          {rsvp.companions.map((companion, index) => {
                            const phone = companionPhone(companion);
                            return (
                              <div key={`${companionName(companion)}-${index}`}>
                                <strong>{companionName(companion)}</strong>
                                {phone ? <a href={`tel:${phoneDigits(phone)}`}>{formatPhone(phone)}</a> : <span>No phone provided</span>}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    ) : null}
                  </div>
                  <div className="rsvp-card-actions">{guestAccessControls(rsvp)}<span className={`host-rsvp-badge rsvp-${rsvp.status}`}>{rsvp.status === 'yes' ? 'Going' : rsvp.status === 'maybe' ? 'Maybe' : 'Not going'} · party of {partySize(rsvp)}</span></div>
                </article>
              ))}
            </div>
          </dialog>
        </div>
      )}
      <section className="resource-rack">
        <header>
          <div>
            <p className="scheduler-label">Live capacity</p>
            <h3 className="font-display">Your resources</h3>
          </div>
          <span>
            {(menu.resources || []).reduce(
              (sum, resource) => sum + resource.capacity,
              0,
            )}{' '}
            total slots
          </span>
        </header>
        {(menu.resources || []).length ? (
          <div className="resource-meter-grid">
            {menu.resources!.map((resource) => {
              const used = usage[resource.id] || 0;
              return (
                <article
                  key={resource.id}
                  className={used >= resource.capacity ? 'full' : ''}
                >
                  <div>
                    <strong>{resource.name}</strong>
                    <span>
                      {resource.capacity} total · {Math.max(0, resource.capacity - used)} free
                    </span>
                  </div>
                  <div
                    className="capacity-dots"
                    aria-label={`${resource.capacity} total, ${Math.max(0, resource.capacity - used)} free`}
                  >
                    {Array.from({ length: resource.capacity }, (_, index) => (
                      <i key={index} className={index < used ? 'used' : ''} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="resource-empty-note">
            No constrained resources yet. Every accepted item can start
            immediately. Add equipment or stations in Edit menu.
          </p>
        )}
      </section>
      <section className="incoming-orders">
        <header>
          <div>
            <p className="scheduler-label">01 · Accept</p>
            <h3 className="font-display">Incoming orders</h3>
          </div>
          <span>{incomingTickets.length} ready to accept</span>
        </header>
        {incomingTickets.length ? (
          <div className="incoming-grid">
            {incomingTickets.map((ticket) => (
              <article key={ticket.orders.map((order) => order.id).join('-')} className="incoming-ticket">
                <div className="ticket-top">
                  <div>
                    <span suppressHydrationWarning>
                      {new Date(ticket.createdAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <h4 className="font-display">{ticket.guestName}</h4>
                  </div>
                  <i />
                </div>
                <ul>
                  {Object.entries(ticket.selections)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([itemId, quantity]) => (
                      <li key={itemId}>
                        <b>{quantity}×</b>
                        {menu.items.find((item) => item.id === itemId)?.name ||
                          'Menu item'}
                      </li>
                    ))}
                </ul>
                {ticket.notes.map((note) => <p key={note}>“{note}”</p>)}
                <div className="incoming-actions">
                  <button onClick={() => void acceptTasks(ticket.taskRefs)}>
                    <Sparkles size={15} /> Accept
                  </button>
                  {ticket.orders.every((order) => order.status === 'new') && (
                    <button
                      className="reject-order"
                      onClick={() => void (async () => {
                        for (const order of ticket.orders) await rejectOrder(order);
                      })()}
                    >
                      <XCircle size={15} /> Reject
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="pipeline-empty compact">
            Orders will appear here automatically when their required resources
            are available.
          </div>
        )}
      </section>
      <div className="pipeline-grid">
        {lanes.map((lane) => {
          const tasks = lane.status === 'waiting' ? [] : sortedTasks(lane.status);
          const laneCount = lane.status === 'waiting' ? waitingTaskViews.length : tasks.length;
          return (
            <section
              key={lane.status}
              className={`pipeline-lane lane-${lane.status}`}
            >
              <header>
                <div>
                  <lane.icon size={17} />
                  <div>
                    <h3>{lane.label}</h3>
                    <span>{lane.hint}</span>
                  </div>
                </div>
                <b>{laneCount}</b>
              </header>
              <div className="pipeline-stack">
                {lane.status === 'waiting' && waitingGroups.map(({ order, item, tasks: waitingTasks, pending }) => (
                  <article key={`${order.id}:${item?.id || waitingTasks[0].itemId}`} className="task-ticket waiting-ticket">
                    <div className="task-priority">
                      <span>{guestDisplayName(order)}</span>
                      <b>#{String(waitingTasks[0].sequence + 1).padStart(2, '0')}</b>
                    </div>
                    <div className="waiting-ticket-title">
                      <h4 className="font-display">{item?.name || 'Menu item'}</h4>
                      <strong>{waitingTasks.length} waiting</strong>
                    </div>
                    <div className="task-resources">
                      {resourcesFor(item).length ? (
                        resourcesFor(item).map(({ resource, units }) => (
                          <span key={resource?.id || 'missing'}>
                            {units}× {resource?.name || 'Missing resource'}
                          </span>
                        ))
                      ) : (
                        <span>No constrained resource</span>
                      )}
                    </div>
                    <p className="wait-reason">
                      <Clock3 size={13} />
                      {waitReason(item)}{pending ? ' · Not accepted yet' : ''}
                    </p>
                    <button
                      type="button"
                      className="task-action reject"
                      onClick={() => void rejectWaitingItems(order, item?.id || waitingTasks[0].itemId)}
                    >
                      <XCircle size={15} />
                      {order.status === 'new' ? 'Reject order' : 'Reject remaining'}
                    </button>
                  </article>
                ))}
                {tasks.map(({ order, task, item, pending }) => {
                  const siblings = (
                    pending ? createOrderTasks(order) : order.tasks || []
                  ).filter(
                    (entry) => entry.itemId === task.itemId,
                  );
                  const unit =
                    siblings.findIndex((entry) => entry.id === task.id) + 1;
                  return (
                    <article key={task.id} className="task-ticket">
                      <div className="task-priority">
                        <span>{guestDisplayName(order)}</span>
                        <b>#{String(task.sequence + 1).padStart(2, '0')}</b>
                      </div>
                      <h4 className="font-display">
                        {item?.name || 'Menu item'}
                        {siblings.length > 1 && (
                          <small>
                            {' '}
                            · {unit} of {siblings.length}
                          </small>
                        )}
                      </h4>
                      <div className="task-resources">
                        {resourcesFor(item).length ? (
                          resourcesFor(item).map(({ resource, units }) => (
                            <span key={resource?.id || 'missing'}>
                              {units}× {resource?.name || 'Missing resource'}
                            </span>
                          ))
                        ) : (
                          <span>No constrained resource</span>
                        )}
                      </div>
                      {lane.status === 'preparing' && (
                        <>
                          <div className="task-timing">
                            <span>
                              <Flame size={13} />
                              Cooking now
                            </span>
                            <b suppressHydrationWarning>
                              {task.estimatedReadyAt
                                ? task.estimatedReadyAt <= now
                                  ? 'Due now'
                                  : `Est. ${new Date(task.estimatedReadyAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                                : `${itemPrepMinutes(item)} min`}
                            </b>
                          </div>
                          <button
                            className="task-action finish"
                            onClick={() => void finishTask(order.id, task.id)}
                          >
                            <Check size={15} /> Mark item ready
                          </button>
                        </>
                      )}
                      {lane.status === 'ready' && (
                        <>
                          <p className="ready-note">
                            <Check size={13} />
                            Resources released · ready to serve
                          </p>
                          <button
                            className="task-action serve"
                            onClick={() => void serveTask(order.id, task.id)}
                          >
                            <UtensilsCrossed size={15} /> Mark served
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
                {!laneCount && (
                  <div className="pipeline-empty">Nothing {lane.status}.</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {taskViews.some((view) => view.task.status === 'served') && (
        <section className="served-strip">
          <span>
            <Check size={15} /> Served
          </span>
          <p>
            {taskViews
              .filter((view) => view.task.status === 'served')
              .slice(-6)
              .map(
                (view) =>
                  `${view.item?.name || 'Item'} for ${guestDisplayName(view.order)}`,
              )
              .join(' · ')}
          </p>
        </section>
      )}
      <section className="service-record">
        <header>
          <div>
            <p className="scheduler-label">Service record</p>
            <h3 className="font-display">Everything you made</h3>
          </div>
          <div className="service-record-actions">
            <span>{orderHistory.length} orders · {guestHistory.length} guests</span>
            {orderHistory.length > 0 && (
              <button onClick={() => void clearOrderHistory()}>
                <Trash2 size={13} /> Clear history
              </button>
            )}
          </div>
        </header>
        {Object.keys(productionTotals).length > 0 && (
          <div className="production-totals" aria-label="Production totals">
            {Object.entries(productionTotals).map(([itemId, quantity]) => (
              <span key={itemId}>
                <b>{quantity}×</b>
                {menu.items.find((item) => item.id === itemId)?.name ||
                  'Menu item'}
              </span>
            ))}
          </div>
        )}
        {orderHistory.length ? (
          <div className="service-record-list">
            {guestHistory.map((guest) => {
              const statuses = guest.orders.map((order) => order.status);
              const status = statuses.includes('preparing')
                ? 'preparing'
                : statuses.includes('new')
                  ? 'new'
                  : statuses.every((entry) => entry === 'served')
                    ? 'served'
                    : statuses.includes('rejected')
                      ? 'rejected'
                      : 'cancelled';
              const notes = guest.orders
                .map((order) => order.note.trim())
                .filter(Boolean);
              return (
              <article key={guest.guestName.toLowerCase()}>
                <div className="service-record-top">
                  <div>
                    <strong>{guest.guestName}</strong>
                    <span suppressHydrationWarning>
                      {guest.orders.length} order{guest.orders.length === 1 ? '' : 's'} · latest{' '}
                      {new Date(guest.latestAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <b className={`record-status record-${status}`}>
                    {status === 'new'
                      ? 'Waiting'
                      : status === 'preparing'
                        ? 'In progress'
                          : status === 'served'
                            ? 'Served'
                          : status === 'rejected'
                            ? 'Rejected'
                            : 'Cancelled'}
                  </b>
                </div>
                <ul>
                  {Object.entries(guest.selections)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([itemId, quantity]) => (
                      <li key={itemId}>
                        <b>{quantity}×</b>
                        {menu.items.find((item) => item.id === itemId)?.name ||
                          'Menu item'}
                      </li>
                    ))}
                </ul>
                {notes.length > 0 && <p>“{notes.join(' · ')}”</p>}
              </article>
              );
            })}
          </div>
        ) : (
          <div className="pipeline-empty compact">
            <ListChecks size={18} /> Orders you accept will be kept here.
          </div>
        )}
      </section>
    </div>
  );
}

function normalizeResourceName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function editDistance(left: string, right: string) {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

function resourceMatchScore(query: string, name: string) {
  const normalizedQuery = normalizeResourceName(query);
  const normalizedName = normalizeResourceName(name);
  if (!normalizedQuery || !normalizedName) return Number.POSITIVE_INFINITY;
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (normalizedName.includes(normalizedQuery)) return 2;
  if (normalizedQuery.length < 4) return Number.POSITIVE_INFINITY;

  const candidates = [
    normalizedName,
    normalizedName.slice(0, normalizedQuery.length),
    ...normalizedName.split(' '),
  ];
  const distance = Math.min(
    ...candidates.map((candidate) => editDistance(normalizedQuery, candidate)),
  );
  const tolerance =
    normalizedQuery.length <= 6
      ? 1
      : Math.max(2, Math.floor(normalizedQuery.length * 0.25));
  return distance <= tolerance ? 3 + distance : Number.POSITIVE_INFINITY;
}

function matchingResources(resources: EventResource[], query: string) {
  return resources
    .map((resource) => ({
      resource,
      score: resourceMatchScore(query, resource.name),
    }))
    .filter((match) => Number.isFinite(match.score))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.resource.name.localeCompare(right.resource.name),
    )
    .slice(0, 4)
    .map((match) => match.resource);
}

function BackgroundPositionPreview({
  imageUrl,
  focus,
  zoom,
  onOpen,
  label,
  className,
  theme,
  shadeOpacity = 0.76,
}: {
  imageUrl: string;
  focus: BackgroundFocus;
  zoom: number;
  onOpen?: () => void;
  label: string;
  className: string;
  theme?: CSSProperties;
  shadeOpacity?: number;
}) {
  return (
    <div className="background-position-control">
      <button
        type="button"
        disabled={!onOpen}
        className={`${className} ${onOpen ? 'is-adjustable' : ''}`}
        style={theme}
        aria-label={onOpen ? `Adjust ${label} background framing` : `${label} background preview`}
        onClick={onOpen}
      >
        <span
          className="background-preview-image"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundPosition: `${focus.x}% ${focus.y}%`,
            transform: `scale(${zoom})`,
            transformOrigin: `${focus.x}% ${focus.y}%`,
          }}
        />
        <span
          className="background-preview-shade"
          aria-hidden="true"
          style={{ background: `linear-gradient(90deg, rgb(var(--theme-deep-rgb) / ${shadeOpacity}), rgb(var(--theme-deep-rgb) / .06))` }}
        />
        <span className="background-preview-label">{label}</span>
        {onOpen && <small className="background-position-hint"><Move size={14} /> Adjust framing</small>}
      </button>
    </div>
  );
}

function EventBackgroundChoices({
  selectedType,
  usingCustomImage,
  onSelect,
}: {
  selectedType: EventType;
  usingCustomImage: boolean;
  onSelect: (eventType: EventType) => void;
}) {
  return (
    <fieldset className="event-background-choices">
      <legend>Default backgrounds</legend>
      <p>Choose a Nights backdrop designed to keep the event visible on both phones and larger screens.</p>
      <div>
        {EVENT_TYPES.map((type) => (
          <button
            type="button"
            key={type.value}
            className={!usingCustomImage && selectedType === type.value ? 'selected' : ''}
            aria-pressed={!usingCustomImage && selectedType === type.value}
            onClick={() => onSelect(type.value)}
          >
            <span style={{ backgroundImage: `url(${EVENT_BACKGROUNDS[type.value]})` }} aria-hidden="true" />
            <strong>{type.label}</strong>
            {!usingCustomImage && selectedType === type.value && <i><Check size={13} /> Selected</i>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function BackgroundCropModal({
  editor,
  onCancel,
  onApply,
}: {
  editor: BackgroundEditorState;
  onCancel: () => void;
  onApply: (focus: BackgroundFocus, zoom: number) => void;
}) {
  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value));
  const [focus, setFocus] = useState(editor.focus);
  const [zoom, setZoom] = useState(clamp(editor.zoom, 1, 3));
  const [previewOverride, setPreviewOverride] = useState<'phone' | 'desktop' | null>(null);
  const [viewport, setViewport] = useState({ width: 390, height: 844 });
  const [dragging, setDragging] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
    focus: BackgroundFocus;
    zoom: number;
  } | null>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  useLayoutEffect(() => {
    const syncViewport = () => setViewport({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  const currentDevice = viewport.width <= 700 ? 'phone' : 'desktop';
  const previewDevice = previewOverride || currentDevice;
  const currentHeroHeight = currentDevice === 'phone'
    ? Math.max(680, viewport.height)
    : Math.min(850, viewport.height * 0.92);
  const currentAspect = viewport.width / currentHeroHeight;
  const previewAspect = previewDevice === currentDevice
    ? currentAspect
    : previewDevice === 'phone' ? 390 / 844 : 16 / 9;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  useEffect(() => {
    const image = new window.Image();
    image.onload = () => setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = editor.imageUrl;
    return () => {
      image.onload = null;
    };
  }, [editor.imageUrl]);

  const pointerDistance = () => {
    const points = [...pointers.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const releasePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    pinchStart.current = null;
    const remaining = [...pointers.current.entries()][0];
    if (remaining) {
      dragStart.current = {
        pointerId: remaining[0],
        x: remaining[1].x,
        y: remaining[1].y,
        focus,
        zoom,
      };
    } else {
      dragStart.current = null;
      setDragging(false);
    }
  };

  const updateZoom = (next: number) => setZoom(clamp(next, 1, 3));

  return (
    <div className="background-crop-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <dialog open className="background-crop-dialog" aria-labelledby="background-crop-title" aria-describedby="background-crop-help">
        <header>
          <div>
            <p className="eyebrow">Custom backdrop</p>
            <h2 id="background-crop-title" className="font-display">Frame your event</h2>
            <p id="background-crop-help">Preview the real guest-page crop. Drag to reposition; pinch, scroll, or use the slider to zoom.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close background editor"><XCircle size={24} /></button>
        </header>
        <div className="background-crop-device-switch" role="group" aria-label="Preview size">
          <button
            type="button"
            className={previewDevice === 'phone' ? 'selected' : ''}
            aria-pressed={previewDevice === 'phone'}
            onClick={() => setPreviewOverride('phone')}
          >
            <Smartphone size={17} /> Phone{currentDevice === 'phone' ? ' · This screen' : ''}
          </button>
          <button
            type="button"
            className={previewDevice === 'desktop' ? 'selected' : ''}
            aria-pressed={previewDevice === 'desktop'}
            onClick={() => setPreviewOverride('desktop')}
          >
            <Monitor size={17} /> Desktop{currentDevice === 'desktop' ? ' · This screen' : ''}
          </button>
        </div>
        <div className={`background-crop-stage ${previewDevice}`}>
        <button
          type="button"
          className={`background-crop-viewport ${previewDevice} ${dragging ? 'is-dragging' : ''}`}
          aria-label={`${previewDevice === 'phone' ? 'Phone' : 'Desktop'} background image framing area`}
          style={{ '--crop-preview-aspect': previewAspect } as CSSProperties}
          onPointerDown={(event) => {
            if (event.button !== 0 && event.pointerType === 'mouse') return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.current.size === 1) {
              dragStart.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                focus,
                zoom,
              };
              setDragging(true);
            } else if (pointers.current.size === 2) {
              pinchStart.current = { distance: pointerDistance(), zoom };
              dragStart.current = null;
            }
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId)) return;
            pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointers.current.size >= 2 && pinchStart.current) {
              const distance = pointerDistance();
              if (pinchStart.current.distance > 0)
                updateZoom(pinchStart.current.zoom * (distance / pinchStart.current.distance));
              return;
            }
            const start = dragStart.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const coverScale = imageSize.width && imageSize.height
              ? Math.max(bounds.width / imageSize.width, bounds.height / imageSize.height)
              : 1;
            const overflowX = Math.max(0, imageSize.width * coverScale * start.zoom - bounds.width);
            const overflowY = Math.max(0, imageSize.height * coverScale * start.zoom - bounds.height);
            setFocus({
              x: overflowX > 0 ? clamp(start.focus.x - ((event.clientX - start.x) / overflowX) * 100, 0, 100) : start.focus.x,
              y: overflowY > 0 ? clamp(start.focus.y - ((event.clientY - start.y) / overflowY) * 100, 0, 100) : start.focus.y,
            });
          }}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
          onWheel={(event: ReactWheelEvent<HTMLButtonElement>) => {
            event.preventDefault();
            updateZoom(zoom * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015)));
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 10 : 2;
            if (event.key === 'ArrowLeft') setFocus((current) => ({ ...current, x: clamp(current.x - step, 0, 100) }));
            else if (event.key === 'ArrowRight') setFocus((current) => ({ ...current, x: clamp(current.x + step, 0, 100) }));
            else if (event.key === 'ArrowUp') setFocus((current) => ({ ...current, y: clamp(current.y - step, 0, 100) }));
            else if (event.key === 'ArrowDown') setFocus((current) => ({ ...current, y: clamp(current.y + step, 0, 100) }));
            else if (event.key === '+' || event.key === '=') updateZoom(zoom + 0.1);
            else if (event.key === '-' || event.key === '_') updateZoom(zoom - 0.1);
            else if (event.key === 'Home' || event.key === '0') {
              setFocus(centerBackgroundFocus());
              setZoom(1);
            } else return;
            event.preventDefault();
          }}
        >
          <Image
            src={editor.imageUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 600px) 100vw, 900px"
            draggable={false}
            style={{
              objectPosition: `${focus.x}% ${focus.y}%`,
              transform: `scale(${zoom})`,
              transformOrigin: `${focus.x}% ${focus.y}%`,
            }}
          />
          <span className="background-crop-grid" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="background-crop-hint"><Move size={15} /> Drag image</span>
        </button>
        </div>
        <section className="background-crop-controls">
          <button type="button" onClick={() => updateZoom(zoom - 0.1)} disabled={zoom <= 1} aria-label="Zoom out"><ZoomOut size={19} /></button>
          <label>
            <span>Zoom</span>
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} />
          </label>
          <button type="button" onClick={() => updateZoom(zoom + 0.1)} disabled={zoom >= 3} aria-label="Zoom in"><ZoomIn size={19} /></button>
          <output>{Math.round(zoom * 100)}%</output>
          <button type="button" className="background-crop-reset" onClick={() => { setFocus(centerBackgroundFocus()); setZoom(1); }}>Reset</button>
        </section>
        <footer>
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => onApply(focus, zoom)}><Check size={17} /> Apply framing</button>
        </footer>
      </dialog>
    </div>
  );
}

function EventPalettePicker({
  value,
  onChange,
}: {
  value: EventPalette;
  onChange: (palette: EventPalette) => void;
}) {
  return (
    <fieldset className="event-palette-picker">
      <legend>Guest page colors</legend>
      <div>
        {EVENT_PALETTES.map((palette) => (
          <label key={palette.value} className={value === palette.value ? 'selected' : ''}>
            <input
              type="radio"
              name="event-color-palette"
              value={palette.value}
              checked={value === palette.value}
              onChange={() => onChange(palette.value)}
            />
            <span aria-hidden="true">
              {palette.colors.map((color) => <i key={color} style={{ background: color }} />)}
            </span>
            <small>{palette.label}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MenuEditor({
  menu,
  orders,
  setMenu,
  saveMenu,
  cancelMenuEdits,
  uploadItemImage,
  uploadEventBackground,
  adjustEventBackground,
}: {
  menu: EventMenu;
  orders: Order[];
  setMenu: (menu: EventMenu) => void;
  saveMenu: () => Promise<void>;
  cancelMenuEdits: () => Promise<void>;
  uploadItemImage: (itemId: string, file: File) => Promise<void>;
  uploadEventBackground: (file: File) => Promise<void>;
  adjustEventBackground: () => void;
}) {
  const [addingCategoryFor, setAddingCategoryFor] = useState<string | null>(
    null,
  );
  const [newCategory, setNewCategory] = useState('');
  const [resourceDrafts, setResourceDrafts] = useState<Record<string, string>>(
    {},
  );
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const publicPathParts = menu.publicPath?.split('/') || [];
  const publicPathCategory = publicPathParts[0] || '';
  const publicPathEvent = publicPathParts[1] || '';
  const suggestedPathCategory = normalizeEventPathSegment(menu.title, 'event');
  const suggestedPathEvent = dateEventPathSegment(menu.startsAt || '');
  const setPublicPathPart = (category: string, event: string) =>
    setMenu({
      ...menu,
      publicPath: `${normalizeEventPathSegment(category)}/${normalizeEventPathSegment(event)}`,
    });
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const previousCardPositions = useRef(new Map<string, DOMRect>());
  const animateReorderRef = useRef(false);
  const categories = menuCategories(menu);
  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>();
    // Only an actual reorder arms the FLIP animation. Text changes also
    // replace menu.items, but they must not move or animate the page.
    const animateReorder = animateReorderRef.current;
    animateReorderRef.current = false;
    cardRefs.current.forEach((element, id) => {
      const next = element.getBoundingClientRect();
      const previous = previousCardPositions.current.get(id);
      if (previous && animateReorder) {
        const deltaY = previous.top - next.top;
        if (Math.abs(deltaY) > 1) {
          element.animate(
            [
              { transform: `translateY(${deltaY}px)`, boxShadow: '0 18px 38px rgb(217 84 61 / 0.14)' },
              { transform: 'translateY(0)', boxShadow: '0 10px 28px rgb(50 43 31 / 0.04)' },
            ],
            { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
          );
        }
      }
      nextPositions.set(id, next);
    });
    previousCardPositions.current = nextPositions;
  }, [menu.items]);
  const updateItem = (
    id: string,
    field: keyof MenuItem,
    value: string | number | boolean | undefined,
  ) =>
    setMenu({
      ...menu,
      items: menu.items.map((i) =>
        i.id === id ? { ...i, [field]: value } : i,
      ),
    });
  const remove = (id: string) =>
    setMenu({ ...menu, items: menu.items.filter((i) => i.id !== id) });
  const add = () => {
    const category = categories[0] || 'Main plates';
    setMenu({
      ...menu,
      categories: categories.length ? categories : [category],
      items: [
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          category,
          price: 0,
          prepMinutes: 15,
        },
        ...menu.items,
      ],
    });
  };
  const reorderItems = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const items = [...menu.items];
    const from = items.findIndex((item) => item.id === draggedId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [dragged] = items.splice(from, 1);
    items.splice(to, 0, dragged);
    animateReorderRef.current = true;
    setMenu({ ...menu, items });
  };
  const addCategory = (itemId: string) => {
    const category = newCategory.trim();
    if (!category) return;
    const nextCategories = [...new Set([...categories, category])];
    setMenu({
      ...menu,
      categories: nextCategories,
      items: menu.items.map((item) =>
        item.id === itemId ? { ...item, category } : item,
      ),
    });
    setAddingCategoryFor(null);
    setNewCategory('');
  };
  const assignResourceToItem = (itemId: string, resource: EventResource) => {
    setMenu({
      ...menu,
      items: menu.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              requirements: {
                ...item.requirements,
                [resource.id]: item.requirements?.[resource.id] || 1,
              },
            }
          : item,
      ),
    });
    setResourceDrafts((current) => ({ ...current, [itemId]: '' }));
  };
  const addResourceForItem = (itemId: string) => {
    const name = (resourceDrafts[itemId] || '').trim();
    if (!name) return;
    const existing = matchingResources(menu.resources || [], name)[0];
    const resource = existing || { id: crypto.randomUUID(), name, capacity: 1 };
    if (!existing) {
      setMenu({
        ...menu,
        resources: [...(menu.resources || []), resource],
        items: menu.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                requirements: {
                  ...item.requirements,
                  [resource.id]: 1,
                },
              }
            : item,
        ),
      });
      setResourceDrafts((current) => ({ ...current, [itemId]: '' }));
      return;
    }
    assignResourceToItem(itemId, resource);
  };
  const updateResource = (id: string, changes: Partial<EventResource>) =>
    setMenu({
      ...menu,
      resources: (menu.resources || []).map((resource) =>
        resource.id === id ? { ...resource, ...changes } : resource,
      ),
    });
  const removeResource = (id: string) =>
    setMenu({
      ...menu,
      resources: (menu.resources || []).filter(
        (resource) => resource.id !== id,
      ),
      items: menu.items.map((item) => {
        const requirements = { ...item.requirements };
        delete requirements[id];
        return { ...item, requirements };
      }),
    });
  const updateRequirement = (
    itemId: string,
    resourceId: string,
    value: string,
  ) => {
    const units = value === '' ? 0 : Math.max(0, Number(value));
    setMenu({
      ...menu,
      items: menu.items.map((item) => {
        if (item.id !== itemId) return item;
        const requirements = { ...item.requirements };
        if (units > 0) requirements[resourceId] = units;
        else delete requirements[resourceId];
        return { ...item, requirements };
      }),
    });
  };
  const chooseImage = async (itemId: string, file?: File) => {
    if (!file) return;
    setUploadingItem(itemId);
    try {
      await uploadItemImage(itemId, file);
    } finally {
      setUploadingItem(null);
    }
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMenu();
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="editor-shell">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-6">
        <div>
          <p className="eyebrow">Event settings</p>
          <h2 className="font-display mt-1 text-3xl font-semibold">
            Details and menu
          </h2>
        </div>
        <button
          onClick={() => setMenu({ ...menu, accepting: !menu.accepting })}
          className={`accepting-toggle ${menu.accepting ? 'on' : 'off'}`}
        >
          <span />
          {menu.accepting ? 'Accepting orders' : 'Orders closed'}
        </button>
      </div>
      <div className="event-settings-grid">
        <label className="field-label event-settings-title">
          Event name
          <input
            className="field-input"
            value={menu.title}
            onChange={(e) => setMenu({ ...menu, title: e.target.value })}
          />
        </label>
        <label className="field-label">
          Event date and time
          <input
            type="datetime-local"
            className="field-input date-time-input"
            value={menu.startsAt || ''}
            onChange={(e) =>
              setMenu({
                ...menu,
                startsAt: e.target.value,
                date: e.target.value ? formatDateTime(e.target.value) : '',
              })
            }
          />
          {menu.startsAt && <small className="date-preview">{menu.date}</small>}
        </label>
        <label className="field-label event-type-field">
          Event type
          <select
            className="field-input"
            value={menu.eventType || 'meal'}
            onChange={(event) => {
              const eventType = event.target.value as EventType;
              setMenu({
                ...menu,
                eventType,
                customEventType: eventType === 'custom' ? menu.customEventType : '',
                backgroundImageUrl: '',
                backgroundFocus: centerBackgroundFocus(),
                backgroundZoom: 1,
                colorPalette: DEFAULT_EVENT_PALETTE[eventType],
              });
            }}
          >
            {EVENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="field-label compact-integer-field">
          Max friends per guest
          <input
            type="number"
            min="0"
            max="20"
            className="field-input"
            value={menu.maxAdditionalGuests || 0}
            onChange={(event) =>
              setMenu({
                ...menu,
                maxAdditionalGuests: Math.min(20, Math.max(0, Number(event.target.value) || 0)),
              })
            }
          />
        </label>
      </div>
      <fieldset className="event-link-builder event-link-builder-existing">
        <legend className="field-label">Guest link for this event</legend>
        <div className="event-link-inputs">
          <span>gaemaj.tech/</span>
          <input
            value={publicPathCategory}
            onChange={(event) => setPublicPathPart(event.target.value, publicPathEvent)}
            className="field-input"
            placeholder={suggestedPathCategory}
            aria-label="Event link first part"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <span>/</span>
          <input
            value={publicPathEvent}
            onChange={(event) => setPublicPathPart(publicPathCategory, event.target.value)}
            className="field-input"
            placeholder={suggestedPathEvent || 'oct4'}
            aria-label="Event link second part"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <small>Leave both fields blank to use the automatic name-and-date link shown as the placeholder. An override never moves or recreates the event, orders, RSVPs, or chat.</small>
      </fieldset>
      <div className="event-identity-grid">
        {(menu.eventType || 'meal') === 'custom' && (
          <label className="field-label">
            Custom event type
            <input
              className="field-input"
              value={menu.customEventType || ''}
              onChange={(event) => setMenu({ ...menu, customEventType: event.target.value })}
              placeholder="Book club, housewarming, watch party…"
              maxLength={80}
            />
          </label>
        )}
        <label className="invite-approval-option compact" aria-label="Require host approval for guests">
          <input
            type="checkbox"
            checked={Boolean(menu.requireGuestApproval)}
            onChange={(event) => setMenu({ ...menu, requireGuestApproval: event.target.checked })}
          />
          <span>
            <strong>Host approval required</strong>
            <small>Only Going responses wait for approval before seeing private details.</small>
          </span>
        </label>
      </div>
      <section className="event-background-editor">
        <BackgroundPositionPreview
          className="event-background-preview"
          theme={eventThemeStyle(menu)}
          imageUrl={eventBackground(menu)}
          focus={eventBackgroundFocus(menu)}
          zoom={eventBackgroundZoom(menu)}
          onOpen={menu.backgroundImageUrl ? adjustEventBackground : undefined}
          label={eventTypeLabel(menu)}
        />
        <section>
          <p className="eyebrow">Event backdrop</p>
          <strong>Set the mood before guests arrive.</strong>
          <small>Changing the event type selects its curated image. Custom framing opens in a dedicated editor.</small>
          <div>
            <label className="secondary-button">
              <ImagePlus size={15} /> Replace background
              <input
                type="file"
                accept="image/*,.heic,.heif,image/heic,image/heif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void uploadEventBackground(file);
                }}
              />
            </label>
            {menu.backgroundImageUrl && <button type="button" onClick={adjustEventBackground}><Move size={15} /> Adjust framing</button>}
            {menu.backgroundImageUrl && <button type="button" onClick={() => setMenu({ ...menu, backgroundImageUrl: '', backgroundFocus: centerBackgroundFocus(), backgroundZoom: 1, colorPalette: DEFAULT_EVENT_PALETTE[menu.eventType || 'meal'] })}>Use curated image</button>}
          </div>
        </section>
      </section>
      <EventBackgroundChoices
        selectedType={menu.eventType || 'meal'}
        usingCustomImage={Boolean(menu.backgroundImageUrl)}
        onSelect={(eventType) => setMenu({
          ...menu,
          eventType,
          customEventType: eventType === 'custom' ? menu.customEventType : '',
          backgroundImageUrl: '',
          backgroundFocus: centerBackgroundFocus(),
          backgroundZoom: 1,
          colorPalette: DEFAULT_EVENT_PALETTE[eventType],
        })}
      />
      {menu.backgroundImageUrl && (
        <EventPalettePicker
          value={eventPalette(menu)}
          onChange={(colorPalette) => setMenu({ ...menu, colorPalette })}
        />
      )}
      <label className="field-label mt-5">
        Address
        <input
          className="field-input"
          value={menu.address || ''}
          onChange={(e) => setMenu({ ...menu, address: e.target.value })}
          placeholder="123 Main Street, Los Angeles, CA"
          autoComplete="street-address"
        />
      </label>
      <label className="field-label mt-5">
        Welcome message
        <textarea
          className="field-input min-h-32 resize-y"
          value={menu.welcome}
          onChange={(e) => setMenu({ ...menu, welcome: e.target.value })}
          placeholder="Add a welcome message for your guests…"
        />
      </label>
      <div className="my-8 flex items-center justify-between border-b border-black/10 pb-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Menu items</h2>
          <p className="mt-1 text-xs text-black/40">
            Add a photo and prep time; categories stay available across every
            dish.
          </p>
        </div>
        <button onClick={add} className="secondary-button">
          <Plus size={16} /> Add dish
        </button>
      </div>
      <div className="space-y-4">
        {menu.items.map((item, index) => (
          // Drag events belong on the card so a dish is a clear drop target.
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <article
            key={item.id}
            ref={(element) => {
              if (element) cardRefs.current.set(item.id, element);
              else cardRefs.current.delete(item.id);
            }}
            className={`menu-editor-card ${draggingItemId === item.id ? 'is-dragging' : ''} ${dragOverItemId === item.id ? 'is-drop-target' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (!draggingItemId || draggingItemId === item.id) return;
              if (dragOverItemId !== item.id) {
                setDragOverItemId(item.id);
                reorderItems(draggingItemId, item.id);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingItemId(null);
              setDragOverItemId(null);
            }}
          >
            <div className="menu-image-editor">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={300}
                  height={290}
                  unoptimized
                />
              ) : (
                <span>
                  <Camera size={24} />
                  <small>No image</small>
                </span>
              )}
              <label className="image-upload-button">
                <ImagePlus size={14} />
                {uploadingItem === item.id
                  ? 'Uploading…'
                  : item.imageUrl
                    ? 'Replace'
                    : 'Add image'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    void chooseImage(item.id, e.target.files?.[0])
                  }
                />
              </label>
              {item.imageUrl && (
                <button
                  onClick={() =>
                    setMenu({
                      ...menu,
                      items: menu.items.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              imageUrl: undefined,
                              imagePath: undefined,
                            }
                          : entry,
                      ),
                    })
                  }
                  className="remove-image-button"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="menu-item-fields">
              <label>
                <span>Dish name</span>
                <input
                  aria-label={`Dish ${index + 1} name`}
                  className="editor-input font-semibold"
                  value={item.name}
                  placeholder="e.g. Cedar-roasted salmon"
                  onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                />
              </label>
              <label>
                <span>
                  Description <em>optional</em>
                </span>
                <textarea
                  aria-label={`Dish ${index + 1} description`}
                  className="editor-input description-input description-textarea"
                  value={itemDescription(item)}
                  placeholder={DESCRIPTION_EXAMPLE}
                  onChange={(e) =>
                    updateItem(item.id, 'description', e.target.value)
                  }
                  rows={3}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span>Category</span>
                  <select
                    aria-label={`Dish ${index + 1} category`}
                    className="editor-input"
                    value={item.category}
                    onChange={(e) =>
                      e.target.value === '__add__'
                        ? setAddingCategoryFor(item.id)
                        : updateItem(item.id, 'category', e.target.value)
                    }
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value="__add__">＋ Add new category…</option>
                  </select>
                </label>
                <label>
                  <span>Preparation time</span>
                  <div className="prep-input">
                    <input
                      aria-label={`Dish ${index + 1} preparation minutes`}
                      type="number"
                      min="1"
                      max="240"
                      onWheel={(event) => event.currentTarget.blur()}
                      value={item.prepMinutes ?? ''}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          'prepMinutes',
                          e.target.value === ''
                            ? undefined
                            : Math.min(
                                240,
                                Math.max(1, Number(e.target.value)),
                              ),
                        )
                      }
                      onBlur={() =>
                        item.prepMinutes == null &&
                        updateItem(item.id, 'prepMinutes', 10)
                      }
                    />
                    <b>min</b>
                    <div className="prep-stepper">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, 'prepMinutes', Math.min(240, (item.prepMinutes ?? 10) + 1))}
                        aria-label={`Increase ${item.name || 'dish'} preparation time`}
                      ><Plus size={14} /></button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, 'prepMinutes', Math.max(1, (item.prepMinutes ?? 10) - 1))}
                        aria-label={`Decrease ${item.name || 'dish'} preparation time`}
                      ><Minus size={14} /></button>
                    </div>
                  </div>
                </label>
                <label>
                  <span>Total servings for this event</span>
                  <div className="prep-input">
                    <input
                      aria-label={`Dish ${index + 1} servings available`}
                      type="number"
                      min="0"
                      max="999"
                      onWheel={(event) => event.currentTarget.blur()}
                      value={item.maxServings ?? ''}
                      placeholder="Unlimited"
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          'maxServings',
                          e.target.value === ''
                            ? undefined
                            : Math.min(999, Math.max(0, Number(e.target.value))),
                        )
                      }
                    />
                    <b>max</b>
                    <div className="prep-stepper">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, 'maxServings', Math.min(999, (item.maxServings ?? 0) + 1))}
                        aria-label={`Increase ${item.name || 'dish'} servings`}
                      ><Plus size={14} /></button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, 'maxServings', Math.max(0, (item.maxServings ?? 0) - 1))}
                        aria-label={`Decrease ${item.name || 'dish'} servings`}
                      ><Minus size={14} /></button>
                    </div>
                  </div>
                  {item.maxServings != null && (
                    <small className="inventory-note">
                      {Math.max(0, item.maxServings - reservedServings(orders, item.id))} remaining · {reservedServings(orders, item.id)} ordered
                    </small>
                  )}
                </label>
              </div>
              <label className="sold-out-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(item.soldOut)}
                  onChange={(event) => updateItem(item.id, 'soldOut', event.target.checked)}
                />
                <span>Mark this dish sold out</span>
              </label>
              {addingCategoryFor === item.id && (
                <div className="new-category-row">
                  <input
                    aria-label="New category name"
                    value={newCategory}
                    placeholder="e.g. Drinks"
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <button onClick={() => addCategory(item.id)}>
                    Add category
                  </button>
                  <button
                    onClick={() => {
                      setAddingCategoryFor(null);
                      setNewCategory('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="item-resource-editor">
                <div>
                  <strong>Equipment & stations</strong>
                  <span>Required by this dish only.</span>
                </div>
                {(menu.resources || []).some(
                  (resource) => (item.requirements?.[resource.id] || 0) > 0,
                ) ? (
                  <div className="item-resource-grid">
                    {menu
                      .resources!.filter(
                        (resource) =>
                          (item.requirements?.[resource.id] || 0) > 0,
                      )
                      .map((resource) => (
                        <div
                          key={resource.id}
                          className="item-resource-assignment"
                        >
                          <span>{resource.name}</span>
                          <label>
                            <small>Uses</small>
                            <input
                              aria-label={`${item.name || `Dish ${index + 1}`} ${resource.name} required`}
                              type="number"
                              min="1"
                              max="99"
                              value={item.requirements?.[resource.id] || 1}
                              onChange={(event) =>
                                updateRequirement(
                                  item.id,
                                  resource.id,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateRequirement(item.id, resource.id, '0')
                            }
                            aria-label={`Remove ${resource.name} from ${item.name || `dish ${index + 1}`}`}
                            title={`Remove ${resource.name} from this dish`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="item-resource-empty">
                    No equipment or station assigned to this dish yet.
                  </p>
                )}
                <div className="resource-combobox">
                  <div className="add-item-resource">
                    <input
                      type="search"
                      aria-label={`Add equipment or station to ${item.name || `dish ${index + 1}`}`}
                      name={`equipment-search-${item.id}`}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      data-form-type="other"
                      data-1p-ignore="true"
                      value={resourceDrafts[item.id] || ''}
                      onChange={(event) =>
                        setResourceDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addResourceForItem(item.id);
                        }
                      }}
                      placeholder="Try “cast iron pan”"
                    />
                    <button
                      type="button"
                      disabled={!resourceDrafts[item.id]?.trim()}
                      onClick={() => addResourceForItem(item.id)}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  {resourceDrafts[item.id]?.trim() &&
                    matchingResources(
                      (menu.resources || []).filter(
                        (resource) => !item.requirements?.[resource.id],
                      ),
                      resourceDrafts[item.id],
                    ).length > 0 && (
                      <div
                        className="resource-suggestions"
                        aria-label="Matching shared resources"
                      >
                        {matchingResources(
                          (menu.resources || []).filter(
                            (resource) => !item.requirements?.[resource.id],
                          ),
                          resourceDrafts[item.id],
                        ).map((resource) => (
                          <button
                            key={resource.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                              assignResourceToItem(item.id, resource)
                            }
                          >
                            <span>{resource.name}</span>
                            <small>Use existing shared resource</small>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </div>
            <button
              type="button"
              draggable
              className="drag-handle"
              aria-label={`Drag to reorder ${item.name || `dish ${index + 1}`}`}
              title="Drag to reorder"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.id);
                setDraggingItemId(item.id);
                setDragOverItemId(item.id);
              }}
              onDragEnd={() => {
                setDraggingItemId(null);
                setDragOverItemId(null);
              }}
            >
              <GripVertical size={18} />
            </button>
            <button
              onClick={() => remove(item.id)}
              className="icon-button shrink-0 text-red-600"
              aria-label={`Delete ${item.name || `dish ${index + 1}`}`}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
        {menu.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/15 py-12 text-center text-sm text-black/40">
            No dishes yet. Add the first one above.
          </div>
        )}
      </div>
      <section className="resource-editor">
        <header>
          <div>
            <p className="eyebrow">Shared inventory</p>
            <h3 className="font-display">How many do you have?</h3>
          </div>
          <p>
            This collective list comes from the equipment and stations assigned
            to your dishes. Capacity is shared across the entire menu.
          </p>
        </header>
        {(menu.resources || []).length ? (
          <div className="resource-editor-list">
            {menu.resources!.map((resource) => (
              <div key={resource.id} className="resource-editor-row">
                <label>
                  <span>Shared resource</span>
                  <input
                    value={resource.name}
                    onChange={(event) =>
                      updateResource(resource.id, { name: event.target.value })
                    }
                  />
                </label>
                <label className="resource-capacity">
                  <span>Quantity owned</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={resource.capacity || ''}
                    onChange={(event) =>
                      updateResource(resource.id, {
                        capacity:
                          event.target.value === ''
                            ? 0
                            : Math.min(
                                99,
                                Math.max(1, Number(event.target.value)),
                              ),
                      })
                    }
                    onBlur={() =>
                      resource.capacity < 1 &&
                      updateResource(resource.id, { capacity: 1 })
                    }
                  />
                </label>
                <button
                  onClick={() => removeResource(resource.id)}
                  aria-label={`Delete ${resource.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="resource-list-empty">
            Add equipment or a station inside any dish above. It will appear
            here automatically.
          </p>
        )}
      </section>
      <div className="host-editor-actions" role="toolbar" aria-label="Event editing actions">
        <p className="text-xs text-black/40">
          Saving updates every open guest tab for this event.
        </p>
        <div>
          <button onClick={() => void cancelMenuEdits()} className="secondary-button">
            <XCircle size={16} /> Cancel
          </button>
          <button
            disabled={
              saving ||
              !menu.title.trim() ||
              !menu.date.trim()
            }
            onClick={() => void handleSave()}
            className="primary-button disabled:opacity-40"
          >
            <Check size={16} /> {saving ? 'Saving…' : 'Save event & menu'}
          </button>
        </div>
      </div>
    </section>
  );
}
