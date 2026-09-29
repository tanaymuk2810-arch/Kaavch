export default function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sl-shield" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B5878" />
          <stop offset="0.55" stopColor="#1B4965" />
          <stop offset="1" stopColor="#0B2545" />
        </linearGradient>
        <linearGradient id="sl-bolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9A566" />
          <stop offset="0.5" stopColor="#C97B5A" />
          <stop offset="1" stopColor="#7F4F38" />
        </linearGradient>
        <linearGradient id="sl-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7A97B5" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#D3DEEB" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7A97B5" stopOpacity="0.9" />
        </linearGradient>
        <filter id="sl-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#04101E" floodOpacity="0.5" />
        </filter>
      </defs>
      <g filter="url(#sl-shadow)">
        <path
          d="M32 4.5 55.5 13v18.2c0 10.6-8 18.4-23.5 23.3C16.5 49.6 8.5 41.8 8.5 31.2V13Z"
          fill="url(#sl-shield)"
          stroke="#04101E"
          strokeWidth="1.6"
        />
        <path
          d="M32 9.5 51 16v15.4c0 8.6-6.4 15-19 19-12.6-4-19-10.4-19-19V16Z"
          fill="none"
          stroke="url(#sl-steel)"
          strokeWidth="1.4"
          opacity="0.7"
        />
        <ellipse cx="32" cy="15.5" rx="12.5" ry="5.5" fill="#FFFFFF" opacity="0.3" />
        <path
          d="M35.5 17 23 37h7.5L28 50l14.5-19.5h-8Z"
          fill="url(#sl-bolt)"
          stroke="#5F2510"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="53.5" r="1.6" fill="#D9A566" opacity="0.95" />
      </g>
    </svg>
  );
}