'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
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
  Download,
  ExternalLink,
  Flame,
  GripVertical,
  ImagePlus,
  Leaf,
  ListChecks,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Minus,
  Move,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Reply,
  Send,
  Settings2,
  Share2,
  ShoppingBag,
  Smile,
  Smartphone,
  Sparkles,
  SquarePlus,
  Trash2,
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
type PushNotificationState = 'unsupported' | 'disabled' | 'blocked' | 'enabled';
type AccountProfile = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  guestUid: string;
  membershipTier: 'free' | 'plus' | 'pro';
  membershipStatus: 'active' | 'trialing' | 'past_due' | 'cancelled';
  mutedEventIds: string[];
  createdAt: number;
  updatedAt?: number;
};
type AccountUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
  providerIds: string[];
};
type AccountAuthMode = 'signin' | 'signup' | 'profile';
type EventInvitation = {
  eventId: string;
  hostUid: string;
  recipientUid: string;
  recipientGuestUid: string;
  recipientEmail: string;
  recipientPhone: string;
  createdAt: number;
  updatedAt?: number;
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
};
type Receipt = {
  eventId: string;
  orderId: string;
  createdAt: number;
  expiresAt: number;
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
const callPushApi = async (
  path: 'subscribe' | 'send' | 'account',
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
};
const HOST_EMAIL = process.env.NEXT_PUBLIC_HOST_EMAIL?.trim().toLowerCase();
const guestIdentityKey = (eventId: string) => `gather-guest-identity:${eventId}`;
const GUEST_SESSION_KEY = 'nights-guest-session-v1';
const GUEST_EVENTS_CACHE_KEY = 'nights-guest-events-v1';
const GLOBAL_PUSH_KEY = 'nights-global-push-v1';
const NOTIFICATION_PROMPT_KEY = 'nights-notification-prompt-v1';
const PENDING_GUEST_EVENT_KEY = 'nights-pending-guest-event-v1';
const TRUSTED_GUEST_ROUTE_KEY = 'nights-selected-guest-route-v1';
const LAST_EVENT_KEY = 'gather-last-event';
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
  return segments[0] === 'nights-guests' || url.searchParams.get('guest') === '1';
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
  if (segments[0] === 'nights-guests' || segments[0] === 'nights-host') return null;
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
const hostHomeRoute = () => usesCleanEventUrls() ? '/nights-host/' : '?view=host';
const guestHomeRoute = () => usesCleanEventUrls() ? '/nights-guests/' : '?guest=1';
const guestEventUrl = (eventId: string, publicPath?: string) =>
  new URL(`${guestHomeRoute()}${guestHomeRoute().includes('?') ? '&' : '?'}invite=${encodeURIComponent(
    normalizedPublicEventPath(publicPath) || eventId,
  )}`, window.location.origin).toString();
const pushSubscriptionKey = (eventId: string, actorUid: string) =>
  `gather-chat-push-v2:${eventId}:${actorUid}`;
const globalPushKey = (authUid: string) => `${GLOBAL_PUSH_KEY}:${authUid}`;
const notificationPromptKey = (authUid: string) => `${NOTIFICATION_PROMPT_KEY}:${authUid}`;
const accountDisplayName = (profile: Pick<AccountProfile, 'firstName' | 'lastName'>) =>
  `${profile.firstName} ${profile.lastName}`.trim();
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
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountFirstName, setAccountFirstName] = useState('');
  const [accountLastName, setAccountLastName] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState('');
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [guestPin, setGuestPin] = useState('');
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [guestEvents, setGuestEvents] = useState<GuestEventAccess[]>([]);
  const [guestEventsBusy, setGuestEventsBusy] = useState(false);
  const [guestEventPickerOpen, setGuestEventPickerOpen] = useState(false);
  const [hostContacts, setHostContacts] = useState<HostContact[]>([]);
  const [pendingGuestEvent, setPendingGuestEvent] = useState<PendingGuestEvent | null>(null);
  const pendingEnrollmentRef = useRef('');
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
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
            updatedAt: data.updatedAt?.toMillis?.(),
          } as AccountProfile : null;
          setAccountProfile(profile);
          setHostUser(profile ? user.uid : null);
          if (profile) void (async () => {
            const email = normalizedAccountEmail(profile.email || user.email || '');
            if (!email) return;
            const directory = {
              uid: user.uid,
              email,
              firstName: profile.firstName,
              lastName: profile.lastName,
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
          const invitation = invitations.get(event.id);
          const [profileDocument, rsvpDocument] = await Promise.all([
            store.getDoc(store.doc(db, 'events', event.id, 'guests', session.guestUid)),
            store.getDoc(store.doc(db, 'events', event.id, 'rsvps', session.guestUid)),
          ]);
          const profileData = profileDocument.data();
          if (
            (!profileData && !invitation)
            || (!session.authUid && profileData?.pinHash !== session.pinHash)
            || (profileData?.accountUid && session.authUid && profileData.accountUid !== session.authUid)
          ) return null;
          const rsvpData = rsvpDocument.data();
          return {
            event,
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
            } as Rsvp : null,
            ...(invitation ? { invitation } : {}),
          } satisfies GuestEventAccess;
        }));
        matches = candidates.filter((entry): entry is GuestEventAccess => Boolean(entry));
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
      const access: GuestEventAccess = { event, profile, rsvp: null };
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
        () => void loadGuestEvents(session),
      );
    })();
    return () => unsubscribe();
  }, [accountProfile, accountUser, loadGuestEvents]);

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
    if (!hostView && (linkedEventId || linkedPublicPath)) {
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
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    queueMicrotask(() => setIsStandalone(installed));
    if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
      // Changing this release marker causes a prompt service-worker update on
      // GitHub Pages, rather than waiting for the browser's periodic check.
      const serviceWorkerUrl = usesCleanEventUrls()
        ? new URL('/sw.js?v=36', window.location.origin)
        : new URL('sw.js?v=36', document.baseURI);
      void navigator.serviceWorker
        .register(serviceWorkerUrl.href, { scope: './', updateViaCache: 'none' })
        .catch(() => undefined);
    }
  }, [mode]);

  useEffect(() => {
    if (
      !isStandalone
      || !accountUser
      || !accountProfile
      || typeof Notification === 'undefined'
      || Notification.permission === 'denied'
      || localStorage.getItem(globalPushKey(accountUser.uid))
      || localStorage.getItem(notificationPromptKey(accountUser.uid))
    ) return;
    queueMicrotask(() => setShowNotificationPrompt(true));
  }, [accountProfile, accountUser, isStandalone]);

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
      const unsubMenu = store.onSnapshot(
        store.doc(db, 'events', eventId),
        (snap) => {
          if (snap.exists()) setMenu({ id: snap.id, ...snap.data() } as EventMenu);
          setEventReady(true);
        },
      );
      let unsubOrders = () => {};
      let unsubRsvps = () => {};
      let unsubMyRsvp = () => {};
      let unsubGuestProfile = () => {};
      let unsubEvents = () => {};
      let unsubEventOrderCounts: (() => void)[] = [];
      const unsubRememberedOrders: (() => void)[] = [];
      if (mode === 'host' && hostAuthUser && hostUser) {
        const eventCollection = store.collection(db, 'events');
        const ownedEventSource = HOST_EMAIL && hostAuthUser.email?.toLowerCase() === HOST_EMAIL
          ? eventCollection
          : store.query(eventCollection, store.where('ownerUid', '==', hostAuthUser.uid));
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
        unsubOrders = store.onSnapshot(
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
        unsubRsvps = store.onSnapshot(
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
  const effectiveGuestProfile = useMemo(() => guestProfile || (myRsvp ? {
    guestUid: myRsvp.guestUid,
    guestName: myRsvp.guestName,
    guestPhone: myRsvp.guestPhone,
    createdAt: myRsvp.createdAt,
    updatedAt: myRsvp.updatedAt,
  } : null), [guestProfile, myRsvp]);
  const currentInvitation = guestEvents.find((access) => access.event.id === menu.id)?.invitation;
  const guestHasEventAccess = guestIsApproved(menu, myRsvp);
  const rsvpButtonLabel = myRsvp
    ? menu.requireGuestApproval && myRsvp.status === 'yes' && approvalStatus(myRsvp) === 'pending'
      ? 'RSVP: Pending approval'
      : menu.requireGuestApproval && myRsvp.status === 'yes' && approvalStatus(myRsvp) === 'declined'
        ? 'RSVP: Not approved'
        : `RSVP: ${myRsvp.status === 'yes' ? 'Going' : myRsvp.status === 'maybe' ? 'Maybe' : 'Not Going'}`
    : 'RSVP';
  const chatActor: ChatActor | null = useMemo(() => mode === 'host'
    ? (hostUser || !firebaseConfigured)
      ? { uid: menu.ownerUid || 'host', name: 'Host', role: 'host' }
      : null
    : myRsvp?.status === 'yes' && guestHasEventAccess && effectiveGuestProfile
      ? { uid: effectiveGuestProfile.guestUid, name: effectiveGuestProfile.guestName, role: 'guest' }
      : null,
  [effectiveGuestProfile, guestHasEventAccess, hostUser, menu.ownerUid, mode, myRsvp?.status]);
  const chatActorUid = chatActor?.uid;
  useEffect(() => {
    if (!chatActorUid) return;
    queueMicrotask(() => {
      setChatStarted(true);
      if (new URLSearchParams(window.location.search).get('chat') === '1') setChatOpen(true);
    });
  }, [chatActorUid]);
  const openRsvpPanel = () => {
    setGuestName(effectiveGuestProfile?.guestName || '');
    setPhoneNumber(formatPhone(effectiveGuestProfile?.guestPhone || ''));
    setGuestPin('');
    setRsvpChoice(myRsvp?.status || 'yes');
    const companions = (myRsvp?.companions || []).slice(0, menu.maxAdditionalGuests || 0);
    setRsvpCompanionNames(companions.map(companionName));
    setRsvpCompanionPhones(companions.map(companionPhone));
    setChangingGuestPhone(false);
    setEditingGuestProfile(!effectiveGuestProfile);
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
  const notificationTargets = useMemo(() => {
    if (!accountUser || !accountProfile) return [] as Array<{ event: EventMenu; actor: ChatActor }>;
    const targets = new Map<string, { event: EventMenu; actor: ChatActor }>();
    guestEvents.forEach((access) => {
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
      if (event.ownerUid === accountUser.uid)
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
  const currentEventMuted = Boolean(accountProfile?.mutedEventIds.includes(menu.id));
  const pushActorUid = chatActorUid;
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
        && Boolean(accountUser && localStorage.getItem(globalPushKey(accountUser.uid)))
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
    const workerUrl = usesCleanEventUrls()
      ? new URL('/sw.js?v=36', window.location.origin)
      : new URL('sw.js?v=36', document.baseURI);
    const registration = await navigator.serviceWorker.register(workerUrl.href, {
      scope: './',
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
      !accountUser
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
  }, [accountProfile?.mutedEventIds, accountUser, ensureBrowserPushSubscription, notificationTargets, registerPushTarget]);

  useEffect(() => {
    if (!accountUser || !accountProfile || !notificationTargets.length) return;
    void syncGlobalPushTargets().catch(() => undefined);
  }, [accountProfile, accountUser, notificationTargets, syncGlobalPushTargets]);

  const enableChatNotifications = async () => {
    if (!accountUser || pushNotificationBusy) return;
    if (!firebaseConfigured || !VAPID_PUBLIC_KEY || !PUSH_NOTIFICATIONS_ENABLED) {
      notify('Push notifications are not configured for this release yet.');
      return;
    }
    if (
      typeof Notification === 'undefined'
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
    ) {
      setPushNotificationState('unsupported');
      notify('This browser does not support web-app notifications.');
      return;
    }
    const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isAppleMobile && !isStandalone) {
      notify('On iPhone, add Nights to the Home Screen before enabling notifications.');
      return;
    }
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
      localStorage.setItem(globalPushKey(accountUser.uid), subscriptionId);
      if (currentEventMuted)
        await saveMutedEvents((accountProfile?.mutedEventIds || []).filter((eventId) => eventId !== menu.id));
      await Promise.allSettled(notificationTargets
        .filter((target) => target.event.id !== menu.id || !currentEventMuted || Boolean(chatActor))
        .filter((target) => !(accountProfile?.mutedEventIds || []).includes(target.event.id) || target.event.id === menu.id)
        .map((target) => registerPushTarget(target, serialized, subscriptionId)));
      setPushNotificationState('enabled');
      setShowNotificationPrompt(false);
      localStorage.setItem(notificationPromptKey(accountUser.uid), 'enabled');
      notify(currentEventMuted
        ? 'Notifications are back on for this event.'
        : 'Notifications are on for all your events.');
    } catch (error) {
      setPushNotificationState('disabled');
      notify(error instanceof Error ? error.message : 'Could not enable notifications.');
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
      await saveMutedEvents([...new Set([...accountProfile.mutedEventIds, menu.id])]);
      setPushNotificationState('disabled');
      notify('Notifications are muted for this event. Your other events stay on.');
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
    const enteredPhone = normalizeOptionalPhone(accountPhone);
    if (firstName.length < 1 || firstName.length > 50) throw new Error('Enter your first name.');
    if (lastName.length < 1 || lastName.length > 60) throw new Error('Enter your last name.');
    if (!enteredPhone) throw new Error('Enter a 10-digit phone number, like 555-555-5555.');
    return { firstName, lastName, phone: `+1${phoneDigits(enteredPhone)}` };
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
    const emailRef = store.doc(db, 'account-emails', await guestNameIndexId(email));
    const directoryRef = store.doc(db, 'account-directory', currentAccount.uid);
    try {
      await store.runTransaction(db, async (transaction) => {
        const [existing, identity] = await Promise.all([
          transaction.get(profileRef),
          transaction.get(identityRef),
        ]);
        if (identity.exists() && identity.data().accountUid !== currentAccount.uid)
          throw new Error('That phone number is already connected to another Nights account.');
        if (!identity.exists()) transaction.set(identityRef, {
          accountUid: currentAccount.uid,
          phone: fields.phone,
          createdAt: store.serverTimestamp(),
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
      displayName: `${fields.firstName} ${fields.lastName}`,
    });
    setAccountAuthMode('signin');
    notify('Your Nights account is ready.');
  };

  const signUpWithEmail = async () => {
    const email = accountEmail.trim().toLowerCase();
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
      await authModule.sendEmailVerification(credential.user).catch(() => undefined);
      await saveAccountProfile({
        uid: credential.user.uid,
        email,
        emailVerified: credential.user.emailVerified,
        providerIds: credential.user.providerData.map((provider) => provider.providerId),
      });
      setAccountPassword('');
      notify('Account created. Check your email for the verification link.');
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(code === 'auth/email-already-in-use'
        ? 'That email already has an account. Sign in instead.'
        : code === 'auth/operation-not-allowed'
          ? 'Email sign-up still needs to be enabled in Firebase Authentication.'
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
      const redirectSignIn = isStandalone || /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (redirectSignIn) {
        await authModule.signInWithRedirect(auth, provider);
        return;
      }
      const result = await authModule.signInWithPopup(auth, provider);
      if (!result.user.email) notify('Add an email to your Apple account before continuing.');
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(code === 'auth/popup-closed-by-user'
        ? 'Sign-in was closed before it finished.'
        : code === 'auth/operation-not-allowed'
          ? `${providerName === 'apple' ? 'Apple' : 'Google'} sign-in still needs to be enabled in Firebase Authentication.`
          : code === 'auth/account-exists-with-different-credential'
            ? 'An account already exists for that email. Sign in with its original method first.'
            : `${providerName === 'apple' ? 'Apple' : 'Google'} sign-in could not be completed.`);
    } finally {
      setAccountAuthBusy(false);
    }
  };

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
      await authModule.sendPasswordResetEmail(authModule.getAuth(getApp()), email);
      notify('Password reset email sent.');
    } catch {
      notify('Could not send the reset email. Check the address and try again.');
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
  };
  const deleteAccountPermanently = async () => {
    if (!accountUser || !accountProfile || deleteAccountConfirmation !== 'DELETE') return;
    setDeleteAccountBusy(true);
    try {
      const [{ getApp }, authModule, store] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const auth = authModule.getAuth(getApp());
      const user = auth.currentUser;
      if (!user || user.uid !== accountUser.uid) throw new Error('Sign in again before deleting your account.');
      const signedInAt = Date.parse(user.metadata.lastSignInTime || '');
      if (!Number.isFinite(signedInAt) || Date.now() - signedInAt > 4 * 60 * 1000) {
        if (accountUser.providerIds.includes('password')) {
          if (!deleteAccountPassword) throw new Error('Enter your password to confirm account deletion.');
          await authModule.reauthenticateWithCredential(
            user,
            authModule.EmailAuthProvider.credential(accountProfile.email, deleteAccountPassword),
          );
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
        const legacyOwned = !event.ownerUid
          && normalizedAccountEmail(accountProfile.email) === normalizedAccountEmail(HOST_EMAIL || '');
        if (event.ownerUid === accountUser.uid || legacyOwned) {
          const collections = await Promise.all([
            'orders', 'rsvps', 'guests', 'guest-names', 'guest-phones',
            'name-index', 'pushSubscriptions', 'chat',
          ].map((collectionName) => store.getDocs(
            store.collection(db, 'events', event.id, collectionName),
          )));
          collections.flatMap((snapshot) => snapshot.docs).forEach((document) => addDelete(document.ref));
          const publicPath = normalizedPublicEventPath(event.publicPath);
          const claimId = event.publicPathClaimId || (publicPath ? await guestNameIndexId(publicPath) : '');
          if (claimId) addDelete(store.doc(db, 'public-paths', claimId));
          addDelete(eventDocument.ref);
          continue;
        }

        const profileRef = store.doc(db, 'events', event.id, 'guests', accountProfile.guestUid);
        const rsvpRef = store.doc(db, 'events', event.id, 'rsvps', accountProfile.guestUid);
        const [profileDocument, rsvpDocument, orderSnapshot, chatSnapshot] = await Promise.all([
          store.getDoc(profileRef),
          store.getDoc(rsvpRef),
          store.getDocs(store.query(
            store.collection(db, 'events', event.id, 'orders'),
            store.where('guestUid', '==', accountProfile.guestUid),
          )),
          store.getDocs(store.collection(db, 'events', event.id, 'chat')),
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
  const inviteRegisteredGuest = async (event: EventMenu, identifier: string) => {
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
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'), import('firebase/firestore'),
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
        const phoneIndex = await store.getDoc(
          store.doc(db, 'guest-identities', await guestNameIndexId(normalizedPhone)),
        );
        targetUid = phoneIndex.data()?.accountUid || '';
      }
      if (!targetUid) throw new Error('not-registered');
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
      const fallbackName = `${displayName || 'Guest'} · ${phoneDigits(directory.phone).slice(-4)}`;
      const invitationRef = store.doc(db, 'users', targetUid, 'invitations', event.id);
      const contactRef = store.doc(db, 'users', accountUser.uid, 'contacts', targetUid);
      const profileRef = store.doc(db, 'events', event.id, 'guests', directory.guestUid);
      const primaryNameRef = store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(displayName));
      const fallbackNameRef = store.doc(db, 'events', event.id, 'guest-names', await guestNameIndexId(fallbackName));
      const phoneRef = store.doc(
        db,
        'events',
        event.id,
        'guest-phones',
        await guestNameIndexId(directory.phone),
      );
      await store.runTransaction(db, async (transaction) => {
        const [invitation, contact, profile, primaryName, fallbackNameClaim, phoneClaim] = await Promise.all([
          transaction.get(invitationRef),
          transaction.get(contactRef),
          transaction.get(profileRef),
          transaction.get(primaryNameRef),
          transaction.get(fallbackNameRef),
          transaction.get(phoneRef),
        ]);
        const guestName = profile.exists()
          ? profile.data().guestName
          : !primaryName.exists() || primaryName.data().guestUid === directory.guestUid
            ? displayName
            : fallbackName;
        const nameRef = guestName === displayName ? primaryNameRef : fallbackNameRef;
        const selectedNameClaim = guestName === displayName ? primaryName : fallbackNameClaim;
        if (selectedNameClaim.exists() && selectedNameClaim.data().guestUid !== directory.guestUid)
          throw new Error('name-conflict');
        if (phoneClaim.exists() && phoneClaim.data().guestUid !== directory.guestUid)
          throw new Error('phone-conflict');
        transaction.set(invitationRef, {
          eventId: event.id,
          hostUid: accountUser.uid,
          recipientUid: targetUid,
          recipientGuestUid: directory.guestUid,
          recipientEmail: directory.email,
          recipientPhone: directory.phone,
          createdAt: invitation.exists() ? invitation.data().createdAt : store.serverTimestamp(),
          updatedAt: store.serverTimestamp(),
        });
        transaction.set(contactRef, {
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
        if (!profile.exists()) {
          if (!selectedNameClaim.exists()) transaction.set(nameRef, {
            guestUid: directory.guestUid,
            guestName,
            createdAt: store.serverTimestamp(),
          });
          if (!phoneClaim.exists()) transaction.set(phoneRef, {
            guestUid: directory.guestUid,
            guestPhone: directory.phone,
            createdAt: store.serverTimestamp(),
          });
          transaction.set(profileRef, {
            guestUid: directory.guestUid,
            accountUid: targetUid,
            guestName,
            guestPhone: directory.phone,
            createdAt: store.serverTimestamp(),
            updatedAt: store.serverTimestamp(),
          });
        }
      });
      notify(`${displayName || directory.email} was invited`);
      return true;
    } catch (error) {
      const firebaseCode = (error as { code?: string }).code || '';
      const reason = (error as Error).message;
      notify(reason === 'not-registered' || reason === 'directory-missing'
        ? 'No completed Nights account matches that email or phone number'
        : reason === 'self'
          ? 'You already host this event'
          : reason === 'permission-denied' || firebaseCode === 'permission-denied' || firebaseCode === 'firestore/permission-denied'
            ? 'Invitations need the updated Firebase rules before they can be sent'
            : 'The invitation could not be sent. Try again.');
      return false;
    }
  };
  const selectGuestEvent = (access: GuestEventAccess) => {
    if (!guestSession) return;
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
  const openGuestEventPicker = async () => {
    if (!guestSession) {
      window.location.assign(guestHomeRoute());
      return;
    }
    setGuestEventPickerOpen(true);
    await loadGuestEvents(guestSession);
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
          notify('Sign in with the approved host account before creating an event');
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
        const nameRef = store.doc(db, 'events', menu.id, 'guest-names', await guestNameIndexId(name));
        const phoneRef = store.doc(db, 'events', menu.id, 'guest-phones', await guestNameIndexId(normalizedPhone));
        await store.runTransaction(db, async (transaction) => {
          const prior = await transaction.get(profileRef);
          const priorProfile = prior.data();
          const priorRsvp = await transaction.get(rsvpRef);
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
        await store.runTransaction(db, async (transaction) => {
          const [savedProfile, prior] = await Promise.all([transaction.get(profileRef), transaction.get(rsvpRef)]);
          if (!savedProfile.exists()) transaction.set(profileRef, {
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
        const batch = store.writeBatch(db);
        batch.delete(store.doc(db, 'events', menu.id, 'rsvps', rsvp.guestUid));
        batch.delete(store.doc(db, 'events', menu.id, 'guests', rsvp.guestUid));
        batch.delete(store.doc(db, 'events', menu.id, 'guest-names', await guestNameIndexId(rsvp.guestName)));
        batch.delete(store.doc(db, 'events', menu.id, 'guest-phones', await guestNameIndexId(rsvp.guestPhone)));
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
        await store.updateDoc(
          store.doc(store.getFirestore(getApp()), 'events', menu.id, 'rsvps', rsvp.guestUid),
          { approvalStatus: nextStatus, updatedAt: store.serverTimestamp() },
        );
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
        notify('Sign in with the approved host account before saving');
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
        ['orders', 'rsvps', 'guests', 'guest-names', 'guest-phones', 'name-index'].map((collectionName) =>
          store.getDocs(store.collection(db, 'events', event.id, collectionName)),
        ),
      )).flatMap((snapshot) => snapshot.docs);
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
      className={`app-root min-h-screen ${mode === 'host' ? 'host-mode' : 'guest-mode'}`}
      style={mode === 'guest' ? eventThemeStyle(menu) : undefined}
    >
      <header className="app-header sticky top-0 z-30 border-b border-black/8 bg-[var(--cream)]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5">
          <button
            onClick={() => {
              if (!isStandalone)
                window.location.assign(mode === 'host' ? hostHomeRoute() : guestHomeRoute());
            }}
            className="flex items-center gap-3"
            aria-label={mode === 'host' ? 'Nights Host home' : 'Open guest events'}
          >
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-[var(--tomato)] text-white">
              <Image src="/gathering/icons/gather-app-icon-180.png" alt="" width={36} height={36} />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              {mode === 'host' ? 'Nights Host' : 'Nights'}
            </span>
          </button>
          <div className="app-header-actions flex items-center gap-2">
            {mode === 'guest' && guestSession && (
              <button
                type="button"
                className="guest-event-switch-button"
                onClick={() => void openGuestEventPicker()}
                aria-label="Switch event"
              >
                <CalendarPlus size={15} />
                <span>Events</span>
                {guestEvents.length > 0 && <b>{guestEvents.length}</b>}
              </button>
            )}
            {!isStandalone && (
              <button
                onClick={openInstallGuide}
                className="install-app-button"
                aria-label={mode === 'host' ? 'Install Nights Host on iPhone' : 'Install Nights on iPhone'}
              >
                <Smartphone size={15} />
                <span>Install app</span>
              </button>
            )}
            {mode === 'host' && isStandalone && (
              <span className="host-app-badge">
                <Smartphone size={14} /> Nights Host
              </span>
            )}
            {accountProfile && (
              <>
                <button
                  type="button"
                  className="account-header-button persistent-delete-account"
                  onClick={() => {
                    setDeleteAccountConfirmation('');
                    setDeleteAccountPassword('');
                    setDeleteAccountOpen(true);
                  }}
                  title="Permanently delete account"
                >
                  <Trash2 size={15} /><span>Delete account</span>
                </button>
                <button type="button" className="account-header-button persistent-sign-out" onClick={() => void signOutAccount()} title={`Signed in as ${accountProfile.email}`}>
                  <UsersRound size={15} /><span>Sign out</span>
                </button>
              </>
            )}
            {menu.id !== EMPTY_EVENT_ID && <button
              type="button"
              onClick={() => void (pushNotificationState === 'enabled'
                ? disableChatNotifications()
                : enableChatNotifications())}
              disabled={!chatActor || pushNotificationBusy || pushNotificationState === 'unsupported'}
              className={`chat-header-button ${pushNotificationState === 'enabled' ? 'notification-enabled' : ''}`}
              title={pushNotificationState === 'enabled' ? 'Mute this event' : currentEventMuted ? 'Unmute this event' : 'Turn on notifications for all events'}
              aria-label={pushNotificationState === 'enabled' ? 'Mute this event' : currentEventMuted ? 'Unmute this event' : 'Turn on notifications for all events'}
            >
              {pushNotificationState === 'enabled' ? <BellRing size={16} /> : currentEventMuted ? <BellOff size={16} /> : <Bell size={16} />}
              <span>{pushNotificationState === 'enabled' ? 'Notifications on' : currentEventMuted ? 'Unmute event' : 'Notify me'}</span>
            </button>}
            {menu.id !== EMPTY_EVENT_ID && <button
              type="button"
              onClick={() => {
                primeChatAudio();
                setChatStarted(true);
                setChatOpen(true);
              }}
              disabled={!chatActor}
              className="chat-header-button"
              title={!chatActor && mode === 'guest' ? 'RSVP Going to join the chat' : undefined}
            >
              <MessageCircle size={16} />
              <span>{menu.chatOpen === false ? 'Chat locked' : 'Chat'}</span>
            </button>}
          </div>
        </div>
      </header>

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
            events={guestEvents}
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
          eventIncomingCounts={eventIncomingCounts}
          editing={editing}
          setEditing={setEditing}
          setMenu={setMenu}
          selectEvent={selectHostEvent}
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

      {deleteAccountOpen && accountProfile && (
        <div className="delete-account-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deleteAccountBusy) setDeleteAccountOpen(false);
        }}>
          <dialog open className="delete-account-dialog" aria-labelledby="delete-account-title">
            <span className="delete-account-icon"><Trash2 size={24} /></span>
            <p className="eyebrow">Permanent account deletion</p>
            <h2 id="delete-account-title" className="font-display">Delete everything?</h2>
            <p>This permanently removes your Nights login, profile, invitations, contacts, RSVPs, orders, messages, reactions, votes, notification registrations, and every event you host. It cannot be undone.</p>
            {accountUser?.providerIds.includes('password') && (
              <label className="field-label">Password
                <input
                  type="password"
                  value={deleteAccountPassword}
                  onChange={(event) => setDeleteAccountPassword(event.target.value)}
                  className="field-input"
                  autoComplete="current-password"
                  placeholder="Confirm your password"
                />
              </label>
            )}
            <label className="field-label">Type DELETE to confirm
              <input
                value={deleteAccountConfirmation}
                onChange={(event) => setDeleteAccountConfirmation(event.target.value.toUpperCase())}
                className="field-input"
                autoComplete="off"
                placeholder="DELETE"
              />
            </label>
            <div className="delete-account-actions">
              <button type="button" onClick={() => setDeleteAccountOpen(false)} disabled={deleteAccountBusy}>Keep account</button>
              <button type="button" className="danger-button" onClick={() => void deleteAccountPermanently()} disabled={deleteAccountBusy || deleteAccountConfirmation !== 'DELETE'}>
                {deleteAccountBusy ? 'Deleting everything…' : 'Delete account forever'}
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
          onOpen={() => {
            primeChatAudio();
            setChatOpen(true);
          }}
          onMinimize={() => setChatOpen(false)}
          pushNotificationState={pushNotificationState}
          eventMuted={currentEventMuted}
          pushNotificationBusy={pushNotificationBusy}
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
            completeProfile={() => void completeProviderProfile()}
          />
        </div>
      )}
      {creatingEvent && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/45 p-5 backdrop-blur-sm">
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
              <button
                onClick={() => setCreatingEvent(false)}
                className="icon-button"
                aria-label="Close new event"
              >
                <XCircle size={18} />
              </button>
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
      {showNotificationPrompt && (
        <div className="fixed inset-0 z-[85] grid place-items-end bg-black/45 p-3 backdrop-blur-sm sm:place-items-center sm:p-5">
          <section className="notification-onboarding-card">
            <span className="notification-onboarding-icon"><BellRing size={25} /></span>
            <p className="eyebrow">Stay in the loop</p>
            <h2 className="font-display">Turn on Nights notifications</h2>
            <p>Get chat and event updates for all of your events. You can mute any single event without affecting the others.</p>
            <button type="button" className="primary-button" disabled={pushNotificationBusy} onClick={() => void enableChatNotifications()}>
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
      {showInstallGuide && (
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
                : 'The blue and green Nights icon will reopen your guest dashboard at gaemaj.tech/nights-guests/. '}
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
      {mode === 'guest' && hasMenu && !submitted && (
        <div className="guest-cart-bar fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em]">
                Your table
              </p>
              <p className="font-display text-lg font-semibold">
                {menu.requireGuestApproval && myRsvp?.status === 'yes' && !guestHasEventAccess
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
                disabled={!count || !menu.accepting || myRsvp?.status !== 'yes' || !guestHasEventAccess}
                onClick={() =>
                  (
                    document.getElementById('checkout') as HTMLDialogElement
                  )?.showModal()
                }
                className="primary-button min-w-48 justify-center disabled:opacity-40"
              >
                <ShoppingBag size={17} /> Review order{' '}
                {count > 0 && <span className="count-badge">{count}</span>}
              </button>
            </div>
          </div>
        </div>
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
                  <div><p className="eyebrow">Your response</p><h2 className="font-display">RSVP for {menu.title}</h2></div>
                  {myRsvp && <span className={`rsvp-status ${menu.requireGuestApproval && myRsvp.status === 'yes' ? `approval-${approvalStatus(myRsvp)}` : `rsvp-${myRsvp.status}`}`}>{menu.requireGuestApproval && myRsvp.status === 'yes' && approvalStatus(myRsvp) !== 'approved' ? (approvalStatus(myRsvp) === 'pending' ? 'Pending approval' : 'Not approved') : myRsvp.status === 'yes' ? 'Going' : myRsvp.status === 'maybe' ? 'Maybe' : 'Not going'}</span>}
                </div>
                <div className="guest-profile-summary">
                  <div><strong>{effectiveGuestProfile.guestName}</strong><span>{formatPhone(effectiveGuestProfile.guestPhone)}</span></div>
                  <div><button type="button" onClick={() => setEditingGuestProfile(true)}>Edit Display Name</button><button type="button" onClick={clearGuestAccess}>Sign out</button></div>
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
  completeProfile: () => void;
};

function AccountAuthCard(props: AccountAuthCardProps) {
  const profileRequired = Boolean(props.user && !props.profile);
  const mode = profileRequired ? 'profile' : props.authMode;
  if (!props.authReady) {
    return (
      <section className="account-auth-card account-auth-loading" aria-live="polite">
        <span className="account-auth-logo"><Image src="/gathering/icons/gather-app-icon-180.png" alt="" width={58} height={58} /></span>
        <h2 className="font-display">Opening Nights…</h2>
      </section>
    );
  }
  return (
    <section className="account-auth-card">
      <div className="account-auth-heading">
        <span className="account-auth-logo"><Image src="/gathering/icons/gather-app-icon-180.png" alt="" width={58} height={58} /></span>
        <p className="eyebrow">{props.context === 'host' ? 'Nights Host' : 'Your nights, in one place'}</p>
        <h2 className="font-display">
          {mode === 'signup' ? 'Create your account' : mode === 'profile' ? 'Complete your profile' : 'Welcome back'}
        </h2>
        <p>
          {mode === 'signup'
            ? 'One account keeps your invitations, RSVPs, orders, and chats together.'
            : mode === 'profile'
              ? 'Add the details other guests and hosts will recognize.'
              : props.context === 'host'
                ? 'Sign in to create and manage your own events.'
                : 'Sign in to see every event you are invited to.'}
        </p>
      </div>
      {mode !== 'profile' && (
        <>
          <div className="account-provider-buttons">
            <button type="button" onClick={props.signInGoogle} disabled={props.busy} className="account-provider-button"><b>G</b> Continue with Google</button>
            <button type="button" onClick={props.signInApple} disabled={props.busy} className="account-provider-button account-provider-apple"><b>●</b> Continue with Apple</button>
          </div>
          <div className="account-auth-divider"><span>or use email</span></div>
        </>
      )}
      <div className="account-auth-fields">
        {mode !== 'signin' && (
          <div className="account-name-row">
            <label className="field-label">First name<input value={props.firstName} onChange={(event) => props.setFirstName(event.target.value)} className="field-input" autoComplete="name" /></label>
            <label className="field-label">Last name<input value={props.lastName} onChange={(event) => props.setLastName(event.target.value)} className="field-input" autoComplete="name" /></label>
          </div>
        )}
        {mode !== 'profile' && <label className="field-label">Email<input type="email" value={props.email} onChange={(event) => props.setEmail(event.target.value)} className="field-input" autoComplete="email" inputMode="email" placeholder="you@example.com" /></label>}
        {mode !== 'profile' && <label className="field-label">Password<input type="password" value={props.password} onChange={(event) => props.setPassword(event.target.value)} className="field-input" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} onKeyDown={(event) => { if (event.key === 'Enter') (mode === 'signup' ? props.signUpEmail : props.signInEmail)(); }} /></label>}
        {mode !== 'signin' && <label className="field-label">Phone number<input value={props.phone} onChange={(event) => props.setPhone(event.target.value)} className="field-input" autoComplete="tel" inputMode="tel" placeholder="555-555-5555" maxLength={12} /></label>}
      </div>
      {mode === 'signin' ? (
        <>
          <button type="button" className="primary-button account-auth-submit" disabled={props.busy || !props.email || !props.password} onClick={props.signInEmail}>{props.busy ? 'Signing in…' : 'Sign in'}</button>
          <div className="account-auth-links"><button type="button" onClick={props.resetPassword}>Forgot password?</button><button type="button" onClick={() => props.setAuthMode('signup')}>Create account</button></div>
        </>
      ) : mode === 'signup' ? (
        <>
          <button type="button" className="primary-button account-auth-submit" disabled={props.busy || !props.email || props.password.length < 8 || !props.firstName || !props.lastName || !props.phone} onClick={props.signUpEmail}>{props.busy ? 'Creating account…' : 'Create account'}</button>
          <div className="account-auth-links"><span>Already have an account?</span><button type="button" onClick={() => props.setAuthMode('signin')}>Sign in</button></div>
        </>
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
  events,
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
  completeProfile,
  selectEvent,
}: Omit<AccountAuthCardProps, 'context'> & {
  events: GuestEventAccess[];
  pendingEvent: PendingGuestEvent | null;
  selectEvent: (event: GuestEventAccess) => void;
}) {
  return (
    <section className="guest-access-portal">
      <div className="guest-access-intro">
        <span className="guest-access-mark"><Image src="/gathering/icons/gather-app-icon-180.png" alt="" width={62} height={62} /></span>
        <p className="eyebrow">Your nights, in one place</p>
        <h1 className="font-display">Your events</h1>
        <p>Use one secure account for every invitation, RSVP, order, and event chat.</p>
      </div>
      {!profile ? (
        <div className="guest-access-auth-shell">
          {pendingEvent && <div className="guest-invitation-cached"><Check size={17} /><span><strong>Invitation saved</strong><small>Sign in and this event will be added to your event list.</small></span></div>}
          <AccountAuthCard context="guest" authReady={authReady} user={user} profile={profile} authMode={authMode} email={email} password={password} firstName={firstName} lastName={lastName} phone={phone} busy={busy} setAuthMode={setAuthMode} setEmail={setEmail} setPassword={setPassword} setFirstName={setFirstName} setLastName={setLastName} setPhone={setPhone} signInEmail={signInEmail} signUpEmail={signUpEmail} signInGoogle={signInGoogle} signInApple={signInApple} resetPassword={resetPassword} completeProfile={completeProfile} />
        </div>
      ) : (
        <div className="guest-access-events">
          <div className="guest-access-signed-in">
            <span>Welcome, <strong>{accountDisplayName(profile)}</strong></span>
          </div>
          {events.length ? (
            <div className="guest-event-card-grid">
              {events.map((access) => (
                <GuestEventCard key={access.event.id} access={access} invited={Boolean(access.invitation || (pendingEvent && guestEventMatchesPending(access, pendingEvent)))} onSelect={() => selectEvent(access)} />
              ))}
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
  onSelect,
}: {
  access: GuestEventAccess;
  current?: boolean;
  invited?: boolean;
  onSelect: () => void;
}) {
  const response = access.rsvp
    ? access.rsvp.status === 'yes' ? 'Going' : access.rsvp.status === 'maybe' ? 'Maybe' : 'Not going'
    : invited ? 'New invitation' : 'Invited · RSVP not sent';
  return (
    <button type="button" className={`guest-event-card ${current ? 'current' : ''}`} onClick={onSelect}>
      <span className="guest-event-card-art" style={{ backgroundImage: `linear-gradient(145deg, rgb(32 157 139 / 0.82), rgb(31 88 163 / 0.82)), url(${eventBackground(access.event)})` }} />
      <span className="guest-event-card-copy">
        <small>{eventTypeLabel(access.event)}{current ? ' · Current event' : ''}</small>
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
              <GuestEventCard key={access.event.id} access={access} current={access.event.id === currentEventId} invited={Boolean(access.invitation)} onSelect={() => onSelect(access)} />
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
  const backgroundZoom = eventBackgroundZoom(menu);
  return (
    <div className={`guest-experience ${hasMenu ? 'pb-36' : ''}`}>
      <section className="guest-hero">
        <div
          className="guest-hero-photo"
          style={{
            backgroundImage: `url(${eventBackground(menu)})`,
            backgroundPosition: `${backgroundFocus.x}% ${backgroundFocus.y}%`,
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

function EventChat({
  menu,
  actor,
  visible,
  onOpen,
  onMinimize,
  pushNotificationState,
  eventMuted,
  pushNotificationBusy,
  onTogglePush,
  notify,
}: {
  menu: EventMenu;
  actor: ChatActor;
  visible: boolean;
  onOpen: () => void;
  onMinimize: () => void;
  pushNotificationState: PushNotificationState;
  eventMuted: boolean;
  pushNotificationBusy: boolean;
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
    if (!visible) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, visible]);

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
        endRef.current?.scrollIntoView({ block: 'end' });
        return;
      }
      const chronological = [...messages].sort(
        (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
      );
      const savedIndex = chronological.findIndex((message) => message.id === savedMessageId);
      const target = chronological[savedIndex + 1] || chronological[savedIndex];
      const targetElement = target ? messageRefs.current[target.id] : null;
      if (targetElement) targetElement.scrollIntoView({ block: 'center' });
      else endRef.current?.scrollIntoView({ block: 'end' });
      requestAnimationFrame(rememberReadPosition);
    });
  }, [messages, readPositionKey, rememberReadPosition, visible]);

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
      composerRef.current?.focus();
    });
  }, [menu.id, visible]);

  useEffect(() => () => {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
  }, []);

  const focusComposer = () => requestAnimationFrame(() => composerRef.current?.focus());

  const jumpToMessage = (messageId: string) => {
    const message = messageRefs.current[messageId];
    if (!message) return;
    message.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    return (
      <button type="button" className={`chat-minimized ${actor.role}`} onClick={onOpen} aria-label={`Open event chat${unread ? `, ${unread} unread` : ''}`}>
        <MessageCircle size={21} />
        {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
      </button>
    );
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
              {PUSH_NOTIFICATIONS_ENABLED && (
                <button
                  type="button"
                  className={pushNotificationState === 'enabled' ? 'enabled' : ''}
                  onClick={onTogglePush}
                  disabled={pushNotificationBusy || pushNotificationState === 'unsupported'}
                  aria-label={pushNotificationState === 'enabled'
                    ? 'Mute notifications for this event'
                    : eventMuted ? 'Unmute notifications for this event' : 'Turn on notifications for all events'}
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
  eventIncomingCounts,
  editing,
  setEditing,
  setMenu,
  selectEvent,
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
  notify,
}: {
  events: EventMenu[];
  menu: EventMenu;
  orders: Order[];
  rsvps: Rsvp[];
  contacts: HostContact[];
  eventIncomingCounts: Record<string, number>;
  editing: boolean;
  setEditing: (value: boolean) => void;
  setMenu: (menu: EventMenu) => void;
  selectEvent: (event: EventMenu) => void;
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
  inviteGuest: (event: EventMenu, identifier: string) => Promise<boolean>;
  notify: (message: string) => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
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
            onClick={() => setCreatingEvent(true)}
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
            <button
              onClick={() => setCreatingEvent(true)}
              className="primary-button"
            >
              <CalendarPlus size={17} /> Create an event
            </button>
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
                <a href={guestEventUrl(menu.id, automaticPublicEventPath(menu))} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  <span>Preview</span>
                </a>
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
      {inviteOpen && (
        <div className="invite-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !inviteBusy) setInviteOpen(false);
        }}>
          <dialog open className="invite-dialog" aria-label={`Invite guests to ${menu.title}`}>
            <header>
              <div><p className="eyebrow">Invite to</p><h2 className="font-display">{menu.title}</h2></div>
              <button type="button" className="icon-button" onClick={() => setInviteOpen(false)} disabled={inviteBusy} aria-label="Close invitations"><XCircle size={20} /></button>
            </header>
            <p className="invite-dialog-copy">Enter the email address or phone number connected to an existing Nights account.</p>
            <div className="invite-entry-row">
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
                    void inviteGuest(menu, inviteIdentifier).then((sent) => {
                      if (sent) setInviteIdentifier('');
                    }).finally(() => setInviteBusy(false));
                  }}
                />
              </label>
              <button type="button" className="primary-button" disabled={inviteBusy || !inviteIdentifier.trim()} onClick={() => {
                setInviteBusy(true);
                void inviteGuest(menu, inviteIdentifier).then((sent) => {
                  if (sent) setInviteIdentifier('');
                }).finally(() => setInviteBusy(false));
              }}><Send size={16} /> {inviteBusy ? 'Sending…' : 'Send invite'}</button>
            </div>
            <section className="host-contact-list">
              <div className="host-contact-list-heading"><BookUser size={17} /><div><strong>Contacts</strong><span>People you have invited before</span></div></div>
              {contacts.length ? (
                <div className="host-contact-list-scroll">
                  {contacts.map((contact) => {
                    const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
                    const identifier = contact.email || formatPhone(contact.phone);
                    return (
                      <button type="button" key={contact.accountUid} onClick={() => setInviteIdentifier(identifier)}>
                        <span className="host-contact-avatar">{name.slice(0, 1).toUpperCase()}</span>
                        <span><strong>{name}</strong><small>{contact.email}</small><small>{formatPhone(contact.phone)}</small></span>
                        <b>Invite</b>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="host-contact-empty">Your contacts will appear here after the first invitation.</p>}
            </section>
          </dialog>
        </div>
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
            <p id="background-crop-help">Drag to reposition. Pinch, scroll, or use the slider to zoom.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close background editor"><XCircle size={24} /></button>
        </header>
        <button
          type="button"
          className={`background-crop-viewport ${dragging ? 'is-dragging' : ''}`}
          aria-label="Background image framing area"
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
