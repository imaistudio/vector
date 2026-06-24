import { describe, expect, it } from 'vitest';

import { getKanbanCardState } from './issues-kanban-state';

describe('getKanbanCardState', () => {
  it('uses the current user assignment for both column state and display state', () => {
    const cardState = getKanbanCardState(
      [
        {
          assignmentId: 'assignment-done',
          assigneeId: 'first-user',
          stateId: 'done-state',
          stateIcon: 'Check',
          stateColor: '#22c55e',
          stateName: 'Done',
          stateType: 'done',
        },
        {
          assignmentId: 'assignment-current',
          assigneeId: 'current-user',
          stateId: 'in-progress-state',
          stateIcon: 'Circle',
          stateColor: '#3b82f6',
          stateName: 'In Progress',
          stateType: 'started',
        },
      ],
      {
        workflowStateId: 'done-state',
        workflowStateIcon: 'Check',
        workflowStateColor: '#22c55e',
        workflowStateName: 'Done',
        workflowStateType: 'done',
      },
      'current-user',
    );

    expect(cardState).toMatchObject({
      assignmentId: 'assignment-current',
      stateId: 'in-progress-state',
      stateName: 'In Progress',
      stateType: 'started',
    });
  });

  it('falls back to workflow state when there is no real assignment state', () => {
    const cardState = getKanbanCardState(
      [
        {
          assignmentId: 'unassigned',
          assigneeId: null,
          stateId: null,
          stateIcon: null,
          stateColor: null,
          stateName: null,
          stateType: null,
        },
      ],
      {
        workflowStateId: 'todo-state',
        workflowStateIcon: 'Circle',
        workflowStateColor: '#94a3b8',
        workflowStateName: 'Todo',
        workflowStateType: 'backlog',
      },
      'current-user',
    );

    expect(cardState).toMatchObject({
      assignmentId: null,
      stateId: 'todo-state',
      stateName: 'Todo',
      stateType: 'backlog',
    });
  });
});
