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
      <text
        x="16" y="23"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="20"
        fontWeight="700"
        fill={fg}
      >L</text>
    </svg>
  );
}
