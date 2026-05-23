import React, { useState } from 'react';
import { WorkflowInstance, QueueItem, CheckpointItem } from '../types';
import { Icon } from './Icons';

interface WorkflowPanelProps {
  workflows: WorkflowInstance[];
  queue: QueueItem[];
  queueLength: number;
  maxQueue: number;
  onRespondCheckpoint: (workflowId: string, responses: Record<string, string>) => void;
  onRemoveFromQueue: (queueId: string) => void;
  onDownloadDocx: (workflowId: string) => void;
  onViewPeticao: () => void;
}

const TOTAL_PHASES = 7;

// ── Sub-componente: Card de Workflow em Execução ─────────────────
const RunningCard: React.FC<{ workflow: WorkflowInstance }> = ({ workflow }) => {
  const completedCount = workflow.completedPhases.length;
  const progressPercent = Math.round((completedCount / TOTAL_PHASES) * 100);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="Loader2" size={18} className="animate-spin text-blue-600" />
        <span className="font-bold text-blue-800 text-sm truncate">
          {workflow.prazoData.tipoPeticao}
        </span>
      </div>
      <p className="text-xs text-blue-600 mb-1">
        Autos: <span className="font-semibold">{workflow.prazoData.autos}</span>
      </p>
      <p className="text-xs text-blue-600 mb-3">
        Fase: <span className="font-semibold">{workflow.currentPhase ?? '—'}/{TOTAL_PHASES}</span>
      </p>
      {/* Barra de progresso */}
      <div className="w-full bg-blue-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="text-xs text-blue-500 mt-1 text-right">{progressPercent}%</p>
    </div>
  );
};

// ── Sub-componente: Card Aguardando Informação ───────────────────
const AwaitingCard: React.FC<{
  workflow: WorkflowInstance;
  onRespond: (workflowId: string, responses: Record<string, string>) => void;
}> = ({ workflow, onRespond }) => {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const missingItems = workflow.checkpointData?.items.filter(
    (i: CheckpointItem) => i.status === 'AUSENTE' || i.status === 'INCOMPLETO'
  ) || [];

  const handleChange = (item: string, value: string) => {
    setResponses(prev => ({ ...prev, [item]: value }));
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="AlertTriangle" size={18} className="text-amber-600" />
        <span className="font-bold text-amber-800 text-sm truncate">
          {workflow.prazoData.tipoPeticao}
        </span>
      </div>
      <p className="text-xs text-amber-600 mb-1">
        Autos: <span className="font-semibold">{workflow.prazoData.autos}</span>
      </p>
      {workflow.checkpointData?.motivo && (
        <p className="text-xs text-amber-700 mb-3 italic">{workflow.checkpointData.motivo}</p>
      )}

      {/* Lista de itens faltantes */}
      <div className="space-y-2 mb-3">
        <p className="text-xs font-bold text-amber-800">Faltam:</p>
        {missingItems.map((item: CheckpointItem) => (
          <div key={item.item} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                item.status === 'AUSENTE' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              <span className="text-xs text-gray-700 font-medium">{item.item}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                item.status === 'AUSENTE' 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {item.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 ml-3">{item.mensagem}</p>
            <input
              type="text"
              placeholder={`Informar ${item.item.toLowerCase()}...`}
              value={responses[item.item] || ''}
              onChange={(e) => handleChange(item.item, e.target.value)}
              className="w-full text-xs border border-amber-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
        ))}
      </div>

      {/* Botões de ação */}
      <div className="flex gap-2">
        <button
          onClick={() => onRespond(workflow.id, responses)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <Icon name="ArrowRight" size={14} />
          Enviar e Continuar
        </button>
        <button
          onClick={() => onRespond(workflow.id, {})}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors"
        >
          Ignorar
        </button>
      </div>
    </div>
  );
};

// ── Sub-componente: Card de Workflow Concluído ────────────────────
const CompletedCard: React.FC<{
  workflow: WorkflowInstance;
  onDownload: (workflowId: string) => void;
  onView: () => void;
}> = ({ workflow, onDownload, onView }) => (
  <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      <Icon name="CheckCircle2" size={18} className="text-green-600" />
      <span className="font-bold text-green-800 text-sm truncate">
        {workflow.prazoData.tipoPeticao}
      </span>
    </div>
    <p className="text-xs text-green-600 mb-3">
      Autos: <span className="font-semibold">{workflow.prazoData.autos}</span>
    </p>
    <div className="flex gap-2">
      {workflow.docxUrl && (
        <button
          onClick={() => onDownload(workflow.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <Icon name="FileDown" size={14} />
          Download .docx
        </button>
      )}
      <button
        onClick={onView}
        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-green-200 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg transition-colors"
      >
        Ver Peça
      </button>
    </div>
  </div>
);

// ── Sub-componente: Estado vazio elegante ─────────────────────────
const EmptyState: React.FC<{ icon: string; message: string; color: string }> = ({ icon, message, color }) => (
  <div className={`flex flex-col items-center justify-center py-8 text-${color}-400`}>
    <Icon name={icon} size={32} className="opacity-40 mb-2" />
    <p className="text-xs text-gray-400 italic">{message}</p>
  </div>
);

// ── Componente Principal: WorkflowPanel ──────────────────────────
export const WorkflowPanel: React.FC<WorkflowPanelProps> = ({
  workflows,
  queue,
  queueLength,
  maxQueue,
  onRespondCheckpoint,
  onRemoveFromQueue,
  onDownloadDocx,
  onViewPeticao,
}) => {
  const running = workflows.filter(w => w.status === 'running');
  const awaiting = workflows.filter(w => w.status === 'awaiting_input');
  const completed = workflows.filter(w => w.status === 'completed');

  const hasAnyContent = running.length > 0 || awaiting.length > 0 || completed.length > 0 || queue.length > 0;

  if (!hasAnyContent) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header do painel */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <Icon name="LayoutDashboard" size={20} className="text-brand-600" />
          <h3 className="font-bold text-gray-900 text-lg">Painel de Processamento</h3>
        </div>
      </div>

      {/* Grid de seções: Em Execução | Aguardando | Prontas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
        {/* Coluna 1: Em Execução */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h4 className="text-sm font-bold text-gray-700">EM EXECUÇÃO</h4>
            <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {running.length}
            </span>
          </div>
          <div className="space-y-3">
            {running.length > 0 ? (
              running.map(wf => <RunningCard key={wf.id} workflow={wf} />)
            ) : (
              <EmptyState icon="Clock" message="Nenhum workflow em execução" color="blue" />
            )}
          </div>
        </div>

        {/* Coluna 2: Aguardando Informação */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="AlertTriangle" size={14} className="text-amber-500" />
            <h4 className="text-sm font-bold text-gray-700">AGUARDANDO INFORMAÇÃO</h4>
            <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {awaiting.length}
            </span>
          </div>
          <div className="space-y-3">
            {awaiting.length > 0 ? (
              awaiting.map(wf => (
                <AwaitingCard key={wf.id} workflow={wf} onRespond={onRespondCheckpoint} />
              ))
            ) : (
              <EmptyState icon="CheckCircle2" message="Nenhuma informação pendente" color="amber" />
            )}
          </div>
        </div>

        {/* Coluna 3: Prontas para Revisão */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="CheckCircle2" size={14} className="text-green-500" />
            <h4 className="text-sm font-bold text-gray-700">PRONTAS</h4>
            <span className="ml-auto bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {completed.length}
            </span>
          </div>
          <div className="space-y-3">
            {completed.length > 0 ? (
              completed.map(wf => (
                <CompletedCard
                  key={wf.id}
                  workflow={wf}
                  onDownload={onDownloadDocx}
                  onView={onViewPeticao}
                />
              ))
            ) : (
              <EmptyState icon="FileDown" message="Nenhuma peça concluída" color="green" />
            )}
          </div>
        </div>
      </div>

      {/* Seção: Fila de Espera */}
      {queue.length > 0 && (
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="Clock" size={16} className="text-gray-500" />
            <h4 className="text-sm font-bold text-gray-700">FILA DE ESPERA</h4>
            <span className="ml-2 text-xs text-gray-500 font-medium">
              {queueLength}/{maxQueue}
            </span>
          </div>
          <div className="space-y-2">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center">
                    {index + 1}.
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-gray-800">
                      {item.prazoData.tipoPeticao}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      — Autos {item.prazoData.autos}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveFromQueue(item.id)}
                  className="flex items-center gap-1 px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors text-xs font-medium"
                  title="Remover da fila"
                >
                  <Icon name="Trash2" size={14} />
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
