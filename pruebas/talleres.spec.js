import { test, expect } from '@playwright/test';
import { CUPOS, irA, prepararPanel } from './apoyo.js';

/**
 * Los talleres se agregan, se editan y se eliminan desde «Talleres y cupos».
 *
 * Lo que se vigila es lo que no se ve mirando la pantalla quieta: qué se le
 * manda a la API, que el formulario avise antes de mandar algo que la API va a
 * rechazar —y que, si lo rechaza igual, lo enseñe sin tirar lo escrito—, que
 * no se pueda eliminar un taller con gente dentro, y el recorrido del foco.
 */

const dialogo = (page) => page.getByRole('dialog');
const fila = (page, nombre) => page.locator('.cupo-fila').filter({ hasText: nombre });

test('quien solo consulta no ve ni agregar, ni editar, ni eliminar', async ({ page }) => {
  await prepararPanel(page, { soloLectura: true });
  await irA(page, 'cupos');

  await expect(page.locator('.cupo-fila')).toHaveCount(CUPOS.length);
  await expect(page.getByRole('button', { name: 'Agregar taller' })).toHaveCount(0);
  await expect(page.locator('.cupo-acciones')).toHaveCount(0);
});

test('numera cada taller con su id más uno, como el formulario de registro', async ({ page }) => {
  await prepararPanel(page);
  await irA(page, 'cupos');

  await expect(page.locator('.cupo-indice')).toHaveText(['01', '09', '10', '14', '18']);
  await expect(fila(page, 'Futurología')).toContainText('Imparte: Fabián Bautista Saucedo');
});

test('#/talleres lleva a la misma pantalla', async ({ page }) => {
  await prepararPanel(page);
  await irA(page, 'talleres');
  await expect(page.locator('.page-header h1')).toHaveText('Talleres y cupos');
});

test('agregar manda el taller completo y limpio, y avisa al terminar', async ({ page }) => {
  const { peticiones } = await prepararPanel(page, {
    alTaller: ({ cuerpo }) => ({ status: 201, json: { ok: true, taller: { ...cuerpo, id: 18 } } }),
  });
  await irA(page, 'cupos');

  await page.getByRole('button', { name: 'Agregar taller' }).click();
  await expect(dialogo(page)).toBeVisible();
  // El foco entra en el primer campo, y el taller nuevo se numera al final.
  await expect(page.getByLabel('Nombre del taller')).toBeFocused();
  await expect(dialogo(page).getByRole('heading')).toHaveText('Agregar taller');
  await expect(dialogo(page).locator('.taller-vista-renglon')).toContainText('19.');

  // Parte del reparto que tienen casi todos.
  await expect(page.getByLabel('Lugares generales')).toHaveValue('18');
  await expect(page.getByLabel('Lugares para la UAA')).toHaveValue('10');

  await page.getByLabel('Nombre del taller').fill('  Tipografía   para pantallas pequeñas ');
  await page.getByLabel('Quién lo imparte').fill('Mtra. Ana Pérez');
  await page.getByLabel('Azul').check();
  await page.getByLabel('Partes del nombre en cursiva').fill('pantallas');
  await page.getByLabel('Lugares generales').fill('12');
  await page.getByLabel('Lugares para la UAA').fill('6');

  // La vista previa enseña la cursiva y el color antes de guardar.
  await expect(dialogo(page).locator('.taller-vista-renglon em')).toHaveText('pantallas');
  await expect(dialogo(page).locator('.taller-vista-imparte')).toHaveCSS('color', 'rgb(96, 165, 250)');
  await expect(dialogo(page)).toContainText('En total, 18 lugares.');

  await dialogo(page).getByRole('button', { name: 'Agregar taller' }).click();

  await expect(dialogo(page)).toHaveCount(0);
  expect(peticiones).toHaveLength(1);
  expect(peticiones[0]).toEqual({
    metodo: 'POST',
    cuerpo: {
      nombre: 'Tipografía para pantallas pequeñas',
      imparte: 'Mtra. Ana Pérez',
      color: 'azul',
      cursivas: ['pantallas'],
      cupo_maximo: 12,
      lugares_reservados_uaa: 6,
    },
  });
  await expect(page.locator('.toast')).toContainText('Taller «Tipografía para pantallas pequeñas» agregado');
});

test('editar parte de lo guardado y manda el id', async ({ page }) => {
  const { peticiones } = await prepararPanel(page);
  await irA(page, 'cupos');

  await fila(page, 'Disruptive').getByRole('button', { name: /^Editar/ }).click();
  await expect(dialogo(page).getByRole('heading')).toHaveText('Editar el taller 10');
  await expect(page.getByLabel('Nombre del taller')).toHaveValue('Disruptive Design Method');
  await expect(page.getByLabel('Quién lo imparte')).toHaveValue('Fernanda Romo, EdgeHub Neouniversidad');
  await expect(page.getByLabel('Morado')).toBeChecked();
  await expect(page.getByLabel('Partes del nombre en cursiva')).toHaveValue('Disruptive Design Method');

  await page.getByLabel('Quién lo imparte').fill('Fernanda Romo');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(dialogo(page)).toHaveCount(0);
  expect(peticiones[0].metodo).toBe('PUT');
  expect(peticiones[0].cuerpo).toMatchObject({ id: 9, imparte: 'Fernanda Romo', cupo_maximo: 18 });
});

// Lo que la API va a rechazar se dice al escribir, junto al campo, y no llega
// a mandarse. El foco va al primer campo con el problema.
test('avisa en el campo y no manda nada que la API vaya a rechazar', async ({ page }) => {
  const { peticiones } = await prepararPanel(page);
  await irA(page, 'cupos');

  // Futurología tiene 10 personas de fuera y 4 de la UAA.
  await fila(page, 'Futurología').getByRole('button', { name: /^Editar/ }).click();
  await page.getByLabel('Lugares generales').fill('9');
  await page.getByLabel('Partes del nombre en cursiva').fill('Bauhaus');
  await page.getByLabel('Nombre del taller').fill('Taller de poesía objetual');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  const nombre = page.getByLabel('Nombre del taller');
  await expect(nombre).toBeFocused();
  await expect(nombre).toHaveAttribute('aria-invalid', 'true');
  await expect(dialogo(page)).toContainText('Ya hay un taller con ese nombre.');
  await expect(dialogo(page)).toContainText('«Bauhaus» no aparece en el nombre');
  await expect(dialogo(page)).toContainText('Ya hay 10 personas inscritas aquí: no puede quedar en menos.');
  expect(peticiones).toHaveLength(0);

  // Los errores se corrigen solos al escribir.
  await nombre.fill('Futurología aplicada al diseño');
  await expect(dialogo(page)).not.toContainText('Ya hay un taller con ese nombre.');
});

test('si la API lo rechaza igual, lo enseña sin cerrar ni borrar lo escrito', async ({ page }) => {
  await prepararPanel(page, {
    alTaller: () => ({
      status: 409,
      json: {
        ok: false,
        codigo: 'CUPO_MENOR_QUE_INSCRITOS',
        mensaje: 'No se pueden dejar menos lugares que personas inscritas: ya hay 12 en los lugares generales.',
      },
    }),
  });
  await irA(page, 'cupos');

  await fila(page, 'Futurología').getByRole('button', { name: /^Editar/ }).click();
  await page.getByLabel('Lugares generales').fill('11');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(dialogo(page).getByRole('alert')).toContainText('ya hay 12 en los lugares generales');
  await expect(page.getByLabel('Lugares generales')).toHaveValue('11');
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
});

test('Escape cierra sin guardar y el foco vuelve al botón que lo abrió', async ({ page }) => {
  const { peticiones } = await prepararPanel(page);
  await irA(page, 'cupos');

  const editar = fila(page, 'Futurología').getByRole('button', { name: /^Editar/ });
  await editar.click();
  await page.getByLabel('Nombre del taller').fill('Algo que no se guarda');
  await page.keyboard.press('Escape');

  await expect(dialogo(page)).toHaveCount(0);
  await expect(editar).toBeFocused();
  expect(peticiones).toHaveLength(0);
});

test('el Tab no se sale de la ventana', async ({ page }) => {
  await prepararPanel(page);
  await irA(page, 'cupos');

  await page.getByRole('button', { name: 'Agregar taller' }).click();
  // Una vuelta entera, y un poco más.
  for (let i = 0; i < 16; i++) await page.keyboard.press('Tab');
  const dentro = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[role="dialog"]'))
  );
  expect(dentro).toBe(true);
});

test('un taller con gente inscrita no se elimina: se explica por qué', async ({ page }) => {
  const { peticiones } = await prepararPanel(page);
  await irA(page, 'cupos');

  const eliminar = fila(page, 'Disruptive').getByRole('button', { name: /^Eliminar/ });
  await eliminar.click();
  await expect(dialogo(page)).toContainText('Este taller no se puede eliminar');
  await expect(dialogo(page)).toContainText('tiene 9 personas inscritas');
  await expect(dialogo(page).getByRole('button', { name: 'Eliminar taller' })).toHaveCount(0);

  await dialogo(page).getByRole('button', { name: 'Entendido' }).click();
  // El foco vuelve al botón que abrió el aviso, también en Safari.
  await expect(eliminar).toBeFocused();
  expect(peticiones).toHaveLength(0);
});

test('un taller vacío se elimina después de confirmarlo', async ({ page }) => {
  const { peticiones } = await prepararPanel(page);
  await irA(page, 'cupos');

  // Expedición tipográfica urbana no tiene a nadie en la fixture.
  await fila(page, 'Expedición').getByRole('button', { name: /^Eliminar/ }).click();
  await expect(dialogo(page)).toContainText('¿Eliminar «Expedición tipográfica urbana»?');
  await dialogo(page).getByRole('button', { name: 'Eliminar taller' }).click();

  await expect(page.locator('.toast')).toContainText('Taller «Expedición tipográfica urbana» eliminado');
  expect(peticiones).toEqual([{ metodo: 'DELETE', cuerpo: { id: 17 } }]);
});

// Una ventana con formulario en una pantalla estrecha o baja —un teléfono, o la
// letra ampliada— tiene que poder recorrerse entera sin sacar nada de la vista.
for (const { ancho, alto } of [
  { ancho: 240, alto: 600 },
  { ancho: 320, alto: 568 },
  { ancho: 1280, alto: 600 },
]) {
  test(`el formulario cabe a ${ancho}×${alto} y se llega a los botones`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    await prepararPanel(page);
    await irA(page, 'cupos');
    await page.getByRole('button', { name: 'Agregar taller' }).click();

    const medidas = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]').getBoundingClientRect();
      return { izquierda: d.left, derecha: d.right, ventana: window.innerWidth, documento: document.documentElement.scrollWidth };
    });
    expect(medidas.izquierda).toBeGreaterThanOrEqual(0);
    expect(medidas.derecha).toBeLessThanOrEqual(medidas.ventana);
    expect(medidas.documento).toBeLessThanOrEqual(medidas.ventana);

    const guardar = dialogo(page).getByRole('button', { name: 'Agregar taller' });
    await guardar.scrollIntoViewIfNeeded();
    await expect(guardar).toBeInViewport();
    const caja = await guardar.boundingBox();
    expect(caja.height).toBeGreaterThanOrEqual(44);
  });
}

// La casilla del nombre compartía clase con el nombre de cada taller en el
// dashboard, que lleva `white-space: nowrap` y `flex: 1 1 12rem`: en escritorio
// salía de 192 px de alto y un nombre largo no se partía en renglones.
test('un nombre largo se lee entero en la casilla, en tres renglones', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await prepararPanel(page);
  await irA(page, 'cupos');
  await fila(page, 'Didácticas').getByRole('button', { name: /^Editar/ }).click();

  const casilla = page.getByLabel('Nombre del taller');
  const medida = await casilla.evaluate((t) => ({
    alto: t.getBoundingClientRect().height,
    contenido: t.scrollHeight,
    visible: t.clientHeight,
    partido: getComputedStyle(t).whiteSpace,
  }));
  expect(medida.partido).not.toBe('nowrap');
  expect(medida.alto).toBeLessThan(120);
  expect(medida.contenido).toBeLessThanOrEqual(medida.visible + 1);
});

test('con un solo taller, la cabecera dice «1 taller»', async ({ page }) => {
  await prepararPanel(page, { cupos: [CUPOS[0]] });
  await irA(page, 'cupos');
  await expect(page.locator('.page-header-contexto')).toContainText(/^1 taller ·/);
});

// La fila se va con el taller, y con ella el botón que abrió la confirmación.
test('tras eliminar, el foco queda en el titular y no al principio del documento', async ({ page }) => {
  let cupos = CUPOS;
  await prepararPanel(page, {
    cupos: () => cupos,
    alTaller: ({ cuerpo }) => {
      cupos = CUPOS.filter((c) => c.id !== cuerpo.id);
      return { status: 200, json: { ok: true, id: cuerpo.id } };
    },
  });
  await irA(page, 'cupos');

  await fila(page, 'Expedición').getByRole('button', { name: /^Eliminar/ }).click();
  await dialogo(page).getByRole('button', { name: 'Eliminar taller' }).click();

  await expect(fila(page, 'Expedición')).toHaveCount(0);
  await expect(page.locator('.page-header h1')).toBeFocused();
});

// Si la contraseña se cambió con el panel abierto, guardar responde 401: el
// panel tiene que llevar al login, no quedarse en un formulario que ya no puede
// guardar nada.
test('una sesión caducada al guardar lleva al login', async ({ page }) => {
  await prepararPanel(page, {
    alTaller: () => ({ status: 401, json: { ok: false, codigo: 'NO_AUTORIZADO', mensaje: 'No autorizado.' } }),
  });
  await irA(page, 'cupos');

  await fila(page, 'Futurología').getByRole('button', { name: /^Editar/ }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(page).toHaveURL(/#\/login/);
});
