"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ============================================
// TopLoadingBar — a thin YouTube-style progress bar pinned to the top of
// the viewport. Starts trickling on internal link clicks / back-forward,
// then completes when the route (pathname or query) actually changes.
// ============================================

export default function TopLoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (hideT.current) clearTimeout(hideT.current);
    setVisible(true);
    setProgress(8);
    if (trickle.current) clearInterval(trickle.current);
    // Ease toward 90% and wait there until navigation resolves.
    trickle.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p));
    }, 200);
  }, []);

  const done = useCallback(() => {
    if (trickle.current) clearInterval(trickle.current);
    setProgress(100);
    hideT.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  }, []);

  // Route resolved → finish the bar.
  useEffect(() => {
    if (visible) done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Navigation start: internal link clicks + back/forward.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        start();
      } catch {
        /* not a navigable URL */
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
    };
  }, [start]);

  useEffect(() => {
    return () => {
      if (trickle.current) clearInterval(trickle.current);
      if (hideT.current) clearTimeout(hideT.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "#10b981",
          boxShadow: "0 0 8px rgba(16,185,129,0.7), 0 0 4px rgba(16,185,129,0.5)",
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}
