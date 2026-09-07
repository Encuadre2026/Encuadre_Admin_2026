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
    taller_preferencia: null,
  },
];

/** El padrón con la asamblea dentro, que es como llega de la API. */
export const REGISTROS_CON_ASAMBLEA = [...REGISTROS, ...ASAMBLEA];

export const CUPOS = TALLERES.map((nombre, i) => ({
  nombre,
  cupo_maximo: 18,
  inscritos: [18, 14, 9, 3, 0][i],
  inscritos_uaa: [10, 4, 2, 1, 0][i],
  inscritos_general: [8, 10, 7, 2, 0][i],
  lugares_reservados_uaa: 10,
}));

/** El nombre exacto de la sede, tal y como lo declara la API. */
export const INSTITUCION_SEDE = 'UAA · Universidad Autónoma de Aguascalientes';

/** Deja la página con sesión iniciada y la API interceptada. */
export async function prepararPanel(
  page,
  { registros = REGISTROS, cupos = CUPOS, institucionSede = INSTITUCION_SEDE } = {}
) {
  await page.addInitScript(() => {
    sessionStorage.setItem('ENCUADRE_ADMIN_SECRET', 'secreto-de-prueba');
    localStorage.setItem('ENCUADRE_ADMIN_TOKEN', 'token-de-prueba');
  });

  await page.route('**/api/admin/**', (ruta) =>
    ruta.fulfill({
      json: { ok: true, registros, cupos, institucion_sede: institucionSede },
    })
  );
}

/** El panel usa HashRouter, así que la ruta va después de la almohadilla. */
export async function irA(page, ruta) {
  await page.goto(`#/${ruta}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}
