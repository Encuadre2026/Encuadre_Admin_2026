import { test, expect } from '@playwright/test';
import { irA, prepararPanel, INSTITUCION_SEDE } from './apoyo.js';

/**
 * Quién cuenta como «de la sede».
 *
 * El Worker compara el nombre completo de la institución para decidir quién
 * ocupa un lugar reservado. El panel lo resolvía por su cuenta con
 * `institucion.includes('UAA')`, que reparte distinto: cualquier nombre con
 * «UAA» dentro contaba como local aquí y como foráneo en la base.
 *
 * No se notaba porque la única entrada del catálogo con «UAA» es la sede. Pero
 * `institucion` es texto libre —el Worker solo comprueba que sea una cadena, no
 * la valida contra ningún catálogo—, así que basta con que alguien escriba su
 * propia institución para que el panel enseñe un número y la base tenga otro.
 * Y con una sede futura cuyas siglas aparezcan dentro de otro nombre, la
 * discrepancia dejaría de ser un caso raro.
 *
 * Estas pruebas usan un impostor: una institución que contiene «UAA» sin ser la
 * sede. Con la regla vieja se cuenta como local; con la de la API, como
 * foránea, que es lo que dice la base.
 */

const IMPOSTORA = 'Escuela UAA de Diseño (particular)';

/** Tres personas: una de la sede, una impostora y una claramente foránea. */
const REGISTROS = [
  fila(1, INSTITUCION_SEDE),
  fila(2, IMPOSTORA),
  fila(3, 'ITESM · Tecnológico de Monterrey'),
];

function fila(n, institucion) {
  return {
    id_participante: `ENC-00${n}`,
    fecha_registro: '2026-08-01 10:00:00',
    nombre: `Participante ${n}`,
    correo: `p${n}@ejemplo.com`,
    curp: `XXXX00000${n}HXXXXX00`,
    telefono: `449000000${n}`,
    institucion,
    perfil: 'Estudiante',
    taller: 'Futurología aplicada al diseño',
    url_comprobante: '',
    url_comprobante_pago: '',
    pago_aprobado: 0,
    asistio: 0,
    fecha_asistencia: null,
  };
}

test('el filtro de sede deja fuera a una institución que solo contiene las siglas', async ({
  page,
}) => {
  await prepararPanel(page, { registros: REGISTROS });
  await irA(page, 'participantes');

  await page.getByRole('button', { name: 'Sede', exact: true }).click();
  await page.waitForTimeout(300);

  // Solo la de la sede. La impostora ocupa un lugar general en la base, así que
  // enseñarla aquí daría una cuenta que no cuadra con los cupos.
  await expect(page.getByText('Participante 1')).toBeVisible();
  await expect(page.getByText('Participante 2')).toHaveCount(0);
  await expect(page.getByText('Participante 3')).toHaveCount(0);
});

test('el filtro de foráneos sí la incluye', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS });
  await irA(page, 'participantes');

  await page.getByRole('button', { name: 'Foráneos', exact: true }).click();
  await page.waitForTimeout(300);

  await expect(page.getByText('Participante 1')).toHaveCount(0);
  await expect(page.getByText('Participante 2')).toBeVisible();
  await expect(page.getByText('Participante 3')).toBeVisible();
});

test('sin institucion_sede el panel no se queda a oscuras', async ({ page }) => {
  // Los dos repos se despliegan por separado. Si el panel llega antes que el
  // Worker que declara el campo, `institucion_sede` viene vacío: entonces se
  // conserva la regla anterior, en vez de contar a todo el mundo como foráneo y
  // vaciar la gráfica sin que nadie se entere. El respaldo se puede quitar en
  // cuanto la API lo devuelva en producción.
  await prepararPanel(page, { registros: REGISTROS, institucionSede: null });

  await irA(page, 'dashboard');
  await expect(page.getByText('Sede · local')).toBeVisible();

  await irA(page, 'participantes');
  await expect(page.locator('tbody tr.expandable-row').first()).toBeVisible();
});

test('la leyenda de la gráfica lleva las siglas de la sede que diga la API', async ({ page }) => {
  // «UAA · local» estaba escrito a mano: una cuarta copia del nombre de la sede
  // esperando a quedarse vieja. Ahora sale de `institucion_sede`.
  await prepararPanel(page, {
    registros: REGISTROS,
    institucionSede: 'BUAP · Benemérita Universidad Autónoma de Puebla',
  });
  await irA(page, 'dashboard');

  await expect(page.getByText('BUAP · local')).toBeVisible();
  await expect(page.getByText('UAA · local')).toHaveCount(0);
});
