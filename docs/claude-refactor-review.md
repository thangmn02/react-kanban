# Claude Refactor Review

## Muc tieu cua dot refactor

Dot nay khong nham "lam dep code" theo kieu thay ten bien hoac doi format cho vui. Muc tieu thuc te la:

1. Giam cac diem sloppy de gay bug that.
2. Lam ro source of truth trong data flow va type system.
3. Bo coupling khong can thiet giua UI, service, va schema.
4. Giu lai pham vi vua du, tranh over-engineering.

Noi ngan gon: day la dot "lam code dung hon va de song hon", khong phai dot "trang diem cho code".

---

## Tong quan nhung gi da thay doi

### 1. App orchestration va optimistic update

File lien quan:

- `src/App.tsx`
- `src/components/organisms/KanbanBoard.tsx`

#### Truoc khi sua

`App.tsx` dang om qua nhieu trach nhiem:

- load board
- cache board
- optimistic update
- rollback
- tao activity log
- mapping payload update task
- quan ly dialog state

Rui ro o day khong nam o viec file dai, ma nam o semantics:

- Task drag/drop co the tao activity log truoc khi persist thanh cong.
- Neu request update vi tri that bai, UI rollback nhung activity log van noi la task da move.
- Dieu nay lam audit trail sai.

#### Sau khi sua

- `KanbanBoard` chi gui "intent" cua hanh dong move.
- `App.tsx` la noi quyet dinh khi nao duoc ghi activity.
- Activity chi duoc tao sau khi `updateTaskPositions` thanh cong.
- Neu save fail, board rollback va khong de lai log sai.

#### Tai sao day la nang cap that

Truoc:

- UI noi "da move"
- DB noi "chua move"
- audit log noi "da move"

Sau:

- UI optimistic van nhanh
- nhung log chi xuat hien khi state ben server hop le

Day la khac biet giua "cam giac app nhanh" va "he thong van dung".

---

### 2. Task dialog: bo state mutation sloppy trong effect

File lien quan:

- `src/components/organisms/dialog/TaskDialog.tsx`

#### Truoc khi sua

Dialog co nhieu `useEffect` vua mo form vua set state dong bo:

- reset form
- reset assignee dropdown
- reset labels, attachments, checklist
- load activity
- set loading state ngay trong effect

Cach nay co may van de:

- bi React hook rules canh bao
- de phat sinh stale state khi open/close nhanh
- kho phan biet state nao la "transient UI state", state nao la "form state", state nao la "server data state"

#### Sau khi sua

- tach helper ro rang:
  - `resetTransientDialogState`
  - `initializeDialogState`
  - `loadActivities`
- effect chi con vai tro trigger, khong om logic lon nua
- chuyen `watch()` sang `useWatch()` cho React Hook Form

#### Tai sao day la nang cap that

Code truoc khong chi "xau", ma con kho predict.

Khi mot component modal vua co rich text editor, vua co form state, vua co async data, thi dieu can nhat la:

- luong khoi tao phai ro
- luong reset phai ro
- luong load du lieu phai ro

Dot sua nay dua component gan hon voi logic "co the ly giai duoc".

---

### 3. Type safety voi Supabase: bo `any`, bo duplicate schema

File lien quan:

- `src/lib/supabase.ts`
- `src/types/supabase.type.ts`
- `src/types/supabase.ts`
- `src/services/activity.service.ts`
- `src/services/board.service.ts`
- `src/services/list.service.ts`
- `src/services/task.service.ts`
- `src/services/checklist.service.ts`
- `src/services/label.service.ts`

#### Truoc khi sua

Co 2 van de lon:

##### A. `supabase` client bi de `any` hoac nullable leak khap noi

He qua:

- build-time protection yeu
- code compile du cho co nhieu kha nang sai
- service layer phai cast mo hoac tin vao may man

##### B. Co 2 file schema types song song

- `supabase.type.ts`
- `supabase.ts`

Khi co 2 nguon schema, som muon se co drift.

Drift nguy hiem o cho:

- file A noi cot co
- file B noi cot khac
- service import nham file la bat dau co false confidence

#### Sau khi sua

- `supabase.ts` khong con la schema thu hai, chi re-export tu `supabase.type.ts`
- them `requireSupabaseClient()` de service chi dung client sau khi da narrow ro
- bo dan cac `any`
- bo sung type cho `task_activities`
- them mapper tu row Supabase sang model UI cho activity

#### Tai sao day la nang cap that

Day la thay doi "ha tang". Nhin be, nhung tac dung lon:

- compiler bat loi som hon
- service layer it cast mu
- giam kha nang sua schema mot noi, vo noi khac

No giong viec don nen mong truoc khi xay tiep nha.

---

### 4. Doi tuong metadata task: labels, attachments, checklist

File lien quan:

- `src/utils/boardDataMapper.ts`
- `src/utils/taskCollections.ts`
- `src/services/checklist.service.ts`
- `src/services/label.service.ts`
- `supabase/migrations/20260523183000_add_task_jsonb_fields.sql`
- `supabase/migrations/20260523200000_normalize_task_metadata.sql`

#### Truoc khi sua

Metadata task dang o giai doan chuyen tiep:

- co dau vet luu JSONB tren `tasks`
- co huong normalize sang bang rieng
- phan service chua du chat che trong viec normalize input

`label.service.ts` co diem sloppy de gay data ban:

- nhan label trung ten khac hoa thuong
- nhan label chi toan khoang trang
- dua thang input vao persistence

#### Sau khi sua

- `normalizeLabels()` trim ten label
- bo label rong
- dedupe theo ten khong phan biet hoa thuong
- `checklist.service.ts` va `label.service.ts` dung cung mot kieu truy cap Supabase an toan hon

#### Tai sao day la nang cap that

Kieu loi nay thuong khong no ngay, nhung tich lai rat ban:

- "Bug"
- "bug"
- " bug "

Neu he thong coi 3 cai tren la 3 label khac nhau thi sau nay filter, search, analytics va UI se rot rac.

Sua som cho nay rat dang.

---

### 5. Search/filter logic

File lien quan:

- `src/utils/taskFilters.ts`
- `src/components/organisms/QuickSearch.tsx`

#### Truoc khi sua

Search co mot diem nho nhung kho chiu:

- neu user nhap chi khoang trang, he thong van coi nhu dang search
- ket qua loc tro nen khong tu nhien

Ngoai ra search attachment chi match theo ten, khong match theo URL.

#### Sau khi sua

- `searchQuery` duoc `trim()` truoc khi loc
- query rong sau khi trim thi duoc coi la khong search
- search attachment match ca `name` va `url`

#### Tai sao day la nang cap that

Day la loai fix "nho nhung dung":

- khong phai them feature lon
- khong tang complexity
- nhung lam hanh vi app hop ly hon voi suy nghi cua nguoi dung

Do la refactor tot: nho, dung, co ly do.

---

### 6. Calendar view: giam filter lap lai khong can thiet

File lien quan:

- `src/components/organisms/CalendarBoardView.tsx`

#### Truoc khi sua

Moi o ngay trong lich deu:

- lap qua `scheduledTasks`
- loc lai task cua ngay do

Neu so task tang, cach nay tao nhieu lan loc lap lai cung mot du lieu.

#### Sau khi sua

- tao `tasksByDueDate` bang `Map<string, ITaskItem[]>`
- group task mot lan
- moi cell chi lookup theo key ngay

#### Tai sao day la nang cap that

Day khong phai micro-optimization vo nghia.

Calendar la UI co rat nhieu cell. Pattern "moi cell tu loc lai toan bo task" la pattern de bi phi tai nguyen khi feature lon len.

Sua som theo huong group-once, lookup-many-times la hop ly.

---

### 7. Shared constants va coupling component

File lien quan:

- `src/data/assignees.ts`
- `src/components/organisms/QuickSearch.tsx`
- `src/components/task/TaskItem.tsx`
- `src/components/organisms/dialog/TaskDialog.tsx`

#### Truoc khi sua

`AVAILABLE_ASSIGNEES` nam trong `QuickSearch.tsx`, nhung component khac cung import nguoc tu day.

Do la coupling khong dep:

- file UI filter tro thanh noi chua shared data
- component khac import tu component thay vi import tu data module

#### Sau khi sua

- tach `AVAILABLE_ASSIGNEES` ra `src/data/assignees.ts`
- component nao can thi import tu shared data module

#### Tai sao day la nang cap that

Data dung chung khong nen song trong mot component cu the.

Neu de nhu cu, ve sau:

- doi QuickSearch de vo tinh lam anh huong task dialog
- xoa component cu nhung lai vo shared constant

Tach ra som giup duong import dung huong hon.

---

### 8. Seed/demo data va dead comments

File lien quan:

- `src/data.ts`

#### Truoc khi sua

File co:

- mot khoi comment cu rat dai
- ghi chu drag-drop dang "tu duy nhap mon"
- formatting khong deu

Van de o day khong phai "nhin xau", ma la:

- tang noise khi doc file
- lam mo source data that su dang duoc app dung
- nguoi sau de bi lan giua comment cu va model hien tai

#### Sau khi sua

- xoa dead block comment
- giu lai seed data dang duoc su dung that
- format lai cho de scan

#### Tai sao day la nang cap that

Comment cu khong phai luc nao cung la tri thuc huu ich.

Neu comment:

- khong con dung voi architecture hien tai
- khong giup nguoi doc debug
- chi lap lai mot implementation da ro

thi no la rac thong tin.

---

## Nhung diem toi da can nhac nhung KHONG sua

Day la phan quan trong, vi refactor gioi khong chi biet sua, ma con biet dung.

### 1. Warning ve chunk size cua Vite

Build hien van canh bao chunk lon.

Toi khong sua ngay vi:

- day la bai toan packaging/performance, khong phai sloppy bug truc tiep
- muon sua dung can xem route split, dialog split, rich editor loading strategy
- sua vo vang de lam app phuc tap hon

### 2. Hai migration metadata

- `20260523183000_add_task_jsonb_fields.sql`
- `20260523200000_normalize_task_metadata.sql`

Toi da doc ky.

Toi khong sua vi:

- migration sau hop ly trong vai tro "dua du lieu tu JSONB sang bang normalize"
- day khong phai sloppy code ro rang, ma la mot progression schema co chu dich

### 3. `boardTemplates.ts`

File gon, de hieu, khong bi over-abstract.
Sua tiep o day la sua cho co viec.

---

## Bai hoc code review tu dot nay

Neu em muon doc code cua AI, nhat la code do Claude sinh ra, hay uu tien tim 5 loai dau hieu nay:

### 1. Dung nhieu state trong 1 component

Khong phai luc nao cung sai.
Nhung neu component vua:

- fetch data
- optimistic update
- rollback
- logging
- mapping payload
- control dialog

thi nen hoi:

"Cho nao la orchestration? Cho nao la business rule? Cho nao la presentation?"

### 2. Activity log / analytics / audit bi dat sai thoi diem

AI rat hay viet theo kieu:

- user click
- log ngay
- roi moi save

Nhin thi nhanh, nhung sai semantics.

Hay nho:

- optimistic UI co the chay truoc
- audit truth thi khong

### 3. Type co ve day du nhung thuc ra la gia

Vi du:

- file type trung lap
- cast `as any`
- row DB sang UI model khong qua mapper

Do la "type-looking code", khong phai type-safe code.

### 4. Shared data nam sai cho

Constant dung chung ma nam trong component la mui coupling rat thuong gap o code AI.

### 5. Comment dai nhung khong con giup ich

AI rat hay de lai:

- comment mo ta obvious code
- comment cua implementation cu
- comment brainstorm dang do

Code review tot la xoa nhung comment nhu vay, khong phai giu lai vi "biet dau sau nay can".

---

## Ket qua sau cung

Sau cac dot sua:

- lint pass
- build pass
- semantics cua drag/drop va activity log dung hon
- type system chat hon
- service layer sach hon
- filter/search hop ly hon
- calendar view bot lap lai cong viec
- source of truth ve schema ro hon

Quan trong nhat: code da bot "AI smell" o nhung cho de gay hau qua thuc te.

Neu toi tong ket ngan gon thanh mot cau:

> Truoc day code co nhieu cho "chay duoc", sau dot nay code tien gan hon toi "chay dung, de sua, va kho tu phan boi nguoi doc".
