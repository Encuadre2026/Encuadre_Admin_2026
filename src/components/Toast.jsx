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
    <div className="toast-container">
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
