import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary-50">
        <span className="text-5xl">⚽</span>
      </div>
      <h1 className="mt-6 text-6xl font-black text-gray-900 font-display">404</h1>
      <p className="mt-2 text-xl font-semibold text-gray-700">Page introuvable</p>
      <p className="mt-2 text-sm text-gray-400">
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
