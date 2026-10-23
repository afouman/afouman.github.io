'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- matches the app's other fixed overlays. */

// On-the-go event games: the host describes a game, Gemini writes it, Nights tests
// it in the sandbox, and attendees play it at any number of independent tables.
//
// Live play is refereed by the Nights game server (game-server/): it runs the rules,
// keeps the full state and random seed private, and sends each phone only its own
// view over a WebSocket. Phones draw that view in the sandbox and send actions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Gamepad2, LogOut, MessageCircle, EllipsisVertical, Pencil, Play, Plus, RotateCcw, Save, Send, ShieldCheck, Sparkles, Trash2, Users, XCircle } from 'lucide-react';
import {
  isPlayableRuntime,
  readFrameMessage,
  runSelfTest,
  SANDBOX_ATTRIBUTES,
  sandboxDocument,
  type GameRuntime,
  type SandboxMove,
  type SandboxPlayer,
  type SandboxTable,
} from './game-sandbox';

const firebaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
);
const GAME_API_URL = 'https://gaemaj.tech/api/games';
const GAME_LIVE_URL = 'wss://gaemaj.tech/api/games/live';
const HOST_EMAIL = process.env.NEXT_PUBLIC_HOST_EMAIL?.trim().toLowerCase();
const LEGACY_HOST_UID = process.env.NEXT_PUBLIC_LEGACY_HOST_UID?.trim() || 'W2T8SwFA1pdg8wxm23E5kQqbEHv2';
const REPAIR_ATTEMPTS = 3;

export type GameViewer = { id: string; name: string };

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
  runtime: GameRuntime | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  version: number;
};

type GameDefinition = Pick<EventGame,
  'title' | 'summary' | 'playerArrangement' | 'interfaceDescription' | 'rules'
  | 'scoring' | 'timing' | 'hiddenInformation' | 'winCondition' | 'minPlayers' | 'maxPlayers'>;

type TableSummary = {
  id: string;
  name: string;
  status: 'open' | 'playing';
  players: string[];
  count: number;
  joined: boolean;
  creator: boolean;
  canEdit: boolean;
};

type TableDetail = TableSummary & {
  minPlayers: number;
  maxPlayers: number;
  creatorName: string;
  round: number;
  seats: SandboxPlayer[];
  me: string | null;
  creatorSeat: string | null;
  outdated: boolean;
  problem: string;
  view: unknown;
};

type RemoteView = { me: string | null; creator: string | null; players: SandboxPlayer[]; model: unknown };

type ServerMessage = {
  type?: string;
  message?: string;
  tableId?: string;
  tables?: TableSummary[];
  table?: TableDetail;
};

type ReviewMessage = { id: string; role: 'host' | 'designer'; text: string };

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

const definitionOf = (game: EventGame): GameDefinition => ({
  title: game.title,
  summary: game.summary,
  playerArrangement: game.playerArrangement,
  interfaceDescription: game.interfaceDescription,
  rules: game.rules,
  scoring: game.scoring,
  timing: game.timing,
  hiddenInformation: game.hiddenInformation,
  winCondition: game.winCondition,
  minPlayers: game.minPlayers,
  maxPlayers: game.maxPlayers,
});

const firebase = async () => {
  const [{ getApp }, store, auth] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
    import('firebase/auth'),
  ]);
  return { app: getApp(), store, auth };
};

const idToken = async () => {
  const { app, auth } = await firebase();
  const user = auth.getAuth(app).currentUser;
  if (!user) throw new Error('Sign in again to continue.');
  return user.getIdToken();
};

const requestGameDraft = async (
  eventId: string,
  definition: GameDefinition,
  revision: { previousGame?: GameRuntime; feedback?: string[]; failures?: string[] } = {},
) => {
  const response = await fetch(`${GAME_API_URL}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await idToken()}` },
    body: JSON.stringify({ eventId, definition, ...revision }),
  });
  const result = await response.json().catch(() => null) as {
    game?: GameRuntime;
    error?: string;
    remainingToday?: number;
    model?: string;
  } | null;
  if (!response.ok || !result?.game) throw new Error(result?.error || 'The game designer is unavailable right now.');
  return result as { game: GameRuntime; remainingToday?: number; model?: string };
};

// Events this account hosts, read directly so copying works from any view
// (the guest view and the iOS app do not load the host's event list).
async function loadHostedEvents(): Promise<GameEventOption[]> {
  const { app, store, auth } = await firebase();
  const user = auth.getAuth(app).currentUser;
  if (!user) throw new Error('Sign in again to copy games.');
  const owners = HOST_EMAIL && user.email?.trim().toLowerCase() === HOST_EMAIL && user.uid !== LEGACY_HOST_UID
    ? [user.uid, LEGACY_HOST_UID]
    : [user.uid];
  const snapshot = await store.getDocs(store.query(
    store.collection(store.getFirestore(app), 'events'),
    store.where('ownerUid', 'in', owners),
  ));
  return snapshot.docs.map((document) => ({ id: document.id, title: String(document.data().title || 'Untitled event') }));
}

class GameTestFailure extends Error {
  failures: string[];
  constructor(failures: string[]) {
    super('The generated game still failed its tests.');
    this.failures = failures;
  }
}

// Generate (or revise), then run the sandbox self-test and send any failures back
// to Gemini until the draft passes or the repair budget is used.
async function designTestedGame(
  eventId: string,
  definition: GameDefinition,
  revision: { previousGame?: GameRuntime; feedback?: string[] },
  onProgress: (message: string) => void,
) {
  onProgress(revision.previousGame ? 'Applying your feedback…' : 'Designing the game…');
  let result = await requestGameDraft(eventId, definition, revision);
  for (let attempt = 0; ; attempt += 1) {
    onProgress(attempt ? `Re-testing repair ${attempt}…` : 'Testing the draft in the sandbox…');
    const failures = await runSelfTest(result.game, definition.minPlayers, definition.maxPlayers);
    if (!failures.length) return { ...result, repairs: attempt };
    if (attempt >= REPAIR_ATTEMPTS) throw new GameTestFailure(failures);
    onProgress(`Fixing ${failures.length} problem${failures.length === 1 ? '' : 's'} found by the tests…`);
    result = await requestGameDraft(eventId, definition, { previousGame: result.game, failures, feedback: revision.feedback });
  }
}

const millis = (value: unknown) => {
  const candidate = value as { toMillis?: () => number } | number | null | undefined;
  if (typeof candidate === 'number') return candidate;
  return candidate?.toMillis?.() ?? 0;
};

export type GameEventOption = { id: string; title: string };

// In-app confirmation. window.confirm() is silently refused inside some app
// web views (for example the iOS app), which made destructive buttons do nothing.
function ConfirmSheet({ title, detail, action, onConfirm, onCancel }: {
  title: string;
  detail?: string;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="game-confirm-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="game-confirm" role="alertdialog" aria-modal="true" aria-label={title}>
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
        <div>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="game-confirm-danger" onClick={onConfirm}>{action}</button>
        </div>
      </div>
    </div>
  );
}

// Hosts one sandboxed game frame. In local mode the frame runs the rules itself
// (design preview); in remote mode it only draws the view the server sent.
function GameFrame({ runtime, title, local, remote, notice, onSend }: {
  runtime: GameRuntime;
  title: string;
  local?: SandboxTable;
  remote?: RemoteView;
  notice?: { id: number; message: string } | null;
  onSend: (action: Record<string, unknown>) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const portRef = useRef<MessagePort | null>(null);
  const latestRef = useRef<{ local?: SandboxTable; remote?: RemoteView }>({ local, remote });
  const onSendRef = useRef(onSend);
  const loadsRef = useRef(0);
  const sendTimesRef = useRef<number[]>([]);
  const [problem, setProblem] = useState('');
  const mode = remote ? 'remote' : 'local';
  const documentSource = useMemo(() => sandboxDocument(runtime, mode), [runtime, mode]);

  const push = useCallback((port: MessagePort | null) => {
    const { local: table, remote: view } = latestRef.current;
    if (!port) return;
    if (view) port.postMessage({ type: 'view', view });
    else if (table) port.postMessage({ type: 'table', table });
  }, []);
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);
  useEffect(() => {
    latestRef.current = { local, remote };
    push(portRef.current);
  }, [local, remote, push]);
  useEffect(() => {
    if (notice) portRef.current?.postMessage({ type: 'notice', message: notice.message });
  }, [notice]);
  useEffect(() => () => portRef.current?.close(), []);

  const connect = useCallback(() => {
    loadsRef.current += 1;
    if (loadsRef.current > 1) {
      // A second load means the game navigated its frame. Tear it down.
      portRef.current?.close();
      portRef.current = null;
      setProblem('This game tried to leave its sandbox and was stopped.');
      return;
    }
    const channel = new MessageChannel();
    portRef.current = channel.port1;
    channel.port1.onmessage = ({ data }) => {
      const message = readFrameMessage(data);
      if (!message) return;
      if (message.type === 'ready') push(channel.port1);
      if (message.type === 'send') {
        const now = Date.now();
        sendTimesRef.current = sendTimesRef.current.filter((time) => now - time < 3000);
        if (sendTimesRef.current.length >= 12) return;
        sendTimesRef.current.push(now);
        onSendRef.current(message.action as Record<string, unknown>);
      }
    };
    channel.port1.start();
    frameRef.current?.contentWindow?.postMessage({ type: 'nights-connect' }, '*', [channel.port2]);
  }, [push]);

  if (problem) return <div className="game-stage game-stage-message"><ShieldCheck size={26} /><strong>{problem}</strong></div>;
  return (
    <iframe
      ref={frameRef}
      className="game-stage"
      title={`${title} game`}
      sandbox={SANDBOX_ATTRIBUTES.sandbox}
      allow={SANDBOX_ATTRIBUTES.allow}
      referrerPolicy={SANDBOX_ATTRIBUTES.referrerPolicy}
      srcDoc={documentSource}
      onLoad={connect}
    />
  );
}

type ReviewProps = {
  messages: ReviewMessage[];
  value: string;
  busy: boolean;
  progress: string;
  error: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

function ReviewPanel({ review }: { review: ReviewProps }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [review.messages, review.busy]);
  return (
    <aside className="game-review-panel" aria-label="Game design feedback">
      <header><div><MessageCircle size={17} /><span><strong>Design feedback</strong><small>Revise this draft without starting over</small></span></div></header>
      <div ref={listRef} className="game-review-messages" aria-live="polite">
        {review.messages.map((message) => <div key={message.id} className={`game-review-message ${message.role}`}><small>{message.role === 'host' ? 'You' : 'Nights designer'}</small><p>{message.text}</p></div>)}
        {review.busy && <div className="game-review-message designer thinking"><small>Nights designer</small><p>{review.progress || 'Working…'}</p></div>}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); review.onSubmit(); }}>
        <textarea value={review.value} onChange={(event) => review.onChange(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            review.onSubmit();
          }
        }} rows={3} maxLength={1500} placeholder="Make the board larger, show scores at the top…" disabled={review.busy} />
        <button type="submit" disabled={review.busy || !review.value.trim()} aria-label="Send design feedback"><Send size={16} /> Send</button>
      </form>
      {review.error && <p className="game-review-error">{review.error}</p>}
    </aside>
  );
}

// Host design preview: a local table where the host can act as any seat.
function PreviewTable({ game, runtime }: { game: EventGame; runtime: GameRuntime }) {
  const defaultCount = Math.min(game.maxPlayers, Math.max(game.minPlayers, 2));
  const [count, setCount] = useState(defaultCount);
  const [me, setMe] = useState('p1');
  const [round, setRound] = useState(() => ({ seed: 1 + Math.floor(Math.random() * 2_000_000_000), moves: [] as SandboxMove[], id: 1 }));
  const players = useMemo(() => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: index === 0 ? 'You' : `Guest ${index + 1}` })), [count]);
  const table = useMemo<SandboxTable>(() => ({ epoch: `preview:${round.id}:${count}`, seed: round.seed, players, me, creator: 'p1', moves: round.moves }), [count, me, players, round]);
  const restart = () => setRound((current) => ({ seed: 1 + Math.floor(Math.random() * 2_000_000_000), moves: [], id: current.id + 1 }));
  const send = useCallback((action: Record<string, unknown>) => {
    setRound((current) => ({ ...current, moves: [...current.moves, { player: me, at: Date.now(), action }] }));
  }, [me]);
  const counts = Array.from({ length: Math.min(game.maxPlayers, 8) - game.minPlayers + 1 }, (_, index) => game.minPlayers + index);
  return <>
    <section className="game-session-bar game-preview-session">
      <div className="game-session-status"><strong>Design preview</strong><span>Local sample table. Nothing is shared.</span></div>
      <label className="game-inline-select"><span>Players</span><select value={count} onChange={(event) => { setCount(Number(event.target.value)); setMe('p1'); restart(); }}>{counts.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="game-inline-select"><span>Playing as</span><select value={me} onChange={(event) => setMe(event.target.value)}>{players.map((player) => <option key={player.id} value={player.id}>{player.name} ({player.id})</option>)}</select></label>
      <button type="button" className="game-secondary" onClick={restart}><RotateCcw size={14} /> Restart</button>
    </section>
    <GameFrame runtime={runtime} title={game.title} local={table} onSend={send} />
  </>;
}

type LiveStatus = 'connecting' | 'ready' | 'offline';

// Live tables, refereed by the game server over one WebSocket per open game.
function LiveTables({ eventId, game, viewer }: {
  eventId: string;
  game: EventGame;
  viewer: GameViewer | null;
}) {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [table, setTable] = useState<TableDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [newTableName, setNewTableName] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const watchingRef = useRef('');
  const [watching, setWatching] = useState('');
  const watch = (tableId: string) => {
    watchingRef.current = tableId;
    setWatching(tableId);
  };

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Reconnecting to the game server…');
      return;
    }
    socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !viewer) return;
    let stopped = false;
    let attempt = 0;
    let retry = 0;
    const open = () => {
      if (stopped) return;
      setStatus('connecting');
      const socket = new WebSocket(`${GAME_LIVE_URL}?event=${encodeURIComponent(eventId)}&game=${encodeURIComponent(game.id)}`);
      socketRef.current = socket;
      socket.onopen = () => {
        void idToken().then((token) => {
          // The token travels inside the encrypted socket, never in the URL.
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'hello', token }));
        }, (tokenError: unknown) => setError(tokenError instanceof Error ? tokenError.message : 'Sign in again to play.'));
      };
      socket.onmessage = (event) => {
        let message: ServerMessage;
        try { message = JSON.parse(String(event.data)) as ServerMessage; } catch { return; }
        if (message.type === 'welcome') {
          attempt = 0;
          setStatus('ready');
          setError('');
          if (watchingRef.current) socket.send(JSON.stringify({ type: 'open', tableId: watchingRef.current }));
        } else if (message.type === 'tables') setTables(message.tables || []);
        else if (message.type === 'opened' && message.tableId) {
          watchingRef.current = message.tableId;
          setWatching(message.tableId);
        }
        else if (message.type === 'table') {
          if (message.table && message.table.id === watchingRef.current) setTable(message.table);
        } else if (message.type === 'closed') {
          if (message.tableId === watchingRef.current) {
            watchingRef.current = '';
            setWatching('');
            setTable(null);
            setError('That table was closed.');
          }
        } else if (message.type === 'refused') setNotice({ id: Date.now(), message: message.message || 'Move not allowed.' });
        else if (message.type === 'error') setError(message.message || 'Something went wrong.');
      };
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (stopped) return;
        setStatus('offline');
        attempt += 1;
        retry = window.setTimeout(open, Math.min(8000, 500 * 2 ** Math.min(attempt, 4)));
      };
    };
    open();
    return () => {
      stopped = true;
      window.clearTimeout(retry);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [eventId, game.id, viewer]);

  const openTable = (tableId: string) => {
    watch(tableId);
    setTable(null);
    setError('');
    send({ type: 'open', tableId });
  };
  const backToTables = () => {
    watch('');
    setTable(null);
    setNameDraft(null);
    setError('');
  };
  const saveName = () => {
    if (!table || nameDraft === null) return;
    const name = nameDraft.trim();
    if (!name) {
      setError('Give the table a name.');
      return;
    }
    send({ type: 'rename', tableId: table.id, name: name.slice(0, 60) });
    setNameDraft(null);
  };
  const sendMove = useCallback((action: Record<string, unknown>) => {
    if (watching) send({ type: 'move', tableId: watching, action });
  }, [send, watching]);
  const remote = useMemo<RemoteView | null>(() => table && table.status === 'playing' && !table.outdated && !table.problem
    ? { me: table.me, creator: table.creatorSeat, players: table.seats, model: table.view }
    : null, [table]);

  if (!firebaseConfigured) return <div className="game-stage game-stage-message"><Users size={26} /><strong>Live tables need the production backend.</strong></div>;
  if (!viewer) return <div className="game-stage game-stage-message"><Users size={26} /><strong>RSVP “Going” and finish your account to play.</strong></div>;

  const connection = status === 'ready' ? '' : status === 'connecting' ? 'Connecting…' : 'Reconnecting…';
  if (!watching || !table) {
    return <>
      <section className="game-session-bar">
        <div className="game-session-status"><strong>{game.title} tables</strong><span>{connection || `Only tables for this game. ${game.minPlayers}–${game.maxPlayers} players each.`}</span></div>
        {newTableName === null && <button type="button" disabled={status !== 'ready'} onClick={() => { setError(''); setNewTableName(`${game.title} · Table ${tables.length + 1}`.slice(0, 60)); }}><Plus size={15} /> New table</button>}
        {error && <p>{error}</p>}
      </section>
      {newTableName !== null && (
        <form className="game-stage game-new-table" onSubmit={(event) => {
          event.preventDefault();
          const name = newTableName.trim();
          if (!name) {
            setError('Give the table a name.');
            return;
          }
          send({ type: 'create', name: name.slice(0, 60) });
          setNewTableName(null);
        }}>
          <strong>New {game.title} table</strong>
          <label><span>Table name</span><input value={newTableName} onChange={(event) => setNewTableName(event.target.value)} maxLength={60} /></label>
          <p>The table is created only when you tap Create. You will be its first player.</p>
          <div>
            <button type="button" className="game-secondary" onClick={() => { setNewTableName(null); setError(''); }}>Cancel</button>
            <button type="submit" disabled={status !== 'ready'}><Check size={15} /> Create table</button>
          </div>
        </form>
      )}
      {newTableName === null && <div className="game-stage game-table-list">
        {status !== 'ready' && !tables.length ? <p className="game-table-empty">{connection}</p> : tables.length ? tables.map((entry) => (
          <button type="button" key={entry.id} className="game-table-card" onClick={() => openTable(entry.id)}>
            <strong>{entry.name}</strong>
            <span>{entry.count} {entry.count === 1 ? 'player' : 'players'} · {entry.status === 'playing' ? 'Playing' : 'Waiting to start'}{entry.joined ? ' · You joined' : ''}</span>
            <small>{entry.players.join(', ')}</small>
          </button>
        )) : <p className="game-table-empty">No {game.title} tables yet. Start one and invite people to join.</p>}
      </div>}
    </>;
  }

  const seated = table.status === 'playing' && table.me !== null;
  return <>
    <section className="game-session-bar">
      {nameDraft !== null ? (
        <form className="game-table-rename" onSubmit={(event) => { event.preventDefault(); saveName(); }}>
          <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={60} aria-label="Table name" />
          <button type="submit"><Check size={14} /> Save</button>
          <button type="button" className="game-secondary" onClick={() => setNameDraft(null)}>Cancel</button>
        </form>
      ) : (
        <div className="game-session-status">
          <strong>{table.name}{table.canEdit && <button type="button" className="game-rename" onClick={() => setNameDraft(table.name)} aria-label="Rename table"><Pencil size={13} /></button>}</strong>
          <span>{connection || `${game.title} · ${table.count} joined · ${table.status === 'playing' ? (seated ? `You are ${table.me}` : 'Watching') : 'Waiting to start'}`}</span>
        </div>
      )}
      <button type="button" className="game-secondary" onClick={backToTables}>All tables</button>
      {!table.joined && <button type="button" onClick={() => send({ type: 'join', tableId: table.id })}><Plus size={15} /> Join</button>}
      {table.joined && !seated && <button type="button" className="game-secondary" onClick={() => { send({ type: 'leave', tableId: table.id }); backToTables(); }}><LogOut size={14} /> Leave</button>}
      {table.creator && table.status === 'open' && <button type="button" disabled={table.count < table.minPlayers} onClick={() => send({ type: 'start', tableId: table.id })}><Play size={15} /> Start</button>}
      {table.creator && table.status === 'playing' && <button type="button" disabled={table.count < table.minPlayers} onClick={() => send({ type: 'start', tableId: table.id })}><RotateCcw size={14} /> New round</button>}
      {table.creator && table.status === 'playing' && <button type="button" className="game-secondary" onClick={() => send({ type: 'lobby', tableId: table.id })}>Lobby</button>}
      {table.canEdit && <button type="button" className="game-secondary game-danger" onClick={() => setConfirmClose(true)} aria-label="Close table"><Trash2 size={14} /></button>}
      {error && <p>{error}</p>}
    </section>
    {table.status === 'open' ? (
      <div className="game-stage game-lobby">
        <Users size={26} />
        <strong>{table.count < table.minPlayers ? `Waiting for players · ${table.count}/${table.minPlayers} needed` : table.creator ? 'Ready when you are. Tap Start.' : `Waiting for ${table.creatorName} to start`}</strong>
        <ul>{table.players.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul>
      </div>
    ) : table.outdated ? (
      <div className="game-stage game-stage-message"><RotateCcw size={26} /><strong>This round uses an older version of the game.</strong><span>{table.creator ? 'Tap New round to play the latest version.' : 'The table creator can start a new round.'}</span></div>
    ) : table.problem || !remote ? (
      <div className="game-stage game-stage-message"><ShieldCheck size={26} /><strong>{table.problem || 'Loading the game…'}</strong></div>
    ) : (
      <GameFrame runtime={game.runtime as GameRuntime} title={game.title} remote={remote} notice={notice} onSend={sendMove} />
    )}
    {confirmClose && <ConfirmSheet
      title={`Close “${table.name}”?`}
      detail="The table and its round end for everyone at it."
      action="Close table"
      onCancel={() => setConfirmClose(false)}
      onConfirm={() => { setConfirmClose(false); send({ type: 'close', tableId: table.id }); }}
    />}
  </>;
}

function GamePlayer({ eventId, game, viewer, preview, review, onClose }: {
  eventId: string;
  game: EventGame;
  viewer: GameViewer | null;
  preview: boolean;
  review?: ReviewProps;
  onClose: () => void;
}) {
  const runtime = game.runtime as GameRuntime;
  return (
    <div className="game-sandbox-backdrop" role="presentation" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={`game-sandbox-shell ${review ? 'reviewing' : ''}`} role="dialog" aria-modal="true" aria-label={`${preview ? 'Preview' : 'Play'} ${game.title}`}>
        <header><div><p className="eyebrow">{preview ? 'Design preview' : 'Live game'}</p><h3 className="font-display">{game.title}</h3></div><button type="button" onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }} aria-label="Close game"><XCircle size={22} /></button></header>
        {preview
          ? <PreviewTable game={game} runtime={runtime} />
          : <LiveTables eventId={eventId} game={game} viewer={viewer} />}
        {review && <ReviewPanel review={review} />}
        <footer><ShieldCheck size={15} /><span>{preview ? 'Preview runs only on this device, in an isolated sandbox.' : 'The Nights server referees the game. Your screen runs in an isolated sandbox and receives only your own view.'}</span></footer>
      </div>
    </div>
  );
}

export function GamePanel({ eventId, eventTitle, canManage, accountUid, viewer, otherEvents = [], onClose, notify }: {
  eventId: string;
  eventTitle: string;
  canManage: boolean;
  otherEvents?: GameEventOption[];
  accountUid: string;
  viewer: GameViewer | null;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [games, setGames] = useState<EventGame[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<EventGame>(() => newGameDraft(accountUid));
  const [playing, setPlaying] = useState<EventGame | null>(null);
  const [designPreview, setDesignPreview] = useState(false);
  const [designRevision, setDesignRevision] = useState(0);
  const [reviewMessages, setReviewMessages] = useState<ReviewMessage[]>([]);
  const [reviewInput, setReviewInput] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testFailures, setTestFailures] = useState<string[]>([]);
  const [menuGameId, setMenuGameId] = useState('');
  const [exporting, setExporting] = useState<EventGame | null>(null);
  const [exportTargets, setExportTargets] = useState<GameEventOption[] | null>(null);
  const [deleting, setDeleting] = useState<EventGame | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) {
      try {
        const saved = JSON.parse(localStorage.getItem(gamePreviewKey(eventId)) || '[]') as EventGame[];
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
    let cancelled = false;
    void (async () => {
      const { app, store } = await firebase();
      if (cancelled) return;
      const gamesCollection = store.collection(store.getFirestore(app), 'events', eventId, 'games');
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
              createdAt: millis(data.createdAt) || Date.now(),
              updatedAt: millis(data.updatedAt) || Date.now(),
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
    return () => {
      cancelled = true;
      stop();
    };
  }, [canManage, eventId]);

  const visibleGames = canManage ? games : games.filter((game) => game.status === 'published');
  const updateDraft = <K extends keyof EventGame>(key: K, value: EventGame[K]) => {
    const invalidatesRuntime = ['playerArrangement', 'interfaceDescription', 'rules', 'scoring', 'timing', 'hiddenInformation', 'winCondition', 'minPlayers', 'maxPlayers'].includes(key);
    if (invalidatesRuntime) {
      setReviewMessages([]);
      setReviewInput('');
      setReviewError('');
      setTestFailures([]);
    }
    setDraft((current) => ({
      ...current,
      [key]: value,
      runtime: key === 'runtime' ? value as EventGame['runtime'] : invalidatesRuntime ? null : current.runtime,
    }));
  };
  const beginCreate = () => {
    setDraft(newGameDraft(accountUid));
    setError('');
    setTestFailures([]);
    setReviewMessages([]);
    setReviewInput('');
    setReviewError('');
    setEditorOpen(true);
  };
  const beginEdit = (game: EventGame) => {
    const playable = isPlayableRuntime(game.runtime);
    setDraft({ ...game, runtime: playable ? game.runtime : null });
    setError(game.runtime && !playable ? 'This game was made with the previous game engine. Generate it again to play.' : '');
    setTestFailures([]);
    setReviewMessages(playable && game.runtime ? [{ id: crypto.randomUUID(), role: 'designer', text: `This is the current design. ${game.runtime.uiNotes}` }] : []);
    setReviewInput('');
    setReviewError('');
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
  const reportDesignFailure = (designError: unknown, setMessage: (message: string) => void) => {
    if (designError instanceof GameTestFailure) {
      setTestFailures(designError.failures);
      setMessage('Gemini could not produce a draft that passes the sandbox tests. Adjust the description and try again; the problems are listed below.');
    } else setMessage(designError instanceof Error ? designError.message : 'Game generation failed.');
  };
  const generate = async () => {
    const validation = validateDraft();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError('');
    setTestFailures([]);
    try {
      if (!firebaseConfigured) throw new Error('Connect the production backend to generate a game.');
      const result = await designTestedGame(eventId, definitionOf(draft), {}, setProgress);
      const generatedDraft: EventGame = { ...draft, runtime: result.game };
      setDraft(generatedDraft);
      setDesignPreview(true);
      setDesignRevision((current) => current + 1);
      setReviewMessages([{ id: crypto.randomUUID(), role: 'designer', text: `A tested, playable draft is ready${result.repairs ? ` (fixed after ${result.repairs} test round${result.repairs === 1 ? '' : 's'})` : ''}. ${result.game.uiNotes}` }]);
      setReviewInput('');
      setReviewError('');
      setPlaying(generatedDraft);
      notify(`Playable draft ready${typeof result.remainingToday === 'number' ? ` · ${result.remainingToday} generations left today` : ''}.`);
    } catch (designError) {
      reportDesignFailure(designError, setError);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };
  const refine = async () => {
    const feedback = reviewInput.trim();
    if (!feedback || !draft.runtime || busy) return;
    const nextMessages: ReviewMessage[] = [...reviewMessages, { id: crypto.randomUUID(), role: 'host', text: feedback }];
    setReviewMessages(nextMessages);
    setReviewInput('');
    setReviewError('');
    setBusy(true);
    try {
      const result = await designTestedGame(eventId, definitionOf(draft), {
        previousGame: draft.runtime,
        feedback: nextMessages.filter((message) => message.role === 'host').map((message) => message.text),
      }, setProgress);
      const revisedDraft: EventGame = { ...draft, runtime: result.game };
      setDraft(revisedDraft);
      setDesignRevision((current) => current + 1);
      setPlaying(revisedDraft);
      setReviewMessages((current) => [...current, { id: crypto.randomUUID(), role: 'designer', text: `Updated and re-tested. ${result.game.uiNotes}` }]);
    } catch (designError) {
      reportDesignFailure(designError, setReviewError);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };
  const persist = async (status: EventGame['status']) => {
    const validation = validateDraft();
    if (validation) {
      setError(validation);
      return;
    }
    if (status === 'published' && !isPlayableRuntime(draft.runtime)) {
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
        const { app, store } = await firebase();
        const reference = store.doc(store.getFirestore(app), 'events', eventId, 'games', gameId);
        const { createdAt: _createdAt, updatedAt: _updatedAt, ...storedGame } = next;
        await store.setDoc(reference, draft.id
          ? { ...storedGame, updatedAt: store.serverTimestamp() }
          : { ...storedGame, createdAt: store.serverTimestamp(), updatedAt: store.serverTimestamp() },
        { merge: true });
        setGames((current) => [next, ...current.filter((game) => game.id !== gameId)]);
      } else {
        const updated = [next, ...games.filter((game) => game.id !== gameId)];
        localStorage.setItem(gamePreviewKey(eventId), JSON.stringify(updated));
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
  // Copies a game into another event this host manages. Older-engine games are
  // copied without their runtime, as drafts, so they can be regenerated there.
  const exportGame = async (game: EventGame, target: GameEventOption) => {
    setExporting(null);
    setBusy(true);
    setError('');
    try {
      if (!firebaseConfigured) throw new Error('Connect the production backend to copy games between events.');
      const { app, store } = await firebase();
      const playable = isPlayableRuntime(game.runtime);
      const gameId = `game-${crypto.randomUUID()}`;
      await store.setDoc(store.doc(store.getFirestore(app), 'events', target.id, 'games', gameId), {
        id: gameId,
        title: game.title,
        summary: game.summary,
        status: playable ? game.status : 'draft',
        playerArrangement: game.playerArrangement,
        interfaceDescription: game.interfaceDescription,
        rules: game.rules,
        scoring: game.scoring,
        timing: game.timing,
        hiddenInformation: game.hiddenInformation,
        winCondition: game.winCondition,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        runtime: playable ? game.runtime : null,
        createdBy: accountUid,
        createdAt: store.serverTimestamp(),
        updatedAt: store.serverTimestamp(),
        version: 1,
      });
      notify(`“${game.title}” copied to ${target.title}${playable ? '' : ' as a draft to regenerate'}.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The game could not be copied.');
    } finally {
      setBusy(false);
    }
  };
  const openExport = (game: EventGame) => {
    setExporting(game);
    setExportTargets(null);
    if (!firebaseConfigured) {
      setExportTargets(otherEvents);
      return;
    }
    void loadHostedEvents().then((events) => {
      const merged = new Map([...otherEvents, ...events].map((event) => [event.id, event]));
      merged.delete(eventId);
      setExportTargets([...merged.values()].sort((left, right) => left.title.localeCompare(right.title)));
    }, (loadError: unknown) => {
      setExporting(null);
      setError(loadError instanceof Error ? loadError.message : 'Your events could not be loaded.');
    });
  };
  const removeGame = async (game: EventGame) => {
    setDeleting(null);
    setBusy(true);
    try {
      if (firebaseConfigured) {
        const { app, store } = await firebase();
        await store.deleteDoc(store.doc(store.getFirestore(app), 'events', eventId, 'games', game.id));
      } else {
        const updated = games.filter((entry) => entry.id !== game.id);
        localStorage.setItem(gamePreviewKey(eventId), JSON.stringify(updated));
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
          <div><p className="eyebrow">{eventTitle}</p><h2 id="game-panel-title" className="font-display">Games</h2><span>Small, custom games designed for the people at this event.</span></div>
          <button type="button" onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }} aria-label="Close games"><XCircle size={22} /></button>
        </header>
        {!editorOpen ? <>
          {canManage && <section className="game-create-callout">
            <span><Sparkles size={22} /></span>
            <div><strong>Describe any simple gathering game</strong><p>Nights writes it, tests it in an isolated sandbox, and lets attendees play at as many tables as they like.</p></div>
            <button type="button" onClick={beginCreate}><Plus size={17} /> Create game</button>
          </section>}
          {error && <p className="game-panel-error">{error}</p>}
          <section className="game-library" aria-label="Event games">
            <header><div><p className="eyebrow">Game shelf</p><h3 className="font-display">{canManage ? 'Your event games' : 'Ready to play'}</h3></div><span>{visibleGames.length}</span></header>
            {loading ? <div className="game-empty"><Sparkles size={24} /><strong>Loading games…</strong></div> : visibleGames.length ? <div className="game-card-grid">{visibleGames.map((game) => {
              const playable = isPlayableRuntime(game.runtime);
              return <article key={game.id} className="game-card">
                <div className="game-card-art"><Gamepad2 size={27} /><span>{game.minPlayers}–{game.maxPlayers} players</span></div>
                <div className="game-card-copy"><div><span className={`game-status ${game.status}`}>{game.status}</span><small>v{game.version}</small></div><h4 className="font-display">{game.title}</h4><p>{game.summary || game.rules}</p></div>
                <footer>
                  <button type="button" className="game-play" disabled={!playable} title={playable ? undefined : 'Regenerate this game to play it'} onClick={() => { setDesignPreview(false); setPlaying(game); }}><Play size={15} /> {playable ? 'Play' : 'Needs regenerating'}</button>
                  {canManage && <><button type="button" onClick={() => beginEdit(game)}><Pencil size={15} /> Edit</button><button type="button" className="game-delete game-more" onClick={() => setMenuGameId((current) => current === game.id ? '' : game.id)} disabled={busy} aria-label={`More actions for ${game.title}`} aria-expanded={menuGameId === game.id}><EllipsisVertical size={18} /></button></>}
                  {canManage && menuGameId === game.id && <div className="game-card-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMenuGameId(''); openExport(game); }}><Copy size={15} /> Copy to another event</button>
                    <button type="button" role="menuitem" className="game-menu-danger" onClick={() => { setMenuGameId(''); setDeleting(game); }}><Trash2 size={15} /> Delete</button>
                  </div>}
                </footer>
              </article>;
            })}</div> : <div className="game-empty"><Gamepad2 size={29} /><strong>{canManage ? 'No games yet' : 'The host has not published a game yet'}</strong><span>{canManage ? 'Create one from the rules your group already has in mind.' : 'Published games will appear here.'}</span></div>}
          </section>
        </> : <section className="game-editor">
          <header><div><p className="eyebrow">{draft.id ? 'Edit game' : 'New game'}</p><h3 className="font-display">Define the experience</h3><span>Be specific, then generate. Every draft is tested in the sandbox before you see it.</span></div><button type="button" onClick={() => setEditorOpen(false)} disabled={busy}>Back to games</button></header>
          {error && <p className="game-panel-error">{error}</p>}
          {testFailures.length > 0 && <div className="game-test-failures"><strong>Problems the sandbox tests found</strong><ul>{testFailures.map((failure) => <li key={failure}>{failure}</li>)}</ul></div>}
          <div className="game-editor-grid">
            <label className="game-field game-field-title"><span>Game name</span><input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Reverse Charades" maxLength={90} /></label>
            <div className="game-player-limits"><label><span>Minimum players</span><input type="number" min="1" max="100" value={draft.minPlayers} onChange={(event) => updateDraft('minPlayers', Math.max(1, Number(event.target.value) || 1))} /></label><label><span>Maximum players</span><input type="number" min={draft.minPlayers} max="100" value={draft.maxPlayers} onChange={(event) => updateDraft('maxPlayers', Math.max(draft.minPlayers, Number(event.target.value) || draft.minPlayers))} /></label></div>
            <label className="game-field game-field-wide"><span>Short description</span><textarea value={draft.summary} onChange={(event) => updateDraft('summary', event.target.value)} placeholder="What kind of game is this, and what makes it fun?" rows={2} /></label>
            <label className="game-field"><span>Players and teams</span><textarea value={draft.playerArrangement} onChange={(event) => updateDraft('playerArrangement', event.target.value)} placeholder="Two teams, assigned randomly when the table starts." rows={5} /></label>
            <label className="game-field"><span>Interface</span><textarea value={draft.interfaceDescription} onChange={(event) => updateDraft('interfaceDescription', event.target.value)} placeholder="Show both teams, whose turn it is, a large timer, and a private word card for the acting player." rows={5} /></label>
            <label className="game-field"><span>Rules</span><textarea value={draft.rules} onChange={(event) => updateDraft('rules', event.target.value)} placeholder="Describe setup, each turn, allowed actions, and when a turn ends." rows={7} /></label>
            <label className="game-field"><span>Scoring</span><textarea value={draft.scoring} onChange={(event) => updateDraft('scoring', event.target.value)} placeholder="One point for a correct guess." rows={4} /></label>
            <label className="game-field"><span>Turns and timing</span><textarea value={draft.timing} onChange={(event) => updateDraft('timing', event.target.value)} placeholder="Teams alternate. Each turn lasts 60 seconds." rows={4} /></label>
            <label className="game-field"><span>Private or hidden information</span><textarea value={draft.hiddenInformation} onChange={(event) => updateDraft('hiddenInformation', event.target.value)} placeholder="The acting word is shown only to the acting player." rows={4} /></label>
            <label className="game-field game-field-wide"><span>How the game ends</span><textarea value={draft.winCondition} onChange={(event) => updateDraft('winCondition', event.target.value)} placeholder="After five rounds, the team with the highest score wins." rows={3} /></label>
          </div>
          {busy && progress && <div className="game-runtime-ready game-progress"><Sparkles size={19} /><div><strong>{progress}</strong><span>This usually takes under a minute.</span></div></div>}
          {!busy && isPlayableRuntime(draft.runtime) && <div className="game-runtime-ready game-progress"><ShieldCheck size={19} /><div><strong>Tested and playable</strong><span>{draft.runtime.instructions}</span></div></div>}
          <footer className="game-editor-actions">
            <button type="button" onClick={() => setEditorOpen(false)} disabled={busy}>Cancel</button>
            <button type="button" className="game-generate" onClick={() => void generate()} disabled={busy}><Sparkles size={16} />{busy ? 'Working…' : draft.runtime ? 'Regenerate' : 'Generate playable draft'}</button>
            {isPlayableRuntime(draft.runtime) && <button type="button" className="game-preview-refine" onClick={() => { setDesignPreview(true); setPlaying(draft); }} disabled={busy}><Play size={16} /> Preview & refine</button>}
            <button type="button" onClick={() => void persist('draft')} disabled={busy}><Save size={16} /> Save draft</button>
            <button type="button" className="game-publish" onClick={() => void persist('published')} disabled={busy || !isPlayableRuntime(draft.runtime)}><Check size={16} /> Publish</button>
          </footer>
        </section>}
      </div>
      {deleting && <ConfirmSheet
        title={`Delete “${deleting.title}”?`}
        detail="This removes the game from this event. It cannot be undone."
        action="Delete game"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void removeGame(deleting)}
      />}
      {exporting && <div className="game-confirm-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setExporting(null); }}>
        <div className="game-confirm game-export" role="dialog" aria-modal="true" aria-label={`Copy ${exporting.title} to another event`}>
          <strong>Copy “{exporting.title}” to…</strong>
          {exportTargets === null ? <p>Loading your events…</p>
            : exportTargets.length ? <ul>{exportTargets.map((target) => <li key={target.id}><button type="button" onClick={() => void exportGame(exporting, target)}>{target.title || 'Untitled event'}</button></li>)}</ul>
            : <p>You are not hosting any other events yet.</p>}
          <div><button type="button" onClick={() => setExporting(null)}>Cancel</button></div>
        </div>
      </div>}
      {playing && isPlayableRuntime(playing.runtime) && <GamePlayer
        key={`${playing.id || 'draft'}:${playing.version}:${designPreview ? designRevision : 'live'}`}
        eventId={eventId}
        game={playing}
        viewer={viewer}
        preview={designPreview}
        review={designPreview ? {
          messages: reviewMessages,
          value: reviewInput,
          busy,
          progress,
          error: reviewError,
          onChange: setReviewInput,
          onSubmit: () => void refine(),
        } : undefined}
        onClose={() => { setPlaying(null); setDesignPreview(false); }}
      />}
    </div>
  );
}
