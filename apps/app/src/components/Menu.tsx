import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import styles from "./Menu.module.css";

type MenuTriggerProps = {
  "aria-controls": string | undefined;
  "aria-expanded": boolean;
  "aria-haspopup": "menu";
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  ref: Ref<HTMLButtonElement>;
};

type MenuProps = {
  /** Which trigger edge the panel lines up with. */
  align?: "end" | "start";
  children: ReactNode;
  className?: string;
  label: string;
  panelClassName?: string;
  trigger: (props: MenuTriggerProps, state: { isOpen: boolean }) => ReactNode;
};

const MenuContext = createContext<{ close: () => void } | null>(null);

function menuItems(panel: HTMLElement | null) {
  return Array.from(
    panel?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
  );
}

/**
 * Dropdown menu anchored to a trigger. Owns the behaviour every menu needs:
 * outside-click and Escape dismissal, arrow-key/Home/End movement, and focus
 * returning to the trigger when it closes.
 */
export function Menu({
  align = "end",
  children,
  className,
  label,
  panelClassName,
  trigger,
}: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusOnOpen, setFocusOnOpen] = useState<"first" | "last">("first");
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const items = menuItems(panelRef.current);
    (focusOnOpen === "last" ? items.at(-1) : items[0])?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        close(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [close, focusOnOpen, isOpen]);

  function open(focus: "first" | "last") {
    setFocusOnOpen(focus);
    setIsOpen(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open(event.key === "ArrowUp" ? "last" : "first");
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems(panelRef.current);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;

    switch (event.key) {
      case "ArrowDown":
        next = items[(index + 1) % items.length];
        break;
      case "ArrowUp":
        next = items[(index - 1 + items.length) % items.length];
        break;
      case "Home":
        next = items[0];
        break;
      case "End":
        next = items.at(-1);
        break;
      case "Escape":
        event.preventDefault();
        // Keep the Escape from also reaching screen-level shortcuts.
        event.stopPropagation();
        close();
        return;
      case "Tab":
        close(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    next?.focus();
  }

  return (
    <div className={[styles.menu, className].filter(Boolean).join(" ")} ref={wrapRef}>
      {trigger(
        {
          "aria-controls": isOpen ? menuId : undefined,
          "aria-expanded": isOpen,
          "aria-haspopup": "menu",
          onClick: () => (isOpen ? close() : open("first")),
          onKeyDown: handleTriggerKeyDown,
          ref: triggerRef,
        },
        { isOpen },
      )}
      {isOpen ? (
        <MenuContext.Provider value={{ close }}>
          <div
            aria-label={label}
            className={[styles.panel, styles[align], panelClassName].filter(Boolean).join(" ")}
            id={menuId}
            onKeyDown={handlePanelKeyDown}
            ref={panelRef}
            role="menu"
          >
            {children}
          </div>
        </MenuContext.Provider>
      ) : null}
    </div>
  );
}

type MenuItemProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "danger" | "default";
};

export function MenuItem({
  children,
  className,
  disabled = false,
  icon,
  onSelect,
  tone = "default",
}: MenuItemProps) {
  const menu = useContext(MenuContext);

  return (
    <button
      className={[styles.item, tone === "danger" ? styles.danger : null, className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={() => {
        menu?.close();
        onSelect();
      }}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}
