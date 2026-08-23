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
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.7 3.2h4.6l.5 2.15c.5.2.96.47 1.38.8l2.1-.65 2.3 4-1.62 1.5a7.2 7.2 0 0 1 0 2l1.62 1.5-2.3 4-2.1-.65c-.42.33-.88.6-1.38.8l-.5 2.15H9.7l-.5-2.15a7 7 0 0 1-1.38-.8l-2.1.65-2.3-4L5.04 13a7.2 7.2 0 0 1 0-2L3.42 9.5l2.3-4 2.1.65c.42-.33.88-.6 1.38-.8L9.7 3.2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
