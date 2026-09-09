import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { irA, prepararPanel, ASAMBLEA, REGISTROS, REGISTROS_CON_ASAMBLEA } from './apoyo.js';

/**
 * El segundo perfil del panel: entra con otra contraseña y solo mira.
 *
 * Lo que se le quita no es una lista de botones sueltos, es la capacidad de
 * cambiar el padrón: los dos botones de validar y el detalle desplegado de cada
 * fila, que es donde vive «Eliminar registro». Lo que conserva es todo lo demás
 * —la tabla, los filtros, el dashboard, los cupos, la hoja de Excel y los
 * documentos—, porque el perfil existe para consultar, no para consultar a
 * medias.
 *
 * La API le niega esas dos rutas de todos modos, y de eso responden las pruebas
 * del Worker. Estas responden de que el panel no le ofrezca lo que va a ser
 * rechazado.
 */

/** El primer registro con el pago pendiente: i % 5 !== 0 en la fixture. */
const PENDIENTE = REGISTROS.find((r) => !r.pago_aprobado).id_participante;
/** Y uno con el pago ya confirmado, para el estado que sí se sigue viendo. */
const CONFIRMADO = REGISTROS.find((r) => r.pago_aprobado).id_participante;

const fila = (page, id) => page.locator('tbody tr.expandable-row', { hasText: id });

test.describe('perfil que solo consulta', () => {
  test.beforeEach(async ({ page }) => {
    await prepararPanel(page, { soloLectura: true });
    await irA(page, 'participantes');
  });

  test('no le aparece ningún botón de validar', async ({ page }) => {
    await expect(page.locator('.btn-validar-pago')).toHaveCount(0);
    // Ni «Validar pago» ni «Validar» a secas, que es como se le ofrece a la
    // asamblea: son el mismo botón con dos rótulos.
    await expect(page.getByRole('button', { name: /^Validar/ })).toHaveCount(0);
  });

  test('en la celda del pago sigue leyéndose el estado', async ({ page }) => {
    // Sin el botón, la celda no puede quedarse vacía: un pago pendiente y un
    // dato que no llegó se verían igual.
    await expect(fila(page, PENDIENTE).locator('.celda-accion').first()).toContainText('Pendiente');
    await expect(fila(page, CONFIRMADO).locator('.celda-accion').first()).toContainText('Confirmado');
  });

  test('las filas no se abren, ni con el ratón ni con el teclado', async ({ page }) => {
    await fila(page, PENDIENTE).click();
    await expect(page.locator('.row-details.abierto')).toHaveCount(0);

    // Y no son un control: no reciben foco, así que tabulando no se llega a
    // ellas ni se puede intentar abrirlas con Enter.
    await expect(fila(page, PENDIENTE)).not.toHaveAttribute('tabindex', /.*/);
    await expect(fila(page, PENDIENTE)).not.toHaveAttribute('aria-expanded', /.*/);
  });

  test('el detalle no está en el DOM, así que no hay «Eliminar registro»', async ({ page }) => {
    // No basta con que no se vea: mientras el detalle exista, sus botones son
    // alcanzables y «Eliminar registro» es el más destructivo del panel.
    await expect(page.locator('.row-details')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar registro' })).toHaveCount(0);
  });

  test('la tabla no deja una columna vacía donde iba la flecha', async ({ page }) => {
    await expect(page.locator('thead th')).toHaveCount(7);
    await expect(page.locator('tbody tr.expandable-row').first().locator('td')).toHaveCount(7);
    await expect(page.locator('.celda-desplegar')).toHaveCount(0);
  });

  test('sigue pudiendo consultar: filtros y documentos', async ({ page }) => {
    await expect(page.locator('.btn-documento').first()).toBeVisible();

    // Los filtros son la mitad de para qué sirve mirar el padrón.
    await page.locator('.filter-pill', { hasText: 'Pendientes' }).click();
    await expect(page.locator('.chip-filtro')).toContainText('Pendientes');
  });

  test('la barra lateral dice con qué perfil se entró', async ({ page }) => {
    await expect(page.locator('.sidebar-perfil')).toHaveText(/Solo consulta/i);
    // Y no le pide validar nada, porque no puede.
    await expect(page.locator('.sidebar-aviso')).not.toContainText('Validar ahora');
    await expect(page.locator('.sidebar-aviso')).toContainText('Ver cuáles');
  });
});

test.describe('perfil de administración', () => {
  test.beforeEach(async ({ page }) => {
    await prepararPanel(page);
    await irA(page, 'participantes');
  });

  // La otra mitad de cada afirmación: sin esto, un `solo_lectura` que se
  // quedara pegado en `true` esconderría los botones a todo el mundo y las
  // pruebas de arriba seguirían pasando.
  test('conserva los botones de validar y el detalle desplegable', async ({ page }) => {
    await expect(page.locator('.btn-validar-pago').first()).toBeVisible();
    await expect(page.locator('thead th')).toHaveCount(8);

    await fila(page, PENDIENTE).click();
    const detalle = page.locator('.row-details.abierto');
    await expect(detalle).toHaveCount(1);
    await expect(detalle.getByRole('button', { name: 'Eliminar registro' })).toBeVisible();
  });

  test('y la barra lateral no anuncia ningún perfil', async ({ page }) => {
    await expect(page.locator('.sidebar-perfil')).toHaveCount(0);
    await expect(page.locator('.sidebar-aviso')).toContainText('Validar ahora');
  });
});

/**
 * Lo único que este perfil puede llevarse en un archivo: la asamblea.
 *
 * Se abre el .xlsx descargado en vez de mirar la pantalla porque el fallo aquí
 * sería mudo: el botón seguiría bajando una hoja, con el rótulo correcto, y
 * dentro estaría el padrón entero. Nada en el panel lo delataría.
 */
test.describe('el Excel del perfil que solo consulta', () => {
  /** Pulsa el botón de Excel y devuelve el archivo ya abierto. */
  async function descargar(page) {
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.btn-excel').click(),
    ]);
    const libro = XLSX.read(await readFile(await descarga.path()), { type: 'buffer' });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    return {
      archivo: descarga.suggestedFilename(),
      pestaña: libro.SheetNames[0],
      filas: XLSX.utils.sheet_to_json(hoja, { defval: '' }),
    };
  }

  test('baja la asamblea y nada más, con el padrón entero a la vista', async ({ page }) => {
    await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA, soloLectura: true });
    await irA(page, 'participantes');

    // Sin filtros puestos: en pantalla está el padrón completo.
    await expect(page.locator('.count-badge')).toHaveText(String(REGISTROS_CON_ASAMBLEA.length));

    const { archivo, pestaña, filas } = await descargar(page);

    expect(filas).toHaveLength(ASAMBLEA.length);
    expect(filas.every((f) => f.Perfil === 'Asambleísta Encuadre')).toBe(true);
    // Y la hoja se reconoce como suya: la de la asamblea, no la del padrón.
    expect(pestaña).toBe('Asamblea');
    expect(archivo).toMatch(/^Asamblea_Encuadre_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  test('el rótulo dice qué baja, y cuántos', async ({ page }) => {
    await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA, soloLectura: true });
    await irA(page, 'participantes');

    // La cifra es la de lo que se lleva, no la de lo que se ve: prometer 50 y
    // entregar 3 se lee como un fallo del panel.
    await expect(page.locator('.btn-excel')).toHaveText(
      `Excel de la asamblea (${ASAMBLEA.length})`
    );
  });

  test('sin asambleístas a la vista, el botón no promete nada', async ({ page }) => {
    // Un padrón sin asamblea: no hay nada que este perfil pueda descargar, y
    // el botón lo dice estando apagado en vez de no hacer nada al pulsarlo.
    await prepararPanel(page, { registros: REGISTROS, soloLectura: true });
    await irA(page, 'participantes');

    await expect(page.locator('.btn-excel')).toHaveText('Excel de la asamblea (0)');
    await expect(page.locator('.btn-excel')).toBeDisabled();
  });

  test('a la administración no le cambia nada: se lleva el padrón entero', async ({ page }) => {
    await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
    await irA(page, 'participantes');

    await expect(page.locator('.btn-excel')).toHaveText(
      `Excel (${REGISTROS_CON_ASAMBLEA.length})`
    );

    const { pestaña, filas } = await descargar(page);
    expect(filas).toHaveLength(REGISTROS_CON_ASAMBLEA.length);
    expect(pestaña).toBe('Registros');
  });
});
