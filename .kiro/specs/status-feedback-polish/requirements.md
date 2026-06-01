# Requirements Document

## Introduction

This feature, "Status & Feedback improvements", is a UI and product polish phase for the existing React + TypeScript + Vite + Supabase Kanban application. The goal is to raise perceived quality through better loading, error, empty, and confirmation feedback WITHOUT adding major new product features and WITHOUT altering existing data, auth, or behavior.

The phase delivers four polish areas plus two cross-cutting concerns:

1. Reusable skeleton loaders for key pages.
2. An Undo affordance for task deletion, built on the existing soft-delete mechanism (`deleted_at`).
3. Improved low-risk error states (authentication, workspace, board, Today, members).
4. Improved low-risk empty states (no tasks, no focus sessions, no boards, no members/invites, no search results).
5. Accessibility for the new feedback surfaces (screen reader behavior, `aria-busy`, `aria-live`, keyboard-operable Undo).
6. A control-consistency contract applied to every new or touched clickable control.

This work builds on existing primitives: `EmptyState` (`src/components/atoms/EmptyState.tsx`), `PageHeader` (`src/components/atoms/PageHeader.tsx`), `Button`/`ButtonIcon` (which already encode the cursor/hover/focus/disabled contract), the global `prefers-reduced-motion` rule in `src/index.css`, and the `react-toastify` `ToastContainer` mounted in `App.tsx`.

Soft-delete context (verified): tasks are soft-deleted by `deleteTask` setting `deleted_at` to a timestamp (`src/services/task.service.ts`), and `updateTask` already accepts `deleted_at` in its normalized update payload, so restoring a task by setting `deleted_at` back to `null` is feasible without schema changes. Lists use `archived_at`, and `deleteTasksByListId` soft-deletes the list's tasks; list-level undo is riskier (it must restore both the list and its tasks consistently) and is therefore explicitly deferred in this phase. Task deletion undo is the only undo delivered here.

## Glossary

- **Application**: The React + TypeScript + Vite + Supabase Kanban single-page application as a whole.
- **Skeleton_System**: The set of reusable placeholder components (`Skeleton`, `SkeletonCard`, `SkeletonTaskCard`, `SkeletonBoardColumn`, and optionally `SkeletonPageHeader`) that render layout-preserving loading placeholders.
- **Loading_Container**: A region of the UI that wraps content while its data is being fetched and that displays Skeleton_System placeholders during that fetch.
- **Undo_System**: The toast-based affordance that lets a user reverse a completed task deletion.
- **Task_Restore_Service**: The service operation that restores a soft-deleted task by setting its `deleted_at` value to `null`.
- **Delete_Confirmation_Dialog**: The existing `DeleteDialog` that asks the user to confirm a deletion before it is performed.
- **Error_State**: A UI surface shown when a data fetch or operation fails, presenting a message and, where useful, a Retry control.
- **Empty_State**: A UI surface shown when a data fetch succeeds but returns no items, presenting a title, a helpful sentence, and an optional primary action.
- **Retry_Control**: A button inside an Error_State that re-attempts the failed fetch or operation.
- **Dev_Mode**: The build/runtime mode where `import.meta.env.DEV` is `true`.
- **Reduced_Motion**: The state in which the operating system or browser reports `prefers-reduced-motion: reduce`.
- **Clickable_Control**: Any interactive element a user can activate (button, icon button, link-styled action, or role="button" element).
- **Prefers_Reduced_Motion_Setting**: The OS/browser accessibility setting reported through the `prefers-reduced-motion` media query.

## Requirements

### Requirement 1: Reusable skeleton loader components

**User Story:** As a developer, I want a small set of reusable skeleton components, so that loading placeholders stay visually consistent and easy to reuse across pages.

#### Acceptance Criteria

1. THE Skeleton_System SHALL provide a base `Skeleton` component, a `SkeletonCard` component, a `SkeletonTaskCard` component, and a `SkeletonBoardColumn` component.
2. WHERE a page header placeholder is needed, THE Skeleton_System SHALL provide a `SkeletonPageHeader` component.
3. IF a `SkeletonPageHeader` component is not available where a page header placeholder is needed, THEN THE Skeleton_System SHALL render a generic `Skeleton` placeholder as a fallback.
4. THE Skeleton_System SHALL render placeholders using only slate-based colors from the existing design tokens, without introducing additional color hues.
5. THE Skeleton_System SHALL size each placeholder within 4 CSS pixels of both the width and the height of the content it replaces, such that the cumulative layout shift contribution when real content loads does not exceed 0.1.
6. WHILE Reduced_Motion is active, THE Skeleton_System SHALL render placeholders without shimmer or pulse animation.
7. WHILE Reduced_Motion is inactive, THE Skeleton_System SHALL render placeholders with exactly one looping animation effect whose cycle duration is between 1 and 2 seconds.

### Requirement 2: Skeleton loaders during page loading

**User Story:** As a user, I want to see structured placeholders while a page loads, so that the application feels responsive and the layout stays stable.

#### Acceptance Criteria

1. WHILE the Home dashboard is loading its data, THE Application SHALL display Skeleton_System placeholders in place of the dashboard content.
2. WHILE the Today page is loading its data, THE Application SHALL display Skeleton_System placeholders in place of the Today content.
3. WHILE the Board page is performing its initial load, THE Application SHALL display Skeleton_System placeholders in place of the board columns.
4. WHILE the task detail drawer is fetching its data, THE Application SHALL display Skeleton_System placeholders in place of the drawer content.
5. WHILE the members panel is fetching its data, THE Application SHALL display Skeleton_System placeholders in place of the members content.
6. WHEN a data fetch for a Loading_Container completes successfully and returns at least one item, THE Application SHALL replace the Skeleton_System placeholders with the loaded content.
7. WHILE a data fetch for a Loading_Container is in progress and has not failed, THE Application SHALL continue to display the Skeleton_System placeholders and SHALL withhold the loaded content.
8. WHEN a data fetch for a Loading_Container completes successfully and returns zero items, THE Application SHALL replace the Skeleton_System placeholders with the appropriate Empty_State.
9. IF a data fetch for a Loading_Container fails, THEN THE Application SHALL stop displaying the Skeleton_System placeholders and SHALL display the appropriate Error_State.

### Requirement 3: Undo toast for task deletion

**User Story:** As a user, I want to undo a task deletion right after it happens, so that I can recover from an accidental delete without losing my work.

#### Acceptance Criteria

1. WHEN the user initiates a task deletion, THE Application SHALL display the existing Delete_Confirmation_Dialog and SHALL NOT remove the task until the user confirms the deletion.
2. WHEN a task deletion is confirmed and the delete operation succeeds, THE Undo_System SHALL display a toast containing the text "Task deleted" and an "Undo" action.
3. WHEN the user activates the "Undo" action, THE Task_Restore_Service SHALL restore the deleted task to its non-deleted state.
4. WHEN a task restore succeeds, THE Application SHALL display the restored task in the board view at its prior list and prior position.
5. IF the restore operation fails, THEN THE Application SHALL display an error message indicating that the restore did not complete AND SHALL keep the task in its deleted state.
6. WHEN the toast appears, THE Undo_System SHALL keep the "Undo" action available for 5 seconds and SHALL dismiss the toast when 5 seconds elapse without the user activating "Undo".
7. WHEN the "Undo" action has keyboard focus and the user triggers it with Enter or Space, THE Undo_System SHALL activate the "Undo" action.
8. IF a confirmed task deletion fails, THEN THE Application SHALL display an error message indicating that the deletion did not complete AND SHALL keep the task in its non-deleted state.
9. IF the 5-second window elapses without the user activating "Undo", THEN THE Application SHALL keep the task in its deleted state.

### Requirement 4: Task restore service

**User Story:** As a developer, I want a dedicated restore operation, so that the Undo action reverses a soft delete without changing the backend schema.

#### Acceptance Criteria

1. WHEN the Task_Restore_Service is invoked with a task identifier, THE Task_Restore_Service SHALL set the `deleted_at` value of the task matching that identifier to `null`.
2. THE Task_Restore_Service SHALL use the existing task update path, extending that path to accept a `deleted_at` value of `null` while leaving the database schema unchanged.
3. WHEN the Task_Restore_Service completes the restore against a configured Supabase client, THE Task_Restore_Service SHALL return the updated task whose `deleted_at` value is `null`.
4. IF the existing task update path reports an error while restoring the task, THEN THE Task_Restore_Service SHALL surface that error to the caller and leave the stored `deleted_at` value of the task unchanged.
5. IF the Task_Restore_Service is invoked while the application runs without a configured Supabase client, THEN THE Task_Restore_Service SHALL return a task representation whose `deleted_at` value is `null` without raising an error.

### Requirement 5: Deferred undo scope

**User Story:** As a maintainer, I want undo limited to the case that is safe today, so that I avoid inconsistent restores for higher-risk entities.

#### Acceptance Criteria

1. THE Undo_System SHALL provide an undo affordance for task deletions only and SHALL NOT present an undo affordance for the deletion of any other entity type, including lists.
2. WHEN a list is deleted, THE Application SHALL complete the deletion using the existing deletion flow and SHALL NOT present an undo affordance for the list deletion.
3. THE requirements document SHALL record list-deletion undo as deferred together with the reason that restoring a list and its soft-deleted child tasks consistently is higher risk.
4. WHEN a task is deleted, THE Undo_System SHALL present an undo affordance that remains available for 5 seconds after the deletion.
5. WHEN the user activates the undo affordance within the 5-second window, THE Undo_System SHALL restore the deleted task to its pre-deletion position and state.
6. IF the 5-second undo window elapses without the undo affordance being activated, THEN THE Undo_System SHALL remove the undo affordance and finalize the task deletion.

### Requirement 6: Improved error states

**User Story:** As a user, I want clear and actionable error states, so that I understand what went wrong and can retry when it makes sense.

#### Acceptance Criteria

1. IF a request for authentication data returns an error or does not complete successfully, THEN THE Application SHALL display an Error_State containing a human-readable message that identifies the failure as an authentication data load failure.
2. IF a request for workspace data returns an error or does not complete successfully, THEN THE Application SHALL display an Error_State containing a human-readable message that identifies the failure as a workspace data load failure and a Retry_Control.
3. IF a request for board data returns an error or does not complete successfully, THEN THE Application SHALL display an Error_State containing a human-readable message that identifies the failure as a board data load failure and a Retry_Control.
4. IF a request for Today data returns an error or does not complete successfully, THEN THE Application SHALL display an Error_State containing a human-readable message that identifies the failure as a Today data load failure and a Retry_Control.
5. IF a request for members data returns an error or does not complete successfully, THEN THE Application SHALL display an Error_State containing a human-readable message that identifies the failure as a members data load failure and a Retry_Control.
6. WHEN the user activates a Retry_Control via pointer click or keyboard, THE Application SHALL re-attempt the data fetch that previously failed.
7. THE Retry_Control SHALL present a `cursor-pointer` cursor on pointer hover and a visible `focus-visible` indicator when focused via keyboard.
8. WHERE Dev_Mode is inactive, THE Application SHALL exclude raw technical error details from the Error_State.
9. WHERE Dev_Mode is active, THE Application SHALL include raw technical error details within the Error_State for diagnosis.
10. WHILE a Retry_Control re-attempt is in progress, THE Application SHALL display an in-progress indicator on the Error_State.
11. WHEN a Retry_Control re-attempt succeeds, THE Application SHALL replace the Error_State with the successfully loaded content.
12. IF a Retry_Control re-attempt also fails, THEN THE Application SHALL re-display the Error_State with its message and Retry_Control so the user can retry again.

### Requirement 7: Improved empty states

**User Story:** As a user, I want helpful empty states, so that I know what a section is for and what to do next when it has no content.

#### Acceptance Criteria

1. WHEN a fetch for the task list succeeds and returns zero tasks, THE Application SHALL display an Empty_State containing a title of at most 50 characters and exactly one sentence of at most 120 characters that states the section's purpose or the next step.
2. WHEN a fetch for focus sessions succeeds and returns zero sessions, THE Application SHALL display an Empty_State containing a title of at most 50 characters and exactly one sentence of at most 120 characters that states the section's purpose or the next step.
3. WHEN a fetch for the workspace boards succeeds and returns zero boards, THE Application SHALL display an Empty_State containing a title of at most 50 characters, exactly one sentence of at most 120 characters, and exactly one primary action labeled to create a board.
4. WHEN a fetch for workspace members and invites succeeds and returns zero members and zero invites, THE Application SHALL display an Empty_State containing a title of at most 50 characters and exactly one sentence of at most 120 characters that states the section's purpose or the next step.
5. WHEN a search request succeeds and returns zero results, THE Application SHALL display an Empty_State containing a title of at most 50 characters and exactly one sentence of at most 120 characters that states the section's purpose or the next step.
6. WHERE an Empty_State is configured with a primary action, THE Application SHALL render exactly one primary action that is visually distinct from any secondary actions.
7. WHERE an Empty_State is configured with more than one action, THE Application SHALL render at most 3 actions with exactly one designated as the primary action and the remaining actions rendered as secondary actions.
8. WHILE a fetch for a section is in progress, THE Application SHALL NOT display that section's Empty_State.
9. IF a fetch for a section fails, THEN THE Application SHALL NOT display that section's Empty_State.

### Requirement 8: Accessibility for feedback surfaces

**User Story:** As a user who relies on assistive technology, I want loading and status feedback to be announced correctly, so that I can perceive state changes without visual cues.

#### Acceptance Criteria

1. THE Skeleton_System SHALL apply `aria-hidden="true"` to its placeholder elements so that screen readers do not announce them as meaningful content.
2. WHILE a Loading_Container is fetching data, THE Application SHALL maintain `aria-busy="true"` on that Loading_Container for the full duration of the fetch.
3. WHEN a Loading_Container finishes fetching data successfully, THE Application SHALL set `aria-busy="false"` on that Loading_Container.
4. WHERE the toast system supports live-region announcements, THE Undo_System SHALL convey the "Task deleted" status as text content within an `aria-live="polite"` region.
5. THE Undo_System SHALL expose the "Undo" action as a control that is included in the document tab order and activatable with Enter or Space.
6. IF a Loading_Container's data fetch fails, THEN THE Application SHALL set `aria-busy="false"` on that Loading_Container.

### Requirement 9: Clickable control consistency

**User Story:** As a user, I want every interactive control to be discoverable and operable, so that the interface feels predictable whether I use a mouse or keyboard.

#### Acceptance Criteria

1. WHILE a Clickable_Control introduced or modified in this phase is enabled, THE Application SHALL apply the `cursor-pointer` style so that the pointer cursor is displayed when the user hovers over that control.
2. WHEN a Clickable_Control introduced or modified in this phase is hovered by the pointer, THE Application SHALL change at least one visual property (such as background color, border, text color, or outline) relative to the control's resting appearance.
3. WHILE a Clickable_Control introduced or modified in this phase is disabled, THE Application SHALL apply the `cursor-not-allowed` style and reduce the control's opacity to no more than 60% (opacity ≤ 0.6) of its enabled appearance.
4. THE Application SHALL implement each Clickable_Control that performs an in-page action rather than navigation as a `<button>` element, including any such control within a surface modified in this phase that currently exists as a styled `div` or `span`.
5. WHERE a Clickable_Control introduced or modified in this phase performs navigation to a different route or URL rather than an in-page action, THE Application SHALL implement that control as an anchor (`<a>`) element with a resolvable destination.
6. WHERE a Clickable_Control introduced or modified in this phase presents only an icon with no accompanying visible text label, THE Application SHALL provide a non-empty `aria-label` that describes the control's action.
7. WHEN a Clickable_Control introduced or modified in this phase receives keyboard focus, THE Application SHALL display a `focus-visible` indicator that changes at least one visual property relative to the control's resting appearance.
8. WHILE a Clickable_Control introduced or modified in this phase is disabled, IF the user activates that control by pointer or keyboard, THEN THE Application SHALL not perform the control's action.

### Requirement 10: Preservation of existing behavior

**User Story:** As a maintainer, I want this polish phase to change only presentation and feedback, so that established data, security, and interaction behavior remain intact.

#### Acceptance Criteria

1. THE Application SHALL keep the Supabase database schema identical to the baseline captured at the start of the status-feedback-polish phase.
2. THE Application SHALL keep the authentication architecture, the row-level security policies, and the workspace, members, and invite flows identical to the baseline captured at the start of the status-feedback-polish phase.
3. THE Application SHALL keep the Kanban create, read, update, and delete semantics, the drag-and-drop behavior, and the realtime synchronization behavior identical to the baseline captured at the start of the status-feedback-polish phase.
4. THE Application SHALL keep the Focus Dock and Pomodoro state behavior identical to the baseline captured at the start of the status-feedback-polish phase.
5. THE Application SHALL keep the existing `localStorage` keys and value shapes identical to the baseline captured at the start of the status-feedback-polish phase.
6. WHEN the user navigates to a given URL path, THE Application SHALL display the same view that the baseline captured at the start of the status-feedback-polish phase displays for that path.
7. THE Application SHALL keep the task data payload shape (its field names, value types, and nesting structure) identical to the baseline captured at the start of the status-feedback-polish phase.
8. WHEN the `npm run build` command runs after this phase, THE Application SHALL complete the build with a success exit status and with no errors that were absent from the baseline.
9. WHEN the `npm run lint` command runs after this phase, THE Application SHALL complete the lint with a success exit status and with no errors that were absent from the baseline.
10. THE polish phase SHALL be considered complete only after `npm run build` and `npm run lint` have each run and returned a success exit status with no errors that were absent from the baseline.
11. IF a proposed change would alter any behavior preserved by criteria 1 through 7, THEN THE change SHALL be excluded from the status-feedback-polish phase.
