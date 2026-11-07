/**
 * Mascota original de YuiApi: una chibi de cabello rosa con dos coletas y un moño lavanda.
 * Dibujada en SVG propio (no copia ningún personaje existente).
 */
export function Mascot({ size = 160, className = "", title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id="yh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f9a8d4" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="yb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ddd6fe" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {/* coletas */}
      <ellipse cx="34" cy="112" rx="22" ry="46" fill="url(#yh)" transform="rotate(14 34 112)" />
      <ellipse cx="166" cy="112" rx="22" ry="46" fill="url(#yh)" transform="rotate(-14 166 112)" />
      {/* cara */}
      <circle cx="100" cy="106" r="64" fill="#fff1e6" />
      {/* cabello superior y flequillo */}
      <path d="M36 100 C34 46 70 22 100 22 C130 22 166 46 164 100 C150 78 128 66 100 66 C72 66 50 78 36 100 Z" fill="url(#yh)" />
      <path d="M72 70 C82 86 92 90 100 70 C108 90 120 86 130 70 C120 62 108 60 100 60 C92 60 82 62 72 70 Z" fill="#f472b6" />
      {/* moño */}
      <path d="M100 34 L76 18 C70 30 72 44 84 46 Z" fill="url(#yb)" />
      <path d="M100 34 L124 18 C130 30 128 44 116 46 Z" fill="url(#yb)" />
      <circle cx="100" cy="35" r="8" fill="#c4b5fd" />
      {/* ojos */}
      <ellipse cx="76" cy="112" rx="11" ry="15" fill="#3b1d4a" />
      <ellipse cx="124" cy="112" rx="11" ry="15" fill="#3b1d4a" />
      <ellipse cx="76" cy="115" rx="8" ry="10" fill="#8b5cf6" />
      <ellipse cx="124" cy="115" rx="8" ry="10" fill="#8b5cf6" />
      <circle cx="72" cy="106" r="4.5" fill="#fff" />
      <circle cx="120" cy="106" r="4.5" fill="#fff" />
      <circle cx="80" cy="120" r="2" fill="#fff" />
      <circle cx="128" cy="120" r="2" fill="#fff" />
      {/* mejillas y boca */}
      <ellipse cx="58" cy="136" rx="10" ry="6" fill="#fb7185" opacity=".35" />
      <ellipse cx="142" cy="136" rx="10" ry="6" fill="#fb7185" opacity=".35" />
      <path d="M90 142 Q100 152 110 142" fill="none" stroke="#9d174d" strokeWidth="3.5" strokeLinecap="round" />
      {/* pétalo de sakura */}
      <path d="M150 52 q6 -10 12 0 q-2 8 -6 10 q-4 -2 -6 -10 Z" fill="#fbcfe8" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      Yui<span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">Api</span>
    </span>
  );
}
