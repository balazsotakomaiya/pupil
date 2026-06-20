import type { ReactNode } from "react";

interface EmptyStateProps {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: ReactNode;
  title?: ReactNode;
}

export function EmptyState({ action, className, description, icon, title }: EmptyStateProps) {
  const classes = ["empty-state", className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {icon}
      {title ? <h3>{title}</h3> : null}
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
