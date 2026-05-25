import React from 'react';
import { Icon } from './Icons';
import { PeticaoPronta } from '../types';

interface ProntasViewProps {
  peticoes: PeticaoPronta[];
  onRevisar: (id: string) => void;
  onBaixar: (id: string) => void;
  onProtocolar: (id: string) => void;
}

export const ProntasView: React.FC<ProntasViewProps> = ({ peticoes, onRevisar, onBaixar, onProtocolar }) => {
  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Petições Prontas (Fase 8)</h2>
          <p className="text-gray-500 text-sm">Módulo de revisão humana, aprovação e envio para protocolo.</p>
        </div>
      </div>

      {peticoes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50">
          <Icon name="FolderOpen" size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-gray-600">Nenhuma petição pronta no momento.</p>
          <p className="text-sm mt-2">Inicie um fluxo de processamento para gerar novas peças.</p>
        </div>
      ) : (
        <div className="grid gap-4 overflow-y-auto custom-scrollbar pb-20">
          {peticoes.map((peticao) => (
            <div key={peticao.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start md:items-center transition-all hover:border-brand-300 hover:shadow-md">
              
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-600 shrink-0">
                <Icon name="FileCheck" size={32} />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3 mb-1">
                  {peticao.codigo && (
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-gray-900 text-white border border-gray-700 tracking-wider">
                      {peticao.codigo}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">{peticao.tipoPeca}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border
                    ${peticao.status === 'Aguardando Revisão' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                      peticao.status === 'Aprovada' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'}`}
                  >
                    {peticao.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5"><Icon name="Hash" size={14} /> Autos: <span className="font-mono text-gray-700">{peticao.autos}</span></span>
                  <span className="flex items-center gap-1.5"><Icon name="Briefcase" size={14} /> Demanda: <span className="text-gray-700">{peticao.demanda}</span></span>
                  <span className="flex items-center gap-1.5"><Icon name="CalendarCheck" size={14} /> Concluída em: <span className="text-gray-700">{peticao.dataConclusao}</span></span>
                </div>
              </div>

              <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto mt-4 md:mt-0">
                <button 
                  onClick={() => onRevisar(peticao.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium shadow-sm"
                >
                  <Icon name="Eye" size={16} />
                  Revisar
                </button>
                <button 
                  onClick={() => onBaixar(peticao.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium shadow-sm"
                >
                  <Icon name="Download" size={16} />
                  Baixar DOCX
                </button>
                <button 
                  onClick={() => onProtocolar(peticao.id)}
                  disabled={peticao.status !== 'Aprovada'}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-bold shadow-sm"
                  title={peticao.status !== 'Aprovada' ? 'A petição precisa ser revisada e aprovada primeiro' : ''}
                >
                  <Icon name="Send" size={16} />
                  Protocolar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
