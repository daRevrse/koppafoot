"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { NavGroup, NavItem } from "@/config/navigation";

// ============================================
// Variant styles
// ============================================

const VARIANT_STYLES = {
  sporty: {
    header: "text-emerald-400 hover:text-emerald-300",
    headerActive: "text-emerald-300",
    chevron: "text-emerald-500",
    item: "text-emerald-200/70 hover:text-white hover:bg-emerald-800/50",
    itemActive: "text-white bg-emerald-800/50 border-l-2 border-accent-500",
    iconDefault: "text-emerald-500",
    iconActive: "text-accent-400",
  },
  dark: {
    header: "text-gray-400 hover:text-gray-300",
    headerActive: "text-gray-200",
    chevron: "text-gray-500",
    item: "text-gray-400 hover:text-gray-200 hover:bg-gray-800",
    itemActive: "text-white bg-blue-600/20 border-l-2 border-blue-500",
    iconDefault: "text-gray-500",
    iconActive: "text-blue-400",
  },
  light: {
    header: "text-gray-500 hover:text-gray-700",
    headerActive: "text-gray-900",
    chevron: "text-gray-400",
    item: "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
    itemActive: "text-primary-700 bg-primary-50 border-l-2 border-primary-600",
    iconDefault: "text-gray-400",
    iconActive: "text-primary-600",
  },
};

// ============================================
// Props
// ============================================

interface SidebarNavGroupProps {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
  variant: "sporty" | "dark" | "light";
  iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>>;
}

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.path;
  return pathname.startsWith(item.path);
}

// ============================================
// Component
// ============================================

export default function SidebarNavGroup({ group, pathname, onNavigate, variant, iconMap }: SidebarNavGroupProps) {
  const styles = VARIANT_STYLES[variant];
  const hasActiveChild = group.items.some((item) => isItemActive(pathname, item));

  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return hasActiveChild;
    const stored = localStorage.getItem(`nav-${group.key}`);
    if (stored !== null) return stored === "true";
    return hasActiveChild;
  });

  // Auto-expand when a child becomes active
  useEffect(() => {
    if (hasActiveChild && !open) setOpen(true);
  }, [hasActiveChild]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`nav-${group.key}`, String(next));
  };

  const GroupIcon = iconMap[group.icon];

  return (
    <div>
      {/* Group header */}
      <button
        onClick={toggle}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
          hasActiveChild ? styles.headerActive : styles.header
        }`}
      >
        {GroupIcon && <GroupIcon size={16} className={styles.chevron} />}
        <span className="flex-1 text-left">{group.label}</span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight size={14} className={styles.chevron} />
        </motion.span>
      </button>

      {/* Collapsible children */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <ul className="ml-2 space-y-0.5 border-l border-current/10 pl-2 pt-1 pb-2">
              {group.items.map((item) => {
                const Icon = iconMap[item.icon];
                const active = isItemActive(pathname, item);
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      onClick={onNavigate}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active ? styles.itemActive : styles.item
                      }`}
                    >
                      {Icon && <Icon size={16} className={active ? styles.iconActive : styles.iconDefault} />}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
