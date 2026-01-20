import type { SVGProps } from 'react';

export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 250 40"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="StreamVerse"
    role="img"
    {...props}
  >
    <text
      x="0"
      y="30"
      fontFamily="Inter, sans-serif"
      fontSize="32"
      fontWeight="900"
      letterSpacing="-1.5"
      fill="hsl(var(--primary))"
    >
      STREAMVERSE
    </text>
  </svg>
);
