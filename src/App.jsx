import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Menu, RefreshCw } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import useRegistros from './hooks/useRegistros';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

// Punto 10: Code splitting — cargar páginas bajo demanda
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Participantes = lazy(() => import('./pages/Participantes'));
const Cupos = lazy(() => import('./pages/Cupos'));

// Fallback de carga para Suspense
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--color-text-muted)' }}>
      <RefreshCw size={28} className="spin" />
    </div>
  );
}

function AuthenticatedLayout() {
  const registrosHook = useRegistros();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect if unauthorized (dentro de useEffect para evitar side effects en render)
  useEffect(() => {
    if (registrosHook.error === 'unauthorized') {
      localStorage.removeItem('ENCUADRE_ADMIN_TOKEN');
      sessionStorage.removeItem('ENCUADRE_ADMIN_SECRET');
      navigate('/login');
    }
  }, [registrosHook.error, navigate]);

  const totalRegistros = (registrosHook.data.registros || []).length;

  return (
    <div className="app-layout">
      <Sidebar
        totalRegistros={totalRegistros}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSetupDB={registrosHook.handleSetupDB}
      />

      {/* Mobile overlay */}
      <div className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Mobile toggle */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menú lateral">
        <Menu size={22} />
      </button>

      <main className="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard registrosHook={registrosHook} />} />
            <Route path="/participantes" element={<Participantes registrosHook={registrosHook} />} />
            <Route path="/cupos" element={<Cupos registrosHook={registrosHook} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AuthenticatedLayout />} />
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
