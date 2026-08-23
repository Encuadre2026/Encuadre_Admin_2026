/**
 * Quién cuenta como «de la sede», con la misma regla que aplica el alta.
 *
 * El Worker compara el nombre completo de la institución
 * (`institucion.trim() === INSTITUCION_SEDE`) para decidir quién ocupa un lugar
 * reservado. El panel lo resolvía por su cuenta con
 * `institucion.includes('UAA')`, que no es lo mismo: cualquier institución con
 * «UAA» dentro del nombre contaba como local aquí y como foránea allá.
 *
 * Hoy no se nota porque la única entrada de la lista con «UAA» es la sede. Pero
 * el campo `institucion` es texto libre —el Worker no lo valida contra ningún
 * catálogo—, así que basta con que alguien escriba su propia institución para
 * que el panel enseñe un número y la base tenga otro. Y con una sede futura
 * cuyas siglas aparezcan dentro de otro nombre, la discrepancia sería general.
 *
 * El nombre de la sede no se escribe aquí: lo declara la API en
 * `institucion_sede`, porque cambia con cada edición y quien lo sabe es el
 * Worker. El panel muestra; no decide.
 */
export function esDeLaSede(institucion, institucionSede) {
  const nombre = (institucion || '').trim();
  if (!nombre) return false;

  // Respaldo mientras el Worker que declara `institucion_sede` no esté
  // desplegado: se conserva el comportamiento anterior en vez de contar a todo
  // el mundo como foráneo, que vaciaría la gráfica sin avisar. Se puede quitar
  // en cuanto la API lo devuelva en producción.
  if (!institucionSede) return nombre.includes('UAA');

  return nombre === institucionSede.trim();
}

/**
 * Cómo se llama la sede en una gráfica, derivado de su nombre.
 *
 * Los nombres del catálogo vienen como «SIGLAS · Nombre completo», y en una
 * leyenda solo caben las siglas. Estaba escrito «UAA · local» a mano, que es
 * una cuarta copia del nombre de la sede esperando a quedarse vieja.
 */
export function etiquetaSede(institucionSede) {
  if (!institucionSede) return 'Sede · local';
  const siglas = institucionSede.split('·')[0].trim();
  return `${siglas || institucionSede.trim()} · local`;
}

/** Reparte un padrón en las dos bolsas, con la regla de arriba. */
export function repartirPorSede(registros, institucionSede) {
  let sede = 0;
  for (const r of registros) {
    if (esDeLaSede(r.institucion, institucionSede)) sede += 1;
  }
  return { sede, foraneos: registros.length - sede };
}
