import { useMemo } from 'react';
import { Users, Ticket, CheckCircle, DollarSign, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { useToast } from '../context/toast-contexto';
import { KpiSkeleton, ChartSkeleton } from '../components/Skeleton';

/**
 * Los colores del panel, una sola vez.
 *
 * Estaban escritos a mano treinta y una veces entre este archivo y los
 * componentes: los mismos cinco valores, en mayúsculas aquí y en minúsculas en
 * el CSS, sin nada que los mantuviera juntos. No es que se vieran distintos
 * —son idénticos—, es que nada impedía que dejaran de serlo.
 *
 * Recharts pasa el relleno tal cual al SVG, y `fill` resuelve `var()`, así que
 * los tokens del CSS valen sin puente ninguno. Una de las porciones ya lo hacía;
 * ahora lo hacen todas.
 */
const COLORS = [
  'var(--color-accent-gold)',
  'var(--color-accent-purple)',
  'var(--color-info)',
  'var(--color-danger)',
  'var(--color-success)',
];
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-grafica-fondo)',
  borderColor: 'var(--color-grafica-borde)',
};
const TOOLTIP_ITEM_STYLE = { color: 'var(--color-text-primary)' };
const TOOLTIP_LABEL_STYLE = {
  color: 'var(--color-accent-gold)',
  fontWeight: 600,
  marginBottom: '4px',
};
const CURSOR_STYLE = { fill: 'rgba(255,255,255,0.05)' };
const TOOLTIP_CONTENT_WIDE = {
  ...TOOLTIP_STYLE,
  maxWidth: '320px',
  whiteSpace: 'normal',
};

/**
 * Leyenda que además dice cuánto vale cada porción.
 *
 * Los tres donuts solo mostraban colores y nombres: para saber que eran 10
 * confirmados y 37 pendientes había que pasar el ratón por encima, cosa que en
 * una tableta no ocurre nunca. La cifra estaba en los datos y no se enseñaba.
 */
function leyendaConCifra(porciones) {
  const total = porciones.reduce((suma, p) => suma + p.value, 0);
  return (valor, entrada) => {
    const porcion = porciones.find((p) => p.name === valor);
    if (!porcion) return valor;
    const porcentaje = total ? Math.round((porcion.value / total) * 100) : 0;
    return (
      <span style={{ color: entrada.color }}>
        {valor} <strong>{porcion.value}</strong>{' '}
        <span className="leyenda-porcentaje">{porcentaje}%</span>
      </span>
    );
  };
}

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
      // Los lugares reservados los declara la API por taller, en vez de darlos
      // por sabidos aquí.
      totalCapacidad += c.cupo_maximo + (c.lugares_reservados_uaa ?? 0);
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

  const onRefresh = async () => {
    const ok = await fetchRegistros();
    if (ok) showToast('Dashboard actualizado', 'info');
  };

  // Skeleton state: first load only (no data loaded yet)
  const isFirstLoad = loading && data.registros.length === 0;

  return (
    <div className="fade-in-up">
      {/* Page header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="header-actions">
          <button onClick={onRefresh} className="btn btn-outline btn-header" disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="dashboard-kpi-grid">
        {isFirstLoad ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <div className="card fade-in-up kpi-card" style={{ animationDelay: '0.05s' }}>
              <div className="kpi-icon kpi-icon-gold"><Users size={28} /></div>
              <div>
                <p className="kpi-label">Total Registros</p>
                <h2 className="kpi-value">{stats.totalRegistros}</h2>
              </div>
            </div>

            <div className="card fade-in-up kpi-card" style={{ animationDelay: '0.1s' }}>
              <div className="kpi-icon kpi-icon-blue"><Ticket size={28} /></div>
              <div>
                <p className="kpi-label">Ocupación Global</p>
                <h2 className="kpi-value">{stats.porcentajeOcupacion}%</h2>
                <p className="kpi-sub">{stats.totalOcupados} / {stats.totalCapacidad}</p>
              </div>
            </div>

            <div className="card fade-in-up kpi-card" style={{ animationDelay: '0.15s' }}>
              <div className="kpi-icon kpi-icon-green"><CheckCircle size={28} /></div>
              <div>
                <p className="kpi-label">Asistencias</p>
                <h2 className="kpi-value">{stats.asistencia}</h2>
              </div>
            </div>

            <div className="card fade-in-up kpi-card" style={{ animationDelay: '0.2s' }}>
              <div className="kpi-icon kpi-icon-purple"><DollarSign size={28} /></div>
              <div>
                <p className="kpi-label">Pagos Validados</p>
                <h2 className="kpi-value">{stats.pagosConfirmados}</h2>
                <p className="kpi-sub">{stats.pagosPendientes} pendientes</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts Row 1 */}
      {isFirstLoad ? (
        <div className="dashboard-chart-grid">
          <ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
        </div>
      ) : (
        <div className="dashboard-chart-grid">
          <div className="card fade-in-up" style={{ animationDelay: '0.25s' }}>
            <h3 className="chart-title">Estatus de Pagos</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pagosData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                    <Cell fill="var(--color-success)" />
                    <Cell fill="var(--color-danger)" />
                  </Pie>
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                  <Legend formatter={leyendaConCifra(stats.pagosData)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card fade-in-up" style={{ animationDelay: '0.3s' }}>
            <h3 className="chart-title">Audiencia Local vs Foránea</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.audienciaData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                    <Cell fill="var(--color-accent-gold)" />
                    <Cell fill="var(--color-info)" />
                  </Pie>
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                  <Legend formatter={leyendaConCifra(stats.audienciaData)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card fade-in-up" style={{ animationDelay: '0.35s' }}>
            <h3 className="chart-title">Distribución de Perfiles</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.perfilesData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                    {stats.perfilesData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                  <Legend formatter={leyendaConCifra(stats.perfilesData)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 2 */}
      <div className="dashboard-chart-grid-2col">
        <div className="card fade-in-up" style={{ gridColumn: '1 / -1', animationDelay: '0.4s' }}>
          <h3 className="chart-title-left">Curva de Inscripciones por Día</h3>
          <div className="chart-container-lg">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.fechasData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grafica-borde)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="Inscripciones" stroke="var(--color-accent-gold)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-accent-gold)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card fade-in-up" style={{ animationDelay: '0.45s' }}>
          <h3 className="chart-title-left">Top 5 Talleres</h3>
          <div className="chart-container-lg">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.top5Talleres} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grafica-borde)" horizontal vertical={false} />
                <XAxis type="number" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} width={120} tickFormatter={v => v.length > 22 ? v.substring(0, 22) + '...' : v} />
                <RechartsTooltip cursor={CURSOR_STYLE} contentStyle={TOOLTIP_CONTENT_WIDE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Bar dataKey="inscritos" fill="var(--color-danger)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card fade-in-up" style={{ animationDelay: '0.5s' }}>
          <h3 className="chart-title-left">Top 3 Menos Solicitados</h3>
          <div className="chart-container-lg">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.bottom3Talleres} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grafica-borde)" horizontal vertical={false} />
                <XAxis type="number" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} width={120} tickFormatter={v => v.length > 22 ? v.substring(0, 22) + '...' : v} />
                <RechartsTooltip cursor={CURSOR_STYLE} contentStyle={TOOLTIP_CONTENT_WIDE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Bar dataKey="inscritos" fill="var(--color-info)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
