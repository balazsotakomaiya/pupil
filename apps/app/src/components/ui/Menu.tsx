import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface MenuProps {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  menuClassName?: string;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
}

export function Menu({
  children,
  className,
  isOpen,
  menuClassName,
  onOpenChange,
  trigger,
}: MenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  const wrapClass = ["more-menu-wrap", className].filter(Boolean).join(" ");
  const innerClass = ["more-menu", menuClassName].filter(Boolean).join(" ");

  return (
    <div className={wrapClass} ref={wrapRef}>
      {trigger}
      {isOpen && (
        <div className={innerClass} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
