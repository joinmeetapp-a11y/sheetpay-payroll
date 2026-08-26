import React from 'react';
import { Star } from 'lucide-react';

/**
 * Caribbean-faces + 5-star review badge used above the homepage H1 and on
 * the /try-accountant-dashboard hero. Kept as its own component so future
 * copy or asset changes update in one place.
 */
export const ReviewRatingBadge: React.FC<{ align?: 'center' | 'left' }> = ({
  align = 'center',
}) => {
  const faces = [
    {
      src: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=120&auto=format&fit=crop&q=80',
      alt: 'Caribbean business owner Derek',
    },
    {
      src: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
      alt: 'Caribbean HR director Camille',
    },
    {
      src: 'https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=120&auto=format&fit=crop&q=80',
      alt: 'Caribbean founder Andre',
    },
    {
      src: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=120&auto=format&fit=crop&q=80',
      alt: 'Caribbean finance lead Priya',
    },
    {
      src: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
      alt: 'Caribbean manager Jean-Marc',
    },
  ];

  return (
    <div
      className={`inline-flex items-center ${
        align === 'center' ? 'justify-center' : 'justify-start'
      } gap-2.5 sm:gap-3 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-white/95 border border-slate-200/90 shadow-sm hover:shadow-md transition-all`}
    >
      <div className="flex items-center -space-x-2 shrink-0">
        {faces.map((face) => (
          <img
            key={face.src}
            src={face.src}
            alt={face.alt}
            referrerPolicy="no-referrer"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-white shadow-xs"
          />
        ))}
      </div>
      <div className="flex items-center gap-0.5 shrink-0" aria-label="5 out of 5 stars">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400"
          />
        ))}
      </div>
      <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:inline-block" />
      <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
        Businesses Love Cayla ❤️
      </span>
    </div>
  );
};
