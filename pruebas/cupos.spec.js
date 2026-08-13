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

test('la bolsa agotada se distingue de la que solo va llena', async ({ page }) => {
  await prepararPanel(page, { cupos: [cupo('UAA agotada', { general: 8, uaa: 10 })] });
  await irA(page, 'cupos');

  const etiquetas = page.locator('.cupo-progress-label');
  await expect(etiquetas.nth(0)).not.toHaveClass(/saturado/);
  await expect(etiquetas.nth(1)).toHaveClass(/saturado/);
  await expect(etiquetas.nth(1)).toContainText('10 / 10 · lleno');
});
