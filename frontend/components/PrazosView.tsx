import React from 'react';
import { Icon } from './Icons';
import { PrazoFormData } from '../types';

interface PrazosViewProps {
  onNovoPrazo: () => void;
  activePrazo: PrazoFormData | null;
}

export const PrazosView: React.FC<PrazosViewProps> = ({ onNovoPrazo, activePrazo }) => {
  const prazos = [
    ...(activePrazo ? [{
      id: 'PRZ-001',
      demanda: activePrazo.demanda,
      autos: activePrazo.autos,
      dataFatal: '25/11/2023',
      status: 'Em Processamento',
      agente: 'A1 -> A6'
    }] : []),
    { id: 'PRZ-002', demanda: 'DEM-2023-089', autos: '0000456-12.2023.5.02.0001', dataFatal: '28/11/2023', status: 'Aguardando Coleta', agente: 'A1' },
    { id: 'PRZ-003', demanda: 'DEM-2023-090', autos: '1002345-98.2023.8.26.0100', dataFatal: '02/12/2023', status: 'Aguardando Coleta', agente: 'A1' },
  ];

  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Controle de Prazos</h2>
          <p className="text-gray-500 text-sm">Monitoramento de intimações e status de processamento na rede agêntica.</p>
        </div>
        <button 
          onClick={onNovoPrazo}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg transition-all shadow-sm"
        >
          <Icon name="Plus" size={18} />
          Cadastrar Prazo Manual
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Icon name="CalendarClock" size={24} /></div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{prazos.length}</div>
            <div className="text-sm text-gray-500">Prazos Ativos</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-lg"><Icon name="Cpu" size={24} /></div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{activePrazo ? '1' : '0'}</div>
            <div className="text-sm text-gray-500">Em Processamento (IA)</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg"><Icon name="AlertTriangle" size={24} /></div>
          <div>
            <div className="text-2xl font-bold text-gray-900">0</div>
            <div className="text-sm text-gray-500">Prazos Críticos (&lt; 48h)</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">ID / Demanda</th>
                <th className="px-6 py-4 font-semibold">Autos</th>
                <th className="px-6 py-4 font-semibold">Data Fatal</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Agente Atual</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prazos.map((prazo, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{prazo.demanda}</div>
                    <div className="text-xs text-gray-500">{prazo.id}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-600">{prazo.autos}</td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{prazo.dataFatal}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border
                      ${prazo.status === 'Em Processamento' ? 'bg-brand-50 text-brand-700 border-brand-200' : 
                        'bg-gray-100 text-gray-600 border-gray-200'}`}
                    >
                      {prazo.status === 'Em Processamento' && <Icon name="Loader2" size={12} className="animate-spin" />}
                      {prazo.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 text-gray-700">
                      {prazo.agente}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-gray-400 hover:text-brand-600 transition-colors" title="Ver Detalhes">
                      <Icon name="Eye" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
