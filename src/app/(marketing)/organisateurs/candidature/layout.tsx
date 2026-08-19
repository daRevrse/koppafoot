// The page itself is a client component (form state, auth), so its metadata
// has to live here — without it the tab and any shared link fall back to the
// bare app title.
export const metadata = {
  title: "Devenir organisateur — KoppaFoot",
  description:
    "Dépose ta candidature pour organiser une compétition sur KoppaFoot : calendrier, classements et scores en direct.",
};

export default function CandidatureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
