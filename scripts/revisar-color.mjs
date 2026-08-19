import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * Comprueba que los colores del panel vivan solo en los tokens.
 *
 * Los mismos cinco colores estaban escritos a mano treinta y una veces entre el
 * JSX y el CSS: `#2ECC71` en un componente y `--color-success: #2ecc71` en los
 * tokens, con distinta capitalización y sin nada que los mantuviera juntos. No
 * se veían distintos —eran idénticos— pero nada impedía que dejaran de serlo, y
 * cambiar un color de marca obligaba a buscarlos uno por uno.
 *
 * Un linter no puede atrapar esto: `color: '#2ECC71'` es JavaScript
 * perfectamente válido. Así que se revisa aquí.
 *
 * Se permiten el negro y el blanco puros. No son colores de marca: se usan como
 * contraste del texto sobre una superficie ya coloreada, y darles un token no
 * aclararía nada.
 */

const DIRECTORIO = 'src';
const EXTENSIONES = new Set(['.js', '.jsx']);
const PERMITIDOS = new Set(['#000', '#fff', '#000000', '#ffffff']);
const HEX = /#[0-9A-Fa-f]{3,8}\b/g;

function archivos(directorio) {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return EXTENSIONES.has(extname(ruta)) ? [ruta] : [];
  });
}

const problemas = [];

for (const ruta of archivos(DIRECTORIO)) {
  const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/);
  lineas.forEach((linea, i) => {
    for (const hex of linea.match(HEX) || []) {
      if (PERMITIDOS.has(hex.toLowerCase())) continue;
      problemas.push(`${ruta}:${i + 1}  ${hex}`);
    }
  });
}

if (problemas.length > 0) {
  console.error('\nHay colores escritos a mano fuera de los tokens:\n');
  for (const p of problemas) console.error(`  · ${p}`);
  console.error(
    '\nDeclara el color en :root dentro de src/index.css y úsalo como\n' +
      "var(--color-...). Recharts resuelve var() en `fill` y `stroke`, así que\n" +
      'también vale en las gráficas.\n'
  );
  process.exit(1);
}

console.log('Color: sin hex fuera de los tokens.');
