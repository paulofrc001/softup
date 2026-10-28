import React, { useState, useEffect } from 'react';
import { Demand, DemandStatus, ProcessStage } from '../types';
import { sqliteService } from '../services/sqliteService';
import { 
  X, 
  Calendar, 
  User, 
  Building, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Save, 
  FileText,
  Layers,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Award,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Zap,
  Check,
  PhoneCall,
  RefreshCw,
  Activity
} from 'lucide-react';
import { getDemandContactInfo } from '../utils/contactUtils';
import { ContactStatusBadge } from './ContactStatusBadge';
import { ContactRegistrationModal } from './ContactRegistrationModal';
import { ContactHistoryModal } from './ContactHistoryModal';
import { RetaguardaUpdateModal } from './RetaguardaUpdateModal';
import { RetaguardaApiMonitorModal } from './RetaguardaApiMonitorModal';
import { AlertThresholdSettings, ContactInteraction } from '../types';

interface DemandDetailModalProps {
  demand: Demand | null;
  onClose: () => void;
  onSaveDemand: (updated: Demand) => void;
  availableImplantadores: string[];
  activeTeamMembers?: string[];
  onAddNewImplantador?: (name: string) => void;
  thresholds?: AlertThresholdSettings;
}

export const DemandDetailModal: React.FC<DemandDetailModalProps> = ({
  demand,
  onClose,
  onSaveDemand,
  availableImplantadores,
  activeTeamMembers = ['Leonardo', 'Diogo'],
  onAddNewImplantador,
  thresholds,
}) => {
  if (!demand) return null;

  const [activeDemand, setActiveDemand] = useState<Demand>(demand);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isContactHistoryModalOpen, setIsContactHistoryModalOpen] = useState(false);
  const [isRetaguardaApiModalOpen, setIsRetaguardaApiModalOpen] = useState(false);
  const [isApiMonitorOpen, setIsApiMonitorOpen] = useState(false);

  useEffect(() => {
    setActiveDemand(demand);
  }, [demand]);

  const [implantador, setImplantador] = useState(demand.implantador || 'Não Atribuído');
  const [isAddingNewImp, setIsAddingNewImp] = useState(false);
  const [customImpName, setCustomImpName] = useState('');
  const [status, setStatus] = useState<DemandStatus>(demand.status);
  const [stage, setStage] = useState<ProcessStage>(demand.currentStage);
  const [progress, setProgress] = useState(demand.progressPercent);
  
  // Check-In Form
  const [checkInNote, setCheckInNote] = useState('');
  const [checkInBlocker, setCheckInBlocker] = useState('');
  const [checkInImplantador, setCheckInImplantador] = useState(
    demand.implantador && demand.implantador !== 'Não Atribuído' 
      ? demand.implantador 
      : (activeTeamMembers[0] || 'Leonardo')
  );
  const [checkInHoras, setCheckInHoras] = useState<number>(1.0);
  const [checkInMinutos, setCheckInMinutos] = useState<number>(60);
  const [origemTempo, setOrigemTempo] = useState<string>('marco_1h');
  
  // Real-time Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTime, setTimerStartTime] = useState<string | null>(null);
  const [timerEndTime, setTimerEndTime] = useState<string | null>(null);

  const [isSavingCheckIn, setIsSavingCheckIn] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const [activeCheckIns, setActiveCheckIns] = useState(demand.checkIns || []);

  // Retaguarda Marker State (Temporário - Futuramente via API)
  const [retaguardaAtualizado, setRetaguardaAtualizado] = useState(Boolean(demand.retaguardaAtualizado));
  const [dataRetaguardaAtualizado, setDataRetaguardaAtualizado] = useState(demand.dataRetaguardaAtualizado || '');
  const [isTogglingRetaguarda, setIsTogglingRetaguarda] = useState(false);

  useEffect(() => {
    setRetaguardaAtualizado(Boolean(demand.retaguardaAtualizado));
    setDataRetaguardaAtualizado(demand.dataRetaguardaAtualizado || '');
  }, [demand]);

  const handleToggleRetaguarda = async () => {
    setIsTogglingRetaguarda(true);
    try {
      const nextVal = !retaguardaAtualizado;
      const res = await sqliteService.toggleRetaguarda(demand.seq, nextVal);
      setRetaguardaAtualizado(res.retaguardaAtualizado);
      setDataRetaguardaAtualizado(res.dataRetaguardaAtualizado || '');
      const updated: Demand = {
        ...demand,
        retaguardaAtualizado: res.retaguardaAtualizado,
        dataRetaguardaAtualizado: res.dataRetaguardaAtualizado,
        lastUpdatedAt: new Date().toISOString(),
        lastChangeSummary: res.retaguardaAtualizado
          ? 'Retaguarda marcado como atualizado no ERP'
          : 'Retaguarda desmarcado (pendente de atualização)',
      };
      onSaveDemand(updated);
    } catch (err) {
      console.error('Erro ao alternar status do retaguarda', err);
    } finally {
      setIsTogglingRetaguarda(false);
    }
  };

  useEffect(() => {
    setActiveCheckIns(demand.checkIns || []);
    if (demand.implantador && demand.implantador !== 'Não Atribuído') {
      setCheckInImplantador(demand.implantador);
    }
  }, [demand]);

  // Check and restore persisted timer for this demand from localStorage
  useEffect(() => {
    try {
      const savedTimerKey = `active_demand_timer_${demand.seq}`;
      const savedDataStr = localStorage.getItem(savedTimerKey);
      if (savedDataStr) {
        const saved = JSON.parse(savedDataStr);
        if (saved && saved.isRunning && saved.startTimestamp) {
          const now = Date.now();
          const elapsed = Math.floor((now - saved.startTimestamp) / 1000) + (Number(saved.accumulatedSeconds) || 0);
          setTimerSeconds(elapsed);
          setIsTimerRunning(true);
          setTimerStartTime(saved.startTimeStr || new Date(saved.startTimestamp).toLocaleTimeString('pt-BR'));
        } else if (saved && saved.accumulatedSeconds > 0) {
          setTimerSeconds(saved.accumulatedSeconds);
          setTimerStartTime(saved.startTimeStr || null);
          setIsTimerRunning(false);
        }
      }
    } catch (e) {
      console.warn('Failed to restore timer from localStorage', e);
    }
  }, [demand.seq]);

  // Live Timer Interval effect
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          const nextVal = prev + 1;
          // Periodically sync to localStorage
          if (nextVal % 5 === 0) {
            try {
              localStorage.setItem(`active_demand_timer_${demand.seq}`, JSON.stringify({
                isRunning: true,
                startTimestamp: Date.now() - (nextVal * 1000),
                accumulatedSeconds: 0,
                startTimeStr: timerStartTime
              }));
            } catch (e) {}
          }
          return nextVal;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, demand.seq, timerStartTime]);

  // Timer actions
  const handleStartTimer = () => {
    const startTime = timerStartTime || new Date().toLocaleTimeString('pt-BR');
    setTimerStartTime(startTime);
    setIsTimerRunning(true);
    try {
      localStorage.setItem(`active_demand_timer_${demand.seq}`, JSON.stringify({
        isRunning: true,
        startTimestamp: Date.now() - (timerSeconds * 1000),
        accumulatedSeconds: 0,
        startTimeStr: startTime
      }));
    } catch (e) {}
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
    try {
      localStorage.setItem(`active_demand_timer_${demand.seq}`, JSON.stringify({
        isRunning: false,
        startTimestamp: null,
        accumulatedSeconds: timerSeconds,
        startTimeStr: timerStartTime
      }));
    } catch (e) {}
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setTimerStartTime(null);
    setTimerEndTime(null);
    try {
      localStorage.removeItem(`active_demand_timer_${demand.seq}`);
    } catch (e) {}
  };

  const handleStopAndApplyTimer = () => {
    setIsTimerRunning(false);
    const endTimeStr = new Date().toLocaleTimeString('pt-BR');
    setTimerEndTime(endTimeStr);
    try {
      localStorage.removeItem(`active_demand_timer_${demand.seq}`);
    } catch (e) {}

    // Calculate elapsed minutes (min 1 minute)
    const minutes = Math.max(1, Math.round(timerSeconds / 60));
    const hours = Math.round((minutes / 60) * 100) / 100;
    
    setCheckInMinutos(minutes);
    setCheckInHoras(hours);
    setOrigemTempo('cronometro');
    setSaveSuccessMsg(`⏱️ Cronômetro aplicado: ${minutes} min (${hours}h) [${timerSeconds}s] das ${timerStartTime} às ${endTimeStr}! Pronto para gravar no banco.`);
    setTimeout(() => setSaveSuccessMsg(null), 5000);
  };

  // Preset selector for Marcos
  const handleSelectPreset = (minutes: number, label: string) => {
    setCheckInMinutos(minutes);
    const hours = Math.round((minutes / 60) * 100) / 100;
    setCheckInHoras(hours);
    setOrigemTempo(label);
  };

  // Format digital clock HH:MM:SS
  const formatTimerDigital = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Human readable duration
  const formatDurationDisplay = (min: number) => {
    if (min < 60) {
      return `${min} minuto${min > 1 ? 's' : ''}`;
    }
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (m === 0) {
      return `${h} hora${h > 1 ? 's' : ''}`;
    }
    return `${h}h ${m}m`;
  };

  const handleAddCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInNote.trim()) return;

    setIsSavingCheckIn(true);
    setSaveSuccessMsg(null);

    const nowIso = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString('pt-BR');
    const isCronometro = origemTempo === 'cronometro';
    const totalSegundos = isCronometro ? timerSeconds : checkInMinutos * 60;
    const duracaoFmt = isCronometro ? formatTimerDigital(timerSeconds) : `${checkInMinutos} min`;

    const newCheckIn = {
      date: formattedDate,
      note: checkInNote.trim(),
      progressPercent: progress,
      stage,
      blocker: checkInBlocker.trim() || undefined,
      implantador: checkInImplantador,
      horasGastas: checkInHoras,
      minutosGastos: checkInMinutos,
      segundosGastos: totalSegundos,
      duracaoFormatada: duracaoFmt,
      horaInicio: timerStartTime || undefined,
      horaFim: timerEndTime || undefined,
      origemTempo: origemTempo
    };

    try {
      // 1. Explicitly insert into SQLite database tables (historico_acompanhamentos & evolucoes_semanais)
      await sqliteService.addAcompanhamento({
        demandaSeq: demand.seq,
        implantadorNome: checkInImplantador,
        tempoGastoHoras: checkInHoras,
        tempoGastoMinutos: checkInMinutos,
        tempoGastoSegundos: totalSegundos,
        duracaoFormatada: duracaoFmt,
        isCronometro: isCronometro,
        horaInicio: timerStartTime || undefined,
        horaFim: timerEndTime || undefined,
        origemTempo: origemTempo,
        descricao: checkInNote.trim(),
        impedimento: checkInBlocker.trim() || undefined,
        etapa: stage,
        progresso: progress,
        dataExecucao: nowIso.split('T')[0]
      });

      // Clear any stored timer for this demand
      try {
        localStorage.removeItem(`active_demand_timer_${demand.seq}`);
      } catch (e) {}

      const updatedCheckIns = [newCheckIn, ...activeCheckIns];
      setActiveCheckIns(updatedCheckIns);

      const updated: Demand = {
        ...demand,
        implantador,
        status,
        currentStage: stage,
        progressPercent: progress,
        daysSinceLastEvolution: 0,
        weeklyEvolutionState: status === 'Concluída Geral' ? 'concluido' : 'em_dia',
        bottlenecks: checkInBlocker ? [checkInBlocker.trim()] : [],
        checkIns: updatedCheckIns,
        lastUpdatedAt: nowIso,
        lastChangeSummary: `Acompanhamento gravado: ${checkInImplantador} (${formatDurationDisplay(checkInMinutos)}) - ${newCheckIn.note}`,
        updatedThisWeek: true,
        dataUltimoContato: formattedDate,
        diasSemContato: 0,
        hasRegisteredContact: true,
        retaguardaAtualizado,
        dataRetaguardaAtualizado,
      };

      onSaveDemand(updated);
      setCheckInNote('');
      setCheckInBlocker('');
      setSaveSuccessMsg(`Acompanhamento de ${formatDurationDisplay(checkInMinutos)} (${checkInHoras}h) gravado no banco de dados com sucesso para ${checkInImplantador}! Contato validado como Em Dia.`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
      
      // Reset timer if it was used
      if (isTimerRunning || timerSeconds > 0) {
        handleResetTimer();
      }
    } catch (err: any) {
      console.error('Erro ao salvar acompanhamento:', err);
    } finally {
      setIsSavingCheckIn(false);
    }
  };

  const handleGeneralSave = () => {
    const hasChanges = 
      implantador !== demand.implantador ||
      status !== demand.status ||
      stage !== demand.currentStage ||
      progress !== demand.progressPercent ||
      retaguardaAtualizado !== demand.retaguardaAtualizado;

    if (hasChanges) {
      const nowIso = new Date().toISOString();
      const updated: Demand = {
        ...demand,
        implantador,
        status,
        currentStage: stage,
        progressPercent: progress,
        daysSinceLastEvolution: 0,
        weeklyEvolutionState: status === 'Concluída Geral' ? 'concluido' : 'em_dia',
        checkIns: activeCheckIns,
        lastUpdatedAt: nowIso,
        lastChangeSummary: `Atualizado: Etapa ${stage}, Implantador ${implantador} (${progress}%)`,
        updatedThisWeek: true,
        retaguardaAtualizado,
        dataRetaguardaAtualizado,
      };
      onSaveDemand(updated);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              #{demand.seq}
            </span>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-100 line-clamp-1">
                {demand.razaoSocial}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Cód: {demand.clienteId} • Comercial: {demand.comercial}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Key Indicators bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-center">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Horas Negociadas</span>
              <span className="text-base font-bold font-mono text-slate-100">{demand.hrsNeg}h</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Módulos</span>
              <span className="text-base font-bold font-mono text-slate-100">{demand.totModulos}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pessoas p/ Treinar</span>
              <span className="text-base font-bold font-mono text-slate-100">{demand.pessoasTreinar}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Última Evolução</span>
              <span className={`text-base font-bold font-mono ${
                demand.daysSinceLastEvolution > 7 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {demand.daysSinceLastEvolution}d atrás
              </span>
            </div>
          </div>

          {/* Form Controls: Implantador, Status, Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Implantador Responsável
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewImp(!isAddingNewImp)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium underline"
                >
                  {isAddingNewImp ? 'Cancelar' : '+ Novo'}
                </button>
              </div>

              {isAddingNewImp ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Nome do implantador..."
                    value={customImpName}
                    onChange={(e) => setCustomImpName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={!customImpName.trim()}
                    onClick={() => {
                      if (customImpName.trim()) {
                        const name = customImpName.trim();
                        setImplantador(name);
                        if (onAddNewImplantador) onAddNewImplantador(name);
                        setIsAddingNewImp(false);
                        setCustomImpName('');
                      }
                    }}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded-lg font-semibold shrink-0"
                  >
                    Salvar
                  </button>
                </div>
              ) : (
                <select
                  value={implantador}
                  onChange={(e) => setImplantador(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Não Atribuído">-- Não Atribuído --</option>
                  <optgroup label="⭐ Time Atual (Ativos)">
                    {activeTeamMembers.map((member) => (
                      <option key={member} value={member}>
                        ⭐ {member} (Ativo)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Histórico de Implantadores">
                    {availableImplantadores
                      .filter(i => i !== 'Não Atribuído' && !activeTeamMembers.includes(i))
                      .map((imp) => (
                        <option key={imp} value={imp}>{imp}</option>
                      ))}
                  </optgroup>
                </select>
              )}

              {/* Quick 1-click team assign buttons */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-slate-500">Rápido:</span>
                {activeTeamMembers.map((member) => (
                  <button
                    key={member}
                    type="button"
                    onClick={() => setImplantador(member)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      implantador === member
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {member}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status da Demanda
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as DemandStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluída (CS Finalizar TEP)">Pendente TEP / CS</option>
                <option value="Concluída Geral">Concluída Geral</option>
                <option value="Pausada">Pausada</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Etapa do Processo
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as ProcessStage)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="kickoff">1. Kickoff & Alocação</option>
                <option value="parametrizacao">2. Parametrização & Escopo</option>
                <option value="treinamento">3. Treinamento de Usuários</option>
                <option value="homologacao">4. Homologação / Go-Live</option>
                <option value="tep_cs">5. Finalização TEP (CS)</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>

          {/* Progress Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span>Progresso Estimado da Implantação:</span>
              <span className="font-mono text-indigo-400">{progress}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Contact Validation & Retaguarda Temporary Marker Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* 1. Validação & Registro de Contato com o Cliente */}
            <ContactStatusBadge
              demand={activeDemand}
              thresholds={thresholds}
              onOpenRegisterContact={() => setIsContactModalOpen(true)}
              onOpenHistory={() => setIsContactHistoryModalOpen(true)}
            />

            {/* 2. Integração Direta Retaguarda ERP (API Oficial) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-indigo-950/30 border border-amber-600/40 space-y-3 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Integração Direta Retaguarda ERP</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 font-mono self-start sm:self-auto">
                  API: POST /gravaresumofinal
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
                <div className="text-xs space-y-1">
                  <span className="text-[11px] text-slate-400 block">Status no ERP Retaguarda:</span>
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${
                    retaguardaAtualizado ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {retaguardaAtualizado ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Atualizado no Retaguarda</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Pendente de Atualização no ERP</span>
                      </>
                    )}
                  </span>
                  {dataRetaguardaAtualizado && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      Última gravação: {new Date(dataRetaguardaAtualizado).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRetaguardaApiModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-950/40 flex items-center gap-1.5 cursor-pointer"
                    title="Gravar texto no Resumo Final da implantação diretamente no Retaguarda ERP"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-200" />
                    <span>Gravar Resumo na Retaguarda (API)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsApiMonitorOpen(true)}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-medium border border-cyan-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Ver logs de transmissão e monitorar API para esta implantação"
                  >
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Logs API</span>
                  </button>

                  <button
                    type="button"
                    disabled={isTogglingRetaguarda}
                    onClick={handleToggleRetaguarda}
                    className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Alternar apenas o marcador manual local"
                  >
                    <span>{retaguardaAtualizado ? 'Desmarcar' : 'Marcar'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-1.5">
                💡 O resumo gravado é anexado ao histórico do Retaguarda ERP preservando o conteúdo anterior com quebras de linha automáticas.
              </p>
            </div>
          </div>

          {/* New Check-In Registration Box (Histórico de Acompanhamentos & Metrificação de Esforço) */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Registrar Novo Acompanhamento & Apontamento de Esforço</span>
              </h4>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 self-start sm:self-auto">
                Tabela: historico_acompanhamentos
              </span>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Informe quem executou a demanda e quantas horas foram gastas. Esses dados alimentam diretamente o <strong>Ranking de Esforço dos Implantadores</strong> no dashboard e reiniciam o contador de estagnação.
            </p>

            {saveSuccessMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddCheckIn} className="space-y-4">
              {/* Row: Executor selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Implantador que Executou a Demanda</span>
                </label>
                <select
                  value={checkInImplantador}
                  onChange={(e) => setCheckInImplantador(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {availableImplantadores.map((member) => (
                    <option key={member} value={member}>
                      {member} {member === demand.implantador ? '(Titular da Demanda)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Tracking Section: Presets (5min, 15min, 30m, 1h) & Live Timer */}
              <div className="p-4 rounded-xl bg-slate-900/95 border border-slate-800 space-y-3.5 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-100 block">
                        Tempo Gasto na Demanda (Metrificação de Esforço)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Gravado nas tabelas <code className="text-amber-300 font-mono">historico_acompanhamentos</code> e <code className="text-amber-300 font-mono">evolucoes_semanais</code>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold flex items-center gap-1.5 shadow-inner">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>{formatDurationDisplay(checkInMinutos)} ({checkInHoras}h)</span>
                    </span>
                  </div>
                </div>

                {/* 1. Marcos de Tempo Principais (5 minutos, 15 min, 30 m e 1 hora) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold flex items-center gap-1 text-amber-300">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Marcos de Tempo Recomendados:</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {origemTempo.startsWith('marco_') ? `✓ Selecionado: ${checkInMinutos} min` : 'Clique para aplicar'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { min: 5, label: 'marco_5m', text: '5 minutos', subtitle: '5 min • 0,08h', desc: 'Alinhamento rápido' },
                      { min: 15, label: 'marco_15m', text: '15 min', subtitle: '15 min • 0,25h', desc: 'Check-in padrão' },
                      { min: 30, label: 'marco_30m', text: '30 m', subtitle: '30 min • 0,50h', desc: 'Treinamento curto' },
                      { min: 60, label: 'marco_1h', text: '1 hora', subtitle: '60 min • 1,00h', desc: 'Sessão completa' },
                    ].map((marco) => {
                      const isSelected = checkInMinutos === marco.min && origemTempo === marco.label;
                      return (
                        <button
                          key={marco.min}
                          type="button"
                          onClick={() => handleSelectPreset(marco.min, marco.label)}
                          className={`p-2.5 rounded-xl text-left transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/15 border-2 border-amber-400 shadow-md shadow-amber-500/20 scale-[1.02]'
                              : 'bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className={`font-mono text-xs sm:text-sm font-bold ${isSelected ? 'text-amber-200' : 'text-slate-200'}`}>
                              {marco.text}
                            </span>
                            {isSelected ? (
                              <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">{marco.min}m</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono font-medium">
                            {marco.subtitle}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-amber-300 font-medium' : 'text-slate-500'}`}>
                            {marco.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Outros marcos secundários e ajuste manual */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 font-medium">Outros marcos:</span>
                      {[
                        { min: 90, label: 'marco_1h30m', text: '1h 30m (90m - 1.5h)' },
                        { min: 120, label: 'marco_2h', text: '2 horas (120m - 2.0h)' },
                      ].map((sub) => {
                        const isSubSelected = checkInMinutos === sub.min && origemTempo === sub.label;
                        return (
                          <button
                            key={sub.min}
                            type="button"
                            onClick={() => handleSelectPreset(sub.min, sub.label)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                              isSubSelected
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {sub.text}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Minutos avulsos:</span>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={checkInMinutos}
                        onChange={(e) => {
                          const m = Math.max(1, Number(e.target.value) || 1);
                          setCheckInMinutos(m);
                          setCheckInHoras(Math.round((m / 60) * 100) / 100);
                          setOrigemTempo('manual');
                        }}
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono font-bold text-amber-300 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Cronômetro / Timer em Tempo Real com persistência */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Timer className={`w-4 h-4 ${isTimerRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                      <span className="font-bold text-slate-200">Cronômetro em Tempo Real:</span>
                      {isTimerRunning ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                          Gravando ao vivo (auto-salva no navegador)
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          Pronto para cronometrar a demanda
                        </span>
                      )}
                    </div>
                    {timerStartTime && (
                      <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Início: {timerStartTime}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 font-mono text-2xl font-bold text-amber-300 tracking-wider shadow-inner">
                        {formatTimerDigital(timerSeconds)}
                      </div>
                      <div className="text-[11px] text-slate-400 space-y-0.5">
                        {timerSeconds === 0 ? (
                          <span>Pressione Iniciar ao começar a atender o cliente</span>
                        ) : isTimerRunning ? (
                          <div className="space-y-0.5">
                            <span className="text-emerald-400 font-medium block">Contando tempo ao vivo...</span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Total: {Math.max(1, Math.round(timerSeconds / 60))} min ({Math.round((timerSeconds / 3600) * 100) / 100}h)
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-amber-400 font-medium block">Cronômetro pausado</span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Total acumulado: {Math.max(1, Math.round(timerSeconds / 60))} min ({Math.round((timerSeconds / 3600) * 100) / 100}h)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isTimerRunning ? (
                        <button
                          type="button"
                          onClick={handleStartTimer}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-900/30"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>{timerSeconds > 0 ? 'Retomar' : 'Iniciar Timer'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePauseTimer}
                          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-amber-900/30"
                        >
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Pausar</span>
                        </button>
                      )}

                      {timerSeconds > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleStopAndApplyTimer}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-900/30"
                            title="Lança o tempo do cronômetro para ser gravado no banco de dados"
                          >
                            <CheckCircle2 className="w-4 h-4 text-indigo-200" />
                            <span>Lançar Tempo ({Math.max(1, Math.round(timerSeconds / 60))}m)</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleResetTimer}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                            title="Zerar cronômetro"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {origemTempo === 'cronometro' && (
                    <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        Tempo do cronômetro pronto para ser persistido no banco ({checkInMinutos}m / {checkInHoras}h). Ao clicar em "Salvar Acompanhamento", as informações detalhadas serão gravadas.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <textarea
                  placeholder="Descreva a evolução realizada (ex: parametrizado módulo financeiro e estoque, alinhado fluxo com o cliente, homologado TEF)..."
                  value={checkInNote}
                  onChange={(e) => setCheckInNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 h-20"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Existe algum gargalo ou impedimento? (opcional)"
                  value={checkInBlocker}
                  onChange={(e) => setCheckInBlocker(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  Ao salvar, os dados serão gravados no banco SQLite físico central sem duplicar.
                </span>
                <button
                  type="submit"
                  disabled={!checkInNote.trim() || isSavingCheckIn}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingCheckIn ? 'Gravando...' : 'Salvar Acompanhamento'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Historical Check-Ins */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Histórico de Acompanhamentos ({activeCheckIns.length})</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Registros ordenados por data
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activeCheckIns && activeCheckIns.length > 0 ? (
                activeCheckIns.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs space-y-1.5 hover:border-slate-700 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-slate-400 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-slate-400">{item.date}</span>
                        <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-semibold flex items-center gap-1">
                          <User className="w-3 h-3 text-cyan-400" />
                          <span>{item.implantador || demand.implantador}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/60 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{formatDurationDisplay(item.minutosGastos || Math.round((Number(item.horasGastas) || 1) * 60))}</span>
                        </span>
                        {item.horaInicio && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono text-[10px] flex items-center gap-1">
                            <Timer className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{item.horaInicio}{item.horaFim ? ` - ${item.horaFim}` : ''}</span>
                          </span>
                        )}
                      </div>
                      <span className="capitalize text-indigo-400 font-semibold">{item.stage} • {item.progressPercent}%</span>
                    </div>
                    <p className="text-slate-200">{item.note}</p>
                    {item.blocker && (
                      <span className="inline-block text-[11px] text-rose-400 font-medium">
                        ⚠️ Gargalo: {item.blocker}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic p-4 text-center rounded-lg bg-slate-950/20 border border-dashed border-slate-800">
                  Nenhum acompanhamento registrado anteriormente para esta demanda.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGeneralSave}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Alterações Gerais</span>
          </button>
        </div>
      </div>

      {/* Modal de Registro de Contato */}
      <ContactRegistrationModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        demand={activeDemand}
        activeTeamMembers={activeTeamMembers}
        onContactSaved={(interaction, updated) => {
          if (updated) {
            setActiveDemand(updated);
            onSaveDemand(updated);
          }
        }}
      />

      {/* Modal de Histórico de Contatos */}
      <ContactHistoryModal
        isOpen={isContactHistoryModalOpen}
        onClose={() => setIsContactHistoryModalOpen(false)}
        demand={activeDemand}
        onOpenRegisterNew={() => setIsContactModalOpen(true)}
      />

      {/* Modal de Atualização Direta no Retaguarda ERP (API) */}
      <RetaguardaUpdateModal
        isOpen={isRetaguardaApiModalOpen}
        onClose={() => setIsRetaguardaApiModalOpen(false)}
        demand={activeDemand}
        activeImplantador={implantador}
        onOpenApiMonitor={() => setIsApiMonitorOpen(true)}
        onSuccess={(updated) => {
          setActiveDemand(updated);
          setRetaguardaAtualizado(true);
          setDataRetaguardaAtualizado(updated.dataRetaguardaAtualizado || new Date().toISOString());
          onSaveDemand(updated);
        }}
      />

      {/* Modal de Monitoramento e Logs da API Retaguarda */}
      <RetaguardaApiMonitorModal
        isOpen={isApiMonitorOpen}
        onClose={() => setIsApiMonitorOpen(false)}
        filterSeq={activeDemand.seq}
      />
    </div>
  );
};
