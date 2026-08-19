import CompetitionPublicNav from "@/components/competition/CompetitionPublicNav";

// Public, login-free competition pages (/c/[slug]/**), rendered inside the
// general app shell (the (app) layout treats /c as public). This nested
// layout only adds the competition tab bar — the shell provides the header,
// sidebars and page background.
export default function PublicCompetitionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Flat rule instead of a floating card: the tab bar is a divider of
          the page, not an object sitting on top of it. */}
      <div className="mb-5 overflow-hidden border-b border-gray-200/70 bg-white">
        <CompetitionPublicNav />
      </div>
      {children}
    </div>
  );
}
