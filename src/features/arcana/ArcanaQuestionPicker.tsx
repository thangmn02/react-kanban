import type { ArcanaQuestion } from './types';
import { useI18n } from '../../i18n';

interface ArcanaQuestionPickerProps {
  questions: ArcanaQuestion[];
  selectedQuestionId: string | null;
  onSelect: (questionId: string) => void;
}

function ArcanaQuestionPicker({ questions, selectedQuestionId, onSelect }: ArcanaQuestionPickerProps) {
  const { language } = useI18n();

  return (
    <ul className="grid gap-2.5">
      {questions.map((question) => {
        const isActive = selectedQuestionId === question.id;
        return (
          <li key={question.id}>
            <button
              type="button"
              onClick={() => onSelect(question.id)}
              aria-pressed={isActive}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/25 ${
                isActive
                  ? 'border-[#d6b87a]/60 bg-[#d6b87a]/[0.08]'
                  : 'border-white/10 bg-white/[0.02] hover:border-[#d6b87a]/35 hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`h-2 w-2 flex-none rotate-45 ${isActive ? 'bg-[#d6b87a] shadow-[0_0_8px_rgba(214,184,122,0.8)]' : 'bg-white/25'}`}
                aria-hidden="true"
              />
              <span className="arcana-serif text-[1.05rem] leading-snug text-[#efe6d2]">{question.text[language]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default ArcanaQuestionPicker;
