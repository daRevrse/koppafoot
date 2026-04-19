"use client";

import { useRef, useEffect, useCallback } from "react";
import type { UserProfile } from "@/types";

// ============================================
// Types
// ============================================

interface KoppaFootCardProps {
  profile: UserProfile;
  className?: string;
  width?: number;
}

// ============================================
// Constants
// ============================================

const POSITION_SHORT: Record<string, string> = {
  goalkeeper: "GK",
  defender: "DEF",
  midfielder: "MID",
  forward: "FW",
  any: "ANY",
};

const CARD_RATIO = 1.4; // height/width ratio (FUT card style)

// ============================================
// Draw helpers
// ============================================

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  profile: UserProfile,
  w: number,
  h: number,
  avatarImg: HTMLImageElement | null
) {
  const pad = w * 0.06;

  // === Background card ===
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#064e3b");
  grad.addColorStop(0.4, "#059669");
  grad.addColorStop(0.7, "#10b981");
  grad.addColorStop(1, "#d97706");

  roundRect(ctx, 0, 0, w, h, w * 0.04);
  ctx.fillStyle = grad;
  ctx.fill();

  // === Inner border ===
  const borderInset = w * 0.025;
  roundRect(ctx, borderInset, borderInset, w - borderInset * 2, h - borderInset * 2, w * 0.03);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // === KOPPAFOOT brand ===
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = `bold ${w * 0.045}px 'Inter', 'Outfit', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("KOPPAFOOT", w / 2, h * 0.065);

  // === Overall rating ===
  ctx.fillStyle = "#FBBF24";
  ctx.font = `bold ${w * 0.16}px 'Inter', 'Outfit', sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("99", pad * 1.5, h * 0.25);

  // === Position ===
  const pos = profile.position ? POSITION_SHORT[profile.position] ?? "JOU" : "JOU";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${w * 0.055}px 'Inter', 'Outfit', sans-serif`;
  ctx.fillText(pos, pad * 1.5, h * 0.30);

  // === Avatar photo ===
  const avatarSize = w * 0.38;
  const avatarX = w / 2 - avatarSize / 2 + w * 0.05;
  const avatarY = h * 0.10;

  if (avatarImg) {
    ctx.save();
    // Hexagonal clip approximation (circle for simplicity + premium look)
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    // Avatar border
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // Initials fallback
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const initials = `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${avatarSize * 0.4}px 'Inter', 'Outfit', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    ctx.textBaseline = "alphabetic";
  }

  // === Divider line ===
  const divY = h * 0.52;
  ctx.beginPath();
  ctx.moveTo(pad * 2, divY);
  ctx.lineTo(w - pad * 2, divY);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // === Player name ===
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${w * 0.075}px 'Inter', 'Outfit', sans-serif`;
  ctx.textAlign = "center";
  const displayName = `${profile.firstName} ${profile.lastName}`.toUpperCase();
  ctx.fillText(displayName, w / 2, h * 0.60);

  // === City ===
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `${w * 0.04}px 'Inter', 'Outfit', sans-serif`;
  ctx.fillText(profile.locationCity?.toUpperCase() || "", w / 2, h * 0.66);

  // === Stats grid (2 rows × 3 cols) ===
  const stats = [
    { label: "PAC", value: 99 },
    { label: "SHO", value: 99 },
    { label: "PAS", value: 99 },
    { label: "DRI", value: 99 },
    { label: "DEF", value: 99 },
    { label: "PHY", value: 99 },
  ];

  const gridStartY = h * 0.71;
  const colWidth = (w - pad * 4) / 3;
  const rowHeight = h * 0.12;

  stats.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = pad * 2 + colWidth * col + colWidth / 2;
    const cy = gridStartY + row * rowHeight;

    // Stat value
    ctx.fillStyle = "#FBBF24";
    ctx.font = `bold ${w * 0.075}px 'Inter', 'Outfit', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(stat.value.toString(), cx, cy);

    // Stat label
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${w * 0.035}px 'Inter', 'Outfit', sans-serif`;
    ctx.fillText(stat.label, cx, cy + h * 0.04);
  });

  // === Footer watermark ===
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.font = `${w * 0.03}px 'Inter', 'Outfit', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("koppafoot.com", w / 2, h * 0.97);
}

// ============================================
// Component
// ============================================

export default function KoppaFootCard({ profile, className = "", width = 320 }: KoppaFootCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = Math.round(width * CARD_RATIO);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    if (profile.profilePictureUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        drawCard(ctx, profile, width, height, img);
      };
      img.onerror = () => {
        drawCard(ctx, profile, width, height, null);
      };
      img.src = profile.profilePictureUrl;
    } else {
      drawCard(ctx, profile, width, height, null);
    }
  }, [profile, width, height]);

  useEffect(() => {
    render();
  }, [render]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `koppafoot-card-${profile.firstName}-${profile.lastName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="relative group">
        <canvas
          ref={canvasRef}
          className="rounded-2xl shadow-2xl transition-transform duration-300 group-hover:scale-[1.02]"
          style={{ width, height }}
        />
        {/* Shine effect overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 transition-all hover:shadow-emerald-200"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Télécharger ma carte
      </button>
    </div>
  );
}
