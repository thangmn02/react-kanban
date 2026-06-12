import { arcanaTopicIcons, arcanaTopicLabels, arcanaTopicOrder } from './arcanaQuestions';
import type { ArcanaTopic } from './types';
import { useI18n } from '../../i18n';

interface ArcanaTopicPickerProps {
  selectedTopic: ArcanaTopic | null;
  onSelect: (topic: ArcanaTopic) => void;
}

function ArcanaTopicPicker({ selectedTopic, onSelect }: ArcanaTopicPickerProps) {
  const { language } = useI18n();

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
      {arcanaTopicOrder.map((topic) => {
        const isActive = selectedTopic === topic;
        return (
          <button
            key={topic}
            type="button"
            onClick={() => onSelect(topic)}
            aria-pressed={isActive}
            className={`group relative flex flex-col items-center gap-3 rounded-2xl border px-4 py-6 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#d6b87a]/25 ${
              isActive
                ? 'border-[#d6b87a]/70 bg-[#d6b87a]/[0.08] shadow-[0_0_30px_rgba(214,184,122,0.18)]'
                : 'border-white/10 bg-white/[0.02] hover:border-[#d6b87a]/40 hover:bg-white/[0.04]'
            }`}
          >
            <span
              className={`grid h-14 w-14 place-items-center rounded-full border text-2xl transition ${
                isActive ? 'border-[#d6b87a]/60 bg-[#d6b87a]/10' : 'border-white/15 group-hover:border-[#d6b87a]/40'
              }`}
              aria-hidden="true"
            >
              {arcanaTopicIcons[topic]}
            </span>
            <span className="arcana-display text-sm font-semibold tracking-[0.08em] text-[#f3e7cc]">
              {arcanaTopicLabels[language][topic]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ArcanaTopicPicker;
