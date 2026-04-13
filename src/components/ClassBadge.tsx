import type { CarClass } from '../lib/types';

const CLASS_STYLES: Record<CarClass, string> = {
  Hyper: 'bg-hyper/15 text-hyper border-hyper/30',
  GT3: 'bg-gt3/15 text-gt3 border-gt3/30',
  GTE: 'bg-gte/15 text-gte border-gte/30',
  'LMP2-WEC': 'bg-lmp2wec/15 text-lmp2wec border-lmp2wec/30',
  'LMP2-ELMS': 'bg-lmp2elms/15 text-lmp2elms border-lmp2elms/30',
  LMP3: 'bg-lmp3/15 text-lmp3 border-lmp3/30',
  Unknown: 'bg-racing-muted/15 text-racing-muted border-racing-muted/30',
};

export function ClassBadge({ carClass }: { carClass: CarClass }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono
      tracking-wider border ${CLASS_STYLES[carClass]}`}>
      {carClass.toUpperCase()}
    </span>
  );
}
