import CompetitionPublicNav from "@/components/competition/CompetitionPublicNav";

// Public, login-free competition pages (/c/[slug]/**), rendered inside the
// general app shell (the (app) layout treats /c as public). This nested
// layout only adds the competition tab bar — the shell provides the header,
// sidebars and page background.
export default function PublicCompetitionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <CompetitionPublicNav />
      </div>
      {children}
    </div>
  );
}
