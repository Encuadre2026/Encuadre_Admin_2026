import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Ticket, CheckCircle, DollarSign, RefreshCw, ArrowRight, BarChart3, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, Legend, LabelList } from 'recharts';
import { useToast } from '../context/toast-contexto';
import EstadoVacio from '../components/EstadoVacio';
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

/** Un solo formato de número para todo el panel. */
const numero = new Intl.NumberFormat('es-MX');

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
        {valor} <strong>{numero.format(porcion.value)}</strong>{' '}
        <span className="leyenda-porcentaje">{porcentaje}%</span>
      </span>
    );
  };
}

/**
 * Una tarjeta de gráfica, con lo que enseñar cuando no hay nada que dibujar.
 *
 * Sin datos, recharts no falla: pinta un lienzo perfectamente vacío. Un donut
 * sin porciones y una curva sin línea se ven exactamente igual que una gráfica
 * rota, y en un panel que se abre el primer día del pre-registro —cuando todavía
 * no hay nadie inscrito— eso es lo que se ve.
 *
 * Vive fuera del componente de página, como `SortHeader` en Participantes:
 * definida dentro, React la trataría como un tipo nuevo en cada renderizado y
 * volvería a montar la gráfica entera cada vez.
 */
function TarjetaGrafica({ titulo, hayDatos, vacio, retraso, ancha = false, alta = false, children }) {
  return (
    <div
      className={`card fade-in-up${ancha ? ' chart-ancho-total' : ''}`}
      style={{ animationDelay: retraso }}
    >
      <h3 className="chart-title">{titulo}</h3>
      <div className={alta ? 'chart-container-lg' : 'chart-container'}>
        {hayDatos ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : (
          <EstadoVacio {...vacio} />
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ registrosHook }) {
  const { data, loading, error, fetchRegistros } = registrosHook;
  const { showToast } = useToast();
  const navigate = useNavigate();

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
      totalTalleres: cups.length,
      porcentajeAsistencia: totalRegistros ? Math.round((asistencia / totalRegistros) * 100) : 0,
    };
  }, [data]);

  const onRefresh = async () => {
    const ok = await fetchRegistros();
    if (ok) showToast('Dashboard actualizado', 'info');
  };

  // Skeleton state: first load only (no data loaded yet)
  const isFirstLoad = loading && data.registros.length === 0;
  const hayRegistros = stats.totalRegistros > 0;

  // Una gráfica sin datos porque no hay nadie inscrito y una gráfica sin datos
  // porque la petición falló se dibujan igual —vacías— y significan cosas
  // opuestas. La primera es una noticia sobre el evento; la segunda, sobre el
  // panel.
  const falloSinDatos = Boolean(error) && !error.noAutorizado && !hayRegistros;

  // El motivo lo cuenta el aviso de arriba, una vez. Repetirlo en las seis
  // tarjetas serían siete copias de la misma frase en una pantalla.
  const vacio = falloSinDatos
    ? {
        icono: AlertTriangle,
        titulo: 'No se pudieron cargar los datos',
      }
    : {
        icono: BarChart3,
        titulo: 'Sin datos todavía',
        mensaje: 'Esta gráfica se dibujará en cuanto haya registros que contar.',
      };

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
                <h2 className="kpi-value">{falloSinDatos ? '—' : numero.format(stats.totalRegistros)}</h2>
                {!falloSinDatos && <p className="kpi-sub">en {stats.totalTalleres} talleres</p>}
              </div>
            </div>

            <div className="card fade-in-up kpi-card" style={{ animationDelay: '0.1s' }}>
              <div className="kpi-icon kpi-icon-blue"><Ticket size={28} /></div>
              <div>
                <p className="kpi-label">Ocupación Global</p>
                <h2 className="kpi-value">{falloSinDatos ? '—' : `${stats.porcentajeOcupacion}%`}</h2>
                {!falloSinDatos && <p className="kpi-sub">{stats.totalOcupados} / {stats.totalCapacidad}</p>}
              </div>
            </div>

            <div className="card fade-in-up kpi-card" style={{ animationDelay: '0.15s' }}>
              <div className="kpi-icon kpi-icon-green"><CheckCircle size={28} /></div>
              <div>
                <p className="kpi-label">Asistencias</p>
                <h2 className="kpi-value">{falloSinDatos ? '—' : numero.format(stats.asistencia)}</h2>
                {/* Un número de asistencias sin el total contra el que compararlo
                    no dice si el evento fue bien o fue mal. */}
                {!falloSinDatos && <p className="kpi-sub">{stats.porcentajeAsistencia}% del total</p>}
              </div>
            </div>

            <div className="card fade-in-up kpi-card" style={{ animationDelay: '0.2s' }}>
              <div className="kpi-icon kpi-icon-purple"><DollarSign size={28} /></div>
              <div>
                <p className="kpi-label">Pagos Validados</p>
                <h2 className="kpi-value">{falloSinDatos ? '—' : numero.format(stats.pagosConfirmados)}</h2>
                {/* Lo que se hace después de leer «37 pendientes» es ir a
                    validarlos, y eso eran tres clics: la barra lateral, la
                    tabla y el filtro. La barra lateral ya llevaba el filtro
                    puesto; esta cifra hace lo mismo. */}
                {falloSinDatos ? null : stats.pagosPendientes > 0 ? (
                  <button
                    className="kpi-enlace"
                    onClick={() => navigate('/participantes', { state: { filtroPago: 'Pendientes' } })}
                  >
                    {numero.format(stats.pagosPendientes)} pendientes
                    <ArrowRight size={12} />
                  </button>
                ) : (
                  <p className="kpi-sub">sin pagos pendientes</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* La curva y los talleres primero: son las dos preguntas que se hacen al
          abrir el panel —cómo va el ritmo y qué se está llenando—. Los donuts
          describen la composición, que se consulta de vez en cuando. */}
      <div className="dashboard-chart-grid-2col">
        <TarjetaGrafica titulo="Curva de Inscripciones por Día" hayDatos={stats.fechasData.length > 0} vacio={vacio} retraso="0.25s" ancha alta>
          <LineChart data={stats.fechasData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grafica-borde)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
            <YAxis stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
            <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
            <Line type="monotone" dataKey="Inscripciones" stroke="var(--color-accent-gold)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-accent-gold)' }} activeDot={{ r: 6 }} />
          </LineChart>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Top 5 Talleres" hayDatos={stats.top5Talleres.length > 0} vacio={vacio} retraso="0.3s" alta>
          <BarChart data={stats.top5Talleres} layout="vertical" margin={{ top: 5, right: 34, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grafica-borde)" horizontal vertical={false} />
            <XAxis type="number" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} width={120} tickFormatter={v => v.length > 22 ? v.substring(0, 22) + '...' : v} />
            <RechartsTooltip cursor={CURSOR_STYLE} contentStyle={TOOLTIP_CONTENT_WIDE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
            <Bar dataKey="inscritos" fill="var(--color-danger)" radius={[0, 4, 4, 0]} minPointSize={2}>
              {/* La cifra, escrita. Es lo mismo que ya hacen las leyendas de los
                  donuts: sin ella hay que estimar la longitud de la barra
                  contra un eje, o pasar el ratón por encima —que en una tableta
                  no ocurre nunca—. */}
              <LabelList dataKey="inscritos" position="right" fill="var(--color-text-secondary)" fontSize={11} formatter={(v) => numero.format(v)} />
            </Bar>
          </BarChart>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Top 3 Menos Solicitados" hayDatos={stats.bottom3Talleres.length > 0} vacio={vacio} retraso="0.35s" alta>
          <BarChart data={stats.bottom3Talleres} layout="vertical" margin={{ top: 5, right: 34, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grafica-borde)" horizontal vertical={false} />
            <XAxis type="number" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} width={120} tickFormatter={v => v.length > 22 ? v.substring(0, 22) + '...' : v} />
            <RechartsTooltip cursor={CURSOR_STYLE} contentStyle={TOOLTIP_CONTENT_WIDE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
            {/* `minPointSize` no es adorno: recharts no dibuja rectángulo para
                un valor de 0, y sin rectángulo tampoco hay etiqueta. Un taller
                sin nadie inscrito desaparecía por completo de la gráfica que
                existe justamente para enseñarlo: ni barra, ni cifra, solo su
                nombre en el eje. Con dos píxeles hay rectángulo, y con él
                aparece el «0». */}
            <Bar dataKey="inscritos" fill="var(--color-info)" radius={[0, 4, 4, 0]} minPointSize={2}>
              <LabelList dataKey="inscritos" position="right" fill="var(--color-text-secondary)" fontSize={11} formatter={(v) => numero.format(v)} />
            </Bar>
          </BarChart>
        </TarjetaGrafica>
      </div>

      {/* Composición: quién se inscribe y cómo va el pago. */}
      {isFirstLoad ? (
        <div className="dashboard-chart-grid">
          <ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
        </div>
      ) : (
        <div className="dashboard-chart-grid">
          <TarjetaGrafica titulo="Estatus de Pagos" hayDatos={hayRegistros} vacio={vacio} retraso="0.4s">
            <PieChart>
              <Pie data={stats.pagosData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                <Cell fill="var(--color-success)" />
                <Cell fill="var(--color-danger)" />
              </Pie>
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
              <Legend formatter={leyendaConCifra(stats.pagosData)} />
            </PieChart>
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Audiencia Local vs Foránea" hayDatos={hayRegistros} vacio={vacio} retraso="0.45s">
            <PieChart>
              <Pie data={stats.audienciaData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                <Cell fill="var(--color-accent-gold)" />
                <Cell fill="var(--color-info)" />
              </Pie>
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
              <Legend formatter={leyendaConCifra(stats.audienciaData)} />
            </PieChart>
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Distribución de Perfiles" hayDatos={stats.perfilesData.length > 0} vacio={vacio} retraso="0.5s">
            <PieChart>
              <Pie data={stats.perfilesData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={5} dataKey="value">
                {stats.perfilesData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
              <Legend formatter={leyendaConCifra(stats.perfilesData)} />
            </PieChart>
          </TarjetaGrafica>
        </div>
      )}
    </div>
  );
}
