import React from 'react';
import { Demand } from '../types';
import { 
  Sparkles, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  User, 
  FileText,
  Activity
} from 'lucide-react';

interface WeeklyUpdatedOverviewSectionProps {
  demands: Demand[];
  onSelectDemand: (demand: Demand) => void;
  onViewAllWeekly: () => void;
}

export const WeeklyUpdatedOverviewSection: React.FC<WeeklyUpdatedOverviewSectionProps> = ({
  demands,
  onSelectDemand,
  onViewAllWeekly,
}) => {
  // Get demands updated this week (APENAS EM ANDAMENTO - Projetos concluídos não entram na evolução semanal)
  const updatedDemands = demands.filter(d => {
    // Regra: Projetos concluídos, finalizados pelo CS ou cancelados NÃO entram na evolução semanal
    if (d.status !== 'Em Andamento') return false;
    if (d.conclusao && d.conclusao.trim()) return false;

    if (d.updatedThisWeek) return true;
    if (d.lastUpdatedAt) {
      const diffMs = Date.now() - new Date(d.lastUpdatedAt).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) return true;
    }
    return d.weeklyEvolutionState === 'em_dia' && d.daysSinceLastEvolution <= 7;
  }).sort((a, b) => {
    const timeA = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
    const timeB = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.daysSinceLastEvolution - b.daysSinceLastEvolution;
  });

  const topRecent = updatedDemands.slice(0, 6);

  if (updatedDemands.length === 0) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Activity className="w-4 h-4" />
            <span>Projetos com Alterações Semanais</span>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Nenhuma alteração registrada nos últimos 7 dias. Ao registrar check-ins ou atribuir demandas, elas serão exibidas aqui em destaque.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Projetos com Alterações & Evoluções na Semana ({updatedDemands.length})
          </h3>
          <p className="text-xs text-slate-400">
            Demandas ativas que receberam avanços, check-ins ou ajustes operacionais nos últimos 7 dias
          </p>
        </div>

        <button
          onClick={onViewAllWeekly}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 self-start sm:self-center"
        >
          <span>Ver todas as {updatedDemands.length} evoluções</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {topRecent.map((demand) => {
          const latestCheckIn = demand.checkIns && demand.checkIns.length > 0 ? demand.checkIns[0] : null;
          const displayDate = demand.lastUpdatedAt
            ? new Date(demand.lastUpdatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : latestCheckIn?.date || `${demand.daysSinceLastEvolution}d atrás`;

          return (
            <div
              key={demand.seq}
              onClick={() => onSelectDemand(demand)}
              className="p-4 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-emerald-500/40 transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    #{demand.seq}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400/90">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{displayDate}</span>
                  </div>
                </div>

                <h4 className="font-semibold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors line-clamp-1">
                  {demand.razaoSocial}
                </h4>

                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-indigo-400" />
                  <span className="truncate">{demand.implantador}</span>
                </div>

                <p className="text-[11px] text-slate-300 line-clamp-2 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                  "{demand.lastChangeSummary || latestCheckIn?.note || 'Avanço e alinhamento registrado'}"
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 uppercase font-semibold text-[10px]">
                    {demand.currentStage}
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {demand.progressPercent}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(8, demand.progressPercent))}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
