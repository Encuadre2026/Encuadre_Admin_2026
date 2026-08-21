import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowRight, BarChart3, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '../context/toast-contexto';
import { estadoDeCupo } from '../cupos';
import EstadoVacio from '../components/EstadoVacio';
import { KpiSkeleton, ChartSkeleton } from '../components/Skeleton';

/**
 * Los colores de la composición, una sola vez y en el orden de siempre.
 *
 * Son clases, no valores: los cinco colores de marca siguen escritos
 * únicamente en los tokens de `index.css` —que es lo que vigila
 * `scripts/revisar-color.mjs`— y aquí solo se elige cuál toca.
 */
const TONOS = ['tono-oro', 'tono-morado', 'tono-info', 'tono-peligro', 'tono-exito'];

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-grafica-fondo)',
  borderColor: 'var(--color-grafica-borde)',
  borderRadius: '8px',
};
const TOOLTIP_ITEM_STYLE = { color: 'var(--color-text-primary)' };
const TOOLTIP_LABEL_STYLE = {
  color: 'var(--color-accent-gold)',
  fontWeight: 600,
  marginBottom: '4px',
};

/** Un solo formato de número para todo el panel. */
const numero = new Intl.NumberFormat('es-MX');

/**
 * Reparte un total en porciones con su porcentaje ya calculado.
 *
 * El porcentaje que se escribe va redondeado y el ancho del segmento no: si la
 * barra se dibujara con los enteros, tres porciones de 33,3 % dejarían un
 * píxel de fondo al final que parece un cuarto valor.
 */
function porciones(partes, tonos = TONOS) {
  const total = partes.reduce((suma, p) => suma + p.valor, 0);
  return partes.map((parte, i) => ({
    ...parte,
    tono: tonos[i % tonos.length],
    porcentaje: total ? Math.round((parte.valor / total) * 100) : 0,
    ancho: total ? (parte.valor / total) * 100 : 0,
  }));
}

/**
 * Una sección del dashboard: número de orden, nombre y, a la derecha, la cifra
 * que la resume.
 *
 * Vive fuera del componente de página, como `SortHeader` en Participantes:
 * definida dentro, React la trataría como un tipo nuevo en cada renderizado y
 * volvería a montar la gráfica entera cada vez.
 */
function Seccion({ indice, nombre, meta, retraso, children }) {
  return (
    <section className="seccion fade-in-up" style={{ animationDelay: retraso }}>
      <div className="seccion-cabecera">
        <div className="seccion-titulo">
          <span className="seccion-indice cifra">{indice}</span>
          <h2 className="seccion-nombre">{nombre}</h2>
        </div>
        {meta && <span className="seccion-meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Una barra de proporción con su leyenda.
 *
 * Sustituye a los tres donuts. El donut obliga a comparar ángulos para
 * responder a lo que aquí se pregunta —cuánto falta por validar, cuánta gente
 * viene de fuera—, y las cifras solo aparecían al pasar el ratón o en la
 * leyenda; en una tableta, lo primero no ocurre nunca.
 */
function Proporcion({ titulo, partes, hayDatos, vacio }) {
  return (
    <div className="proporcion">
      <div className="rotulo-seccion">{titulo}</div>
      {hayDatos ? (
        <>
          <div className="proporcion-barra">
            {/* Una porción de valor cero no se dibuja: con `min-width` acabaría
                siendo una raya igual que la de un valor pequeño pero real. La
                leyenda sí la sigue nombrando, con su cero. */}
            {partes.filter((p) => p.valor > 0).map((parte) => (
              <div
                key={parte.nombre}
                className={`proporcion-segmento ${parte.tono}`}
                style={{ width: `${parte.ancho}%` }}
              />
            ))}
          </div>
          <div className="proporcion-leyenda">
            {partes.map((parte) => (
              <div className="proporcion-fila" key={parte.nombre}>
                <span className={`proporcion-punto ${parte.tono}`} aria-hidden="true" />
                <span className="proporcion-nombre">{parte.nombre}</span>
                <span className="proporcion-cifra">{numero.format(parte.valor)}</span>
                <span className="proporcion-porcentaje">{parte.porcentaje} %</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EstadoVacio {...vacio} />
      )}
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

    // Un taller por fila, ordenados por demanda. Antes eran dos gráficas —«Top
    // 5» y «Top 3 menos solicitados»— que con cinco talleres enseñaban los
    // mismos talleres dos veces.
    const talleres = cups
      .map((c) => ({ nombre: c.nombre, ...estadoDeCupo(c) }))
      .sort((a, b) => b.inscritos - a.inscritos);

    const totalCapacidad = talleres.reduce((suma, t) => suma + t.capacidad, 0);
    const totalOcupados = talleres.reduce((suma, t) => suma + t.inscritos, 0);
    const porcentajeOcupacion = totalCapacidad ? Math.round((totalOcupados / totalCapacidad) * 100) : 0;

    const perfilesMap = {};
    regs.forEach(r => {
      const p = r.perfil || 'Desconocido';
      perfilesMap[p] = (perfilesMap[p] || 0) + 1;
    });
    const perfilesData = porciones(
      Object.entries(perfilesMap)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, valor]) => ({ nombre, valor }))
    );

    const pagosConfirmados = regs.filter(r => r.pago_aprobado).length;
    const pagosPendientes = totalRegistros - pagosConfirmados;
    // El verde y el rojo no son «el color 1 y el color 2» de una serie: son los
    // colores de estado del panel, y aquí lo que se enseña es justamente un
    // estado. Los perfiles, que no significan nada bueno ni malo, sí van con la
    // rampa neutra.
    const pagosData = porciones([
      { nombre: 'Confirmados', valor: pagosConfirmados },
      { nombre: 'Pendientes', valor: pagosPendientes },
    ], ['tono-exito', 'tono-peligro']);

    const uaaCount = regs.filter(r => (r.institucion || '').includes('UAA')).length;
    const foraneosCount = totalRegistros - uaaCount;
    const audienciaData = porciones([
      { nombre: 'UAA · local', valor: uaaCount },
      { nombre: 'Otras instituciones', valor: foraneosCount },
    ], ['tono-oro', 'tono-info']);

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
      perfilesData, pagosConfirmados, pagosPendientes, pagosData,
      talleres, audienciaData, fechasData,
      totalTalleres: cups.length,
      porcentajeAsistencia: totalRegistros ? Math.round((asistencia / totalRegistros) * 100) : 0,
      porcentajePagos: totalRegistros ? Math.round((pagosConfirmados / totalRegistros) * 100) : 0,
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

  // El motivo lo cuenta el aviso de arriba, una vez. Repetirlo en cada sección
  // serían varias copias de la misma frase en una pantalla.
  const vacio = falloSinDatos
    ? {
        icono: AlertTriangle,
        titulo: 'No se pudieron cargar los datos',
      }
    : {
        icono: BarChart3,
        titulo: 'Sin datos todavía',
        mensaje: 'Esto se dibujará en cuanto haya registros que contar.',
      };

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <div className="page-header-titulo">
          <div className="rotulo-seccion">Panel · Dashboard</div>
          <h1>Estado del padrón</h1>
          <p className="page-header-contexto">
            36 FTD · Futurología y Tendencia del Diseño · del 29 al 31 de octubre de 2026
          </p>
        </div>
        <div className="header-actions">
          <button onClick={onRefresh} className="btn btn-outline btn-header" disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* Las cuatro cifras de cabecera. La primera al doble de cuerpo: es la
          que resume el evento. */}
      <div className="dashboard-kpi-grid">
        {isFirstLoad ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <div className="kpi-card fade-in-up" style={{ animationDelay: '0.05s' }}>
              <p className="kpi-label">Registros totales</p>
              <h2 className="kpi-value">{falloSinDatos ? '—' : numero.format(stats.totalRegistros)}</h2>
              {!falloSinDatos && (
                <p className="kpi-sub">
                  en {stats.totalTalleres} talleres · {numero.format(stats.totalOcupados)} lugares ocupados
                </p>
              )}
            </div>

            <div className="kpi-card fade-in-up" style={{ animationDelay: '0.1s' }}>
              <p className="kpi-label">Ocupación global</p>
              <h2 className="kpi-value">{falloSinDatos ? '—' : `${stats.porcentajeOcupacion}%`}</h2>
              {!falloSinDatos && (
                <>
                  <div className="kpi-medida">
                    <div className="kpi-medida-relleno tono-oro" style={{ width: `${stats.porcentajeOcupacion}%` }} />
                  </div>
                  <p className="kpi-sub">{stats.totalOcupados} de {stats.totalCapacidad} lugares</p>
                </>
              )}
            </div>

            <div className="kpi-card fade-in-up" style={{ animationDelay: '0.15s' }}>
              <p className="kpi-label">Asistencia</p>
              <h2 className="kpi-value">{falloSinDatos ? '—' : numero.format(stats.asistencia)}</h2>
              {/* Un número de asistencias sin el total contra el que compararlo
                  no dice si el evento fue bien o fue mal. */}
              {!falloSinDatos && (
                <>
                  <div className="kpi-medida">
                    <div className="kpi-medida-relleno tono-exito" style={{ width: `${stats.porcentajeAsistencia}%` }} />
                  </div>
                  <p className="kpi-sub">{stats.porcentajeAsistencia} % del padrón</p>
                </>
              )}
            </div>

            <div className="kpi-card fade-in-up" style={{ animationDelay: '0.2s' }}>
              <p className="kpi-label">Pagos validados</p>
              <h2 className="kpi-value">{falloSinDatos ? '—' : numero.format(stats.pagosConfirmados)}</h2>
              {/* Lo que se hace después de leer «37 pendientes» es ir a
                  validarlos, y eso eran tres clics: la barra lateral, la tabla
                  y el filtro. */}
              {falloSinDatos ? null : (
                <>
                  <div className="kpi-medida">
                    <div className="kpi-medida-relleno tono-exito" style={{ width: `${stats.porcentajePagos}%` }} />
                  </div>
                  {stats.pagosPendientes > 0 ? (
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
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* El ritmo primero: es la pregunta que se hace al abrir el panel. */}
      <Seccion
        indice="01"
        nombre="Ritmo del pre-registro"
        meta={hayRegistros ? `${stats.fechasData.length} días con inscripciones` : null}
        retraso="0.25s"
      >
        <div className="chart-container-lg">
          {stats.fechasData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.fechasData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grafica-borde)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                <YAxis stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                <Line type="monotone" dataKey="Inscripciones" stroke="var(--color-accent-gold)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-accent-gold)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EstadoVacio {...vacio} />
          )}
        </div>
      </Seccion>

      <Seccion
        indice="02"
        nombre="Demanda por taller"
        meta={stats.talleres.length > 0
          ? `${stats.totalTalleres} talleres · ${stats.totalOcupados} de ${stats.totalCapacidad} lugares`
          : null}
        retraso="0.3s"
      >
        {stats.talleres.length > 0 ? (
          <div className="taller-lista">
            {stats.talleres.map((taller, i) => (
              <div className="taller-fila" key={taller.nombre}>
                <span className="taller-indice cifra">{String(i + 1).padStart(2, '0')}</span>
                <span className="taller-nombre" title={taller.nombre}>{taller.nombre}</span>
                {taller.inscritos === 0 ? (
                  <span className="taller-insignia insignia-alerta">Sin inscritos</span>
                ) : taller.insignia !== 'Disponible' ? (
                  <span className={`taller-insignia ${taller.insignia === 'Lleno' ? 'insignia-alerta' : 'insignia-aviso'}`}>
                    {taller.insignia}
                  </span>
                ) : null}
                <div className="taller-barra">
                  <div
                    className={`taller-barra-relleno${taller.inscritos === 0 ? ' vacio' : ''}`}
                    style={{ width: taller.inscritos === 0 ? '2px' : `${Math.round(taller.porcentaje)}%` }}
                  />
                </div>
                <span className={`taller-cifra cifra${taller.inscritos === 0 ? ' apagada' : ''}`}>
                  {numero.format(taller.inscritos)} / {numero.format(taller.capacidad)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EstadoVacio {...vacio} />
        )}
      </Seccion>

      <Seccion indice="03" nombre="Quién se inscribe" retraso="0.35s">
        {isFirstLoad ? (
          <div className="composicion-grid">
            <ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
          </div>
        ) : (
          <div className="composicion-grid">
            <Proporcion titulo="Estatus de pago" partes={stats.pagosData} hayDatos={hayRegistros} vacio={vacio} />
            <Proporcion titulo="Procedencia" partes={stats.audienciaData} hayDatos={hayRegistros} vacio={vacio} />
            <Proporcion titulo="Perfil" partes={stats.perfilesData} hayDatos={stats.perfilesData.length > 0} vacio={vacio} />
          </div>
        )}
      </Seccion>
    </div>
  );
}
