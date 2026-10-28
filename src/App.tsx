import React, { useState, useEffect, useMemo } from 'react';
import { RAW_CSV_DATA } from './data/rawCsv';
import { parseCsvData, RetaguardaComparisonResult } from './utils/parser';
import { DEFAULT_ALERT_THRESHOLDS, getContactValidationCounts } from './utils/contactUtils';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ContactKpiPanel } from './components/ContactKpiPanel';
import { AlertSettingsSection } from './components/AlertSettingsSection';
import { BurnupChartSection } from './components/BurnupChartSection';
import { KpiCards } from './components/KpiCards';
import { WeeklyEvolutionView } from './components/WeeklyEvolutionView';
import { BottleneckStagesView } from './components/BottleneckStagesView';
import { DemandsTable } from './components/DemandsTable';
import { WorkloadView } from './components/WorkloadView';
import { DemandDetailModal } from './components/DemandDetailModal';
import { WeeklyEvolutionTrendChart } from './components/WeeklyEvolutionTrendChart';
import { WeeklyTrendAlert } from './components/WeeklyTrendAlert';
import { WeeklyUpdatedProjectsView } from './components/WeeklyUpdatedProjectsView';
import { WeeklyUpdatedOverviewSection } from './components/WeeklyUpdatedOverviewSection';
import { ImplantadorRankingView } from './components/ImplantadorRankingView';
import { RetaguardaSyncModal } from './components/RetaguardaSyncModal';
import { SqliteConnectModal } from './components/SqliteConnectModal';
import { ContactRegistrationModal } from './components/ContactRegistrationModal';
import { ContactHistoryModal } from './components/ContactHistoryModal';
import { ExportModal } from './components/ExportModal';
import { RetaguardaApiMonitorModal } from './components/RetaguardaApiMonitorModal';
import { sqliteService } from './services/sqliteService';
import { Demand, AlertThresholdSettings, ContactInteraction } from './types';
import { 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Filter, 
  Flame, 
  Sparkles, 
  TrendingUp,
  FileSpreadsheet,
  Database,
  UploadCloud,
  CheckCircle2,
  RotateCcw,
  HardDrive,
  SlidersHorizontal,
  X
} from 'lucide-react';

export default function App() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [teamMembers, setTeamMembers] = useState<string[]>(['Leonardo', 'Diogo']);

  // Configurações personalizáveis de Limiares de Alerta (SLA Crítico e Alerta)
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholdSettings>(() => {
    try {
      const stored = localStorage.getItem('implantacao_alert_thresholds');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.criticalDays && parsed.alertDays && parsed.criticalDays > parsed.alertDays) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_ALERT_THRESHOLDS;
  });
  const [isAlertSettingsModalOpen, setIsAlertSettingsModalOpen] = useState(false);

  const handleSaveAlertThresholds = (newThresholds: AlertThresholdSettings) => {
    setAlertThresholds(newThresholds);
    try {
      localStorage.setItem('implantacao_alert_thresholds', JSON.stringify(newThresholds));
    } catch (e) {}
  };

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [statusFilterPreset, setStatusFilterPreset] = useState<string>('all');
  const [isRetaguardaSyncOpen, setIsRetaguardaSyncOpen] = useState(false);
  const [isSqliteModalOpen, setIsSqliteModalOpen] = useState(false);
  const [isSqliteConnected, setIsSqliteConnected] = useState(false);
  const [hasDirectWriteAccess, setHasDirectWriteAccess] = useState(false);
  const [syncToast, setSyncToast] = useState<{ total: number; newCount: number; statusCount: number } | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isApiMonitorOpen, setIsApiMonitorOpen] = useState(false);

  // Estados dos Modais de Contato (Registrar Contato e Ver Histórico)
  const [contactModalDemand, setContactModalDemand] = useState<Demand | null>(null);
  const [historyModalDemand, setHistoryModalDemand] = useState<Demand | null>(null);

  const handleContactSaved = (interaction: ContactInteraction, updatedDemand?: Demand) => {
    setDemands(prev => prev.map(d => {
      if (d.seq === interaction.contactId) {
        if (updatedDemand) return updatedDemand;
        return {
          ...d,
          hasRegisteredContact: true,
          dataUltimoContato: interaction.contactedAt,
          daysWithoutContact: 0,
          weeklyEvolutionState: 'em_dia',
          latestContactInteraction: {
            lastStatus: interaction.status,
            lastContactedAt: interaction.contactedAt,
            lastUserId: interaction.userId,
            lastNotes: interaction.notes,
            totalCount: (d.latestContactInteraction?.totalCount || 0) + 1,
          },
          lastUpdatedAt: new Date().toISOString(),
          lastChangeSummary: `Contato registrado: ${interaction.status === 'SUCCESS' ? 'Contato realizado com sucesso' : 'Sem retorno'} (${interaction.userId || 'Sistema'})`,
        };
      }
      return d;
    }));

    if (selectedDemand && selectedDemand.seq === interaction.contactId) {
      setSelectedDemand(prev => prev ? {
        ...prev,
        hasRegisteredContact: true,
        dataUltimoContato: interaction.contactedAt,
        daysWithoutContact: 0,
        weeklyEvolutionState: 'em_dia',
        latestContactInteraction: {
          lastStatus: interaction.status,
          lastContactedAt: interaction.contactedAt,
          lastUserId: interaction.userId,
          lastNotes: interaction.notes,
          totalCount: (prev.latestContactInteraction?.totalCount || 0) + 1,
        },
      } : null);
    }
  };

  // Subscribe to SQLite connection and live disk write status
  useEffect(() => {
    const unsub = sqliteService.subscribe(state => {
      setIsSqliteConnected(state.isConnected);
      setHasDirectWriteAccess(state.hasDirectWriteAccess);
    });
    return unsub;
  }, []);

  // Auto-consult file when browser tab regains focus (e.g. edited in DB Browser)
  useEffect(() => {
    const handleFocus = async () => {
      if (sqliteService.getState().hasDirectWriteAccess) {
        try {
          const hasChanges = await sqliteService.hasExternalChanges();
          if (hasChanges) {
            const fresh = await sqliteService.reloadFromDisk();
            if (fresh && fresh.demands) {
              setDemands(fresh.demands);
              if (fresh.teamMembers && fresh.teamMembers.length > 0) {
                setTeamMembers(fresh.teamMembers);
              }
            }
          }
        } catch (e) {
          // silently continue
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Periodic background check for multi-user LAN updates (refreshes if another PC made changes)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (sqliteService.getState().isNetworkServer) {
        try {
          const hasChanges = await sqliteService.hasExternalChanges();
          if (hasChanges) {
            const freshDemands = await sqliteService.getAllDemands();
            setDemands(freshDemands);
            const freshMembers = await sqliteService.getTeamMembers();
            if (freshMembers && freshMembers.length > 0) {
              setTeamMembers(freshMembers);
            }
          }
        } catch (e) {}
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Initialize and load from SQLite database (.db)
  useEffect(() => {
    const initDatabase = async () => {
      try {
        await sqliteService.initDatabase();
        const dbDemands = await sqliteService.getAllDemands();
        setDemands(dbDemands || []);

        const dbMembers = await sqliteService.getTeamMembers();
        if (dbMembers && dbMembers.length > 0) {
          setTeamMembers(dbMembers);
        }
      } catch (e) {
        console.error('Failed to init SQLite database', e);
      }
    };

    initDatabase();
  }, []);

  // Save active team members to SQLite on change
  useEffect(() => {
    sqliteService.saveTeamMembers(teamMembers);
  }, [teamMembers]);

  // Available unique implantadores: active team first, then historical
  const availableImplantadores = useMemo(() => {
    const set = new Set<string>();
    teamMembers.forEach(m => set.add(m));
    demands.forEach(d => {
      if (d.implantador && d.implantador !== 'Não Atribuído') set.add(d.implantador);
    });
    return Array.from(set);
  }, [demands, teamMembers]);

  const handleAddTeamMember = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!teamMembers.includes(trimmed)) {
      setTeamMembers(prev => [...prev, trimmed]);
    }
  };

  const handleRemoveTeamMember = (name: string) => {
    if (teamMembers.length <= 1) {
      alert('É necessário manter ao menos um implantador na equipe.');
      return;
    }
    setTeamMembers(prev => prev.filter(m => m !== name));
  };

  const handleQuickAssign = async (seq: number, implantador: string) => {
    let assignedDemand: Demand | null = null;
    const nowIso = new Date().toISOString();

    setDemands(prev => prev.map(d => {
      if (d.seq === seq) {
        const updatedCheckIns = [
          {
            date: new Date().toLocaleDateString('pt-BR'),
            note: `Implantador atribuído para ${implantador}.`,
            progressPercent: Math.max(d.progressPercent, 20),
            stage: 'kickoff' as const,
          },
          ...(d.checkIns || [])
        ];
        const updated: Demand = {
          ...d,
          implantador,
          daysSinceLastEvolution: 0,
          weeklyEvolutionState: 'em_dia' as const,
          bottlenecks: d.bottlenecks.filter(b => !b.toLowerCase().includes('sem implantador')),
          checkIns: updatedCheckIns,
          lastUpdatedAt: nowIso,
          lastChangeSummary: `Implantador atribuído para ${implantador}`,
          updatedThisWeek: true,
        };
        assignedDemand = updated;
        return updated;
      }
      return d;
    }));

    if (assignedDemand) {
      await sqliteService.saveDemand(assignedDemand, `Implantador atribuído para ${implantador}`);
    }
  };

  const handleBatchAssign = async (target: 'distribute' | string) => {
    const updatedBatch: Demand[] = [];
    const nowIso = new Date().toISOString();

    setDemands(prev => {
      let memberIndex = 0;
      return prev.map(d => {
        if (d.status === 'Em Andamento' && (!d.implantador || d.implantador === 'Não Atribuído')) {
          let assignedMember = target;
          if (target === 'distribute') {
            assignedMember = teamMembers[memberIndex % teamMembers.length];
            memberIndex++;
          }
          const updated: Demand = {
            ...d,
            implantador: assignedMember,
            daysSinceLastEvolution: 0,
            weeklyEvolutionState: 'em_dia' as const,
            bottlenecks: d.bottlenecks.filter(b => !b.toLowerCase().includes('sem implantador')),
            checkIns: [
              {
                date: new Date().toLocaleDateString('pt-BR'),
                note: `Atribuição em lote da fila para ${assignedMember}.`,
                progressPercent: Math.max(d.progressPercent, 20),
                stage: 'kickoff' as const,
              },
              ...(d.checkIns || [])
            ],
            lastUpdatedAt: nowIso,
            lastChangeSummary: `Atribuição em lote para ${assignedMember}`,
            updatedThisWeek: true,
          };
          updatedBatch.push(updated);
          return updated;
        }
        return d;
      });
    });

    if (updatedBatch.length > 0) {
      await sqliteService.saveAllDemands(updatedBatch);
      await sqliteService.recordAudit({
        seq: 0,
        razaoSocial: `${updatedBatch.length} Demandas da Fila`,
        actionType: 'batch_assign',
        summary: `Atribuição em lote de ${updatedBatch.length} demandas para equipe`,
        author: 'Coordenação',
      });
    }
  };

  // Aggregate high-level metrics
  const metrics = useMemo(() => {
    const total = demands.length;
    const ongoingDemands = demands.filter(d => d.status === 'Em Andamento');
    const ongoing = ongoingDemands.length;

    // Demands that had weekly updates in the last 7 days (APENAS EM ANDAMENTO - projetos concluídos não entram na evolução semanal)
    const weeklyUpdated = demands.filter(d => {
      // Regra explícita: projetos concluídos, TEP ou inativos NÃO entram na evolução semanal
      if (d.status !== 'Em Andamento') return false;
      if (d.conclusao && d.conclusao.trim()) return false;

      if (d.updatedThisWeek) return true;
      if (d.lastUpdatedAt) {
        const diffMs = Date.now() - new Date(d.lastUpdatedAt).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) return true;
      }
      return d.weeklyEvolutionState === 'em_dia' && d.daysSinceLastEvolution <= 7;
    });
    const weeklyUpdatedCount = weeklyUpdated.length;

    const contactCounts = getContactValidationCounts(demands, alertThresholds);
    const stagnantCritical = contactCounts.critico;
    const stagnantAlert = contactCounts.alerta;
    const stagnantCount = contactCounts.todasSemContato;

    const overdue = ongoingDemands.filter(d => d.daysLate > 0).length;
    const unassigned = ongoingDemands.filter(d => !d.implantador || d.implantador === 'Não Atribuído').length;
    const tepPending = demands.filter(d => d.status === 'Concluída (CS Finalizar TEP)').length;
    const completed = demands.filter(d => d.status === 'Concluída Geral').length;

    const totalDaysOpen = ongoingDemands.reduce((acc, curr) => acc + (curr.daysOpen || 0), 0);
    const avgDaysOpenOngoing = ongoing > 0 ? Math.round(totalDaysOpen / ongoing) : 0;

    return {
      total,
      ongoing,
      totalOngoing: ongoing,
      weeklyUpdatedCount,
      stagnantCount,
      stagnantCritical,
      stagnantAlert,
      overdue,
      unassigned,
      unassignedCount: unassigned,
      tepPending,
      tepPendingCount: tepPending,
      completed,
      avgDaysOpenOngoing,
      bottleneckCount: unassigned + overdue + tepPending,
    };
  }, [demands, alertThresholds]);

  // Handle demand update and record in SQLite database
  const handleSaveDemand = async (updated: Demand) => {
    setDemands(prev => prev.map(d => d.seq === updated.seq ? updated : d));
    setSelectedDemand(updated);

    await sqliteService.saveDemand(
      updated,
      updated.lastChangeSummary || `Alteração salva no projeto #${updated.seq} (${updated.razaoSocial})`
    );
  };

  // Handle Retaguarda status toggle (Marcador temporário - futuramente via API)
  const handleToggleRetaguarda = async (seq: number) => {
    try {
      const res = await sqliteService.toggleRetaguarda(seq);
      setDemands(prev => prev.map(d => {
        if (d.seq === seq) {
          const updated: Demand = {
            ...d,
            retaguardaAtualizado: res.retaguardaAtualizado,
            dataRetaguardaAtualizado: res.dataRetaguardaAtualizado,
            lastUpdatedAt: new Date().toISOString(),
            lastChangeSummary: res.retaguardaAtualizado 
              ? 'Retaguarda marcado como atualizado no ERP' 
              : 'Retaguarda desmarcado (pendente de atualização)',
          };
          if (selectedDemand && selectedDemand.seq === seq) {
            setSelectedDemand(updated);
          }
          return updated;
        }
        return d;
      }));
    } catch (e) {
      console.error('Failed to toggle retaguarda', e);
    }
  };

  // Handle reset data to initial
  const handleRefresh = async () => {
    if (confirm('Deseja recarregar a base de dados original? Todas as edições manuais locais serão redefinidas.')) {
      const fresh = parseCsvData(RAW_CSV_DATA);
      await sqliteService.saveAllDemands(fresh);
      setDemands(fresh);
    }
  };

  // Handle export modal (XLS / CSV)
  const handleExport = () => {
    setIsExportModalOpen(true);
  };

  // Handle Retaguarda Synchronization & status reconciliation
  const handleApplyRetaguardaSync = async (merged: Demand[], comparison: RetaguardaComparisonResult) => {
    setDemands(merged);
    await sqliteService.saveAllDemands(merged);

    // Record audit log for new implementations
    if (comparison.newDemands.length > 0) {
      const sampleNames = comparison.newDemands.slice(0, 3).map(d => `#${d.seq} ${d.razaoSocial}`).join(', ');
      await sqliteService.recordAudit({
        seq: 0,
        razaoSocial: `${comparison.newDemands.length} Novas Implantações`,
        actionType: 'retaguarda_sync',
        summary: `Importadas ${comparison.newDemands.length} novas implantações da Retaguarda: ${sampleNames}${comparison.newDemands.length > 3 ? '...' : ''}`,
        author: 'Retaguarda ERP',
      });
    }

    // Record audit log for status changes
    if (comparison.statusChanges.length > 0) {
      const sampleChanges = comparison.statusChanges.slice(0, 3).map(c => `#${c.seq} para ${c.newStatus}`).join(', ');
      await sqliteService.recordAudit({
        seq: 0,
        razaoSocial: `${comparison.statusChanges.length} Atualizações de Status`,
        actionType: 'retaguarda_sync',
        summary: `Status atualizados pela Retaguarda em ${comparison.statusChanges.length} demandas: ${sampleChanges}${comparison.statusChanges.length > 3 ? '...' : ''}`,
        author: 'Retaguarda ERP',
      });
    }

    setSyncToast({
      total: comparison.totalIncoming,
      newCount: comparison.newDemands.length,
      statusCount: comparison.statusChanges.length,
    });
    setTimeout(() => setSyncToast(null), 8000);
  };

  // Restore sample demo dataset if user wants
  const handleRestoreSampleData = async () => {
    if (confirm('Deseja carregar a planilha com dados de demonstração (200+ demandas de exemplo)?')) {
      const fresh = parseCsvData(RAW_CSV_DATA);
      await sqliteService.saveAllDemands(fresh);
      setDemands(fresh);
    }
  };

  // Handle demands imported/synced from SQLite database file
  const handleDemandsLoadedFromSqlite = async (loadedDemands: Demand[], loadedMembers: string[]) => {
    setDemands(loadedDemands);
    if (loadedMembers && loadedMembers.length > 0) {
      setTeamMembers(loadedMembers);
      await sqliteService.saveTeamMembers(loadedMembers);
    }
    await sqliteService.saveAllDemands(loadedDemands);
    setIsSqliteConnected(true);

    await sqliteService.recordAudit({
      seq: 0,
      razaoSocial: 'SQLite Local (implantacoes.db)',
      actionType: 'retaguarda_sync',
      summary: `Conectado ao banco SQLite local: ${loadedDemands.length} demandas e ${loadedMembers.length} implantadores sincronizados`,
      author: 'SQLite Driver',
    });

    setSyncToast({
      total: loadedDemands.length,
      newCount: loadedDemands.length,
      statusCount: 0,
    });
    setTimeout(() => setSyncToast(null), 8000);
  };

  // Quick filter jump from KPI
  const handleKpiFilterJump = (kpiId: string) => {
    if (kpiId === 'weeklyUpdated') {
      setActiveTab('weekly-updated');
    } else if (kpiId === 'stagnant') {
      setActiveTab('stagnant');
    } else if (kpiId === 'unassigned') {
      setActiveTab('bottlenecks');
    } else if (kpiId === 'tepPending') {
      setActiveTab('bottlenecks');
    } else {
      setStatusFilterPreset(kpiId);
      setActiveTab('table');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        metrics={metrics}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        activeTeamMembers={teamMembers}
        onOpenRetaguardaSync={() => setIsRetaguardaSyncOpen(true)}
        onOpenSqliteConnect={() => setIsSqliteModalOpen(true)}
        onOpenApiMonitor={() => setIsApiMonitorOpen(true)}
        isSqliteConnected={isSqliteConnected}
        hasDirectWriteAccess={hasDirectWriteAccess}
        thresholds={alertThresholds}
        onOpenAlertSettings={() => setIsAlertSettingsModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col main-layout-content lg:pl-[var(--sidebar-w-desktop)] min-w-0 transition-[padding] duration-200">
        {/* Top Header */}
        <Header
          onMenuClick={() => setIsMobileOpen(true)}
          isMobileOpen={isMobileOpen}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onRefresh={handleRefresh}
          onExport={handleExport}
          stagnantCount={metrics.stagnantCount}
          onOpenRetaguardaSync={() => setIsRetaguardaSyncOpen(true)}
          onOpenSqliteConnect={() => setIsSqliteModalOpen(true)}
          onOpenApiMonitor={() => setIsApiMonitorOpen(true)}
          isSqliteConnected={isSqliteConnected}
          hasDirectWriteAccess={hasDirectWriteAccess}
        />

        {/* Dynamic Main Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl 2xl:max-w-[1720px] 3xl:max-w-[2100px] mx-auto w-full">
          {/* Retaguarda Sync Success Notification Toast */}
          {syncToast && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/60 text-emerald-200 flex items-center justify-between shadow-2xl animate-fade-in gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>Sincronização com Retaguarda concluída com sucesso!</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Gravado no Banco Local
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    <strong>+{syncToast.newCount} novas implantações</strong> cadastradas • <strong>{syncToast.statusCount} demandas</strong> tiveram status atualizado • {syncToast.total} linhas processadas.
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSyncToast(null)} 
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 font-semibold transition-colors shrink-0"
              >
                Dispensar
              </button>
            </div>
          )}

          {/* Global Search result notification if search is active */}
          {searchTerm && (
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/80 flex items-center justify-between text-xs text-indigo-300">
              <span>Filtro de busca ativa: <strong>"{searchTerm}"</strong></span>
              <button 
                onClick={() => setSearchTerm('')}
                className="underline text-indigo-200 hover:text-white"
              >
                Limpar busca
              </button>
            </div>
          )}

          {/* Empty State when Database is completely clean (0 demands) */}
          {demands.length === 0 && (
            <div className="p-8 sm:p-14 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-6 max-w-2xl mx-auto shadow-2xl my-8">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
                <UploadCloud className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-100">
                  Banco de Dados Limpo (0 Implantações)
                </h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                  Todos os dados foram limpos com sucesso. O banco local está pronto para receber suas implantações do sistema retaguarda (.xls, .xlsx ou .csv).
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsSqliteModalOpen(true)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
                  title="Conectar diretamente ao arquivo SQLite implantacoes.db"
                >
                  <HardDrive className="w-5 h-5" />
                  <span>Conectar C:\MeusProjetos\implantacoes.db</span>
                </button>
                <button
                  onClick={() => setIsRetaguardaSyncOpen(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Sincronizar Arquivo da Retaguarda</span>
                </button>
                <button
                  onClick={handleRestoreSampleData}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  <span>Restaurar Dados de Exemplo</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & KPIS */}
          {activeTab === 'overview' && demands.length > 0 && (
            <div className="space-y-6">
              {/* Painel de Indicadores de Contato (SLA: Todas (Total), Sem Contato, Contato Realizado) */}
              <ContactKpiPanel
                demands={demands}
                thresholds={alertThresholds}
                onViewAll={() => setActiveTab('table')}
                onViewWithoutContact={() => setActiveTab('stagnant')}
                onViewWithContact={() => setActiveTab('weekly-updated')}
                onOpenSettings={() => setIsAlertSettingsModalOpen(true)}
              />

              {/* Nova Seção de Configurações de Alerta (SLA Crítico e Alerta Personalizáveis) */}
              <AlertSettingsSection
                thresholds={alertThresholds}
                onChangeThresholds={handleSaveAlertThresholds}
                demands={demands}
              />

              {/* Executive KPI Cards */}
              <KpiCards metrics={metrics} onSelectFilter={handleKpiFilterJump} />

              {/* Weekly Trend Alert (Week-over-Week Percentage Indicator) */}
              <WeeklyTrendAlert 
                demands={demands} 
                thresholds={alertThresholds}
                onViewStagnant={() => setActiveTab('stagnant')} 
              />

              {/* GRÁFICO DE BURNUP: Horas Negociadas vs Consumidas ao Longo das Etapas */}
              <BurnupChartSection
                demands={demands}
                activeTeamMembers={teamMembers}
                onSelectDemand={setSelectedDemand}
              />

              {/* HIGHLIGHT: Projetos com Alterações Semanais na Visão Geral */}
              <WeeklyUpdatedOverviewSection 
                demands={demands}
                onSelectDemand={setSelectedDemand}
                onViewAllWeekly={() => setActiveTab('weekly-updated')}
              />

              {/* Weekly Evolution Trend Chart (Last 4 Weeks) */}
              <WeeklyEvolutionTrendChart demands={demands} />

              {/* Main Urgent Callout for Stagnant Demands */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/50 via-slate-900 to-indigo-950/40 border border-rose-900/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <Flame className="w-4 h-4 text-rose-500 animate-pulse" />
                    <span>Prioridade Máxima da Semana</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-100">
                    {metrics.stagnantCount} demandas ativas precisam de evolução imediata
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                    Identificamos <strong>{metrics.stagnantCritical} demandas críticas (&gt;{alertThresholds.criticalDays} dias sem avanço)</strong> e <strong>{metrics.stagnantAlert} em alerta ({alertThresholds.alertDays} a {alertThresholds.criticalDays} dias)</strong>. Acesse a lista para registrar check-in ou remover bloqueios.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('stagnant')}
                  className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 shrink-0"
                >
                  <span>Ver Demandas Estagnadas</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Process Bottlenecks Funnel Quick-Preview */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-400" />
                      Gargalos Operacionais Identificados por Etapa
                    </h3>
                    <p className="text-xs text-slate-400">
                      Onde as demandas estão parando antes de atingirem a conclusão
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('bottlenecks')}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <span>Abrir funil detalhado</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div 
                    onClick={() => setActiveTab('bottlenecks')}
                    className="p-4 rounded-xl bg-slate-950/60 border border-purple-900/40 hover:border-purple-600 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-purple-400">1. Alocação (Kickoff)</span>
                      <span className="font-mono font-bold text-slate-200">{metrics.unassigned}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Demandas abertas sem implantador definido na planilha.
                    </p>
                  </div>

                  <div 
                    onClick={() => setActiveTab('bottlenecks')}
                    className="p-4 rounded-xl bg-slate-950/60 border border-rose-900/40 hover:border-rose-600 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-rose-400">4. Go-Live (Homologação)</span>
                      <span className="font-mono font-bold text-slate-200">{metrics.overdue}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Projetos com prazo previsto expirado e entrega pendente.
                    </p>
                  </div>

                  <div 
                    onClick={() => setActiveTab('bottlenecks')}
                    className="p-4 rounded-xl bg-slate-950/60 border border-emerald-900/40 hover:border-emerald-600 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-emerald-400">5. Validação TEP (CS)</span>
                      <span className="font-mono font-bold text-slate-200">{metrics.tepPending}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Treinamento concluído, aguardando aceite formal do CS.
                    </p>
                  </div>
                </div>
              </div>

              {/* Top 5 Critical Demands Table in Overview */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-rose-400" />
                    Top Casos de Maior Estagnação (Ação Imediata)
                  </h3>
                  <button
                    onClick={() => setActiveTab('stagnant')}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    Ver todas ({metrics.stagnantCount})
                  </button>
                </div>

                <div className="space-y-2">
                  {demands
                    .filter(d => d.status === 'Em Andamento')
                    .sort((a, b) => b.daysSinceLastEvolution - a.daysSinceLastEvolution)
                    .slice(0, 5)
                    .map((d) => (
                      <div
                        key={d.seq}
                        onClick={() => setSelectedDemand(d)}
                        className="p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-400">#{d.seq}</span>
                            <span className="font-semibold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors">
                              {d.razaoSocial}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              {d.tipo}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Implantador: <strong className="text-slate-300">{d.implantador}</strong> • Comercial: <strong className="text-slate-300">{d.comercial}</strong> • Horas: <strong className="text-slate-300">{d.hrsNeg}h</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <div className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {d.daysSinceLastEvolution} dias sem evolução
                          </div>
                          <div className="p-1 rounded bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white transition-colors">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJETOS COM ALTERAÇÕES & EVOLUÇÕES SEMANAIS */}
          {activeTab === 'weekly-updated' && (
            <WeeklyUpdatedProjectsView
              demands={demands}
              onSelectDemand={setSelectedDemand}
              onOpenCheckIn={setSelectedDemand}
              activeTeamMembers={teamMembers}
              onOpenRegisterContact={(d) => setContactModalDemand(d)}
              onOpenContactHistory={(d) => setHistoryModalDemand(d)}
              onOpenExportXls={() => setIsExportModalOpen(true)}
            />
          )}

          {/* TAB 3: STAGNANT DEMANDS (VALIDAÇÃO DE CONTATO & EVOLUÇÃO SEMANAL) */}
          {activeTab === 'stagnant' && (
            <WeeklyEvolutionView
              demands={demands}
              thresholds={alertThresholds}
              onSelectDemand={setSelectedDemand}
              onOpenCheckIn={setSelectedDemand}
              activeTeamMembers={teamMembers}
              onQuickAssign={handleQuickAssign}
              onToggleRetaguarda={handleToggleRetaguarda}
              onOpenRegisterContact={(d) => setContactModalDemand(d)}
              onOpenContactHistory={(d) => setHistoryModalDemand(d)}
              onOpenExportXls={() => setIsExportModalOpen(true)}
            />
          )}

          {/* TAB 4: BOTTLENECKS BY PROCESS STAGE */}
          {activeTab === 'bottlenecks' && (
            <BottleneckStagesView
              demands={demands}
              onSelectDemand={setSelectedDemand}
              onViewBurnup={() => setActiveTab('burnup')}
            />
          )}

          {/* TAB 5: FULL DEMANDS TABLE */}
          {activeTab === 'table' && (
            <DemandsTable
              demands={demands}
              thresholds={alertThresholds}
              onSelectDemand={setSelectedDemand}
              onOpenCheckIn={setSelectedDemand}
              initialStatusFilter={statusFilterPreset}
              onToggleRetaguarda={handleToggleRetaguarda}
              onOpenRegisterContact={(d) => setContactModalDemand(d)}
              onOpenContactHistory={(d) => setHistoryModalDemand(d)}
              onOpenExportXls={() => setIsExportModalOpen(true)}
            />
          )}

          {/* TAB 6: WORKLOAD BY IMPLANTADOR */}
          {activeTab === 'team' && (
            <WorkloadView 
              demands={demands}
              activeTeamMembers={teamMembers}
              onAddTeamMember={handleAddTeamMember}
              onRemoveTeamMember={handleRemoveTeamMember}
              onBatchAssign={handleBatchAssign}
            />
          )}

          {/* TAB 7: EFFORT RANKING & HISTÓRICO DE ACOMPANHAMENTOS */}
          {activeTab === 'ranking' && (
            <ImplantadorRankingView 
              demands={demands}
              activeTeamMembers={teamMembers}
              onSelectDemand={setSelectedDemand}
              onOpenCheckInModal={setSelectedDemand}
            />
          )}

          {/* TAB 8: GRÁFICO DE BURNUP & PRODUTIVIDADE */}
          {activeTab === 'burnup' && (
            <BurnupChartSection
              demands={demands}
              activeTeamMembers={teamMembers}
              onSelectDemand={setSelectedDemand}
            />
          )}
        </main>
      </div>

      {/* Demand Detail / Check-In Modal */}
      {selectedDemand && (
        <DemandDetailModal
          demand={selectedDemand}
          thresholds={alertThresholds}
          onClose={() => setSelectedDemand(null)}
          onSaveDemand={handleSaveDemand}
          availableImplantadores={availableImplantadores}
          activeTeamMembers={teamMembers}
          onAddNewImplantador={handleAddTeamMember}
        />
      )}

      {/* Retaguarda System Synchronization Modal */}
      <RetaguardaSyncModal
        isOpen={isRetaguardaSyncOpen}
        onClose={() => setIsRetaguardaSyncOpen(false)}
        currentDemands={demands}
        onApplySync={handleApplyRetaguardaSync}
        onOpenApiMonitor={() => setIsApiMonitorOpen(true)}
      />

      {/* Local SQLite Database File (C:\MeusProjetos\implantacoes.db) Modal */}
      <SqliteConnectModal
        isOpen={isSqliteModalOpen}
        onClose={() => setIsSqliteModalOpen(false)}
        currentDemands={demands}
        activeTeamMembers={teamMembers}
        onDemandsLoadedFromSqlite={handleDemandsLoadedFromSqlite}
      />

      {/* Configurações de Alerta & SLA Modal */}
      {isAlertSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100">
                    Configurações de Alerta & Limiares de Gargalo
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ajuste os limiares de tempo para calibrar os alertas da equipe
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAlertSettingsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <AlertSettingsSection
              thresholds={alertThresholds}
              onChangeThresholds={handleSaveAlertThresholds}
              demands={demands}
            />

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsAlertSettingsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-950/50"
              >
                Fechar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Global de Registro de Contato */}
      <ContactRegistrationModal
        isOpen={Boolean(contactModalDemand)}
        onClose={() => setContactModalDemand(null)}
        demand={contactModalDemand}
        activeTeamMembers={teamMembers}
        onContactSaved={handleContactSaved}
      />

      {/* Modal Global de Histórico de Contatos */}
      <ContactHistoryModal
        isOpen={Boolean(historyModalDemand)}
        onClose={() => setHistoryModalDemand(null)}
        demand={historyModalDemand}
        onOpenRegisterNew={(d) => {
          setHistoryModalDemand(null);
          setContactModalDemand(d);
        }}
      />

      {/* Modal de Exportação XLS (Contatos & Acompanhamentos da Semana) */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        demands={demands}
        thresholds={alertThresholds}
      />

      {/* Modal de Monitoramento em Tempo Real da API Retaguarda */}
      <RetaguardaApiMonitorModal
        isOpen={isApiMonitorOpen}
        onClose={() => setIsApiMonitorOpen(false)}
      />
    </div>
  );
}

