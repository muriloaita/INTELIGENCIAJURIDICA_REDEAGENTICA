import React from 'react';
import { WorkflowStage } from '../types';
import { Icon } from './Icons';
import { AGENT_COLORS } from '../constants';

interface StageCardProps {
  stage: WorkflowStage;
  isActive: boolean;
  isCompleted: boolean;
  hasResult: boolean;
  onClick: () => void;
}

export const StageCard: React.FC<StageCardProps> = ({ stage, isActive, isCompleted, hasResult, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        relative p-5 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full bg-white
        ${isActive 
          ? 'border-brand-500 shadow-[0_0_15px_rgba(220,38,38,0.15)] scale-[1.02] ring-1 ring-brand-500' 
          : isCompleted
            ? 'border-gray-200 hover:border-brand-300 shadow-sm'
            : 'border-gray-200 hover:border-gray-300 opacity-80 hover:opacity-100 shadow-sm'
        }
      `}
    >
      {/* Active Indicator Glow */}
      {isActive && (
        <div className="absolute top-0 left-0 w-1 h-full bg-brand-500"></div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${isActive ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
          <Icon name={stage.iconName} size={24} />
        </div>
        <div className="flex gap-2 flex-wrap justify-end max-w-[50%]">
          {stage.agents.map(agent => (
            <span 
              key={agent} 
              className={`text-xs font-mono px-2 py-1 rounded-md border ${AGENT_COLORS[agent] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
            >
              {agent}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
            Fase {stage.id}
          </span>
          {hasResult && (
            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
              <Icon name="Check" size={10} /> Dados Obtidos
            </span>
          )}
        </div>
        <h3 className={`text-lg font-bold leading-tight ${isActive ? 'text-brand-700' : 'text-gray-900'}`}>
          {stage.shortTitle}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2">
          {stage.description}
        </p>
      </div>

      {/* Progress Line Connection */}
      {isActive && (
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-brand-500/0 via-brand-500 to-brand-500/0 animate-pulse"></div>
      )}
    </div>
  );
};
