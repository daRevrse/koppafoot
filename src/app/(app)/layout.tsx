"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { LogOut, Loader2 } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — minimal for now, will be expanded with modules */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <Link href="/dashboard" className="text-xl font-bold text-primary-600">
            KOPPAFOOT
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6">
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">Navigation</p>
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Tableau de bord
          </Link>
        </nav>
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 text-sm">
            <p className="font-medium text-gray-900">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-gray-500">{user.email ?? user.phone}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-[var(--color-bg-secondary)] p-8">{children}</main>
    </div>
  );
}
