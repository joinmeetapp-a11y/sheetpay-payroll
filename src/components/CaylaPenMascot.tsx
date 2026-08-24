import React from 'react';

export interface CaylaPenMascotProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  showStatusDot?: boolean;
  isProcessing?: boolean;
  expression?: 'happy' | 'sparkle' | 'winking' | 'smart';
}

export const CaylaPenMascot: React.FC<CaylaPenMascotProps> = ({
  size = 'md',
  className = '',
  showStatusDot = false,
  isProcessing = false,
  expression = 'happy',
}) => {
  // Resolve pixel dimensions
  let pxSize = 36;
  if (typeof size === 'number') {
    pxSize = size;
  } else {
    switch (size) {
      case 'xs':
        pxSize = 20;
        break;
      case 'sm':
        pxSize = 28;
        break;
      case 'md':
        pxSize = 36;
        break;
      case 'lg':
        pxSize = 48;
        break;
      case 'xl':
        pxSize = 64;
        break;
      case '2xl':
        pxSize = 80;
        break;
    }
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: pxSize, height: pxSize }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full drop-shadow-md transition-transform duration-300 ${
          isProcessing ? 'animate-bounce' : 'hover:scale-110'
        }`}
        style={{
          filter: isProcessing ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))' : undefined,
        }}
      >
        <defs>
          {/* Pearlescent White Pen Body */}
          <linearGradient id="caylaPenWhite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F8FAFC" />
            <stop offset="75%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          {/* Brand Emerald Green Highlights */}
          <linearGradient id="caylaPenEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="30%" stopColor="#10B981" />
            <stop offset="75%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          {/* Brand Emerald Dark for Shading */}
          <linearGradient id="caylaPenEmeraldGrip" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="40%" stopColor="#10B981" />
            <stop offset="80%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          {/* Polished Gold Trim & Clip Highlights */}
          <linearGradient id="caylaPenGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="25%" stopColor="#FDE047" />
            <stop offset="55%" stopColor="#F59E0B" />
            <stop offset="85%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          {/* Nib Steel & Gold Fountain Gradient */}
          <linearGradient id="caylaPenNib" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF9C3" />
            <stop offset="30%" stopColor="#FDE047" />
            <stop offset="65%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Magic Ink Glow */}
          <radialGradient id="magicInkDrop" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </radialGradient>
        </defs>

        {/* Outer Circular Glow Backing */}
        <circle cx="50" cy="50" r="46" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="2" />

        {/* Ambient Magic Sparkles floating around the pen */}
        <g className="animate-pulse">
          {/* Gold Sparkle Top Left */}
          <path
            d="M20 22L21.5 17L23 22L28 23.5L23 25L21.5 30L20 25L15 23.5L20 22Z"
            fill="#F59E0B"
            opacity="0.95"
          />
          {/* Brand Green Sparkle Top Right */}
          <path
            d="M78 28L79.2 24L80.4 28L84.4 29.2L80.4 30.4L79.2 34.4L78 30.4L74 29.2L78 28Z"
            fill="#10B981"
            opacity="0.9"
          />
          {/* Gold Sparkle Bottom Right */}
          <path
            d="M74 76L75 73L76 76L79 77L76 78L75 81L74 78L71 77L74 76Z"
            fill="#F59E0B"
            opacity="0.9"
          />
        </g>

        {/* Mascot Character Group: Pen tilted playfully at ~15 degrees */}
        <g transform="rotate(-15 50 50) translate(0, 0)">
          {/* 1. Top Pen Cap Finial (Crown) - Gold with Brand Green Gem */}
          <path
            d="M38 20 C38 14, 62 14, 62 20 L62 25 L38 25 Z"
            fill="url(#caylaPenGold)"
            stroke="#92400E"
            strokeWidth="1"
          />
          {/* Brand Green Inlaid Jewel on Cap Crown */}
          <circle cx="50" cy="18" r="3.2" fill="url(#caylaPenEmerald)" stroke="#064E3B" strokeWidth="0.8" />
          <circle cx="49" cy="17" r="0.9" fill="#FFFFFF" opacity="0.9" />

          {/* 2. Pen Barrel Body (Main White Pen Torso) */}
          <rect
            x="36"
            y="25"
            width="28"
            height="42"
            rx="6"
            fill="url(#caylaPenWhite)"
            stroke="#94A3B8"
            strokeWidth="1.4"
          />

          {/* Brand Green & Gold Accent Stripes on Upper Barrel */}
          <rect x="36.5" y="27" width="27" height="3" fill="url(#caylaPenEmerald)" />
          <rect x="36.5" y="30.5" width="27" height="1.5" fill="url(#caylaPenGold)" />

          {/* Glossy White Sheen / Highlight on Barrel */}
          <path
            d="M39 34 C39 34, 40.5 47, 40.5 63"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* 3. Golden Pocket Clip (Acts as Playful Waving Ear/Arm) */}
          <path
            d="M62 27 C68 28, 70 38, 67 48 C66 52, 63 53, 62 53"
            stroke="url(#caylaPenGold)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Gold & Emerald Clip Ball Tip */}
          <circle cx="67" cy="49" r="2.8" fill="url(#caylaPenGold)" stroke="#92400E" strokeWidth="0.8" />
          <circle cx="67" cy="49" r="1.3" fill="url(#caylaPenEmerald)" />

          {/* 4. Dual Gold & Brand Green Middle Collar / Ring */}
          <rect
            x="35"
            y="65"
            width="30"
            height="5"
            rx="1.5"
            fill="url(#caylaPenGold)"
            stroke="#92400E"
            strokeWidth="1"
          />
          {/* Green Inlay Center Stripe in Collar */}
          <line x1="36" y1="67.5" x2="64" y2="67.5" stroke="#047857" strokeWidth="1.2" />

          {/* 5. Brand Green Ergonomic Grip Section */}
          <path
            d="M38 70 L62 70 L58 78 L42 78 Z"
            fill="url(#caylaPenEmeraldGrip)"
            stroke="#047857"
            strokeWidth="1"
          />
          {/* Gold Grip Rings */}
          <line x1="40" y1="73" x2="60" y2="73" stroke="#FDE047" strokeWidth="0.8" strokeOpacity="0.7" />
          <line x1="41" y1="76" x2="59" y2="76" stroke="#FDE047" strokeWidth="0.8" strokeOpacity="0.7" />

          {/* 6. Gold Fountain Pen Nib */}
          <path
            d="M42 78 L58 78 L53 92 C51 94, 49 94, 47 92 Z"
            fill="url(#caylaPenNib)"
            stroke="#92400E"
            strokeWidth="1.2"
          />
          {/* Nib Slit & Breather Hole */}
          <line x1="50" y1="80" x2="50" y2="88" stroke="#78350F" strokeWidth="1" />
          <circle cx="50" cy="83" r="1.3" fill="#78350F" />

          {/* Brand Green Nib Engraving Heart / Chevron */}
          <path
            d="M47 81 Q 50 84, 53 81"
            stroke="#059669"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />

          {/* 7. Magic Sparkling Brand Green Ink Drop at Nib Tip */}
          <circle cx="50" cy="94" r="2.5" fill="url(#magicInkDrop)" />
          <circle cx="49" cy="93" r="0.9" fill="#FFFFFF" opacity="0.95" />

          {/* --- CAYLA'S EXPRESSIVE FACE ON THE WHITE PEN --- */}
          {/* Cute Rosy Cheeks */}
          <ellipse cx="41" cy="49" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.55" />
          <ellipse cx="59" cy="49" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.55" />

          {/* Left Eye */}
          <g>
            <circle cx="43" cy="43" r="4.2" fill="#0F172A" />
            <circle cx="44.2" cy="41.6" r="1.8" fill="#FFFFFF" />
            <circle cx="42" cy="44.2" r="1" fill="#10B981" />
          </g>

          {/* Right Eye (winking or open) */}
          {expression === 'winking' ? (
            <path
              d="M55 44 Q 58 41, 61 44"
              stroke="#0F172A"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <g>
              <circle cx="57" cy="43" r="4.2" fill="#0F172A" />
              <circle cx="58.2" cy="41.6" r="1.8" fill="#FFFFFF" />
              <circle cx="56" cy="44.2" r="1" fill="#10B981" />
            </g>
          )}

          {/* Cute Friendly Smile */}
          <path
            d="M47 49 Q 50 53, 53 49"
            stroke="#0F172A"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Eyelashes / Brows for charm */}
          <path d="M40 38 Q 43 36, 46 38" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />
          <path d="M54 38 Q 57 36, 60 38" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />
        </g>
      </svg>

      {/* Online Status Dot */}
      {showStatusDot && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white shadow-xs animate-pulse" />
      )}
    </div>
  );
};

