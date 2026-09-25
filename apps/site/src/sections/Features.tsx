import { type CSSProperties, useState } from "react";
import Lightbox from "../components/Lightbox";
import { FEATURE_GROUPS } from "../data/features";
import { DETAIL_SHOTS } from "../data/screenshots";
import { ArrowUpRightIcon } from "../icons";
import shared from "../styles/shared.module.css";
import styles from "./Features.module.css";

export default function Features() {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  return (
    <section className={shared.section} id="features">
      <div className={shared.sectionHead}>
        <h2 className={shared.sectionTitle}>Spaced repetition, without the friction</h2>
        <p className={shared.sectionDesc}>
          All the rigor of the algorithm. None of the setup. Powered by AI so you can go from topic
          to drill in seconds.
        </p>
      </div>

      <div className={styles.groups}>
        {FEATURE_GROUPS.map((group) => (
          <div className={styles.group} key={group.name}>
            <h3 className={styles.groupName}>{group.name}</h3>
            <ul className={styles.rows}>
              {group.features.map((f) => (
                <li className={styles.row} key={f.title}>
                  <p className={styles.title}>{f.title}</p>
                  <p className={styles.desc}>{f.desc}</p>
                  <span className={styles.spec}>{f.spec}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.details}>
        {DETAIL_SHOTS.map((shot) => (
          <figure className={styles.detail} key={shot.title}>
            <button
              type="button"
              className={styles.crop}
              onClick={() => setLightbox({ src: shot.src, alt: shot.alt })}
              aria-label={`Enlarge screenshot: ${shot.alt}`}
              style={
                {
                  "--fx": shot.focus[0],
                  "--fy": shot.focus[1],
                  "--z": shot.zoom,
                } as CSSProperties
              }
            >
              <img
                src={shot.src}
                alt=""
                width={1392}
                height={1012}
                loading="lazy"
                decoding="async"
              />
              <span className={styles.enlarge} aria-hidden="true">
                <ArrowUpRightIcon />
              </span>
            </button>
            <figcaption>
              <span className={styles.detailTitle}>{shot.title}</span>
              <span className={styles.detailCaption}>{shot.caption}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      {lightbox && (
        <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </section>
  );
}
