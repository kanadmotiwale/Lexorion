/**
 * Single source of truth for the Lexorion "L" logo mark.
 * Used in sidebar, hero, chat avatars, auth pages, and favicon.
 * Geometric SVG paths — no font rendering differences across sizes.
 *
 * Props:
 *   size     – pixel size (default 34)
 *   inverted – true = white box + dark L (for dark backgrounds like the sidebar)
 *              false/omitted = dark box + white L (for light backgrounds)
 *   style    – extra styles forwarded to the <svg>
 */
export default function LogoIcon({ size = 34, inverted = false, style }) {
  const bg = inverted ? "#ffffff" : "#111827";
  const fg = inverted ? "#111827" : "#ffffff";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={style}
    >
      <rect width="32" height="32" rx="8" fill={bg} />
      {/* Vertical stroke — 5 px wide, 7 px margin on all sides */}
      <rect x="7" y="7" width="5" height="18" rx="1.5" fill={fg} />
      {/* Horizontal base — same 5 px height, meets vertical at corner */}
      <rect x="7" y="20" width="18" height="5" rx="1.5" fill={fg} />
    </svg>
  );
}
