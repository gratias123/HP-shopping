import type { SVGProps } from 'react';

export type IconName =
  | 'search'
  | 'bag'
  | 'heart'
  | 'user'
  | 'close'
  | 'menu'
  | 'arrow-right'
  | 'arrow-left'
  | 'check'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'upload'
  | 'chevron-down'
  | 'chevron-right'
  | 'lock'
  | 'truck'
  | 'return'
  | 'shield'
  | 'filter'
  | 'pin'
  | 'refresh'
  | 'history'
  | 'bell';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const PATHS: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.3-7-9.3A4 4 0 0 1 12 7.6 4 4 0 0 1 19 10.7c0 5-7 9.3-7 9.3Z" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.7-3.5 3.4-5.5 7-5.5s6.3 2 7 5.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h11" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M20 12H4" />
      <path d="m10 18-6-6 6-6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="1.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </>
  ),
  return: (
    <>
      <path d="M4 10h11a5 5 0 0 1 0 10h-3" />
      <path d="m8 6-4 4 4 4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v6c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14 4.5L20 15" />
      <path d="M20 20v-5h-5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6L4 9" />
      <path d="M4 4v5h5" />
      <path d="M12 8v4l3 2" />
    </>
  ),
};

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
