interface NavIconProps {
  name?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <path d="M1.5 6.5L7 1.5l5.5 5v5.5a.5.5 0 01-.5.5H9V9H5v3.5H2a.5.5 0 01-.5-.5V6.5z" />
  ),
  bolt: <path d="M7.5 1.5L2 8h5l-.5 4.5L13 6H8l-.5-4.5z" />,
  lock: (
    <>
      <rect x="2" y="7" width="10" height="5.5" rx="1" />
      <path d="M4.5 7V5a2.5 2.5 0 015 0v2" />
    </>
  ),
  search: (
    <>
      <circle cx="6" cy="6" r="4.5" />
      <path d="M9.5 9.5l3 3" />
    </>
  ),
  list: (
    <>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
      <path d="M4 5h6M4 7.5h6M4 10h4" />
    </>
  ),
  folder: (
    <path d="M1.5 4a.5.5 0 01.5-.5h3l1.25 1.5H12a.5.5 0 01.5.5v6.5a.5.5 0 01-.5.5H2a.5.5 0 01-.5-.5V4z" />
  ),
  puzzle: (
    <path d="M2 4.5a.5.5 0 01.5-.5h2.25a1.25 1.25 0 112.5 0H9.5a.5.5 0 01.5.5V6.75a1.25 1.25 0 110 2.5V11.5a.5.5 0 01-.5.5H7.25a1.25 1.25 0 11-2.5 0H2.5a.5.5 0 01-.5-.5V9.25a1.25 1.25 0 100-2.5V4.5z" />
  ),
  swatch: (
    <>
      <rect x="2" y="2" width="2.5" height="10" rx=".5" />
      <rect x="5.75" y="2" width="2.5" height="10" rx=".5" />
      <rect x="9.5" y="2" width="2.5" height="10" rx=".5" />
    </>
  ),
  plug: (
    <>
      <path d="M5 1.5v3M9 1.5v3" />
      <rect x="3" y="4.5" width="8" height="4" rx="1" />
      <path d="M7 8.5v2.5M5 12.5h4" />
    </>
  ),
  layout: (
    <>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
      <path d="M1.5 5h11M5 5v7.5" />
    </>
  ),
  palette: (
    <>
      <path d="M7 1.5a5.5 5.5 0 105 8.5 1.25 1.25 0 00-1.1-1.85h-1A1.5 1.5 0 018 6.65V6C8 3 7.6 1.5 7 1.5z" />
      <circle cx="4" cy="6" r=".55" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="9" r=".55" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="4" r=".55" fill="currentColor" stroke="none" />
    </>
  ),
  book: (
    <path d="M2 2h4.5A2.5 2.5 0 019 4.5V13a2 2 0 00-2-2H2V2zM12 2H7.5A2.5 2.5 0 005 4.5V13a2 2 0 012-2h5V2z" />
  ),
  api: (
    <path d="M5.5 5.5L2 8l3.5 2.5M10.5 5.5L14 8l-3.5 2.5M9 4l-2 8" />
  ),
  cube: (
    <>
      <path d="M8 1.5L1.5 4.5v7L8 14.5l6.5-3v-7L8 1.5z" />
      <path d="M1.5 4.5L8 7.5l6.5-3M8 7.5v7" />
    </>
  ),
  flag: <path d="M3 1.5v11M3 2h7l-1 2.5L10 7H3" />,
  cog: (
    <>
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1" />
    </>
  ),
  doc: (
    <>
      <path d="M4 1.5h6l3 3V14a.5.5 0 01-.5.5h-8.5A.5.5 0 013.5 14V2a.5.5 0 01.5-.5z" />
      <path d="M10 1.5v3h3" />
    </>
  ),
};

export function NavIcon({ name }: NavIconProps) {
  const path = (name && ICONS[name]) ?? ICONS.doc;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}
