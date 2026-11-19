'use client';

// Restores the page's scroll position when the person comes back with the back
// button or the iOS back swipe.
//
// Pages in Nights are separate page loads whose content arrives from Firestore after
// the first paint, so the browser's own scroll restoration runs while the page is
// still short and lands at the top. This remembers the position when the page is
// left and scrolls back once the content is tall enough, giving up as soon as the
// person scrolls or touches the page themselves.
//
// In the iOS app the window never scrolls: the app root is a fixed, full-screen
// scrolling container (.app-root.native-ios-app). Everywhere else the window scrolls.

import { useEffect } from 'react';

const keyFor = () => `nights-scroll:${window.location.pathname}${window.location.search}`;
const GIVE_UP_MS = 6000;

const appScroller = () => document.querySelector<HTMLElement>('.app-root.native-ios-app');

function cameBack() {
  const entry = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === 'back_forward';
}

// While an overlay is open the app pins <body> with position:fixed and a negative
// top, and window.scrollY reads 0; the real position is that offset.
const bodyPinned = () => document.body.style.position === 'fixed';

function currentY() {
  const scroller = appScroller();
  if (scroller) return scroller.scrollTop;
  return bodyPinned() ? Math.abs(parseFloat(document.body.style.top) || 0) : window.scrollY;
}

export function useScrollMemory() {
  useEffect(() => {
    let saveTimer = 0;
    const save = () => {
      try { sessionStorage.setItem(keyFor(), String(Math.round(currentY()))); } catch { /* storage unavailable */ }
    };
    const saveSoon = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, 150);
    };
    // Capture catches scrolling of the iOS app root as well as the window.
    document.addEventListener('scroll', saveSoon, { passive: true, capture: true });
    window.addEventListener('pagehide', save);

    let stopRestore = () => {};
    const restore = () => {
      let target = 0;
      try { target = Number(sessionStorage.getItem(keyFor())) || 0; } catch { target = 0; }
      if (target <= 0) return;
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      const started = Date.now();
      let frame = 0;
      let stopped = false;
      const stop = () => {
        stopped = true;
        window.cancelAnimationFrame(frame);
        window.removeEventListener('touchstart', stop);
        window.removeEventListener('wheel', stop);
        window.removeEventListener('keydown', stop);
      };
      const step = () => {
        if (stopped) return;
        const timedOut = Date.now() - started > GIVE_UP_MS;
        const scroller = appScroller();
        // Without the app root the window scrolls; while an overlay pins the page,
        // scrolling would be undone when it unpins, so wait.
        if (!scroller && bodyPinned()) {
          if (timedOut) stop();
          else frame = window.requestAnimationFrame(step);
          return;
        }
        const reachable = scroller
          ? scroller.scrollHeight - scroller.clientHeight
          : document.documentElement.scrollHeight - window.innerHeight;
        if (reachable >= target - 2 || timedOut) {
          const top = Math.min(target, Math.max(0, reachable));
          if (scroller) scroller.scrollTo({ top, behavior: 'auto' });
          else window.scrollTo({ top, behavior: 'auto' });
          stop();
          return;
        }
        frame = window.requestAnimationFrame(step);
      };
      window.addEventListener('touchstart', stop, { passive: true });
      window.addEventListener('wheel', stop, { passive: true });
      window.addEventListener('keydown', stop);
      frame = window.requestAnimationFrame(step);
      stopRestore = stop;
    };
    if (cameBack()) restore();
    return () => {
      stopRestore();
      window.clearTimeout(saveTimer);
      document.removeEventListener('scroll', saveSoon, { capture: true });
      window.removeEventListener('pagehide', save);
    };
  }, []);
}
