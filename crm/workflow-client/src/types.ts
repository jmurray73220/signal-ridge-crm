export type WorkflowRole = 'WorkflowAdmin' | 'WorkflowEditor' | 'WorkflowViewer';

export interface WorkflowUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  workflowRole: WorkflowRole | null;
  workflowClientId: string | null;
  mustChangePassword?: boolean;
}

export interface WorkflowClient {
  id: string;
  name: string;
  clientId: string | null;
  createdAt: string;
  _count?: { tracks: number; sows: number };
}

export type TrackStatus = 'Active' | 'OnHold' | 'Completed' | 'Archived';
export type PhaseStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Blocked';
export type MilestoneStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Blocked';
export type ActionItemStatus = 'Todo' | 'InProgress' | 'Done' | 'Blocked';
export type SOWStatus = 'Draft' | 'Active' | 'Archived';

export interface WorkflowActionItem {
  id: string;
  milestoneId: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: ActionItemStatus;
  assignedTo: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowMilestone {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: MilestoneStatus;
  completedAt: string | null;
  sortOrder: number;
  actionItems: WorkflowActionItem[];
}

export interface WorkflowPhase {
  id: string;
  trackId: string;
  title: string;
  description: string | null;
  budget: string | null;
  timeframe: string | null;
  status: PhaseStatus;
  sortOrder: number;
  milestones: WorkflowMilestone[];
}

export interface WorkflowTrack {
  id: string;
  workflowClientId: string;
  title: string;
  description: string | null;
  fundingVehicle: string | null;
  status: TrackStatus;
  sortOrder: number;
  phases: WorkflowPhase[];
}

export interface WorkflowComment {
  id: string;
  actionItemId: string | null;
  sowId: string | null;
  content: string;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface WorkflowSOW {
  id: string;
  workflowClientId: string;
  trackId: string | null;
  title: string;
  content: string;
  version: number;
  status: SOWStatus;
  createdAt: string;
  updatedAt: string;
  track?: { id: string; title: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  versions?: Array<{
    id: string;
    version: number;
    content: string;
    createdAt: string;
    createdBy?: { id: string; firstName: string; lastName: string } | null;
  }>;
  comments?: WorkflowComment[];
}
