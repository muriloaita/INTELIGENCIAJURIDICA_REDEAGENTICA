import React from 'react';
import { Icon } from './Icons';
import { PeticaoPronta } from '../types';

interface AguardandoProtocoloViewProps {
  peticoes: PeticaoPronta[];
  onFinalizarProtocolo: (id: string) => void;
  onBaixar: (id: string) => void;
}

export const AguardandoProtocoloView: React.FC<AguardandoProtocoloViewProps> = ({ peticoes, onFinalizarProtocolo, onBaixar }) => {
  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Revisados e Aguardando Protocolo</h2>
          <p className="text-gray-500 text-sm">Peças aprovadas prontas para inserção no sistema do tribunal.</p>
        </div>
      </div>

      {peticoes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50">
          <Icon name="Send" size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-gray-600">Nenhuma petição aguardando protocolo.</p>
          <p className="text-sm mt-2">Aprove petições na aba "Petições Prontas" para enviá-las para cá.</p>
        </div>
      ) : (
        <div className="grid gap-4 overflow-y-auto custom-scrollbar pb-20">
          {peticoes.map((peticao) => (
            <div key={peticao.id} className="bg-white border border-brand-200 shadow-sm rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start md:items-center transition-all hover:shadow-md">
              
              <div className="p-4 bg-brand-50 rounded-xl border border-brand-100 text-brand-600 shrink-0">
                <Icon name="Scale" size={32} />
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold text-gray-900">{peticao.tipoPeca}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200">
                    {peticao.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5"><Icon name="Hash" size={14} /> Autos: <span className="font-mono text-gray-700">{peticao.autos}</span></span>
                  <span className="flex items-center gap-1.5"><Icon name="Briefcase" size={14} /> Demanda: <span className="text-gray-700">{peticao.demanda}</span></span>
                </div>
              </div>

              <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto mt-4 md:mt-0">
                <button 
                  onClick={() => onBaixar(peticao.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium shadow-sm"
                >
                  <Icon name="Download" size={16} />
                  Baixar DOCX
                </button>
                <button 
                  onClick={() => onFinalizarProtocolo(peticao.id)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-bold shadow-sm"
                >
                  <Icon name="CheckCircle" size={16} />
                  Confirmar Protocolo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
