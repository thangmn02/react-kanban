import { getArcanaPackSprite } from './arcanaAtlas';
import { arcanaPackAtlasIndex, arcanaPackLabels, arcanaPackOrder } from './arcanaSystems';
import type { ArcanaPackType } from './types';
import { useI18n } from '../../i18n';

interface ArcanaPackPickerProps {
  selectedPack: ArcanaPackType;
  onSelect: (pack: ArcanaPackType) => void;
}

function ArcanaPackPicker({ selectedPack, onSelect }: ArcanaPackPickerProps) {
  const { language } = useI18n();

  return (
    <div className="grid grid-cols-3 gap-4">
      {arcanaPackOrder.map((pack) => {
        const isActive = selectedPack === pack;
        return (
          <button
            key={pack}
            type="button"
            onClick={() => onSelect(pack)}
            aria-pressed={isActive}
            className="group flex cursor-pointer flex-col items-center gap-3 focus:outline-none"
          >
            <span
              className={`relative grid place-items-center rounded-2xl border p-3 transition-all duration-300 ${
                isActive
                  ? 'border-[#d6b87a]/70 bg-[#d6b87a]/[0.08] shadow-[0_18px_50px_rgba(214,184,122,0.25)]'
                  : 'border-white/10 bg-white/[0.02] group-hover:border-[#d6b87a]/40 group-focus-visible:border-[#d6b87a]/60'
              }`}
            >
              <span
                className={`arcana-art h-28 w-[5rem] rounded-lg border transition-transform duration-300 sm:h-32 sm:w-[5.75rem] ${
                  isActive ? 'border-[#d6b87a]/50 -translate-y-1 scale-105' : 'border-white/10 group-hover:-translate-y-0.5'
                }`}
                style={getArcanaPackSprite(arcanaPackAtlasIndex[pack])}
                aria-hidden="true"
              />
            </span>
            <span
              className={`arcana-display text-[11px] font-semibold tracking-[0.06em] ${
                isActive ? 'text-[#f3e7cc]' : 'text-[#e8dcc4]/70'
              }`}
            >
              {arcanaPackLabels[language][pack]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ArcanaPackPicker;
