import { Demand, ProcessStage } from '../types';

export interface BurnupStagePoint {
  stageId: ProcessStage;
  stageName: string;
  stageOrder: number;
  // Stage isolated hours
  horasNegociadasEtapa: number;
  horasConsumidasEtapa: number;
  saldoHorasEtapa: number;
  percentualConsumoEtapa: number;
  isGargalo: boolean;
  statusGargalo: 'normal' | 'alerta' | 'critico';
  // Cumulative burnup curve
  horasNegociadasAcumuladas: number;
  horasConsumidasAcumuladas: number;
  metaEscopoTotal: number;
  saldoAcumulado: number;
}

export interface DemandBurnupRisk {
  seq: number;
  razaoSocial: string;
  implantador: string;
  hrsNeg: number;
  horasConsumidas: number;
  etapa: ProcessStage;
  percentualGasto: number;
  statusRisco: 'normal' | 'alerta' | 'critico';
  motivoGargalo: string;
}

export interface ImplantadorProductivitySummary {
  implantador: string;
  totalDemandas: number;
  demandasAtivas: number;
  demandasConcluidas: number;
  horasNegociadas: number;
  horasConsumidas: number;
  saldoHoras: number;
  taxaEficiencia: number; // (horasConsumidas / horasNegociadas) * 100
  etapaMaiorGargalo: string;
  etapaMaiorGargaloId?: ProcessStage;
  gravidadeGargalo: 'normal' | 'alerta' | 'critico';
  burnupPoints: BurnupStagePoint[];
  demandasEmRisco: DemandBurnupRisk[];
}

export const STAGES_CONFIG: {
  id: ProcessStage;
  name: string;
  shortName: string;
  order: number;
  plannedWeight: number; // Proportion of total contract hours
}[] = [
  { id: 'kickoff', name: '1. Kickoff & Alocação', shortName: 'Kickoff', order: 1, plannedWeight: 0.15 },
  { id: 'parametrizacao', name: '2. Parametrização & Escopo', shortName: 'Parametrização', order: 2, plannedWeight: 0.25 },
  { id: 'treinamento', name: '3. Capacitação & Treinamento', shortName: 'Treinamento', order: 3, plannedWeight: 0.35 },
  { id: 'homologacao', name: '4. Homologação & Go-Live', shortName: 'Homologação', order: 4, plannedWeight: 0.15 },
  { id: 'tep_cs', name: '5. Validação TEP (CS)', shortName: 'TEP / CS', order: 5, plannedWeight: 0.10 },
];

/**
 * Calculates consumed hours for a specific demand, broken down by stage.
 * Combines check-in pointed hours and stage progress estimates with bottleneck penalties.
 */
export function calculateDemandStageHours(demand: Demand): {
  hrsNeg: number;
  totalConsumed: number;
  stageConsumed: Record<ProcessStage, number>;
  stagePlanned: Record<ProcessStage, number>;
} {
  const hrsNeg = Math.max(1, demand.hrsNeg || 10);
  const stagePlanned: Record<ProcessStage, number> = {
    kickoff: Math.round(hrsNeg * 0.15 * 10) / 10,
    parametrizacao: Math.round(hrsNeg * 0.25 * 10) / 10,
    treinamento: Math.round(hrsNeg * 0.35 * 10) / 10,
    homologacao: Math.round(hrsNeg * 0.15 * 10) / 10,
    tep_cs: Math.round(hrsNeg * 0.10 * 10) / 10,
    concluido: 0,
    pausado_cancelado: 0,
  };

  const stageConsumed: Record<ProcessStage, number> = {
    kickoff: 0,
    parametrizacao: 0,
    treinamento: 0,
    homologacao: 0,
    tep_cs: 0,
    concluido: 0,
    pausado_cancelado: 0,
  };

  // 1. Gather explicitly pointed hours from checkIns if available
  let explicitlyPointedTotal = 0;
  if (demand.checkIns && demand.checkIns.length > 0) {
    demand.checkIns.forEach(c => {
      const hrs = Number(c.horasGastas) || (Number(c.minutosGastos) ? Number(c.minutosGastos) / 60 : 0);
      if (hrs > 0) {
        explicitlyPointedTotal += hrs;
        const stage = c.stage || demand.currentStage || 'parametrizacao';
        if (stageConsumed[stage] !== undefined) {
          stageConsumed[stage] += hrs;
        }
      }
    });
  }

  // 2. If no or few manual hours were pointed, estimate based on stage progress & bottleneck characteristics
  const stageOrderMap: Record<ProcessStage, number> = {
    kickoff: 1,
    parametrizacao: 2,
    treinamento: 3,
    homologacao: 4,
    tep_cs: 5,
    concluido: 6,
    pausado_cancelado: 0,
  };

  const currentStageOrder = stageOrderMap[demand.currentStage] || 1;
  const isCompleted = demand.status === 'Concluída Geral';

  STAGES_CONFIG.forEach(stage => {
    let consumed = stageConsumed[stage.id];

    if (isCompleted) {
      // Completed demand has finished all stages
      if (consumed === 0) {
        consumed = stagePlanned[stage.id];
      }
    } else if (stage.order < currentStageOrder) {
      // Past stage: fully traversed
      if (consumed === 0) {
        consumed = stagePlanned[stage.id];
      }
    } else if (stage.order === currentStageOrder) {
      // Current active stage
      if (consumed === 0) {
        // Pro-rate based on progress percent
        const factor = Math.max(0.3, Math.min(1.2, (demand.progressPercent || 50) / 100));
        consumed = stagePlanned[stage.id] * factor;
      }

      // Add bottleneck factors for current stage
      if (stage.id === 'parametrizacao' && demand.totModulos >= 4 && demand.hrsNeg < demand.totModulos * 2.5) {
        // Scope bottleneck: high modules, low hours
        consumed += Math.max(2, stagePlanned[stage.id] * 0.35);
      } else if (stage.id === 'treinamento' && (demand.pessoasTreinar >= 3 || demand.tipo === 'Acompanhamento Treinamento')) {
        // Training complexity bottleneck: multiple attendees
        consumed += Math.max(2, stagePlanned[stage.id] * 0.3);
      } else if (stage.id === 'homologacao' && demand.daysLate > 0) {
        // Go-live delay bottleneck
        consumed += Math.min(demand.daysLate * 0.4, stagePlanned[stage.id] * 0.6);
      } else if (stage.id === 'kickoff' && (!demand.implantador || demand.implantador === 'Não Atribuído')) {
        // Unassigned queue wait
        consumed += 1.5;
      }
    } else {
      // Future stage: 0 consumed yet
      consumed = 0;
    }

    stageConsumed[stage.id] = Math.round(consumed * 10) / 10;
  });

  const totalConsumed = Math.round(
    Object.values(stageConsumed).reduce((sum, val) => sum + val, 0) * 10
  ) / 10;

  return {
    hrsNeg,
    totalConsumed,
    stageConsumed,
    stagePlanned,
  };
}

/**
 * Computes Burnup Chart curve points for a set of demands.
 */
export function calculateBurnupPoints(demands: Demand[]): BurnupStagePoint[] {
  const totalScopeHours = demands.reduce((acc, d) => acc + (d.hrsNeg || 10), 0);

  const stageTotals: Record<ProcessStage, { planned: number; consumed: number }> = {
    kickoff: { planned: 0, consumed: 0 },
    parametrizacao: { planned: 0, consumed: 0 },
    treinamento: { planned: 0, consumed: 0 },
    homologacao: { planned: 0, consumed: 0 },
    tep_cs: { planned: 0, consumed: 0 },
    concluido: { planned: 0, consumed: 0 },
    pausado_cancelado: { planned: 0, consumed: 0 },
  };

  demands.forEach(d => {
    const calc = calculateDemandStageHours(d);
    STAGES_CONFIG.forEach(s => {
      stageTotals[s.id].planned += calc.stagePlanned[s.id] || 0;
      stageTotals[s.id].consumed += calc.stageConsumed[s.id] || 0;
    });
  });

  let cumPlanned = 0;
  let cumConsumed = 0;

  return STAGES_CONFIG.map(stage => {
    const planned = Math.round(stageTotals[stage.id].planned * 10) / 10;
    const consumed = Math.round(stageTotals[stage.id].consumed * 10) / 10;
    const saldo = Math.round((planned - consumed) * 10) / 10;
    const consumptionRate = planned > 0 ? Math.round((consumed / planned) * 100) : 0;

    cumPlanned += planned;
    cumConsumed += consumed;

    const isGargalo = consumed > planned;
    let statusGargalo: 'normal' | 'alerta' | 'critico' = 'normal';
    if (consumptionRate > 120) {
      statusGargalo = 'critico';
    } else if (consumptionRate >= 95) {
      statusGargalo = 'alerta';
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      stageOrder: stage.order,
      horasNegociadasEtapa: planned,
      horasConsumidasEtapa: consumed,
      saldoHorasEtapa: saldo,
      percentualConsumoEtapa: consumptionRate,
      isGargalo,
      statusGargalo,
      horasNegociadasAcumuladas: Math.round(cumPlanned * 10) / 10,
      horasConsumidasAcumuladas: Math.round(cumConsumed * 10) / 10,
      metaEscopoTotal: totalScopeHours,
      saldoAcumulado: Math.round((cumPlanned - cumConsumed) * 10) / 10,
    };
  });
}

/**
 * Computes productivity summary and bottleneck analysis for each implantador.
 */
export function calculateImplantadorProductivity(
  demands: Demand[],
  targetImplantador?: string
): ImplantadorProductivitySummary {
  const filteredDemands = targetImplantador && targetImplantador !== 'all'
    ? demands.filter(d => (d.implantador || 'Não Atribuído') === targetImplantador)
    : demands;

  const totalDemandas = filteredDemands.length;
  const demandasAtivas = filteredDemands.filter(d => d.status === 'Em Andamento').length;
  const demandasConcluidas = filteredDemands.filter(d => d.status === 'Concluída Geral').length;

  const horasNegociadas = filteredDemands.reduce((acc, d) => acc + (d.hrsNeg || 10), 0);

  const burnupPoints = calculateBurnupPoints(filteredDemands);

  const horasConsumidas = burnupPoints.length > 0
    ? burnupPoints[burnupPoints.length - 1].horasConsumidasAcumuladas
    : 0;

  const saldoHoras = Math.round((horasNegociadas - horasConsumidas) * 10) / 10;
  const taxaEficiencia = horasNegociadas > 0
    ? Math.round((horasConsumidas / horasNegociadas) * 100)
    : 0;

  // Identify worst bottleneck stage (highest consumed / planned ratio with actual volume)
  let worstStage = burnupPoints[0];
  let worstRatio = 0;
  burnupPoints.forEach(p => {
    if (p.horasConsumidasEtapa > 0 && p.percentualConsumoEtapa > worstRatio) {
      worstRatio = p.percentualConsumoEtapa;
      worstStage = p;
    }
  });

  const etapaMaiorGargalo = worstStage ? worstStage.stageName : 'Nenhum identificado';
  const gravidadeGargalo = worstRatio > 120
    ? 'critico'
    : worstRatio >= 95
    ? 'alerta'
    : 'normal';

  // Identify demands at risk of exceeding contract hours
  const demandasEmRisco: DemandBurnupRisk[] = [];
  filteredDemands
    .filter(d => d.status === 'Em Andamento')
    .forEach(d => {
      const calc = calculateDemandStageHours(d);
      const ratio = calc.hrsNeg > 0 ? (calc.totalConsumed / calc.hrsNeg) * 100 : 0;

      let statusRisco: 'normal' | 'alerta' | 'critico' = 'normal';
      let motivoGargalo = '';

      if (ratio > 100) {
        statusRisco = 'critico';
        motivoGargalo = `Estouro de orçamento: ${calc.totalConsumed}h gastas contra ${calc.hrsNeg}h contratadas`;
      } else if (ratio >= 80) {
        statusRisco = 'alerta';
        motivoGargalo = `Consumo de ${Math.round(ratio)}% das horas na etapa ${d.currentStage}`;
      } else if (d.daysLate > 0) {
        statusRisco = 'alerta';
        motivoGargalo = `Atraso de ${d.daysLate} dias em relação à previsão de entrega`;
      }

      if (statusRisco !== 'normal') {
        demandasEmRisco.push({
          seq: d.seq,
          razaoSocial: d.razaoSocial,
          implantador: d.implantador || 'Não Atribuído',
          hrsNeg: calc.hrsNeg,
          horasConsumidas: calc.totalConsumed,
          etapa: d.currentStage,
          percentualGasto: Math.round(ratio),
          statusRisco,
          motivoGargalo,
        });
      }
    });

  demandasEmRisco.sort((a, b) => b.percentualGasto - a.percentualGasto);

  return {
    implantador: targetImplantador || 'all',
    totalDemandas,
    demandasAtivas,
    demandasConcluidas,
    horasNegociadas,
    horasConsumidas,
    saldoHoras,
    taxaEficiencia,
    etapaMaiorGargalo,
    etapaMaiorGargaloId: worstStage?.stageId,
    gravidadeGargalo,
    burnupPoints,
    demandasEmRisco: demandasEmRisco.slice(0, 8),
  };
}

/**
 * Gets comparison rankings of all implantadores for productivity bottlenecks.
 */
export function getAllImplantadoresProductivity(demands: Demand[]): ImplantadorProductivitySummary[] {
  const implantadoresSet = new Set<string>();
  demands.forEach(d => {
    if (d.implantador && d.implantador.trim() !== '') {
      implantadoresSet.add(d.implantador);
    }
  });

  const list = Array.from(implantadoresSet);
  if (!list.includes('Leonardo')) list.push('Leonardo');
  if (!list.includes('Diogo')) list.push('Diogo');

  return list
    .map(name => calculateImplantadorProductivity(demands, name))
    .filter(s => s.totalDemandas > 0)
    .sort((a, b) => b.horasNegociadas - a.horasNegociadas);
}
