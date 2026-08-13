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

export const CUPOS = TALLERES.map((nombre, i) => ({
  nombre,
  cupo_maximo: 18,
  inscritos: [18, 14, 9, 3, 0][i],
  inscritos_uaa: [10, 4, 2, 1, 0][i],
  inscritos_general: [8, 10, 7, 2, 0][i],
  lugares_reservados_uaa: 10,
}));

/** Deja la página con sesión iniciada y la API interceptada. */
export async function prepararPanel(page, { registros = REGISTROS, cupos = CUPOS } = {}) {
  await page.addInitScript(() => {
    sessionStorage.setItem('ENCUADRE_ADMIN_SECRET', 'secreto-de-prueba');
    localStorage.setItem('ENCUADRE_ADMIN_TOKEN', 'token-de-prueba');
  });

  await page.route('**/api/admin/**', (ruta) =>
    ruta.fulfill({ json: { ok: true, registros, cupos } })
  );
}

/** El panel usa HashRouter, así que la ruta va después de la almohadilla. */
export async function irA(page, ruta) {
  await page.goto(`#/${ruta}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}
