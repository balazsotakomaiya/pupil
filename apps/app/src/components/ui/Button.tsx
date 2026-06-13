import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: ButtonVariant;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  danger: "study-btn danger-btn",
  ghost: "btn-ghost",
  primary: "study-btn",
  secondary: "study-btn-secondary",
};

export function Button({
  children,
  className,
  disabled,
  isLoading,
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");

  return (
    <button className={classes} disabled={disabled ?? isLoading} {...props}>
      {children}
    </button>
  );
}
