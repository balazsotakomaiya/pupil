import Footer from "./components/Footer";
import Nav from "./components/Nav";
import Rulers from "./components/Rulers";
import Features from "./sections/Features";
import FinalCta from "./sections/FinalCta";
import Hero from "./sections/Hero";
import HowItWorks from "./sections/HowItWorks";
import Science from "./sections/Science";
import shared from "./styles/shared.module.css";

export default function App() {
  return (
    <>
      <Rulers />
      <Nav />

      <main>
        <Hero />

        <div className={shared.rulerDivider} />

        <HowItWorks />

        <div className={shared.rulerDivider} />

        <Science />

        <div className={shared.rulerDivider} />

        <Features />

        <div className={shared.rulerDivider} />

        <FinalCta />
      </main>

      <div className={shared.rulerDivider} />

      <Footer />
    </>
  );
}
