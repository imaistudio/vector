export interface KanbanAssignmentState {
  assignmentId: string;
  assigneeId: string | null;
  stateId: string | null;
  stateIcon: string | null;
  stateColor: string | null;
  stateName: string | null;
  stateType: string | null;
}

export interface KanbanWorkflowState {
  workflowStateId: string | null;
  workflowStateIcon: string | null;
  workflowStateColor: string | null;
  workflowStateName: string | null;
  workflowStateType: string | null;
}

export function getKanbanCardState(
  assignments: readonly KanbanAssignmentState[],
  workflowState: KanbanWorkflowState,
  currentUserId: string,
) {
  const viewerAssignment = currentUserId
    ? assignments.find(assignment => assignment.assigneeId === currentUserId)
    : undefined;
  const firstAssignedAssignment = assignments.find(
    assignment => assignment.assignmentId !== 'unassigned',
  );
  const selectedAssignment = viewerAssignment ?? firstAssignedAssignment;

  return {
    assignmentId: selectedAssignment?.assignmentId ?? null,
    stateId: selectedAssignment?.stateId ?? workflowState.workflowStateId,
    stateIcon: selectedAssignment?.stateIcon ?? workflowState.workflowStateIcon,
    stateColor:
      selectedAssignment?.stateColor ?? workflowState.workflowStateColor,
    stateName: selectedAssignment?.stateName ?? workflowState.workflowStateName,
    stateType: selectedAssignment?.stateType ?? workflowState.workflowStateType,
  };
}
