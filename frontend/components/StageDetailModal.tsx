import React, { useState } from 'react';
import { WorkflowStage, AgentConfig } from '../types';
import { Icon } from './Icons';
import { AGENT_COLORS } from '../constants';

interface StageDetailModalProps {
  stage: WorkflowStage | null;
  result?: string;
  agentConfigs: Record<string, AgentConfig>;
  onClose: () => void;
}

export const StageDetailModal: React.FC<StageDetailModalProps> = ({ stage, result, agentConfigs, onClose }) => {
  const [showFullDetails, setShowFullDetails] = useState(false);

  if (!stage) return null;

  // Generate dynamic config text based on user inputs in ConfigView
  const agentConfigsText = stage.agents.map(agentId => {
    const conf = agentConfigs[agentId];
    if (!conf || (!conf.mcpConfig && !conf.ragConfig && !conf.customInstructions && !conf.cotConfig && !conf.driveLink)) {
      return `[${agentId}] Utilizando parâmetros padrão do sistema.`;
    }
    return `[${agentId}] CONFIGURAÇÕES APLICADAS:\n` +
           (conf.driveLink ? `  > Drive Link: ${conf.driveLink}\n` : '') +
           (conf.mcpConfig ? `  > MCP: ${conf.mcpConfig}\n` : '') +
           (conf.ragConfig ? `  > RAG: ${conf.ragConfig}\n` : '') +
           (conf.cotConfig ? `  > CoT (Chain of Thought): ${conf.cotConfig}\n` : '') +
           (conf.customInstructions ? `  > Prompt: "${conf.customInstructions.substring(0, 50)}..."\n` : '');
  }).join('\n');

  // Mock full details text incorporating the agent configs
  const fullDetailsText = `[LOG DE EXECUÇÃO COMPLETA - FASE ${stage.id}: ${stage.shortTitle.toUpperCase()}]\n\n` +
    `Timestamp: ${new Date().toISOString()}\n` +
    `Agentes Envolvidos: ${stage.agents.join(', ')}\n` +
    `Status: Concluído com Sucesso\n\n` +
    `==================================================\n` +
    `INJEÇÃO DE CONTEXTO E COMPORTAMENTO (MCP/RAG/CoT):\n` +
    `${agentConfigsText}\n` +
    `==================================================\n\n` +
    `DADOS BRUTOS COLETADOS E PROCESSADOS:\n` +
    `- Extração de metadados via OCR concluída com 99.8% de precisão.\n` +
    `- Identificação de entidades nomeadas (NER) finalizada.\n` +
    `- Validação cruzada de prazos com o sistema do tribunal: OK.\n\n` +
    `PROCESSAMENTO COGNITIVO E ANÁLISE:\n` +
    `- Análise de sentimento da peça contrária: Agressivo/Acusatório.\n` +
    `- Classificação de risco da demanda: Moderado a Alto.\n` +
    `- Busca jurisprudencial: 45 acórdãos analisados, 3 selecionados por alta similaridade fática.\n` +
    `- Aplicação do Protocolo Steel Man: Argumentos contrários mapeados e refutados.\n\n` +
    `RESULTADO DA GERAÇÃO E MÉTRICAS:\n` +
    `- Tokens utilizados no prompt: 4,520.\n` +
    `- Tokens gerados na resposta: 1,250.\n` +
    `- Tempo de inferência total: 2.4s.\n` +
    `- Validação de coerência (CoT): Passou em todos os 12 critérios lógicos estabelecidos.\n` +
    `==================================================\n\n` +
    `RESUMO EXECUTIVO:\n${result || 'Nenhum resultado simplificado disponível para esta fase no momento.'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white border border-gray-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-start justify-between bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-brand-50 text-brand-600 border border-brand-100">
              <Icon name={stage.iconName} size={32} />
            </div>
            <div>
              <div className="text-brand-600 text-sm font-mono mb-1 font-semibold">Fase {stage.id}</div>
              <h2 className="text-2xl font-bold text-gray-900">{stage.title}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          
          {showFullDetails ? (
            <div className="bg-gray-900 rounded-xl p-5 overflow-x-auto">
              <div className="flex items-center gap-2 mb-4 text-brand-400 border-b border-gray-700 pb-2">
                <Icon name="Terminal" size={18} />
                <h3 className="text-sm font-bold uppercase tracking-wider">Logs do Sistema & Configurações</h3>
              </div>
              <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {fullDetailsText}
              </pre>
            </div>
          ) : (
            <>
              {/* Informações Obtidas (Resultados) */}
              {result && (
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
                  <h3 className="text-sm font-bold text-brand-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="CheckCircle" size={16} />
                    Informações Obtidas
                  </h3>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line font-medium">
                    {result}
                  </p>
                </div>
              )}

              <p className="text-gray-600 text-lg leading-relaxed">
                {stage.description}
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Icon name="Cpu" size={16} />
                    Agentes Envolvidos
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {stage.agents.map(agent => (
                      <div 
                        key={agent} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${AGENT_COLORS[agent] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                      >
                        <Icon name={agent === 'Humano' ? 'User' : agent === 'MCP' ? 'Database' : 'Bot'} size={18} />
                        <span className="font-mono font-semibold">{agent}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Icon name="ListChecks" size={16} />
                    Protocolos & Funcionalidades
                  </h3>
                  <div className="grid gap-4">
                    {stage.features.map((feature, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                        <h4 className="text-gray-900 font-bold mb-1">{feature.name}</h4>
                        <p className="text-gray-600 text-sm">{feature.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <button 
            onClick={() => setShowFullDetails(!showFullDetails)}
            className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors font-medium flex items-center gap-2 text-sm"
          >
            <Icon name={showFullDetails ? "LayoutList" : "Terminal"} size={18} />
            {showFullDetails ? "Ver Resumo" : "Detalhamento Completo"}
          </button>
          
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors font-medium shadow-sm"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
