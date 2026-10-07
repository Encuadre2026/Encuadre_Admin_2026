import { test, expect } from '@playwright/test';
import { CUPOS, irA, prepararPanel } from './apoyo.js';

/**
 * Abrir y cerrar el registro de un taller.
 *
 * Un taller cerrado no admite inscripciones nuevas aunque le queden lugares, y
 * quien ya está inscrito conserva el suyo. Se cambia con un botón en la fila y
 * una confirmación, no con el formulario de edición: no toca ningún dato del
 * taller.
 */

const dialogo = (page) => page.getByRole('dialog');
const fila = (page, nombre) => page.locator('.cupo-fila').filter({ hasText: nombre });

/** Los talleres de siempre, con los ids de `cerrados` ya cerrados. */
const conCerrados = (...cerrados) =>
  CUPOS.map((c) => ({ ...c, registro_cerrado: cerrados.includes(c.id) }));

test('cerrarlo pide confirmación, manda el id y avisa', async ({ page }) => {
  let cerrados = [];
  const { cambiosDeRegistro } = await prepararPanel(page, {
    cupos: () => conCerrados(...cerrados),
    alRegistro: ({ cuerpo }) => {
      cerrados = cuerpo.registro_cerrado ? [cuerpo.id] : [];
      return { status: 200, json: { ok: true } };
    },
  });
  await irA(page, 'cupos');

  await fila(page, 'Futurología').getByRole('button', { name: /^Cerrar el registro/ }).click();
  await expect(dialogo(page)).toContainText('Cerrar el registro');
  await expect(dialogo(page)).toContainText(
    '«Futurología aplicada al diseño» dejará de aceptar inscripciones nuevas'
  );
  await expect(dialogo(page)).toContainText('conservan su lugar');
  await dialogo(page).getByRole('button', { name: 'Cerrar registro' }).click();

  await expect(page.locator('.toast')).toContainText(
    'Registro de «Futurología aplicada al diseño» cerrado'
  );
  expect(cambiosDeRegistro).toEqual([{ metodo: 'PUT', cuerpo: { id: 8, registro_cerrado: true } }]);

  // La fila lo dice, y el mismo botón ahora lo abre. El foco vuelve a él.
  await expect(fila(page, 'Futurología').locator('.cupo-badge')).toHaveText('Registro cerrado');
  const abrir = fila(page, 'Futurología').getByRole('button', { name: /^Abrir el registro/ });
  await expect(abrir).toHaveText('Abrir registro');
  await expect(abrir).toBeFocused();
  await expect(page.locator('.page-header-contexto')).toContainText('1 con el registro cerrado');
});

test('un taller cerrado lo dice y se puede abrir', async ({ page }) => {
  const { cambiosDeRegistro } = await prepararPanel(page, { cupos: conCerrados(9) });
  await irA(page, 'cupos');

  const disruptive = fila(page, 'Disruptive');
  await expect(disruptive.locator('.cupo-badge')).toHaveText('Registro cerrado');
  await expect(disruptive.locator('.cupo-nota')).toHaveText(
    'No acepta inscripciones nuevas. Quienes ya están inscritos conservan su lugar.'
  );
  // Los inscritos siguen siendo los de verdad.
  await expect(disruptive.locator('.cupo-stat-value')).toHaveText('9');

  await disruptive.getByRole('button', { name: /^Abrir el registro/ }).click();
  await expect(dialogo(page)).toContainText('volverá a aceptar inscripciones');
  await dialogo(page).getByRole('button', { name: 'Abrir registro' }).click();

  expect(cambiosDeRegistro).toEqual([{ metodo: 'PUT', cuerpo: { id: 9, registro_cerrado: false } }]);
});

test('cancelar no manda nada y el foco vuelve al botón', async ({ page }) => {
  const { cambiosDeRegistro } = await prepararPanel(page);
  await irA(page, 'cupos');

  const boton = fila(page, 'Futurología').getByRole('button', { name: /^Cerrar el registro/ });
  await boton.click();
  await expect(dialogo(page)).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(dialogo(page)).toHaveCount(0);
  await expect(boton).toBeFocused();
  expect(cambiosDeRegistro).toHaveLength(0);
});

test('si la API lo rechaza, lo dice y la fila no cambia', async ({ page }) => {
  await prepararPanel(page, {
    alRegistro: () => ({
      status: 404,
      json: {
        ok: false,
        codigo: 'NO_ENCONTRADO',
        mensaje: 'Ese taller ya no existe. Recarga el panel.',
      },
    }),
  });
  await irA(page, 'cupos');

  await fila(page, 'Futurología').getByRole('button', { name: /^Cerrar el registro/ }).click();
  await dialogo(page).getByRole('button', { name: 'Cerrar registro' }).click();

  await expect(page.locator('.toast')).toContainText('Ese taller ya no existe');
  await expect(dialogo(page)).toHaveCount(0);
  await expect(fila(page, 'Futurología').locator('.cupo-badge')).not.toHaveText('Registro cerrado');
});

// Si la contraseña se cambió con el panel abierto, la API responde 401: el panel
// tiene que llevar al login, igual que al guardar o eliminar.
test('una sesión caducada al cerrarlo lleva al login', async ({ page }) => {
  await prepararPanel(page, {
    alRegistro: () => ({
      status: 401,
      json: { ok: false, codigo: 'NO_AUTORIZADO', mensaje: 'No autorizado.' },
    }),
  });
  await irA(page, 'cupos');

  await fila(page, 'Futurología').getByRole('button', { name: /^Cerrar el registro/ }).click();
  await dialogo(page).getByRole('button', { name: 'Cerrar registro' }).click();

  await expect(page).toHaveURL(/#\/login/);
});

test('quien solo consulta lo ve cerrado, pero no puede abrirlo', async ({ page }) => {
  await prepararPanel(page, { cupos: conCerrados(9), soloLectura: true });
  await irA(page, 'cupos');

  await expect(fila(page, 'Disruptive').locator('.cupo-badge')).toHaveText('Registro cerrado');
  await expect(page.getByRole('button', { name: /el registro del taller/ })).toHaveCount(0);
});

// La API anterior no manda `registro_cerrado`, y su ruta no existe.
test('con la API anterior no se ofrece', async ({ page }) => {
  const sinMarca = CUPOS.map((c) => {
    const copia = { ...c };
    delete copia.registro_cerrado;
    return copia;
  });
  await prepararPanel(page, { cupos: sinMarca });
  await irA(page, 'cupos');

  await expect(page.getByRole('button', { name: /el registro del taller/ })).toHaveCount(0);
  await expect(fila(page, 'Futurología').getByRole('button', { name: /^Editar/ })).toBeVisible();
});

test('el tablero también lo dice', async ({ page }) => {
  await prepararPanel(page, { cupos: conCerrados(8) });
  await irA(page, 'dashboard');

  await expect(
    page.locator('.taller-insignia').filter({ hasText: 'Registro cerrado' })
  ).toHaveCount(1);
});
