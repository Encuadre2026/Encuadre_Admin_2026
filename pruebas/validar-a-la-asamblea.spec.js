import { test, expect } from '@playwright/test';
import { irA, prepararPanel, REGISTROS_CON_ASAMBLEA } from './apoyo.js';

/**
 * Validar no es cobrar.
 *
 * Quien representa a una universidad ante la asamblea no paga cuota: su alta
 * entra por `POST /api/asamblea`, que no pasa por el reparto de cupos ni por el
 * pago. Lo que la organización revisa y aprueba en su caso es el oficio que la
 * acredita como representante.
 *
 * El Worker ya lo trataba así —le manda otro correo y responde «Acreditación
 * aprobada»—; el panel le ofrecía «Validar pago» y le preguntaba si confirmaba
 * «el pago» de alguien que no paga.
 */

/** ASA-002 es el único de la asamblea con la aprobación pendiente. */
const PENDIENTE = 'ASA-002';

test.beforeEach(async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');
});

const fila = (page, id) => page.locator('tbody tr.expandable-row', { hasText: id });

test('a quien no paga se le ofrece «Validar» a secas', async ({ page }) => {
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();

  const boton = fila(page, PENDIENTE).locator('.btn-validar-pago');
  await expect(boton).toHaveText('Validar');
  await expect(boton).toHaveAttribute('title', 'Validar la acreditación');
});

test('a quien sí paga se le sigue ofreciendo «Validar pago»', async ({ page }) => {
  await page.getByRole('button', { name: 'Estudiante' }).click();

  await expect(page.locator('.btn-validar-pago').first()).toHaveText('Validar pago');
});

test('la confirmación no habla de un pago que nadie hizo', async ({ page }) => {
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();
  await fila(page, PENDIENTE).locator('.btn-validar-pago').click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo.locator('.confirm-title')).toHaveText('Aprobar acreditación');
  await expect(dialogo.locator('.confirm-message')).toContainText('la acreditación del participante ASA-002');
  await expect(dialogo).not.toContainText('pago');

  // Y lo que se anuncia al terminar tampoco.
  await dialogo.getByRole('button', { name: 'Aprobar acreditación' }).click();
  await expect(page.locator('.toast')).toContainText('Acreditación de ASA-002 aprobada correctamente');
});

test('su documento es el oficio que lo acredita, no una credencial', async ({ page }) => {
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();

  const documento = fila(page, PENDIENTE).locator('.btn-documento.credencial');
  await expect(documento).toHaveText('Oficio');
  await expect(documento).toHaveAttribute('title', 'Ver el oficio de acreditación');

  // Al resto del padrón le sigue apareciendo su credencial de estudiante.
  await page.getByRole('button', { name: 'Estudiante' }).click();
  await expect(page.locator('.btn-documento.credencial').first()).toHaveText('Credencial');
});

test('el detalle desplegado dice lo mismo que la fila', async ({ page }) => {
  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();
  await fila(page, PENDIENTE).click();

  const acciones = page.locator('.row-details.abierto .detail-actions');
  await expect(acciones.getByRole('button', { name: 'Aprobar acreditación' })).toBeVisible();
  await expect(acciones.getByRole('button', { name: 'Aprobar pago' })).toHaveCount(0);
});
