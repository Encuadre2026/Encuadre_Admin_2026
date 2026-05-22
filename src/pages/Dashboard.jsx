import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Building2, Ticket, Search, CheckCircle, XCircle, RefreshCw, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ registros: [], cupos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRegistros = async () => {
    const token = localStorage.getItem('ENCUADRE_ADMIN_TOKEN');
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://encuadre-2026-api.sitio-392.workers.dev/api/admin/registros', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        localStorage.removeItem('ENCUADRE_ADMIN_TOKEN');
        navigate('/login');
        return;
      }
      
      if (!res.ok) throw new Error('Error al cargar los datos');
      
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistros();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('ENCUADRE_ADMIN_TOKEN');
    navigate('/login');
  };

  // --- STATS COMPUTATION ---
  const stats = useMemo(() => {
    const regs = data.registros || [];
    const cups = data.cupos || [];
    
    const totalRegistros = regs.length;
    const asistencia = regs.filter(r => r.asistio).length;
    
    // Cupos
    let totalCapacidad = 0;
    let totalOcupados = 0;
    cups.forEach(c => {
      totalCapacidad += c.cupo_maximo;
      totalOcupados += c.inscritos;
    });
    const porcentajeOcupacion = totalCapacidad ? Math.round((totalOcupados / totalCapacidad) * 100) : 0;

    // Perfiles
    const perfilesMap = {};
    regs.forEach(r => {
      const p = r.perfil || 'Desconocido';
      perfilesMap[p] = (perfilesMap[p] || 0) + 1;
    });
    const perfilesData = Object.entries(perfilesMap).map(([name, value]) => ({ name, value }));

    // Instituciones
    const instMap = {};
    regs.forEach(r => {
      const i = r.institucion || 'Otra';
      // Simplificar nombre UAA para graficas
      const name = i.includes('UAA') ? 'UAA' : (i.includes('General') ? 'Público Gral' : i);
      instMap[name] = (instMap[name] || 0) + 1;
    });
    const instData = Object.entries(instMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5

    return { totalRegistros, asistencia, totalCapacidad, totalOcupados, porcentajeOcupacion, perfilesData, instData };
  }, [data]);

  // --- FILTERING ---
  const filteredRegistros = useMemo(() => {
    if (!searchTerm) return data.registros || [];
    const term = searchTerm.toLowerCase();
    return (data.registros || []).filter(r => 
      r.nombre.toLowerCase().includes(term) ||
      r.id_participante.toLowerCase().includes(term) ||
      r.institucion.toLowerCase().includes(term) ||
      r.correo.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const COLORS = ['#F4D03F', '#8E44AD', '#3498DB', '#E74C3C', '#2ECC71'];

  return (
    <div className="min-h-screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <header style={{ backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: 'var(--color-accent-gold)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 color="#000" size={24} />
          </div>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Encuadre Admin</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={fetchRegistros} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Actualizar
          </button>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
            <LogOut size={16} /> Salir
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{ padding: '2rem', flex: 1, maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(231,76,60,0.1)', color: 'var(--color-danger)', borderLeft: '4px solid var(--color-danger)', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(244, 208, 63, 0.1)', borderRadius: '8px', color: 'var(--color-accent-gold)' }}>
              <Users size={32} />
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Registros</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{loading ? '-' : stats.totalRegistros}</h2>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', color: '#3498DB' }}>
              <Ticket size={32} />
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Ocupación Global</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{loading ? '-' : `${stats.porcentajeOcupacion}%`}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>{stats.totalOcupados} / {stats.totalCapacidad} lugares</p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(46, 204, 113, 0.1)', borderRadius: '8px', color: '#2ECC71' }}>
              <CheckCircle size={32} />
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Asistencias Confirmadas</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{loading ? '-' : stats.asistencia}</h2>
            </div>
          </div>

        </div>

        {/* CHARTS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Distribución de Perfiles</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.perfilesData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {stats.perfilesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} itemStyle={{ color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Top 5 Instituciones</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.instData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#aaa', fontSize: 12}} />
                  <YAxis stroke="#666" tick={{fill: '#aaa'}} allowDecimals={false} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Bar dataKey="value" fill="var(--color-accent-gold)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Base de Datos de Participantes</h3>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input 
                type="text" 
                placeholder="Buscar por ID, nombre, correo..." 
                className="input-field"
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-hover)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>ID</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Participante</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Institución</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Taller</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Perfil</th>
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistros.map((r, i) => (
                  <tr key={r.id_participante || i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--color-accent-gold)' }}>{r.id_participante}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 500 }}>{r.nombre}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{r.correo} • {r.telefono}</div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{r.institucion}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.taller}>{r.taller}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-hover)', borderRadius: '4px', fontSize: '0.75rem' }}>
                        {r.perfil}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {r.asistio ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2ECC71', fontSize: '0.875rem' }}>
                          <CheckCircle size={14} /> Sí
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          <XCircle size={14} /> No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRegistros.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No se encontraron registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
