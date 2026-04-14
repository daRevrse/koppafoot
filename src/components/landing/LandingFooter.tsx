import Image from "next/image";
import Link from "next/link";

const LINKS = {
  Plateforme: [
    { label: "Joueur", href: "/signup" },
    { label: "Manager", href: "/signup" },
    { label: "Arbitre", href: "/signup" },
    { label: "Propriétaire", href: "/signup/venue-owner" },
  ],
  Ressources: [
    { label: "Aide", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Blog", href: "#" },
  ],
  Légal: [
    { label: "CGU", href: "#" },
    { label: "Confidentialité", href: "#" },
    { label: "Mentions légales", href: "#" },
  ],
};

export default function LandingFooter() {
  return (
    <footer className="bg-gray-900 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Image
              src="/branding/logo_full_name.png"
              alt="KOPPAFOOT"
              width={130}
              height={34}
              className="brightness-0 invert"
            />
            <p className="mt-4 text-sm text-gray-400 leading-relaxed">
              La plateforme qui connecte les passionnés de football amateur.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white font-display">{title}</h4>
              <ul className="mt-4 space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-16 border-t border-gray-800 pt-8 text-center">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} KOPPAFOOT. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
