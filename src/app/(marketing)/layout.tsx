import { MarketingHeader, MarketingFooter } from "@/components/marketing/MarketingChrome";

// Route group for the organizer site: its own chrome, none of the app shell.
// No auth gating either — the whole point of these pages is to be read by
// someone who has no account yet. The candidature page asks for one itself,
// at the moment it actually needs it.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
