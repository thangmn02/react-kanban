import { getArcanaPackSprite } from '../arcanaAtlas';
import { arcanaPackAtlasIndex } from '../arcanaSystems';
import type { ArcanaLocale, ArcanaPackType } from '../types';
import { useI18n } from '../../../i18n';
import { ArcanaActions, ArcanaButton } from './ArcanaActions';
import ArcanaStepHeader from './ArcanaStepHeader';

interface EntryStepProps {
  packType: ArcanaPackType;
  onBegin: () => void;
}

const entryText: Record<ArcanaLocale, { title: string; description: string; begin: string }> = {
  en: {
    title: 'Step into Arcana Booth',
    description: 'Choose a question, open a pack, and let three cards reveal themselves in their own rhythm.',
    begin: 'Begin the draw',
  },
  vi: {
    title: 'Bước vào Góc Arcana',
    description: 'Chọn một câu hỏi, mở một gói bài và để ba lá hiện ra theo nhịp riêng của chúng.',
    begin: 'Bắt đầu lượt rút',
  },
};

function EntryStep({ packType, onBegin }: EntryStepProps) {
  const { language, t } = useI18n();
  const copy = entryText[language];

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
        title={copy.title}
        description={copy.description}
      />

      <ArcanaActions>
        <ArcanaButton onClick={onBegin}>{copy.begin}</ArcanaButton>
      </ArcanaActions>
    </section>
  );
}

export default EntryStep;
