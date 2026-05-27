import React from 'react';
import { Icon } from './Icons';
import { WorkflowInstance, WorkflowHistoryItem } from '../types';

interface PrazosViewProps {
  onNovoPrazo: () => void;
  allWorkflows: WorkflowInstance[];
  historico: WorkflowHistoryItem[];
}

// Mapear fase numérica para nome do agente
const FASE_AGENTE: Record<number, string> = {
  1: 'A1 — Coletor',
  2: 'A2 — Pipeline',
  3: 'A3 — Conhecimento',
  4: 'A4 — Síntese',
  5: 'A5 — Steelman',
  6: 'A6 — Redação',
  7: 'A7 — Revisor',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'running':
      return { label: 'Em Processamento', classes: 'bg-brand-50 text-brand-700 border-brand-200', icon: 'Loader2', spin: true };
    case 'awaiting_input':
      return { label: 'Aguardando Resposta', classes: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'AlertTriangle', spin: false };
    case 'completed':
    case 'Concluído':
      return { label: 'Concluído', classes: 'bg-green-50 text-green-700 border-green-200', icon: 'CheckCircle2', spin: false };
    case 'error':
    case 'Erro':
      return { label: 'Erro', classes: 'bg-red-50 text-red-700 border-red-200', icon: 'XCircle', spin: false };
    case 'cancelled':
    case 'Cancelado':
      return { label: 'Cancelado', classes: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'XCircle', spin: false };
    default:
      return { label: status, classes: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'Clock', spin: false };
  }
}

export const PrazosView: React.FC<PrazosViewProps> = ({ onNovoPrazo, allWorkflows, historico }) => {
  // Combinar workflows ativos + histórico em uma lista unificada
  const activeItems = allWorkflows.map(wf => ({
    id: wf.id.substring(0, 8).toUpperCase(),
    demanda: wf.prazoData.demanda || '—',
    autos: wf.prazoData.autos || '—',
    tipo: wf.prazoData.tipoPeticao || '—',
    data: formatDate(wf.createdAt),
    status: wf.status,
    agente: wf.currentPhase ? FASE_AGENTE[wf.currentPhase] || `Fase ${wf.currentPhase}` : '—',
    isActive: true,
  }));

  const histItems = historico.map(h => ({
    id: h.id.substring(0, 8).toUpperCase(),
    demanda: h.demanda || '—',
    autos: h.autos || '—',
    tipo: h.tipoPeticao || '—',
    data: formatDate(h.data),
    status: h.status,
    agente: h.status === 'Concluído' ? 'A7 — Revisor ✓' : '—',
    isActive: false,
  }));

  const allItems = [...activeItems, ...histItems];

  // Stats
  const totalAtivos = allWorkflows.filter(w => w.status === 'running' || w.status === 'awaiting_input').length;
  const totalConcluidos = historico.filter(h => h.status === 'Concluído').length;
  const totalErros = historico.filter(h => h.status === 'Erro' || h.status === 'Cancelado').length;

  return (
    <div className="p-4 md:p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 md:gap-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Controle de Prazos</h2>
          <p className="text-sm md:text-base text-gray-500">Monitoramento de intimações e status de processamento na rede agêntica.</p>
        </div>
        <button 
          onClick={onNovoPrazo}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-all shadow-sm w-full md:w-auto"
        >
          <Icon name="Plus" size={18} />
          Cadastrar Prazo Manual
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Icon name="CalendarClock" size={24} /></div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{allItems.length}</div>
            <div className="text-sm text-gray-500">Total Registrados</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-lg"><Icon name="Cpu" size={24} /></div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalAtivos}</div>
            <div className="text-sm text-gray-500">Em Processamento (IA)</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Icon name="CheckCircle2" size={24} /></div>
          <div>
            <div className="text-2xl font-bold text-green-700">{totalConcluidos}</div>
            <div className="text-sm text-gray-500">Concluídos</div>
          </div>
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50">
          <Icon name="CalendarClock" size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-gray-600">Nenhum prazo registrado.</p>
          <p className="text-sm mt-2">Cadastre um prazo ou inicie um fluxo para começar.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-semibold">ID / Demanda</th>
                  <th className="px-6 py-4 font-semibold">Autos</th>
                  <th className="px-6 py-4 font-semibold">Tipo</th>
                  <th className="px-6 py-4 font-semibold">Data</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Agente Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allItems.map((item, idx) => {
                  const badge = getStatusBadge(item.status);
                  return (
                    <tr key={idx} className={`hover:bg-gray-50 transition-colors ${item.isActive ? 'bg-brand-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{item.demanda}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.id}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600 text-xs">{item.autos}</td>
                      <td className="px-6 py-4 text-gray-700 text-xs">{item.tipo}</td>
                      <td className="px-6 py-4 text-gray-700 text-xs">{item.data}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.classes}`}>
                          <Icon name={badge.icon as any} size={12} className={badge.spin ? 'animate-spin' : ''} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-700">
                          {item.agente}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
