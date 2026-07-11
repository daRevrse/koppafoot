import Image from "next/image";
import Link from "next/link";

const LINKS = {
  Plateforme: [
    { label: "Compétitions", href: "/competitions" },
    { label: "La Tribune", href: "/feed" },
    { label: "Organiser une compétition", href: "/organizer" },
    { label: "Créer un compte", href: "/signup" },
  ],
};

export default function LandingFooter() {
  return (
    <footer className="relative bg-[#1A1715] overflow-hidden">
      {/* Links section */}
      <div className="relative py-16 lg:py-24 border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-12 sm:grid-cols-2">
            {/* Brand */}
            <div>
              <div className="relative h-24 w-40">
                <Image
                  src="/branding/logo_full_name.png"
                  alt="KOPPAFOOT"
                  fill
                  className="object-contain object-left"
                  sizes="160px"
                />
              </div>
              <p className="mt-5 text-sm text-white/30 leading-relaxed max-w-xs">
                La plateforme qui connecte les passionnés de football amateur.
              </p>
            </div>

            {/* Link columns */}
            {Object.entries(LINKS).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest font-display">
                  {title}
                </h4>
                <ul className="mt-5 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-white/40 hover:text-white transition-colors duration-300"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Giant brand letters — centered */}
      <div className="relative overflow-hidden">
        <div className="py-12 lg:py-16 text-center">
          <p className="text-[6rem] sm:text-[10rem] lg:text-[14rem] font-black text-white/[0.04] font-display leading-none tracking-tighter select-none uppercase">
            KOPPAFOOT
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} KOPPAFOOT. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
