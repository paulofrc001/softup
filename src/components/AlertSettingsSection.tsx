import React, { useState, useMemo } from 'react';
import { Demand, AlertThresholdSettings } from '../types';
import { getContactValidationCounts, DEFAULT_ALERT_THRESHOLDS } from '../utils/contactUtils';
import { 
  SlidersHorizontal, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Info, 
  Clock, 
  Sparkles,
  Zap,
  ShieldAlert
} from 'lucide-react';

interface AlertSettingsSectionProps {
  thresholds: AlertThresholdSettings;
  onChangeThresholds: (newThresholds: AlertThresholdSettings) => void;
  demands: Demand[];
  compact?: boolean;
}

export const AlertSettingsSection: React.FC<AlertSettingsSectionProps> = ({
  thresholds,
  onChangeThresholds,
  demands,
  compact = false,
}) => {
  const [criticalInput, setCriticalInput] = useState<number>(thresholds.criticalDays);
  const [alertInput, setAlertInput] = useState<number>(thresholds.alertDays);
  const [justSaved, setJustSaved] = useState<boolean>(false);

  // Sync state if props change externally
  React.useEffect(() => {
    setCriticalInput(thresholds.criticalDays);
    setAlertInput(thresholds.alertDays);
  }, [thresholds.criticalDays, thresholds.alertDays]);

  // Validation
  const isValid = criticalInput > alertInput && alertInput >= 1;
  const validationError = !isValid
    ? alertInput < 1
      ? 'O limiar de alerta deve ser de pelo menos 1 dia.'
      : 'O limiar crítico deve ser estritamente maior que o limiar de alerta.'
    : null;

  // Impact preview with current slider values if valid, else with active thresholds
  const previewThresholds = useMemo<AlertThresholdSettings>(() => {
    if (isValid) {
      return { criticalDays: criticalInput, alertDays: alertInput };
    }
    return thresholds;
  }, [criticalInput, alertInput, isValid, thresholds]);

  const previewCounts = useMemo(
    () => getContactValidationCounts(demands, previewThresholds),
    [demands, previewThresholds]
  );

  const handleApply = (crit: number, alr: number) => {
    if (crit > alr && alr >= 1) {
      onChangeThresholds({ criticalDays: crit, alertDays: alr });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
    }
  };

  const handlePreset = (crit: number, alr: number) => {
    setCriticalInput(crit);
    setAlertInput(alr);
    handleApply(crit, alr);
  };

  const handleReset = () => {
    handlePreset(DEFAULT_ALERT_THRESHOLDS.criticalDays, DEFAULT_ALERT_THRESHOLDS.alertDays);
  };

  if (compact) {
    return (
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-200">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Configurações de Alerta</span>
          </div>
          <button
            onClick={handleReset}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
            title="Restaurar padrão 14d e 7d"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Padrão</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-rose-400 uppercase font-bold block mb-1">
              Crítico (&gt; {criticalInput}d)
            </label>
            <input
              type="number"
              min={alertInput + 1}
              max={90}
              value={criticalInput}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setCriticalInput(val);
                if (val > alertInput) handleApply(val, alertInput);
              }}
              className="w-full bg-slate-900 border border-rose-900/50 rounded-lg px-2 py-1 text-slate-100 text-center font-mono font-bold focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-amber-400 uppercase font-bold block mb-1">
              Alerta ({alertInput} a {criticalInput}d)
            </label>
            <input
              type="number"
              min={1}
              max={criticalInput - 1}
              value={alertInput}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setAlertInput(val);
                if (criticalInput > val && val >= 1) handleApply(criticalInput, val);
              }}
              className="w-full bg-slate-900 border border-amber-900/50 rounded-lg px-2 py-1 text-slate-100 text-center font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
          <span>Impacto na carteira:</span>
          <span className="font-mono text-rose-300 font-bold">
            {previewCounts.critico} Críticos • {previewCounts.alerta} Alertas
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-indigo-900/50 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Configurações de Alerta & Limiares de Gargalo</span>
            </h3>
            {justSaved && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30 flex items-center gap-1 animate-fade-in">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Salvo e Aplicado</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Defina o número de dias para os limiares de <strong>Crítico</strong> e <strong>Alerta</strong> (atualmente fixados em 14 e 7 dias por padrão) para calibrar a sensibilidade do monitoramento à carga da equipe.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Restaurar valores de referência (14 dias para Crítico, 7 dias para Alerta)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Restaurar Padrão (14d / 7d)</span>
          </button>
        </div>
      </div>

      {/* Main Settings Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Box 1: Limiar Crítico */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-rose-950/20 to-slate-950/80 border border-rose-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <label className="text-sm font-bold text-rose-300">
                Limiar Crítico (&gt; X dias)
              </label>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Atual: &gt;{thresholds.criticalDays} dias
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Demandas sem evolução ou contato com cliente há mais que este número de dias recebem status <strong>Crítico</strong> (prioridade máxima).
          </p>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center border border-slate-700 rounded-xl bg-slate-950 overflow-hidden shadow-inner">
              <button
                type="button"
                onClick={() => {
                  const val = Math.max(alertInput + 1, criticalInput - 1);
                  setCriticalInput(val);
                  handleApply(val, alertInput);
                }}
                className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-colors"
                title="Diminuir 1 dia"
              >
                -
              </button>
              <input
                type="number"
                min={alertInput + 1}
                max={90}
                value={criticalInput}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setCriticalInput(val);
                }}
                onBlur={() => {
                  if (criticalInput > alertInput) {
                    handleApply(criticalInput, alertInput);
                  } else {
                    setCriticalInput(thresholds.criticalDays);
                  }
                }}
                className="w-16 bg-transparent text-center font-mono font-black text-slate-100 text-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const val = criticalInput + 1;
                  setCriticalInput(val);
                  handleApply(val, alertInput);
                }}
                className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-colors"
                title="Aumentar 1 dia"
              >
                +
              </button>
            </div>

            <div className="text-xs text-slate-300">
              <span className="font-semibold">dias corridos</span>
              <span className="block text-[11px] text-slate-400">
                Padrão SoftUp: 14 dias
              </span>
            </div>
          </div>
        </div>

        {/* Box 2: Limiar Alerta */}
        <div className="p-4 rounded-xl bg-gradient-to-b from-amber-950/20 to-slate-950/80 border border-amber-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <label className="text-sm font-bold text-amber-300">
                Limiar de Alerta (Y a X dias)
              </label>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Atual: {thresholds.alertDays} a {thresholds.criticalDays} dias
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Demandas sem evolução entre este valor e o limiar crítico entram em <strong>Alerta</strong> (aviso preventivo de estagnação).
          </p>

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center border border-slate-700 rounded-xl bg-slate-950 overflow-hidden shadow-inner">
              <button
                type="button"
                onClick={() => {
                  const val = Math.max(1, alertInput - 1);
                  setAlertInput(val);
                  handleApply(criticalInput, val);
                }}
                className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-colors"
                title="Diminuir 1 dia"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={criticalInput - 1}
                value={alertInput}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setAlertInput(val);
                }}
                onBlur={() => {
                  if (criticalInput > alertInput && alertInput >= 1) {
                    handleApply(criticalInput, alertInput);
                  } else {
                    setAlertInput(thresholds.alertDays);
                  }
                }}
                className="w-16 bg-transparent text-center font-mono font-black text-slate-100 text-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const val = Math.min(criticalInput - 1, alertInput + 1);
                  setAlertInput(val);
                  handleApply(criticalInput, val);
                }}
                className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-colors"
                title="Aumentar 1 dia"
              >
                +
              </button>
            </div>

            <div className="text-xs text-slate-300">
              <span className="font-semibold">dias corridos</span>
              <span className="block text-[11px] text-slate-400">
                Padrão SoftUp: 7 dias
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Message */}
      {validationError && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Presets and Live Impact Simulator */}
      <div className="pt-2 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-t border-slate-800/80">
        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Perfis Prontos:</span>
          </span>

          <button
            onClick={() => handlePreset(14, 7)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              thresholds.criticalDays === 14 && thresholds.alertDays === 7
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            Padrão SoftUp (14d / 7d)
          </button>

          <button
            onClick={() => handlePreset(10, 5)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              thresholds.criticalDays === 10 && thresholds.alertDays === 5
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            Rigoroso (10d / 5d)
          </button>

          <button
            onClick={() => handlePreset(7, 3)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              thresholds.criticalDays === 7 && thresholds.alertDays === 3
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            Ágil / Sprint (7d / 3d)
          </button>

          <button
            onClick={() => handlePreset(21, 14)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              thresholds.criticalDays === 21 && thresholds.alertDays === 14
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            Tolerante (21d / 14d)
          </button>
        </div>

        {/* Live Simulator Pill */}
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium">Impacto na Carteira Ativa:</span>
          <div className="flex items-center gap-2 font-mono font-bold">
            <span className="text-rose-400">
              {previewCounts.critico} Críticos
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400">
              {previewCounts.alerta} Alertas
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400">
              {previewCounts.emDia} Em Dia
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
