import { SVGProps } from 'react';

/**
 * StableCasino mark from the user-provided reference:
 * blue coin, segmented white ring, tilted ace-of-spades card.
 */
export function Logo({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      {...rest}
    >
      <circle cx="128" cy="128" r="128" fill="#1A56CC" />

      {/* segmented ring */}
      <path
        d="M72 54a92 92 0 0 1 44-12"
        fill="none"
        stroke="#fff"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M180 54a92 92 0 0 1 44 74"
        fill="none"
        stroke="#fff"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M40 128A92 92 0 0 1 72 202"
        fill="none"
        stroke="#fff"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M180 202a92 92 0 0 1-44 12"
        fill="none"
        stroke="#fff"
        strokeWidth="14"
        strokeLinecap="round"
      />

      {/* tilted card */}
      <g transform="translate(128 132) rotate(-8)">
        <rect
          x="-52"
          y="-68"
          width="104"
          height="136"
          rx="14"
          fill="#fff"
        />

        {/* top-left A + mini spade */}
        <text
          x="-40"
          y="-38"
          fill="#1A56CC"
          fontSize="24"
          fontWeight="700"
          fontFamily="'Space Grotesk', system-ui, sans-serif"
        >
          A
        </text>
        <path
          d="M-32 -22
             C-28 -16 -20 -12 -20 -6
             C-20 0 -25 3 -28 1
             C-31 3 -36 0 -36 -6
             C-36 -12 -28 -16 -32 -22Z"
          fill="#1A56CC"
        />
        <rect x="-30" y="-4" width="4" height="8" rx="2" fill="#1A56CC" />

        {/* center spade */}
        <path
          d="M0 -12
             C18 6 34 20 34 38
             C34 54 22 62 10 58
             C4 56 2 52 0 48
             C-2 52 -4 56 -10 58
             C-22 62 -34 54 -34 38
             C-34 20 -18 6 0 -12Z"
          fill="#1A56CC"
        />
        <path d="M-6 50h12v11h-12z" fill="#1A56CC" />
        <path d="M-12 61h24v5h-24z" fill="#1A56CC" />

        {/* bottom-right mini spade + A */}
        <g transform="translate(33 45) rotate(180)">
          <path
            d="M0 -9
               C4 -3 10 0 10 5
               C10 9 7 11 4 10
               C2 11 -2 9 -2 5
               C-2 0 4 -3 0 -9Z"
            fill="#1A56CC"
          />
          <rect x="-1" y="9" width="2" height="5" rx="1" fill="#1A56CC" />
          <text
            x="-10"
            y="24"
            fill="#1A56CC"
            fontSize="20"
            fontWeight="700"
            fontFamily="'Space Grotesk', system-ui, sans-serif"
          >
            A
          </text>
        </g>
      </g>
    </svg>
  );
}
