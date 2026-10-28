import React, { useState, useMemo } from 'react';
import { Demand } from '../types';
import { 
  CheckCircle2, 
  Calendar, 
  User, 
  Clock, 
  ArrowRight, 
  Search, 
  TrendingUp, 
  Sparkles, 
  Filter, 
  FileText,
  Activity,
  Award,
  PhoneCall,
  History,
  Plus,
  FileSpreadsheet
} from 'lucide-react';

interface WeeklyUpdatedProjectsViewProps {
  demands: Demand[];
  onSelectDemand: (demand: Demand) => void;
  onOpenCheckIn: (demand: Demand) => void;
  activeTeamMembers?: string[];
  onOpenRegisterContact?: (demand: Demand) => void;
  onOpenContactHistory?: (demand: Demand) => void;
  onOpenExportXls?: () => void;
}

export const WeeklyUpdatedProjectsView: React.FC<WeeklyUpdatedProjectsViewProps> = ({
  demands,
  onSelectDemand,
  onOpenCheckIn,
  activeTeamMembers = ['Leonardo', 'Diogo'],
  onOpenRegisterContact,
  onOpenContactHistory,
  onOpenExportXls,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImplantador, setSelectedImplantador] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'seq'>('recent');

  // Filter demands that had weekly updates (APENAS EM ANDAMENTO - Projetos concluídos não entram na evolução semanal)
  const weeklyUpdatedDemands = useMemo(() => {
    return demands.filter(d => {
      // Regra explícita: projetos já concluídos, TEP ou cancelados NÃO entram na evolução semanal
      if (d.status !== 'Em Andamento') return false;
      if (d.conclusao && d.conclusao.trim()) return false;

      // Has recent explicit update
      if (d.updatedThisWeek) return true;

      // Has lastUpdatedAt within last 7 days
      if (d.lastUpdatedAt) {
        const diffMs = Date.now() - new Date(d.lastUpdatedAt).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) return true;
      }

      // Check check-ins within last 7 days or 'em_dia' weeklyEvolutionState
      if (d.weeklyEvolutionState === 'em_dia' && d.daysSinceLastEvolution <= 7) {
        return true;
      }

      return false;
    });
  }, [demands]);

  // Filtered and sorted
  const displayedDemands = useMemo(() => {
    return weeklyUpdatedDemands.filter(d => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = d.razaoSocial.toLowerCase().includes(term);
        const matchesSeq = d.seq.toString().includes(term);
        const matchesClient = d.clienteId.toLowerCase().includes(term);
        const matchesImp = d.implantador.toLowerCase().includes(term);
        if (!matchesName && !matchesSeq && !matchesClient && !matchesImp) return false;
      }

      if (selectedImplantador !== 'all' && d.implantador !== selectedImplantador) {
        return false;
      }

      if (selectedStage !== 'all' && d.currentStage !== selectedStage) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'recent') {
        const timeA = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
        const timeB = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return a.daysSinceLastEvolution - b.daysSinceLastEvolution;
      }
      if (sortBy === 'progress') {
        return b.progressPercent - a.progressPercent;
      }
      return b.seq - a.seq;
    });
  }, [weeklyUpdatedDemands, searchTerm, selectedImplantador, selectedStage, sortBy]);

  // Statistics
  const totalOngoing = demands.filter(d => d.status === 'Em Andamento').length;
  const weeklyRate = totalOngoing > 0 
    ? Math.round((weeklyUpdatedDemands.length / totalOngoing) * 100) 
    : 0;

  const avgProgress = weeklyUpdatedDemands.length > 0
    ? Math.round(weeklyUpdatedDemands.reduce((acc, curr) => acc + curr.progressPercent, 0) / weeklyUpdatedDemands.length)
    : 0;

  // Implantador with most weekly updates
  const implantadorCounts = useMemo(() => {
    const map: Record<string, number> = {};
    weeklyUpdatedDemands.forEach(d => {
      const imp = d.implantador || 'Não Atribuído';
      map[imp] = (map[imp] || 0) + 1;
    });
    let topName = 'Nenhum';
    let topCount = 0;
    Object.entries(map).forEach(([name, count]) => {
      if (count > topCount && name !== 'Não Atribuído') {
        topName = name;
        topCount = count;
      }
    });
    return { map, topName, topCount };
  }, [weeklyUpdatedDemands]);

  const uniqueImplantadores = useMemo(() => {
    const set = new Set<string>();
    weeklyUpdatedDemands.forEach(d => {
      if (d.implantador) set.add(d.implantador);
    });
    return Array.from(set);
  }, [weeklyUpdatedDemands]);

  return (
    <div className="space-y-6">
      {/* Hero Banner: Projetos com Alterações Semanais */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-900/50 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-emerald-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Painel de Evoluções e Alterações Recentes</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
              Projetos com Alterações & Check-ins Semanais
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Monitore todas as demandas que tiveram registros de evolução, mudança de status, avanço de etapa ou novos check-ins nos últimos 7 dias.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-5 py-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-center shadow-md">
              <span className="block text-3xl font-black font-mono text-emerald-300">
                {weeklyUpdatedDemands.length}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                Evoluídos na Semana
              </span>
            </div>

            {onOpenExportXls && (
              <button
                type="button"
                onClick={onOpenExportXls}
                className="px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-950/40 transition-all border border-emerald-400/30 cursor-pointer"
                title="Exportar planilha Excel (.xlsx) contendo número da implantação, situação de contato e acompanhamentos da semana"
              >
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                  <span>Exportar XLS</span>
                </div>
                <span className="text-[10px] text-emerald-100 font-normal opacity-90">
                  Contatos & Semana
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mini Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Taxa de Cobertura Semanal</div>
              <div className="text-sm font-bold text-slate-100 font-mono">
                {weeklyRate}% da carteira ativa
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Progresso Médio</div>
              <div className="text-sm font-bold text-slate-100 font-mono">
                {avgProgress}% concluído
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Destaque da Semana</div>
              <div className="text-sm font-bold text-slate-100 truncate">
                {implantadorCounts.topName} ({implantadorCounts.topCount} demandas)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, seq (#123) ou implantador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Implantador filter */}
          <select
            value={selectedImplantador}
            onChange={(e) => setSelectedImplantador(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todos os Implantadores</option>
            {uniqueImplantadores.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Stage filter */}
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todas as Etapas</option>
            <option value="kickoff">Kickoff</option>
            <option value="parametrizacao">Parametrização</option>
            <option value="treinamento">Treinamento</option>
            <option value="homologacao">Homologação</option>
            <option value="tep_cs">TEP CS</option>
            <option value="concluido">Concluído</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="recent">Mais Recentes</option>
            <option value="progress">Maior Progresso</option>
            <option value="seq">Sequencial (#)</option>
          </select>
        </div>
      </div>

      {/* Projects List */}
      {displayedDemands.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200">
            Nenhuma demanda encontrada com estes filtros
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchTerm || selectedImplantador !== 'all' || selectedStage !== 'all'
              ? 'Tente ajustar os filtros de busca acima.'
              : 'Clique em qualquer demanda para registrar um novo check-in ou alteração para que ela apareça aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedDemands.map((demand) => {
            const latestCheckIn = demand.checkIns && demand.checkIns.length > 0 ? demand.checkIns[0] : null;
            const updatedDate = demand.lastUpdatedAt
              ? new Date(demand.lastUpdatedAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : latestCheckIn?.date || `${demand.daysSinceLastEvolution}d atrás`;

            return (
              <div
                key={demand.seq}
                onClick={() => onSelectDemand(demand)}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-800/40 transition-all cursor-pointer group shadow-sm flex flex-col justify-between gap-4"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        #{demand.seq}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {demand.tipo}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>{updatedDate}</span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                    {demand.razaoSocial}
                  </h3>

                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Implantador: <strong className="text-slate-200">{demand.implantador}</strong></span>
                    <span>•</span>
                    <span>Comercial: <strong className="text-slate-300">{demand.comercial}</strong></span>
                  </div>
                </div>

                {/* Evolution Summary / Note Box */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-emerald-400" />
                      Última Evolução Registrada:
                    </span>
                    <span className="font-mono text-slate-400">
                      {demand.daysSinceLastEvolution === 0 ? 'Hoje' : `há ${demand.daysSinceLastEvolution}d`}
                    </span>
                  </div>
                  <p className="text-slate-300 line-clamp-2 italic">
                    "{demand.lastChangeSummary || latestCheckIn?.note || 'Evolução e alinhamento de rotina registrados.'}"
                  </p>
                </div>

                {/* Progress Bar & Stage Footer */}
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Etapa: <strong className="text-slate-200 uppercase">{demand.currentStage}</strong>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {demand.progressPercent}%
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(5, demand.progressPercent))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {demand.status}
                    </span>

                    <div className="flex items-center gap-2.5">
                      {onOpenRegisterContact && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRegisterContact(demand);
                          }}
                          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                          title="Registrar Contato com o cliente"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>+ Contato</span>
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCheckIn(demand);
                        }}
                        className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                      >
                        <span>Check-in</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
