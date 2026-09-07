/**
 * Quién es de la asamblea de ENCUADRE.
 *
 * Sus altas entran por `POST /api/asamblea` y viven en la misma tabla que
 * todo el mundo, porque el día del evento necesitan lo mismo que cualquier
 * asistente: QR, gafete y control de acceso, y todo eso resuelve por
 * `id_participante`.
 *
 * Se reconocen por el perfil y no por su taller. `registros.taller_id` es NOT
 * NULL, así que la migración 0005 tuvo que inventar un taller centinela —«Sin
 * taller · Asamblea», con id negativo para que ninguna consulta de cupo lo
 * confunda con uno real— donde apoyar a quien no lleva taller. Ese taller es
 * un apaño de la base de datos, no algo que exista en el congreso: el perfil
 * es lo que la persona es.
 *
 * La cadena tiene que decir lo mismo que `PERFIL_ASAMBLEA` en
 * `backend/src/validacion.ts`, que es quien la escribe en la base. El panel
 * muestra; no decide.
 */
export const PERFIL_ASAMBLEA = 'Asambleísta Encuadre';

/** Si este registro es de la asamblea. */
export function esAsamblea(registro) {
  return registro?.perfil === PERFIL_ASAMBLEA;
}
