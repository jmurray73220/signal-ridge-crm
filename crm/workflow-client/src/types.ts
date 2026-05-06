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

export interface PhaseAttachment {
  id: string;
  phaseId: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  uploadedByUserId: string | null;
  sizeBytes?: number;
}

export interface PhaseLink {
  id: string;
  phaseId: string;
  url: string;
  label: string | null;
  createdAt: string;
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
  attachments?: PhaseAttachment[];
  links?: PhaseLink[];
}

export interface FocusArea { name: string; summary?: string }
export interface PointOfContact { name?: string; role?: string; email?: string | null }
export interface AdditionalSection { heading: string; content: string }

export interface WorkflowTrack {
  id: string;
  workflowClientId: string;
  title: string;
  description: string | null;
  fundingVehicle: string | null;
  status: TrackStatus;
  sortOrder: number;
  isContractOpportunity?: boolean;
  opportunityUrl?: string | null;
  solicitationNumber?: string | null;
  vehicleType?: string | null;
  issuingAgency?: string | null;
  fundingAuthority?: string | null;
  questionsDueDate?: string | null;
  proposalDueDate?: string | null;
  periodOfPerformance?: string | null;
  fundingFloor?: string | null;
  fundingCeiling?: string | null;
  eligibility?: string | null;
  submissionFormat?: string | null;
  objective?: string | null;
  focusAreas?: FocusArea[];
  targetedFocusAreas?: string[];
  pointsOfContact?: PointOfContact[];
  additionalSections?: AdditionalSection[];
  aiExtractionStatus?: 'pending' | 'ok' | 'partial' | 'blocked' | 'failed' | null;
  aiExtractedAt?: string | null;
  phases: WorkflowPhase[];
  sow?: { id: string; title: string; status: SOWStatus; updatedAt: string } | null;
}

export interface WorkflowComment {
  id: string;
  actionItemId: string | null;
  sowId: string | null;
  content: string;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string; email: string } | null;
}

export type DifferentiationLayer = 'Layer1' | 'Layer2' | 'Layer3' | 'Layer4' | 'CrossLayer';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface WorkflowSOW {
  id: string;
  workflowClientId: string;
  title: string;
  targetFundingVehicle: string | null;
  targetAgency: string | null;
  periodOfPerformance: string | null;
  budget: string | null;
  differentiationLayer: DifferentiationLayer | null;
  trlStatement: string | null;
  scope: string;
  keyPersonnel: string;
  deliverables: string;      // JSON-encoded string[]
  draftingChecklist: string; // JSON-encoded ChecklistItem[]
  content: string;           // legacy freeform, kept for overlap detection on older SOWs
  version: number;
  status: SOWStatus;
  createdAt: string;
  updatedAt: string;
  trackId?: string | null;
  track?: { id: string; title: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
  versions?: Array<{
    id: string;
    version: number;
    content: string;
    snapshotJson: string;
    createdAt: string;
    createdBy?: { id: string; firstName: string; lastName: string } | null;
  }>;
  comments?: WorkflowComment[];
}

export interface IntegrateReport {
  sowTitle: string;
  trackTitle: string;
  items: Array<{ kind: 'ok' | 'warn' | 'suggest'; text: string }>;
}
