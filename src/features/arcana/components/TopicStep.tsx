import { arcanaTopicLabels, arcanaTopicOrder } from '../arcanaQuestions';
import type { ArcanaLocale, ArcanaTopic } from '../types';
import { normalizeVietnameseText } from '../utils/normalizeVietnameseText';
import ArcanaStepHeader from './ArcanaStepHeader';

interface TopicStepProps {
  locale: ArcanaLocale;
  selectedTopic: ArcanaTopic | null;
  onSelect: (topic: ArcanaTopic) => void;
}

const topicHeader: Record<ArcanaLocale, { eyebrow: string; title: string; description: string }> = {
  en: {
    eyebrow: 'I - Choose a topic',
    title: 'Place your hand on the right symbol',
    description: 'Each topic opens a different lens for the same three cards.',
  },
  vi: {
    eyebrow: 'I - Chọn chủ đề',
    title: 'Đặt tay lên biểu tượng phù hợp',
    description: 'Mỗi chủ đề mở một lăng kính riêng cho cùng ba lá bài.',
  },
};

const topicDescriptions: Record<ArcanaLocale, Record<ArcanaTopic, string>> = {
  vi: {
    love: 'Nhịp tim, kết nối và điều chưa gọi thành lời.',
    work: 'Không khí quanh công việc và những chuyển động bên dưới.',
    study: 'Điều đang nâng đỡ hoặc làm mờ việc học.',
    finance: 'Cảm giác an toàn, cho - nhận và thói quen tiền bạc.',
    self: 'Lớp sâu bên trong, nơi bạn đang tự đối thoại.',
    life: 'Những dấu hiệu nhỏ trong quãng thời gian sắp tới.',
  },
  en: {
    love: 'Heart rhythm, connection, and what is not yet named.',
    work: 'The atmosphere around work and the movement underneath.',
    study: 'What supports or clouds your studies.',
    finance: 'Security, exchange, and money habits.',
    self: 'The inner layer where you are speaking with yourself.',
    life: 'Small signs shaping the near future.',
  },
};

function TopicStep({ locale, selectedTopic, onSelect }: TopicStepProps) {
  const header = topicHeader[locale];

  return (
    <section>
      <ArcanaStepHeader
        eyebrow={header.eyebrow}
        title={header.title}
        description={header.description}
      />

      <div className="arcana-token-grid">
        {arcanaTopicOrder.map((topic) => {
          const active = selectedTopic === topic;
          return (
            <button
              key={topic}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(topic)}
              className={`arcana-topic-token ${active ? 'is-selected' : ''}`}
            >
              <span className="arcana-topic-orb" aria-hidden="true" />
              <strong>{normalizeVietnameseText(arcanaTopicLabels[locale][topic])}</strong>
              <em>{normalizeVietnameseText(topicDescriptions[locale][topic])}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default TopicStep;
