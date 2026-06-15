import Image from "next/image";
import Link from "next/link";

// Public, login-free shell for shareable competition pages (/c/[slug]/**).
// Server Component on purpose: no auth, no providers, no client state — just a
// light top bar + neutral wrapper. The middleware (src/proxy.ts) does NOT gate
// /c, so this renders for logged-out visitors.
export default function PublicCompetitionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/branding/logo_symbol.png"
              alt="Koppafoot"
              width={28}
              height={28}
              priority
              className="h-7 w-7"
            />
            <span className="font-display text-base font-black tracking-tight text-gray-900">
              Koppafoot
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
