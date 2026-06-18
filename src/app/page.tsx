import LandingNav from "@/components/landing/LandingNav";
import HeroSpotlight from "@/components/landing/HeroSpotlight";
import TodayFootball from "@/components/landing/TodayFootball";
import FeaturedFootballCompetitions from "@/components/landing/FeaturedFootballCompetitions";
import CompetitionsTeaser from "@/components/landing/CompetitionsTeaser";
import TribunePreview from "@/components/landing/TribunePreview";
import PlatformPromo from "@/components/landing/PlatformPromo";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";
import { getFeaturedCompetition, getPublicCompetitions } from "@/lib/competition-admin";
import { getTodayFootball, getFeaturedCompetitions } from "@/lib/football-data";
import { getRecentPublicPosts } from "@/lib/posts-admin";

export const revalidate = 60;

export default async function Home() {
  const [featured, competitions, today, footballComps, posts] = await Promise.all([
    getFeaturedCompetition(),
    getPublicCompetitions(),
    getTodayFootball(),
    getFeaturedCompetitions(),
    getRecentPublicPosts(6),
  ]);
  return (
    <>
      <LandingNav />
      <HeroSpotlight featured={featured} />
      <TodayFootball today={today} />
      <FeaturedFootballCompetitions competitions={footballComps} />
      <CompetitionsTeaser competitions={competitions} />
      <TribunePreview posts={posts} />
      <PlatformPromo />
      <CTASection />
      <LandingFooter />
    </>
  );
}
