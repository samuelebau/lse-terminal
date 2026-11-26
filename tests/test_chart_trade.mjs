// The chart's right-click menu trades the chart's own instrument, never
// another. Guarded against: a chart of DEMO:EURUSD with the ticket on a
// broker's AUD_USD placing a sell limit of AUD_USD at a EURUSD price
// (1.0259), off the instrument's grid. The rule:
//   - tpxTradeInfo carries the instrument an order goes to (the ticket's broker
//     instrument through a connector, the chart's own symbol on the sim), its
//     declared places and its tick;
//   - the chart menu offers its order rows only when the chart's symbol is that
//     instrument (a bare-symbol match), else no order rows;
//   - the form's price is filled at the instrument's places (the ticket's spec
//     digits), snapped to its tick, the chart source's only when the ticket
//     declares none;
//   - every placed and filled line names the instrument (proved in
//     test_price_scale.mjs: "sell limit 2000 AUD_USD @ 1.02590 placed").
// The shipped functions are cut out of app.js and run in node:vm; the bundle and
// its TS source (mount.tsx) are read and pinned alike.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../lse_terminal/ui/static/app.js', import.meta.url), 'utf8');
const bundle = fs.readFileSync(new URL('../lse_terminal/ui/static/chart/chart.js', import.meta.url), 'utf8');
const mount = fs.readFileSync(new URL('../frontend/src/mount.tsx', import.meta.url), 'utf8');

function cut(name) {
  let start = src.indexOf('\nasync function ' + name + '(');
  if (start < 0) start = src.indexOf('\nfunction ' + name + '(');
  assert.ok(start >= 0, 'no function ' + name);
  return src.slice(start + 1, src.indexOf('\n}\n', start) + 2);
}
const results = [];
async function test(name, f) {
  try { await f(); results.push(true); console.log('ok    ' + name); }
  catch (e) { results.push(false); console.log('FAIL  ' + name + '\n        ' + String(e.message || e).split('\n').slice(0, 10).join('\n        ')); }
}
function tradeCtx(opts) {
  const c = {
    tpxVisible: () => true, tpx: { acct: { id: 'a' } }, state: { symbol: opts.chartSymbol },
    $: (id) => ({ value: opts.qty == null ? '' : String(opts.qty) }),
    tpbViaConnector: () => !!opts.connector,
    tpbSpec: () => opts.spec || null,
    tpbCaps: () => opts.caps || {},
    Number, Math, isFinite, String, parseFloat,
  };
  vm.createContext(c);
  vm.runInContext(cut('tpxTradeInfo'), c);
  return c;
}

await test('1. the connector: the instrument is the ticket\'s, with its places and tick', () => {
  const c = tradeCtx({ connector: true, chartSymbol: 'DEMO:EURUSD', qty: 2000,
    spec: { symbol: 'AUD_USD', digits: 5, tick_size: 0.00001 },
    caps: { orders: { pending: true, pending_types: ['limit', 'stop'] } } });
  const t = c.tpxTradeInfo();
  assert.equal(t.available, true);
  assert.equal(t.instrument, 'AUD_USD', 'the order goes to the ticket\'s instrument');
  assert.equal(t.digits, 5);
  assert.equal(t.tick, 0.00001);
  assert.equal(t.qty, 2000);
  assert.deepEqual(t.pendingTypes, ['limit', 'stop']);
});
await test('2. a spec that declares no places or tick: both null, the chart source\'s used', () => {
  const c = tradeCtx({ connector: true, chartSymbol: 'EUR_USD', qty: 1000,
    spec: { symbol: 'EUR_USD' }, caps: { orders: { pending: true, pending_types: ['limit'] } } });
  const t = c.tpxTradeInfo();
  assert.equal(t.instrument, 'EUR_USD');
  assert.equal(t.digits, null);
  assert.equal(t.tick, null);
  assert.deepEqual(t.pendingTypes, ['limit']);
});
await test('3. the sim: the instrument is the chart\'s own symbol, no digits, no tick', () => {
  const c = tradeCtx({ connector: false, chartSymbol: 'DEMO:EURUSD', qty: 500 });
  const t = c.tpxTradeInfo();
  assert.equal(t.instrument, 'DEMO:EURUSD', 'the sim trades the chart\'s symbol');
  assert.equal(t.digits, null);
  assert.equal(t.tick, null);
  assert.deepEqual([...t.pendingTypes], ['limit', 'stop']);     // [...] crosses the vm realm
});
await test('4. no account, or the ticket hidden: trading is not available', () => {
  const c = tradeCtx({ connector: true, chartSymbol: 'EUR_USD', qty: 1000, spec: { symbol: 'EUR_USD' } });
  c.tpx.acct = null;
  const r = c.tpxTradeInfo();
  assert.equal(r.available, false);
  assert.deepEqual(Object.keys(r), ['available'], 'nothing else when trading is off');
});

// ── the bundle and its source: the menu gates its rows and prices the form ──
await test('5. the menu offers its order rows only when the chart shows the instrument', () => {
  // the bundle: the trade blocks are gated on available AND a bare-symbol
  // match of the chart's symbol to the instrument the order goes to — the
  // bareMatch helper of mount.tsx, whose comparison is pinned by shape (regex
  // literals and property names survive minification; identifiers are [\w$]+)
  assert.ok([...bundle.matchAll(/available\)?&&[\w$]+\([\w$]+,[\w$]*(?:\.[\w$]+)*?\.instrument[,)]/g)].length >= 2,
             'the bundle gates both trade blocks on a bare-symbol match');
  assert.match(bundle, /String\([\w$]+\)\.replace\(\/\[\^A-Z0-9\]\/gi,""\)\.toUpperCase\(\)===String\([\w$]+\)\.replace\(\/\[\^A-Z0-9\]\/gi,""\)\.toUpperCase\(\)/,
               'the match strips both sides to bare letters');
  // the market rows name the instrument the order goes to — every one of
  // them, never the chart's symbol
  const rows = [...bundle.matchAll(/\$\{[\w$]+\}\$\{[^}]+\} at market/g)];
  assert.ok(rows.length >= 2, 'the market rows exist');
  for (const m of rows) assert.match(m[0], /\$\{[\w$]+\}\$\{[\w$]+\.instrument\}/,
    `the market rows name the instrument: ${m[0]}`);
  // the source (mount.tsx) says the same: a bareMatch helper gates the block
  assert.match(mount, /const bareMatch = /, 'mount.tsx defines a bare-symbol match');
  assert.match(mount, /ctxMenu\.trade\?\.available && bareMatch\(symbol, ctxMenu\.trade\.instrument\) &&/,
               'the trade block is gated on available and the bare-symbol match');
  assert.match(mount, /Buy \$\{qty\}\$\{t\.instrument\} at market/, 'the market rows name the instrument');
});
await test('6. the form\'s price is at the instrument\'s places, snapped to its tick', () => {
  // the bundle's prefill: the ticket's digits and tick when it declares them,
  // the chart source's (orderFormPrice) only when it does not
  assert.match(bundle, /[\w$]+\.tick>0\?Math\.round\([\w$]+\/[\w$]+\.tick\)\*[\w$]+\.tick:[\w$]+\)\.toFixed\([\w$]+\.digits\)/,
               'the bundle snaps to the tick and fills at the declared places');
  assert.equal([...bundle.matchAll(/:[\w$]+\([\w$]+,[\w$]+,[\w$]+\):""\)/g)].length, 1,
               'the chart source is the one three-argument fallback');
  // the source says the same
  assert.match(mount, /t\.tick && t\.tick > 0 \? Math\.round\(p \/ t\.tick\) \* t\.tick : p\)\.toFixed\(t\.digits\)/,
               'mount.tsx snaps to the tick and fills at the declared places');
  assert.match(mount, /: orderFormPrice\(p, symbol, provider\)/, 'the chart source is the fallback');
});

const bad = results.filter((r) => !r).length;
if (bad) { console.log(`test_chart_trade.mjs: ${bad} of ${results.length} blocks FAILED`); process.exitCode = 1; }
else console.log(`test_chart_trade.mjs: ok (${results.length} blocks)`);
