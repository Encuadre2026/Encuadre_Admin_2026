import { useMemo } from 'react';
import { Users, Ticket, CheckCircle, DollarSign, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { useToast } from '../context/ToastContext';

export default function Dashboard({ registrosHook }) {
  const { data, loading, fetchRegistros } = registrosHook;
  const { showToast } = useToast();

  const stats = useMemo(() => {
    const regs = data.registros || [];
    const cups = data.cupos || [];

    const totalRegistros = regs.length;
    const asistencia = regs.filter(r => r.asistio).length;

    let totalCapacidad = 0;
    let totalOcupados = 0;
    cups.forEach(c => {
      totalCapacidad += (c.cupo_maximo + 7);
      totalOcupados += c.inscritos;
    });
    const porcentajeOcupacion = totalCapacidad ? Math.round((totalOcupados / totalCapacidad) * 100) : 0;

    const perfilesMap = {};
    regs.forEach(r => {
      const p = r.perfil || 'Desconocido';
      perfilesMap[p] = (perfilesMap[p] || 0) + 1;
    });
    const perfilesData = Object.entries(perfilesMap).map(([name, value]) => ({ name, value }));

    const instMap = {};
    regs.forEach(r => {
      const i = r.institucion || 'Otra';
      const name = i.includes('UAA') ? 'UAA' : (i.includes('General') ? 'Público Gral' : i);
      instMap[name] = (instMap[name] || 0) + 1;
    });
    const instData = Object.entries(instMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const pagosConfirmados = regs.filter(r => r.pago_aprobado).length;
    const pagosPendientes = totalRegistros - pagosConfirmados;
    const pagosData = [
      { name: 'Confirmados', value: pagosConfirmados },
      { name: 'Pendientes', value: pagosPendientes },
    ];

    const talleresOrdenados = [...cups].sort((a, b) => b.inscritos - a.inscritos);
    const top5Talleres = talleresOrdenados.slice(0, 5).map(t => ({
      name: t.nombre,
      inscritos: t.inscritos,
    }));
    const bottom3Talleres = talleresOrdenados.slice(-3).reverse().map(t => ({
      name: t.nombre,
      inscritos: t.inscritos,
    }));

    const uaaCount = regs.filter(r => (r.institucion || '').includes('UAA')).length;
    const foraneosCount = totalRegistros - uaaCount;
    const audienciaData = [
      { name: 'UAA (Local)', value: uaaCount },
      { name: 'Foráneos / Otras', value: foraneosCount },
    ];

    const fechasMap = {};
    regs.forEach(r => {
      if (!r.fecha_registro) return;
      const d = new Date(r.fecha_registro);
      if (isNaN(d.getTime())) return;
      const dateStr = d.toISOString().split('T')[0];
      fechasMap[dateStr] = (fechasMap[dateStr] || 0) + 1;
    });
    const fechasData = Object.entries(fechasMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, count]) => {
        const d = new Date(dateStr + 'T12:00:00Z');
        return { name: d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }), Inscripciones: count };
      });

    return {
      totalRegistros, asistencia, totalCapacidad, totalOcupados, porcentajeOcupacion,
      perfilesData, instData, pagosConfirmados, pagosPendientes, pagosData,
      top5Talleres, bottom3Talleres, audienciaData, fechasData,
    };
  }, [data]);

  const COLORS = ['#F4D03F', '#8E44AD', '#3498DB', '#E74C3C', '#2ECC71'];

  const onRefresh = async () => {
    const ok = await fetchRegistros();
    if (ok) showToast('Dashboard actualizado', 'info');
  };

  return (
    <div className="fade-in-up">
      {/* Page header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="header-actions">
          <button onClick={onRefresh} className="btn btn-outline" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div className="card fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: '1rem', animationDelay: '0.05s' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(244, 208, 63, 0.1)', borderRadius: '8px', color: 'var(--color-accent-gold)' }}>
            <Users size={28} />
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Total Registros</p>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>{loading ? '-' : stats.totalRegistros}</h2>
          </div>
        </div>

        <div className="card fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: '1rem', animationDelay: '0.1s' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(52, 152, 219, 0.1)', borderRadius: '8px', color: '#3498DB' }}>
            <Ticket size={28} />
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Ocupación Global</p>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>{loading ? '-' : `${stats.porcentajeOcupacion}%`}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>{stats.totalOcupados} / {stats.totalCapacidad}</p>
          </div>
        </div>

        <div className="card fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: '1rem', animationDelay: '0.15s' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(46, 204, 113, 0.1)', borderRadius: '8px', color: '#2ECC71' }}>
            <CheckCircle size={28} />
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Asistencias</p>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>{loading ? '-' : stats.asistencia}</h2>
          </div>
        </div>

        <div className="card fade-in-up" style={{ display: 'flex', alignItems: 'center', gap: '1rem', animationDelay: '0.2s' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(155, 89, 182, 0.1)', borderRadius: '8px', color: '#9B59B6' }}>
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Pagos Validados</p>
            <h2 style={{ fontSize: '1.75rem', margin: 0 }}>{loading ? '-' : stats.pagosConfirmados}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>{stats.pagosPendientes} pendientes</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="card fade-in-up" style={{ animationDelay: '0.25s' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', textAlign: 'center' }}>Estatus de Pagos</h3>
          <div style={{ height: '230px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.pagosData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                  <Cell fill="#2ECC71" />
                  <Cell fill="#E74C3C" />
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} itemStyle={{ color: '#fff' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', textAlign: 'center' }}>Audiencia Local vs Foránea</h3>
          <div style={{ height: '230px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.audienciaData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                  <Cell fill="var(--color-accent-gold)" />
                  <Cell fill="#3498DB" />
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} itemStyle={{ color: '#fff' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card fade-in-up" style={{ animationDelay: '0.35s' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', textAlign: 'center' }}>Distribución de Perfiles</h3>
          <div style={{ height: '230px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.perfilesData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                  {stats.perfilesData.map((_, index) => (
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

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div className="card fade-in-up" style={{ gridColumn: '1 / -1', animationDelay: '0.4s' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Curva de Inscripciones por Día</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.fechasData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{ fill: '#aaa', fontSize: 12 }} />
                <YAxis stroke="#666" tick={{ fill: '#aaa' }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                <Line type="monotone" dataKey="Inscripciones" stroke="var(--color-accent-gold)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-accent-gold)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card fade-in-up" style={{ animationDelay: '0.45s' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Top 5 Talleres</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.top5Talleres} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal vertical={false} />
                <XAxis type="number" stroke="#666" tick={{ fill: '#aaa' }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#666" tick={{ fill: '#aaa', fontSize: 10 }} width={120} tickFormatter={v => v.length > 22 ? v.substring(0, 22) + '...' : v} />
                <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111', borderColor: '#333', maxWidth: '320px', whiteSpace: 'normal' }} labelStyle={{ color: '#F4D03F', fontWeight: 600, marginBottom: '4px' }} />
                <Bar dataKey="inscritos" fill="#E74C3C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card fade-in-up" style={{ animationDelay: '0.5s' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Top 3 Menos Solicitados</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.bottom3Talleres} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal vertical={false} />
                <XAxis type="number" stroke="#666" tick={{ fill: '#aaa' }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#666" tick={{ fill: '#aaa', fontSize: 10 }} width={120} tickFormatter={v => v.length > 22 ? v.substring(0, 22) + '...' : v} />
                <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#111', borderColor: '#333', maxWidth: '320px', whiteSpace: 'normal' }} labelStyle={{ color: '#F4D03F', fontWeight: 600, marginBottom: '4px' }} />
                <Bar dataKey="inscritos" fill="#3498DB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
