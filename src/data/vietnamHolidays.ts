import type { HolidayRow } from '../types/supabase.type';

export interface VietnamHoliday {
  id: string;
  name: string;
  date: string;
  icon: string;
  vibe: string;
}

export const VIETNAM_HOLIDAYS_2026: VietnamHoliday[] = [
  {
    id: 'vn-2026-01-01',
    name: 'Tết Dương lịch',
    date: '2026-01-01',
    icon: '🎉',
    vibe: 'Start fresh',
  },
  {
    id: 'vn-2026-02-17',
    name: 'Tết Nguyên Đán',
    date: '2026-02-17',
    icon: '🧧',
    vibe: 'Family time',
  },
  {
    id: 'vn-2026-04-26',
    name: 'Giỗ Tổ Hùng Vương',
    date: '2026-04-26',
    icon: '🌿',
    vibe: 'Slow Sunday',
  },
  {
    id: 'vn-2026-04-30',
    name: 'Ngày Giải phóng miền Nam',
    date: '2026-04-30',
    icon: '🌴',
    vibe: 'Long weekend',
  },
  {
    id: 'vn-2026-05-01',
    name: 'Quốc tế Lao động',
    date: '2026-05-01',
    icon: '🏖️',
    vibe: 'Recharge mode',
  },
  {
    id: 'vn-2026-09-02',
    name: 'Quốc khánh Việt Nam',
    date: '2026-09-02',
    icon: '⭐',
    vibe: 'Mini break',
  },
];

export function mapVietnamHolidayToRow(holiday: VietnamHoliday): HolidayRow {
  return {
    id: holiday.id,
    name: holiday.name,
    date: holiday.date,
    country_code: 'VN',
    created_at: new Date().toISOString(),
  };
}
