# Giải thích chi tiết các thay đổi Refactoring

> Tài liệu này giải thích **từng file đã chỉnh sửa** trong đợt refactoring codebase React Kanban:
> code cũ trông thế nào, code mới ra sao, **tại sao** đổi như vậy, ảnh hưởng tới **logic** và **hiệu năng**.
> Viết theo kiểu "anh giải thích cho em" — đọc từ trên xuống là hiểu được mạch tư duy.
>
> Nguyên tắc xuyên suốt: **đây là refactoring thuần — không đổi hành vi**. Mọi thứ người dùng thấy/chạm vào,
> mọi payload gửi lên Supabase, mọi key localStorage, mọi đường route... đều phải **giống hệt** trước.
> Cách kiểm chứng: `npm run build` + `npm run lint` + đọc lại (review) so với code gốc. Dự án **không có test framework**.

---

## Mục lục

1. [Tư duy nền tảng trước khi đọc](#1-tư-duy-nền-tảng)
2. [Tạo tầng hằng số `src/constants/`](#2-tầng-hằng-số)
3. [Wiring hằng số vào services / mapper / hooks / components](#3-wiring-hằng-số)
4. [Tách utilities & đổi tên (low-risk)](#4-utilities--đổi-tên)
5. [Gom logic ở service & mapper](#5-gom-logic-service--mapper)
6. [Gom state trong TaskDialog](#6-taskdialog)
7. [**Task 7.4 — chỗ anh loay hoay lâu nhất**](#7-task-74)
8. [Gom props KanbanBoard](#8-kanbanboard)
9. [Bổ App.tsx thành các custom hook](#9-app-tsx)
10. [Bài học rút ra](#10-bài-học)

---

## 1. Tư duy nền tảng

Trước khi đi vào từng file, em cần nắm 3 ý:

**a) "Single source of truth" (một nguồn sự thật duy nhất).**
Khi cùng một giá trị (`'HVAC Editor'`, số `1000`, `'kanban_focus_tasks'`...) bị viết lặp ở 5 nơi, thì sửa 1 chỗ quên 4 chỗ là chuyện sớm muộn. Gom về một file hằng số nghĩa là: muốn đổi thì đổi 1 chỗ, cả app đổi theo.

**b) "Single Responsibility" (một việc một chỗ).**
`App.tsx` ban đầu 1721 dòng làm đủ thứ: auth, routing, fetch board, CRUD task, focus, pomodoro, dialog... Khi một function/component ôm quá nhiều việc, em không thể test, đọc, hay sửa nó mà không sợ vỡ chỗ khác. Tách ra thành hook = mỗi hook lo một chuyện.

**c) "Behavior-preserving" (giữ nguyên hành vi).**
Refactor khác rewrite. Refactor là đổi *hình dạng* code mà *kết quả chạy* không đổi. Nên với mỗi thay đổi, câu hỏi luôn là: "output cho cùng input có y hệt không?". Nếu có rủi ro lệch, phải chứng minh là không lệch.

---

## 2. Tầng hằng số

### File mới: `src/constants/` (board.ts, task.ts, focus.ts, pomodoro.ts, commandPalette.ts, messages.ts, index.ts)

**Vấn đề cũ:** các giá trị "ma thuật" (magic values) nằm rải rác. Ví dụ chuỗi `'HVAC Editor'` xuất hiện ở `board.service.ts`, `home.service.ts`, `today.service.ts`; số `1000` nằm inline trong builder vị trí list; mảng `['High','Medium','Low','Lowest']` lặp ở 3 file.

**Cách làm mới:** tạo thư mục `src/constants/` chia theo domain, export qua một barrel `index.ts` để import gọn:

```ts
// src/constants/task.ts
export const TASK_PRIORITIES = ['High', 'Medium', 'Low', 'Lowest'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number]; // 'High' | 'Medium' | 'Low' | 'Lowest'
export const DEFAULT_TASK_PRIORITY: TaskPriority = 'Low';
export const DEFAULT_TASK_CATEGORIES = { CATEGORY_1: 'Design', CATEGORY_2: 'Sprint' } as const;
```

**Tại sao dùng `as const`?**
Bình thường TypeScript suy ra `['High','Medium',...]` là `string[]`. Thêm `as const` biến nó thành **tuple chỉ-đọc** với literal cụ thể, nhờ đó dòng `type TaskPriority = (typeof TASK_PRIORITIES)[number]` cho ra union `'High' | 'Medium' | 'Low' | 'Lowest'` — tức là em vừa có *mảng để map ra UI*, vừa có *kiểu union để check ở compile-time*. Một viên đạn trúng hai đích.

**Lưu ý nhỏ về `commandPalette.ts`:** anh dùng `as const satisfies Record<string, CommandPaletteActionConfig>`.
`satisfies` kiểm tra object có đúng "khuôn" `CommandPaletteActionConfig` không, **nhưng vẫn giữ literal type** (không bị nới rộng thành `string`). Đây là điểm khác biệt giữa `satisfies` và `: Type` — cái sau sẽ làm mất literal.

**Logic/Hiệu năng:** tầng hằng số là các giá trị tĩnh, không có chi phí runtime. Đây thuần là cải thiện khả năng bảo trì (maintainability). Giá trị runtime **không đổi** → không ảnh hưởng hành vi.

---

## 3. Wiring hằng số

Sau khi có hằng số, ta thay literal inline bằng import. Quy tắc vàng: **giá trị runtime phải giữ y nguyên** — đây chỉ là "đổi tên gọi", không đổi giá trị.

### `src/services/board.service.ts`, `home.service.ts`, `today.service.ts`
- `'HVAC Editor'` → `DEFAULT_BOARD_TITLE`
- `index * 1000` → `index * LIST_POSITION_STEP`
- `throw new Error('Please choose a starter template.')` → `throw new Error(ERROR_MESSAGES.INVALID_TEMPLATE)`
- `sourceTask.priority || 'Low'` → `sourceTask.priority || DEFAULT_TASK_PRIORITY`

### `src/services/task.service.ts`
- Trong builder payload: `priority ?? 'Low'` → `priority ?? DEFAULT_TASK_PRIORITY`

### `src/utils/boardDataMapper.ts`
- `normalizeTaskPriority`: thay chuỗi `if` so sánh literal bằng `(TASK_PRIORITIES as readonly string[]).includes(priority)`.

  **Tại sao có ép kiểu `as readonly string[]`?** Vì `TASK_PRIORITIES` là tuple chỉ-đọc của các literal; `.includes(priority: string)` cần phía mảng chấp nhận `string`. Ép kiểu chỉ ở tầng *type* (compile-time), **không** đổi gì lúc chạy. Hành vi: trả `undefined` cho giá trị lạ/null y như cũ.
- `category1: 'Design'`/`category2: 'Sprint'` → `DEFAULT_TASK_CATEGORIES.CATEGORY_1/2`

### `src/hooks/useFocusTasks.ts`
- Key localStorage `'kanban_focus_tasks'`/`'kanban_active_focus_task'` → `STORAGE_KEYS.*`
- `maxFocusTasks = 3` → `MAX_FOCUS_TASKS`. **Chú ý:** object trả về vẫn giữ **đúng tên property** `maxFocusTasks` (chỉ đổi *giá trị nguồn* sang hằng số) để nơi tiêu thụ không phải sửa.
- Chuỗi giới hạn focus → `FOCUS_LIMIT_MESSAGE`

### Components: `PomodoroModeSwitch.tsx`, `HomeDashboard.tsx`, `TaskItem.tsx`, và 4 toast trong `App.tsx`
- `POMODORO_MODES`, `FOCUS_BUTTON_LABELS`, `TASK_PRIORITIES`, `FOCUS_LIMIT_MESSAGE` thay cho literal inline.

> **Ghi chú quan trọng:** `data.ts` được kiểm tra và **không cần đổi** — nó không chứa `'HVAC Editor'` (chỉ có title list "List 1/2/3"). Đừng đổi cái không cần đổi.

**Hiệu năng:** không đổi. Import một hằng số module-level rẻ hơn hoặc bằng việc khai báo literal inline.

---

## 4. Utilities & đổi tên

### Tách hàm thuần ra `src/utils/`

| Hàm | Từ | Đến | Lý do |
|-----|-----|-----|-------|
| `createLocalId` | TaskDialog.tsx | `src/utils/idGenerator.ts` | Sinh ID là việc dùng chung, không nên dính chặt vào 1 component |
| `formatFocusSessionDuration` | TaskDialog.tsx | `src/utils/timeFormatting.ts` | Format thời gian là util thuần, tái sử dụng được |
| `getPriorityDotClass` | (ternary inline trong TaskItem) | `src/utils/taskMetadata.ts` | Thay biểu thức ternary khó đọc bằng 1 hàm có tên rõ |

Cả ba đều **copy nguyên văn** phần thân hàm → cùng input cho cùng output. Đây là yêu cầu của refactor: extract mà không đổi kết quả.

Riêng `getPriorityDotClass` đáng để soi kỹ vì nó là ví dụ điển hình về "bảo toàn cả nhánh fallback":

```ts
// CŨ (inline trong JSX, khó đọc):
p === 'High' ? 'bg-red-500'
  : p === 'Medium' ? 'bg-amber-500'
  : p === 'Low' ? 'bg-emerald-500'
  : 'bg-gray-400'   // <-- nhánh else: bắt cả 'Lowest' LẪN giá trị bất ngờ

// MỚI:
const priorityDotClassMap: Record<TaskPriority, string> = {
  High: 'bg-red-500', Medium: 'bg-amber-500', Low: 'bg-emerald-500', Lowest: 'bg-gray-400',
};
export function getPriorityDotClass(priority: string): string {
  return priorityDotClassMap[priority as TaskPriority] ?? 'bg-gray-400';
}
```

**Điểm tinh tế:** ternary cũ trả `bg-gray-400` cho `'Lowest'` **và** cho bất kỳ giá trị lạ nào. Bản map mới: `'Lowest'` được map tường minh thành `bg-gray-400`, còn `?? 'bg-gray-400'` lo nốt phần "giá trị không có trong map". → tái tạo *đúng* output cho **mọi** input. Nếu chỉ làm map mà quên `??`, ta sẽ vỡ trường hợp giá trị lạ.

### Đổi tên (atomic rename)

| Tên cũ | Tên mới | File |
|--------|---------|------|
| `resolveDestinationListId` | `findValidDestinationListId` | KanbanBoard.tsx |
| `focusTasksWithLiveData` | `focusTasksWithCurrentBoardState` | useFocusTasks.ts |

**"Atomic" nghĩa là gì và tại sao quan trọng?** Đổi tên thì *khai báo* và *mọi nơi gọi* phải đổi **cùng một lúc**. Nếu đổi nửa vời (chỗ đổi chỗ chưa) thì code gãy ngay. Với `focusTasksWithLiveData`, anh dùng công cụ rename theo ngữ nghĩa (symbol rename) để sửa cả 7 chỗ trong file một phát — an toàn hơn tìm-thay tay. Tên mới `...WithCurrentBoardState` nói rõ ý: đây là focus task đã được "đồng bộ với trạng thái board hiện tại".

---

## 5. Gom logic Service & Mapper

Đây là phần "gom code trùng" — chỗ dễ tạo bug nhất nếu làm ẩu, vì payload gửi Supabase phải **byte-identical**.

### 5.1 `task.service.ts` — gom normalize

**Cũ:** hai hàm `buildStableTaskInsertPayload` và `buildStableTaskUpdatePayload` lặp lại cùng một kiểu coalescing (`description ?? ''`, `priority ?? 'Low'`, ...).

**Mới:** một "bảng normalizer" dùng chung cho cả hai:

```ts
const STABLE_TASK_FIELD_NORMALIZERS = {
  description: (v) => v ?? '',
  priority:    (v) => v ?? DEFAULT_TASK_PRIORITY,
  start_date:  (v) => v ?? null,
  // ...
};
function normalizeTaskData(taskData)        { /* INSERT: emit MỌI field */ }
function normalizeTaskDataPartial(taskData) { /* UPDATE: chỉ emit field có trong input */ }
```

**Khác biệt sống còn giữa insert và update phải giữ nguyên:**
- INSERT luôn xuất tất cả field.
- UPDATE chỉ xuất field nào *có mặt* trong input (`'key' in taskData`) — đây là cách Supabase phân biệt "không đụng tới field" vs "set field = null".
- `title` ở UPDATE gán **thô** (không coalesce), khác với các field khác. Chi tiết nhỏ này mà bỏ sót là lệch payload.

Anh đã ký một "biên bản tương đương" (equivalence): với input đầy đủ / input null / input chỉ vài key → output mới trùng output cũ từng field. Vì không có test, việc lý luận từng case này chính là "test thủ công".

### 5.2 `boardDataMapper.ts` — `applyTaskDefaults` + xoá code chết

- Trích phần "thân chung" của 2 builder thành `applyTaskDefaults(...)`, rồi:
  - insert = `applyTaskDefaults(...)` + các field riêng (`board_id`, `list_id`, `category1/2`, `is_done`, `position`)
  - update = `applyTaskDefaults(...)`
- **Xoá `void attachments;`** — đây là *dead code* (câu lệnh vô nghĩa, chỉ để "giả vờ dùng" biến). Đồng thời bỏ luôn `attachments` khỏi phần destructure để lint không báo "biến không dùng". `attachments` **chưa bao giờ** nằm trong payload xuất ra → xoá không đổi gì.

### 5.3 Bổ `buildBoardDataFromRows` thành 3 helper

`buildChecklistItemsMap`, `buildLabelsMap`, `buildLabelTaskRelationships`. Hàm gốc giờ chỉ "điều phối" 3 helper này.

**Chi tiết phải bảo toàn:** thứ tự `sort` (checklist/list/task đều theo `position` tăng dần), logic bỏ qua label-link không có label tương ứng, và thứ tự lắp ráp cuối. Có một điểm rất dễ trượt: code cũ `.sort()` **ngay trên mảng tham số** (sort tại chỗ — mutate input). Anh giữ **đúng hành vi mutate đó** trong helper, không tự ý copy `[...rows]` rồi sort, vì như thế là *đổi hành vi* với caller (dù "sạch" hơn). Refactor là giữ nguyên, kể cả những điểm chưa hoàn hảo — muốn sửa hành vi thì làm task riêng.

### 5.4 Bổ `seedDefaultBoard` thành `seedBoardLists` → `seedBoardTasks` → `seedTaskDetails`

**Điểm sống còn:** **thứ tự gọi DB phải y hệt** — tạo board → insert từng list một → insert batch task → vòng lặp gán checklist+label theo từng task (checklist trước, label sau). Sai thứ tự = sai dữ liệu seed. Các helper truyền `listIdMap` và mảng `seededTaskDetails` qua lại để giữ nguyên mạch.

### 5.5 `useFocusTasks.ts` — gom đọc localStorage

Gộp 2 hàm đọc thành một reader tổng quát:

```ts
function readFromLocalStorage<T>(key, fallback, parse?) {
  if (typeof window === 'undefined') return fallback; // chặn SSR
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return parse ? parse(raw) : (raw as unknown as T);
  } catch { return fallback; }
}
```

Anh đã rà 6 case biên (chuỗi rỗng, JSON hợp lệ, raw string, null, SSR...) để chắc chắn kết quả *quan sát được* trùng bản cũ — kể cả case "chuỗi rỗng" mà bản cũ short-circuit bằng `storedValue ? ... : []`, còn bản mới đi qua `JSON.parse('')` ném lỗi rồi `catch` về `[]`. Đường đi khác nhau nhưng **kết quả giống nhau** → chấp nhận được.

---

## 6. TaskDialog

Ba bước (7.1 → 7.3) gom state trong `TaskDialog.tsx`:

- **7.1 `formDrafts`:** gộp 5 `useState` nháp (`labelDraft`, `labelColorDraft`, `attachmentNameDraft`, `attachmentUrlDraft`, `checklistDraft`) thành 1 object có cấu trúc.
  **Điểm tinh tế bảo toàn:** khi mở dialog, code cũ **không** reset màu label (`labelColorDraft`). Bản gộp phải giữ đúng điều đó: `setFormDrafts(prev => ({ label: { name: '', color: prev.label.color }, ... }))` — `name` reset, `color` giữ nguyên `prev`.
- **7.2 `resetDialogState(mode)`:** gộp `initializeDialogState` (full reset) và `resetTransientDialogState` (reset nhẹ) thành một hàm có tham số `'full' | 'transient'`.
- **7.3 `addDraftItem<T>`:** gộp 3 handler thêm item (label/attachment/checklist) vốn lặp cùng mẫu *trim → validate → tạo id → append → clear draft*. Giữ nguyên validate URL của attachment (`new URL(...)` trong try/catch).

Ba bước này build & lint sạch ngay. **Bước 7.4 mới là chỗ đáng nói.**

---

## 7. Task 7.4 — chỗ anh loay hoay lâu nhất

Em hỏi đúng chỗ. Đây là task duy nhất anh phải **đổi hẳn cách tiếp cận** giữa chừng. Anh kể lại đầy đủ để em học được cách xử lý khi gặp tình huống tương tự.

### 7.4 yêu cầu gì?
Trích logic load *activities* và *focus sessions* (đang nằm trong `TaskDialog`) ra một hook riêng `useTaskActivityData`, và thay `priorityOptions` bằng `TASK_PRIORITIES`.

### Lần thử đầu — và lỗi xuất hiện

Anh tạo `src/hooks/useTaskActivityData.ts` ôm state `activities`/`focusSessions`/`isLoadingActivities`/`isLoadingFocusSessions`, hai hàm load, một `resetActivityData`, và một effect: khi `isOpen && isEditMode && taskId` thì load, ngược lại thì reset.

Trong `TaskDialog`, sau khi rút phần activity ra hook, còn lại hàm `resetDialogState(mode)` (từ task 7.2) và effect gọi nó:

```ts
useEffect(() => {
  if (!isOpen) { resetDialogState('transient'); return; }
  resetDialogState('full');
}, [isOpen, resetDialogState]);
```

`build` thì pass, nhưng `lint` **báo lỗi mới** (baseline vốn là 0 lỗi/0 warning):

```
src/components/organisms/dialog/TaskDialog.tsx
212:7  error  Calling setState synchronously within an effect can trigger
cascading renders   react-hooks/set-state-in-effect
```

### Tại sao lỗi? (phần quan trọng nhất)

Rule `react-hooks/set-state-in-effect` cảnh báo: **gọi `setState` đồng bộ ngay trong thân effect** dễ gây "cascading render" (render xong lại setState → render lại → ...). `resetDialogState` mở đầu bằng `setShowAssigneeSelect(false)` — một `setState` vô điều kiện — và nó được gọi thẳng trong effect.

Câu hỏi anh tự đặt ra: "Code GỐC cũng có effect gọi reset tương tự, sao trước đây lint sạch?". Anh kiểm chứng bằng cách `git stash` rồi lint bản gốc → **exit 0**. Tức đây **là regression do chính đợt refactor sinh ra**, không phải lỗi sẵn có. Phải sửa để trả baseline về 0/0 (Requirement 9 bắt buộc).

Đào sâu tiếp: bản gốc lint sạch vì effect reset của nó **đứng cạnh** một effect load bất đồng bộ (`await fetchActivitiesForTask`) — rule coi việc "đồng bộ hoá với hệ thống ngoài" (gọi API) là chính đáng. Khi task 7.4 dời phần load API sang `useTaskActivityData`, effect còn lại trong `TaskDialog` trở thành effect "chỉ toàn setState đồng bộ" → đúng kiểu rule muốn bắt.

> **Bài học #1:** một thay đổi "đúng về mặt logic" vẫn có thể kích hoạt một rule lint vì *ngữ cảnh* xung quanh đã đổi. Đừng vội disable rule — hãy hiểu **vì sao** nó kêu.

### Vài lần thử sai (anh thành thật kể)
- Thử đảo thứ tự câu lệnh / gộp nhánh trong effect → rule vẫn kêu, vì nó truy được tới setState đồng bộ dù nằm ở đâu.
- Thử các biến thể nhỏ của effect → không ăn thua.

Tới đây anh **dừng việc vá vặt** và lùi lại hỏi: "React khuyến nghị làm gì cho việc *reset state khi prop đổi*?". Đáp án nằm ngay trong link mà rule trỏ tới: [you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect) — *"reset state khi prop thay đổi nên làm trong lúc render, không phải trong effect"*.

> **Bài học #2:** nếu vá 2 lần không xong, đừng vá lần 3. Lùi lại tìm **nguyên nhân gốc** và đổi cách tiếp cận.

### Cách sửa đúng (giải pháp cuối)

Tách effect cũ làm **2 phần theo đúng bản chất**:

**Phần A — reset state nội bộ → chuyển sang "render-phase reset" (mẫu chính thống của React):**

```ts
const [previousOpenContext, setPreviousOpenContext] = useState(null);

if (
  !previousOpenContext ||
  previousOpenContext.isOpen !== isOpen ||
  previousOpenContext.taskData !== taskData
) {
  setPreviousOpenContext({ isOpen, taskData });   // setState lúc render — React xử lý gọn, không cascading
  if (isOpen) {
    setShowAssigneeSelect(false);
    setLabels(taskData?.labels || []);
    setAttachments(taskData?.attachments || []);
    setChecklistItems(taskData?.checklistItems || []);
    setFormDrafts((prev) => ({ label: { name: '', color: prev.label.color }, attachment: { name: '', url: '' }, checklist: '' }));
  }
}
```

Mẫu này so sánh "ngữ cảnh lần trước" với hiện tại; khi `isOpen` hoặc `taskData` đổi thì reset. React **được thiết kế** để chấp nhận setState trong render miễn là có điều kiện dừng (ở đây là cập nhật `previousOpenContext` nên lần render kế không vào lại nhánh). Đây tái tạo **đúng** hành vi "reset khi mở / reset khi đổi task".

**Phần B — đồng bộ với hệ thống ngoài (react-hook-form + editor Tiptap) → vẫn là `useEffect` (đúng vai trò), nhưng không còn `setState` thuần của component:**

```ts
useEffect(() => {
  if (!isOpen) return;
  const nextValues = { /* ... */ };
  reset(nextValues);                 // API của react-hook-form (hệ thống ngoài)
  setValue('description', ...);
  if (editor) editor.commands.setContent(...);  // API của Tiptap (hệ thống ngoài)
}, [editor, isOpen, reset, setValue, taskData]);
```

`reset`/`setValue`/`editor.commands` là API của thư viện ngoài — đúng định nghĩa "effect dùng để đồng bộ với external system", nên rule không kêu.

**Phần reset lúc đóng/idle** (đóng assignee-select + clear activities/focus) thì đã thuộc `useTaskActivityData` (qua `resetActivityData` + `onIdleReset`), nên block render-phase ở trên chỉ chạy khi `isOpen` — không reset trùng, không thiếu reset.

### Bảo toàn hành vi ra sao?
- Mở dialog / đổi task: reset form-values + labels + attachments + checklist + drafts (giữ màu label) + nội dung editor + đóng assignee-select → **giống hệt** `initializeDialogState` cũ.
- Đóng dialog / idle: đóng assignee-select + clear activities/focus + cờ loading → **giống hệt** `resetTransientDialogState` cũ, nay do hook lo.
- **Không** thêm một dòng `eslint-disable` nào — anh muốn sửa *cấu trúc*, không che cảnh báo.

### Dọn dẹp
Trong lúc chẩn đoán, subagent có tạo vài file tạm để dò (`__TaskDialogRepro.tsx`, `__OrigTaskDialog_diag.tsx`, `__probe.tsx`). Anh đã **xoá sạch** và xác nhận `src/` không còn file rác trước khi đóng task.

> **Bài học #3:** "hiệu năng" và "lint rule" đôi khi là một. Rule `set-state-in-effect` không chỉ để đẹp code — nó ngăn *cascading render* (render thừa). Sửa đúng cách (render-phase reset) vừa hết warning vừa tránh render dư.

---

## 8. KanbanBoard

`KanbanBoardProps` cũ phẳng 13 props. Gom thành 4 nhóm cho dễ đọc:

```ts
interface KanbanBoardProps {
  boardData: BoardData;
  filters: { searchQuery; priority; assignee; dueDate };
  ui: { openMenuId; toggleMenu };
  handlers: { onEditTask; onDeleteItem; onOpenAddTask; onOpenAddGroup; onBoardPositionChange; onUpdateTask; onToggleFocusTask };
  isFocusTask; workspaceMembers?;
}
```

- `filterPriority`→`filters.priority`, `handleEditTask`→`handlers.onEditTask`, `onBoardDataChange`→`handlers.onBoardPositionChange`...
- **Bên trong** component, lời gọi `doesTaskMatchFilters` vẫn map đúng key cũ (`{ searchQuery, filterPriority, filterAssignee, filterDueDate }`) — **không** đổi chữ ký của util đó (ngoài phạm vi). Chỉ "đấu dây" lại từ nhóm mới sang key cũ.
- Props truyền xuống `TaskList`/`TaskItem` **giữ nguyên tên** — không đụng tới hai component con.

Task 8.1 (đổi interface) và 8.2 (đổi call-site ở App.tsx) phải làm **cùng lúc** vì đổi một bên mà không đổi bên kia là gãy build. Hiệu năng: không đổi — chỉ là hình dạng props.

---

## 9. App.tsx

Đây là trọng tâm: bổ "God Component" 1721 dòng thành các hook tập trung. Thứ tự làm: từ **rủi ro thấp → cao**, build+lint sau mỗi bước, để nếu vỡ thì biết ngay do bước nào.

| Hook tách ra | Lo việc gì | Ghi chú bảo toàn |
|--------------|-----------|------------------|
| `useViewRouting` | `activeView`, `activeInviteToken`, `setActiveViewWithPath`, popstate | Map path→view **chép nguyên văn**; pushState chỉ khi path khác |
| `useBoardDataManagement` | boardData, summaries, cờ loading, ref, cache sync, `refreshBoardData/List`, realtime, reminder | **Rủi ro cao nhất.** Effect fetch chính *vẫn ở lại* App.tsx vì nó điều phối cả routing+auth |
| `useTaskOperations` | create/update/delete/move task + gộp 2 payload vị trí + đổi tên `handleBoardPositionChange` | Optimistic update + rollback + activity log chép nguyên |
| `useFocusTaskHandlers` | 4 handler toggle/start focus + dựng fallback task | Logic dựng task tạm từ Home/Today summary giữ nguyên |
| `useCommandPaletteActions` | dựng mảng lệnh từ `COMMAND_PALETTE_ACTION_CONFIG` + `run` closure | Thứ tự lệnh + memo deps + nhánh điều kiện PiP giữ nguyên |
| `useAppDialogState` | gộp 6 cờ dialog + state chọn task/list | Helper open/close **stable** (`useCallback([])`) để không phá memo |

Vài điểm "anh muốn em để ý":

**a) Trả về cùng tên để không phải sửa nơi tiêu thụ.** Ví dụ `useBoardDataManagement` trả về `boardData`, `setBoardData`, `refreshBoardData`... đúng tên cũ. App.tsx destructure ra là ~hàng chục chỗ dùng phía dưới *không cần đổi gì*. Đây là mẹo giảm rủi ro khi tách hook khỏi file lớn.

**b) Cảnh báo `exhaustive-deps` sau khi tách.** Khi `setBoardData`, `activeBoardIdRef`... chuyển từ "biến local" thành "giá trị trả từ hook", ESLint không còn tự nhận chúng là *stable* nữa, nên đòi thêm vào dependency array. Anh thêm vào — đây là **trung tính về hành vi** (các ref/setter của React vốn ổn định), chỉ để giữ lint 0 warning.

**c) Giữ memo ổn định.** Ở `useCommandPaletteActions`, anh bọc `openGroupDialog`/`openCreateBoardDialog` bằng `useCallback([])` trước khi truyền vào, để mảng lệnh không bị tính lại mỗi lần render (giữ đúng đặc tính memo của bản gốc). Nếu truyền arrow inline, memo sẽ vỡ mỗi render → render dư.

**d) `useTaskOperations` đổi tham số ở task 9.6.** Khi gộp dialog state, 4 setter (`setIsModalOpen`, `setActiveListId`, `setIsEditModalOpen`, `setEditingTask`) được thay bằng một `closeTaskDialog()`. Tương đương vì tại một thời điểm chỉ một trong create/edit mở, và `closeTaskDialog` reset cả `isOpen`+`activeListId`+`editingTask`.

**e) `renderAppHeader` → biến `appHeader` (task 9.7).** Bỏ hàm wrapper, dựng element **một lần** rồi tham chiếu ở 3 call-site `{appHeader}`. Tại cả 3 chỗ `user` đã chắc chắn truthy (nằm sau guard `if (!user) return null`), nên `user ? <AppHeader/> : null` cho kết quả y hệt.

**Kết quả:** App.tsx **1721 → 947 dòng** (giảm ~45%), build 0, lint 0/0.

---

## 10. Bài học

Tóm gọn những gì anh muốn em mang theo:

1. **Refactor = giữ hành vi.** Mỗi thay đổi tự hỏi "cùng input có cùng output không?". Chú ý các chi tiết tinh tế: nhánh `else`/fallback, thứ tự sort, mutate tại chỗ, field nào coalesce field nào không.
2. **Đi từ rủi ro thấp đến cao.** Hằng số → util → đổi tên → gom service → tách component lớn. Build+lint sau mỗi bước để khoanh vùng lỗi.
3. **Trả về cùng tên khi tách hook** để giảm số chỗ phải sửa → giảm rủi ro.
4. **Khi vá 2 lần không xong, lùi lại tìm gốc rễ.** Như task 7.4: thay vì cố nhét setState vào effect, chuyển sang render-phase reset đúng như React khuyến nghị.
5. **Đừng disable lint rule để cho xong.** Rule thường có lý do (vd: tránh cascading render). Hiểu nó, sửa cấu trúc.
6. **Dọn rác.** File tạm khi debug phải xoá trước khi đóng việc.
7. **Không có test thì review là "test".** Lý luận tương đương từng case, so với code gốc (git) làm "oracle".

---

*Tài liệu này mô tả đợt refactoring giữ-nguyên-hành-vi. Mọi thay đổi đã qua `npm run build` (exit 0) và `npm run lint` (0 lỗi / 0 warning), đối chiếu với bản gốc trong git làm chuẩn so sánh.*
