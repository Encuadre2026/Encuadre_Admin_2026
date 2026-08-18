import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Users, Ticket, LogOut, Clock } from 'lucide-react';
import { olvidarSesion } from '../api/cliente';

function formatTimeAgo(date) {
  if (!date) return null;
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'hace unos segundos';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours}h`;
}

export default function Sidebar({ totalRegistros = 0, pagosPendientes = 0, lastUpdated, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/participantes', label: 'Participantes', icon: Users, count: totalRegistros },
    { path: '/cupos', label: 'Cupos por Taller', icon: Ticket },
  ];

  const handleNav = (path, state) => {
    navigate(path, state ? { state } : undefined);
    onClose?.();
  };

  const handleLogout = () => {
    olvidarSesion();
    navigate('/login');
  };

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <BarChart3 color="#000" size={20} />
        </div>
        <span className="sidebar-title">Encuadre Admin</span>
      </div>

      <nav className="sidebar-nav">
        {links.map(link => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <button
              key={link.path}
              className={`sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => handleNav(link.path)}
            >
              <Icon size={18} />
              {link.label}
              {link.count != null && link.count > 0 && (
                <span className="link-count">{link.count}</span>
              )}
            </button>
          );
        })}

        {/* Badge de pagos pendientes */}
        {pagosPendientes > 0 && (
          <button
            className={`sidebar-link${location.pathname === '/participantes' ? ' active' : ''}`}
            /* Llevaba a Participantes sin filtrar nada, así que había que
               volver a elegir «Pendientes» a mano justo después de pulsar algo
               que dice «37 pagos pendientes». Ahora llega ya filtrado. */
            onClick={() => handleNav('/participantes', { filtroPago: 'Pendientes' })}
          >
            <span className="link-badge-danger">
              {pagosPendientes} pago{pagosPendientes !== 1 ? 's' : ''} pendiente{pagosPendientes !== 1 ? 's' : ''}
            </span>
          </button>
        )}
      </nav>

      <div className="sidebar-footer">
        {lastUpdated && (
          <div className="last-updated">
            <Clock size={12} />
            Actualizado {formatTimeAgo(lastUpdated)}
          </div>
        )}
        <button onClick={handleLogout} className="btn btn-outline btn-logout">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
