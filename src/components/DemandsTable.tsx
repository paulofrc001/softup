import React, { useState, useMemo } from 'react';
import { Demand, DemandStatus, DemandType, AlertThresholdSettings } from '../types';
import { getDemandContactInfo, getContactValidationCounts, DEFAULT_ALERT_THRESHOLDS } from '../utils/contactUtils';
import { ContactStatusBadge } from './ContactStatusBadge';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Eye,
  Plus,
  PhoneCall,
  RefreshCw,
  Tag,
  ShieldAlert,
  FileSpreadsheet
} from 'lucide-react';

interface DemandsTableProps {
  demands: Demand[];
  thresholds?: AlertThresholdSettings;
  onSelectDemand: (demand: Demand) => void;
  onOpenCheckIn: (demand: Demand) => void;
  initialStatusFilter?: string;
  onToggleRetaguarda?: (seq: number) => void;
  onOpenRegisterContact?: (demand: Demand) => void;
  onOpenContactHistory?: (demand: Demand) => void;
  onOpenExportXls?: () => void;
}

export const DemandsTable: React.FC<DemandsTableProps> = ({
  demands,
  thresholds = DEFAULT_ALERT_THRESHOLDS,
  onSelectDemand,
  onOpenCheckIn,
  initialStatusFilter = 'all',
  onToggleRetaguarda,
  onOpenRegisterContact,
  onOpenContactHistory,
  onOpenExportXls,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [tipoFilter, setTipoFilter] = useState('all');
  const [implantadorFilter, setImplantadorFilter] = useState('all');
  const [evolutionFilter, setEvolutionFilter] = useState('all');
  const [contactValidationFilter, setContactValidationFilter] = useState<'all' | 'sem_contato' | 'critico' | 'alerta' | 'sem_implantador'>('all');
  const [retaguardaFilter, setRetaguardaFilter] = useState<'all' | 'atualizado' | 'pendente'>('all');
  const [sortField, setSortField] = useState<keyof Demand>('seq');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const counts = useMemo(
    () => getContactValidationCounts(demands, thresholds),
    [demands, thresholds]
  );

  // Extract unique implantadores & tipos
  const implantadoresList = useMemo(() => {
    const set = new Set<string>();
    demands.forEach(d => {
      if (d.implantador) set.add(d.implantador);
    });
    return Array.from(set).sort();
  }, [demands]);

  const tiposList = useMemo(() => {
    const set = new Set<string>();
    demands.forEach(d => {
      if (d.tipo) set.add(d.tipo);
    });
    return Array.from(set).sort();
  }, [demands]);

  // Filtered demands
  const filteredDemands = useMemo(() => {
    return demands.filter(d => {
      const contactInfo = getDemandContactInfo(d, thresholds);

      // Contact Validation Filter (Ponto de Validação)
      if (contactValidationFilter !== 'all') {
        if (d.status !== 'Em Andamento') return false;
        if (contactValidationFilter === 'sem_contato' && !(contactInfo.isCritical || contactInfo.isAlert || !contactInfo.hasContact)) return false;
        if (contactValidationFilter === 'critico' && !contactInfo.isCritical) return false;
        if (contactValidationFilter === 'alerta' && !contactInfo.isAlert) return false;
        if (contactValidationFilter === 'sem_implantador' && !contactInfo.isUnassigned) return false;
      }

      // Retaguarda Filter
      if (retaguardaFilter !== 'all') {
        if (retaguardaFilter === 'atualizado' && !d.retaguardaAtualizado) return false;
        if (retaguardaFilter === 'pendente' && d.retaguardaAtualizado) return false;
      }

      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matches = 
          d.razaoSocial.toLowerCase().includes(query) ||
          d.clienteId.toLowerCase().includes(query) ||
          d.implantador.toLowerCase().includes(query) ||
          d.comercial.toLowerCase().includes(query) ||
          d.seq.toString().includes(query);
        if (!matches) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'ongoing' && d.status !== 'Em Andamento') return false;
        if (statusFilter === 'overdue' && d.daysLate <= 0) return false;
        if (statusFilter === 'unassigned' && d.implantador !== 'Não Atribuído') return false;
        if (statusFilter === 'tep' && d.status !== 'Concluída (CS Finalizar TEP)') return false;
        if (statusFilter === 'completed' && d.status !== 'Concluída Geral') return false;
        if (statusFilter === 'stagnant' && (d.weeklyEvolutionState !== 'critico' && d.weeklyEvolutionState !== 'alerta')) return false;
        if (!['ongoing', 'overdue', 'unassigned', 'tep', 'completed', 'stagnant'].includes(statusFilter) && d.status !== statusFilter) {
          return false;
        }
      }

      // Tipo
      if (tipoFilter !== 'all' && d.tipo !== tipoFilter) return false;

      // Implantador
      if (implantadorFilter !== 'all' && d.implantador !== implantadorFilter) return false;

      // Evolution
      if (evolutionFilter !== 'all') {
        if (evolutionFilter === 'critico' && d.weeklyEvolutionState !== 'critico') return false;
        if (evolutionFilter === 'alerta' && d.weeklyEvolutionState !== 'alerta') return false;
        if (evolutionFilter === 'em_dia' && d.weeklyEvolutionState !== 'em_dia') return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [demands, searchTerm, statusFilter, tipoFilter, implantadorFilter, evolutionFilter, contactValidationFilter, retaguardaFilter, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filteredDemands.length / pageSize) || 1;
  const paginatedDemands = filteredDemands.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: keyof Demand) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getStatusBadge = (status: DemandStatus) => {
    switch (status) {
      case 'Em Andamento':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">Em Andamento</span>;
      case 'Concluída Geral':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Concluída Geral</span>;
      case 'Concluída (CS Finalizar TEP)':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Pendente TEP / CS</span>;
      case 'Cancelada':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">Cancelada</span>;
      case 'Pausada':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">Pausada</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* PONTO 2 DE VALIDAÇÃO: Barra Superior com os 4 pontos de validação de contato */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Ponto 2 de Validação • Contatos com Cliente & Retaguarda
              </h4>
              <p className="text-[11px] text-slate-400">
                Se houve Registro Novo Acompanhamento & Apontamento de Esforço, considera-se que houve contato.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Retaguarda (Temporário):</span>
            <button
              onClick={() => {
                setRetaguardaFilter(prev => prev === 'pendente' ? 'all' : 'pendente');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                retaguardaFilter === 'pendente'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-950 text-amber-300 border-amber-500/30 hover:bg-slate-800'
              }`}
            >
              ⚡ Pendente ({counts.retaguardaPendente})
            </button>
            <button
              onClick={() => {
                setRetaguardaFilter(prev => prev === 'atualizado' ? 'all' : 'atualizado');
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                retaguardaFilter === 'atualizado'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-950 text-emerald-300 border-emerald-500/30 hover:bg-slate-800'
              }`}
            >
              ✓ Atualizado ({counts.retaguardaAtualizado})
            </button>
          </div>
        </div>

        {/* Action pills for contact validation */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
          <button
            onClick={() => {
              setContactValidationFilter('sem_contato');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              contactValidationFilter === 'sem_contato'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'bg-slate-950/80 text-rose-300 hover:bg-slate-800 border border-rose-900/40'
            }`}
          >
            Todas Sem contato ({counts.todasSemContato})
          </button>

          <button
            onClick={() => {
              setContactValidationFilter('critico');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              contactValidationFilter === 'critico'
                ? 'bg-rose-700 text-white shadow-md shadow-rose-950/50'
                : 'bg-slate-950/80 text-rose-400 hover:bg-slate-800 border border-rose-900/50'
            }`}
          >
            Crítico (&gt;{thresholds.criticalDays} dias) ({counts.critico})
          </button>

          <button
            onClick={() => {
              setContactValidationFilter('alerta');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              contactValidationFilter === 'alerta'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-950/50'
                : 'bg-slate-950/80 text-amber-300 hover:bg-slate-800 border border-amber-900/40'
            }`}
          >
            Alerta ({thresholds.alertDays} a {thresholds.criticalDays} dias) ({counts.alerta})
          </button>

          <button
            onClick={() => {
              setContactValidationFilter('sem_implantador');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              contactValidationFilter === 'sem_implantador'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                : 'bg-slate-950/80 text-purple-300 hover:bg-slate-800 border border-purple-900/40'
            }`}
          >
            Sem Implantador ({counts.semImplantador})
          </button>

          <button
            onClick={() => {
              setContactValidationFilter('all');
              setRetaguardaFilter('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              contactValidationFilter === 'all' && retaguardaFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Todas as Demandas ({demands.length})
          </button>

          {onOpenExportXls && (
            <button
              type="button"
              onClick={onOpenExportXls}
              className="ml-auto px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/50 flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Exportar dados em planilha XLS (Número de Implantação, Situação de Contato e Acompanhamentos)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar XLS</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente ou seq..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Status: Todos</option>
              <option value="Em Andamento">Status: Em Andamento</option>
              <option value="stagnant">Sem Evolução Semanal</option>
              <option value="overdue">Atrasados (Vencidos)</option>
              <option value="unassigned">Sem Implantador</option>
              <option value="Concluída (CS Finalizar TEP)">Pendente TEP / CS</option>
              <option value="Concluída Geral">Concluídas</option>
              <option value="Cancelada">Canceladas</option>
              <option value="Pausada">Pausadas</option>
            </select>
          </div>

          {/* Evolution Filter */}
          <div>
            <select
              value={evolutionFilter}
              onChange={(e) => {
                setEvolutionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Evolução: Todas</option>
              <option value="critico">Crítico (&gt;14 dias parado)</option>
              <option value="alerta">Alerta (7 a 14 dias)</option>
              <option value="em_dia">Em Dia (&lt;7 dias)</option>
            </select>
          </div>

          {/* Tipo Filter */}
          <div>
            <select
              value={tipoFilter}
              onChange={(e) => {
                setTipoFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Tipo: Todos</option>
              {tiposList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Implantador Filter */}
          <div>
            <select
              value={implantadorFilter}
              onChange={(e) => {
                setImplantadorFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Implantador: Todos</option>
              {implantadoresList.map(imp => (
                <option key={imp} value={imp}>{imp}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter stats & Clear */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span>
            Mostrando <strong>{filteredDemands.length}</strong> de <strong>{demands.length}</strong> demandas
            {contactValidationFilter !== 'all' && (
              <span className="ml-2 text-indigo-400">
                (Filtro de Contato Ativo: <strong>{contactValidationFilter}</strong>)
              </span>
            )}
            {retaguardaFilter !== 'all' && (
              <span className="ml-2 text-amber-400">
                (Filtro Retaguarda: <strong>{retaguardaFilter}</strong>)
              </span>
            )}
          </span>

          {(searchTerm || statusFilter !== 'all' || tipoFilter !== 'all' || implantadorFilter !== 'all' || evolutionFilter !== 'all' || contactValidationFilter !== 'all' || retaguardaFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTipoFilter('all');
                setImplantadorFilter('all');
                setEvolutionFilter('all');
                setContactValidationFilter('all');
                setRetaguardaFilter('all');
                setCurrentPage(1);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 cursor-pointer hover:text-slate-200" onClick={() => handleSort('seq')}>
                  <div className="flex items-center gap-1">
                    <span>Seq</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Cliente / Razão Social</th>
                <th className="py-3 px-3">Implantador</th>
                <th className="py-3 px-3">Comercial</th>
                <th className="py-3 px-3 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('hrsNeg')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Horas</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center cursor-pointer hover:text-slate-200" onClick={() => handleSort('totModulos')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Módulos</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Cronograma</th>

                {/* Validation Point: Contato com Cliente */}
                <th className="py-3 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <PhoneCall className="w-3 h-3 text-cyan-400" />
                    <span>Contato Cliente</span>
                  </div>
                </th>

                {/* Marcador Retaguarda Atualizado (Temporário) */}
                <th className="py-3 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3 text-amber-400" />
                    <span>Retaguarda ERP</span>
                  </div>
                </th>

                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedDemands.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Nenhuma demanda encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedDemands.map((demand) => {
                  const contactInfo = getDemandContactInfo(demand, thresholds);

                  return (
                    <tr 
                      key={demand.seq}
                      className="hover:bg-slate-850/50 transition-colors group cursor-pointer"
                      onClick={() => onSelectDemand(demand)}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-300">
                        #{demand.seq}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {demand.razaoSocial}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span className="font-mono">ID: {demand.clienteId}</span>
                          <span>•</span>
                          <span>{demand.tipo}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`font-medium ${
                          demand.implantador === 'Não Atribuído' 
                            ? 'text-rose-400 font-bold' 
                            : 'text-slate-300'
                        }`}>
                          {demand.implantador}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {demand.comercial}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-200">
                        {demand.hrsNeg}h
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-200">
                        {demand.totModulos}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-400">
                        <div>{demand.prevInicio} → {demand.prevFim}</div>
                        {demand.daysLate > 0 && (
                          <div className="text-rose-400 font-bold text-[10px]">
                            +{demand.daysLate}d atrasado
                          </div>
                        )}
                      </td>

                      {/* Cell: Contato Cliente */}
                      <td className="py-3 px-3 text-center">
                        <ContactStatusBadge
                          demand={demand}
                          thresholds={thresholds}
                          onOpenRegisterContact={onOpenRegisterContact || onOpenCheckIn}
                          onOpenHistory={onOpenContactHistory || onSelectDemand}
                          compact={true}
                        />
                      </td>

                      {/* Cell: Marcador Retaguarda Atualizado (Temporário) */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {onToggleRetaguarda ? (
                          <button
                            type="button"
                            onClick={() => onToggleRetaguarda(demand.seq)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border flex items-center justify-center gap-1 mx-auto ${
                              demand.retaguardaAtualizado
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                            }`}
                            title="Clique para alternar marcador manual do Retaguarda ERP (ou abra os detalhes para gravar via API oficial)"
                          >
                            {demand.retaguardaAtualizado ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Atualizado</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3 h-3 text-amber-400" />
                                <span>Pendente</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className={`text-[10px] font-bold ${demand.retaguardaAtualizado ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {demand.retaguardaAtualizado ? '✓ Atualizado' : '⚡ Pendente'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        {getStatusBadge(demand.status)}
                      </td>
                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {demand.status === 'Em Andamento' && (
                            <button
                              onClick={() => onOpenCheckIn(demand)}
                              className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors"
                              title="Registrar Check-In / Contato"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onSelectDemand(demand)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Página <strong className="text-slate-200">{currentPage}</strong> de <strong className="text-slate-200">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-300 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
