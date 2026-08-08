"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDown } from "lucide-react";

// ============================================
// Pull-to-refresh for the app shell.
//
// Why this exists rather than leaning on the browser: installed to the home
// screen, iOS gives a standalone PWA no pull-to-refresh at all — there is no
// address bar to pull against, and Safari exposes no equivalent gesture. So
// the app has to own it. `overscroll-behavior-y: contain` on the body (see
// globals.css) stops Android's native version from firing on top of this one,
// which keeps the gesture identical on both platforms.
//
// Touch only. Desktop never fires these events, so the component is inert
// there — no mouse fallback is wanted, a browser reload already exists.
// ============================================

/** Finger travel, in px, that commits to a refresh on release. */
const THRESHOLD = 72;
/** Hard cap on how far the indicator travels, however far the finger goes. */
const MAX_PULL = 110;
/** Spinner floor, so a fast refresh still reads as "something happened". */
const MIN_SPIN_MS = 450;

/** True when the touch began inside something that is itself scrolled down. */
function startedInsideScrolledElement(target: EventTarget | null): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Mirrors `active` for rendering: a ref cannot be read during render, and
  // the transition has to be off mid-drag so the indicator tracks the finger.
  const [dragging, setDragging] = useState(false);

  // Refs, not state: these are read inside listeners registered once, and a
  // re-render per touchmove frame would make the gesture stutter.
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const refreshingRef = useRef(false);
  /** Latest pull distance, readable inside the listeners without a closure. */
  const pullRef = useRef(0);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      // Only from the very top, and never when the finger landed in a list
      // that has its own scroll position to give back first.
      if (window.scrollY > 0 || startedInsideScrolledElement(e.target)) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
      setDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        // Pulling back up — hand the gesture to normal scrolling.
        pullRef.current = 0;
        setPull(0);
        active.current = false;
        setDragging(false);
        return;
      }
      // Resistance: the indicator moves at a fraction of the finger, so the
      // pull feels weighted instead of rubber-banding away.
      const travel = Math.min(MAX_PULL, delta * 0.45);
      pullRef.current = travel;
      setPull(travel);
      if (travel > 4 && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!active.current) return;
      active.current = false;
      setDragging(false);
      startY.current = null;

      const travelled = pullRef.current;
      pullRef.current = 0;

      if (travelled < THRESHOLD) {
        setPull(0);
        return;
      }
      // Commit. Held at the threshold so the spinner has somewhere to sit.
      // Done outside any state updater: React may invoke an updater twice,
      // which would fire two refreshes.
      setPull(THRESHOLD);
      setRefreshing(true);
      router.refresh();
      setTimeout(() => {
        setRefreshing(false);
        setPull(0);
      }, MIN_SPIN_MS);
    };

    // passive: false on move only — preventDefault is what stops the page
    // from scrolling underneath the gesture.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  const armed = pull >= THRESHOLD;

  return (
    <>
      {/* Indicator. Sits under the header and rides the pull down. */}
      <div
        aria-hidden={pull === 0}
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center lg:hidden"
        style={{
          transform: `translateY(${pull}px)`,
          opacity: pull === 0 ? 0 : Math.min(1, pull / THRESHOLD),
          transition: dragging ? "none" : "transform 220ms ease, opacity 220ms ease",
        }}
      >
        <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/5">
          {refreshing ? (
            <Loader2 size={17} className="animate-spin text-primary-600" />
          ) : (
            <ArrowDown
              size={17}
              className={`text-gray-400 transition-transform duration-200 ${
                armed ? "rotate-180 text-primary-600" : ""
              }`}
            />
          )}
        </div>
      </div>

      <div
        style={{
          transform: pull > 0 ? `translateY(${pull}px)` : undefined,
          transition: dragging ? "none" : "transform 220ms ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
