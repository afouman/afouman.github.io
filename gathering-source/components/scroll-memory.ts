'use client';

// Restores the page's scroll position when the person comes back with the back
// button or the iOS back swipe.
//
// Pages in Nights are separate page loads whose content arrives from Firestore after
// the first paint, so the browser's own scroll restoration runs while the page is
// still short and lands at the top. This remembers the position when the page is
// left and scrolls back once the content is tall enough, giving up as soon as the
// person scrolls or touches the page themselves.

import { useEffect } from 'react';

const keyFor = () => `nights-scroll:${window.location.pathname}${window.location.search}`;
const GIVE_UP_MS = 6000;

function cameBack() {
  const entry = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
  return entry?.type === 'back_forward';
}

export function useScrollMemory() {
  useEffect(() => {
    let saveTimer = 0;
    // While an overlay is open the app pins <body> with position:fixed and a negative
    // top, and window.scrollY reads 0; the real position is that offset.
    const currentY = () => {
      const body = document.body.style;
      return body.position === 'fixed' ? Math.abs(parseFloat(body.top) || 0) : window.scrollY;
    };
    const save = () => {
      try { sessionStorage.setItem(keyFor(), String(Math.round(currentY()))); } catch { /* storage unavailable */ }
    };
    const saveSoon = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, 150);
    };
    window.addEventListener('scroll', saveSoon, { passive: true });
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
        // While an overlay pins the page, scrolling would be undone when it unpins.
        if (document.body.style.position === 'fixed') {
          if (Date.now() - started > GIVE_UP_MS) { stop(); return; }
          frame = window.requestAnimationFrame(step);
          return;
        }
        const reachable = document.documentElement.scrollHeight - window.innerHeight;
        if (reachable >= target - 2) {
          window.scrollTo({ top: target, behavior: 'auto' });
          stop();
          return;
        }
        if (Date.now() - started > GIVE_UP_MS) {
          window.scrollTo({ top: Math.max(0, reachable), behavior: 'auto' });
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
    // Pages restored from the back-forward cache keep their scroll, so only a fresh
    // load needs help; a cached restore just keeps saving from here on.
    return () => {
      stopRestore();
      window.clearTimeout(saveTimer);
      window.removeEventListener('scroll', saveSoon);
      window.removeEventListener('pagehide', save);
    };
  }, []);
}
