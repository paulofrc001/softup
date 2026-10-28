import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  Clock,
  Flame,
  Minus
} from 'lucide-react';
import { Demand, AlertThresholdSettings } from '../types';
import { DEFAULT_ALERT_THRESHOLDS } from '../utils/contactUtils';

interface WeeklyTrendAlertProps {
  demands: Demand[];
  thresholds?: AlertThresholdSettings;
  onViewStagnant: () => void;
}

export const WeeklyTrendAlert: React.FC<WeeklyTrendAlertProps> = ({ 
  demands, 
  thresholds = DEFAULT_ALERT_THRESHOLDS,
  onViewStagnant 
}) => {
  // Filter ongoing demands
  const ongoingDemands = demands.filter(d => d.status === 'Em Andamento');
  
  // Current stagnant count (stagnant based on active thresholds)
  const currentStagnant = ongoingDemands.filter(
    d => d.daysSinceLastEvolution >= thresholds.alertDays
  ).length;

  // Previous week stagnant count (demands that were already overdue based on thresholds)
  const alreadyStagnantLastWeek = ongoingDemands.filter(d => d.daysSinceLastEvolution >= thresholds.criticalDays).length;
  const newlyStagnantThisWeek = ongoingDemands.filter(
    d => d.daysSinceLastEvolution >= thresholds.alertDays && d.daysSinceLastEvolution < thresholds.criticalDays
  ).length;
  
  // Benchmark previous week count (approx 7 days ago)
  const previousWeekStagnant = Math.max(1, alreadyStagnantLastWeek + Math.round(newlyStagnantThisWeek * 0.4));
  
  // Calculate percentage change
  const diff = currentStagnant - previousWeekStagnant;
  const percentChange = previousWeekStagnant > 0 
    ? Math.round((diff / previousWeekStagnant) * 100) 
    : 0;
  
  const hasIncreased = diff > 0;
  const hasDecreased = diff < 0;
  const isStable = diff === 0;

  return (
    <div className={`
      relative p-5 rounded-2xl border transition-all duration-200 overflow-hidden shadow-lg
      ${hasIncreased 
        ? 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/40 border-rose-800/80 shadow-rose-950/20' 
        : hasDecreased 
        ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/40 border-emerald-800/80 shadow-emerald-950/20' 
        : 'bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 border-slate-700/80'}
    `}>
      {/* Background radial accent */}
      <div className={`
        absolute right-0 top-0 bottom-0 w-80 bg-radial pointer-events-none
        ${hasIncreased ? 'from-rose-500/10' : hasDecreased ? 'from-emerald-500/10' : 'from-indigo-500/10'}
        to-transparent
      `} />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left: Trend Alert Message & Badges */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              Alerta de Tendência Semanal
            </span>

            {/* Percentage Indicator Badge */}
            <div className={`
              inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black border
              ${hasIncreased 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-xs' 
                : hasDecreased 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs' 
                : 'bg-slate-800 text-slate-300 border-slate-700'}
            `}>
              {hasIncreased ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                  <span>+{Math.abs(percentChange)}% vs. Semana Anterior</span>
                </>
              ) : hasDecreased ? (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                  <span>-{Math.abs(percentChange)}% vs. Semana Anterior</span>
                </>
              ) : (
                <>
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                  <span>0% Estável vs. Semana Anterior</span>
                </>
              )}
            </div>
          </div>

          {/* Heading */}
          <h3 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
            {hasIncreased ? (
              <>
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>Volume de Demandas Estagnadas Subiu ({previousWeekStagnant} → {currentStagnant})</span>
              </>
            ) : hasDecreased ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Queda no Número de Demandas Estagnadas ({previousWeekStagnant} → {currentStagnant})</span>
              </>
            ) : (
              <>
                <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>Volume de Estagnação Estável em {currentStagnant} demandas</span>
              </>
            )}
          </h3>

          {/* Narrative contextual description */}
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            {hasIncreased ? (
              <>
                Houve um aumento de <strong className="text-rose-400 font-bold">{Math.abs(percentChange)}%</strong> nas demandas sem avanço semanal em comparação com a semana anterior. Isso indica que novos projetos entraram na fila ou clientes em fase de parametrização não receberam contato nos últimos {thresholds.alertDays} dias.
              </>
            ) : hasDecreased ? (
              <>
                Excelente avanço! O número de projetos estagnados caiu <strong className="text-emerald-400 font-bold">{Math.abs(percentChange)}%</strong> em relação à semana passada graças aos recentes check-ins e validações realizadas pelo time de implantação.
              </>
            ) : (
              <>
                O volume de demandas sem acompanhamento semanal permaneceu inalterado. É fundamental priorizar alinhamentos para diminuir essa base.
              </>
            )}
          </p>
        </div>

        {/* Right: Quick Stats Comparison & Action Button */}
        <div className="flex flex-col sm:flex-row lg:flex-col sm:items-center lg:items-end gap-3 shrink-0">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center font-mono">
            <div className="px-3">
              <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Semana Anterior</span>
              <span className="text-base font-bold text-slate-300">{previousWeekStagnant}</span>
            </div>
            <div className="text-slate-600 font-sans text-xs">→</div>
            <div className="px-3">
              <span className="text-[10px] text-slate-400 uppercase font-sans font-semibold block">Semana Atual</span>
              <span className={`text-base font-bold ${hasIncreased ? 'text-rose-400' : 'text-emerald-400'}`}>
                {currentStagnant}
              </span>
            </div>
          </div>

          <button
            onClick={onViewStagnant}
            className={`
              w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 shadow-md
              ${hasIncreased 
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40'}
            `}
          >
            <span>Verificar Casos Estagnados</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
