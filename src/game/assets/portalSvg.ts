export const portalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2" />
        <feMergeNode in="blur1" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="glow-teal" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="#00ffff" fill-opacity="0.15" />
      <rect y="2" width="4" height="2" fill="#001122" fill-opacity="0.6" />
    </pattern>
  </defs>
  <g id="outer-ring">
    <path d="M 82 16 L 174 16 M 240 82 L 240 174 M 174 240 L 82 240 M 16 174 L 16 82" fill="none" stroke="#00ffff" stroke-width="3" filter="url(#glow-teal)" />
    <path d="M 74 16 L 16 74 M 240 74 L 182 16 M 240 182 L 182 240 M 16 182 L 74 240" fill="none" stroke="#0088aa" stroke-width="5" />
    <rect x="78" y="14" width="6" height="6" fill="#00ffff" />
    <rect x="172" y="14" width="6" height="6" fill="#00ffff" />
    <rect x="236" y="78" width="6" height="6" fill="#00ffff" />
    <rect x="236" y="172" width="6" height="6" fill="#00ffff" />
    <rect x="172" y="236" width="6" height="6" fill="#00ffff" />
    <rect x="78" y="236" width="6" height="6" fill="#00ffff" />
    <rect x="14" y="172" width="6" height="6" fill="#00ffff" />
    <rect x="14" y="78" width="6" height="6" fill="#00ffff" />
  </g>
  <g id="inner-geometry">
    <path d="M 90 38 L 166 38 L 218 90 L 218 166 L 166 218 L 90 218 L 38 166 L 38 90 Z M 104 68 L 68 104 L 68 152 L 104 188 L 152 188 L 188 152 L 188 104 L 152 68 Z" fill="url(#scanlines)" fill-rule="evenodd" />
    <polygon points="90,38 166,38 218,90 218,166 166,218 90,218 38,166 38,90" fill="none" stroke="#0088aa" stroke-width="2" />
    <polygon points="104,68 152,68 188,104 188,152 152,188 104,188 68,152 68,104" fill="#000a14" stroke="#00ffff" stroke-width="3" filter="url(#glow-cyan)" />
  </g>
  <g id="circuit-traces" fill="none" stroke="#00ffff" stroke-width="2" opacity="0.8">
    <path d="M 128 16 L 128 38 M 16 128 L 38 128 M 240 128 L 218 128 M 128 240 L 128 218" />
    <path d="M 128 68 L 128 50 L 144 50" />
    <path d="M 188 128 L 206 128 L 206 144" />
    <path d="M 128 188 L 128 206 L 112 206" />
    <path d="M 68 128 L 50 128 L 50 112" />
    <circle cx="144" cy="50" r="2" fill="#00ffff" />
    <circle cx="206" cy="144" r="2" fill="#00ffff" />
    <circle cx="112" cy="206" r="2" fill="#00ffff" />
    <circle cx="50" cy="112" r="2" fill="#00ffff" />
  </g>
  <g id="tick-marks" stroke="#0088aa" stroke-width="2">
    <line x1="104" y1="68" x2="110" y2="74" />
    <line x1="152" y1="68" x2="146" y2="74" />
    <line x1="188" y1="104" x2="182" y2="110" />
    <line x1="188" y1="152" x2="182" y2="146" />
    <line x1="152" y1="188" x2="146" y2="182" />
    <line x1="104" y1="188" x2="110" y2="182" />
    <line x1="68" y1="152" x2="74" y2="146" />
    <line x1="68" y1="104" x2="74" y2="110" />
  </g>
  <g id="portal-core">
    <polygon points="128,76 140,128 128,180 116,128" fill="#00ffff" opacity="0.85" filter="url(#glow-cyan)" />
    <polygon points="76,128 128,116 180,128 128,140" fill="#00ffff" opacity="0.85" filter="url(#glow-cyan)" />
    <rect x="120" y="120" width="16" height="16" fill="#ffffff" transform="rotate(45 128 128)" filter="url(#glow-cyan)" />
    <rect x="124" y="124" width="8" height="8" fill="#000a14" transform="rotate(45 128 128)" />
  </g>
  <g id="terminal-text" font-family="monospace" font-size="10" fill="#00ffff" text-anchor="middle" letter-spacing="2" opacity="0.9">
    <text x="128" y="30">PRTL-01</text>
    <text x="128" y="234">SYS.ON</text>
    <text x="-128" y="30" transform="rotate(-90)">SEC:A9</text>
    <text x="128" y="-226" transform="rotate(90)">LINK:OK</text>
  </g>
</svg>`;

export function getPortalSvgDataUrl(): string {
  const encoded = encodeURIComponent(portalSvg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
