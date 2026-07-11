import LandingNav from "@/components/landing/LandingNav";
import CompetitionHeroCarousel from "@/components/landing/CompetitionHeroCarousel";
import CompetitionsTeaser from "@/components/landing/CompetitionsTeaser";
import TribunePreview from "@/components/landing/TribunePreview";
import PlatformPromo from "@/components/landing/PlatformPromo";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";
import { getHeroCompetitions, getPublicCompetitions } from "@/lib/competition-admin";
import { getTodayFootball, getFeaturedCompetitions } from "@/lib/football-data";
import { getRecentPublicPosts } from "@/lib/posts-admin";

export const revalidate = 60;

export default async function Home() {
  const [heroSlides, competitions, today, footballComps, posts] = await Promise.all([
    getHeroCompetitions(),
    getPublicCompetitions(),
    getTodayFootball(),
    getFeaturedCompetitions(),
    getRecentPublicPosts(6),
  ]);
  return (
    <>
      <LandingNav />
      <CompetitionHeroCarousel slides={heroSlides} realCompetitions={footballComps} today={today} />
      <CompetitionsTeaser competitions={competitions} />
      <TribunePreview posts={posts} />
      <PlatformPromo />
      <CTASection />
      <LandingFooter />
    </>
  );
}
