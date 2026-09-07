import { test, expect } from '@playwright/test';
import { irA, prepararPanel, ASAMBLEA, REGISTROS_CON_ASAMBLEA } from './apoyo.js';

/**
 * Filtrar por lo que la gente es.
 *
 * A la asamblea solo se llegaba por el desplegable de talleres, eligiendo «Sin
 * taller · Asamblea». Eso pedía dos cosas raras a la vez: buscar a unas
 * personas en la lista de talleres, y saber que se esconden detrás de un
 * taller que no existe —un centinela de la base de datos, inventado porque
 * `registros.taller_id` no admite nulos—.
 *
 * Ahora hay un grupo de perfil junto a los de pago e institución, y el
 * desplegable vuelve a ofrecer solo talleres de verdad.
 */

const TALLER_CENTINELA = 'Sin taller · Asamblea';

test('el desplegable de talleres ya no ofrece un taller que no existe', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');

  const opciones = await page.locator('#filter-taller option').allTextContents();

  expect(opciones).not.toContain(TALLER_CENTINELA);
  // Y no se ha llevado por delante a los talleres de verdad.
  expect(opciones).toContain('Futurología aplicada al diseño');
});

test('la pastilla de la asamblea deja en la tabla solo a la asamblea', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');

  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();

  await expect(page.locator('tbody tr.expandable-row')).toHaveCount(ASAMBLEA.length);
  await expect(page.locator('.count-badge')).toHaveText(
    `${ASAMBLEA.length} de ${REGISTROS_CON_ASAMBLEA.length}`
  );
});

test('el perfil puesto se ve entre los filtros y se quita solo', async ({ page }) => {
  await prepararPanel(page, { registros: REGISTROS_CON_ASAMBLEA });
  await irA(page, 'participantes');

  await page.getByRole('button', { name: 'Asambleísta Encuadre' }).click();
  const chip = page.locator('.chip-filtro', { hasText: 'Perfil' });
  await expect(chip).toHaveText(/Asambleísta Encuadre/);

  // Quitado el filtro, vuelve el padrón entero: la cifra del título pierde el
  // «de», que es como dice que ya no está enseñando un trozo. La tabla no se
  // cuenta aquí porque la paginación solo pinta las primeras veinticinco.
  await chip.click();
  await expect(page.locator('.chip-filtro')).toHaveCount(0);
  await expect(page.locator('.count-badge')).toHaveText(String(REGISTROS_CON_ASAMBLEA.length));
});

test('los perfiles salen del padrón, no de una lista escrita a mano', async ({ page }) => {
  // Un perfil que hoy no existe: si las pastillas estuvieran escritas en el
  // código, esta prueba no lo vería aparecer.
  const inventado = { ...REGISTROS_CON_ASAMBLEA[0], id_participante: 'XXX-999', perfil: 'Invitado de honor' };
  await prepararPanel(page, { registros: [...REGISTROS_CON_ASAMBLEA, inventado] });
  await irA(page, 'participantes');

  const grupo = page.getByRole('group', { name: 'Filtrar por perfil' });
  await expect(grupo.getByRole('button', { name: 'Invitado de honor' })).toBeVisible();
  await expect(grupo.getByRole('button', { name: 'Asambleísta Encuadre' })).toBeVisible();
});
