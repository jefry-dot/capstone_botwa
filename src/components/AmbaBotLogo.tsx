interface AmbaBotLogoProps {
  className?: string;
}

export default function AmbaBotLogo({
  className = "h-10 w-10",
}: AmbaBotLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="AmbaBot Studio Logo"
      className={className}
    >
      {/* Hard Neo-Print Drop Shadow */}
      <path
        d="M13 13H55C57.209 13 59 14.791 59 17V45L45 59H13C10.791 59 9 57.209 9 55V17C9 14.791 10.791 13 13 13Z"
        fill="#161614"
      />
      {/* Antenna Stem & Red Spark Tip */}
      <line
        x1="31"
        y1="10"
        x2="31"
        y2="5.5"
        stroke="#161614"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="31"
        cy="4.5"
        r="3"
        fill="#EB3B2E"
        stroke="#161614"
        strokeWidth="2"
      />
      {/* Main Die-Cut Sticker Body (Acid Lime) */}
      <path
        d="M10 10H52C54.209 10 56 11.791 56 14V42L42 56H10C7.791 56 6 54.209 6 52V14C6 11.791 7.791 10 10 10Z"
        fill="#B9F32B"
        stroke="#161614"
        strokeWidth="2.75"
        strokeLinejoin="round"
      />
      {/* Bot Visor Screen */}
      <rect x="12.5" y="17.5" width="37" height="19.5" rx="5.5" fill="#161614" />
      {/* Left Eye: Bright Lime Pill */}
      <rect x="19" y="22.8" width="5.6" height="8.8" rx="2.8" fill="#B9F32B" />
      {/* Right Eye: Gemini AI 4-Point Sparkle */}
      <path
        d="M39.5 21.2L41.1 25.6L45.5 27.2L41.1 28.8L39.5 33.2L37.9 28.8L33.5 27.2L37.9 25.6L39.5 21.2Z"
        fill="#FFD646"
      />
      {/* Playful Bot Smile */}
      <path
        d="M21 43.2C23.6 46.8 29.8 47.4 33.8 44.2"
        stroke="#161614"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Sticker Peel Corner Fold */}
      <path
        d="M42 56V46C42 43.791 43.791 42 46 42H56L42 56Z"
        fill="#FFD646"
        stroke="#161614"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
