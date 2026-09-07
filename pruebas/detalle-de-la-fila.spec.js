import { test, expect } from '@playwright/test';
import { irA, prepararPanel, REGISTROS_CON_ASAMBLEA } from './apoyo.js';

/**
 * Lo que se ve al desplegar una fila.
 *
 * Los campos eran seis, fijos, y se pintaban aunque no tuvieran nada dentro: a
 * un asambleísta le salían la CURP y el teléfono en blanco, que su formulario
 * ni siquiera le pide. Y al revés, sus ocho respuestas no aparecían en ninguna
 * pantalla del panel.
 */

/** Rótulos del detalle ya abierto, en orden. */
async function rotulos(page) {
  return page.locator('.row-details.abierto .detail-item label').allTextContents();
}

async function desplegarPrimera(page) {
  await page.locator('tbody tr.expandable-row').first().click();
  await expect(page.locator('.row-details.abierto')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');
});

test('a un asambleísta no se le enseñan los campos que no se le piden', async ({ page }) => {
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();
  await desplegarPrimera(page);

  const puestos = await rotulos(page);

  // Su formulario no pide CURP ni teléfono: el Worker los guarda vacíos.
  expect(puestos).not.toContain('CURP');
  expect(puestos).not.toContain('Teléfono');
  // Y su taller es el centinela «Sin taller · Asamblea», que no es un taller.
  expect(puestos).not.toContain('Taller');

  // Lo que sí contestó, que hasta ahora no se veía en ninguna pantalla.
  expect(puestos).toEqual([
    'Correo', 'Fecha de Registro', 'Institución', 'Programa académico',
    'Representante', 'Asiste al Encuentro', 'Hotel', 'Viaja con alumnos',
    'Número de alumnos', 'Interés en talleres', 'Taller de preferencia',
  ]);
  await expect(page.locator('.row-details.abierto')).toContainText('Diseño Gráfico');
});

test('lo que esa persona no contestó tampoco se pinta en blanco', async ({ page }) => {
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();
  // ASA-003 no asiste al Encuentro, y a partir de ahí el formulario deja de
  // preguntar: hotel, alumnos e interés se quedan en null.
  await page.locator('tbody tr.expandable-row', { hasText: 'ASA-003' }).click();
  await expect(page.locator('.row-details.abierto')).toBeVisible();

  const puestos = await rotulos(page);

  expect(puestos).toContain('Asiste al Encuentro');
  expect(puestos).not.toContain('Hotel');
  expect(puestos).not.toContain('Viaja con alumnos');
  expect(puestos).not.toContain('Número de alumnos');
  expect(puestos).not.toContain('Taller de preferencia');
});

test('al resto del padrón no le cambia nada', async ({ page }) => {
  await page.getByRole('button', { name: 'Estudiante' }).click();
  await desplegarPrimera(page);

  expect(await rotulos(page)).toEqual([
    'CURP', 'Teléfono', 'Correo', 'Fecha de Registro', 'Institución', 'Taller',
  ]);
});

test('el detalle abierto no se corta por abajo', async ({ page }) => {
  // Se abría hasta un `max-height` de 300 px escrito a mano. Con trece campos
  // —o con seis en una sola columna— lo que pasaba de ahí desaparecía sin
  // avisar, y no hay nada en pantalla que diga que falta algo.
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();
  await desplegarPrimera(page);

  const cabe = async () =>
    page.locator('.row-details.abierto').evaluate(
      (el) => el.getBoundingClientRect().height >= el.firstElementChild.scrollHeight
    );
  await expect.poll(cabe).toBe(true);

  // Y también en el ancho de un teléfono, donde la rejilla es de una columna.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(cabe).toBe(true);
});
