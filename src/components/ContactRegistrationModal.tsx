import React, { useState, useEffect } from 'react';
import { Demand, ContactInteraction, ContactInteractionStatus } from '../types';
import { sqliteService } from '../services/sqliteService';
import { 
  X, 
  PhoneCall, 
  PhoneOff, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  Sparkles,
  Loader2,
  Check
} from 'lucide-react';

interface ContactRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  demand: Demand | null;
  onContactSaved: (interaction: ContactInteraction, updatedDemand?: Demand) => void;
  activeTeamMembers?: string[];
}

export const ContactRegistrationModal: React.FC<ContactRegistrationModalProps> = ({
  isOpen,
  onClose,
  demand,
  onContactSaved,
  activeTeamMembers = ['Leonardo', 'Diogo'],
}) => {
  if (!isOpen || !demand) return null;

  // Selected Status: MUST be selected before saving ('SUCCESS' | 'NO_RESPONSE')
  const [selectedStatus, setSelectedStatus] = useState<ContactInteractionStatus | null>(null);

  // Date and Time (defaults to now)
  const now = new Date();
  const defaultDateStr = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  const [contactedAtInput, setContactedAtInput] = useState<string>(defaultDateStr);

  // Responsible User
  const defaultUser = demand.implantador && demand.implantador !== 'Não Atribuído' 
    ? demand.implantador 
    : (activeTeamMembers[0] || 'Leonardo');
  const [responsibleUser, setResponsibleUser] = useState<string>(defaultUser);

  // Notes
  const [notes, setNotes] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Reset when opened
  useEffect(() => {
    setSelectedStatus(null);
    const n = new Date();
    setContactedAtInput(n.toISOString().slice(0, 16));
    setResponsibleUser(
      demand.implantador && demand.implantador !== 'Não Atribuído' 
        ? demand.implantador 
        : (activeTeamMembers[0] || 'Leonardo')
    );
    setNotes('');
    setErrorMessage(null);
    setSuccessToast(null);
    setIsSubmitting(false);
  }, [isOpen, demand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Mandatory option validation
    if (!selectedStatus) {
      setErrorMessage('Selecione obrigatoriamente o resultado do contato ("Contato realizado com sucesso" ou "Sem retorno").');
      return;
    }

    if (isSubmitting) return; // Prevent double click

    setIsSubmitting(true);

    try {
      // Format final timestamp
      let finalTimestamp = new Date().toISOString();
      if (contactedAtInput) {
        const parsedDate = new Date(contactedAtInput);
        if (!isNaN(parsedDate.getTime())) {
          finalTimestamp = parsedDate.toISOString();
        }
      }

      const res = await sqliteService.addContactInteraction({
        contactId: demand.seq,
        status: selectedStatus,
        userId: responsibleUser.trim() || undefined,
        notes: notes.trim() || undefined,
        contactedAt: finalTimestamp,
      });

      if (!res.success || !res.interaction) {
        setErrorMessage(res.error || 'Erro ao gravar contato no banco de dados. Tente novamente.');
        setIsSubmitting(false);
        return;
      }

      const newInteraction = res.interaction;

      // Build updated demand with latest interaction
      const updatedDemand: Demand = {
        ...demand,
        hasRegisteredContact: true,
        dataUltimoContato: newInteraction.contactedAt,
        diasSemContato: 0,
        daysSinceLastEvolution: 0,
        weeklyEvolutionState: 'em_dia',
        latestContactInteraction: {
          lastStatus: newInteraction.status,
          lastContactedAt: newInteraction.contactedAt,
          lastUserId: newInteraction.userId,
          lastNotes: newInteraction.notes,
          totalCount: ((demand.latestContactInteraction?.totalCount) || 0) + 1,
        },
        lastUpdatedAt: new Date().toISOString(),
        lastChangeSummary: `Contato registrado: ${
          newInteraction.status === 'SUCCESS' ? 'Contato realizado com sucesso' : 'Sem retorno'
        } (${responsibleUser})`,
      };

      setSuccessToast('Contato registrado com sucesso.');

      // Notify parent immediately without reload
      onContactSaved(newInteraction, updatedDemand);

      // Smooth auto close after success confirmation
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Falha ao gravar contato:', err);
      setErrorMessage('Erro de conexão ao gravar no banco: ' + (err.message || err));
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="contact-modal-title" className="text-base sm:text-lg font-bold text-slate-100">
                  Registrar Contato
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  #{demand.seq}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                {demand.razaoSocial} • Cód: {demand.clienteId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {/* Error Message Alert (Does not auto close) */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-semibold">Atenção ao registrar contato:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Success Confirmation Toast */}
          {successToast && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/80 text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-950/50 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-bold text-sm">{successToast}</span>
            </div>
          )}

          {/* Resultado do Contato (Mandatório) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
              Resultado do Contato Realizado <span className="text-rose-400">*</span>
            </label>
            <p className="text-xs text-slate-400">
              Selecione o desfecho desta tentativa ou realização de contato com o cliente:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Opção 1: Contato realizado com sucesso */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus('SUCCESS');
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-start gap-3 relative ${
                  selectedStatus === 'SUCCESS'
                    ? 'bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-lg shadow-emerald-950/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-emerald-600/60 hover:bg-slate-900/80 text-slate-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedStatus === 'SUCCESS'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-emerald-400'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="font-bold text-xs text-slate-100 flex items-center justify-between">
                    <span>Contato realizado com sucesso</span>
                    {selectedStatus === 'SUCCESS' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    O cliente atendeu, alinhamento efetuado ou reunião realizada.
                  </p>
                </div>
              </button>

              {/* Opção 2: Sem retorno */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus('NO_RESPONSE');
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex items-start gap-3 relative ${
                  selectedStatus === 'NO_RESPONSE'
                    ? 'bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/30 text-white shadow-lg shadow-amber-950/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-amber-600/60 hover:bg-slate-900/80 text-slate-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedStatus === 'NO_RESPONSE'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-amber-400'
                }`}>
                  <PhoneOff className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className="font-bold text-xs text-slate-100 flex items-center justify-between">
                    <span>Sem retorno</span>
                    {selectedStatus === 'NO_RESPONSE' && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Tentativa efetuada, porém sem resposta por telefone ou mensagem.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Data, Horário e Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Data e Horário */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Data e Horário do Contato</span>
              </label>
              <input
                type="datetime-local"
                value={contactedAtInput}
                onChange={(e) => setContactedAtInput(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Responsável pelo Contato */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>Responsável pelo Contato</span>
              </label>
              <input
                type="text"
                value={responsibleUser}
                onChange={(e) => setResponsibleUser(e.target.value)}
                placeholder="Nome do operador ou implantador"
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Observações / Notas do Contato (Opcional) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Observações / Resumo da Interação (Opcional)</span>
              </label>
              <span className="text-[10px] text-slate-500">Histórico detalhado</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente informou que diretor estava em viagem e solicitou novo contato na próxima terça às 14h..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Informação sobre Imutabilidade do Histórico */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Cada confirmação gera um novo registro permanente no histórico da demanda, preservando tentativas anteriores.
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedStatus}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                isSubmitting || !selectedStatus
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                  <span>Salvando no Banco...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmar e Registrar Contato</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
