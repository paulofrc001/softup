import React, { useMemo } from 'react';
import { Demand, AlertThresholdSettings } from '../types';
import { getContactValidationCounts, DEFAULT_ALERT_THRESHOLDS } from '../utils/contactUtils';
import { 
  PhoneCall, 
  PhoneOff, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react';

interface ContactKpiPanelProps {
  demands: Demand[];
  thresholds?: AlertThresholdSettings;
  onViewAll?: () => void;
  onViewWithoutContact?: () => void;
  onViewWithContact?: () => void;
  onOpenSettings?: () => void;
}

export const ContactKpiPanel: React.FC<ContactKpiPanelProps> = ({
  demands,
  thresholds = DEFAULT_ALERT_THRESHOLDS,
  onViewAll,
  onViewWithoutContact,
  onViewWithContact,
  onOpenSettings,
}) => {
  const counts = useMemo(
    () => getContactValidationCounts(demands, thresholds),
    [demands, thresholds]
  );

  const ongoingTotal = counts.totalOngoing;
  const contactRate = ongoingTotal > 0
    ? Math.round((counts.emDia / ongoingTotal) * 100)
    : 0;

  const withoutContactRate = ongoingTotal > 0
    ? Math.round((counts.todasSemContato / ongoingTotal) * 100)
    : 0;

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-xl space-y-4">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wide">
              <span>Painel de Indicadores de Contato com Clientes</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
              SLA {thresholds.alertDays} Dias
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Validação automatizada via histórico de <strong>Check-ins</strong> e <strong>Apontamento de Esforço</strong> para identificar contatos recentes em cada cliente.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden md:inline">Critério SLA:</span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-slate-300 border border-slate-800 font-mono text-[11px]">
            Últimos {thresholds.alertDays} dias corridos
          </span>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              title="Personalizar limiares de alerta e crítico"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Configurar Limiares</span>
            </button>
          )}
        </div>
      </div>

      {/* The 3 Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Todas (Total) */}
        <div
          onClick={onViewAll}
          className="relative p-5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/60 transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-indigo-950/20 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-200 transition-colors">
                Todas (Total)
              </span>
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-100 group-hover:text-white transition-colors">
                {counts.totalDemands}
              </div>
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">{counts.totalOngoing} ativas</strong> em andamento • {counts.totalDemands - counts.totalOngoing} concluídas/outros
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-xs text-indigo-400 font-semibold group-hover:text-indigo-300">
            <span>Ver tabela completa</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 2: Sem Contato (Últimos X dias) */}
        <div
          onClick={onViewWithoutContact}
          className="relative p-5 rounded-xl bg-gradient-to-b from-rose-950/30 to-slate-950/80 border border-rose-900/60 hover:border-rose-500 transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-rose-950/30 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <span>Sem Contato (Últimos {thresholds.alertDays} dias)</span>
              </span>
              <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 group-hover:scale-105 transition-transform">
                <PhoneOff className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-rose-300 group-hover:text-rose-200 transition-colors flex items-baseline gap-2">
                <span>{counts.todasSemContato}</span>
                <span className="text-xs font-normal text-rose-400 font-sans">
                  ({withoutContactRate}% da carteira)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-rose-400">{counts.critico} críticos</strong> (&gt;{thresholds.criticalDays}d) • <strong className="text-amber-400">{counts.alerta} em alerta</strong> ({thresholds.alertDays} a {thresholds.criticalDays}d)
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-900/40 flex items-center justify-between text-xs text-rose-400 font-semibold group-hover:text-rose-300">
            <span>Abrir validação de contatos</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Card 3: Contato Realizado */}
        <div
          onClick={onViewWithContact}
          className="relative p-5 rounded-xl bg-gradient-to-b from-emerald-950/30 to-slate-950/80 border border-emerald-900/60 hover:border-emerald-500 transition-all duration-200 cursor-pointer group shadow-sm hover:shadow-emerald-950/30 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>Contato Realizado</span>
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:scale-105 transition-transform">
                <PhoneCall className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-300 group-hover:text-emerald-200 transition-colors flex items-baseline gap-2">
                <span>{counts.emDia}</span>
                <span className="text-xs font-normal text-emerald-400 font-sans">
                  ({contactRate}% da carteira)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Clientes que receberam check-in ou apontamento dentro do SLA de {thresholds.alertDays} dias
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-900/40 flex items-center justify-between text-xs text-emerald-400 font-semibold group-hover:text-emerald-300">
            <span>Ver evoluções da semana</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Visual Progress Bar: Cobertura de Contato da Carteira Ativa */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">
              Cobertura de Contato na Carteira Ativa ({counts.totalOngoing} demandas em andamento)
            </span>
          </div>
          <span className="font-mono text-slate-300 text-xs font-bold">
            {contactRate}% com contato realizado • {withoutContactRate}% sem contato
          </span>
        </div>

        {/* Multi-segment bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${contactRate}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`Contato Realizado: ${counts.emDia} demandas (${contactRate}%)`}
          />
          <div
            style={{ width: `${withoutContactRate}%` }}
            className="h-full bg-rose-500 transition-all duration-500"
            title={`Sem Contato: ${counts.todasSemContato} demandas (${withoutContactRate}%)`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Contato Realizado: <strong className="text-emerald-300 font-mono">{counts.emDia}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span>Sem Contato (&gt;{thresholds.alertDays}d): <strong className="text-rose-300 font-mono">{counts.todasSemContato}</strong></span>
            </span>
          </div>

          <span className="text-[10px] text-slate-500">
            Registro de Novo Acompanhamento & Apontamento de Esforço atualiza automaticamente a demanda
          </span>
        </div>
      </div>
    </div>
  );
};
