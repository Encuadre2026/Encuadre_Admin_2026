import { useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

export default function Toast({ toasts, removeToast }) {
  const [exiting, setExiting] = useState(new Set());

  const handleClose = (id) => {
    setExiting(prev => new Set(prev).add(id));
    setTimeout(() => {
      setExiting(prev => { const s = new Set(prev); s.delete(id); return s; });
      removeToast(id);
    }, 300);
  };

  if (!toasts.length) return null;

  return (
    // Un lector de pantalla no anunciaba nada: quien valida un pago sin ver la
    // pantalla pulsaba «Aprobar» y no se enteraba de si había salido bien.
    // `polite` espera a que termine de leer lo que esté leyendo; `atomic` hace
    // que lea el aviso entero y no solo el trozo que ha cambiado.
    <div className="toast-container" role="status" aria-live="polite" aria-atomic="true">
      {toasts.map(t => {
        const Icon = iconMap[t.type] || Info;
        const isExiting = exiting.has(t.id);
        return (
          <div key={t.id} className={`toast toast-${t.type}${isExiting ? ' toast-exit' : ''}`}>
            <span className="toast-icon"><Icon size={18} /></span>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => handleClose(t.id)}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
