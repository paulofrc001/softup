import React, { useState } from 'react';
import { Demand, AlertThresholdSettings } from '../types';
import { getDemandContactInfo, getContactValidationCounts, DEFAULT_ALERT_THRESHOLDS } from '../utils/contactUtils';
import { ContactStatusBadge } from './ContactStatusBadge';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  User, 
  CheckCircle2, 
  Flame, 
  FileWarning, 
  ArrowRight, 
  Filter, 
  PlusCircle, 
  Tag, 
  PhoneCall, 
  PhoneOff,
  RefreshCw, 
  ExternalLink, 
  ShieldAlert,
  History,
  FileSpreadsheet
} from 'lucide-react';

interface WeeklyEvolutionViewProps {
  demands: Demand[];
  thresholds?: AlertThresholdSettings;
  onSelectDemand: (demand: Demand) => void;
  onOpenCheckIn: (demand: Demand) => void;
  activeTeamMembers?: string[];
  onQuickAssign?: (seq: number, implantador: string) => void;
  onToggleRetaguarda?: (seq: number) => void;
  onOpenRegisterContact?: (demand: Demand) => void;
  onOpenContactHistory?: (demand: Demand) => void;
  onOpenExportXls?: () => void;
}

export const WeeklyEvolutionView: React.FC<WeeklyEvolutionViewProps> = ({
  demands,
  thresholds = DEFAULT_ALERT_THRESHOLDS,
  onSelectDemand,
  onOpenCheckIn,
  activeTeamMembers = ['Leonardo', 'Diogo'],
  onQuickAssign,
  onToggleRetaguarda,
  onOpenRegisterContact,
  onOpenContactHistory,
  onOpenExportXls,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'critico' | 'alerta' | 'unassigned'>('all');

  const counts = getContactValidationCounts(demands, thresholds);

  // Filter only ongoing demands for contact validation
  const ongoingDemands = demands.filter(d => d.status === 'Em Andamento');

  // Filter demands according to selected validation point
  const displayedDemands = ongoingDemands.filter(d => {
    const info = getDemandContactInfo(d, thresholds);
    if (filterType === 'critico') return info.isCritical;
    if (filterType === 'alerta') return info.isAlert;
    if (filterType === 'unassigned') return info.isUnassigned;
    // 'all' represents "Todas Sem contato" (demands that are critical or alert without contact within the SLA)
    return info.isCritical || info.isAlert || !info.hasContact;
  }).sort((a, b) => {
    const infoA = getDemandContactInfo(a, thresholds);
    const infoB = getDemandContactInfo(b, thresholds);
    return infoB.daysWithoutContact - infoA.daysWithoutContact;
  });

  return (
    <div className="space-y-6">
      {/* Alert Header Box: Ponto de Validação de Contato */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/50 via-slate-900 to-amber-950/40 border border-rose-900/60 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-rose-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs mb-1 uppercase tracking-wider">
              <PhoneCall className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>Ponto 1 de Validação • Contatos com Clientes</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <span>Validação de Contato & SLA de Atendimento</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Pelo SLA de implantação, cada cliente deve receber alinhamento a cada {thresholds.alertDays} dias.
              <span className="block mt-1 text-emerald-400 font-medium bg-emerald-950/50 border border-emerald-500/20 px-2.5 py-1 rounded-lg w-fit">
                ✓ Regra: Se houve Registro de Novo Acompanhamento & Apontamento de Esforço, considera-se que houve contato.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-center shadow-lg">
              <span className="block text-2xl font-black font-mono text-rose-300">
                {counts.todasSemContato}
              </span>
              <span className="text-[10px] text-rose-400 uppercase font-bold tracking-wider">
                Sem Contato (SLA)
              </span>
            </div>

            <div className="px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-center shadow-lg">
              <span className="block text-2xl font-black font-mono text-emerald-400">
                {counts.emDia}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Contato em Dia
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs: Exact requested validation categories */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              filterType === 'all'
                ? 'bg-rose-600 text-white shadow-rose-950/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Todas Sem contato ({counts.todasSemContato})
          </button>

          <button
            onClick={() => setFilterType('critico')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              filterType === 'critico'
                ? 'bg-rose-700 text-white shadow-rose-950/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Crítico (&gt;{thresholds.criticalDays} dias) ({counts.critico})
          </button>

          <button
            onClick={() => setFilterType('alerta')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              filterType === 'alerta'
                ? 'bg-amber-600 text-white shadow-amber-950/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Alerta ({thresholds.alertDays} a {thresholds.criticalDays} dias) ({counts.alerta})
          </button>

          <button
            onClick={() => setFilterType('unassigned')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              filterType === 'unassigned'
                ? 'bg-purple-600 text-white shadow-purple-950/50'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Sem Implantador ({counts.semImplantador})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Exibindo <strong>{displayedDemands.length}</strong> demandas no filtro
          </div>

          {onOpenExportXls && (
            <button
              type="button"
              onClick={onOpenExportXls}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/50 text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Exportar Situação do Contato e Histórico de Acompanhamentos em XLS"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar XLS</span>
            </button>
          )}
        </div>
      </div>

      {/* Demands Grid */}
      {displayedDemands.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-200">
            Nenhuma demanda pendente neste filtro de contato!
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Todas as demandas selecionadas possuem apontamento ou acompanhamento recente registrado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedDemands.map((demand) => {
            const contactInfo = getDemandContactInfo(demand, thresholds);
            const isCritical = contactInfo.isCritical;
            const isAlert = contactInfo.isAlert;

            return (
              <div
                key={demand.seq}
                className={`
                  p-4 rounded-2xl bg-slate-900/90 border transition-all duration-200 flex flex-col justify-between
                  ${isCritical 
                    ? 'border-rose-900/80 hover:border-rose-600 shadow-rose-950/20' 
                    : isAlert 
                    ? 'border-amber-900/70 hover:border-amber-600' 
                    : 'border-slate-800 hover:border-slate-700'}
                  shadow-lg hover:shadow-xl
                `}
              >
                <div>
                  {/* Top Bar: Seq, Code & Contact Status Pill */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-slate-200 border border-slate-700">
                        #{demand.seq}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Cód: {demand.clienteId}
                      </span>
                    </div>

                    <div className={`
                      flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border
                      ${contactInfo.statusBadgeClass}
                    `}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{contactInfo.daysWithoutContact} dias sem contato</span>
                    </div>
                  </div>

                  {/* Client title & Company */}
                  <div className="mb-3">
                    <h4 
                      className="text-sm font-bold text-slate-100 line-clamp-1 hover:text-indigo-400 cursor-pointer transition-colors" 
                      onClick={() => onSelectDemand(demand)}
                    >
                      {demand.razaoSocial}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {demand.tipo}
                      </span>
                      <span>Comercial: <strong className="text-slate-300">{demand.comercial}</strong></span>
                    </div>
                  </div>

                  {/* Contact & Retaguarda Status Strip */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
                        Último Contato:
                      </span>
                      <span className="font-mono text-slate-200 font-medium">
                        {contactInfo.lastContactDateStr 
                          ? contactInfo.lastContactDateStr 
                          : <span className="text-rose-400">Nenhum registrado</span>}
                      </span>
                    </div>

                    {/* Status visual do contato */}
                    {contactInfo.latestInteraction && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                        <span className="text-slate-400">Status:</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${contactInfo.interactionStatusBadge?.badgeClass}`}>
                          {contactInfo.interactionStatusBadge?.isSuccess ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <PhoneOff className="w-3 h-3 text-amber-400" />
                          )}
                          <span>{contactInfo.interactionStatusBadge?.label}</span>
                        </span>
                      </div>
                    )}

                    {/* Marcador Retaguarda Atualizado (Temporário) */}
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-900">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Retaguarda:</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400" title="Marcador temporário - futuramente via API">
                          Temporário
                        </span>
                      </div>

                      {onToggleRetaguarda ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleRetaguarda(demand.seq);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border flex items-center gap-1 ${
                            demand.retaguardaAtualizado
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                          }`}
                          title="Clique para alternar marcador manual do Retaguarda ERP"
                        >
                          {demand.retaguardaAtualizado ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>✓ Atualizado</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3 text-amber-400" />
                              <span>⚡ Pendente</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className={`text-[10px] font-bold ${demand.retaguardaAtualizado ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {demand.retaguardaAtualizado ? '✓ Atualizado' : '⚡ Pendente'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Key Metrics Pill Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center mb-3">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block font-semibold">Horas</span>
                      <span className="text-xs font-mono font-bold text-slate-200">{demand.hrsNeg}h</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block font-semibold">Módulos</span>
                      <span className="text-xs font-mono font-bold text-slate-200">{demand.totModulos}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase block font-semibold">Pessoas</span>
                      <span className="text-xs font-mono font-bold text-slate-200">{demand.pessoasTreinar}</span>
                    </div>
                  </div>

                  {/* Responsible & Dates */}
                  <div className="space-y-1 text-xs text-slate-300 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Implantador:
                      </span>
                      <span className={`font-semibold ${demand.implantador === 'Não Atribuído' ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                        {demand.implantador}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Cronograma:
                      </span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {demand.prevInicio} → {demand.prevFim}
                      </span>
                    </div>
                  </div>

                  {/* Quick Assign Buttons for Unassigned Demands */}
                  {(!demand.implantador || demand.implantador === 'Não Atribuído') && onQuickAssign && (
                    <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-800/60 mb-3 flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="text-[10px] text-indigo-300 font-semibold">Atribuir:</span>
                      <div className="flex items-center gap-1">
                        {activeTeamMembers.map((member) => (
                          <button
                            key={member}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickAssign(demand.seq, member);
                            }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-xs"
                          >
                            + {member}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    onClick={() => onOpenRegisterContact ? onOpenRegisterContact(demand) : onOpenCheckIn(demand)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-950/50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Registrar Contato</span>
                  </button>

                  <button
                    onClick={() => onOpenContactHistory ? onOpenContactHistory(demand) : onSelectDemand(demand)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Ver histórico de contatos"
                  >
                    <History className="w-4 h-4 text-indigo-400" />
                  </button>

                  <button
                    onClick={() => onSelectDemand(demand)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Ver detalhes completos da demanda"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
