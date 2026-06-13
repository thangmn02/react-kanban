import { getArcanaPackSprite } from '../arcanaAtlas';
import { arcanaPackAtlasIndex } from '../arcanaSystems';
import type { ArcanaPackType } from '../types';
import { useI18n } from '../../../i18n';
import { ArcanaActions, ArcanaButton } from './ArcanaActions';
import ArcanaStepHeader from './ArcanaStepHeader';

interface EntryStepProps {
  packType: ArcanaPackType;
  onBegin: () => void;
}

function EntryStep({ packType, onBegin }: EntryStepProps) {
  const { t } = useI18n();

  return (
    <section className="arcana-entry-step">
      <div className="arcana-entry-pack" aria-hidden="true">
        <span className="arcana-entry-ring" />
        <span
          className="arcana-art arcana-entry-pack-art"
          style={getArcanaPackSprite(arcanaPackAtlasIndex[packType])}
        />
      </div>

      <ArcanaStepHeader
        eyebrow={t('arcana.disclaimer')}
        title="Bước vào Góc Arcana"
        description="Chọn một câu hỏi, mở một gói bài và để ba lá hiện ra theo nhịp riêng của chúng."
      />

      <ArcanaActions>
        <ArcanaButton onClick={onBegin}>Bắt đầu lượt rút</ArcanaButton>
      </ArcanaActions>
    </section>
  );
}

export default EntryStep;
