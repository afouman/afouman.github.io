// Reference games for checking the game pipeline. Each follows the Nights game
// contract (setup / move / view + render). The "broken" ones must be caught.
const el = `
function el(tag, props, kids) {
  const node = document.createElement(tag);
  Object.keys(props || {}).forEach(k => { if (k === 'text') node.textContent = props[k]; else if (k === 'on') node.addEventListener('click', props[k]); else node[k] = props[k]; });
  (kids || []).forEach(k => node.append(k));
  return node;
}`;

export const ticTacToe = {
  runtimeVersion: 3, instructions: 'Tap a square on your team turn.', uiNotes: 'Board with team badges.',
  logicSource: `
function setup(ctx) {
  const order = ctx.rng.shuffle(ctx.players.map(p => p.id));
  const teams = [[], []];
  order.forEach((id, i) => teams[i % 2].push(id));
  return { teams, board: Array(9).fill(''), turn: 0, winner: null };
}
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function move(state, action, ctx) {
  if (action.type === 'restart') return { ...state, board: Array(9).fill(''), turn: 0, winner: null };
  if (action.type !== 'mark') throw new Error('Unknown action.');
  if (state.winner) throw new Error('The game is over.');
  const team = state.turn % 2;
  if (!state.teams[team].includes(ctx.player)) throw new Error('It is not your team turn.');
  const i = action.index;
  if (!Number.isInteger(i) || i < 0 || i > 8 || state.board[i]) throw new Error('Pick an empty square.');
  const board = state.board.slice(); board[i] = team === 0 ? 'X' : 'O';
  const line = LINES.find(l => board[l[0]] && board[l[0]] === board[l[1]] && board[l[0]] === board[l[2]]);
  return { ...state, board, turn: state.turn + 1, winner: line ? board[i] : (board.every(Boolean) ? 'draw' : null) };
}
function view(state, player, ctx) {
  const team = state.teams.findIndex(t => t.includes(player));
  return { board: state.board, teams: state.teams, current: state.turn % 2, winner: state.winner,
    myMark: team < 0 ? null : (team === 0 ? 'X' : 'O'), isMyTurn: !state.winner && team === state.turn % 2 };
}`,
  uiSource: `
function render(root, model, ctx) {
  const name = id => (ctx.players.find(p => p.id === id) || {}).name || id;
  const status = document.createElement('p');
  status.textContent = model.winner === 'draw' ? 'Draw!' : model.winner ? model.winner + ' wins!' : (model.isMyTurn ? 'Your turn (' + model.myMark + ')' : (model.current === 0 ? 'X' : 'O') + ' to play');
  const teams = document.createElement('div');
  model.teams.forEach((ids, t) => { const d = document.createElement('div'); d.textContent = (t === 0 ? 'X: ' : 'O: ') + ids.map(name).join(', '); teams.append(d); });
  const board = document.createElement('div'); board.className = 'board';
  model.board.forEach((cell, index) => {
    const b = document.createElement('button'); b.textContent = cell; b.disabled = !model.isMyTurn || Boolean(cell);
    b.addEventListener('click', () => ctx.send({ type: 'mark', index })); board.append(b);
  });
  const again = document.createElement('button'); again.textContent = 'New game';
  again.addEventListener('click', () => ctx.send({ type: 'restart' }));
  root.append(teams, status, board, again);
}`,
  styles: '#game{display:grid;gap:8px;padding:12px;align-content:start} #game .board{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:min(90vw,60vh)} #game .board button{aspect-ratio:1;font-size:2rem}',
  tests: JSON.stringify([{ name: 'bad square', players: 2, steps: [{ player: 'p1', action: { type: 'mark', index: 42 }, expect: 'reject' }] }]),
};

export const tapRace = {
  runtimeVersion: 3, instructions: 'First to 15 taps wins.', uiNotes: 'Tap button and counts.',
  logicSource: `
function setup(ctx) { const taps = {}; ctx.players.forEach(p => { taps[p.id] = 0; }); return { taps, winner: null }; }
function move(state, action, ctx) {
  if (action.type === 'restart') return setup(ctx);
  if (action.type !== 'tap') throw new Error('Unknown action.');
  if (state.winner) throw new Error('Race is over.');
  const taps = { ...state.taps, [ctx.player]: state.taps[ctx.player] + 1 };
  return { taps, winner: taps[ctx.player] >= 15 ? ctx.player : null };
}
function view(state, player, ctx) { return { taps: state.taps, winner: state.winner, mine: state.taps[player] || 0 }; }`,
  uiSource: el + `
function render(root, model, ctx) {
  const name = id => (ctx.players.find(p => p.id === id) || {}).name || id;
  root.append(el('h2', { text: model.winner ? name(model.winner) + ' wins!' : 'Tap race to 15' }));
  root.append(el('ul', {}, Object.keys(model.taps).map(id => el('li', { text: name(id) + ': ' + model.taps[id] }))));
  root.append(el('button', { text: 'TAP (' + model.mine + ')', disabled: !ctx.me || Boolean(model.winner), on: () => ctx.send({ type: 'tap' }) }));
}`,
  styles: '#game{padding:12px;display:grid;gap:8px;align-content:start}',
  tests: JSON.stringify([{ name: 'race', players: 2, steps: Array.from({ length: 15 }, () => ({ player: 'p1', action: { type: 'tap' }, expect: 'accept' })), expectText: { player: 'p2', includes: ['wins'] } }]),
};

export const esmFamil = {
  runtimeVersion: 3, instructions: 'Pick a letter, fill the categories, the creator scores.', uiNotes: 'Questionnaire with creator scoring.',
  logicSource: `
const ITEMS = ['Esm', 'Famil', 'Shahr', 'Ashya', 'Mashin'];
function setup(ctx) { const scores = {}; ctx.players.forEach(p => { scores[p.id] = 0; }); return { round: 1, phase: 'pick', picker: ctx.players[0].id, letter: null, answers: {}, reveal: null, pending: null, scores }; }
function move(state, action, ctx) {
  const isCreator = ctx.player === ctx.creator;
  if (state.phase === 'pick' && action.type === 'letter') {
    if (ctx.player !== state.picker) throw new Error('Not your turn to pick.');
    const letter = String(action.letter || '').trim().toUpperCase();
    if (!/^[A-Z]$/.test(letter)) throw new Error('Pick one letter.');
    return { ...state, phase: 'write', letter, answers: {} };
  }
  if (state.phase === 'write' && action.type === 'submit') {
    const answers = { ...state.answers, [ctx.player]: action.answers || {} };
    return Object.keys(answers).length === ctx.players.length ? { ...state, answers, phase: 'reveal', reveal: { item: 0, seat: 0 } } : { ...state, answers };
  }
  if (state.phase === 'reveal' && action.type === 'score') {
    if (!isCreator) throw new Error('Only the creator scores.');
    if (![0, 5, 10].includes(action.points)) throw new Error('Score 0, 5 or 10.');
    return { ...state, pending: action.points };
  }
  throw new Error('That is not possible right now.');
}
function view(state, player, ctx) {
  const current = state.reveal ? ctx.players[state.reveal.seat] : null;
  return { items: ITEMS, phase: state.phase, picker: state.picker, letter: state.letter, scores: state.scores, mySubmitted: Boolean(state.answers[player]),
    reveal: current ? { item: ITEMS[state.reveal.item], player: current.id, answer: (state.answers[current.id] || {})[state.reveal.item] || '', pending: state.pending } : null,
    isCreator: player !== null && player === ctx.creator };
}`,
  uiSource: `
function render(root, model, ctx) {
  const name = id => (ctx.players.find(p => p.id === id) || {}).name || id;
  const add = (tag, text) => { const e = document.createElement(tag); if (text != null) e.textContent = text; root.append(e); return e; };
  add('h2', 'Esm Famil' + (model.letter ? ' · ' + model.letter : ''));
  if (model.phase === 'pick') {
    add('p', name(model.picker) + ' picks the letter');
    if (ctx.me === model.picker) { const i = document.createElement('input'); i.name = 'letter'; i.maxLength = 1; root.append(i); const b = add('button', 'Use this letter'); b.onclick = () => ctx.send({ type: 'letter', letter: i.value }); }
  }
  if (model.phase === 'write') {
    const fields = model.items.map((item, i) => { const f = document.createElement('input'); f.name = 'item-' + i; f.placeholder = item; f.disabled = !ctx.me || model.mySubmitted; root.append(f); return f; });
    const b = add('button', 'Submit answers'); b.disabled = !ctx.me || model.mySubmitted;
    b.onclick = () => { const answers = {}; fields.forEach((f, i) => { answers[i] = f.value; }); ctx.send({ type: 'submit', answers }); };
  }
  if (model.phase === 'reveal') {
    add('p', 'Grade ' + model.reveal.item + ' for ' + name(model.reveal.player) + ': "' + model.reveal.answer + '"');
    if (model.isCreator) [0, 5, 10].forEach(points => { const b = add('button', String(points)); b.onclick = () => ctx.send({ type: 'score', points }); });
  }
}`,
  styles: '#game{padding:12px;display:grid;gap:6px;align-content:start}',
  tests: JSON.stringify([{ name: 'to grading', players: 2, steps: [
    { player: 'p1', action: { type: 'letter', letter: 'M' }, expect: 'accept' },
    { player: 'p1', action: { type: 'submit', answers: { 0: 'Maryam' } }, expect: 'accept' },
    { player: 'p2', action: { type: 'submit', answers: { 0: 'Mahsa' } }, expect: 'accept' },
    { player: 'p2', action: { type: 'score', points: 10 }, expect: 'reject' }], expectText: { player: 'p2', includes: ['Grade Esm', 'Maryam'] } }]),
};

// ---- broken on purpose: must be BLOCKED -------------------------------------------
export const emptyScreen = { ...tapRace, uiSource: `function render(root, model, ctx) { const c = document.createElement('div'); }` };
export const tapCrash = { ...tapRace, uiSource: tapRace.uiSource.replace("on: () => ctx.send({ type: 'tap' })", "on: () => { ctx.effects.tap(); ctx.send({ type: 'tap' }); }") };
export const usesRandom = { ...ticTacToe, logicSource: ticTacToe.logicSource.replace("ctx.rng.shuffle(ctx.players.map(p => p.id))", "ctx.players.map(p => p.id).sort(() => Math.random() - 0.5)") };
export const undefinedVar = { ...ticTacToe, logicSource: ticTacToe.logicSource.replace("if (action.type !== 'mark')", "if (action.type === 'mark' && viewerId) {}\n  if (action.type !== 'mark')") };
export const crashAfterMove = { ...tapRace, uiSource: tapRace.uiSource.replace("root.append(el('h2'", "if (Object.values(model.taps).some(n => n > 0)) model.nope.boom;\n  root.append(el('h2'") };
export const syntaxError = { ...tapRace, logicSource: tapRace.logicSource + '\nfunction broken( {' };
export const endlessLoop = { ...tapRace, logicSource: tapRace.logicSource.replace('function setup(ctx) {', 'function setup(ctx) { for (;;) {}') };

// ---- working but with wrong self-tests or weak styling: must PASS with WARNINGS ------
export const wrongScenario = { ...ticTacToe, tests: JSON.stringify([{ name: 'claims 99 is legal', players: 2, steps: [{ player: 'p1', action: { type: 'mark', index: 99 }, expect: 'accept' }], expectText: { player: 'p1', includes: ['O wins'] } }]) };
export const lowContrast = { ...tapRace, styles: tapRace.styles + ' #game{background:#f4f4f6} #game h2,#game li{color:#f7f2e8}' };
