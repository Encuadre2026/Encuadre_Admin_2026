import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import useRegistros from './hooks/useRegistros';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Participantes from './pages/Participantes';
import Cupos from './pages/Cupos';

function AuthenticatedLayout() {
  const registrosHook = useRegistros();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect if unauthorized
  if (registrosHook.error === 'unauthorized') {
    localStorage.removeItem('ENCUADRE_ADMIN_TOKEN');
    navigate('/login');
    return null;
  }

  const totalRegistros = (registrosHook.data.registros || []).length;

  return (
    <div className="app-layout">
      <Sidebar
        totalRegistros={totalRegistros}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile overlay */}
      <div className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Mobile toggle */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <Menu size={22} />
      </button>

      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard registrosHook={registrosHook} />} />
          <Route path="/participantes" element={<Participantes registrosHook={registrosHook} />} />
          <Route path="/cupos" element={<Cupos registrosHook={registrosHook} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AuthenticatedLayout />} />
      </Routes>
    </ToastProvider>
  );
}

export default App;
