import { WorkflowStage } from './types';

export const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: 1,
    title: "Camada de Coleta e Organização Sistêmica",
    shortTitle: "Coleta & Organização",
    description: "Captura e estruturação de dados brutos para garantir a integridade da cadeia de custódia da informação jurídica.",
    agents: ["A1", "A2"],
    iconName: "Database",
    features: [
      { name: "Coletor de Prazos (A1)", description: "Monitoramento contínuo de intimações para extrair a data fatal do prazo com precisão absoluta." },
      { name: "Input de Dados (A2)", description: "Coleta de metadados vitais: número do processo, partes e matéria jurídica." },
      { name: "Pipeline de Execução (A2)", description: "Estabelece sequência lógica, priorizando por urgência e complexidade." }
    ]
  },
  {
    id: 2,
    title: "Inteligência de Intenção e Gestão de Conhecimento",
    shortTitle: "Intenção & Conhecimento",
    description: "Análise estratégica onde o objetivo da demanda é refinado e estruturado.",
    agents: ["A2", "A3"],
    iconName: "BrainCircuit",
    features: [
      { name: "Protocolo 'So What!?' (A2)", description: "Identifica o objetivo central e o resultado prático esperado da peça." },
      { name: "Few-Shot Learning", description: "Uso de exemplos selecionados para guiar o comportamento da IA e manter o estilo." },
      { name: "Seleção de Templates (A2)", description: "Define a estrutura documental ideal para manter padrões de excelência." },
      { name: "Consulta a Dados Legados (A3)", description: "Buscas profundas em bancos internos e jurisprudência histórica via Drive." }
    ]
  },
  {
    id: 3,
    title: "Síntese e Protocolo R.O.P.A.",
    shortTitle: "Síntese & R.O.P.A.",
    description: "Camada de compactação e análise detalhada para eficiência do processamento.",
    agents: ["A4"],
    iconName: "Minimize2",
    features: [
      { name: "Sumarização Total", description: "Compacta informações para otimizar o processamento pelos agentes de redação." },
      { name: "Protocolo R.O.P.A.", description: "Resumo, Organização, Pesquisa e Análise detalhada do cenário fático e jurídico." },
      { name: "Pesquisa Avançada", description: "Sugestão de termos técnicos e operadores booleanos para buscas de alto nível." }
    ]
  },
  {
    id: 4,
    title: "Gestão de Risco e Defesa Proativa",
    shortTitle: "Risco & Defesa",
    description: "Antecipação de teses contrárias através de métodos de estresse lógico.",
    agents: ["A5"],
    iconName: "ShieldAlert",
    features: [
      { name: "Protocolo Steel Man", description: "Constrói a versão mais robusta e convincente do argumento do adversário." },
      { name: "Superação Lógica", description: "Desenvolve fundamentação para superar o argumento contrário com lógica superior." },
      { name: "Fortalecimento de Teses", description: "Identifica vulnerabilidades e blinda a tese principal antes da redação." }
    ]
  },
  {
    id: 5,
    title: "Redação Estratégica e Geração Aumentada",
    shortTitle: "Redação Estratégica",
    description: "Produção textual utilizando técnicas de ponta para originalidade e fundamentação.",
    agents: ["A6"],
    iconName: "PenTool",
    features: [
      { name: "RAG (Retrieval Augmented Generation)", description: "Geração aumentada por dados reais e atualizados, evitando alucinações." },
      { name: "Steel Map", description: "Mapeamento geográfico e lógico dos pontos de força da argumentação." },
      { name: "Red Points x Blue Logic", description: "Teste de estresse simulando ataques (vermelho) e defesas lógicas (azul)." }
    ]
  },
  {
    id: 6,
    title: "Memória Estendida e Eficiência de Processamento",
    shortTitle: "Memória & Eficiência",
    description: "Hub de Memória Contextual (MCP) para manter coerência em fluxos longos.",
    agents: ["MCP"],
    iconName: "Network",
    features: [
      { name: "Markdown Optimization", description: "Transforma dados em Markdown para economizar tokens e manter estrutura limpa." },
      { name: "Extended Memory", description: "Hub central que armazena o histórico de decisões da cadeia agêntica." }
    ]
  },
  {
    id: 7,
    title: "Agente Revisor e Validação de Coerência",
    shortTitle: "Revisão & Validação",
    description: "Última camada de inteligência focada na crítica e refinamento técnico.",
    agents: ["A7"],
    iconName: "Eye",
    features: [
      { name: "Chain of Thought (CoT)", description: "Raciocínio em cadeia para validar coerência entre fundamentação e conclusões." },
      { name: "Selfie Critique", description: "Revisão autocrítica buscando falhas lógicas, omissões ou erros materiais." }
    ]
  },
  {
    id: 8,
    title: "Módulo: Petições Prontas",
    shortTitle: "Petições Prontas",
    description: "Encerramento do fluxo garantindo responsabilidade profissional, segurança e disponibilização da peça final.",
    agents: ["Humano", "Sistema"],
    iconName: "FileCheck",
    features: [
      { name: "Loop Humano", description: "Revisão e aprovação obrigatória por um advogado, fechando a cadeia de segurança." },
      { name: "Protocolo Legal", description: "Registro e protocolo judicial, confirmando o cumprimento do prazo." }
    ]
  }
];

export const AGENT_COLORS: Record<string, string> = {
  "A1": "bg-blue-50 text-blue-700 border-blue-200",
  "A2": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "A3": "bg-violet-50 text-violet-700 border-violet-200",
  "A4": "bg-purple-50 text-purple-700 border-purple-200",
  "A5": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  "A6": "bg-pink-50 text-pink-700 border-pink-200",
  "A7": "bg-rose-50 text-rose-700 border-rose-200",
  "MCP": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Humano": "bg-amber-50 text-amber-700 border-amber-200",
  "Sistema": "bg-gray-100 text-gray-700 border-gray-300",
};
