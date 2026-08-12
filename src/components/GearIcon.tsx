/**
 * A plain 2D gear icon, drawn as a simple stroke path. Deliberately not
 * the ⚙ text character — on iOS in particular that renders as a colorful
 * emoji-style glyph, which reads as "cartoon" and can't be recolored to
 * match the theme. This renders identically everywhere and inherits
 * currentColor, so it follows the same active/inactive styling as the
 * rest of the header.
 */
export default function GearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.66 6.34l-1.7 1.7M8.04 15.96l-1.7 1.7M17.66 17.66l-1.7-1.7M8.04 8.04l-1.7-1.7" />
    </svg>
  );
}
