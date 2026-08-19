import ScoreShell from "@/components/layout/v2/ScoreShell";

// Route group for the scores-portal shell (ScoreShell): ticker strip, a
// coloured band carrying the whole navigation, no left sidebar. It exists
// beside the (app) group so the current shell keeps serving every other
// route untouched.
//
// Unlike (app)/layout.tsx this group does NO auth gating: the only page in it
// is the public Direct board. Any protected page added here must bring its
// own guard.
export default function ScoresLayout({ children }: { children: React.ReactNode }) {
  return <ScoreShell>{children}</ScoreShell>;
}
