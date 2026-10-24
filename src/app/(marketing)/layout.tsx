import { MarketingHeader } from "@/components/marketing/MarketingChrome";
import PiedDePage from "@/components/layout/PiedDePage";

// Route group for the organizer site: its own chrome, none of the app shell.
// No auth gating either, the whole point of these pages is to be read by
// someone who has no account yet. The candidature page asks for one itself,
// at the moment it actually needs it.
//
// Le pied, lui, est celui de l'application : un seul pied de page pour tout
// le site (voir components/layout/PiedDePage).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <PiedDePage />
    </div>
  );
}
