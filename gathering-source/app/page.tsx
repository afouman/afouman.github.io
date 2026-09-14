'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  CalendarPlus,
  Camera,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Flame,
  GripVertical,
  ImagePlus,
  LayoutDashboard,
  Leaf,
  ListChecks,
  LockKeyhole,
  Minus,
  Pencil,
  Plus,
  Settings2,
  Share2,
  ShoppingBag,
  Smartphone,
  Sparkles,
  SquarePlus,
  Trash2,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react';

type EventResource = { id: string; name: string; capacity: number };
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
  title: string;
  date: string;
  startsAt?: string;
  welcome: string;
  accepting: boolean;
  categories?: string[];
  resources?: EventResource[];
  ownerUid?: string;
  items: MenuItem[];
};
type OrderStatus = 'new' | 'preparing' | 'served' | 'cancelled' | 'rejected';
type TaskStatus = 'waiting' | 'preparing' | 'ready' | 'served';
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
type Order = {
  id: string;
  guestName: string;
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
  welcome: 'Choose your favorites and we’ll have your plate ready.',
  accepting: true,
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
const HOST_EMAIL = process.env.NEXT_PUBLIC_HOST_EMAIL?.trim().toLowerCase();
const DEMO_EVENTS_KEY = 'gather-demo-events-v2';
const demoOrdersKey = (eventId: string) => `gather-demo-orders-v2:${eventId}`;
const DEMO_CHANNEL = 'gather-demo-sync';
const RECEIPTS_KEY = 'gather-order-receipts';
const RECEIPT_LIFETIME = 30 * 24 * 60 * 60 * 1000;
const DESCRIPTION_EXAMPLE = 'Add a short, tempting description';
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

function scheduleWaitingTasks(
  source: Order[],
  menu: EventMenu,
  now = Date.now(),
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
  const waiting = next
    .flatMap((order) =>
      (order.tasks || [])
        .filter((task) => task.status === 'waiting')
        .map((task) => ({ order, task })),
    )
    .sort(
      (a, b) =>
        a.order.createdAt - b.order.createdAt ||
        a.task.sequence - b.task.sequence,
    );
  for (const { task } of waiting) {
    const item = menu.items.find((entry) => entry.id === task.itemId);
    const requirements = Object.entries(item?.requirements || {}).filter(
      ([, units]) => units > 0,
    );
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
    task.status = 'preparing';
    task.startedAt = now;
    task.estimatedReadyAt = now + itemPrepMinutes(item) * 60000;
    for (const [resourceId, units] of requirements)
      usage[resourceId] = (usage[resourceId] || 0) + units;
  }
  return next;
}

type DemoUpdate =
  | { type: 'orders'; eventId: string; value: Order[] }
  | { type: 'events'; value: EventMenu[] };

function shareDemoUpdate(update: DemoUpdate) {
  const key =
    update.type === 'orders' ? demoOrdersKey(update.eventId) : DEMO_EVENTS_KEY;
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

export default function Home() {
  const [mode, setMode] = useState<'guest' | 'host'>('guest');
  const [menu, setMenu] = useState<EventMenu>(demoMenu);
  const [events, setEvents] = useState<EventMenu[]>([demoMenu]);
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [eventIncomingCounts, setEventIncomingCounts] = useState<Record<string, number>>({});
  const [eventReady, setEventReady] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [guestName, setGuestName] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(false);
  const [hostUser, setHostUser] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [rememberedOrder, setRememberedOrder] = useState<Order | null>(null);
  const [rememberedOrders, setRememberedOrders] = useState<Order[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [lastAction, setLastAction] = useState<'created' | 'updated'>(
    'created',
  );
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<EventMenu | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code' | 'verified'>(
    'idle',
  );
  const [phoneBusy, setPhoneBusy] = useState(false);
  const phoneConfirmation = useRef<{
    confirm: (code: string) => Promise<unknown>;
  } | null>(null);
  const phoneVerifier = useRef<{ clear: () => void } | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    welcome: 'Choose what you’d like and send your order to the host.',
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'host')
      queueMicrotask(() => setMode('host'));
    const eventId =
      new URLSearchParams(window.location.search).get('event') || demoMenu.id;
    queueMicrotask(() => setReceipts(readReceipts(eventId)));
  }, []);

  useEffect(() => {
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    queueMicrotask(() => setIsStandalone(installed));
    if (
      mode === 'host' &&
      location.protocol === 'https:' &&
      'serviceWorker' in navigator
    ) {
      // Changing this release marker causes a prompt service-worker update on
      // GitHub Pages, rather than waiting for the browser's periodic check.
      const serviceWorkerUrl = new URL('sw.js?v=2', document.baseURI);
      void navigator.serviceWorker
        .register(serviceWorkerUrl.href, { scope: './', updateViaCache: 'none' })
        .catch(() => undefined);
    }
  }, [mode]);

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
    const eventId =
      new URLSearchParams(window.location.search).get('event') || menu.id;
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
      if (!storedOrders)
        shareDemoUpdate({ type: 'orders', eventId, value: nextOrders });
      setEventReady(true);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === demoOrdersKey(eventId) && event.newValue)
        applyOrders(JSON.parse(event.newValue) as Order[]);
      if (event.key === DEMO_EVENTS_KEY && event.newValue)
        applyEvents(JSON.parse(event.newValue) as EventMenu[]);
    };
    const channel =
      'BroadcastChannel' in window ? new BroadcastChannel(DEMO_CHANNEL) : null;
    if (channel)
      channel.onmessage = (event: MessageEvent<DemoUpdate>) => {
        if (event.data.type === 'orders' && event.data.eventId === eventId)
          applyOrders(event.data.value);
        if (event.data.type === 'events') applyEvents(event.data.value);
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
    let stop = () => {};
    (async () => {
      const [appModule, authModule, store] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = appModule.getApps().length
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
      if (mode === 'guest' && !auth.currentUser)
        await authModule.signInAnonymously(auth);
      if (
        auth.currentUser &&
        !auth.currentUser.isAnonymous &&
        (!HOST_EMAIL || auth.currentUser.email?.toLowerCase() === HOST_EMAIL)
      )
        setHostUser(auth.currentUser.email || auth.currentUser.uid);
      const db = store.getFirestore(app);
      const eventId =
        new URLSearchParams(location.search).get('event') || menu.id;
      const unsubMenu = store.onSnapshot(
        store.doc(db, 'events', eventId),
        (snap) => {
          if (snap.exists()) setMenu({ id: snap.id, ...snap.data() } as EventMenu);
          setEventReady(true);
        },
      );
      let unsubOrders = () => {};
      let unsubEvents = () => {};
      let unsubEventOrderCounts: (() => void)[] = [];
      const unsubRememberedOrders: (() => void)[] = [];
      if (
        mode === 'host' &&
        auth.currentUser &&
        !auth.currentUser.isAnonymous
      ) {
        unsubEvents = store.onSnapshot(
          store.query(
            store.collection(db, 'events'),
            store.where('ownerUid', '==', auth.currentUser.uid),
          ),
          (snap) => {
            const ownedEvents = snap.docs.map(
              (d) => ({ id: d.id, ...d.data() }) as EventMenu,
            );
            setEvents(ownedEvents);
            unsubEventOrderCounts.forEach((unsubscribe) => unsubscribe());
            unsubEventOrderCounts = ownedEvents.map((event) =>
              store.onSnapshot(
                store.collection(db, 'events', event.id, 'orders'),
                (ordersSnapshot) =>
                  setEventIncomingCounts((current) => ({
                    ...current,
                    [event.id]: ordersSnapshot.docs.filter(
                      (entry) => entry.data().status === 'new',
                    ).length,
                  })),
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
                `?view=host&event=${ownedEvents[0].id}`,
              );
            }
          },
        );
        unsubOrders = store.onSnapshot(
          store.query(
            store.collection(db, 'events', eventId, 'orders'),
            store.orderBy('createdAt', 'desc'),
          ),
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
              ),
            ),
        );
      }
      if (mode === 'guest' && receipts.length) {
        receipts.forEach((receipt) => {
          unsubRememberedOrders.push(
            store.onSnapshot(
              store.doc(db, 'events', eventId, 'orders', receipt.orderId),
              (snap) =>
                setRememberedOrders((current) => {
                  const withoutThis = current.filter((order) => order.id !== receipt.orderId);
                  if (!snap.exists()) return withoutThis;
                  const order = {
                    id: snap.id,
                    ...snap.data(),
                    createdAt: snap.data().createdAt?.toMillis?.() ?? receipt.createdAt,
                    updatedAt: snap.data().updatedAt?.toMillis?.(),
                    cancelledAt: snap.data().cancelledAt?.toMillis?.(),
                    readyAt: snap.data().readyAt?.toMillis?.(),
                  } as Order;
                  return [...withoutThis, order].sort((a, b) => b.createdAt - a.createdAt);
                }),
            ),
          );
        });
      }
      stop = () => {
        unsubMenu();
        unsubEvents();
        unsubEventOrderCounts.forEach((unsubscribe) => unsubscribe());
        unsubOrders();
        unsubRememberedOrders.forEach((unsubscribe) => unsubscribe());
      };
    })().catch(() =>
      setToast('Could not connect to live orders. Showing the preview.'),
    );
    return () => stop();
  }, [mode, hostUser, receipts, menu.id]);

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
  }, [menu.items]);

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const categories = useMemo(
    () => [...new Set(menu.items.map((i) => i.category))],
    [menu.items],
  );
  const setQty = (id: string, delta: number) =>
    setCart((current) => {
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
  const switchMode = (next: 'guest' | 'host') => {
    setMode(next);
    history.replaceState(
      {},
      '',
      next === 'host' ? `?view=host&event=${menu.id}` : `?event=${menu.id}`,
    );
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
    history.replaceState({}, '', `?view=host&event=${event.id}`);
  }

  async function createEvent() {
    if (!newEvent.title.trim() || !newEvent.date.trim()) {
      notify('Add an event name and date before creating the menu');
      return;
    }
    const baseSlug =
      newEvent.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36) || 'event';
    const event: EventMenu = {
      id: `${baseSlug}-${crypto.randomUUID().slice(0, 5)}`,
      title: newEvent.title.trim(),
      date: formatDateTime(newEvent.date),
      startsAt: newEvent.date,
      welcome: newEvent.welcome.trim(),
      accepting: false,
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
    };
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
        await store.setDoc(
          store.doc(store.getFirestore(getApp()), 'events', event.id),
          event,
        );
      } else {
        const nextEvents = [...events, event];
        setEvents(nextEvents);
        shareDemoUpdate({ type: 'events', value: nextEvents });
        shareDemoUpdate({ type: 'orders', eventId: event.id, value: [] });
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(
        code === 'permission-denied'
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
      welcome: 'Choose what you’d like and send your order to the host.',
    });
    history.replaceState({}, '', `?view=host&event=${event.id}`);
    notify('Event created — now finish the menu');
  }

  function beginOrderEdit(order: Order) {
    setCart({ ...order.selections });
    setGuestName(order.guestName);
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
      setGuestName('');
      setNote('');
    }, 2400);
  }

  async function submitOrder() {
    if (!menu.accepting) {
      notify('This event is not accepting orders right now');
      return;
    }
    if (!guestName.trim() || count === 0) return;
    if (phoneNumber.trim() && phoneStep !== 'verified') {
      notify('Verify the text code first, or clear the optional phone number');
      return;
    }
    // Names are deliberately not globally searchable by guests. Instead, when
    // a shared device has already placed an active order for this name, let the
    // person decide whether to add dishes to that order or create another one.
    if (!editingOrderId) {
      const existingOrder = rememberedOrders
        .filter(
          (order) =>
            order.status === 'new' &&
            guestNameKey(order.guestName) === guestNameKey(guestName),
        )
        .sort((left, right) => right.createdAt - left.createdAt)[0];
      if (existingOrder) {
        const sameGuest = window.confirm(
          `${existingOrder.guestName} already has an active order on this device. Is this the same guest?\n\nChoose OK to add these items to their existing order, or Cancel to create a separate order.`,
        );
        if (sameGuest) {
          const selections = { ...existingOrder.selections };
          Object.entries(cart).forEach(([itemId, quantity]) => {
            selections[itemId] = (selections[itemId] || 0) + quantity;
          });
          const amended: Order = {
            ...existingOrder,
            selections,
            note: note.trim() || existingOrder.note,
            updatedAt: Date.now(),
            revision: (existingOrder.revision || 1) + 1,
          };
          if (firebaseConfigured) {
            const [{ getApp }, store] = await Promise.all([
              import('firebase/app'),
              import('firebase/firestore'),
            ]);
            await store.updateDoc(
              store.doc(
                store.getFirestore(getApp()),
                'events',
                menu.id,
                'orders',
                existingOrder.id,
              ),
              {
                selections,
                note: amended.note,
                updatedAt: store.serverTimestamp(),
                revision: store.increment(1),
              },
            );
          } else {
            const next = orders.map((order) =>
              order.id === amended.id ? amended : order,
            );
            setOrders(next);
            shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
          }
          setRememberedOrder(amended);
          setRememberedOrders((current) =>
            current.map((order) =>
              order.id === amended.id ? amended : order,
            ),
          );
          showSubmissionConfirmation('updated');
          return;
        }
      }
    }
    if (editingOrderId && rememberedOrder) {
      const updated: Order = {
        ...rememberedOrder,
        guestName: guestName.trim(),
        selections: cart,
        note: note.trim(),
        updatedAt: Date.now(),
        revision: (rememberedOrder.revision || 1) + 1,
      };
      if (firebaseConfigured) {
        const [{ getApp }, store] = await Promise.all([
          import('firebase/app'),
          import('firebase/firestore'),
        ]);
        await store.updateDoc(
          store.doc(
            store.getFirestore(getApp()),
            'events',
            menu.id,
            'orders',
            editingOrderId,
          ),
          {
            guestName: updated.guestName,
            selections: updated.selections,
            note: updated.note,
            updatedAt: store.serverTimestamp(),
            revision: store.increment(1),
          },
        );
      } else {
        const next = orders.map((order) =>
          order.id === editingOrderId ? updated : order,
        );
        setOrders(next);
        shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
        setRememberedOrder(updated);
      }
      showSubmissionConfirmation('updated');
      return;
    }
    const createdAt = Date.now();
    const orderId = crypto.randomUUID();
    let guestUid = 'preview-device';
    if (firebaseConfigured) {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      const auth = authModule.getAuth(getApp());
      if (!auth.currentUser) await authModule.signInAnonymously(auth);
      guestUid = auth.currentUser!.uid;
    }
    const newOrder: Order = {
      id: orderId,
      guestName: guestName.trim(),
      selections: cart,
      note: note.trim(),
      status: 'new',
      createdAt,
      updatedAt: createdAt,
      guestUid,
      revision: 1,
    };
    if (firebaseConfigured) {
      const [{ getApp }, store] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
      ]);
      await store.setDoc(
        store.doc(
          store.getFirestore(getApp()),
          'events',
          menu.id,
          'orders',
          orderId,
        ),
        {
          ...newOrder,
          createdAt: store.serverTimestamp(),
          updatedAt: store.serverTimestamp(),
        },
      );
    } else {
      const next = [newOrder, ...orders];
      setOrders(next);
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
      setRememberedOrders((current) => [newOrder, ...current]);
    }
    const savedReceipt = saveReceipt(menu.id, orderId, createdAt);
    setReceipts((current) => [...current.filter((entry) => entry.orderId !== savedReceipt.orderId), savedReceipt]);
    setRememberedOrder(newOrder);
    setRememberedOrders((current) => [newOrder, ...current.filter((order) => order.id !== newOrder.id)]);
    showSubmissionConfirmation('created');
  }
  async function sendPhoneCode() {
    if (!firebaseConfigured || !phoneNumber.trim()) return;
    setPhoneBusy(true);
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      const auth = authModule.getAuth(getApp());
      if (!auth.currentUser) await authModule.signInAnonymously(auth);
      phoneVerifier.current?.clear();
      const verifier = new authModule.RecaptchaVerifier(
        auth,
        'phone-recaptcha',
        { size: 'invisible' },
      );
      phoneVerifier.current = verifier;
      phoneConfirmation.current = await authModule.linkWithPhoneNumber(
        auth.currentUser!,
        phoneNumber.trim(),
        verifier,
      );
      setPhoneStep('code');
      notify('A verification code was sent');
    } catch {
      phoneVerifier.current?.clear();
      notify('Could not send a code. Check the number and try again.');
    } finally {
      setPhoneBusy(false);
    }
  }
  async function verifyPhoneCode() {
    if (!phoneConfirmation.current || !phoneCode.trim()) return;
    setPhoneBusy(true);
    try {
      await phoneConfirmation.current.confirm(phoneCode.trim());
      setPhoneStep('verified');
      notify('Phone number verified for this order');
    } catch {
      notify('That verification code did not work. Try again.');
    } finally {
      setPhoneBusy(false);
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

  async function acceptOrder(order: Order) {
    const accepted = orders.map((entry) =>
      entry.id === order.id
        ? {
            ...entry,
            status: 'preparing' as OrderStatus,
            tasks: entry.tasks?.length ? entry.tasks : createOrderTasks(entry),
          }
        : entry,
    );
    await persistScheduledOrders(scheduleWaitingTasks(accepted, menu));
    notify(`${order.guestName}'s items were added to the production queue`);
  }

  async function rejectOrder(order: Order) {
    const rejected = { ...order, status: 'rejected' as OrderStatus, updatedAt: Date.now() };
    if (firebaseConfigured) {
      const [{ getApp }, store] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
      await store.updateDoc(store.doc(store.getFirestore(getApp()), 'events', menu.id, 'orders', order.id), {
        status: 'rejected', updatedAt: store.serverTimestamp(),
      });
    } else {
      const next = orders.map((entry) => entry.id === order.id ? rejected : entry);
      setOrders(next);
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
    }
    notify(`${order.guestName}'s order was rejected`);
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
    } else {
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: [] });
    }
    setOrders([]);
    setRememberedOrders([]);
    notify('Order history cleared');
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
    await persistScheduledOrders(scheduleWaitingTasks(released, menu));
    notify('Item ready — the next available task has been started');
  }

  async function serveTask(orderId: string, taskId: string) {
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
          tasks.length > 0 && tasks.every((task) => task.status === 'served')
            ? ('served' as OrderStatus)
            : order.status,
      };
    });
    await persistScheduledOrders(next);
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
      await store.updateDoc(
        store.doc(
          store.getFirestore(getApp()),
          'events',
          menu.id,
          'orders',
          rememberedOrder.id,
        ),
        {
          status: 'cancelled',
          cancelledAt: store.serverTimestamp(),
          updatedAt: store.serverTimestamp(),
          revision: store.increment(1),
        },
      );
    } else {
      const next = orders.map((order) =>
        order.id === cancelled.id ? cancelled : order,
      );
      setOrders(next);
      shareDemoUpdate({ type: 'orders', eventId: menu.id, value: next });
      setRememberedOrder(cancelled);
    }
    setConfirmingCancel(false);
    notify('Your order was cancelled');
  }
  async function signInHost() {
    try {
      const [{ getApp }, authModule] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      const provider = new authModule.GoogleAuthProvider();
      // Do not silently reuse the Firebase-console account in a shared browser.
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await authModule.signInWithPopup(
        authModule.getAuth(getApp()),
        provider,
      );
      if (
        HOST_EMAIL &&
        result.user.email?.toLowerCase() !== HOST_EMAIL
      ) {
        await authModule.signOut(authModule.getAuth(getApp()));
        notify(`Use the approved host account: ${HOST_EMAIL}`);
        return;
      }
      setHostUser(result.user.email || result.user.uid);
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(
        code === 'auth/unauthorized-domain'
          ? 'Firebase must authorize afouman.github.io before Google sign-in can work.'
          : code === 'auth/popup-closed-by-user'
            ? 'Google sign-in was closed before it completed.'
            : 'Google sign-in could not be completed. Please try again.',
      );
    }
  }
  async function saveMenu() {
    const cleanedMenu = {
      ...menu,
      items: menu.items.map((item) => ({
        ...item,
        description: itemDescription(item),
      })),
    };
    setMenu(cleanedMenu);
    if (!firebaseConfigured) {
      const nextEvents = events.some((event) => event.id === cleanedMenu.id)
        ? events.map((event) =>
            event.id === cleanedMenu.id ? cleanedMenu : event,
          )
        : [...events, cleanedMenu];
      const scheduledOrders = scheduleWaitingTasks(orders, cleanedMenu);
      setEvents(nextEvents);
      setOrders(scheduledOrders);
      shareDemoUpdate({ type: 'events', value: nextEvents });
      shareDemoUpdate({
        type: 'orders',
        eventId: cleanedMenu.id,
        value: scheduledOrders,
      });
      setEditing(false);
      notify('Event and menu saved for every open tab');
      return;
    }
    const [{ getApp }, store, authModule] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
      import('firebase/auth'),
    ]);
    const user = authModule.getAuth(getApp()).currentUser;
    if (!user || user.isAnonymous) return;
    await store.setDoc(
      store.doc(store.getFirestore(getApp()), 'events', cleanedMenu.id),
      { ...cleanedMenu, ownerUid: user.uid },
      { merge: true },
    );
    await persistScheduledOrders(scheduleWaitingTasks(orders, cleanedMenu));
    setEditing(false);
    notify('Menu saved');
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
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const source = URL.createObjectURL(file);
      const image = new window.Image();
      image.onload = () => {
        const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = Math.min(1, 900 / longestSide);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(source);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.onerror = () => {
        URL.revokeObjectURL(source);
        reject(new Error('Could not read image'));
      };
      image.src = source;
    });
    const otherImageBytes = menu.items
      .filter((item) => item.id !== itemId)
      .reduce((total, item) => total + (item.imageUrl?.startsWith('data:') ? item.imageUrl.length : 0), 0);
    if (imageUrl.length > 180_000 || otherImageBytes + imageUrl.length > 700_000) {
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
      for (let index = 0; index < orders.length; index += 400) {
        const batch = store.writeBatch(db);
        orders
          .slice(index, index + 400)
          .forEach((order) =>
            batch.delete(store.doc(db, 'events', event.id, 'orders', order.id)),
          );
        await batch.commit();
      }
      await store.deleteDoc(store.doc(db, 'events', event.id));
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
    else history.replaceState({}, '', '?view=host');
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
    >
      <header className="app-header sticky top-0 z-30 border-b border-black/8 bg-[var(--cream)]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5">
          <button
            onClick={() => !isStandalone && switchMode('guest')}
            className="flex items-center gap-3"
            aria-label={isStandalone ? 'Gather Host home' : 'Open guest menu'}
          >
            <span className="grid size-9 place-items-center rounded-full bg-[var(--tomato)] text-white">
              <UtensilsCrossed size={17} />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              Gather
            </span>
          </button>
          <div className="flex items-center gap-2">
            <span
              className={`hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex ${firebaseConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
            >
              <span
                className={`size-2 rounded-full ${firebaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
              />
              {firebaseConfigured ? 'Live' : 'Preview data'}
            </span>
            {mode === 'host' && !isStandalone && (
              <button
                onClick={() => setShowInstallGuide(true)}
                className="install-app-button"
                aria-label="Install Gather Host on iPhone"
              >
                <Smartphone size={15} />
                <span>Install app</span>
              </button>
            )}
            {mode === 'host' && isStandalone && (
              <span className="host-app-badge">
                <Smartphone size={14} /> Host app
              </span>
            )}
            {!isStandalone && (
              <button
                onClick={() => switchMode(mode === 'guest' ? 'host' : 'guest')}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:-translate-y-px hover:shadow-md"
              >
                {mode === 'guest' ? (
                  <span className="flex items-center gap-2">
                    <LayoutDashboard size={15} /> Host view
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ExternalLink size={15} /> Guest view
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {mode === 'guest' ? (
        <GuestMenu
          menu={menu}
          categories={categories}
          cart={cart}
          reserved={rememberedOrders.filter((order) => order.id !== editingOrderId)}
          setQty={setQty}
        />
      ) : (
        <HostWorkspace
          events={events}
          menu={menu}
          orders={orders}
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
          acceptOrder={acceptOrder}
          rejectOrder={rejectOrder}
          clearOrderHistory={clearOrderHistory}
          finishTask={finishTask}
          serveTask={serveTask}
          setAccepting={setEventAccepting}
          notify={notify}
        />
      )}

      {mode === 'host' && firebaseConfigured && !hostUser && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--cream)]/96 p-6 backdrop-blur">
          <div className="max-w-sm text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--ink)] text-white">
              <LockKeyhole size={26} />
            </span>
            <h2 className="font-display mt-6 text-4xl font-semibold">
              For the host only
            </h2>
            <p className="mt-3 text-black/55">
              Sign in with the Google account that owns this event to see
              incoming orders.
            </p>
            <button
              onClick={() => void signInHost()}
              className="primary-button mx-auto mt-7"
            >
              Continue with Google
            </button>
            <button
              onClick={() => switchMode('guest')}
              className="mt-4 block w-full text-sm font-semibold text-black/45"
            >
              Back to the menu
            </button>
          </div>
        </div>
      )}
      {creatingEvent && (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/45 p-5 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-3xl bg-[var(--cream)] p-7 shadow-2xl sm:p-9">
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
            <label className="field-label mt-5">
              Event date and time
              <input
                type="datetime-local"
                value={newEvent.date}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, date: e.target.value })
                }
                className="field-input date-time-input"
              />
            </label>
            <label className="field-label mt-5">
              Guest welcome message
              <textarea
                value={newEvent.welcome}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, welcome: e.target.value })
                }
                className="field-input min-h-24 resize-none"
              />
            </label>
            <button
              disabled={!newEvent.title.trim() || !newEvent.date.trim()}
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
      {showInstallGuide && (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-black/45 p-3 backdrop-blur-sm sm:place-items-center sm:p-5">
          <section className="install-guide">
            <div className="flex items-start justify-between gap-4">
              <span className="install-guide-icon">
                <Smartphone size={25} />
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
              Add Gather Host to your Home Screen
            </h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              Open this host page in Safari, then follow these two steps.
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
              The icon will open directly to your private host dashboard. Guest
              menu links stay regular web pages.
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
      {mode === 'guest' && !submitted && (
        <div className="guest-cart-bar fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.18em]">
                Your table
              </p>
              <p className="font-display text-lg font-semibold">
                {menu.accepting
                  ? count
                    ? `${count} dish${count === 1 ? '' : 'es'} selected`
                    : 'Choose what calls to you'
                  : 'Ordering is closed'}
              </p>
            </div>
            <button
              disabled={!count || !menu.accepting}
              onClick={() =>
                (
                  document.getElementById('checkout') as HTMLDialogElement
                )?.showModal()
              }
              className="primary-button ml-auto min-w-48 justify-center disabled:opacity-40"
            >
              <ShoppingBag size={17} /> Review order{' '}
              {count > 0 && <span className="count-badge">{count}</span>}
            </button>
          </div>
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
                {editingOrderId ? 'Edit your order' : 'Who’s this for?'}
              </h2>
            </div>
            <button className="icon-button" aria-label="Close">
              <ArrowLeft size={18} />
            </button>
          </div>
          <label className="field-label">
            Name for the order
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="field-input"
              placeholder="e.g. Maya, or The Parkers"
              autoFocus
            />
          </label>
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
          {firebaseConfigured && !editingOrderId && (
            <section className="mt-5 rounded-2xl border border-black/8 bg-white/60 p-4">
              <p className="text-sm font-semibold">Phone number <span className="font-normal text-black/40">Optional</span></p>
              <p className="mt-1 text-xs leading-5 text-black/50">
                Verify by text to make this order easier to recognize on this device.
              </p>
              {phoneStep === 'verified' ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Check size={16} /> Number verified
                </p>
              ) : phoneStep === 'code' ? (
                <div className="mt-3 flex gap-2">
                  <input
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    className="field-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Verification code"
                  />
                  <button type="button" onClick={() => void verifyPhoneCode()} disabled={phoneBusy || !phoneCode.trim()} className="secondary-button whitespace-nowrap disabled:opacity-40">
                    Verify
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="field-input"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+1 555 555 5555"
                  />
                  <button type="button" onClick={() => void sendPhoneCode()} disabled={phoneBusy || !phoneNumber.trim()} className="secondary-button whitespace-nowrap disabled:opacity-40">
                    Text code
                  </button>
                </div>
              )}
              <div id="phone-recaptcha" />
            </section>
          )}
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
            disabled={!guestName.trim() || count === 0}
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

function GuestMenu({
  menu,
  categories,
  cart,
  reserved,
  setQty,
}: {
  menu: EventMenu;
  categories: string[];
  cart: Record<string, number>;
  reserved: Order[];
  setQty: (id: string, delta: number) => void;
}) {
  return (
    <div className="guest-experience pb-36">
      <section className="guest-hero">
        <div className="guest-hero-photo" />
        <div className="guest-hero-shade" />
        <div className="guest-hero-content">
          <div className="guest-invite-mark">
            <span>Private table</span>
            <i />
          </div>
          <p className="guest-kicker">You’re invited</p>
          <h1 className="font-display">{menu.title}</h1>
          <p className="guest-welcome">{menu.welcome}</p>
          <div className="guest-event-meta">
            <div>
              <span>When</span>
              <strong>{menu.date}</strong>
            </div>
            <div
              className={`guest-order-state ${menu.accepting ? 'open' : 'closed'}`}
            >
              <i />
              {menu.accepting ? 'Orders are open' : 'Ordering has closed'}
            </div>
          </div>
        </div>
        <div className="guest-scroll-cue">
          <span>Explore the menu</span>
          <i />
        </div>
      </section>
      <section className="guest-menu-shell">
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
                        disabled={!cart[item.id] || !menu.accepting || unavailable}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Minus size={15} />
                      </button>
                      <span>{cart[item.id] || 0}</span>
                      <button
                        onClick={() => setQty(item.id, 1)}
                        disabled={!menu.accepting || unavailable || remaining === 0 || atGuestLimit}
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
      </section>
    </div>
  );
}

function HostWorkspace({
  events,
  menu,
  orders,
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
  acceptOrder,
  rejectOrder,
  clearOrderHistory,
  finishTask,
  serveTask,
  setAccepting,
  notify,
}: {
  events: EventMenu[];
  menu: EventMenu;
  orders: Order[];
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
  acceptOrder: (order: Order) => Promise<void>;
  rejectOrder: (order: Order) => Promise<void>;
  clearOrderHistory: () => Promise<void>;
  finishTask: (orderId: string, taskId: string) => Promise<void>;
  serveTask: (orderId: string, taskId: string) => Promise<void>;
  setAccepting: (accepting: boolean) => Promise<void>;
  notify: (message: string) => void;
}) {
  const activeOrders = orders.filter(
    (order) => order.status === 'new' || order.status === 'preparing',
  ).length;
  return (
    <div className="host-workspace">
      <div className="host-inner">
        <header className="host-page-heading">
          <div>
            <p className="eyebrow">Gather service</p>
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
                  <span
                    className={`event-dot ${event.accepting ? 'open' : ''}`}
                  />
                  <span className="event-state">
                    {event.accepting ? 'Live' : 'Closed'}
                  </span>
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
                  <span>Code · {menu.id}</span>
                </div>
              </div>
              <div
                className={`order-gate ${menu.accepting ? 'open' : 'closed'}`}
              >
                <div>
                  <span className="order-gate-light" />
                  <p>
                    {menu.accepting
                      ? 'Guest ordering is live'
                      : 'Guest ordering is paused'}
                  </p>
                  <small>
                    {menu.accepting
                      ? 'New orders appear here instantly.'
                      : 'Existing tickets stay active.'}
                  </small>
                </div>
                <button onClick={() => void setAccepting(!menu.accepting)}>
                  {menu.accepting ? (
                    <>
                      <XCircle size={17} /> Stop orders
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} /> Open orders
                    </>
                  )}
                </button>
              </div>
              <div className="host-actions">
                <a href={`?event=${menu.id}`} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  <span>Preview</span>
                </a>
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(
                      `${location.origin}${location.pathname}?event=${menu.id}`,
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
                  menu={menu}
                  acceptOrder={acceptOrder}
                  rejectOrder={rejectOrder}
                  clearOrderHistory={clearOrderHistory}
                  finishTask={finishTask}
                  serveTask={serveTask}
                />
              </>
            )}
          </>
        )}
      </div>
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
                {entry.guestName || 'Guest'}
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
  menu,
  acceptOrder,
  rejectOrder,
  clearOrderHistory,
  finishTask,
  serveTask,
}: {
  orders: Order[];
  menu: EventMenu;
  acceptOrder: (order: Order) => Promise<void>;
  rejectOrder: (order: Order) => Promise<void>;
  clearOrderHistory: () => Promise<void>;
  finishTask: (orderId: string, taskId: string) => Promise<void>;
  serveTask: (orderId: string, taskId: string) => Promise<void>;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    queueMicrotask(() => setNow(Date.now()));
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const usage = resourceUsage(orders, menu);
  const incoming = orders
    .filter(
      (order) =>
        order.status === 'new' ||
        (order.status === 'preparing' && !order.tasks?.length),
    )
    .sort((a, b) => a.createdAt - b.createdAt);
  const taskViews = orders.flatMap((order) =>
    (order.tasks || []).map((task) => ({
      order,
      task,
      item: menu.items.find((item) => item.id === task.itemId),
    })),
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
      const key = order.guestName.trim().toLowerCase() || 'unnamed guest';
      const group = groups[key] || {
        guestName: order.guestName,
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
      hint: 'Resources assigned',
      icon: Flame,
    },
    {
      status: 'waiting',
      label: 'Waiting',
      hint: 'FCFS when capacity opens',
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
    const blocked = resourcesFor(item).filter(
      ({ resource, units }) =>
        !resource || resource.capacity - (usage[resource.id] || 0) < units,
    );
    return blocked.length
      ? `Waiting for ${blocked.map(({ resource }) => resource?.name || 'a removed resource').join(' + ')}`
      : 'Next in first-come order';
  };
  return (
    <div className="scheduler-shell">
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
                      {Math.max(0, resource.capacity - used)} free · {used} in
                      use
                    </span>
                  </div>
                  <div
                    className="capacity-dots"
                    aria-label={`${used} of ${resource.capacity} in use`}
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
          <span>{incoming.length} waiting</span>
        </header>
        {incoming.length ? (
          <div className="incoming-grid">
            {incoming.map((order) => (
              <article key={order.id} className="incoming-ticket">
                <div className="ticket-top">
                  <div>
                    <span suppressHydrationWarning>
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    <h4 className="font-display">{order.guestName}</h4>
                  </div>
                  <i />
                </div>
                <ul>
                  {Object.entries(order.selections)
                    .filter(([, quantity]) => quantity > 0)
                    .map(([itemId, quantity]) => (
                      <li key={itemId}>
                        <b>{quantity}×</b>
                        {menu.items.find((item) => item.id === itemId)?.name ||
                          'Menu item'}
                      </li>
                    ))}
                </ul>
                {order.note && <p>“{order.note}”</p>}
                <div className="incoming-actions">
                  <button onClick={() => void acceptOrder(order)}>
                    <Sparkles size={15} /> Accept
                  </button>
                  <button
                    className="reject-order"
                    onClick={() => void rejectOrder(order)}
                  >
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="pipeline-empty compact">
            New guest orders will appear here automatically.
          </div>
        )}
      </section>
      <div className="pipeline-grid">
        {lanes.map((lane) => {
          const tasks = sortedTasks(lane.status);
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
                <b>{tasks.length}</b>
              </header>
              <div className="pipeline-stack">
                {tasks.map(({ order, task, item }) => {
                  const siblings = (order.tasks || []).filter(
                    (entry) => entry.itemId === task.itemId,
                  );
                  const unit =
                    siblings.findIndex((entry) => entry.id === task.id) + 1;
                  return (
                    <article key={task.id} className="task-ticket">
                      <div className="task-priority">
                        <span>{order.guestName}</span>
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
                      {lane.status === 'waiting' && (
                        <p className="wait-reason">
                          <Clock3 size={13} />
                          {waitReason(item)}
                        </p>
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
                {!tasks.length && (
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
                  `${view.item?.name || 'Item'} for ${view.order.guestName}`,
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

function MenuEditor({
  menu,
  orders,
  setMenu,
  saveMenu,
  cancelMenuEdits,
  uploadItemImage,
}: {
  menu: EventMenu;
  orders: Order[];
  setMenu: (menu: EventMenu) => void;
  saveMenu: () => Promise<void>;
  cancelMenuEdits: () => Promise<void>;
  uploadItemImage: (itemId: string, file: File) => Promise<void>;
}) {
  const [addingCategoryFor, setAddingCategoryFor] = useState<string | null>(
    null,
  );
  const [newCategory, setNewCategory] = useState('');
  const [resourceDrafts, setResourceDrafts] = useState<Record<string, string>>(
    {},
  );
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
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
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="field-label">
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
      </div>
      <label className="field-label mt-5">
        Welcome message
        <input
          className="field-input"
          value={menu.welcome}
          onChange={(e) => setMenu({ ...menu, welcome: e.target.value })}
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
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, 'prepMinutes', Math.max(1, (item.prepMinutes ?? 10) - 1))}
                      aria-label={`Decrease ${item.name || 'dish'} preparation time`}
                    ><Minus size={14} /></button>
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
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, 'prepMinutes', Math.min(240, (item.prepMinutes ?? 10) + 1))}
                      aria-label={`Increase ${item.name || 'dish'} preparation time`}
                    ><Plus size={14} /></button>
                    <b>min</b>
                  </div>
                </label>
                <label>
                  <span>Total servings for this event</span>
                  <div className="prep-input">
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, 'maxServings', Math.max(0, (item.maxServings ?? 0) - 1))}
                      aria-label={`Decrease ${item.name || 'dish'} servings`}
                    ><Minus size={14} /></button>
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
                    <button
                      type="button"
                      onClick={() => updateItem(item.id, 'maxServings', Math.min(999, (item.maxServings ?? 0) + 1))}
                      aria-label={`Increase ${item.name || 'dish'} servings`}
                    ><Plus size={14} /></button>
                    <b>max</b>
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
      <div className="mt-7 flex items-center justify-between gap-4">
        <p className="text-xs text-black/40">
          Saving updates every open guest tab for this event.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => void cancelMenuEdits()} className="secondary-button">
            <XCircle size={16} /> Cancel
          </button>
          <button
            disabled={
              !menu.title.trim() ||
              !menu.date.trim() ||
              menu.items.some((item) => !item.name.trim())
            }
            onClick={() => void saveMenu()}
            className="primary-button disabled:opacity-40"
          >
            <Check size={16} /> Save event & menu
          </button>
        </div>
      </div>
    </section>
  );
}
