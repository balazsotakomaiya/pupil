export function NotificationSuccessIcon() {
  return (
    <svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 8l2 2 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function NotificationErrorIcon() {
  return (
    <svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function NotificationInfoIcon() {
  return (
    <svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <circle cx="8" cy="4.75" fill="currentColor" r="0.875" />
    </svg>
  );
}

export function NotificationDismissIcon() {
  return (
    <svg fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}
