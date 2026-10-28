import React, { useEffect } from 'react';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  GitCommit, 
  Table, 
  Users, 
  Flame,
  CheckCircle2, 
  Clock,
  Sparkles,
  UploadCloud,
  ChevronRight,
  HardDrive,
  Trophy,
  PhoneCall,
  SlidersHorizontal,
  TrendingUp,
  X,
  Activity
} from 'lucide-react';
import { AlertThresholdSettings } from '../types';
import { DEFAULT_ALERT_THRESHOLDS } from '../utils/contactUtils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  metrics: {
    totalOngoing: number;
    stagnantCount: number;
    weeklyUpdatedCount: number;
    bottleneckCount: number;
    unassignedCount: number;
    tepPendingCount: number;
  };
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  activeTeamMembers?: string[];
  onOpenRetaguardaSync?: () => void;
  onOpenSqliteConnect?: () => void;
  onOpenApiMonitor?: () => void;
  isSqliteConnected?: boolean;
  hasDirectWriteAccess?: boolean;
  thresholds?: AlertThresholdSettings;
  onOpenAlertSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  metrics,
  isMobileOpen,
  setIsMobileOpen,
  activeTeamMembers = ['Leonardo', 'Diogo'],
  onOpenRetaguardaSync,
  onOpenSqliteConnect,
  onOpenApiMonitor,
  isSqliteConnected = false,
  hasDirectWriteAccess = false,
  thresholds = DEFAULT_ALERT_THRESHOLDS,
  onOpenAlertSettings,
}) => {
  // Close sidebar on Escape key when open as drawer/modal
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, setIsMobileOpen]);

  const menuItems = [
    {
      id: 'overview',
      label: 'Visão Geral & KPIs',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'weekly-updated',
      label: 'Evoluções da Semana',
      icon: Sparkles,
      badge: metrics.weeklyUpdatedCount,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    },
    {
      id: 'stagnant',
      label: 'Validação de Contatos',
      icon: PhoneCall,
      badge: metrics.stagnantCount,
      badgeColor: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    },
    {
      id: 'bottlenecks',
      label: 'Gargalos por Etapa',
      icon: GitCommit,
      badge: metrics.bottleneckCount,
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    },
    {
      id: 'burnup',
      label: 'Gráfico de Burnup',
      icon: TrendingUp,
      badge: null,
    },
    {
      id: 'table',
      label: 'Demandas & Projetos',
      icon: Table,
      badge: metrics.totalOngoing,
      badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    },
    {
      id: 'team',
      label: 'Carga por Implantador',
      icon: Users,
      badge: null,
    },
    {
      id: 'ranking',
      label: 'Ranking de Esforço',
      icon: Trophy,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay (touch to close) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar: Fluid, Responsiva, Sem Escalação Artificial */}
      <aside 
        id="main-sidebar"
        aria-label="Menu Lateral de Navegação"
        className={`
          sidebar-container fixed top-0 bottom-0 left-0 z-50
          min-h-[100dvh] h-[100dvh]
          bg-slate-900 border-r border-slate-800
          flex flex-col box-border max-w-full
          transition-transform duration-250 ease-out will-change-transform
          lg:translate-x-0 ${isMobileOpen ? 'translate-x-0 shadow-2xl shadow-black/90' : '-translate-x-full'}
        `}
      >
        {/* ================= 1. SIDEBAR-HEADER ================= */}
        <header className="sidebar-header px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800/90 flex items-center justify-between shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/25">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-slate-100 tracking-tight text-sm sm:text-base leading-snug truncate">
                Implantação 360°
              </h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block shrink-0" />
                <span className="truncate">Painel Ativo</span>
              </p>
            </div>
          </div>

          {/* Close button on mobile / tablet */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden min-w-[44px] min-h-[44px] -mr-2 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            aria-label="Fechar menu lateral"
            title="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* ================= 2. SIDEBAR-CONTENT ================= */}
        <div className="sidebar-content flex-1 min-h-0 overflow-y-auto sidebar-scroll p-3 sm:p-3.5 space-y-3">
          {/* Quick Stagnation Alert Banner (Touch friendly & fluid) */}
          <div 
            onClick={() => {
              setActiveTab('stagnant');
              setIsMobileOpen(false);
            }}
            className="p-3 sm:p-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/60 border border-rose-900/60 hover:border-rose-700/80 transition-all duration-200 cursor-pointer group shadow-xs hover:shadow-rose-950/30"
            title="Ver demandas sem contato ou evolução recente"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 font-semibold text-rose-200 text-xs min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="truncate">Alerta de Estagnação</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-rose-400/70 group-hover:text-rose-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed break-words">
              <strong className="text-rose-400 font-bold">{metrics.stagnantCount}</strong> demandas ativas sem evolução há mais de {thresholds.alertDays} dias.
            </p>
          </div>

          {/* Nav List: Standardized Touch Targets (>=44px), Icon | Text | Badge */}
          <nav aria-label="Navegação da Aplicação" className="space-y-1">
            <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navegação Principal
            </div>

            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileOpen(false);
                  }}
                  className={`
                    w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-[13px] font-medium transition-all group select-none
                    ${isActive 
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent'}
                  `}
                >
                  {/* Left: Icon and Label */}
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 pr-2">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
                    <span className="truncate text-left leading-normal">
                      {item.label}
                    </span>
                  </div>

                  {/* Right: Badge / Indicator */}
                  {item.badge !== null && (
                    <span className={`ml-auto shrink-0 px-2 py-0.5 text-[11px] font-bold rounded-full font-mono ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* ================= ACTION CARDS & SETTINGS ================= */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
            {/* Sincronizar Retaguarda Button */}
            {onOpenRetaguardaSync && (
              <button
                type="button"
                onClick={() => {
                  onOpenRetaguardaSync();
                  setIsMobileOpen(false);
                }}
                className="w-full min-h-[44px] p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-indigo-950/40 to-slate-900/80 hover:from-indigo-900/60 hover:to-slate-850 border border-indigo-700/50 hover:border-indigo-500 text-left flex items-center justify-between group transition-all"
                title="Sincronizar arquivo de dados da Retaguarda"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <UploadCloud className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                      Sincronizar Retaguarda
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Importar arquivo CSV / ERP
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            )}

            {/* Monitor da API Retaguarda Button */}
            {onOpenApiMonitor && (
              <button
                type="button"
                onClick={() => {
                  onOpenApiMonitor();
                  setIsMobileOpen(false);
                }}
                className="w-full min-h-[44px] p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-cyan-950/40 to-slate-900/80 hover:from-cyan-900/60 hover:to-slate-850 border border-cyan-800/60 hover:border-cyan-500 text-left flex items-center justify-between group transition-all"
                title="Monitorar conexões, latência e logs da API Retaguarda ERP"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-700/80 text-cyan-200 flex items-center justify-center shrink-0 shadow-xs">
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition-colors truncate">
                      Monitor da API ERP
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Logs e status da rota em tempo real
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            )}

            {/* SQLite Local .db File Trigger */}
            {onOpenSqliteConnect && (
              <button
                type="button"
                onClick={() => {
                  onOpenSqliteConnect();
                  setIsMobileOpen(false);
                }}
                className={`w-full min-h-[44px] p-2.5 sm:p-3 rounded-xl border transition-all text-left flex items-center justify-between group ${
                  hasDirectWriteAccess
                    ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-700/80 shadow-xs'
                    : isSqliteConnected 
                    ? 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-800/80 shadow-xs' 
                    : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800/90'
                }`}
                title="Conectar banco SQLite local"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                    hasDirectWriteAccess
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : isSqliteConnected 
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    <HardDrive className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold transition-colors flex items-center gap-1.5 truncate ${
                      hasDirectWriteAccess ? 'text-emerald-200 group-hover:text-emerald-100' : 'text-slate-200 group-hover:text-cyan-300'
                    }`}>
                      <span className="truncate">{hasDirectWriteAccess ? 'SQLite Tempo Real' : 'SQLite Local'}</span>
                      {isSqliteConnected && (
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse shrink-0 ${hasDirectWriteAccess ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      implantacoes.db
                    </div>
                  </div>
                </div>

                <span className={`ml-auto shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                  hasDirectWriteAccess
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isSqliteConnected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700 group-hover:bg-cyan-600 group-hover:text-white'
                }`}>
                  {hasDirectWriteAccess ? 'Direto' : isSqliteConnected ? 'Ativo' : 'Conectar'}
                </span>
              </button>
            )}

            {/* Configurações de Alerta Section */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1.5 truncate min-w-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Configurações de Alerta</span>
                </span>
                {onOpenAlertSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAlertSettings();
                      setIsMobileOpen(false);
                    }}
                    className="min-h-[28px] text-[11px] text-indigo-300 hover:text-white font-semibold transition-colors px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/60 shrink-0"
                    title="Personalizar dias de limiar"
                  >
                    Ajustar
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-800/60">
                <span className="text-rose-400 font-bold truncate">Crítico &gt;{thresholds.criticalDays}d</span>
                <span className="text-slate-600 mx-1 shrink-0">•</span>
                <span className="text-amber-400 font-bold truncate">Alerta {thresholds.alertDays} a {thresholds.criticalDays}d</span>
              </div>
            </div>

            {/* Active Team Pill (Height auto, quebra natural) */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 space-y-1.5 h-auto">
              <span className="text-[11px] uppercase font-bold text-indigo-300 block tracking-wide">
                Implantadores Ativos:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {activeTeamMembers.length > 0 ? (
                  activeTeamMembers.map((member, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center text-xs font-semibold text-slate-200 bg-slate-800/80 border border-slate-700/70 px-2 py-0.5 rounded-md break-words max-w-full"
                    >
                      {member}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">Nenhum cadastrado</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= 3. SIDEBAR-FOOTER ================= */}
        <footer className="sidebar-footer p-3 sm:p-3.5 border-t border-slate-800/90 bg-slate-950/70 shrink-0 space-y-2">
          <div className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate min-w-0 pr-2">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Sem Implantador</span>
            </span>
            <span className="font-mono text-amber-400 font-bold shrink-0 ml-auto">{metrics.unassignedCount}</span>
          </div>

          <div className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate min-w-0 pr-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Pendente TEP / CS</span>
            </span>
            <span className="font-mono text-indigo-400 font-bold shrink-0 ml-auto">{metrics.tepPendingCount}</span>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 text-center border-t border-slate-800/70 font-mono tracking-wide">
            Data Base: 30/09/2026
          </div>
        </footer>
      </aside>
    </>
  );
};
