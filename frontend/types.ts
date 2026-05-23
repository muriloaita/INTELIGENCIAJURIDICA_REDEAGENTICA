export interface Agent {
  id: string;
  name: string;
  role: string;
}

export interface Feature {
  name: string;
  description: string;
}

export interface WorkflowStage {
  id: number;
  title: string;
  shortTitle: string;
  description: string;
  agents: string[]; // Array of Agent IDs
  features: Feature[];
  iconName: string;
}

export type SimulationStatus = 'idle' | 'running' | 'completed' | 'pendente' | 'awaiting_input';

export interface PrazoFormData {
  demanda: string;
  autos: string;
  tipoPeticao: string;
  observacao: string;
  arquivos: File[];
}

export interface PhaseResults {
  [key: number]: string;
}

export type AppView = 'overview' | 'templates' | 'prazos' | 'prontas' | 'protocolo' | 'config' | 'historico' | 'knowledge';

export interface KnowledgeDocument {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  fonte: string;
  documento_origem: string;
  chunk_index: number;
  total_chunks: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface KnowledgeStats {
  totalDocumentos: number;
  totalChunks: number;
  porCategoria: Record<string, number>;
}

export interface WorkflowEvent {
  type: 'phase_start' | 'phase_complete' | 'workflow_complete' | 'docx_ready' | 'checkpoint_required' | 'checkpoint_resolved' | 'error';
  phaseId?: number;
  name?: string;
  result?: string;
  tokensInput?: number;
  tokensOutput?: number;
  executionTime?: number;
  workflowId?: string;
  error?: string;
  downloadUrl?: string;
  filename?: string;
  checkpointData?: CheckpointData;
}

export interface SearchResult {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  documento_origem: string;
  similarity: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  instructions: string;
  category: string;
  lastUpdated: string;
}

export interface TemplateFormData {
  name: string;
  category: string;
  description: string;
  instructions: string;
  file: File | null;
}

export interface PeticaoPronta extends PrazoFormData {
  id: string;
  status: 'Aguardando Revisão' | 'Aprovada' | 'Aguardando Protocolo' | 'Protocolada';
  dataConclusao: string;
  tipoPeca: string;
  docxUrl?: string;
}

export interface AgentConfig {
  mcpConfig: string;
  ragConfig: string;
  customInstructions: string;
  cotConfig?: string;
  driveLink?: string;
}

export interface WorkflowHistoryItem {
  id: string;
  data: string;
  demanda: string;
  autos: string;
  tipoPeticao: string;
  status: 'Concluído' | 'Pendente' | 'Cancelado';
}

// ── Tipos para Checkpoint Humano e Multi-Workflow ─────────────────

export interface CheckpointItem {
  item: string;
  status: 'OK' | 'AUSENTE' | 'INCOMPLETO';
  mensagem: string;
}

export interface CheckpointData {
  items: CheckpointItem[];
  pode_prosseguir: boolean;
  motivo: string;
}

export interface WorkflowInstance {
  id: string;
  status: 'running' | 'awaiting_input' | 'completed' | 'error' | 'cancelled';
  prazoData: {
    demanda: string;
    autos: string;
    tipoPeticao: string;
    observacao: string;
  };
  currentPhase: number | null;
  completedPhases: number[];
  checkpointData: CheckpointData | null;
  docxUrl: string | null;
  createdAt: string;
}

export interface QueueItem {
  id: string;
  prazoData: {
    demanda: string;
    autos: string;
    tipoPeticao: string;
    observacao: string;
  };
  createdAt: string;
}

export interface WorkflowStatusResponse {
  workflows: WorkflowInstance[];
  queue: QueueItem[];
  queueLength: number;
  maxQueue: number;
  canEnqueue: boolean;
  processing: string | null;
}
