"use client";

import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// "Organiser ma compétition" — lives on the /competitions screen only
// (removed from the header and the sidebar). Organizers land in their
// space; everyone else goes to the application form (guests get the
// login redirect from the app layout).
export default function OrganizeCompetitionCta({
  variant,
}: {
  variant: "button" | "link";
}) {
  const { user } = useAuth();
  const href =
    user && (user.userType === "organizer" || user.userType === "superadmin")
      ? "/organizer"
      : "/devenir-organisateur";

  if (variant === "link") {
    return (
      <div className="flex justify-center pt-2 pb-4">
        <Link
          href={href}
          className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 transition-colors hover:text-emerald-700"
        >
          Organiser ma compétition
          <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-emerald-500 px-4 py-3.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-emerald-600 sm:text-sm sm:normal-case sm:tracking-normal sm:font-bold"
    >
      <Plus size={16} />
      <span className="hidden sm:inline">Organiser ma compétition</span>
      <span className="sm:hidden">Organiser</span>
    </Link>
  );
}
