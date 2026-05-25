import React, { useState } from 'react';
import { WorkflowStage, AgentConfig, PhaseResultData } from '../types';
import { Icon } from './Icons';
import { AGENT_COLORS } from '../constants';

interface StageDetailModalProps {
  stage: WorkflowStage | null;
  result?: PhaseResultData;
  agentConfigs: Record<string, AgentConfig>;
  onClose: () => void;
}

export const StageDetailModal: React.FC<StageDetailModalProps> = ({ stage, result, agentConfigs, onClose }) => {
  const [showFullDetails, setShowFullDetails] = useState(false);

  if (!stage) return null;

  const hasResult = result && result.result;
  const tokensIn = result?.tokensInput;
  const tokensOut = result?.tokensOutput;
  const execTime = result?.executionTime;
  const completedAt = result?.completedAt;

  // Formatar tempo de execução
  const formatTime = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Formatar tokens
  const formatTokens = (n?: number) => {
    if (!n) return '—';
    return n.toLocaleString('pt-BR');
  };

  // Gerar log real baseado nos dados
  const agentConfigsText = stage.agents.map(agentId => {
    const conf = agentConfigs[agentId];
    if (!conf || (!conf.mcpConfig && !conf.ragConfig && !conf.customInstructions && !conf.cotConfig && !conf.driveLink)) {
      return `[${agentId}] Parâmetros padrão do sistema.`;
    }
    return `[${agentId}] CONFIGURAÇÕES APLICADAS:\n` +
           (conf.driveLink ? `  > Drive Link: ${conf.driveLink}\n` : '') +
           (conf.mcpConfig ? `  > MCP: ${conf.mcpConfig}\n` : '') +
           (conf.ragConfig ? `  > RAG: ${conf.ragConfig}\n` : '') +
           (conf.cotConfig ? `  > CoT: ${conf.cotConfig}\n` : '') +
           (conf.customInstructions ? `  > Prompt: "${conf.customInstructions.substring(0, 80)}..."\n` : '');
  }).join('\n');

  const fullDetailsText = hasResult
    ? `[LOG DE EXECUÇÃO — FASE ${stage.id}: ${stage.shortTitle.toUpperCase()}]\n\n` +
      `Conclusão: ${completedAt ? new Date(completedAt).toLocaleString('pt-BR') : '—'}\n` +
      `Agentes: ${stage.agents.join(', ')}\n` +
      `Status: Concluído\n\n` +
      `══════════════════════════════════════════\n` +
      `MÉTRICAS REAIS DE EXECUÇÃO:\n` +
      `  Tokens de entrada:  ${formatTokens(tokensIn)}\n` +
      `  Tokens de saída:    ${formatTokens(tokensOut)}\n` +
      `  Tokens total:       ${formatTokens((tokensIn || 0) + (tokensOut || 0))}\n` +
      `  Tempo de execução:  ${formatTime(execTime)}\n` +
      `══════════════════════════════════════════\n\n` +
      `CONFIGURAÇÃO DOS AGENTES:\n${agentConfigsText}\n\n` +
      `══════════════════════════════════════════\n` +
      `RESULTADO COMPLETO DA FASE:\n${result?.result || '—'}`
    : `[FASE ${stage.id}: ${stage.shortTitle.toUpperCase()}]\n\n` +
      `Status: Aguardando execução\n` +
      `Agentes: ${stage.agents.join(', ')}\n\n` +
      `CONFIGURAÇÃO:\n${agentConfigsText}\n\n` +
      `Nenhum resultado disponível. Esta fase ainda não foi executada neste fluxo.`;

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
                <h3 className="text-sm font-bold uppercase tracking-wider">Logs Reais do Sistema</h3>
              </div>
              <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {fullDetailsText}
              </pre>
            </div>
          ) : (
            <>
              {/* Métricas Reais */}
              {hasResult && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                    <div className="text-xs text-blue-600 font-semibold mb-1">Tokens Entrada</div>
                    <div className="text-lg font-bold text-blue-800">{formatTokens(tokensIn)}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                    <div className="text-xs text-purple-600 font-semibold mb-1">Tokens Saída</div>
                    <div className="text-lg font-bold text-purple-800">{formatTokens(tokensOut)}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                    <div className="text-xs text-green-600 font-semibold mb-1">Tempo</div>
                    <div className="text-lg font-bold text-green-800">{formatTime(execTime)}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <div className="text-xs text-amber-600 font-semibold mb-1">Concluído em</div>
                    <div className="text-sm font-bold text-amber-800">
                      {completedAt ? new Date(completedAt).toLocaleTimeString('pt-BR') : '—'}
                    </div>
                  </div>
                </div>
              )}

              {/* Resultado Real */}
              {hasResult ? (
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
                  <h3 className="text-sm font-bold text-brand-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Icon name="CheckCircle" size={16} />
                    Resultado Real da Fase
                  </h3>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line font-medium text-sm">
                    {result?.result}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
                  <Icon name="Clock" size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500 font-medium">Fase ainda não executada neste fluxo.</p>
                  <p className="text-gray-400 text-sm mt-1">Os dados reais aparecerão aqui após a execução.</p>
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
