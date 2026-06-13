import type { ButtonHTMLAttributes } from "react";

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "danger";
}

export function MenuItem({ className, variant, ...props }: MenuItemProps) {
  const classes = ["more-menu-item", variant === "danger" ? "danger" : undefined, className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} role="menuitem" type="button" {...props} />;
}
