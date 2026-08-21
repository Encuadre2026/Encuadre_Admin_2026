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
 *
 * ------------------------------------------------------------
 * Y también el CSS, no solo el JSX
 * ------------------------------------------------------------
 * Este script nació mirando `.js` y `.jsx`, y con eso cerró la mitad del
 * agujero. La otra mitad seguía abierta en `index.css`: `.cupo-badge` tenía su
 * `#2ECC71`, `.toast-info` su `#3498DB` y `.kpi-icon-purple` un `#9B59B6` que
 * ni siquiera era el morado de las gráficas —dos morados distintos a dos
 * pantallas de distancia, sin que nadie lo hubiera decidido—.
 *
 * Dentro de `:root` sí se permite: es justo el sitio donde un color debe estar
 * escrito, y donde el resto del panel va a buscarlo. Y los comentarios del CSS
 * quedan fuera de la revisión: con un color no se pinta nada desde un
 * comentario, y estas mismas notas necesitan poder decir qué valor sustituyó a
 * cuál. En el JS no se hace lo mismo porque distinguir de verdad un comentario
 * de una cadena o de una expresión regular exige un analizador, y no vale la
 * pena para lo que aquí se busca.
 */

const DIRECTORIO = 'src';
const EXTENSIONES = new Set(['.js', '.jsx', '.css']);
const PERMITIDOS = new Set(['#000', '#fff', '#000000', '#ffffff']);
const HEX = /#[0-9A-Fa-f]{3,8}\b/g;

function archivos(directorio) {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return EXTENSIONES.has(extname(ruta)) ? [ruta] : [];
  });
}

/**
 * Las líneas del bloque `:root`, que son las que sí pueden llevar un hex.
 *
 * Se sigue el anidamiento con llaves en vez de buscar el primer `}`: un token
 * declarado después de una función como `rgba(...)` no engaña a esto, y si
 * algún día `:root` contiene una regla anidada, tampoco.
 */
function lineasDeTokens(contenido) {
  const dentro = new Set();
  let profundidad = 0;
  let enTokens = false;

  contenido.split(/\r?\n/).forEach((linea, i) => {
    if (!enTokens && /^\s*:root\b/.test(linea)) enTokens = true;
    if (enTokens) {
      dentro.add(i + 1);
      profundidad += (linea.match(/\{/g) || []).length;
      profundidad -= (linea.match(/\}/g) || []).length;
      if (profundidad <= 0 && linea.includes('}')) {
        enTokens = false;
        profundidad = 0;
      }
    }
  });

  return dentro;
}

/** Vacía los comentarios conservando los saltos, para no mover los números. */
function sinComentarios(contenido) {
  return contenido.replace(/\/\*[\s\S]*?\*\//g, (bloque) =>
    bloque.replace(/[^\n]/g, ' ')
  );
}

const problemas = [];

for (const ruta of archivos(DIRECTORIO)) {
  const original = readFileSync(ruta, 'utf8');
  const esCss = extname(ruta) === '.css';
  const contenido = esCss ? sinComentarios(original) : original;
  const exentas = esCss ? lineasDeTokens(original) : new Set();

  contenido.split(/\r?\n/).forEach((linea, i) => {
    if (exentas.has(i + 1)) return;
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

console.log('Color: sin hex fuera de los tokens, ni en el JSX ni en el CSS.');
