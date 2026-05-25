import { useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Template, PeticaoPronta, WorkflowHistoryItem, AgentConfig } from '../types';

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

export function useTemplates() {
  const listar = useCallback(async (): Promise<Template[]> => {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('last_updated', { ascending: false });
    if (error) { console.error('[Supabase] listar templates:', error); return []; }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? '',
      instructions: r.instructions ?? '',
      category: r.category ?? '',
      lastUpdated: r.last_updated,
    }));
  }, []);

  const salvar = useCallback(async (t: Omit<Template, 'id' | 'lastUpdated'>): Promise<void> => {
    const { error } = await supabase.from('templates').insert({
      name: t.name,
      description: t.description,
      instructions: t.instructions,
      category: t.category,
    });
    if (error) console.error('[Supabase] salvar template:', error);
  }, []);

  const remover = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('templates').delete().eq('id', id);
    if (error) console.error('[Supabase] remover template:', error);
  }, []);

  return { listar, salvar, remover };
}

// ─── PETIÇÕES PRONTAS ─────────────────────────────────────────────────────────

export function usePeticoesProntas() {
  const listar = useCallback(async (): Promise<PeticaoPronta[]> => {
    const { data, error } = await supabase
      .from('peticoes_prontas')
      .select('*')
      .order('data_conclusao', { ascending: false });
    if (error) { console.error('[Supabase] listar petições:', error); return []; }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      codigo: r.codigo ?? null,
      demanda: r.demanda,
      autos: r.autos,
      tipoPeticao: r.tipo_peticao ?? '',
      tipoPeca: r.tipo_peca ?? '',
      observacao: r.observacao ?? '',
      arquivos: [],
      status: r.status,
      dataConclusao: r.data_conclusao,
      docxUrl: r.docx_url ?? null,
    }));
  }, []);

  const salvar = useCallback(async (p: PeticaoPronta): Promise<void> => {
    const { error } = await supabase.from('peticoes_prontas').upsert({
      id: p.id,
      demanda: p.demanda,
      autos: p.autos,
      tipo_peticao: p.tipoPeticao,
      tipo_peca: p.tipoPeca,
      observacao: p.observacao,
      status: p.status,
      data_conclusao: p.dataConclusao,
    });
    if (error) console.error('[Supabase] salvar petição:', error);
  }, []);

  const atualizarStatus = useCallback(async (id: string, status: PeticaoPronta['status']): Promise<void> => {
    const { error } = await supabase
      .from('peticoes_prontas')
      .update({ status })
      .eq('id', id);
    if (error) console.error('[Supabase] atualizar status petição:', error);
  }, []);

  const remover = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('peticoes_prontas').delete().eq('id', id);
    if (error) console.error('[Supabase] remover petição:', error);
  }, []);

  return { listar, salvar, atualizarStatus, remover };
}

// ─── HISTÓRICO DE FLUXOS ─────────────────────────────────────────────────────

export function useHistorico() {
  const listar = useCallback(async (): Promise<WorkflowHistoryItem[]> => {
    const { data, error } = await supabase
      .from('historico_fluxos')
      .select('*')
      .order('data', { ascending: false });
    if (error) { console.error('[Supabase] listar histórico:', error); return []; }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      data: r.data,
      demanda: r.demanda,
      autos: r.autos,
      tipoPeticao: r.tipo_peticao ?? '',
      status: r.status,
    }));
  }, []);

  const registrar = useCallback(async (item: WorkflowHistoryItem): Promise<void> => {
    const { error } = await supabase.from('historico_fluxos').insert({
      fluxo_codigo: item.id,
      data: item.data,
      demanda: item.demanda,
      autos: item.autos,
      tipo_peticao: item.tipoPeticao,
      status: item.status,
    });
    if (error) console.error('[Supabase] registrar histórico:', error);
  }, []);

  return { listar, registrar };
}

// ─── CONFIGURAÇÕES DE AGENTES ────────────────────────────────────────────────

export function useAgentConfigs() {
  const listar = useCallback(async (): Promise<Record<string, AgentConfig>> => {
    const { data, error } = await supabase.from('agent_configs').select('*');
    if (error) { console.error('[Supabase] listar agent_configs:', error); return {}; }
    const configs: Record<string, AgentConfig> = {};
    (data ?? []).forEach((r: any) => {
      configs[r.agent_id] = {
        mcpConfig: r.mcp_config ?? '',
        ragConfig: r.rag_config ?? '',
        customInstructions: r.custom_instructions ?? '',
        cotConfig: r.cot_config ?? '',
        driveLink: r.drive_link ?? '',
      };
    });
    return configs;
  }, []);

  const salvar = useCallback(async (agentId: string, config: AgentConfig): Promise<void> => {
    const { error } = await supabase.from('agent_configs').upsert({
      agent_id: agentId,
      mcp_config: config.mcpConfig,
      rag_config: config.ragConfig,
      custom_instructions: config.customInstructions,
      cot_config: config.cotConfig ?? '',
      drive_link: config.driveLink ?? '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'agent_id' });
    if (error) console.error('[Supabase] salvar agent_config:', error);
  }, []);

  return { listar, salvar };
}
