import { type ButtonHTMLAttributes, forwardRef } from "react";
import styles from "./Button.module.css";

type ButtonSize = "compact" | "default" | "icon" | "iconCompact";
type ButtonVariant = "bare" | "destructive" | "ghost" | "outline" | "primary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, size = "default", type = "button", variant = "primary", ...props },
  ref,
) {
  const classNames = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(" ");

  return <button {...props} className={classNames} ref={ref} type={type} />;
});

Button.displayName = "Button";
