import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import RolesSection from "@/components/landing/RolesSection";
import StatsSection from "@/components/landing/StatsSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import FanSection from "@/components/landing/FanSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <>
      <LandingNav />
      <HeroSection />
      <RolesSection />
      <StatsSection />
      <FeaturesSection />
      <FanSection />
      <CTASection />
      <LandingFooter />
    </>
  );
}
