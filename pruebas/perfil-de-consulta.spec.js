import { test, expect } from '@playwright/test';
import { irA, prepararPanel, REGISTROS } from './apoyo.js';

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

  test('sigue pudiendo consultar: filtros, documentos y Excel', async ({ page }) => {
    await expect(page.locator('.btn-excel')).toBeVisible();
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
