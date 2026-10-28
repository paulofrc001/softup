import { Demand, DemandStatus, DemandType, ProcessStage } from '../types';

export function parseDate(dateStr: string): Date | undefined {
  if (!dateStr || dateStr.trim() === '') return undefined;
  const clean = dateStr.trim().split(' ')[0]; // remove time if any

  // ISO format YYYY-MM-DD
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
  }

  // DD/MM/YY or DD/MM/YYYY
  const parts = clean.split('/');
  if (parts.length !== 3) return undefined;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  let year = parseInt(parts[2], 10);
  if (year < 100) {
    year += 2000;
  }
  return new Date(year, month, day);
}

// Current reference date for analysis is September 30, 2026 (matching dataset timeframe)
export const REFERENCE_DATE = new Date(2026, 8, 30); // 30/09/2026

export function calculateDaysBetween(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Fix common encoding glitches from legacy ERP/Retaguarda exports (Latin1 / Windows-1252)
export function sanitizeRetaguardaText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\uFFFD/g, 'ã') // replacement char
    .replace(/Incio/gi, 'Início')
    .replace(/Incio/gi, 'Início')
    .replace(/Razo/gi, 'Razão')
    .replace(/Razo/gi, 'Razão')
    .replace(/Mdulos/gi, 'Módulos')
    .replace(/Mdulos/gi, 'Módulos')
    .replace(/Concluso/gi, 'Conclusão')
    .replace(/Concluso/gi, 'Conclusão')
    .replace(/Concluda/gi, 'Concluída')
    .replace(/Concluda/gi, 'Concluída')
    .replace(/Implantao/gi, 'Implantação')
    .replace(/Implantaao/gi, 'Implantação')
    .replace(/Implantao/gi, 'Implantação')
    .replace(/Separao/gi, 'Separação')
    .replace(/Separao/gi, 'Separação')
    .replace(/Insatisfao/gi, 'Insatisfação')
    .replace(/Insatisfao/gi, 'Insatisfação')
    .replace(/Calados/gi, 'Calçados')
    .replace(/Calcados/gi, 'Calçados')
    .replace(/Confeces/gi, 'Confecções')
    .replace(/Confeces/gi, 'Confecções')
    .replace(/Iluminao/gi, 'Iluminação')
    .replace(/Prestao/gi, 'Prestação')
    .replace(/Servios/gi, 'Serviços')
    .replace(/Mi/gi, 'Miú')
    .replace(/Acan/gi, 'Acaná')
    .replace(/P/gi, 'Pé')
    .replace(/MVEIS/gi, 'MÓVEIS')
    .replace(/Antnio/gi, 'Antônio')
    .replace(/gata/gi, 'Ágata');
}

export function normalizeStatus(raw: string, conclusaoStr: string): DemandStatus {
  const s = sanitizeRetaguardaText(raw || '').toLowerCase().trim();
  if (s.includes('cs') || s.includes('tep')) {
    return 'Concluída (CS Finalizar TEP)';
  }
  if (s.includes('conclu') || s.includes('finaliz')) {
    return 'Concluída Geral';
  }
  if (s.includes('cancel')) {
    return 'Cancelada';
  }
  if (s.includes('paus')) {
    return 'Pausada';
  }
  if (s.includes('andamento')) {
    return 'Em Andamento';
  }
  if (conclusaoStr && conclusaoStr.trim()) {
    return 'Concluída Geral';
  }
  return 'Em Andamento';
}

export function normalizeTipo(raw: string): DemandType {
  const t = sanitizeRetaguardaText(raw || '').toLowerCase().trim();
  if (t.includes('upsell') || t.includes('módulo') || t.includes('modulo')) {
    return 'UpSell - Novos Módulos';
  }
  if (t.includes('insatisfa')) {
    return 'Acompanhamento Insatisfação';
  }
  if (t.includes('treinamento')) {
    return 'Acompanhamento Treinamento';
  }
  if (t.includes('nova')) {
    return 'Nova Implantação';
  }
  return 'Outros';
}

export function parseCsvData(csvText: string): Demand[] {
  const cleanedText = sanitizeRetaguardaText(csvText);
  const lines = cleanedText.trim().split('\n');
  if (lines.length < 2) return [];

  // Auto-detect delimiter from the header (; or ,)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  const demands: Demand[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by detected delimiter while respecting quoted cells
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    if (cols.length < 11) continue;

    const seq = parseInt(cols[0], 10);
    if (isNaN(seq)) continue;

    const prevInicioStr = cols[1] || '';
    const prevFimStr = cols[2] || '';
    const implantador = cols[3]?.trim() || '';
    const clienteId = cols[4]?.trim() || '';
    const razaoSocial = sanitizeRetaguardaText(cols[5]?.trim() || '');
    const comercial = cols[6]?.trim() || '';
    const hrsNeg = parseFloat((cols[7] || '').replace(',', '.')) || 0;
    const pessoasTreinar = parseInt(cols[8], 10) || 0;
    const totModulos = parseInt(cols[9], 10) || 0;
    const conclusaoStr = cols[10]?.trim() || '';
    const rawStatus = cols[11]?.trim() || '';
    const rawTipo = cols[12]?.trim() || '';

    // Standardize status and type
    const status = normalizeStatus(rawStatus, conclusaoStr);
    const tipo = normalizeTipo(rawTipo);

    const startDate = parseDate(prevInicioStr);
    const endDate = parseDate(prevFimStr);
    const completionDate = parseDate(conclusaoStr);

    // Calculate days open
    let daysOpen = 0;
    if (startDate) {
      const calcEnd = completionDate || REFERENCE_DATE;
      daysOpen = Math.max(0, calculateDaysBetween(startDate, calcEnd));
    }

    // Overdue days
    let daysLate = 0;
    if (endDate && !completionDate && status === 'Em Andamento') {
      const diff = calculateDaysBetween(endDate, REFERENCE_DATE);
      if (diff > 0) daysLate = diff;
    }

    // Determine current stage & bottlenecks
    let currentStage: ProcessStage = 'kickoff';
    const bottlenecks: string[] = [];
    let progressPercent = 10;

    if (status === 'Concluída Geral') {
      currentStage = 'concluido';
      progressPercent = 100;
    } else if (status === 'Concluída (CS Finalizar TEP)') {
      currentStage = 'tep_cs';
      progressPercent = 90;
      bottlenecks.push('Aguardando emissão e assinatura do TEP / Validação pelo CS');
    } else if (status === 'Cancelada' || status === 'Pausada') {
      currentStage = 'pausado_cancelado';
      progressPercent = status === 'Cancelada' ? 0 : 40;
    } else {
      // In progress
      if (!implantador || implantador === '') {
        currentStage = 'kickoff';
        progressPercent = 15;
        bottlenecks.push('Sem implantador alocado na fila');
      } else if (totModulos >= 4 && hrsNeg < totModulos * 2.5) {
        currentStage = 'parametrizacao';
        progressPercent = 35;
        bottlenecks.push(`Gargalo de Escopo: ${totModulos} módulos com apenas ${hrsNeg}h contratadas`);
      } else if (pessoasTreinar >= 3) {
        currentStage = 'treinamento';
        progressPercent = 55;
        bottlenecks.push(`Treinamento Complexo: ${pessoasTreinar} pessoas para capacitar`);
      } else if (daysLate > 0) {
        currentStage = 'homologacao';
        progressPercent = 75;
        bottlenecks.push(`Atraso na Homologação: Venceu há ${daysLate} dias`);
      } else {
        currentStage = 'treinamento';
        progressPercent = 50;
      }
    }

    let daysSinceLastEvolution = 0;
    let weeklyEvolutionState: 'critico' | 'alerta' | 'em_dia' | 'concluido' | 'inativo' = 'em_dia';

    if (status === 'Em Andamento') {
      if (!implantador) {
        daysSinceLastEvolution = startDate ? calculateDaysBetween(startDate, REFERENCE_DATE) : 21;
      } else if (daysLate > 30) {
        daysSinceLastEvolution = Math.min(daysLate, 45);
      } else if (daysLate > 0) {
        daysSinceLastEvolution = daysLate + 7;
      } else if (startDate) {
        const openedDays = calculateDaysBetween(startDate, REFERENCE_DATE);
        daysSinceLastEvolution = Math.min(openedDays, 14);
      } else {
        daysSinceLastEvolution = 10;
      }

      if (daysSinceLastEvolution > 14) {
        weeklyEvolutionState = 'critico';
        bottlenecks.push(`Estagnado: Sem evolução semanal há mais de ${daysSinceLastEvolution} dias`);
      } else if (daysSinceLastEvolution >= 7) {
        weeklyEvolutionState = 'alerta';
        bottlenecks.push(`Atenção: Sem evolução semanal há ${daysSinceLastEvolution} dias`);
      } else {
        weeklyEvolutionState = 'em_dia';
      }
    } else if (status === 'Concluída Geral') {
      weeklyEvolutionState = 'concluido';
    } else {
      weeklyEvolutionState = 'inativo';
    }

    demands.push({
      seq,
      prevInicio: prevInicioStr,
      prevFim: prevFimStr,
      implantador: implantador || 'Não Atribuído',
      clienteId,
      razaoSocial,
      comercial,
      hrsNeg,
      pessoasTreinar,
      totModulos,
      conclusao: conclusaoStr,
      status,
      tipo,
      startDate,
      endDate,
      completionDate,
      daysOpen,
      daysLate,
      daysSinceLastEvolution,
      weeklyEvolutionState,
      currentStage,
      progressPercent,
      bottlenecks,
      checkIns: [
        {
          date: '28/09/2026',
          stage: currentStage,
          progressPercent,
          note: bottlenecks.length > 0 ? bottlenecks.join('; ') : 'Acompanhamento de rotina',
          blocker: bottlenecks[0]
        }
      ]
    });
  }

  return demands;
}

export interface RetaguardaComparisonResult {
  newDemands: Demand[];
  statusChanges: {
    seq: number;
    clienteId: string;
    razaoSocial: string;
    implantador: string;
    oldStatus: DemandStatus;
    newStatus: DemandStatus;
    conclusao?: string;
  }[];
  divergences: {
    seq: number;
    razaoSocial: string;
    description: string;
  }[];
  identicalOngoingCount: number;
  totalIncoming: number;
  mergedDemands: Demand[];
}

// Compare current database demands against incoming retaguarda export
export function compareAndMergeRetaguarda(
  currentDemands: Demand[],
  incomingCsv: string
): RetaguardaComparisonResult {
  const incomingDemands = parseCsvData(incomingCsv);
  const currentMap = new Map<number, Demand>();
  currentDemands.forEach(d => currentMap.set(d.seq, d));

  const newDemands: Demand[] = [];
  const statusChanges: RetaguardaComparisonResult['statusChanges'] = [];
  const divergences: RetaguardaComparisonResult['divergences'] = [];
  let identicalOngoingCount = 0;

  const mergedMap = new Map<number, Demand>();

  // Keep all existing demands by default
  currentDemands.forEach(d => mergedMap.set(d.seq, { ...d }));

  const nowIso = new Date().toISOString();
  const todayPt = new Date().toLocaleDateString('pt-BR');

  incomingDemands.forEach(inc => {
    const existing = currentMap.get(inc.seq);

    if (!existing) {
      // 1. BRAND NEW DEMAND FROM RETAGUARDA
      const newDemand: Demand = {
        ...inc,
        lastUpdatedAt: nowIso,
        lastChangeSummary: 'Nova implantação importada da retaguarda',
        updatedThisWeek: true,
      };
      newDemands.push(newDemand);
      mergedMap.set(inc.seq, newDemand);
    } else {
      // 2. EXISTING DEMAND - CHECK AND RECONCILE STATUS
      const statusChanged = existing.status !== inc.status;

      if (statusChanged) {
        statusChanges.push({
          seq: inc.seq,
          clienteId: inc.clienteId,
          razaoSocial: existing.razaoSocial || inc.razaoSocial,
          implantador: existing.implantador || inc.implantador,
          oldStatus: existing.status,
          newStatus: inc.status,
          conclusao: inc.conclusao,
        });

        if (existing.status === 'Em Andamento' && (inc.status === 'Concluída Geral' || inc.status === 'Cancelada')) {
          divergences.push({
            seq: inc.seq,
            razaoSocial: existing.razaoSocial,
            description: `Retaguarda alterou de 'Em Andamento' para '${inc.status}'.`,
          });
        }
      } else {
        if (inc.status === 'Em Andamento') {
          identicalOngoingCount++;
        }
      }

      // Merge intelligent updates into existing:
      // - Keep local implantador if incoming is empty/unassigned
      const mergedImplantador = (inc.implantador && inc.implantador !== 'Não Atribuído')
        ? inc.implantador
        : existing.implantador;

      // - Update stage / progress if status completed
      let mergedStage = existing.currentStage;
      let mergedProgress = existing.progressPercent;
      let mergedEvolutionState = existing.weeklyEvolutionState;

      if (inc.status === 'Concluída Geral') {
        mergedStage = 'concluido';
        mergedProgress = 100;
        mergedEvolutionState = 'concluido';
      } else if (inc.status === 'Cancelada' || inc.status === 'Pausada') {
        mergedStage = 'pausado_cancelado';
        mergedEvolutionState = 'inativo';
      } else if (inc.status === 'Concluída (CS Finalizar TEP)') {
        mergedStage = 'tep_cs';
        mergedProgress = Math.max(existing.progressPercent, 90);
      }

      // Check-ins: preserve local check-ins, add a note if status changed
      const updatedCheckIns = [...(existing.checkIns || [])];
      if (statusChanged) {
        updatedCheckIns.unshift({
          date: todayPt,
          note: `Status atualizado pela Retaguarda: de '${existing.status}' para '${inc.status}'.`,
          progressPercent: mergedProgress,
          stage: mergedStage,
        });
      }

      const mergedDemand: Demand = {
        ...existing,
        // Update retaguarda fields
        prevInicio: inc.prevInicio || existing.prevInicio,
        prevFim: inc.prevFim || existing.prevFim,
        conclusao: inc.conclusao || existing.conclusao,
        status: inc.status,
        tipo: inc.tipo || existing.tipo,
        hrsNeg: inc.hrsNeg || existing.hrsNeg,
        pessoasTreinar: inc.pessoasTreinar || existing.pessoasTreinar,
        totModulos: inc.totModulos || existing.totModulos,
        implantador: mergedImplantador,
        currentStage: mergedStage,
        progressPercent: mergedProgress,
        weeklyEvolutionState: mergedEvolutionState,
        checkIns: updatedCheckIns,
        lastUpdatedAt: statusChanged ? nowIso : existing.lastUpdatedAt,
        lastChangeSummary: statusChanged
          ? `Status atualizado pela Retaguarda para '${inc.status}'`
          : existing.lastChangeSummary,
        updatedThisWeek: statusChanged ? true : existing.updatedThisWeek,
      };

      mergedMap.set(inc.seq, mergedDemand);
    }
  });

  const mergedDemands = Array.from(mergedMap.values()).sort((a, b) => b.seq - a.seq);

  return {
    newDemands,
    statusChanges,
    divergences,
    identicalOngoingCount,
    totalIncoming: incomingDemands.length,
    mergedDemands,
  };
}
