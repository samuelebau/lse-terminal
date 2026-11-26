// The SHIPPED chart bundle, executed as-is in Node. lse_terminal/ui/static/
// chart/chart.js is a pure vite build of frontend/src (entry mount.tsx), and
// the pinned tests drive the shipped artifact rather than a recompilation of
// the sources: a bug that only a stale or hand-edited bundle could carry is
// then caught here, not just in the browser.
//
// Two things make that possible without a browser:
//   - the bundle only defines and assigns globals at module level (window.
//     LSEChart, the islands, ...); nothing renders until mount() is called,
//     so no DOM is provided — just the handful of host globals its module
//     level touches;
//   - frontend/src/lib/utils.ts exposes its price registry and formatters
//     through the globalThis.__lsePriceFmt seam. Property names survive
//     minification, so the tests reach the REAL shipped functions whatever
//     the minifier calls them; the old __lse* names were this seam, patched
//     by hand into the minified bundle before the bundle was a pure build
//     product again.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const bundle = fs.readFileSync(new URL('../lse_terminal/ui/static/chart/chart.js', import.meta.url), 'utf8');

export { bundle };

// A fresh page: the bundle evaluated with a fresh registry, exactly what a
// reload gives the shell. 187 ms of echarts/three.js module setup, so the
// pinned tests each load what they need and nothing leaks between them.
export function bundlePage() {
  const c = {
    // echarts' scheduler and a few libraries touch these at module level.
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    queueMicrotask: (f) => f(),
    console, performance: { now: () => Date.now() },
    navigator: { userAgent: 'node' }, location: { href: 'http://127.0.0.1:7787/' },
    addEventListener: () => {}, removeEventListener: () => {},
  };
  vm.createContext(c);
  // The bundle assigns its islands to window.*; the page's window is its
  // own global, and so is this one.
  c.window = c; c.self = c;
  vm.runInContext(bundle, c);
  const seam = c.__lsePriceFmt;
  assert.ok(seam && typeof seam.formatPriceForSymbol === 'function',
    'the bundle ships globalThis.__lsePriceFmt (frontend/src/lib/utils.ts)');
  return c;
}

// The shipped price machinery under the names the pinned tests use:
// fmt prices (rF is the old bundled name quote_scale still calls it by),
// set declares a source's digits, ver versions them, width sizes the price
// axis, axis picks an axis's one number of places, fill prices the order form.
export function shipped() {
  const c = bundlePage();
  const s = c.__lsePriceFmt;
  return {
    fmt: s.formatPriceForSymbol, set: s.setPriceDigits, ver: s.priceDigitsVersion,
    width: s.calculatePriceAxisWidth, axis: s.priceAxisScale, fill: s.orderFormPrice,
    rF: s.formatPriceForSymbol,
  };
}
