import type { SpaceCardData } from "./types";

type SpaceCardProps = {
  space: SpaceCardData;
};

export function SpaceCard({ space }: SpaceCardProps) {
  return (
    <article className="space-card">
      <div className="space-top">
        <span className="space-name">{space.name}</span>
        {space.streakLabel ? (
          <span className="space-streak">
            <span className="streak-dot" />
            {space.streakLabel}
          </span>
        ) : (
          <span className="space-streak" />
        )}
      </div>
      <div className="space-desc">{space.description}</div>
      <div className="space-meta">
        {space.meta.map((item) => (
          <div className="space-meta-item" key={`${space.id}-${item.label}`}>
            {item.variant === "aux" ? (
              <span className="space-source">{item.value}</span>
            ) : item.variant === "due" ? (
              <span className="space-meta-val">
                <span className="due-indicator">
                  <span className="due-dot" />
                  {item.value}
                </span>
              </span>
            ) : (
              <span className="space-meta-val">{item.value}</span>
            )}
            <span className="space-meta-label">{item.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
