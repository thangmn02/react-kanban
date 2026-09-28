import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import BriefingPinForm from './BriefingPinForm';
import type { HomeTaskSummary } from '../../services/home.service';
import type { AppUser } from '../../types/auth.type';

afterEach(cleanup);

const tasks: HomeTaskSummary[] = [
  { id: 't1', boardId: 'b1', boardTitle: 'Project', title: 'Write proposal', priority: 'High', dueDate: new Date().toISOString() },
  { id: 't2', boardId: 'b1', boardTitle: 'Project', title: 'Fix login', priority: null, dueDate: null },
];
const currentUser: AppUser = { id: 'u1', email: null, name: 'Thang', avatarUrl: '', isMock: true };

function renderForm() {
  render(
    <I18nProvider>
      <BriefingPinForm
        isOpen
        workspaceId="w1"
        currentUser={currentUser}
        tasks={tasks}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    </I18nProvider>,
  );
}

function whyField() {
  return screen.getByLabelText('Why this matters') as HTMLTextAreaElement;
}

function taskSelect() {
  return screen.getByLabelText('Linked task (optional)') as HTMLSelectElement;
}

it('prefills why-matters when a task is linked', () => {
  renderForm();
  fireEvent.change(taskSelect(), { target: { value: 't1' } });
  expect(whyField().value).toBe('Write proposal is due today.');
});

it('clears the prefill when the task is unlinked', () => {
  renderForm();
  fireEvent.change(taskSelect(), { target: { value: 't1' } });
  fireEvent.change(taskSelect(), { target: { value: '' } });
  expect(whyField().value).toBe('');
});

it('keeps a hand-written reason when the linked task changes', () => {
  renderForm();
  fireEvent.change(taskSelect(), { target: { value: 't1' } });
  fireEvent.change(whyField(), { target: { value: 'The client asked about this on the call.' } });
  fireEvent.change(taskSelect(), { target: { value: 't2' } });
  expect(whyField().value).toBe('The client asked about this on the call.');
});
