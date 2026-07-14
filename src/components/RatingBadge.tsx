import type { ReactNode } from 'react';
import { getRatingColor, getRatingBgColor, type PaceRating } from '../lib/racepace';

interface RatingBadgeProps {
  rating: PaceRating | 'Hotlap';
  size?: 'sm' | 'md';
  className?: string;
  /** Custom label; defaults to the rating name */
  children?: ReactNode;
}

/** Pace-tier pill badge (Alien/Competitive/.../Hotlap) */
export function RatingBadge({ rating, size = 'md', className = '', children }: RatingBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex ${sizeClass} rounded font-semibold uppercase tracking-wider border ${getRatingColor(rating)} ${getRatingBgColor(rating)} ${className}`}>
      {children ?? rating}
    </span>
  );
}
