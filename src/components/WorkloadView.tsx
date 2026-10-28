import React, { useState } from 'react';
import { Demand } from '../types';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Briefcase, 
  BarChart2,
  UserPlus,
  Star,
  Shuffle,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';

interface WorkloadViewProps {
  demands: Demand[];
  activeTeamMembers: string[];
  onAddTeamMember: (name: string) => void;
  onRemoveTeamMember: (name: string) => void;
  onBatchAssign: (target: 'distribute' | string) => void;
  onSelectImplantador?: (implantador: string) => void;
}

export const WorkloadView: React.FC<WorkloadViewProps> = ({ 
  demands, 
  activeTeamMembers,
  onAddTeamMember,
  onRemoveTeamMember,
  onBatchAssign,
  onSelectImplantador 
}) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');

  // Count unassigned demands in progress
  const unassignedOngoingDemands = demands.filter(
    d => d.status === 'Em Andamento' && (!d.implantador || d.implantador === 'Não Atribuído')
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    onAddTeamMember(newMemberName.trim());
    setNewMemberName('');
  };

  const handleBatch = (target: 'distribute' | string) => {
    onBatchAssign(target);
    const label = target === 'distribute' 
      ? 'distribuídas igualmente entre o time' 
      : `atribuídas para ${target}`;
    setAssignSuccessMsg(`Demandas ${label} com sucesso!`);
    setTimeout(() => setAssignSuccessMsg(''), 4000);
  };

  // Aggregate by implantador
  const implantadorStats = React.useMemo(() => {
    const map = new Map<string, {
      total: number;
      ongoing: number;
      stagnant: number;
      completed: number;
      canceled: number;
      totalHours: number;
      totalModules: number;
    }>();

    // Ensure active team members exist in the map even with 0 demands
    activeTeamMembers.forEach(member => {
      map.set(member, {
        total: 0,
        ongoing: 0,
        stagnant: 0,
        completed: 0,
        canceled: 0,
        totalHours: 0,
        totalModules: 0,
      });
    });

    demands.forEach(d => {
      const name = d.implantador || 'Não Atribuído';
      if (!map.has(name)) {
        map.set(name, {
          total: 0,
          ongoing: 0,
          stagnant: 0,
          completed: 0,
          canceled: 0,
          totalHours: 0,
          totalModules: 0,
        });
      }
      const item = map.get(name)!;
      item.total += 1;
      item.totalHours += d.hrsNeg || 0;
      item.totalModules += d.totModulos || 0;

      if (d.status === 'Em Andamento') {
        item.ongoing += 1;
        if (d.weeklyEvolutionState === 'critico' || d.weeklyEvolutionState === 'alerta') {
          item.stagnant += 1;
        }
      } else if (d.status === 'Concluída Geral' || d.status === 'Concluída (CS Finalizar TEP)') {
        item.completed += 1;
      } else if (d.status === 'Cancelada') {
        item.canceled += 1;
      }
    });

    return Array.from(map.entries()).map(([name, stats]) => {
      const isActiveMember = activeTeamMembers.includes(name);
      return {
        name,
        isActiveMember,
        ...stats,
        stagnationRate: stats.ongoing > 0 ? Math.round((stats.stagnant / stats.ongoing) * 100) : 0,
      };
    }).sort((a, b) => {
      // Prioritize active team members, then unassigned, then by ongoing count
      if (a.isActiveMember && !b.isActiveMember) return -1;
      if (!a.isActiveMember && b.isActiveMember) return 1;
      if (a.name === 'Não Atribuído') return -1;
      if (b.name === 'Não Atribuído') return 1;
      return b.ongoing - a.ongoing;
    });
  }, [demands, activeTeamMembers]);

  // Aggregate by comercial
  const comercialStats = React.useMemo(() => {
    const map = new Map<string, { total: number; ongoing: number; canceled: number }>();
    demands.forEach(d => {
      const name = d.comercial || 'Indefinido';
      if (!map.has(name)) {
        map.set(name, { total: 0, ongoing: 0, canceled: 0 });
      }
      const item = map.get(name)!;
      item.total += 1;
      if (d.status === 'Em Andamento') item.ongoing += 1;
      if (d.status === 'Cancelada') item.canceled += 1;
    });

    return Array.from(map.entries())
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [demands]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          Gestão do Time de Implantação & Distribuição de Carga
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Gerencie os implantadores ativos no momento (Leonardo, Diogo e novos membros), acompanhe a carga de trabalho e distribua demandas da fila de espera.
        </p>
      </div>

      {/* TEAM MEMBERS MANAGEMENT BOX */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/60 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Time Ativo de Implantação</span>
            </div>
            <h4 className="text-lg font-bold text-slate-100 mt-0.5">
              Implantadores Oficiais ({activeTeamMembers.length})
            </h4>
            <p className="text-xs text-slate-400">
              Profissionais disponíveis para receber novas demandas e gerenciar carteiras.
            </p>
          </div>

          {/* Add Member Form */}
          <form onSubmit={handleAddSubmit} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nome do novo implantador..."
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-48 sm:w-56"
            />
            <button
              type="submit"
              disabled={!newMemberName.trim()}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Incluir</span>
            </button>
          </form>
        </div>

        {/* Active Team Chips */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTeamMembers.map((member) => (
            <div
              key={member}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-xs text-slate-200 shadow-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px]">
                {member.charAt(0)}
              </div>
              <span className="font-semibold">{member}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Ativo
              </span>
              {activeTeamMembers.length > 1 && (
                <button
                  onClick={() => onRemoveTeamMember(member)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors ml-1"
                  title={`Remover ${member} do time ativo`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* QUICK BATCH ASSIGNMENT BANNER (IF UNASSIGNED DEMANDS EXIST) */}
      {unassignedOngoingDemands.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/30 border border-amber-900/60 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Gargalo de Fila: Demandas Sem Implantador</span>
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
                Existem <strong className="text-amber-400">{unassignedOngoingDemands.length}</strong> demandas em andamento aguardando atribuição
              </h4>
              <p className="text-xs text-slate-400">
                Alavanque o início da implantação distribuindo estes projetos para Leonardo, Diogo ou para a equipe.
              </p>
            </div>

            {assignSuccessMsg && (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                {assignSuccessMsg}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
            {activeTeamMembers.length >= 2 && (
              <button
                onClick={() => handleBatch('distribute')}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Distribuir Meio a Meio (Leonardo & Diogo)</span>
              </button>
            )}

            {activeTeamMembers.map((member) => (
              <button
                key={member}
                onClick={() => handleBatch(member)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <span>Atribuir Todas a <strong>{member}</strong></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Implantador Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {implantadorStats.map((imp) => {
          const isUnassigned = imp.name === 'Não Atribuído';
          const isActive = imp.isActiveMember;

          return (
            <div
              key={imp.name}
              className={`
                p-5 rounded-2xl border transition-all duration-200 relative
                ${isActive 
                  ? 'bg-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-950/20 ring-1 ring-indigo-500/20' 
                  : isUnassigned 
                  ? 'border-rose-900/60 bg-rose-950/10' 
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'}
              `}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl ${
                    isActive 
                      ? 'bg-indigo-600/20 text-indigo-400' 
                      : isUnassigned 
                      ? 'bg-rose-500/20 text-rose-400' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isActive ? <Star className="w-4 h-4 fill-indigo-400" /> : <Briefcase className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm text-slate-100">{imp.name}</h4>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Time Atual
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {imp.total} demandas no histórico • {imp.totalHours}h contratadas
                    </span>
                  </div>
                </div>

                {isUnassigned && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Fila Sem Dono
                  </span>
                )}
              </div>

              {/* Numbers Grid */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center mb-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Em Andamento</span>
                  <span className="text-base font-bold font-mono text-blue-400">{imp.ongoing}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sem Evolução</span>
                  <span className={`text-base font-bold font-mono ${imp.stagnant > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {imp.stagnant}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Concluídas</span>
                  <span className="text-base font-bold font-mono text-emerald-400">{imp.completed}</span>
                </div>
              </div>

              {/* Stagnation Progress Bar or Availability status */}
              {imp.ongoing > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Taxa de Estagnação Semanal:</span>
                    <span className={`font-mono font-bold ${imp.stagnationRate > 50 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {imp.stagnationRate}% ({imp.stagnant}/{imp.ongoing})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${imp.stagnationRate > 50 ? 'bg-rose-500' : 'bg-amber-500'}`}
                      style={{ width: `${imp.stagnationRate}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-center text-xs text-emerald-400 font-medium">
                  Disponível para alocação de novas demandas
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Commercial breakdown */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h4 className="font-bold text-base text-slate-100 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-indigo-400" />
          Origem Comercial das Demandas
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {comercialStats.map((com) => (
            <div key={com.name} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-xs font-semibold text-slate-200 block truncate">{com.name}</span>
              <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono">
                <span>Total: <strong className="text-slate-200">{com.total}</strong></span>
                <span>Ativas: <strong className="text-blue-400">{com.ongoing}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
