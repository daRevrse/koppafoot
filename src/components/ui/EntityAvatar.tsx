"use client";

import { Shield } from "lucide-react";

// ============================================
// EntityAvatar — la photo d'un joueur et le logo d'une équipe, au même
// endroit. Le mercato affichait des initiales et des icônes génériques dans
// la moitié de ses vues (sélection, candidatures, invitations) alors que la
// photo et le blason sont exactement ce sur quoi on recrute. Un seul
// composant pour que les deux côtés du marché se ressemblent partout.
//
// L'URL vient d'abord du document dénormalisé ; la page la réhydrate depuis
// /users ou /teams pour les documents créés avant ces champs.
// ============================================

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PlayerAvatar({
  name,
  photo,
  size = 40,
  className = "",
}: {
  name: string;
  photo?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-black text-emerald-700 ring-1 ring-emerald-100 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

export function TeamCrest({
  name,
  logo,
  size = 40,
  className = "",
  bg = "bg-gray-100",
  fg = "text-gray-400",
}: {
  name: string;
  logo?: string | null;
  size?: number;
  className?: string;
  bg?: string;
  fg?: string;
}) {
  return (
    <span
      aria-label={name}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${bg} ${className}`}
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full object-cover" />
      ) : (
        <Shield size={Math.round(size * 0.5)} className={fg} />
      )}
    </span>
  );
}
