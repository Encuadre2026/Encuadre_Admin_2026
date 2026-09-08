import { test, expect } from '@playwright/test';
import { irA, prepararPanel } from './apoyo.js';

/**
 * La insignia del cupo decidía su color mirando solo el total de inscritos
 * contra la capacidad total. Pero un cupo son dos bolsas independientes, y con
 * la reserva UAA agotada y hueco general el panel seguía diciendo «Disponible»
 * en verde: quien lo leía concluía que un estudiante de la UAA podía
 * inscribirse, y el alta lo rechazaba.
 */

const cupo = (nombre, { general, uaa }) => ({
  nombre,
  cupo_maximo: 18,
  lugares_reservados_uaa: 10,
  inscritos_general: general,
  inscritos_uaa: uaa,
  inscritos: general + uaa,
});

const CASOS = [
  { titulo: 'con hueco en las dos bolsas', cupo: cupo('Hueco en ambas', { general: 4, uaa: 2 }), insignia: 'Disponible' },
  { titulo: 'con la reserva UAA agotada', cupo: cupo('UAA agotada', { general: 8, uaa: 10 }), insignia: 'Solo general' },
  { titulo: 'con la bolsa general agotada', cupo: cupo('General agotada', { general: 18, uaa: 3 }), insignia: 'Solo UAA' },
  { titulo: 'con las dos agotadas', cupo: cupo('Todo agotado', { general: 18, uaa: 10 }), insignia: 'Lleno' },
];

for (const caso of CASOS) {
  test(`la insignia dice «${caso.insignia}» ${caso.titulo}`, async ({ page }) => {
    await prepararPanel(page, { cupos: [caso.cupo] });
    await irA(page, 'cupos');

    await expect(page.locator('.cupo-badge')).toHaveText(caso.insignia);
  });
}

test('un cupo casi lleno sigue avisando antes de agotarse', async ({ page }) => {
  // 23 de 28 = 82 %, sin que ninguna de las dos bolsas se haya agotado.
  await prepararPanel(page, { cupos: [cupo('Casi lleno', { general: 15, uaa: 8 })] });
  await irA(page, 'cupos');

  await expect(page.locator('.cupo-badge')).toHaveText('Casi lleno');
});

/**
 * La reserva de la sede NO es la misma en todos los talleres.
 *
 * Era un solo número hasta que el comité movió dos lugares de la bolsa de la
 * UAA a la general en «Expedición tipográfica urbana», que reparte 20 y 8 donde
 * los demás reparten 18 y 10. La API lo declara taller por taller en
 * `lugares_reservados_uaa`; el panel muestra, no decide. Esta prueba existe para
 * que nadie vuelva a sustituirlo por una constante: con un 10 escrito a mano,
 * ese taller anunciaría una bolsa que no tiene y su insignia mentiría.
 */
test('dibuja cada taller contra su propia reserva, no contra una fija', async ({ page }) => {
  await prepararPanel(page, {
    cupos: [
      {
        nombre: 'Expedición tipográfica urbana',
        cupo_maximo: 20,
        lugares_reservados_uaa: 8,
        inscritos_general: 18,
        inscritos_uaa: 8,
        inscritos: 26,
      },
    ],
  });
  await irA(page, 'cupos');

  const etiquetas = page.locator('.cupo-progress-label');
  await expect(etiquetas.nth(0)).toContainText('18 / 20');
  // Ocho de ocho es la reserva agotada. Contra el número global serían 8 de 10,
  // con hueco, y la insignia diría «Disponible» en vez de «Solo general».
  await expect(etiquetas.nth(1)).toContainText('8 / 8 · lleno');
  await expect(page.locator('.cupo-badge')).toHaveText('Solo general');
  await expect(page.locator('.cupo-total-de')).toContainText('/ 28');
});

test('la bolsa agotada se distingue de la que solo va llena', async ({ page }) => {
  await prepararPanel(page, { cupos: [cupo('UAA agotada', { general: 8, uaa: 10 })] });
  await irA(page, 'cupos');

  const etiquetas = page.locator('.cupo-progress-label');
  await expect(etiquetas.nth(0)).not.toHaveClass(/saturado/);
  await expect(etiquetas.nth(1)).toHaveClass(/saturado/);
  await expect(etiquetas.nth(1)).toContainText('10 / 10 · lleno');
});
