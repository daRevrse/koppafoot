"use client";

import { isOrganizer, isVenueOwner as ownsVenue } from "@/lib/hats";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { ROLE_LABELS } from "@/types";
import { avatarColor } from "./PostCard";
import type { UserProfile } from "@/types";

interface UserProfileWidgetProps {
  user: UserProfile;
}

export function UserProfileWidget({ user }: UserProfileWidgetProps) {
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
  // Le role, et lui seul, dans la pastille, ou RIEN.
  //
  // Le repli sur `user_type` reintroduisait exactement ce qu'on veut eviter :
  // un compte sans role Evolution mais marque `organizer` ou `venue_owner`
  // affichait « Organisateur » ou « Propriétaire de terrain » en pastille de
  // role. Sans role choisi, il n'y a pas de role a annoncer, et les
  // casquettes se disent en toutes lettres juste en dessous.
  const roleLabel = user.evolutionRole ? ROLE_LABELS[user.evolutionRole] : null;

  // Les casquettes se disent en toutes lettres, sous le nom : ce sont des
  // fonctions cumulables, pas une identite unique qu'une pastille pourrait
  // porter. Un compte peut avoir les deux.
  const casquettes = [
    isOrganizer(user) ? "Organisateur de compétition" : null,
    ownsVenue(user) ? "Propriétaire de terrain" : null,
  ].filter(Boolean) as string[];

  return (
    <div className=" border border-gray-200/70 bg-white p-4">
      {/* Avatar + name */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(`${user.firstName} ${user.lastName}`)}`}>
          {user.profilePictureUrl ? (
            <img
              src={user.profilePictureUrl}
              alt={initials}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">
            {ownsVenue(user) && user.companyName
              ? user.companyName
              : `${user.firstName} ${user.lastName}`}
          </p>
          {roleLabel && (
            <span className="mt-1 inline-block border border-gray-200/70 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-gray-500">
              {roleLabel}
            </span>
          )}
          {casquettes.length > 0 && (
            <p className="mt-1 text-[11px] font-semibold leading-snug text-gray-500">
              {casquettes.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* City */}
      {user.locationCity && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <MapPin size={12} className="shrink-0" />
          <span>{user.locationCity}</span>
        </div>
      )}

      {/* Followers */}
      <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-500">
        <Users size={12} className="shrink-0" />
        <span>
          <span className="font-semibold text-gray-800">{user.followersCount ?? 0}</span> abonnés
          {" · "}
          <span className="font-semibold text-gray-800">{user.followingCount ?? 0}</span> suivis
        </span>
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="mt-3 text-xs text-gray-600 leading-relaxed line-clamp-2 text-center">
          {user.bio}
        </p>
      )}

      <Link
        href="/profile"
        className="mt-4 flex w-full items-center justify-center border border-primary-200 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
      >
        Voir mon profil
      </Link>
    </div>
  );
}
