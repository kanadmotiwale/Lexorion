/**
 * Single source of truth for the Lexorion "L" logo mark.
 * Used in sidebar, hero, chat avatars, auth pages, and favicon.
 * Geometric SVG paths — no font rendering differences across sizes.
 */
export default function LogoIcon({ size = 34, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={style}
    >
      <rect width="32" height="32" rx="8" fill="#111827" />
      {/* Vertical stroke of the L */}
      <rect x="8" y="6" width="5" height="20" rx="1" fill="white" />
      {/* Horizontal base of the L */}
      <rect x="8" y="22" width="16" height="4" rx="1" fill="white" />
    </svg>
  );
}
