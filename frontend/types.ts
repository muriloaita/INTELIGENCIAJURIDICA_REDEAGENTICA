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

export type SimulationStatus = 'idle' | 'running' | 'completed' | 'pendente';

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
  type: 'phase_start' | 'phase_complete' | 'workflow_complete' | 'error';
  phaseId?: number;
  name?: string;
  result?: string;
  tokensInput?: number;
  tokensOutput?: number;
  executionTime?: number;
  workflowId?: string;
  error?: string;
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
