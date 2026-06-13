import type { ArcanaLocale, ArcanaQuestion, ArcanaTopic } from '../types';
import { arcanaTopicLabels } from '../arcanaQuestions';
import { normalizeVietnameseText } from '../utils/normalizeVietnameseText';
import ArcanaStepHeader from './ArcanaStepHeader';

interface QuestionStepProps {
  locale: ArcanaLocale;
  topic: ArcanaTopic;
  questions: ArcanaQuestion[];
  selectedQuestionId: string | null;
  onSelect: (questionId: string) => void;
}

const questionHeader: Record<ArcanaLocale, { title: string; description: string }> = {
  en: {
    title: 'Choose the question that keeps the draw in rhythm',
    description: 'This question is saved with the reading and guides the full interpretation.',
  },
  vi: {
    title: 'Chọn câu hỏi giữ nhịp cho lượt rút',
    description: 'Câu hỏi này sẽ được giữ lại trong bản ghi và dẫn toàn bộ lời giải.',
  },
};

function QuestionStep({
  locale,
  topic,
  questions,
  selectedQuestionId,
  onSelect,
}: QuestionStepProps) {
  const header = questionHeader[locale];

  return (
    <section>
      <ArcanaStepHeader
        eyebrow={`II - ${arcanaTopicLabels[locale][topic]}`}
        title={header.title}
        description={header.description}
      />

      <div className="arcana-question-list">
        {questions.map((question, index) => {
          const active = selectedQuestionId === question.id;
          return (
            <button
              key={question.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(question.id)}
              className={`arcana-question-row ${active ? 'is-selected' : ''}`}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{normalizeVietnameseText(question.text[locale])}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default QuestionStep;
