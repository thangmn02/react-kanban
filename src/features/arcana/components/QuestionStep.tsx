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

function QuestionStep({
  locale,
  topic,
  questions,
  selectedQuestionId,
  onSelect,
}: QuestionStepProps) {
  return (
    <section>
      <ArcanaStepHeader
        eyebrow={`II - ${arcanaTopicLabels[locale][topic]}`}
        title="Chọn câu hỏi giữ nhịp cho lượt rút"
        description="Câu hỏi này sẽ được giữ lại trong bản ghi và dẫn toàn bộ lời giải."
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
