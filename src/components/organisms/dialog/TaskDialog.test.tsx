import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n';
import { generateTaskBreakdown } from '../../../services/taskBreakdown.service';
import type { ITaskItem } from '../../../types/task.type';
import TaskDialog from './TaskDialog';

vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => <div /> }));
vi.mock('../../../hooks/useTaskActivityData', () => ({ useTaskActivityData: () => ({ activities: [], focusSessions: [], isLoadingActivities: false, isLoadingFocusSessions: false }) }));
vi.mock('../../../services/taskBreakdown.service', () => ({ generateTaskBreakdown: vi.fn() }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);

it.each(['en', 'vi'])('keeps the %s task form concise while preserving labels and actions', (language) => {
  localStorage.setItem('app.language', language);
  render(<I18nProvider><TaskDialog isOpen onClose={vi.fn()} onSubmitTask={vi.fn()} workspaceId="workspace" /></I18nProvider>);
  expect(screen.getByRole('dialog', { name: language === 'en' ? 'Create task' : 'Tạo công việc' })).toBeVisible();
  expect(screen.getByRole('textbox', { name: language === 'en' ? 'Title' : 'Tiêu đề' })).toBeVisible();
  expect(screen.getByRole('button', { name: language === 'en' ? 'Suggest steps with AI' : 'Gợi ý các bước bằng AI' })).toBeDisabled();
  const removed = /Add a richer task|Keep the board visible|Board-first editing|Break work into smaller steps|GEMINI|Turn a task or a bigger mission|Biến công việc|Uses Gemini|Dùng Gemini|Enter a title to get started|Nhập tiêu đề để bắt đầu|New task will be created|Keep priority for urgency|Lightweight link attachments|No checklist items yet|No labels added yet|No attachments yet/i;
  expect(screen.queryByText(removed)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Your next steps|Các bước tiếp theo/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add item' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add label' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add attachment' })).toBeVisible();
});

it('reviews AI suggestions and adds them to the draft only before task submission', async () => {
  const onSubmitTask = vi.fn();
  vi.mocked(generateTaskBreakdown).mockResolvedValue(['Read notes', 'Write draft', 'Review draft']);
  render(<I18nProvider><TaskDialog isOpen onClose={vi.fn()} onSubmitTask={onSubmitTask} workspaceId="workspace" /></I18nProvider>);
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Write proposal' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest steps with AI' }));
  await screen.findByDisplayValue('Read notes');
  expect(onSubmitTask).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Read customer notes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to checklist' }));
  await screen.findByText('Steps added to your checklist.');
  expect(onSubmitTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  await waitFor(() => expect(onSubmitTask).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Write proposal', checklistItems: [
      expect.objectContaining({ text: 'Read customer notes', isDone: false }),
      expect.objectContaining({ text: 'Write draft', isDone: false }),
      expect.objectContaining({ text: 'Review draft', isDone: false }),
    ],
  })));
});

it('retains the existing task details and uses a simple edit title', async () => {
  const task: ITaskItem = { id: 'task', title: 'Review proposal', description: '', labels: [{ id: 'label', name: 'Design', color: 'sky' }], attachments: [], checklistItems: [{ id: 'step', text: 'Read notes', isDone: true }], assignees: [] };
  const onSubmitTask = vi.fn();
  render(<I18nProvider><TaskDialog isOpen taskData={task} onClose={vi.fn()} onSubmitTask={onSubmitTask} workspaceId="workspace" /></I18nProvider>);
  expect(screen.getByRole('dialog', { name: 'Edit task' })).toBeVisible();
  expect(screen.getByDisplayValue('Read notes')).toBeVisible();
  expect(screen.getByText('Design')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(onSubmitTask).toHaveBeenCalledWith(expect.objectContaining({ title: task.title, labels: task.labels, checklistItems: task.checklistItems })));
});

it('generates from current unsaved labels and due date with the board and column', async () => {
  vi.mocked(generateTaskBreakdown).mockResolvedValue(['Find order number', 'Open tracking link', 'Email the customer']);
  const task: ITaskItem = { id: 'task', title: 'Delayed delivery', description: '', dueDate: '2026-10-08', labels: [{ id: 'label', name: 'Delivery', color: 'sky' }], attachments: [], checklistItems: [{ id: 'step', text: 'Read customer email', isDone: true }], assignees: [] };
  render(<I18nProvider><TaskDialog isOpen taskData={task} onClose={vi.fn()} onSubmitTask={vi.fn()} workspaceId="workspace" boardTitle="Customer care" columnTitle="In progress" /></I18nProvider>);
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Find the delayed parcel' } });
  fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-10' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Label name' }), { target: { value: 'Urgent' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
  fireEvent.click(screen.getByRole('button', { name: 'Suggest steps with AI' }));
  await screen.findByDisplayValue('Find order number');
  expect(generateTaskBreakdown).toHaveBeenCalledWith({ workspaceId: 'workspace', language: 'en', draftContext: {
    title: 'Find the delayed parcel', description: '', dueDate: '2026-10-10',
    labels: ['Delivery', 'Urgent'], boardTitle: 'Customer care', columnTitle: 'In progress', existingSteps: ['Read customer email'],
  } }, expect.any(AbortSignal));
});
