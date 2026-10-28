import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { Demand } from '../types';
import { 
  calculateImplantadorProductivity, 
  getAllImplantadoresProductivity, 
  STAGES_CONFIG,
  BurnupStagePoint 
} from '../utils/burnupUtils';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Flame, 
  User, 
  Users, 
  Layers, 
  SlidersHorizontal, 
  BarChart3, 
  ArrowRight,
  ShieldAlert,
  Info,
  Zap,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';

interface BurnupChartSectionProps {
  demands: Demand[];
  activeTeamMembers?: string[];
  onSelectDemand?: (demand: Demand) => void;
}

export const BurnupChartSection: React.FC<BurnupChartSectionProps> = ({
  demands,
  activeTeamMembers = ['Leonardo', 'Diogo'],
  onSelectDemand,
}) => {
  const [selectedImplantador, setSelectedImplantador] = useState<string>('all');
  const [chartMode, setChartMode] = useState<'burnup' | 'stage_bars'>('burnup');

  // Compute available implantadores list
  const availableImplantadores = useMemo(() => {
    const set = new Set<string>();
    activeTeamMembers.forEach(m => set.add(m));
    demands.forEach(d => {
      if (d.implantador && d.implantador.trim() !== '' && d.implantador !== 'Não Atribuído') {
        set.add(d.implantador);
      }
    });
    return Array.from(set).sort();
  }, [demands, activeTeamMembers]);

  // Compute current productivity summary for selected implantador
  const summary = useMemo(
    () => calculateImplantadorProductivity(demands, selectedImplantador),
    [demands, selectedImplantador]
  );

  // Compute all implantadores summaries for comparison cards
  const allImplantadores = useMemo(
    () => getAllImplantadoresProductivity(demands),
    [demands]
  );

  // Prepare chart dataset
  const chartData = useMemo(() => {
    return summary.burnupPoints.map(p => {
      const stageConfig = STAGES_CONFIG.find(s => s.id === p.stageId);
      return {
        stageId: p.stageId,
        stageName: stageConfig ? stageConfig.shortName : p.stageName,
        fullName: p.stageName,
        horasNegociadasAcumuladas: p.horasNegociadasAcumuladas,
        horasConsumidasAcumuladas: p.horasConsumidasAcumuladas,
        horasNegociadasEtapa: p.horasNegociadasEtapa,
        horasConsumidasEtapa: p.horasConsumidasEtapa,
        saldoEtapa: p.saldoHorasEtapa,
        saldoAcumulado: p.saldoAcumulado,
        percentualConsumo: p.percentualConsumoEtapa,
        metaEscopoTotal: p.metaEscopoTotal,
        statusGargalo: p.statusGargalo,
      };
    });
  }, [summary]);

  const isOverBudget = summary.saldoHoras < 0;
  const efficiencyColor = summary.taxaEficiencia > 105 
    ? 'text-rose-400' 
    : summary.taxaEficiencia >= 90 
    ? 'text-amber-400' 
    : 'text-emerald-400';

  // Custom rich tooltip for Burnup chart
  const CustomBurnupTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isStageOver = data.horasConsumidasEtapa > data.horasNegociadasEtapa;
      return (
        <div className="p-4 bg-slate-900/95 border border-slate-750 rounded-2xl shadow-2xl text-xs space-y-3 font-sans min-w-[260px] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 text-sm">{data.fullName}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              data.statusGargalo === 'critico'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : data.statusGargalo === 'alerta'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              {data.statusGargalo === 'critico' ? 'Gargalo Crítico' : data.statusGargalo === 'alerta' ? 'Atenção' : 'No Orçamento'}
            </span>
          </div>

          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-indigo-300">
              <span className="font-sans flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Negociado Acumulado:
              </span>
              <strong className="text-slate-200">{data.horasNegociadasAcumuladas}h</strong>
            </div>

            <div className="flex items-center justify-between text-cyan-300">
              <span className="font-sans flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                Consumido Acumulado:
              </span>
              <strong className="text-cyan-200 font-bold">{data.horasConsumidasAcumuladas}h</strong>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
              <span className="font-sans text-slate-400">Gasto nesta etapa:</span>
              <span className={isStageOver ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {data.horasConsumidasEtapa}h vs {data.horasNegociadasEtapa}h ({data.percentualConsumo}%)
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="font-sans text-slate-400">Saldo acumulado:</span>
              <span className={data.saldoAcumulado < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {data.saldoAcumulado >= 0 ? `+${data.saldoAcumulado}h (Margem)` : `${data.saldoAcumulado}h (Estouro)`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 shadow-2xl space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30 shadow-xs">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Gráfico de Burnup • Horas Negociadas vs Consumidas</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
              Produtividade & Escopo
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Compare o total de <strong>horas negociadas</strong> em contrato versus as <strong>horas consumidas</strong> ao longo das 5 etapas para identificar precocemente gargalos operacionais e estouros por implantador.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start lg:self-center">
          <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1 shadow-inner">
            <button
              onClick={() => setChartMode('burnup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartMode === 'burnup'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Curva Burnup
            </button>
            <button
              onClick={() => setChartMode('stage_bars')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartMode === 'stage_bars'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Consumo por Etapa
            </button>
          </div>
        </div>
      </div>

      {/* Implantador Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800">
          <button
            onClick={() => setSelectedImplantador('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedImplantador === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Todos os Implantadores ({demands.length})</span>
          </button>

          {availableImplantadores.map(name => {
            const count = demands.filter(d => d.implantador === name).length;
            const isSelected = selectedImplantador === name;
            return (
              <button
                key={name}
                onClick={() => setSelectedImplantador(name)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{name} ({count})</span>
              </button>
            );
          })}

          {demands.some(d => !d.implantador || d.implantador === 'Não Atribuído') && (
            <button
              onClick={() => setSelectedImplantador('Não Atribuído')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedImplantador === 'Não Atribuído'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-purple-400/80 hover:text-purple-300 hover:bg-slate-900'
              }`}
            >
              <span>Fila Sem Atribuição</span>
            </button>
          )}
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Analisando <strong>{summary.totalDemandas}</strong> demandas • <strong>{summary.demandasAtivas} ativas</strong>
        </div>
      </div>

      {/* 4 Executive Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Horas Negociadas */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Horas Negociadas</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-100">
            {summary.horasNegociadas}h
          </div>
          <p className="text-xs text-slate-400">
            Escopo contratado para as {summary.totalDemandas} demandas
          </p>
        </div>

        {/* Card 2: Horas Consumidas Estimadas */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Horas Consumidas</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-300">
            {summary.horasConsumidas}h
          </div>
          <p className="text-xs text-slate-400">
            Taxa de consumo: <strong className={efficiencyColor}>{summary.taxaEficiencia}% do escopo</strong>
          </p>
        </div>

        {/* Card 3: Saldo / Margem */}
        <div className={`p-4 rounded-2xl border space-y-1 shadow-sm ${
          isOverBudget
            ? 'bg-rose-950/30 border-rose-900/60'
            : 'bg-emerald-950/20 border-emerald-900/50'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-semibold uppercase tracking-wider text-[11px] ${
              isOverBudget ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {isOverBudget ? 'Estouro de Horas' : 'Saldo de Horas'}
            </span>
            <div className={`p-1.5 rounded-lg border ${
              isOverBudget
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {isOverBudget ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono ${
            isOverBudget ? 'text-rose-300' : 'text-emerald-300'
          }`}>
            {summary.saldoHoras >= 0 ? `+${summary.saldoHoras}h` : `${summary.saldoHoras}h`}
          </div>
          <p className="text-xs text-slate-300">
            {isOverBudget 
              ? 'Excesso de horas consumidas acima do contratado' 
              : 'Margem positiva restante dentro do orçamento'}
          </p>
        </div>

        {/* Card 4: Principal Gargalo de Produtividade */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-950/30 to-slate-950/80 border border-amber-900/50 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-400 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Gargalo de Produtividade</span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-bold text-amber-200 line-clamp-1">
            {summary.etapaMaiorGargalo}
          </div>
          <p className="text-xs text-slate-300">
            {summary.gravidadeGargalo === 'critico' ? (
              <span className="text-rose-400 font-semibold">⚠️ Consumo crítico superior a 120% do previsto</span>
            ) : summary.gravidadeGargalo === 'alerta' ? (
              <span className="text-amber-400 font-semibold">⚡ Consumo elevado próximo do limite (95%+)</span>
            ) : (
              <span className="text-emerald-400 font-semibold">✓ Consumo equilibrado em todas as etapas</span>
            )}
          </p>
        </div>
      </div>

      {/* Main Burnup Visualization Chart */}
      <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>
                {chartMode === 'burnup' 
                  ? `Curva de Burnup de Horas: ${selectedImplantador === 'all' ? 'Toda a Equipe' : selectedImplantador}` 
                  : `Comparativo de Consumo por Etapa: ${selectedImplantador === 'all' ? 'Toda a Equipe' : selectedImplantador}`}
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              {chartMode === 'burnup'
                ? 'A linha de horas consumidas deve se aproximar da meta sem ultrapassar o teto contratado.'
                : 'Barras comparando o orçamento negociado e o consumo real em cada fase.'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-3 h-1 bg-indigo-500 inline-block rounded-full" />
              <span>Negociado (Meta)</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-3 h-1 bg-cyan-400 inline-block rounded-full" />
              <span>Consumido (Real)</span>
            </span>
          </div>
        </div>

        {/* Recharts Component */}
        <div className="h-72 sm:h-80 w-full pt-2">
          {chartMode === 'burnup' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 0, bottom: 25 }}>
                <defs>
                  <linearGradient id="burnupConsumedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="burnupNegotiatedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                <XAxis 
                  dataKey="stageName" 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                  dy={10}
                />

                <YAxis 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                  unit="h"
                  dx={-5}
                />

                <Tooltip content={<CustomBurnupTooltip />} />

                {/* Reference Line for Total Scope Ceiling */}
                <ReferenceLine 
                  y={summary.horasNegociadas} 
                  stroke="#818cf8" 
                  strokeDasharray="4 4" 
                  label={{ 
                    value: `Teto Total: ${summary.horasNegociadas}h`, 
                    fill: '#a5b4fc', 
                    fontSize: 10, 
                    position: 'insideTopRight' 
                  }} 
                />

                {/* Planned Scope Area / Curve */}
                <Area
                  type="monotone"
                  dataKey="horasNegociadasAcumuladas"
                  name="Horas Negociadas Acumuladas"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#burnupNegotiatedGradient)"
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#0f172a' }}
                />

                {/* Actual Consumed Hours Curve */}
                <Area
                  type="monotone"
                  dataKey="horasConsumidasAcumuladas"
                  name="Horas Consumidas Acumuladas"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  fill="url(#burnupConsumedGradient)"
                  dot={{ r: 5, fill: '#06b6d4', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 7, fill: '#22d3ee', stroke: '#ffffff' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 25, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="stageName" stroke="#64748b" fontSize={11} tickLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="h" dx={-5} />
                <Tooltip content={<CustomBurnupTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }} 
                  formatter={(val) => <span className="text-slate-300">{val}</span>} 
                />
                <Bar 
                  dataKey="horasNegociadasEtapa" 
                  name="Horas Negociadas na Etapa" 
                  fill="#6366f1" 
                  radius={[6, 6, 0, 0]} 
                />
                <Bar 
                  dataKey="horasConsumidasEtapa" 
                  name="Horas Consumidas na Etapa" 
                  fill="#06b6d4" 
                  radius={[6, 6, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Breakdown Table: Productivity & Bottleneck by Stage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <span>Matriz de Gargalos por Etapa ({selectedImplantador === 'all' ? 'Equipe' : selectedImplantador})</span>
          </h4>
          <span className="text-xs text-slate-400 font-mono">
            Meta Total: {summary.horasNegociadas}h • Consumido: {summary.horasConsumidas}h
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider font-mono">
              <tr>
                <th className="py-3 px-4">Etapa do Processo</th>
                <th className="py-3 px-3 text-right">Horas Negociadas</th>
                <th className="py-3 px-3 text-right">Horas Consumidas</th>
                <th className="py-3 px-3 text-right">Saldo (+/-)</th>
                <th className="py-3 px-4 text-center">Consumo da Etapa</th>
                <th className="py-3 px-4 text-center">Status do Gargalo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary.burnupPoints.map((point) => {
                const isOver = point.horasConsumidasEtapa > point.horasNegociadasEtapa;
                const isCritical = point.statusGargalo === 'critico';
                const isAlert = point.statusGargalo === 'alerta';

                return (
                  <tr key={point.stageId} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        <span>{point.stageName}</span>
                        {point.stageId === summary.etapaMaiorGargaloId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            Maior Gargalo
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-indigo-300">
                      {point.horasNegociadasEtapa}h
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono font-bold text-cyan-300">
                      {point.horasConsumidasEtapa}h
                    </td>

                    <td className={`py-3.5 px-3 text-right font-mono font-bold ${
                      point.saldoHorasEtapa < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {point.saldoHorasEtapa >= 0 ? `+${point.saldoHorasEtapa}h` : `${point.saldoHorasEtapa}h`}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden shadow-inner">
                          <div 
                            style={{ width: `${Math.min(100, point.percentualConsumoEtapa)}%` }}
                            className={`h-full transition-all duration-300 ${
                              isCritical ? 'bg-rose-500' : isAlert ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-300 w-10 text-right">
                          {point.percentualConsumoEtapa}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : isAlert
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {isCritical ? 'Gargalo Crítico (Estouro)' : isAlert ? 'Alerta de Consumo' : 'Dentro da Meta'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparison Cards Across All Implantadores */}
      <div className="space-y-3 pt-2">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Comparativo de Produtividade & Gargalos por Implantador</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {allImplantadores.map((imp) => {
            const isSelected = selectedImplantador === imp.implantador;
            const isOver = imp.saldoHoras < 0;

            return (
              <div
                key={imp.implantador}
                onClick={() => setSelectedImplantador(imp.implantador)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-indigo-950/40 to-slate-900 border-cyan-500 shadow-md shadow-cyan-950/20'
                    : 'bg-slate-950/70 hover:bg-slate-850/80 border-slate-800 hover:border-slate-750'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'
                      }`}>
                        {imp.implantador.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-100 text-sm group-hover:text-cyan-300 transition-colors">
                          {imp.implantador}
                        </h5>
                        <span className="text-[10px] text-slate-400">
                          {imp.totalDemandas} demandas ({imp.demandasAtivas} ativas)
                        </span>
                      </div>
                    </div>

                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isOver 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {imp.taxaEficiencia}% uso
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono py-2 my-2 border-y border-slate-900">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Negociado:</span>
                      <strong className="text-indigo-300">{imp.horasNegociadas}h</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Consumido:</span>
                      <strong className="text-cyan-300">{imp.horasConsumidas}h</strong>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Maior Gargalo:</span>
                    <p className="text-amber-300 font-semibold line-clamp-1 text-[11px]">
                      {imp.etapaMaiorGargalo}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between text-xs text-cyan-400 font-semibold group-hover:text-cyan-300">
                  <span>{isSelected ? 'Visualizando no gráfico' : 'Filtrar gráfico'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demands with Highest Burnup Risk */}
      {summary.demandasEmRisco.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-rose-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                Demandas com Maior Risco de Estouro de Horas ({selectedImplantador === 'all' ? 'Equipe' : selectedImplantador})
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {summary.demandasEmRisco.length} projetos monitorados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {summary.demandasEmRisco.map(item => (
              <div
                key={item.seq}
                onClick={() => {
                  if (onSelectDemand) {
                    const match = demands.find(d => d.seq === item.seq);
                    if (match) onSelectDemand(match);
                  }
                }}
                className={`p-3 rounded-xl bg-slate-900/80 border transition-all flex items-center justify-between gap-3 ${
                  onSelectDemand ? 'cursor-pointer hover:border-rose-500/80 hover:bg-slate-850' : ''
                } ${item.statusRisco === 'critico' ? 'border-rose-900/60' : 'border-amber-900/40'}`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-400">#{item.seq}</span>
                    <span className="font-semibold text-slate-100 text-xs line-clamp-1">{item.razaoSocial}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {item.motivoGargalo}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-xs font-mono font-bold block ${
                    item.statusRisco === 'critico' ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {item.horasConsumidas}h / {item.hrsNeg}h
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {item.percentualGasto}% gasto
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
