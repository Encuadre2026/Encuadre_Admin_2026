import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Clock, ArrowRight } from 'lucide-react';
import { olvidarSesion } from '../api/cliente';
import { hace } from '../fecha';

/**
 * La marca del panel.
 *
 * Era el icono de barras de la librería dentro de un cuadrado dorado con las
 * esquinas redondeadas: el mismo cuadrado que lleva cualquier panel de
 * administración, elegido por estar a mano. Este dibujo es el del favicon
 * —`public/favicon.svg`—, así que la pestaña y la barra lateral dicen por fin
 * lo mismo. El color lo pone el CSS con `currentColor`, para que los cinco
 * colores de marca sigan viviendo solo en los tokens.
 */
function MarcaEncuadre() {
  return (
    <svg
      className="sidebar-marca-icono"
      width="22"
      height="22"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="4" y="17" width="5" height="10" rx="1" opacity="0.4" />
      <rect x="13" y="11" width="5" height="16" rx="1" opacity="0.7" />
      <rect x="22" y="5" width="5" height="22" rx="1" />
    </svg>
  );
}

export default function Sidebar({ totalRegistros = 0, pagosPendientes = 0, lastUpdated, isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Sin icono. Eran tres iconos genéricos —una gráfica, dos personas, un
  // billete— que no distinguían nada que el rótulo no dijera ya, y competían
  // con el único elemento de la barra que sí pide atención: los pagos sin
  // validar. El número de orden ordena la lista y no pretende significar.
  const links = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/participantes', label: 'Participantes', count: totalRegistros },
    { path: '/cupos', label: 'Cupos por taller' },
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
        <div className="sidebar-marca">
          <MarcaEncuadre />
          <span className="sidebar-title">Encuadre</span>
        </div>
        <div className="rotulo-seccion">36 FTD · Panel admin</div>
      </div>

      <nav className="sidebar-nav">
        <div className="rotulo-seccion sidebar-nav-rotulo">Secciones</div>
        {links.map((link, i) => {
          const isActive = location.pathname === link.path;
          return (
            <button
              key={link.path}
              className={`sidebar-link${isActive ? ' active' : ''}`}
              onClick={() => handleNav(link.path)}
            >
              <span className="sidebar-link-indice cifra">{String(i + 1).padStart(2, '0')}</span>
              <span className="sidebar-link-nombre">{link.label}</span>
              {link.count != null && link.count > 0 && (
                <span className="link-count cifra">{link.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Lo único de la barra que pide hacer algo, compuesto como tal: la cifra
          en grande y el verbo debajo. Sigue llevando a Participantes con el
          filtro «Pendientes» puesto. */}
      {pagosPendientes > 0 && (
        <button
          className="sidebar-link sidebar-aviso"
          onClick={() => handleNav('/participantes', { filtroPago: 'Pendientes' })}
        >
          <span className="sidebar-aviso-rotulo">
            <span className="sidebar-aviso-punto" aria-hidden="true" />
            Requiere acción
          </span>
          <span className="sidebar-aviso-texto">
            <span className="sidebar-aviso-cifra">{pagosPendientes}</span>{' '}
            pago{pagosPendientes !== 1 ? 's' : ''} pendiente{pagosPendientes !== 1 ? 's' : ''}
          </span>
          <span className="sidebar-aviso-accion">
            Validar ahora <ArrowRight size={13} />
          </span>
        </button>
      )}

      <div className="sidebar-footer">
        {lastUpdated && (
          <div className="last-updated">
            <Clock size={12} />
            Actualizado {hace(lastUpdated)}
          </div>
        )}
        <button onClick={handleLogout} className="btn btn-outline btn-logout">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
