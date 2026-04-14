import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import RolesSection from "@/components/landing/RolesSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <>
      <LandingNav />
      <HeroSection />
      <RolesSection />
      <FeaturesSection />
      <TestimonialsSection />
      <CTASection />
      <LandingFooter />
    </>
  );
}
