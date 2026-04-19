"use client";

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
  const roleLabel = ROLE_LABELS[user.userType] ?? "Joueur";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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
          <p className="text-sm font-bold text-gray-900">{user.firstName} {user.lastName}</p>
          <span className="inline-block rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 mt-0.5">
            {roleLabel}
          </span>
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
        className="mt-4 flex w-full items-center justify-center rounded-xl border border-primary-200 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
      >
        Voir mon profil
      </Link>
    </div>
  );
}
