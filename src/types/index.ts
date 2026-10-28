export type DemandStatus = 
  | 'Em Andamento' 
  | 'Concluída Geral' 
  | 'Concluída (CS Finalizar TEP)' 
  | 'Cancelada' 
  | 'Pausada'
  | 'Sem Status';

export type DemandType = 
  | 'Nova Implantação' 
  | 'UpSell - Novos Módulos' 
  | 'Acompanhamento Treinamento' 
  | 'Acompanhamento Insatisfação' 
  | 'Outros';

export type ProcessStage = 
  | 'kickoff'
  | 'parametrizacao'
  | 'treinamento'
  | 'homologacao'
  | 'tep_cs'
  | 'concluido'
  | 'pausado_cancelado';

export interface WeeklyCheckIn {
  id?: number;
  date: string;
  note: string;
  progressPercent: number;
  stage: ProcessStage;
  blocker?: string;
  implantador?: string; // Implantador que executou a ação
  horasGastas?: number; // Tempo gasto em horas (ex: 1.5 = 1h30min)
  minutosGastos?: number; // Tempo gasto em minutos (ex: 5, 15, 30, 60)
  horaInicio?: string; // Horário de início (ex: '14:22')
  horaFim?: string; // Horário de término (ex: '14:52')
  origemTempo?: string; // 'cronometro' | 'marco_5m' | 'marco_15m' | 'marco_30m' | 'marco_1h' | 'manual'
}

export interface ImplantadorRanking {
  implantador: string;
  totalHoras: number;
  totalAtendimentos: number;
  demandasDistintas: number;
  mediaHorasPorAtendimento: number;
  percentualEsforco: number;
}

export interface ApontamentoDetalhado {
  id: number;
  demandaSeq: number;
  razaoSocial: string;
  implantador: string;
  data: string;
  horasGastas: number;
  descricao: string;
  progresso: number;
  impedimento?: string;
}

export interface AuditLogEntry {
  id?: number;
  seq: number;
  razaoSocial: string;
  timestamp: string; // ISO format
  actionType: 'check_in' | 'stage_change' | 'assignment' | 'status_change' | 'edit_details' | 'batch_assign' | 'create' | 'retaguarda_sync';
  summary: string;
  author?: string;
  oldValue?: string;
  newValue?: string;
}

export interface Demand {
  seq: number;
  prevInicio: string; // DD/MM/YY
  prevFim: string; // DD/MM/YY
  implantador: string;
  clienteId: string;
  razaoSocial: string;
  comercial: string;
  hrsNeg: number;
  pessoasTreinar: number;
  totModulos: number;
  conclusao: string; // DD/MM/YY or ''
  status: DemandStatus;
  tipo: DemandType;
  
  // Computed & Interactive Fields
  startDate?: Date;
  endDate?: Date;
  completionDate?: Date;
  daysOpen: number;
  daysLate: number; // >0 if overdue
  daysSinceLastEvolution: number;
  weeklyEvolutionState: 'critico' | 'alerta' | 'em_dia' | 'concluido' | 'inativo';
  currentStage: ProcessStage;
  progressPercent: number;
  bottlenecks: string[];
  checkIns: WeeklyCheckIn[];
  notes?: string;

  // Local database & weekly change tracking
  lastUpdatedAt?: string; // ISO string
  lastChangeSummary?: string;
  updatedThisWeek?: boolean;

  // Marcador Retaguarda Atualizado (Temporário - Futuramente via API)
  retaguardaAtualizado?: boolean;
  dataRetaguardaAtualizado?: string;

  // Validação de Contato com Cliente
  dataUltimoContato?: string;
  diasSemContato?: number;
  hasRegisteredContact?: boolean;
  latestContactInteraction?: LatestContactSummary;
}

export interface BottleneckMetric {
  title: string;
  stage: ProcessStage;
  severity: 'alta' | 'media' | 'baixa';
  affectedCount: number;
  description: string;
  rootCause: string;
  recommendation: string;
}

export interface FilterState {
  search: string;
  status: string;
  tipo: string;
  responsavel: string;
  weeklyEvolution: 'all' | 'critico' | 'alerta' | 'em_dia' | 'atrasado';
  contactValidation?: 'all' | 'sem_contato' | 'critico' | 'alerta' | 'sem_implantador' | 'em_dia';
  retaguardaStatus?: 'all' | 'atualizado' | 'pendente';
  moduloRange: 'all' | '1-2' | '3-5' | '6-10' | '10+';
  sortBy: 'seq' | 'daysOpen' | 'daysLate' | 'daysSinceLastEvolution' | 'modulos' | 'hrsNeg';
  sortOrder: 'asc' | 'desc';
}

export interface AlertThresholdSettings {
  criticalDays: number; // default: 14 (>14 dias)
  alertDays: number;    // default: 7 (7 a 14 dias)
}

export type ContactInteractionStatus = 'SUCCESS' | 'NO_RESPONSE' | string;

export interface ContactInteraction {
  id: number;
  contactId: number; // Demanda seq
  status: ContactInteractionStatus;
  userId?: string;
  notes?: string;
  contactedAt: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LatestContactSummary {
  lastStatus: ContactInteractionStatus;
  lastContactedAt: string;
  lastUserId?: string;
  totalCount: number;
  lastNotes?: string;
}

export interface RetaguardaApiLog {
  id: number;
  implantacaoSeq: number;
  endpoint: string;
  metodo: string;
  httpStatus: number;
  erroCodigo: number | null;
  descricao: string;
  resumoEnviado: string;
  duracaoMs: number;
  origemIp: string;
  createdAt: string;
}

export interface RetaguardaApiStats {
  total: number;
  sucessos: number;
  errosToken: number;
  errosNaoEncontrado: number;
  outrosErros: number;
  taxaSucesso: number;
  latenciaMediaMs: number;
  ultimoDisparo: string | null;
}

