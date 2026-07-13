import { describe, expect, it } from 'vitest';

import type { AppUser } from '../types/auth.type';
import type { TaskAssignee } from '../types/task.type';

import { isTaskAssignedToUser } from './taskAssignment';

const realUser: AppUser = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  avatarUrl: '',
  isMock: false,
};

describe('isTaskAssignedToUser', () => {
  it('matches by stable userId', () => {
    const assignees: TaskAssignee[] = [{ name: 'Alice', avatar: '', userId: 'user-1' }];
    expect(isTaskAssignedToUser(assignees, realUser)).toBe(true);
  });

  it('does not match a different user who shares the same display name', () => {
    const otherUser: AppUser = { ...realUser, id: 'user-2' };
    const assignees: TaskAssignee[] = [{ name: 'Alice', avatar: '', userId: 'user-1' }];
    expect(isTaskAssignedToUser(assignees, otherUser)).toBe(false);
  });

  it('still matches after the user changes their display name', () => {
    const renamed: AppUser = { ...realUser, name: 'Alice Smith' };
    const assignees: TaskAssignee[] = [{ name: 'Alice', avatar: '', userId: 'user-1' }];
    expect(isTaskAssignedToUser(assignees, renamed)).toBe(true);
  });

  it('falls back to display name/email for legacy assignees without userId', () => {
    const byName: TaskAssignee[] = [{ name: 'Alice', avatar: '' }];
    const byEmail: TaskAssignee[] = [{ name: 'alice@example.com', avatar: '' }];
    expect(isTaskAssignedToUser(byName, realUser)).toBe(true);
    expect(isTaskAssignedToUser(byEmail, realUser)).toBe(true);
  });

  it('matches an invited user whose profile is incomplete', () => {
    const invited: AppUser = {
      id: 'user-3',
      email: null,
      name: 'user-3',
      avatarUrl: '',
      isMock: false,
    };
    const assignees: TaskAssignee[] = [{ name: 'whatever', avatar: '', userId: 'user-3' }];
    expect(isTaskAssignedToUser(assignees, invited)).toBe(true);
  });

  it('treats a removed-then-readded membership as still the same user (global identity)', () => {
    // Membership/role churn must not change global user identity; my-tasks
    // matches on the stable auth uid regardless of workspace membership state.
    const assignees: TaskAssignee[] = [{ name: 'Alice', avatar: '', userId: 'user-1' }];
    expect(isTaskAssignedToUser(assignees, realUser)).toBe(true);
  });

  it('returns false when there is no current user', () => {
    expect(
      isTaskAssignedToUser([{ name: 'Alice', avatar: '', userId: 'user-1' }], null),
    ).toBe(false);
  });

  it('returns false when no assignee matches', () => {
    const assignees: TaskAssignee[] = [{ name: 'Bob', avatar: '', userId: 'user-9' }];
    expect(isTaskAssignedToUser(assignees, realUser)).toBe(false);
  });
});
