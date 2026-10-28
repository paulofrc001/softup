import { Demand, AlertThresholdSettings, LatestContactSummary } from '../types';
import { parseDate, calculateDaysBetween, REFERENCE_DATE } from './parser';

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholdSettings = {
  criticalDays: 14,
  alertDays: 7,
};

export interface DemandContactInfo {
  hasContact: boolean;
  lastContactDateStr?: string;
  daysWithoutContact: number;
  isCritical: boolean; // >criticalDays (padrão >14 dias)
  isAlert: boolean; // alertDays a criticalDays (padrão 7 a 14 dias)
  isUnassigned: boolean; // Sem implantador
  isUpToDate: boolean; // Em dia (<alertDays)
  statusLabel: string;
  statusBadgeClass: string;
  // Nova funcionalidade: Registro de Contato Direto
  latestInteraction?: LatestContactSummary;
  interactionStatusBadge?: {
    label: string;
    badgeClass: string;
    badgeColor: 'green' | 'amber' | 'slate';
    isSuccess: boolean;
  };
}

/**
 * Formats a contact date and time string into human-readable format.
 * Ex: "08/10/2026 às 09:35"
 */
export function formatContactDateTime(dateStr?: string): { 
  formattedDate: string; 
  formattedTime?: string; 
  fullFormatted: string;
} {
  if (!dateStr) return { formattedDate: '', fullFormatted: '' };
  try {
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return {
          formattedDate: `${dd}/${mm}/${yyyy}`,
          formattedTime: `${hh}:${min}`,
          fullFormatted: `${dd}/${mm}/${yyyy} às ${hh}:${min}`
        };
      }
    }
    return {
      formattedDate: dateStr,
      fullFormatted: dateStr
    };
  } catch (e) {
    return { formattedDate: dateStr, fullFormatted: dateStr };
  }
}

/**
 * Computes contact validation status for a demand.
 * Rule: Contatos registrados via contact_interactions e Check-ins / Apontamento de Esforço
 * são combinados para identificar a data e o status mais recente.
 */
export function getDemandContactInfo(
  demand: Demand,
  thresholds: AlertThresholdSettings = DEFAULT_ALERT_THRESHOLDS
): DemandContactInfo {
  const isUnassigned = !demand.implantador || demand.implantador === 'Não Atribuído' || demand.implantador.trim() === '';

  // Look for registered check-ins or acompanhamentos
  const checkIns = demand.checkIns || [];
  const latestInteraction = demand.latestContactInteraction;
  const hasContact = checkIns.length > 0 || Boolean(latestInteraction);

  let daysWithoutContact = 0;
  let lastContactDateStr: string | undefined = undefined;
  let latestDate: Date | undefined = undefined;

  // 1. Check check-ins
  if (checkIns.length > 0) {
    checkIns.forEach(c => {
      if (c.date) {
        const parsed = parseDate(c.date);
        if (parsed) {
          if (!latestDate || parsed.getTime() > latestDate.getTime()) {
            latestDate = parsed;
            lastContactDateStr = c.date;
          }
        }
      }
    });
  }

  // 2. Check latest registered contact interaction
  if (latestInteraction && latestInteraction.lastContactedAt) {
    let interactionDate: Date | undefined = undefined;
    if (latestInteraction.lastContactedAt.includes('T') || latestInteraction.lastContactedAt.includes('-')) {
      const parsedIso = new Date(latestInteraction.lastContactedAt);
      if (!isNaN(parsedIso.getTime())) {
        interactionDate = parsedIso;
      }
    } else {
      interactionDate = parseDate(latestInteraction.lastContactedAt);
    }

    if (interactionDate) {
      const currentDate: any = latestDate;
      if (!currentDate || interactionDate.getTime() > currentDate.getTime()) {
        latestDate = interactionDate;
        const fmt = formatContactDateTime(latestInteraction.lastContactedAt);
        lastContactDateStr = fmt.fullFormatted || latestInteraction.lastContactedAt;
      }
    }
  }

  if (latestDate) {
    daysWithoutContact = Math.max(0, calculateDaysBetween(latestDate, REFERENCE_DATE));
  } else if (!hasContact) {
    // No contact has ever been registered for this demand
    if (demand.prevInicio) {
      const start = parseDate(demand.prevInicio);
      if (start) {
        daysWithoutContact = Math.max(0, calculateDaysBetween(start, REFERENCE_DATE));
      } else {
        daysWithoutContact = demand.daysOpen || (thresholds.criticalDays + 1);
      }
    } else {
      daysWithoutContact = demand.daysOpen || (thresholds.criticalDays + 1);
    }
  }

  // Only consider active demands for critical / alert SLAs
  const isOngoing = demand.status === 'Em Andamento';

  const isCritical = isOngoing && daysWithoutContact > thresholds.criticalDays;
  const isAlert = isOngoing && daysWithoutContact >= thresholds.alertDays && daysWithoutContact <= thresholds.criticalDays;
  const isUpToDate = hasContact && daysWithoutContact < thresholds.alertDays;

  let statusLabel = 'Sem Registro de Contato';
  let statusBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';

  if (!isOngoing) {
    statusLabel = demand.status;
    statusBadgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
  } else if (isCritical) {
    statusLabel = `Crítico (${daysWithoutContact} dias sem contato)`;
    statusBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  } else if (isAlert) {
    statusLabel = `Alerta (${daysWithoutContact} dias sem contato)`;
    statusBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  } else if (isUpToDate) {
    statusLabel = daysWithoutContact === 0 ? 'Contato Hoje' : `Contato há ${daysWithoutContact}d`;
    statusBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }

  // Interaction Status Badge (se houver registro direto)
  let interactionStatusBadge: DemandContactInfo['interactionStatusBadge'] = undefined;
  if (latestInteraction) {
    const isSuccess = latestInteraction.lastStatus === 'SUCCESS';
    interactionStatusBadge = {
      label: isSuccess ? 'Contato realizado com sucesso' : 'Sem retorno',
      badgeClass: isSuccess 
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
        : 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      badgeColor: isSuccess ? 'green' : 'amber',
      isSuccess
    };
  }

  return {
    hasContact,
    lastContactDateStr,
    daysWithoutContact,
    isCritical,
    isAlert,
    isUnassigned,
    isUpToDate,
    statusLabel,
    statusBadgeClass,
    latestInteraction,
    interactionStatusBadge,
  };
}

export interface ContactValidationCounts {
  totalDemands: number;
  totalOngoing: number;
  todasSemContato: number;
  critico: number; // >criticalDays
  alerta: number; // alertDays a criticalDays
  semImplantador: number;
  emDia: number;
  retaguardaAtualizado: number;
  retaguardaPendente: number;
}

export function getContactValidationCounts(
  demands: Demand[],
  thresholds: AlertThresholdSettings = DEFAULT_ALERT_THRESHOLDS
): ContactValidationCounts {
  const ongoing = demands.filter(d => d.status === 'Em Andamento');

  let criticoCount = 0;
  let alertaCount = 0;
  let semImplantadorCount = 0;
  let emDiaCount = 0;
  let retaguardaAtualizadoCount = 0;
  let retaguardaPendenteCount = 0;

  ongoing.forEach(d => {
    const info = getDemandContactInfo(d, thresholds);
    if (info.isCritical) criticoCount++;
    else if (info.isAlert) alertaCount++;
    else if (info.isUpToDate) emDiaCount++;

    if (info.isUnassigned) semImplantadorCount++;

    if (d.retaguardaAtualizado) retaguardaAtualizadoCount++;
    else retaguardaPendenteCount++;
  });

  // "Todas Sem contato" includes critical and alert (i.e. demands without contact in the SLA window of >= alertDays)
  const todasSemContatoCount = criticoCount + alertaCount;

  return {
    totalDemands: demands.length,
    totalOngoing: ongoing.length,
    todasSemContato: todasSemContatoCount,
    critico: criticoCount,
    alerta: alertaCount,
    semImplantador: semImplantadorCount,
    emDia: emDiaCount,
    retaguardaAtualizado: retaguardaAtualizadoCount,
    retaguardaPendente: retaguardaPendenteCount,
  };
}
