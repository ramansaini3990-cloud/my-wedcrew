import useHomeData from '../hooks/useHomeData';
import HeroSlider from '../components/home/HeroSlider';
import SearchPanel from '../components/home/SearchPanel';
import TrustStats from '../components/home/TrustStats';
import CategorySection from '../components/home/CategorySection';
import FeaturedProfessionals from '../components/home/FeaturedProfessionals';
import VideoShowcase from '../components/home/VideoShowcase';
import WhyWedCrew from '../components/home/WhyWedCrew';
import HowItWorks from '../components/home/HowItWorks';
import RequirementsPreview from '../components/home/RequirementsPreview';
import AvailabilitySection from '../components/home/AvailabilitySection';
import PricingSection from '../components/home/PricingSection';
import Testimonials from '../components/home/Testimonials';
import FinalCTA from '../components/home/FinalCTA';

/**
 * WedCrew homepage.
 *
 * Composition only - every section is its own component. All live data is
 * fetched once by useHomeData() and passed down, so no endpoint is called
 * twice. Editorial copy and media live in config/homeContent.js.
 */
export default function Home() {
  const {
    professionals,
    publishedRequirements,
    cities,
    counts,
    loadingProfessionals,
    loadingRequirements,
    professionalsError,
    requirementsError
  } = useHomeData();

  return (
    <div className="bg-brand-bg">
      <HeroSlider />

      {/* Sits below the hero on mobile; overlaps its base from md upward. */}
      <div className="relative z-20 px-4 sm:px-6 lg:px-8 -mt-6 md:-mt-14 mb-12 md:mb-16">
        <div className="max-w-5xl mx-auto">
          <SearchPanel cities={cities} />
        </div>
      </div>

      <TrustStats counts={counts} loading={loadingProfessionals || loadingRequirements} />

      <CategorySection professionals={professionals} loading={loadingProfessionals} />

      <FeaturedProfessionals
        professionals={professionals}
        loading={loadingProfessionals}
        error={professionalsError}
      />

      <VideoShowcase />

      <WhyWedCrew />

      <HowItWorks />

      <RequirementsPreview
        requirements={publishedRequirements}
        loading={loadingRequirements}
        error={requirementsError}
      />

      <AvailabilitySection professionals={professionals} loading={loadingProfessionals} />

      <PricingSection />

      <Testimonials />

      <FinalCTA />
    </div>
  );
}
