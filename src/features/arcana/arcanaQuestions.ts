import type { ArcanaLocale, ArcanaQuestion, ArcanaTopic } from './types';

export const arcanaTopicOrder: ArcanaTopic[] = ['work', 'love', 'study', 'finance', 'self', 'life'];

export const arcanaTopicLabels: Record<ArcanaLocale, Record<ArcanaTopic, string>> = {
  en: {
    work: 'Work',
    love: 'Love',
    study: 'Study',
    finance: 'Finance',
    self: 'Self',
    life: 'Life',
  },
  vi: {
    work: 'Công việc',
    love: 'Tình cảm',
    study: 'Học tập',
    finance: 'Tài chính',
    self: 'Bản thân',
    life: 'Đời sống',
  },
};

export const arcanaTopicIcons: Record<ArcanaTopic, string> = {
  work: '💼',
  love: '💗',
  study: '📚',
  finance: '🪙',
  self: '🌙',
  life: '🍃',
};

export const arcanaQuestions: ArcanaQuestion[] = [
  // Work
  { id: 'work-energy', topic: 'work', text: { en: 'What energy surrounds my work right now?', vi: 'Nguồn năng lượng nào đang bao quanh công việc của tôi?' } },
  { id: 'work-focus', topic: 'work', text: { en: 'Where should I focus my effort right now?', vi: 'Lúc này tôi nên dồn sức vào đâu?' } },
  { id: 'work-block', topic: 'work', text: { en: 'What is holding me back at work?', vi: 'Điều gì đang cản bước tôi trong công việc?' } },
  { id: 'work-opportunity', topic: 'work', text: { en: 'What opportunity should I pay attention to?', vi: 'Cơ hội nào đang đến mà tôi nên để tâm?' } },
  { id: 'work-relation', topic: 'work', text: { en: 'What should I understand about my work relationships?', vi: 'Tôi nên hiểu gì về các mối quan hệ nơi làm việc?' } },
  { id: 'work-next', topic: 'work', text: { en: 'What is a wise next step for me?', vi: 'Đâu là bước đi khôn ngoan tiếp theo của tôi?' } },

  // Love
  { id: 'love-notice', topic: 'love', text: { en: 'What should I notice in my love life?', vi: 'Tôi nên để ý điều gì trong chuyện tình cảm?' } },
  { id: 'love-connection', topic: 'love', text: { en: 'What energy does this connection carry?', vi: 'Mối duyên này đang mang năng lượng gì?' } },
  { id: 'love-feelings', topic: 'love', text: { en: 'What should I understand about my feelings?', vi: 'Tôi nên hiểu thêm điều gì về cảm xúc của mình?' } },
  { id: 'love-needs', topic: 'love', text: { en: 'What do I truly need in a relationship?', vi: 'Tôi thực sự cần gì trong một mối quan hệ?' } },
  { id: 'love-letgo', topic: 'love', text: { en: 'Am I holding on to something I should release?', vi: 'Tôi có đang níu giữ điều gì đáng lẽ nên buông?' } },
  { id: 'love-future', topic: 'love', text: { en: 'Which way should I point my heart?', vi: 'Tôi nên hướng trái tim mình về phía nào?' } },

  // Study
  { id: 'study-block', topic: 'study', text: { en: 'What is getting in the way of my studies?', vi: 'Điều gì đang cản trở việc học của tôi?' } },
  { id: 'study-focus', topic: 'study', text: { en: 'Where should I put my learning energy?', vi: 'Tôi nên đặt năng lượng học tập vào đâu?' } },
  { id: 'study-strength', topic: 'study', text: { en: 'What strength can I lean on to grow?', vi: 'Tôi có thể dựa vào thế mạnh nào để tiến bộ?' } },
  { id: 'study-habit', topic: 'study', text: { en: 'Which habit is helping or hurting my studies?', vi: 'Thói quen nào đang giúp hoặc hại việc học của tôi?' } },
  { id: 'study-motivation', topic: 'study', text: { en: 'How do I find my motivation again?', vi: 'Làm sao tôi tìm lại động lực học tập?' } },

  // Finance
  { id: 'finance-energy', topic: 'finance', text: { en: 'What energy surrounds my finances?', vi: 'Nguồn năng lượng nào đang bao quanh tài chính của tôi?' } },
  { id: 'finance-habit', topic: 'finance', text: { en: 'Which money habit should I revisit?', vi: 'Tôi nên nhìn lại thói quen tiền bạc nào?' } },
  { id: 'finance-caution', topic: 'finance', text: { en: 'What should I be cautious about with money?', vi: 'Tôi nên thận trọng điều gì về tiền bạc?' } },
  { id: 'finance-opportunity', topic: 'finance', text: { en: 'What financial opportunity is worth opening to?', vi: 'Cơ hội tài chính nào đáng để tôi mở lòng?' } },
  { id: 'finance-balance', topic: 'finance', text: { en: 'How do I balance giving and keeping?', vi: 'Làm sao tôi cân bằng giữa cho đi và giữ lại?' } },

  // Self
  { id: 'self-now', topic: 'self', text: { en: 'What should I understand about myself right now?', vi: 'Lúc này tôi nên hiểu thêm điều gì về bản thân?' } },
  { id: 'self-message', topic: 'self', text: { en: 'What message do I need to hear today?', vi: 'Hôm nay tôi cần nghe thông điệp nào?' } },
  { id: 'self-attention', topic: 'self', text: { en: 'What part of me is asking for attention?', vi: 'Phần nào trong tôi đang cần được quan tâm?' } },
  { id: 'self-strength', topic: 'self', text: { en: 'What inner strength can I rely on?', vi: 'Tôi có thể dựa vào sức mạnh nội tâm nào?' } },
  { id: 'self-release', topic: 'self', text: { en: 'What should I let go of to feel lighter?', vi: 'Tôi nên buông điều gì để lòng nhẹ hơn?' } },
  { id: 'self-growth', topic: 'self', text: { en: 'In what direction am I being invited to grow?', vi: 'Tôi đang được mời gọi trưởng thành theo hướng nào?' } },

  // Life
  { id: 'life-week', topic: 'life', text: { en: 'What energy will shape the time ahead?', vi: 'Năng lượng nào sẽ định hình quãng thời gian sắp tới?' } },
  { id: 'life-attention', topic: 'life', text: { en: 'What should I pay attention to day to day?', vi: 'Tôi nên để tâm điều gì trong đời sống hằng ngày?' } },
  { id: 'life-luck', topic: 'life', text: { en: 'Where might luck show up for me?', vi: 'May mắn có thể xuất hiện ở đâu với tôi?' } },
  { id: 'life-balance', topic: 'life', text: { en: 'What should I adjust to live more in balance?', vi: 'Tôi nên điều chỉnh gì để sống cân bằng hơn?' } },
  { id: 'life-people', topic: 'life', text: { en: 'Where might support in life come from?', vi: 'Sự nâng đỡ trong cuộc sống có thể đến từ đâu?' } },
];

export function getArcanaQuestionsByTopic(topic: ArcanaTopic) {
  return arcanaQuestions.filter((question) => question.topic === topic);
}

export function getArcanaQuestionById(questionId: string) {
  return arcanaQuestions.find((question) => question.id === questionId);
}
