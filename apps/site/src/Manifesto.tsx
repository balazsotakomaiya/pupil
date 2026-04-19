import { Link } from "react-router-dom";
import Nav from "./Nav";

const REPO_URL = "https://github.com/balazsotakomaiya/pupil";
const DOCS_URL = `${REPO_URL}/wiki`;
const ISSUES_URL = `${REPO_URL}/issues`;

export default function Manifesto() {
  return (
    <>
      {/* Ruler overlay */}
      <div className="rulers" aria-hidden="true">
        <div className="ruler ruler-v ruler-outer-left" />
        <div className="ruler ruler-v ruler-outer-right" />
        <div className="ruler ruler-v ruler-content-left" />
        <div className="ruler ruler-v ruler-content-right" />
        <div className="ruler ruler-h ruler-top" />
        <div className="ruler ruler-h ruler-bottom" />
      </div>

      <Nav />

      {/* Manifesto content */}
      <main className="manifesto">
        <div className="manifesto-inner">
          <header className="manifesto-header">
            <p className="section-label">Manifesto</p>
            <h1 className="manifesto-title">
              Why I built
              <br />
              <em>Pupil</em>
            </h1>
            <p className="manifesto-subtitle">
              A personal essay on memory, learning, and building software that actually fits your
              life.
            </p>
          </header>

          <div className="ruler-divider" />

          <article className="manifesto-body">
            <section className="manifesto-section">
              <h2 className="manifesto-h2">I have a terrible memory.</h2>
              <p>
                I mean genuinely, embarrassingly bad. Names, concepts I studied last week, things I
                read and felt certain I understood — gone. I'd revisit material I swore I knew and
                find nothing there. It's frustrating in a way that's hard to describe: not because
                I'm lazy, but because the effort felt wasted. I put the work in and still came up
                empty.
              </p>
              <p>
                I don't think I'm alone in this. Memory is slippery for most people. So I went
                looking for a solution.
              </p>
            </section>

            <div className="ruler-divider" />

            <section className="manifesto-section">
              <h2 className="manifesto-h2">The science is actually there.</h2>
              <p>
                Spaced repetition isn't a productivity hack. It's one of the most robust findings in
                cognitive psychology. Ebbinghaus mapped the forgetting curve in 1885 — memory decays
                predictably, and reviewing material at exactly the right moment before you forget it
                dramatically improves retention with far less total effort.
              </p>
              <p>
                Modern implementations like FSRS-5 — the algorithm Pupil uses — are the result of
                decades of refinement. Provably more accurate than the older SM-2 algorithm most
                flashcard tools still rely on. When you rate a card in Pupil, FSRS-5 calculates the
                precise moment your memory will need reinforcing. It shows you when you'll see it
                next before you even tap the button.
              </p>
              <p>
                This isn't magic. It's math that most apps aren't bothering to get right. I wanted
                to get it right. But knowing the solution existed wasn't the hard part.
              </p>
            </section>

            <div className="ruler-divider" />

            <section className="manifesto-section">
              <h2 className="manifesto-h2">I kept quitting anyway.</h2>
              <p>
                Every flashcard app I tried had the same problem: it lived somewhere else. A
                separate window, a different device, a workflow I had to context-switch into. The
                review session became a thing I had to remember to do — which, given that I have a
                terrible memory, meant I often didn't.
              </p>
              <p>
                Pupil is a native desktop app. It lives in your dock. It runs in your workspace,
                alongside your editor and your browser, not competing with them. You don't open a
                browser tab to study. You just open Pupil. And when you're away from your laptop, a
                mobile version is coming — because the tool should be wherever you have a spare
                moment, not just at your desk.
              </p>
            </section>

            <div className="ruler-divider" />

            <section className="manifesto-section">
              <h2 className="manifesto-h2">Presence alone isn't enough. Habits need a loop.</h2>
              <p>
                Knowing something works isn't enough to make you do it every day. We are
                dopamine-driven creatures. We need feedback, progress, small victories. The reason
                gym streaks work isn't that they make you stronger — it's that they make the habit
                feel real. You can see it. You're reluctant to break it.
              </p>
              <p>
                Anki, which I deeply respect, doesn't give you that. It's a power tool — precise,
                extensible, and designed for people who already have the discipline to show up every
                day. I don't always have that. I needed something that nudged me. That showed me my
                streak, my retention rate, the cards due today. That made the act of learning feel
                like forward motion toward a goal, not just maintenance.
              </p>
              <blockquote className="manifesto-quote">
                Pupil has streaks, per-space stats, and reminders — not because they're clever
                features, but because without them, I personally would not have kept using it.
              </blockquote>
            </section>

            <div className="ruler-divider" />

            <section className="manifesto-section">
              <h2 className="manifesto-h2">Then AI removed the last excuse.</h2>
              <p>
                Even when I was consistent, there was one thing that always felt like work: making
                the cards in the first place. Writing flashcards is an art. Done well, it takes real
                thought. Done badly, you end up reviewing useless questions for months.
              </p>
              <p>
                We live in a moment where "AI-powered" has become a marketing checkbox. Every app
                has a copilot, a chat window, a suggestion engine. Most of them feel bolted on,
                because they are. But AI can genuinely feel magical — when it's surgical. When it
                does one specific thing, in exactly the right moment, better than you could do it
                yourself.
              </p>
              <p>
                In Pupil, AI does one job: it turns a topic you care about into a full deck of
                cards, instantly. No prompting, no fiddling. You type, it generates, you review and
                approve. That's the entire surface area. The rest is you and the algorithm.
              </p>
            </section>

            <div className="ruler-divider" />

            <section className="manifesto-section">
              <h2 className="manifesto-h2">Open source can be genuinely delightful.</h2>
              <p>
                I wanted to build something for myself. But I also wanted to give it back. There's a
                perception in some corners that open source means rough edges — something you use
                because it's free rather than because it's good. I've never believed that.
              </p>
              <p>
                Pupil is open source and I've tried to make it as tasteful and considered as I know
                how. The type is set carefully. The interactions are smooth. The design has a point
                of view. Free software can be the software you're proud to have open on your screen.
                That felt worth proving.
              </p>
            </section>

            <div className="ruler-divider" />

            <section className="manifesto-section">
              <h2 className="manifesto-h2">It's not for everyone. That's the point.</h2>
              <p>
                Pupil is opinionated. I made deliberate choices to leave things out. There is no
                scripting system, no custom card templates, no plugin ecosystem, no sync you can
                configure by hand.
              </p>
              <p>
                If that sounds limiting — it might be, for you. And that's genuinely fine. Anki
                exists, it's been battle-hardened over two decades, and it can do almost anything
                you can imagine. If you want total control over your flashcard experience, I can
                wholeheartedly recommend it. It's great. It's just not for me.
              </p>
              <p>
                Pupil is for people who want something that works, looks good, and stays out of the
                way. One less decision to make. One less thing to configure before you can start
                learning.
              </p>
            </section>

            <div className="ruler-divider" />

            <footer className="manifesto-sign">
              <p>
                If any of this resonates —{" "}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  Pupil is open source
                </a>
                . Try it, break it, contribute to it.
              </p>
              <a
                href="https://otakomaiya.com"
                className="footer-credit"
                target="_blank"
                rel="noopener noreferrer"
              >
                Balazs Otakomaiya
              </a>
            </footer>
          </article>
        </div>
      </main>

      <div className="ruler-divider" />

      {/* Footer */}
      <footer className="footer">
        <Link to="/" className="footer-logo">
          pupil
        </Link>
        <nav className="footer-links">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span className="sep">·</span>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            Docs
          </a>
          <span className="sep">·</span>
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
            Issues
          </a>
        </nav>
        <a
          href="https://otakomaiya.com"
          className="footer-credit"
          target="_blank"
          rel="noopener noreferrer"
        >
          Balazs Otakomaiya
        </a>
      </footer>
    </>
  );
}
