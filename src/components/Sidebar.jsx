import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Users, Ticket, LogOut, Database } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Sidebar({ totalRegistros = 0, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const links = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/participantes', label: 'Participantes', icon: Users, count: totalRegistros },
    { path: '/cupos', label: 'Cupos por Taller', icon: Ticket },
  ];

  const handleNav = (path) => {
    navigate(path);
    onClose?.();
  };

  const handleLogout = () => {
    localStorage.removeItem('ENCUADRE_ADMIN_TOKEN');
    sessionStorage.removeItem('ENCUADRE_ADMIN_SECRET');
    navigate('/login');
  };

  const handleSetupDB = async () => {
    const secret = sessionStorage.getItem('ENCUADRE_ADMIN_SECRET');
    if (!secret) {
      showToast('Sesión expirada. Vuelve a iniciar sesión.', 'error');
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/setup_db`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) throw new Error('Error en la operación');
      const data = await res.json();
      showToast(data.message || 'Base de datos configurada', 'success');
    } catch (e) {
      showToast('Error en setup: ' + e.message, 'error');
    }
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
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleSetupDB} className="btn btn-outline" style={{ borderColor: 'var(--color-border)', fontSize: '0.75rem' }}>
          <Database size={14} /> Setup DB
        </button>
        <button onClick={handleLogout} className="btn btn-outline" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
