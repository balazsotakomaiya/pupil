import Footer from "./components/Footer";
import Nav from "./components/Nav";
import Rulers from "./components/Rulers";
import Features from "./sections/Features";
import FinalCta from "./sections/FinalCta";
import Hero from "./sections/Hero";
import HowItWorks from "./sections/HowItWorks";
import PlatformBar from "./sections/PlatformBar";
import ProductTour from "./sections/ProductTour";
import shared from "./styles/shared.module.css";

export default function App() {
  return (
    <>
      <Rulers />
      <Nav />

      <Hero />

      <div className={shared.rulerDivider} />

      <PlatformBar />

      <div className={shared.rulerDivider} />

      <ProductTour />

      <div className={shared.rulerDivider} />

      <Features />

      <div className={shared.rulerDivider} />

      <HowItWorks />

      <div className={shared.rulerDivider} />

      <FinalCta />

      <div className={shared.rulerDivider} />

      <Footer />
    </>
  );
}
