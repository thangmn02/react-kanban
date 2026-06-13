import { arcanaPackLabels, arcanaSpreadLabels } from '../arcanaSystems';
import type { ArcanaLocale, ArcanaReading } from '../types';
import { normalizeVietnameseText } from '../utils/normalizeVietnameseText';
import { ArcanaActions, ArcanaButton } from './ArcanaActions';
import ArcanaCard from './ArcanaCard';

interface ReadingStepProps {
  locale: ArcanaLocale;
  reading: ArcanaReading;
  isSaved: boolean;
  hasHistory: boolean;
  onSave: () => void;
  onDrawAgain: () => void;
  onClose: () => void;
  onOpenHistory: () => void;
}

interface ReadingBlock {
  heading: string;
  body: string;
}

const viSectionLabels = [
  'Tổng quan trải bài',
  'Lá 1 - Nền năng lượng',
  'Lá 2 - Điều cần thấy rõ',
  'Lá 3 - Điều đang mở ra',
  'Mối liên kết',
  'Lời nhắn nhẹ',
];

function parseReadingSnapshot(snapshot: string): ReadingBlock[] {
  return normalizeVietnameseText(snapshot)
    .split('\n\n')
    .map((section, index) => {
      const [heading, ...body] = section.split('\n');
      return {
        heading: viSectionLabels[index] ?? normalizeVietnameseText(heading),
        body: normalizeVietnameseText(body.join('\n').trim()),
      };
    })
    .filter((section) => section.body.length > 0);
}

function ReadingStep({
  locale,
  reading,
  isSaved,
  hasHistory,
  onSave,
  onDrawAgain,
  onClose,
  onOpenHistory,
}: ReadingStepProps) {
  const blocks = parseReadingSnapshot(reading.messageSnapshot);
  const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <section className="arcana-reading-page">
      <header className="arcana-reading-hero">
        <p>Lời giải cho câu hỏi</p>
        <h3>{normalizeVietnameseText(reading.questionText)}</h3>
        <span>
          {arcanaPackLabels[locale][reading.packType]} - {new Intl.DateTimeFormat(dateLocale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(reading.createdAt))}
        </span>
      </header>

      <div className="arcana-reading-layout">
        <aside className="arcana-reading-spread" aria-label="Ba lá đã rút">
          {reading.cards.map((card) => (
            <div key={card.position}>
              <span>{arcanaSpreadLabels[locale][card.position]}</span>
              <ArcanaCard card={card} isRevealed />
            </div>
          ))}
        </aside>

        <div className="arcana-reading-sections">
          {blocks.map((block, index) => (
            <article key={`${block.heading}-${index}`} className="arcana-reading-section">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h4>{block.heading}</h4>
                <p>{block.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {isSaved && (
        <p className="arcana-saved-note" role="status">
          Đã lưu lượt rút này vào lịch sử.
        </p>
      )}

      <ArcanaActions>
        <ArcanaButton onClick={onSave} disabled={isSaved}>
          {isSaved ? 'Đã lưu' : 'Lưu lượt rút'}
        </ArcanaButton>
        <ArcanaButton onClick={onDrawAgain} variant="secondary">
          Rút lại
        </ArcanaButton>
        <ArcanaButton onClick={onClose} variant="quiet">
          Đóng
        </ArcanaButton>
      </ArcanaActions>

      {hasHistory && (
        <button type="button" onClick={onOpenHistory} className="arcana-history-link">
          Xem lịch sử rút bài
        </button>
      )}
    </section>
  );
}

export default ReadingStep;
