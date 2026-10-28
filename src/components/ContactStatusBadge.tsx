import React from 'react';
import { Demand, AlertThresholdSettings } from '../types';
import { getDemandContactInfo, formatContactDateTime } from '../utils/contactUtils';
import { 
  PhoneCall, 
  PhoneOff, 
  CheckCircle2, 
  Clock, 
  History, 
  PlusCircle, 
  User,
  Calendar,
  Sparkles
} from 'lucide-react';

interface ContactStatusBadgeProps {
  demand: Demand;
  thresholds?: AlertThresholdSettings;
  onOpenRegisterContact: (demand: Demand) => void;
  onOpenHistory: (demand: Demand) => void;
  compact?: boolean;
}

export const ContactStatusBadge: React.FC<ContactStatusBadgeProps> = ({
  demand,
  thresholds,
  onOpenRegisterContact,
  onOpenHistory,
  compact = false,
}) => {
  const contactInfo = getDemandContactInfo(demand, thresholds);
  const latestInteraction = demand.latestContactInteraction;

  // Has direct interaction record
  if (latestInteraction) {
    const isSuccess = latestInteraction.lastStatus === 'SUCCESS' || latestInteraction.lastStatus === 'Contato realizado com sucesso';
    const timeFormatted = formatContactDateTime(latestInteraction.lastContactedAt);

    if (compact) {
      return (
        <div className="flex flex-col items-center gap-1">
          {/* Status Badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
            isSuccess 
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            ) : (
              <PhoneOff className="w-3 h-3 text-amber-400" />
            )}
            <span>{isSuccess ? 'Sucesso' : 'Sem retorno'}</span>
          </span>

          {/* Date & Time */}
          <span className="text-[9px] text-slate-400 font-mono text-center">
            {timeFormatted.formattedDate} {timeFormatted.formattedTime ? `às ${timeFormatted.formattedTime}` : ''}
          </span>

          {/* Quick Action buttons */}
          <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onOpenRegisterContact(demand)}
              className="text-[9px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
              title="Registrar novo contato"
            >
              + Contato
            </button>
            <span className="text-slate-600 text-[9px]">·</span>
            <button
              type="button"
              onClick={() => onOpenHistory(demand)}
              className="text-[9px] font-semibold text-slate-400 hover:text-slate-200 underline"
              title="Ver histórico de contatos"
            >
              Histórico ({latestInteraction.totalCount})
            </button>
          </div>
        </div>
      );
    }

    // Full Card View (used in DemandDetailModal and Demand cards)
    return (
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3 shadow-xs">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wider">
            <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
            <span>Situação do Contato</span>
          </div>

          {/* Interactive Badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-xs ${
            isSuccess 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <PhoneOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isSuccess ? 'Contato realizado com sucesso' : 'Sem retorno'}</span>
          </span>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400 block">Último contato:</span>
            <span className="font-mono text-slate-200 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{timeFormatted.fullFormatted || latestInteraction.lastContactedAt}</span>
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400 block">Status:</span>
            <span className={`font-semibold ${isSuccess ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isSuccess ? 'Contato realizado com sucesso' : 'Sem retorno'}
              {latestInteraction.lastUserId && (
                <span className="text-slate-400 font-normal"> — {latestInteraction.lastUserId}</span>
              )}
            </span>
          </div>
        </div>

        {/* Action Buttons: Registrar Contato & Ver Histórico */}
        <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onOpenRegisterContact(demand)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950/40"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Registrar Contato</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenHistory(demand)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700/80"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ver histórico ({latestInteraction.totalCount})</span>
          </button>
        </div>
      </div>
    );
  }

  // If no direct contact interaction has been registered yet, show standard check-in SLA status with the actions
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${contactInfo.statusBadgeClass}`}>
          {contactInfo.daysWithoutContact === 0 ? 'Hoje' : `${contactInfo.daysWithoutContact}d`}
        </span>
        <span className="text-[9px] text-slate-400 font-mono">
          {contactInfo.lastContactDateStr || 'sem registro'}
        </span>
        <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onOpenRegisterContact(demand)}
            className="text-[9px] font-bold text-cyan-400 hover:text-cyan-300 underline"
            title="Registrar contato"
          >
            + Registrar Contato
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3 shadow-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wider">
          <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
          <span>Validação de Contato</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${contactInfo.statusBadgeClass}`}>
          {contactInfo.daysWithoutContact === 0 ? 'Hoje' : `${contactInfo.daysWithoutContact} dias sem contato`}
        </span>
      </div>

      <div className="text-xs text-slate-300 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Último contato registrado:</span>
          <span className="font-mono font-medium text-slate-200">
            {contactInfo.lastContactDateStr || <span className="text-rose-400">Nenhum</span>}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Situação SLA:</span>
          <span className="font-medium text-slate-200">
            {contactInfo.isCritical 
              ? <span className="text-rose-400 font-bold">Crítico (&gt;{thresholds?.criticalDays || 14} dias)</span>
              : contactInfo.isAlert 
              ? <span className="text-amber-400 font-bold">Alerta ({thresholds?.alertDays || 7} a {thresholds?.criticalDays || 14} dias)</span>
              : contactInfo.isUpToDate 
              ? <span className="text-emerald-400 font-bold">Em Dia</span>
              : <span className="text-slate-400">Sem Contato Registrado</span>}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-900 flex items-center justify-between gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onOpenRegisterContact(demand)}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950/40"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Registrar Contato</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenHistory(demand)}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors border border-slate-700/80"
        >
          <History className="w-3.5 h-3.5 text-indigo-400" />
          <span>Ver histórico</span>
        </button>
      </div>
    </div>
  );
};
