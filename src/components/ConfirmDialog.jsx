import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmDialog — Modal de confirmación estilizado.
 *
 * Props:
 *   open        — Boolean que controla la visibilidad.
 *   title       — Título del diálogo.
 *   message     — Mensaje descriptivo (acepta texto o JSX).
 *   confirmText — Texto del botón de confirmar (default: "Confirmar").
 *   cancelText  — Texto del botón de cancelar (default: "Cancelar").
 *   variant     — "danger" | "warning" (cambia el color del botón).
 *   loading     — Deshabilita los botones durante la acción.
 *   onConfirm   — Callback al confirmar.
 *   onCancel    — Callback al cancelar.
 */
export default function ConfirmDialog({
  open,
  title = '¿Estás seguro?',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const overlayRef = useRef(null);
  const cancelBtnRef = useRef(null);

  // Focus trap + Escape to close
  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel?.();
        return;
      }
      if (e.key === 'Tab' && overlayRef.current) {
        const focusable = overlayRef.current.querySelectorAll(
          'button:not(:disabled), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmColor = variant === 'danger' ? 'var(--color-danger)' : 'var(--color-accent-gold)';

  return (
    <div
      className="confirm-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel?.(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="confirm-card card">
        <div className="confirm-icon-wrapper">
          <AlertTriangle size={28} color={confirmColor} />
        </div>

        <h3 id="confirm-dialog-title" className="confirm-title">{title}</h3>

        {message && (
          <div className="confirm-message">{message}</div>
        )}

        <div className="confirm-actions">
          <button
            ref={cancelBtnRef}
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className="btn confirm-btn-action"
            style={{ backgroundColor: confirmColor, color: variant === 'danger' ? '#fff' : '#000' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
