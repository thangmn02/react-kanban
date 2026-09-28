import { describe, expect, it } from 'vitest';
import { parseSmartTaskInput } from './smartTaskParser';

const now = new Date(2026, 8, 28, 10); // Monday
const cases: Array<[string, string, string]> = [
  ['Call client today', 'Call client', '2026-09-28'], ['Call client tomorrow', 'Call client', '2026-09-29'],
  ['Plan launch next week', 'Plan launch', '2026-10-05'], ['Send note in 3 days', 'Send note', '2026-10-01'],
  ['Review Monday', 'Review', '2026-10-05'], ['Review Tuesday', 'Review', '2026-09-29'],
  ['Review Wednesday', 'Review', '2026-09-30'], ['Review Thursday', 'Review', '2026-10-01'],
  ['Review Friday 3pm', 'Review', '2026-10-02'], ['Review Saturday', 'Review', '2026-10-03'],
  ['Review Sunday', 'Review', '2026-10-04'], ['Call client 3pm', 'Call client', '2026-09-28'],
  ['Nộp báo cáo hôm nay', 'Nộp báo cáo', '2026-09-28'], ['Nộp báo cáo ngày mai', 'Nộp báo cáo', '2026-09-29'],
  ['Chuẩn bị demo tuần sau', 'Chuẩn bị demo', '2026-10-05'], ['Gửi hồ sơ 3 ngày nữa', 'Gửi hồ sơ', '2026-10-01'],
  ['Họp thứ 2', 'Họp', '2026-10-05'], ['Họp thứ 3', 'Họp', '2026-09-29'],
  ['Họp thứ 6 15h', 'Họp', '2026-10-02'], ['Họp thứ 7', 'Họp', '2026-10-03'],
  ['Nghỉ chủ nhật', 'Nghỉ', '2026-10-04'], ['Gọi khách 15h30', 'Gọi khách', '2026-09-28'],
];

describe('parseSmartTaskInput', () => {
  it.each(cases)('%s', (input, title, dueDate) => expect(parseSmartTaskInput(input, now)).toMatchObject({ title, dueDate, matched: true }));
  it('leaves ordinary titles alone', () => expect(parseSmartTaskInput('Write the proposal', now)).toEqual({ title: 'Write the proposal', dueDate: undefined, matched: false }));
});
