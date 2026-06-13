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

const readingText: Record<ArcanaLocale, {
  eyebrow: string;
  spreadLabel: string;
  saved: string;
  savedButton: string;
  saveButton: string;
  drawAgain: string;
  close: string;
  history: string;
  sectionLabels: string[];
}> = {
  en: {
    eyebrow: 'Reading for your question',
    spreadLabel: 'Three drawn cards',
    saved: 'This reading has been saved to history.',
    savedButton: 'Saved',
    saveButton: 'Save reading',
    drawAgain: 'Draw again',
    close: 'Close',
    history: 'View reading history',
    sectionLabels: [
      'Spread overview',
      'Card 1 - Foundation',
      'Card 2 - What to see clearly',
      'Card 3 - What is opening',
      'The thread between them',
      'A gentle note',
    ],
  },
  vi: {
    eyebrow: 'Lời giải cho câu hỏi',
    spreadLabel: 'Ba lá đã rút',
    saved: 'Đã lưu lượt rút này vào lịch sử.',
    savedButton: 'Đã lưu',
    saveButton: 'Lưu lượt rút',
    drawAgain: 'Rút lại',
    close: 'Đóng',
    history: 'Xem lịch sử rút bài',
    sectionLabels: [
      'Tổng quan trải bài',
      'Lá 1 - Nền năng lượng',
      'Lá 2 - Điều cần thấy rõ',
      'Lá 3 - Điều đang mở ra',
      'Mối liên kết',
      'Lời nhắn nhẹ',
    ],
  },
};

function parseReadingSnapshot(snapshot: string, locale: ArcanaLocale): ReadingBlock[] {
  const labels = readingText[locale].sectionLabels;

  return normalizeVietnameseText(snapshot)
    .split('\n\n')
    .map((section, index) => {
      const [heading, ...body] = section.split('\n');
      return {
        heading: labels[index] ?? normalizeVietnameseText(heading),
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
  const copy = readingText[locale];
  const blocks = parseReadingSnapshot(reading.messageSnapshot, locale);
  const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <section className="arcana-reading-page">
      <header className="arcana-reading-hero">
        <p>{copy.eyebrow}</p>
        <h3>{normalizeVietnameseText(reading.questionText)}</h3>
        <span>
          {arcanaPackLabels[locale][reading.packType]} - {new Intl.DateTimeFormat(dateLocale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(reading.createdAt))}
        </span>
      </header>

      <div className="arcana-reading-layout">
        <aside className="arcana-reading-spread" aria-label={copy.spreadLabel}>
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
          {copy.saved}
        </p>
      )}

      <ArcanaActions>
        <ArcanaButton onClick={onSave} disabled={isSaved}>
          {isSaved ? copy.savedButton : copy.saveButton}
        </ArcanaButton>
        <ArcanaButton onClick={onDrawAgain} variant="secondary">
          {copy.drawAgain}
        </ArcanaButton>
        <ArcanaButton onClick={onClose} variant="quiet">
          {copy.close}
        </ArcanaButton>
      </ArcanaActions>

      {hasHistory && (
        <button type="button" onClick={onOpenHistory} className="arcana-history-link">
          {copy.history}
        </button>
      )}
    </section>
  );
}

export default ReadingStep;
