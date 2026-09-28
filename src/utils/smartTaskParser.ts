import { addDays, format, getDay, startOfDay } from 'date-fns';

export interface SmartTaskParseResult {
  title: string;
  dueDate?: string;
  matched: boolean;
}

function upcomingWeekday(today: Date, weekday: number) {
  const offset = (weekday - getDay(today) + 7) % 7 || 7;
  return addDays(today, offset);
}

export function parseSmartTaskInput(input: string, now = new Date()): SmartTaskParseResult {
  let title = input;
  let due: Date | null = null;
  const today = startOfDay(now);
  const consume = (pattern: RegExp, resolve: (match: RegExpMatchArray) => Date) => {
    if (due) return;
    const match = title.match(pattern);
    if (!match) return;
    due = resolve(match);
    title = title.replace(match[0], ' ');
  };

  consume(/\bnext\s+week\b/iu, () => addDays(today, 7));
  consume(/\btuần\s+sau\b/iu, () => addDays(today, 7));
  consume(/\bin\s+(\d+)\s+days?\b/iu, (match) => addDays(today, Number(match[1])));
  consume(/\b(\d+)\s+ngày\s+nữa\b/iu, (match) => addDays(today, Number(match[1])));
  consume(/\btomorrow\b/iu, () => addDays(today, 1));
  consume(/\bngày\s+mai\b/iu, () => addDays(today, 1));
  consume(/\btoday\b/iu, () => today);
  consume(/\bhôm\s+nay\b/iu, () => today);

  const englishWeekdays: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  consume(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/iu, (match) => upcomingWeekday(today, englishWeekdays[match[1].toLowerCase()]));
  consume(/\bthứ\s*([2-7])\b/iu, (match) => upcomingWeekday(today, Number(match[1]) - 1));
  consume(/\bchủ\s*nhật\b/iu, () => upcomingWeekday(today, 0));

  const timePattern = /\b(?:(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:am|pm)|(?:[01]?\d|2[0-3])h(?:[0-5]\d)?)\b/iu;
  const timeMatch = title.match(timePattern);
  if (timeMatch) {
    title = title.replace(timeMatch[0], ' ');
    due ||= today;
  }

  title = title.replace(/\s+([,.;:!?])/g, '$1').replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, '').replace(/\s{2,}/g, ' ').trim();
  return { title, dueDate: due ? format(due, 'yyyy-MM-dd') : undefined, matched: Boolean(due) };
}
