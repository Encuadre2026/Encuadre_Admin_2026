import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, LayoutDashboard } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="not-found-page">
      <div className="not-found-card card fade-in-up">
        <div className="not-found-icon">
          <AlertTriangle size={48} />
        </div>

        <div className="not-found-code">404</div>

        <h1 className="not-found-title">Página no encontrada</h1>

        <p className="not-found-message">
          La ruta que intentas acceder no existe o fue movida.
          Verifica la URL o regresa al panel principal.
        </p>

        <div className="not-found-actions">
          <button onClick={() => navigate(-1)} className="btn btn-outline">
            <ArrowLeft size={16} /> Volver atrás
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            <LayoutDashboard size={16} /> Ir al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
