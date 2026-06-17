import LandingNav from "@/components/landing/LandingNav";
import HeroSpotlight from "@/components/landing/HeroSpotlight";
import CompetitionsTeaser from "@/components/landing/CompetitionsTeaser";
import RolesSection from "@/components/landing/RolesSection";
import StatsSection from "@/components/landing/StatsSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";
import { getFeaturedCompetition, getPublicCompetitions } from "@/lib/competition-admin";

export const revalidate = 60;

export default async function Home() {
  const [featured, competitions] = await Promise.all([
    getFeaturedCompetition(),
    getPublicCompetitions(),
  ]);
  return (
    <>
      <LandingNav />
      <HeroSpotlight featured={featured} />
      <CompetitionsTeaser competitions={competitions} />
      <RolesSection />
      <FeaturesSection />
      <StatsSection />
      <CTASection />
      <LandingFooter />
    </>
  );
}
