# Requirements Document

## Introduction

This feature is a structural refactoring of the React Kanban codebase. The work is driven by the audit captured in `REFACTORING_SPECIFICATION_REPORT.md`, which identifies issues across five categories: Component Bloat (the `src/App.tsx` God Component is 1534 lines), Naming Issues, Redundancy, Magic Values, and Single Responsibility Principle (SRP) violations.

The defining characteristic of this effort is that it is a **pure refactoring**: it changes the internal structure of the code (organization, naming, module boundaries, location of constants) without changing what the application does for an end user. Every externally observable behavior must remain identical, and the project must continue to compile and lint cleanly after every change.

Because the codebase has already undergone partial modularization (the `src/services/`, `src/hooks/`, and `src/utils/` directories already contain many focused modules), this refactoring targets the remaining concentrations of complexity and duplication rather than a greenfield restructure. The most significant gap is the absence of a `src/constants/` directory, which the audit repeatedly requires for centralizing magic values.

The project currently exposes two verification commands: `npm run build` (which runs `tsc -b && vite build`) and `npm run lint` (which runs `eslint .`). No automated test framework is configured. These two commands are therefore the objective gates for "the code still works structurally."

## Glossary

- **Codebase**: The TypeScript and React source under `src/` for the React Kanban application.
- **Refactoring_Effort**: The complete set of code changes defined by this specification, derived from `REFACTORING_SPECIFICATION_REPORT.md`.
- **Observable_Behavior**: Any application output or effect perceivable by an end user or external system, including rendered UI, user-interaction results, persisted data shape, localStorage contents, network/service payloads sent to Supabase, and toast messages.
- **Constants_Module**: The new directory `src/constants/` and its files, created to hold centralized constant values.
- **Magic_Value**: A literal string, number, or array embedded directly in component, hook, service, or utility code that carries domain meaning (for example `'HVAC Editor'`, `1000`, `3`, `'kanban_focus_tasks'`, `['High', 'Medium', 'Low', 'Lowest']`).
- **App_Component**: The component defined in `src/App.tsx`.
- **Custom_Hook**: A reusable React hook function (name prefixed with `use`) located under `src/hooks/`.
- **Task_Service**: The module `src/services/task.service.ts`.
- **Board_Service**: The module `src/services/board.service.ts`.
- **Board_Data_Mapper**: The module `src/utils/boardDataMapper.ts`.
- **Focus_Tasks_Hook**: The hook module `src/hooks/useFocusTasks.ts`.
- **Task_Dialog**: The component `src/components/organisms/dialog/TaskDialog.tsx`.
- **Kanban_Board**: The component `src/components/organisms/KanbanBoard.tsx`.
- **Task_Item**: The component `src/components/task/TaskItem.tsx`.
- **Mock_Data_Module**: The module `src/data.ts`.
- **Home_Dashboard**: The component `src/components/organisms/HomeDashboard.tsx`.
- **Pomodoro_Mode_Switch**: The component `src/components/focus/PomodoroModeSwitch.tsx`.
- **Build_Process**: The command `npm run build`, which executes `tsc -b && vite build`.
- **Lint_Process**: The command `npm run lint`, which executes `eslint .`.

## Requirements

### Requirement 1: Centralize magic values into a constants structure

**User Story:** As a developer maintaining the React Kanban codebase, I want all domain magic values centralized in a dedicated constants structure, so that shared values have a single source of truth and changing one value does not require edits scattered across many files.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL create a `src/constants/` directory as the Constants_Module.
2. THE Constants_Module SHALL define a `LIST_POSITION_STEP` constant with the value `1000`, replacing the inline `normalizedListPositionStep = 1000` literal in App_Component and the `index * 1000` literal in Board_Service.
3. THE Constants_Module SHALL define a `TASK_PRIORITIES` constant equal to `['High', 'Medium', 'Low', 'Lowest']`, replacing the inline priority arrays in Task_Dialog, Task_Item, and Board_Data_Mapper.
4. THE Constants_Module SHALL define a `DEFAULT_TASK_PRIORITY` constant with the value `'Low'`, replacing the inline `'Low'` priority defaults in Board_Data_Mapper and Task_Service.
5. THE Constants_Module SHALL define a `DEFAULT_TASK_CATEGORIES` constant containing `'Design'` and `'Sprint'`, replacing the inline `category1: 'Design'` and `category2: 'Sprint'` literals in Board_Data_Mapper.
6. THE Constants_Module SHALL define a `STORAGE_KEYS` constant containing `FOCUS_TASKS` set to `'kanban_focus_tasks'` and `ACTIVE_FOCUS_TASK` set to `'kanban_active_focus_task'`, replacing the inline storage-key literals in Focus_Tasks_Hook.
7. THE Constants_Module SHALL define a `MAX_FOCUS_TASKS` constant with the value `3`, replacing the inline `maxFocusTasks = 3` literal in Focus_Tasks_Hook.
8. THE Constants_Module SHALL define a focus-limit message constant equal to `'Focus Dock supports up to 3 active tasks.'`, replacing the four duplicated occurrences of that string in App_Component and the occurrence in Focus_Tasks_Hook.
9. THE Constants_Module SHALL define a `POMODORO_MODES` constant equal to `['focus', 'shortBreak', 'longBreak']`, replacing the inline `pomodoroModes` array in Pomodoro_Mode_Switch.
10. THE Constants_Module SHALL define a focus-button-labels constant containing `ACTIVE` set to `'Focused'` and `INACTIVE` set to `'Focus'`, replacing the inline `'Focused'`/`'Focus'` literals in Home_Dashboard.
11. THE Constants_Module SHALL define a `DEFAULT_BOARD_TITLE` constant equal to `'HVAC Editor'`, replacing the duplicated `'HVAC Editor'` literals in Board_Service, `src/services/home.service.ts`, and `src/services/today.service.ts`.
12. THE Constants_Module SHALL define the command-palette action configuration (identifiers, titles, descriptions, keywords) for the actions currently inlined in App_Component (including `'go-home'`, `'go-today'`, `'go-board'`, `'go-calendar'`, and `'quick-add-task'`).
13. THE Constants_Module SHALL define an invalid-template error message constant equal to `'Please choose a starter template.'`, replacing the inline error string thrown in Board_Service.
14. WHERE a Magic_Value defined in the Constants_Module is referenced by application code, THE Codebase SHALL import the value from the Constants_Module rather than redeclaring the literal inline.

### Requirement 2: Decompose the App.tsx God Component into focused custom hooks

**User Story:** As a developer, I want the responsibilities currently concentrated in `App.tsx` extracted into focused custom hooks, so that each concern is independently understandable and the top-level component is limited to view composition.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL extract board fetching, caching, and state-synchronization logic out of App_Component into a dedicated Custom_Hook.
2. THE Refactoring_Effort SHALL extract view-state and URL-history management logic out of App_Component into a dedicated Custom_Hook.
3. THE Refactoring_Effort SHALL extract task create, update, delete, and move logic out of App_Component into a dedicated Custom_Hook.
4. THE Refactoring_Effort SHALL extract the focus-task toggle and focus-task-input building logic currently duplicated across the `handleToggleFocusTask`, `handleToggleFocusTaskFromHome`, `handleToggleFocusTaskFromToday`, and `handleStartFocusTaskFromToday` handlers into a dedicated Custom_Hook.
5. THE Refactoring_Effort SHALL extract command-palette action construction out of App_Component into a dedicated Custom_Hook or module.
6. WHEN the decomposition is complete, THE App_Component SHALL contain fewer total lines than its current count of 1534 lines.
7. WHEN the decomposition is complete, THE App_Component SHALL retain responsibility for selecting and rendering the view that corresponds to the current authentication state and route.

### Requirement 3: Eliminate redundant payload-building and normalization logic

**User Story:** As a developer, I want duplicated payload-building and normalization logic consolidated, so that a single implementation governs each transformation and the risk of divergent behavior between near-identical functions is removed.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL consolidate the `buildChangedTaskPositionPayload` and `buildChangedListPositionPayload` logic in App_Component so that the shared payload-diffing behavior is expressed once.
2. THE Refactoring_Effort SHALL consolidate the `buildStableTaskInsertPayload` and `buildStableTaskUpdatePayload` default-application logic in Task_Service into a single normalization function used by both insert and update paths.
3. THE Refactoring_Effort SHALL consolidate the `buildTaskInsertPayload` and `buildTaskUpdatePayload` default-application logic in Board_Data_Mapper so that task defaults are applied through one shared function.
4. THE Refactoring_Effort SHALL remove the dead `void attachments;` statements from `buildTaskInsertPayload` and `buildTaskUpdatePayload` in Board_Data_Mapper.
5. THE Refactoring_Effort SHALL consolidate the duplicated localStorage read logic in `readStoredFocusTasks` and `readStoredActiveFocusTaskId` within Focus_Tasks_Hook into one shared read function.
6. THE Refactoring_Effort SHALL decompose the `buildBoardDataFromRows` function in Board_Data_Mapper so that checklist-map building, label-map building, and label-task-relationship building are expressed as separate functions orchestrated by `buildBoardDataFromRows`.
7. THE Refactoring_Effort SHALL decompose the `seedDefaultBoard` function in Board_Service so that list seeding, task seeding, and task-detail (checklist and label) seeding are expressed as separate functions orchestrated by `seedDefaultBoard`.
8. WHEN payload-building or normalization logic is consolidated, THE consolidated function SHALL produce payloads with the same field values and default-coalescing results as the original separate functions for equivalent inputs.
9. IF consolidation reveals that the original separate functions produced subtly different results for equivalent inputs, THEN THE Refactoring_Effort SHALL standardize on one consistent behavior and update the affected callers to reflect the unified behavior.

### Requirement 4: Consolidate dialog and form draft state

**User Story:** As a developer, I want the proliferation of individual dialog and draft state variables consolidated into structured state objects, so that related state is grouped, intent is clearer, and the count of independent state variables is reduced.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL consolidate the separate dialog open/close state variables in App_Component (`isModalOpen`, `isEditModalOpen`, `isGroupModalOpen`, `isCreateBoardModalOpen`, `isBoardActivityModalOpen`, `isWorkspaceMembersDialogOpen`) into a structured dialog-state representation with helper functions for opening and closing each dialog.
2. THE Refactoring_Effort SHALL consolidate the separate draft state variables in Task_Dialog (`labelDraft`, `labelColorDraft`, `attachmentNameDraft`, `attachmentUrlDraft`, `checklistDraft`) into a structured form-draft representation.
3. THE Refactoring_Effort SHALL consolidate the `initializeDialogState` and `resetTransientDialogState` reset routines in Task_Dialog into a single reset function that accepts a mode parameter distinguishing a full reset from a transient reset.
4. THE Refactoring_Effort SHALL consolidate the `handleAddLabel`, `handleAddAttachment`, and `handleAddChecklistItem` routines in Task_Dialog so that the shared trim/validate/create-id/append/clear-draft pattern is expressed once.
5. WHEN dialog or draft state is consolidated, THE affected component SHALL preserve the same Observable_Behavior for opening, closing, resetting, and submitting each dialog.

### Requirement 5: Reduce oversized prop interfaces

**User Story:** As a developer, I want large component prop interfaces grouped into cohesive objects, so that a component's dependencies are easier to read and its responsibilities are clearer.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL group the related callback and configuration props of the `KanbanBoardProps` interface in Kanban_Board (currently including `searchQuery`, `filterPriority`, `filterAssignee`, `filterDueDate`, `openMenuId`, `toggleMenu`, `handleEditTask`, `setDeleteItem`, `onOpenAddTask`, `onOpenAddGroup`, `onBoardDataChange`, `onUpdateTask`, `onToggleFocusTask`) into cohesive grouped objects such as filters, UI state, and handlers.
2. WHEN the prop interface of Kanban_Board is regrouped, THE App_Component SHALL pass the regrouped props to Kanban_Board so that the rendered board and its interactions exhibit the same Observable_Behavior as before.

### Requirement 6: Extract inline utility functions to shared utility modules

**User Story:** As a developer, I want general-purpose helper functions extracted out of components into shared utility modules, so that utilities are reusable, independently testable, and not coupled to a single component.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL extract the `createLocalId` helper from Task_Dialog into a shared utility module under `src/utils/`.
2. THE Refactoring_Effort SHALL extract the `formatFocusSessionDuration` helper from Task_Dialog into a shared utility module under `src/utils/`.
3. THE Refactoring_Effort SHALL extract a priority-color resolution helper for the priority indicator in Task_Item so that the inline color ternary is replaced by a reusable function.
4. THE Refactoring_Effort SHALL extract the activity-loading and focus-session-loading effect logic in Task_Dialog into a dedicated Custom_Hook.
5. WHEN a helper is extracted from a component, THE extracted helper SHALL return the same outputs for the same inputs as the original inline implementation.
6. IF an extracted helper produces different outputs from the original inline implementation for any input, THEN THE Refactoring_Effort SHALL treat the extraction as incomplete until the behavioral difference is corrected.

### Requirement 7: Improve naming clarity for vague identifiers

**User Story:** As a developer, I want vague or misleading identifiers renamed to describe their actual purpose, so that reading the code communicates intent without requiring inspection of the implementation.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL rename the `handleBoardDataChange` handler in App_Component to a name that identifies it as handling board position changes.
2. THE Refactoring_Effort SHALL rename the `resolveDestinationListId` function in Kanban_Board to a name that conveys that it finds and validates a destination list identifier.
3. THE Refactoring_Effort SHALL rename the `focusTasksWithLiveData` value in Focus_Tasks_Hook to a name that conveys it reflects current board state.
4. THE Refactoring_Effort SHALL replace the `renderAppHeader` function wrapper in App_Component with an inline conditional render or an equivalent component, removing the unnecessary function wrapper.
5. WHEN an identifier is renamed, THE Refactoring_Effort SHALL update every reference to that identifier so that no reference to the former name remains.
6. WHERE an identifier rename is applied, THE Refactoring_Effort SHALL complete the rename and all reference updates together as a single atomic change, so that the Codebase never contains a partially renamed identifier.

### Requirement 8: Preserve application behavior throughout the refactoring

**User Story:** As a user of the React Kanban application, I want the application to behave exactly as it did before the refactoring, so that the internal restructuring does not change, break, or remove any functionality I rely on.

#### Acceptance Criteria

1. THE Refactoring_Effort SHALL preserve the Observable_Behavior of the application for every user interaction that existed before the Refactoring_Effort.
2. THE Refactoring_Effort SHALL preserve the shape and field values of every data payload sent to Supabase services for equivalent user actions.
3. THE Refactoring_Effort SHALL preserve the localStorage keys and stored value shapes used for focus tasks, the active focus task, and the board cache.
4. THE Refactoring_Effort SHALL preserve the existing routing behavior, mapping each URL path to the same view as before the Refactoring_Effort.
5. IF a proposed change would alter any Observable_Behavior, THEN THE Refactoring_Effort SHALL exclude that change from scope.
6. THE Refactoring_Effort SHALL limit each change to restructuring, renaming, relocating, or de-duplicating code without adding new end-user features.

### Requirement 9: Maintain build and lint integrity after each change

**User Story:** As a developer, I want the build and lint checks to pass after every refactoring change, so that the codebase remains releasable at all times and regressions are caught immediately.

#### Acceptance Criteria

1. WHEN a refactoring change is completed, THE Build_Process SHALL complete without errors.
2. WHEN a refactoring change is completed, THE Lint_Process SHALL complete without new errors or new warnings relative to the pre-refactoring baseline.
3. IF the Build_Process reports an error after a change, THEN THE Refactoring_Effort SHALL resolve the error before the change is considered complete.
4. IF the Lint_Process reports a new error or new warning after a change, THEN THE Refactoring_Effort SHALL resolve the finding before the change is considered complete.
5. THE Refactoring_Effort SHALL treat a change as complete only when both the Build_Process and the Lint_Process pass for that change.
6. WHERE a module is relocated, THE Refactoring_Effort SHALL update all known references to that module within the Codebase as part of the same change, even when this changes the module's import path.

### Requirement 10: Final verification checklist

**User Story:** As a developer completing the refactoring, I want an explicit, enumerated final-verification checklist executed when the work is declared done, so that I have objective confirmation that the structural goals were met and no observable behavior regressed.

Because this project has NO automated test framework configured, the behavioral checks (criteria 5 through 11 below) SHALL be verified through a combination of `npm run build` success, `npm run lint` success, code review of the preserved logic, and explicit manual reasoning about behavioral equivalence. These criteria SHALL NOT be satisfied by inventing a new test suite; the implementation plan SHALL instead schedule a careful review-based verification for each.

#### Acceptance Criteria

1. WHEN the Refactoring_Effort is declared done, THE Build_Process (`npm run build`) SHALL complete without errors.
2. WHEN the Refactoring_Effort is declared done, THE Lint_Process (`npm run lint`) SHALL complete without errors or warnings.
3. WHEN the Refactoring_Effort is declared done, THE App_Component (`src/App.tsx`) SHALL contain fewer lines than its pre-refactoring count of 1534 lines.
4. WHEN the Refactoring_Effort is declared done, THE Constants_Module (`src/constants/`) SHALL exist and SHALL centralize every Magic_Value enumerated in Requirement 1.
5. WHEN the Refactoring_Effort is declared done, THE Refactoring_Effort SHALL preserve every Supabase payload shape, sending no changed fields or values to Supabase for equivalent actions, AND this preservation SHALL be verified by code review of the preserved logic and manual reasoning about behavioral equivalence rather than by automated tests.
6. WHEN the Refactoring_Effort is declared done, THE Refactoring_Effort SHALL preserve the localStorage keys and value shapes for focus tasks, the active focus task, and the board cache, AND this preservation SHALL be verified by code review and manual reasoning rather than by automated tests.
7. WHEN the Refactoring_Effort is declared done, THE Refactoring_Effort SHALL preserve the routing behavior such that each URL path maps to the same view as before, AND this preservation SHALL be verified by code review and manual reasoning rather than by automated tests.
8. WHEN the Refactoring_Effort is declared done, THE Refactoring_Effort SHALL preserve Kanban list and task drag-and-drop behavior (list reordering, task reordering, and task moving between lists), AND this preservation SHALL be verified by code review and manual reasoning rather than by automated tests.
9. WHEN the Refactoring_Effort is declared done, THE Refactoring_Effort SHALL preserve task CRUD behavior (create, edit/update, delete, and move), AND this preservation SHALL be verified by code review and manual reasoning rather than by automated tests.
10. WHEN the Refactoring_Effort is declared done, THE Refactoring_Effort SHALL preserve the behavior of the Focus Dock, the Pomodoro timer, and the Floating Timer (document picture-in-picture), AND this preservation SHALL be verified by code review and manual reasoning rather than by automated tests.
11. WHEN the Refactoring_Effort is declared done, THE Refactoring_Effort SHALL preserve authentication, workspace switching, workspace member management, and invite flows, AND this preservation SHALL be verified by code review and manual reasoning rather than by automated tests.
12. WHEN the Refactoring_Effort is declared done, THE Codebase SHALL contain no references to any old renamed identifier (including `handleBoardDataChange`, `resolveDestinationListId`, `focusTasksWithLiveData`, `renderAppHeader`, and every other identifier renamed by the Refactoring_Effort), as confirmed by a workspace-wide search.
13. WHEN the Refactoring_Effort is declared done, THE Codebase SHALL contain no inline duplicate of a constant that Requirement 1 requires to be centralized, as confirmed by a search verifying that literals such as `'HVAC Editor'`, `1000`, `3`, `'kanban_focus_tasks'`, the priority array, the focus-limit message, the Pomodoro modes array, and the focus-button labels are imported from the Constants_Module rather than redeclared inline.
