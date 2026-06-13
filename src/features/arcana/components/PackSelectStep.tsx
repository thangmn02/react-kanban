import { getArcanaPackSprite } from '../arcanaAtlas';
import { arcanaPackAtlasIndex } from '../arcanaSystems';
import type { ArcanaLocale, ArcanaPackType } from '../types';
import { ArcanaActions, ArcanaButton } from './ArcanaActions';
import ArcanaStepHeader from './ArcanaStepHeader';

interface PackSelectStepProps {
  locale: ArcanaLocale;
  selectedPack: ArcanaPackType;
  onSelect: (pack: ArcanaPackType) => void;
  onOpenPack: () => void;
}

interface PackOption {
  type: ArcanaPackType;
  name: Record<ArcanaLocale, string>;
  mood: Record<ArcanaLocale, string>;
  rarityHint: Record<ArcanaLocale, string>;
}

const packOptions: PackOption[] = [
  {
    type: 'arcana',
    name: { vi: 'Gói Ánh Trăng', en: 'Moonlit Pack' },
    mood: { vi: 'Dịu, trực giác, dễ lắng nghe.', en: 'Soft, intuitive, easy to listen into.' },
    rarityHint: { vi: 'Cân bằng', en: 'Balanced' },
  },
  {
    type: 'celestial',
    name: { vi: 'Gói Sao Rơi', en: 'Falling Star Pack' },
    mood: { vi: 'Lấp lánh, mở ra tín hiệu bất ngờ.', en: 'Bright, opening unexpected signals.' },
    rarityHint: { vi: 'Hiếm tăng nhẹ', en: 'Rare tilt' },
  },
  {
    type: 'spectral',
    name: { vi: 'Gói Hư Không', en: 'Void Pack' },
    mood: { vi: 'Sâu, lặng, hợp những câu hỏi khó gọi tên.', en: 'Deep, quiet, suited to unnamed questions.' },
    rarityHint: { vi: 'Foil đậm hơn', en: 'Stronger foils' },
  },
  {
    type: 'jumbo',
    name: { vi: 'Gói Nhật Thực', en: 'Eclipse Pack' },
    mood: { vi: 'Tương phản mạnh, ánh sáng đi qua bóng tối.', en: 'High contrast, light through shadow.' },
    rarityHint: { vi: 'Sử thi+', en: 'Epic+' },
  },
  {
    type: 'mega',
    name: { vi: 'Gói Vương Miện Đêm', en: 'Night Crown Pack' },
    mood: { vi: 'Nặng tay, sang, dành cho lượt rút có lực.', en: 'Weighty, ornate, for a stronger draw.' },
    rarityHint: { vi: 'Huyền thoại+', en: 'Legendary+' },
  },
];

function PackSelectStep({
  locale,
  selectedPack,
  onSelect,
  onOpenPack,
}: PackSelectStepProps) {
  return (
    <section>
      <ArcanaStepHeader
        eyebrow="III - Chọn gói bài"
        title="Chọn vật chứa cho ba lá"
        description="Mỗi gói chỉ đổi cảm giác mở, độ hiếm và hiệu ứng ánh. Lời giải vẫn đến từ câu hỏi và ba lá rút được."
      />

      <div className="arcana-pack-grid">
        {packOptions.map((pack) => {
          const active = selectedPack === pack.type;
          return (
            <button
              key={pack.type}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(pack.type)}
              className={`arcana-pack-choice ${active ? 'is-selected' : ''}`}
            >
              <span
                className="arcana-art arcana-pack-choice-art"
                style={getArcanaPackSprite(arcanaPackAtlasIndex[pack.type])}
                aria-hidden="true"
              />
              <span className="arcana-pack-copy">
                <strong>{pack.name[locale]}</strong>
                <em>{pack.mood[locale]}</em>
                <b>{pack.rarityHint[locale]}</b>
              </span>
            </button>
          );
        })}
      </div>

      <ArcanaActions>
        <ArcanaButton onClick={onOpenPack}>Đưa gói lên bàn</ArcanaButton>
      </ArcanaActions>
    </section>
  );
}

export default PackSelectStep;
