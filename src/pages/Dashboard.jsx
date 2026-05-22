import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Users, Building2, Ticket, Search, CheckCircle, XCircle, RefreshCw, BarChart3, Download, FileText, Check, DollarSign, MapPin } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ registros: [], cupos: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTaller, setFilterTaller] = useState('Todos');
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

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

  const handleSetupDB = async () => {
    const token = localStorage.getItem('ENCUADRE_ADMIN_TOKEN');
    try {
      const res = await fetch('https://encuadre-2026-api.sitio-392.workers.dev/api/admin/setup_db', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message || 'Base de datos configurada');
      fetchRegistros();
    } catch (e) {
      alert('Error en setup: ' + e.message);
    }
  };

  const exportToExcel = () => {
    if (!data.registros || data.registros.length === 0) return;
    
    const rows = filteredRegistros.map(r => ({
      'ID Participante': r.id_participante,
      'Nombre': r.nombre,
      'Correo': r.correo,
      'CURP': r.curp,
      'Teléfono': r.telefono,
      'Institución': r.institucion,
      'Perfil': r.perfil,
      'Taller': r.taller,
      'Pago Aprobado': r.pago_aprobado ? 'Sí' : 'No',
      'Asistencia': r.asistio ? 'Sí' : 'No'
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");
    
    XLSX.writeFile(workbook, `Registros_Encuadre_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleViewPdf = async (url_comprobante) => {
    const token = localStorage.getItem('ENCUADRE_ADMIN_TOKEN');
    setSelectedPdf(url_comprobante);
    setPdfLoading(true);
    setPdfBlobUrl(null);
    try {
      const res = await fetch(`https://encuadre-2026-api.sitio-392.workers.dev/api/admin/comprobante?file=${encodeURIComponent(url_comprobante)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('No se pudo cargar el PDF');
      const blob = await res.blob();
      setPdfBlobUrl(URL.createObjectURL(blob));
    } catch (err) {
      alert(err.message);
      setSelectedPdf(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleAprobarPago = async (id_participante) => {
    if (!confirm(`¿Estás seguro de aprobar el pago para ${id_participante}?`)) return;
    const token = localStorage.getItem('ENCUADRE_ADMIN_TOKEN');
    try {
      const res = await fetch('https://encuadre-2026-api.sitio-392.workers.dev/api/admin/aprobar_pago', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_participante })
      });
      if (!res.ok) throw new Error('Error al aprobar pago');
      alert('Pago aprobado correctamente');
      setSelectedPdf(null); // Cerrar modal si está abierto
      fetchRegistros(); // Recargar datos
    } catch (e) {
      alert(e.message);
    }
  };

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
      totalCapacidad += (c.cupo_maximo + 7); // 18 Generales + 7 de UAA
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

    // Pagos
    const pagosConfirmados = regs.filter(r => r.pago_aprobado).length;
    const pagosPendientes = totalRegistros - pagosConfirmados;
    const pagosData = [
      { name: 'Confirmados', value: pagosConfirmados },
      { name: 'Pendientes', value: pagosPendientes }
    ];

    // Top y Bottom Talleres
    const talleresOrdenados = [...cups].sort((a,b) => b.inscritos - a.inscritos);
    const top5Talleres = talleresOrdenados.slice(0, 5).map(t => ({ name: t.nombre.substring(0, 25) + '...', inscritos: t.inscritos }));
    const bottom3Talleres = talleresOrdenados.slice(-3).reverse().map(t => ({ name: t.nombre.substring(0, 25) + '...', inscritos: t.inscritos }));

    // Audiencia (UAA vs Foráneos)
    const uaaCount = regs.filter(r => (r.institucion || '').includes('UAA')).length;
    const foraneosCount = totalRegistros - uaaCount;
    const audienciaData = [
      { name: 'UAA (Local)', value: uaaCount },
      { name: 'Foráneos / Otras', value: foraneosCount }
    ];

    // Curva de inscripciones
    const fechasMap = {};
    regs.forEach(r => {
      if (!r.fecha_registro) return;
      const d = new Date(r.fecha_registro);
      if (isNaN(d.getTime())) return;
      const dateStr = d.toISOString().split('T')[0];
      fechasMap[dateStr] = (fechasMap[dateStr] || 0) + 1;
    });
    const fechasData = Object.entries(fechasMap)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([dateStr, count]) => {
        const d = new Date(dateStr + 'T12:00:00Z');
        return { 
          name: d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }), 
          Inscripciones: count 
        };
      });

    return { 
      totalRegistros, asistencia, totalCapacidad, totalOcupados, porcentajeOcupacion, 
      perfilesData, instData, pagosConfirmados, pagosPendientes, pagosData, 
      top5Talleres, bottom3Talleres, audienciaData, fechasData 
    };
  }, [data]);

  // Talleres únicos para el filtro
  const talleresUnicos = useMemo(() => {
    const t = new Set((data.registros || []).map(r => r.taller));
    return ['Todos', ...Array.from(t).sort()];
  }, [data]);

  // --- FILTERING ---
  const filteredRegistros = useMemo(() => {
    let list = data.registros || [];
    
    if (filterTaller !== 'Todos') {
      list = list.filter(r => r.taller === filterTaller);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r => 
        r.nombre.toLowerCase().includes(term) ||
        r.id_participante.toLowerCase().includes(term) ||
        r.institucion.toLowerCase().includes(term) ||
        r.correo.toLowerCase().includes(term)
      );
    }
    return list;
  }, [data, searchTerm, filterTaller]);

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
          <button onClick={handleSetupDB} className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderColor: 'var(--color-border)', fontSize: '0.8rem' }}>
            Setup DB
          </button>
          <button onClick={exportToExcel} className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
            <Download size={16} /> Exportar Excel
          </button>
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
          <div style={{ padding: '2rem', backgroundColor: 'rgba(231,76,60,0.1)', color: 'var(--color-danger)', borderLeft: '4px solid var(--color-danger)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Error de Base de Datos</h3>
              <p style={{ margin: 0 }}>{error}. Esto ocurre porque falta la columna 'pago_aprobado'.</p>
            </div>
            <button onClick={handleSetupDB} className="btn" style={{ backgroundColor: 'var(--color-accent-gold)', color: '#000', fontWeight: 'bold' }}>
              Configurar DB Automáticamente
            </button>
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

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'rgba(155, 89, 182, 0.1)', borderRadius: '8px', color: '#9B59B6' }}>
              <DollarSign size={32} />
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase' }}>Pagos Validados</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{loading ? '-' : stats.pagosConfirmados}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>{stats.pagosPendientes} pendientes</p>
            </div>
          </div>

        </div>

        {/* CHARTS ROW 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>Estatus de Pagos</h3>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pagosData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    <Cell fill="#2ECC71" />
                    <Cell fill="#E74C3C" />
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} itemStyle={{ color: '#fff' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>Audiencia Local vs Foránea</h3>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.audienciaData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    <Cell fill="var(--color-accent-gold)" />
                    <Cell fill="#3498DB" />
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} itemStyle={{ color: '#fff' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>Distribución de Perfiles</h3>
            <div style={{ height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.perfilesData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    {stats.perfilesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} itemStyle={{ color: '#fff' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* CHARTS ROW 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Curva de Inscripciones por Día</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.fechasData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" tick={{fill: '#aaa', fontSize: 12}} />
                  <YAxis stroke="#666" tick={{fill: '#aaa'}} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Line type="monotone" dataKey="Inscripciones" stroke="var(--color-accent-gold)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-accent-gold)" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🔥 Top 5 Talleres (Más Solicitados)</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.top5Talleres} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#666" tick={{fill: '#aaa'}} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#666" tick={{fill: '#aaa', fontSize: 10}} width={120} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Bar dataKey="inscritos" fill="#E74C3C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🧊 Top 3 Talleres (Menos Solicitados)</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.bottom3Talleres} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#666" tick={{fill: '#aaa'}} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#666" tick={{fill: '#aaa', fontSize: 10}} width={120} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                  <Bar dataKey="inscritos" fill="#3498DB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* TABLE */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Base de Datos de Participantes ({filteredRegistros.length})</h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select 
                className="input-field" 
                value={filterTaller} 
                onChange={(e) => setFilterTaller(e.target.value)}
                style={{ minWidth: '200px' }}
              >
                {talleresUnicos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
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
                  <th style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontWeight: 500, fontSize: '0.875rem' }}>Pago</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-hover)', borderRadius: '4px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {r.perfil}
                        </span>
                        {r.url_comprobante && (
                          <button onClick={() => handleViewPdf(r.url_comprobante)} className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderColor: 'var(--color-accent-gold)', color: 'var(--color-accent-gold)' }} title="Ver Credencial">
                            <FileText size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {r.pago_aprobado ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2ECC71', fontSize: '0.875rem' }}>
                          <CheckCircle size={14} /> Confirmado
                        </span>
                      ) : (
                        <button onClick={() => handleAprobarPago(r.id_participante)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}>
                          Validar Pago
                        </button>
                      )}
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
                    <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      No se encontraron registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* PDF MODAL */}
      {selectedPdf && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Credencial / Comprobante de Perfil</h3>
              <button onClick={() => setSelectedPdf(null)} className="btn btn-outline" style={{ padding: '0.5rem' }}>
                <XCircle size={20} />
              </button>
            </div>
            
            <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pdfLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                  <RefreshCw size={32} className="spin" style={{ marginBottom: '1rem' }} />
                  <p>Cargando documento...</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe src={pdfBlobUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Comprobante" />
              ) : (
                <p style={{ color: 'var(--color-danger)' }}>Error al cargar el PDF.</p>
              )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button onClick={() => setSelectedPdf(null)} className="btn btn-outline">Cerrar Visualizador</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
