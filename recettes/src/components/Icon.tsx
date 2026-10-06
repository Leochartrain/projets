/** Icônes au trait (24 × 24), dessinées une fois ici plutôt qu'une bibliothèque entière. */
const PATHS = {
  home: 'M4 11l8-7 8 7v9H4z',
  users: 'M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15 14.5c2.8 0 5 1.8 5 4.5M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  play: 'M8 5v14l11-7z',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  scan: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 9h8M8 12h8M8 15h5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  share: 'M12 4v11M7 9l5-5 5 5M5 14v6h14v-6',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  user: 'M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, filled = false, className }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
