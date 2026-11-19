import { runGameChecks } from '../../components/game-sandbox.ts';
import * as games from './games.mjs';
const expectations = {
  ticTacToe: 'pass', tapRace: 'pass', esmFamil: 'pass',
  emptyScreen: 'block', tapCrash: 'block', usesRandom: 'block', undefinedVar: 'block', crashAfterMove: 'block', syntaxError: 'block', endlessLoop: 'block',
  wrongScenario: 'warn', lowContrast: 'warn',
};
window.runAll = async () => {
  const rows = [];
  for (const [key, expected] of Object.entries(expectations)) {
    const result = await runGameChecks(games[key], 2, 6);
    const outcome = result.blocking.length ? 'block' : result.warnings.length ? 'warn' : 'pass';
    rows.push({ game: key, expected, outcome, ok: outcome === expected, ms: result.ms, first: (result.blocking[0] || result.warnings[0] || '').slice(0, 110) });
  }
  return rows;
};
