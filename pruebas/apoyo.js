/**
 * Datos simulados y sesión falsa para las pruebas de disposición.
 *
 * Ninguna prueba debe hablar con el Worker real: no hay secreto de
 * administración en CI, y aunque lo hubiera, una prueba que dependa de los
 * datos de producción falla o pasa por motivos que no tienen nada que ver con
 * lo que afirma.
 */

const TALLERES = [
  'Didácticas para el aprendizaje de los procesos de la invención del diseño. (Dirigido a docentes)',
  'Futurología aplicada al diseño',
  'Disruptive Design Method',
  'Taller de poesía objetual',
  'Expedición tipográfica urbana',
];

const INSTITUCIONES = [
  'UAA · Universidad Autónoma de Aguascalientes',
  'ANAHUAC · Universidad Anáhuac Cancún',
  'ITESM · Tecnológico de Monterrey',
];

/**
 * Los valores largos son deliberados: el desbordamiento lo provocaba el
 * contenido más ancho, así que una fixture con nombres cortos no reproduciría
 * el fallo que estas pruebas vigilan.
 */
export const REGISTROS = Array.from({ length: 47 }, (_, i) => ({
  id_participante: i % 4 === 0 ? `2208${String(i).padStart(2, '0')}` : `ENC-${String(i + 1).padStart(3, '0')}`,
  fecha_registro: `2026-08-${String((i % 28) + 1).padStart(2, '0')} 1${i % 10}:30:00`,
  nombre: 'Ana Victoria de la Rosa García',
  correo: `participante${i}@ejemplo.com`,
  curp: `ROGA000000MASXXX0${i % 10}`,
  telefono: `44912345${String(i).padStart(2, '0')}`,
  institucion: INSTITUCIONES[i % 3],
  perfil: ['Estudiante', 'Profesor', 'Público General'][i % 3],
  taller: TALLERES[i % TALLERES.length],
  url_comprobante: i % 3 === 0 ? `comprobantes/1786341787${i}_ENC.pdf` : '',
  url_comprobante_pago: i % 5 === 0 ? `comprobantes/1786341848${i}_ENC.pdf` : '',
  pago_aprobado: i % 5 === 0 ? 1 : 0,
  asistio: i % 7 === 0 ? 1 : 0,
  fecha_asistencia: i % 7 === 0 ? '2026-10-29 09:15:00' : null,
  // El recuento de asistencias y el estado del reconocimiento (migraciones
  // 0012 y 0013). Solo llega al mínimo quien pagó, que es como ocurre de
  // verdad: sin pago no hay código de acceso y la puerta no anota nada.
  // Salen 10 con derecho de los 47, y 5 de ellos ya enviados.
  asistencias: i % 5 === 0 ? 3 : i % 3,
  dias_asistidos: i % 5 === 0 ? 2 : (i % 3 === 0 ? 0 : 1),
  ultima_asistencia: i % 3 === 0 && i % 5 !== 0 ? null : '2026-10-31 16:00:00',
  reconocimiento_disponible: i % 5 === 0 ? 1 : 0,
  fecha_reconocimiento_enviado: i % 10 === 0 ? '2026-11-02 18:00:00' : null,
}));

/**
 * La asamblea de ENCUADRE.
 *
 * Su alta entra por `POST /api/asamblea` y se guarda en la misma tabla que
 * todo el mundo, con el taller centinela y ocho campos que no se le preguntan
 * a nadie más. La CURP y el teléfono nacen vacíos: su formulario no los pide.
 *
 * Los tres casos están elegidos, no son relleno: uno que asiste y viaja con
 * alumnos, uno que viaja con CERO alumnos —que no es lo mismo que no viajar
 * con alumnos— y uno que ni siquiera asiste al Encuentro, con casi todo en
 * null porque a esa altura el formulario deja de preguntar.
 */
export const ASAMBLEA = [
  {
    id_participante: 'ASA-001',
    fecha_registro: '2026-08-10 10:00:00',
    nombre: 'María de los Ángeles Fernández Ocampo',
    correo: 'representante1@ejemplo.com',
    curp: '',
    telefono: '',
    institucion: 'ANAHUAC · Universidad Anáhuac Cancún',
    perfil: 'Asambleísta Encuadre',
    taller: 'Sin taller · Asamblea',
    url_comprobante: 'comprobantes/17863417871_ASA.pdf',
    url_comprobante_pago: '',
    pago_aprobado: 1,
    asistio: 0,
    fecha_asistencia: null,
    programa_academico: 'Diseño Gráfico',
    tipo_representante: 'Titular',
    asiste_encuentro: 1,
    hotel: 'Hotel Francia Aguascalientes',
    viaja_con_alumnos: 1,
    numero_alumnos: 12,
    interes_talleres: 1,
    asistencias: 0,
    dias_asistidos: 0,
    ultima_asistencia: null,
    reconocimiento_disponible: 1,
    fecha_reconocimiento_enviado: null,
    taller_preferencia: 'Futurología aplicada al diseño',
  },
  {
    id_participante: 'ASA-002',
    fecha_registro: '2026-08-11 11:00:00',
    nombre: 'José Guadalupe Herrera Villalobos',
    correo: 'representante2@ejemplo.com',
    curp: '',
    telefono: '',
    institucion: 'ITESM · Tecnológico de Monterrey',
    perfil: 'Asambleísta Encuadre',
    taller: 'Sin taller · Asamblea',
    url_comprobante: 'comprobantes/17863417872_ASA.pdf',
    url_comprobante_pago: '',
    pago_aprobado: 0,
    asistio: 0,
    fecha_asistencia: null,
    programa_academico: 'Diseño Industrial',
    tipo_representante: 'Suplente',
    asiste_encuentro: 1,
    hotel: 'Hotel Quinta Real',
    viaja_con_alumnos: 1,
    numero_alumnos: 0,
    interes_talleres: 0,
    asistencias: 0,
    dias_asistidos: 0,
    ultima_asistencia: null,
    reconocimiento_disponible: 0,
    fecha_reconocimiento_enviado: null,
    taller_preferencia: null,
  },
  {
    id_participante: 'ASA-003',
    fecha_registro: '2026-08-12 12:00:00',
    nombre: 'Ana Victoria de la Rosa García',
    correo: 'representante3@ejemplo.com',
    curp: '',
    telefono: '',
    institucion: 'UAA · Universidad Autónoma de Aguascalientes',
    perfil: 'Asambleísta Encuadre',
    taller: 'Sin taller · Asamblea',
    url_comprobante: 'comprobantes/17863417873_ASA.pdf',
    url_comprobante_pago: '',
    pago_aprobado: 1,
    asistio: 0,
    fecha_asistencia: null,
    programa_academico: 'Diseño de Interiores',
    tipo_representante: 'Titular',
    asiste_encuentro: 0,
    hotel: null,
    viaja_con_alumnos: null,
    numero_alumnos: null,
    interes_talleres: null,
    asistencias: 0,
    dias_asistidos: 0,
    ultima_asistencia: null,
    reconocimiento_disponible: 1,
    fecha_reconocimiento_enviado: '2026-11-02 18:00:00',
    taller_preferencia: null,
  },
];

/** El padrón con la asamblea dentro, que es como llega de la API. */
export const REGISTROS_CON_ASAMBLEA = [...REGISTROS, ...ASAMBLEA];

/**
 * Los talleres con su catálogo, como los manda la API desde que se editan en el
 * panel. Los ids no son contiguos a propósito —0, 8, 9, 13 y 17—: son los de
 * producción, y el número que enseña el panel es el id más uno, no la posición.
 * Todos con el registro abierto; la prueba que necesita uno cerrado lo cierra.
 */
const CATALOGO = [
  { id: 0, imparte: 'Mtro. Luis Antonio Rivera Díaz', color: 'verde', cursivas: [], registro_cerrado: false },
  { id: 8, imparte: 'Fabián Bautista Saucedo', color: 'azul', cursivas: [], registro_cerrado: false },
  { id: 9, imparte: 'Fernanda Romo, EdgeHub Neouniversidad', color: 'morado', cursivas: ['Disruptive Design Method'], registro_cerrado: false },
  { id: 13, imparte: 'Dr. Edy Yuvoniel Orta, Atelier 1123', color: 'morado', cursivas: [], registro_cerrado: false },
  { id: 17, imparte: 'Dra. A. S. Mónica Susana de la Barrera Medina', color: 'morado', cursivas: [], registro_cerrado: false },
];

export const CUPOS = TALLERES.map((nombre, i) => ({
  ...CATALOGO[i],
  nombre,
  cupo_maximo: 18,
  inscritos: [18, 14, 9, 3, 0][i],
  inscritos_uaa: [10, 4, 2, 1, 0][i],
  inscritos_general: [8, 10, 7, 2, 0][i],
  lugares_reservados_uaa: 10,
}));

/** El nombre exacto de la sede, tal y como lo declara la API. */
export const INSTITUCION_SEDE = 'UAA · Universidad Autónoma de Aguascalientes';

/**
 * Deja la página con sesión iniciada y la API interceptada.
 *
 * `soloLectura` simula la segunda contraseña del panel. Quien decide el perfil es
 * la API —responde `solo_lectura` en el padrón—, así que aquí se simula igual:
 * en la respuesta, no escribiendo a mano la marca de sessionStorage, que es solo
 * donde el panel apunta lo que le dijeron.
 */
/**
 * El recuento que devuelve `GET /api/admin/reconocimientos/estado`.
 *
 * Cuadra con las fixtures: 10 de los 47 del padrón llegan al mínimo y 5 ya
 * recibieron el suyo. Si se cambian las fixtures hay que mover esto con ellas,
 * porque la pantalla enseña las dos cosas a la vez y un desajuste se lee como
 * un fallo del panel.
 */
export const ESTADO_RECONOCIMIENTOS = {
  elegibles: 10,
  enviados: 5,
  pendientes: 5,
  sin_correo: 0,
  minimo_de_asistencias: 3,
  total_del_padron: 47,
};

/**
 * Una API que manda todo lo que le queda en la primera llamada.
 *
 * Es el caso normal: el panel llama, se vacía la cola y el bucle termina. Para
 * probar el envío a trozos, o uno que falla, se le pasa otra a `prepararPanel`.
 */
export function enviaTodoDeUnaVez(pendientesIniciales = ESTADO_RECONOCIMIENTOS.pendientes) {
  let quedan = pendientesIniciales;
  return (cuerpo = {}) => {
    // La simulación cuenta y no manda: si descontara, la confirmación diría un
    // número y el envío mandaría otro, que es el fallo que esto vigila.
    if (cuerpo.simulacion) {
      return { simulacion: true, enviados: 0, fallidos: 0, pendientes: quedan, mensaje: '' };
    }
    const enviados = quedan;
    quedan = 0;
    return { enviados, fallidos: 0, detalle_fallidos: [], pendientes: 0, mensaje: `Se mandaron ${enviados}.` };
  };
}

export async function prepararPanel(
  page,
  {
    registros = REGISTROS,
    cupos = CUPOS,
    institucionSede = INSTITUCION_SEDE,
    soloLectura = false,
    alTaller = () => ({ status: 200, json: { ok: true } }),
    alRegistro = () => ({ status: 200, json: { ok: true } }),
    alCambioDeTaller = () => ({ status: 200, json: { ok: true, correo_enviado: true } }),
    estadoDeReconocimientos = ESTADO_RECONOCIMIENTOS,
    alEnviarReconocimientos = enviaTodoDeUnaVez(),
  } = {}
) {
  await page.addInitScript(() => {
    sessionStorage.setItem('ENCUADRE_ADMIN_SECRET', 'secreto-de-prueba');
    localStorage.setItem('ENCUADRE_ADMIN_TOKEN', 'token-de-prueba');
  });

  // `cupos` puede ser una función para que una prueba cambie los talleres
  // después de guardar, igual que los cambiaría la API.
  await page.route('**/api/admin/**', (ruta) =>
    ruta.fulfill({
      json: {
        ok: true,
        registros,
        cupos: typeof cupos === 'function' ? cupos() : cupos,
        institucion_sede: institucionSede,
        solo_lectura: soloLectura,
      },
    })
  );

  // Agregar, editar y eliminar talleres. Va después de la anterior porque
  // Playwright prueba primero la última ruta registrada.
  const peticiones = [];
  await page.route('**/api/admin/taller', async (ruta) => {
    const peticion = { metodo: ruta.request().method(), cuerpo: ruta.request().postDataJSON() };
    peticiones.push(peticion);
    const { status, json } = alTaller(peticion);
    await ruta.fulfill({ status, json });
  });

  // Abrir y cerrar el registro de un taller, que va por su propia ruta.
  const cambiosDeRegistro = [];
  await page.route('**/api/admin/taller/registro', async (ruta) => {
    const peticion = { metodo: ruta.request().method(), cuerpo: ruta.request().postDataJSON() };
    cambiosDeRegistro.push(peticion);
    const { status, json } = alRegistro(peticion);
    await ruta.fulfill({ status, json });
  });

  // Los reconocimientos. Van después de la general por lo mismo que las de
  // talleres: Playwright prueba primero la última ruta registrada.
  //
  // El PDF se devuelve como unos pocos bytes con la firma %PDF-: a estas
  // pruebas les importa que el panel pida el archivo y lo entregue al
  // navegador, no qué hay dibujado dentro, que es asunto del Worker.
  const descargas = [];
  await page.route('**/api/admin/reconocimiento?*', async (ruta) => {
    descargas.push(new URL(ruta.request().url()).searchParams);
    await ruta.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'Content-Disposition': 'attachment; filename="Reconocimiento.pdf"' },
      body: Buffer.from('%PDF-1.4 reconocimiento de prueba'),
    });
  });

  await page.route('**/api/admin/reconocimientos/estado', (ruta) =>
    ruta.fulfill({ json: { ok: true, ...estadoDeReconocimientos } })
  );

  // El envío va por lotes y el panel lo llama en bucle, así que la simulación
  // de la API tiene que descontar: devolver siempre los mismos pendientes
  // dejaría la prueba dando vueltas para siempre.
  const enviosDeReconocimientos = [];
  await page.route('**/api/admin/reconocimientos/enviar', async (ruta) => {
    const cuerpo = ruta.request().postDataJSON() || {};
    enviosDeReconocimientos.push(cuerpo);
    await ruta.fulfill({ json: { ok: true, ...alEnviarReconocimientos(cuerpo) } });
  });

  // Pasar a una persona a otro taller.
  const cambiosDeTaller = [];
  await page.route('**/api/admin/registro/taller', async (ruta) => {
    const peticion = { metodo: ruta.request().method(), cuerpo: ruta.request().postDataJSON() };
    cambiosDeTaller.push(peticion);
    const { status, json } = alCambioDeTaller(peticion);
    await ruta.fulfill({ status, json });
  });
  return { peticiones, cambiosDeRegistro, cambiosDeTaller, descargas, enviosDeReconocimientos };
}

/** El panel usa HashRouter, así que la ruta va después de la almohadilla. */
export async function irA(page, ruta) {
  await page.goto(`#/${ruta}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}
