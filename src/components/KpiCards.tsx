import React from 'react';
import { 
  Clock, 
  AlertTriangle, 
  CalendarClock, 
  UserX, 
  CheckCircle, 
  TrendingUp,
  FileCheck,
  Sparkles
} from 'lucide-react';

interface KpiCardsProps {
  metrics: {
    total: number;
    ongoing: number;
    weeklyUpdatedCount: number;
    stagnantCritical: number;
    stagnantAlert: number;
    overdue: number;
    unassigned: number;
    tepPending: number;
    completed: number;
    avgDaysOpenOngoing: number;
  };
  onSelectFilter?: (type: string) => void;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ metrics, onSelectFilter }) => {
  const weeklyRate = metrics.ongoing > 0
    ? Math.round((metrics.weeklyUpdatedCount / metrics.ongoing) * 100)
    : 0;

  const cards = [
    {
      id: 'weeklyUpdated',
      label: 'Evoluções na Semana',
      value: metrics.weeklyUpdatedCount,
      detail: `${weeklyRate}% da carteira ativa atualizada`,
      icon: Sparkles,
      color: 'emerald',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-950/20',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
      highlightBorder: 'hover:border-emerald-400',
    },
    {
      id: 'ongoing',
      label: 'Em Andamento',
      value: metrics.ongoing,
      detail: `${metrics.avgDaysOpenOngoing} dias médios de abertura`,
      icon: Clock,
      color: 'blue',
      border: 'border-blue-500/30',
      bg: 'bg-blue-950/20',
      iconBg: 'bg-blue-500/20 text-blue-400',
    },
    {
      id: 'stagnant',
      label: 'Sem Evolução Semanal',
      value: metrics.stagnantCritical + metrics.stagnantAlert,
      detail: `${metrics.stagnantCritical} críticos (>14d) e ${metrics.stagnantAlert} alertas (>7d)`,
      icon: AlertTriangle,
      color: 'rose',
      border: 'border-rose-500/30',
      bg: 'bg-rose-950/20',
      iconBg: 'bg-rose-500/20 text-rose-400',
      highlight: true,
    },
    {
      id: 'overdue',
      label: 'Demandas Vencidas',
      value: metrics.overdue,
      detail: 'Ultrapassaram a Prev. Fim',
      icon: CalendarClock,
      color: 'amber',
      border: 'border-amber-500/30',
      bg: 'bg-amber-950/20',
      iconBg: 'bg-amber-500/20 text-amber-400',
    },
    {
      id: 'unassigned',
      label: 'Gargalo de Fila (Sem Dono)',
      value: metrics.unassigned,
      detail: 'Sem implantador alocado',
      icon: UserX,
      color: 'purple',
      border: 'border-purple-500/30',
      bg: 'bg-purple-950/20',
      iconBg: 'bg-purple-500/20 text-purple-400',
    },
    {
      id: 'tepPending',
      label: 'Gargalo CS (Finalizar TEP)',
      value: metrics.tepPending,
      detail: 'Aguardando validação formal',
      icon: FileCheck,
      color: 'indigo',
      border: 'border-indigo-500/30',
      bg: 'bg-indigo-950/20',
      iconBg: 'bg-indigo-500/20 text-indigo-400',
    },
    {
      id: 'completed',
      label: 'Total Concluídas',
      value: metrics.completed,
      detail: `de ${metrics.total} demandas registradas`,
      icon: CheckCircle,
      color: 'emerald',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-950/20',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            onClick={() => onSelectFilter && onSelectFilter(card.id)}
            className={`
              relative p-4 rounded-xl bg-slate-900/90 border ${card.border} backdrop-blur-xs
              shadow-sm hover:border-slate-600 transition-all duration-200 cursor-pointer group
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg ${card.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-100 group-hover:text-white transition-colors">
                {card.value}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                {card.detail}
              </div>
            </div>

            {card.highlight && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
        );
      })}
    </div>
  );
};
