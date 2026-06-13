import type { TodayPageData, TodayTaskSummary } from '../../../services/today.service';
import type { FocusTask } from '../../../types/focus.type';
import { MAX_FOCUS_TASKS } from '../../../constants';
import { useTodaySuggestions } from '../hooks/useTodaySuggestions';
import SuggestedTaskCard from './SuggestedTaskCard';
import QuickCreateTodayTask from './QuickCreateTodayTask';
import TodayTaskCard from '../../../components/today/TodayTaskCard';
import { toast } from 'react-toastify';

interface TodayTaskSelectorProps {
  todayData: TodayPageData;
  focusTasks: FocusTask[];
  onToggleTodayFocus: (task: TodayTaskSummary) => void;
  onOpenTask: (task: TodayTaskSummary) => void;
  onStartFocus: (task: TodayTaskSummary) => void;
  onQuickCreateTask: () => void;
}

export default function TodayTaskSelector({
  todayData,
  focusTasks,
  onToggleTodayFocus,
  onOpenTask,
  onStartFocus,
  onQuickCreateTask,
}: TodayTaskSelectorProps) {
  const selectedTaskIds = new Set(focusTasks.map(t => t.id));
  const suggestedTasks = useTodaySuggestions(todayData, selectedTaskIds, 5);
  const isAtLimit = focusTasks.length >= MAX_FOCUS_TASKS;

  const handleAdd = (task: TodayTaskSummary) => {
    if (isAtLimit) {
      toast.warn(`Bạn chỉ có thể chọn tối đa ${MAX_FOCUS_TASKS} việc tập trung.`, { theme: 'colored' });
      return;
    }
    onToggleTodayFocus(task);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Cột 1: Danh sách đã chọn */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Hôm nay bạn chọn {MAX_FOCUS_TASKS} việc nào?
          </h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {focusTasks.length}/{MAX_FOCUS_TASKS}
          </span>
        </header>

        <div className="flex flex-col gap-3">
          {focusTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Chưa có việc nào được chọn</h3>
              <p className="mt-1 text-xs text-slate-500">Hãy thêm từ gợi ý bên cạnh hoặc tạo việc mới.</p>
            </div>
          ) : (
            focusTasks.map((focusTask, index) => {
              const taskSummary: TodayTaskSummary = {
                id: focusTask.id,
                boardId: focusTask.boardId,
                boardTitle: focusTask.boardTitle,
                listId: focusTask.listId || '',
                listTitle: focusTask.listTitle || 'Untitled list',
                title: focusTask.title,
                description: '',
                priority: focusTask.priority || null,
                dueDate: focusTask.dueDate || null,
                assigneeAvatar: focusTask.assigneeAvatar,
                isDone: Boolean(focusTask.isDone),
                updatedAt: null,
              };

              return (
                <div key={focusTask.id} className="relative">
                  <div className="absolute -left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm z-10">
                    {index + 1}
                  </div>
                  <TodayTaskCard
                    task={taskSummary}
                    isFocusTask={true}
                    onOpenTask={onOpenTask}
                    onStartFocus={onStartFocus}
                    onToggleTodayFocus={onToggleTodayFocus}
                  />
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Cột 2: Gợi ý */}
      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-base font-bold text-slate-900">Gợi ý cho bạn</h2>
          <p className="text-sm text-slate-500">Dựa trên hạn chót và mức độ ưu tiên</p>
        </header>

        <div className="flex flex-col gap-3">
          {suggestedTasks.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">Không có gợi ý nào khác.</p>
          ) : (
            suggestedTasks.map((task) => (
              <SuggestedTaskCard
                key={task.id}
                task={task}
                onAdd={handleAdd}
                disabled={isAtLimit}
              />
            ))
          )}
          
          <QuickCreateTodayTask onQuickCreate={onQuickCreateTask} />
        </div>
      </section>
    </div>
  );
}
