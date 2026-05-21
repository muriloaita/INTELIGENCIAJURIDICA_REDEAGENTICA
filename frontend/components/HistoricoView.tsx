import React from 'react';
import { Icon } from './Icons';
import { WorkflowHistoryItem } from '../types';

interface HistoricoViewProps {
  historico: WorkflowHistoryItem[];
}

export const HistoricoView: React.FC<HistoricoViewProps> = ({ historico }) => {
  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Histórico de Fluxos de Trabalho</h2>
          <p className="text-gray-500 text-sm">Registro de todas as execuções da rede agêntica, concluídas ou pendentes.</p>
        </div>
      </div>

      {historico.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50">
          <Icon name="History" size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-gray-600">Nenhum histórico disponível.</p>
          <p className="text-sm mt-2">Os fluxos iniciados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">ID do Fluxo</th>
                  <th className="px-6 py-4 font-semibold">Data/Hora</th>
                  <th className="px-6 py-4 font-semibold">Demanda</th>
                  <th className="px-6 py-4 font-semibold">Autos</th>
                  <th className="px-6 py-4 font-semibold">Tipo de Petição</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-500">{item.id}</td>
                    <td className="px-6 py-4 text-gray-700">{item.data}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{item.demanda}</td>
                    <td className="px-6 py-4 font-mono text-gray-600">{item.autos}</td>
                    <td className="px-6 py-4 text-gray-700">{item.tipoPeticao}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border
                        ${item.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200' : 
                          item.status === 'Pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-700 border-red-200'}`}
                      >
                        {item.status === 'Pendente' && <Icon name="AlertTriangle" size={12} />}
                        {item.status === 'Concluído' && <Icon name="CheckCircle2" size={12} />}
                        {item.status === 'Cancelado' && <Icon name="XCircle" size={12} />}
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
