import Footer from "./components/Footer";
import footerStyles from "./components/Footer.module.css";
import Nav from "./components/Nav";
import Rulers from "./components/Rulers";
import { REPO_URL } from "./lib/constants";
import styles from "./Manifesto.module.css";
import shared from "./styles/shared.module.css";

export default function Manifesto() {
  return (
    <>
      <Rulers />
      <Nav />

      {/* Manifesto content */}
      <main className={styles.manifesto}>
        <div className={styles.manifestoInner}>
          <header className={styles.manifestoHeader}>
            <p className={shared.sectionLabel}>Manifesto</p>
            <h1 className={styles.manifestoTitle}>
              Why I built
              <br />
              <em>Pupil</em>
            </h1>
            <p className={styles.manifestoSubtitle}>
              A personal essay on memory, learning, and building software that actually fits your
              life.
            </p>
          </header>

          <div className={shared.rulerDivider} />

          <article className={styles.manifestoBody}>
            <section className={styles.manifestoSection}>
              <h2 className={styles.manifestoH2}>I have a terrible memory.</h2>
              <p>
                I mean genuinely, embarrassingly bad. Names, concepts I studied last week, things I
                read and felt certain I understood — gone. I'd revisit something I knew I had read,
                or studied before, and it would feel as though I was seeing it for the first time.
                Like my memory is the biological equivalent of a sliding window.
              </p>
              <p>
                I don't think I'm alone in this. Memory is slippery for many people. So I went
                looking for a solution.
              </p>
            </section>

            <div className={shared.rulerDivider} />

            <section className={styles.manifestoSection}>
              <h2 className={styles.manifestoH2}>The science is actually there.</h2>
              <p>
                Spaced repetition isn't a productivity hack. It's one of the most robust findings in
                cognitive psychology. Ebbinghaus mapped the forgetting curve in 1885 — memory decays
                predictably, and reviewing material at exactly the right moment before you forget it
                dramatically improves retention with far less total effort.
              </p>
              <p>
                Modern implementations like FSRS-5 — the algorithm Pupil uses — are the result of
                decades of refinement. Provably more accurate than the older SM-2 algorithm some
                flashcard tools still rely on. When you rate a card in Pupil, FSRS-5 calculates the
                precise moment your memory will need reinforcing. It shows you when you'll see it
                next before you even tap the button.
              </p>
              <p>This isn't magic. It's math.</p>
            </section>

            <div className={shared.rulerDivider} />

            <section className={styles.manifestoSection}>
              <h2 className={styles.manifestoH2}>I kept quitting anyway.</h2>
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

            <div className={shared.rulerDivider} />

            <section className={styles.manifestoSection}>
              <h2 className={styles.manifestoH2}>
                Presence alone isn't enough. Habits need a loop.
              </h2>
              <p>
                Knowing something works isn't enough to make you do it every day. We are
                dopamine-driven creatures. We need feedback, progress, small victories. The reason
                gym streaks work isn't that they make you stronger — it's that they make the habit
                feel real. You can see it. You're reluctant to break it.
              </p>
              <p>
                Anki, which I deeply respect, but find awfully sluggish, doesn't give you that. It's
                a power tool — precise, extensible, and designed for people who already have the
                discipline to show up every day. I don't always have that. I needed something that
                is deeply in-tune with me, and I'd hope, you. I needed something that nudged me.
                That showed me my streak, my retention rate, the cards due today. That made the act
                of learning feel like forward motion toward a goal, not just maintenance.
              </p>
              <blockquote className={styles.manifestoQuote}>
                Pupil has streaks, per-space stats, and reminders — not because they're clever
                features, but because without them, I personally would not have kept using it... and
                in all honesty, I'm still craving a mobile app to make this whole experience whole.
              </blockquote>
            </section>

            <div className={shared.rulerDivider} />

            <section className={styles.manifestoSection}>
              <h2 className={styles.manifestoH2}>Then AI removed the last excuse.</h2>
              <p>
                Even when I was consistent, there was one thing that always felt like work: making
                the cards in the first place. Well, making them is pretty easy these days, but
                they've all lived in many chat sessions across different providers (Claude and
                ChatGPT, mostly). I had to copy and paste, reformat, and then review. It was a
                chore. And truth be told I skipped it 70% of the time.
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
                approve. That's the entire surface area. The rest is you and the algorithm. And some
                delightfully out-of-your-way UX.
              </p>
            </section>

            <div className={shared.rulerDivider} />

            <section className={styles.manifestoSection}>
              <h2 className={styles.manifestoH2}>Open source can be genuinely delightful.</h2>
              <p>
                I wanted to build something for myself. But I also wanted to give it back. Truth be
                told, I've always looked as OSS products as the brutalist, functional tools they
                almost always are. They get the job done, they represent freedom & privacy. Yet
                almost without exception, they're ugly and clunkly. Not an ounce of empathy toward
                the end user.
              </p>
              <p>
                Pupil is open source and I've tried to make it as tasteful and considered as I know
                how. The type is set carefully. The interactions are smooth. The design is
                opionated, yet focused. Free software can be the software you're proud to have open
                on your screen. That felt worth proving.
              </p>
            </section>

            <div className={shared.rulerDivider} />

            <section className={styles.manifestoSection}>
              <h2 className={styles.manifestoH2}>It's not for everyone. That's the point.</h2>
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

            <div className={shared.rulerDivider} />

            <footer className={styles.manifestoSign}>
              <p>
                If any of this resonates —{" "}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  Pupil is open source
                </a>
                . Try it, break it, contribute to it.
              </p>
              <a
                href="https://otakomaiya.com"
                className={footerStyles.footerCredit}
                target="_blank"
                rel="noopener noreferrer"
              >
                Balazs Otakomaiya
              </a>
            </footer>
          </article>
        </div>
      </main>

      <div className={shared.rulerDivider} />

      <Footer />
    </>
  );
}
