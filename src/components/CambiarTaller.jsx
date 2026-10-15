import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { numeroDeTaller } from '../talleres';
import { esDeLaSede } from '../sede';

/**
 * Los lugares que le quedan a un taller en la bolsa que le toca a esta persona.
 *
 * La sede tiene su reserva y el resto la bolsa general, y el Worker no deja
 * que una invada a la otra. Enseñar el total del taller diría «quedan 4» de un
 * taller cuyos 4 lugares son todos de la sede, a alguien de fuera.
 */
function lugaresPara(cupo, deLaSede) {
  return deLaSede
    ? (cupo.lugares_reservados_uaa ?? 0) - (cupo.inscritos_uaa ?? 0)
    : cupo.cupo_maximo - (cupo.inscritos_general ?? 0);
}

function textoLugares(n) {
  if (n <= 0) return 'sin lugares';
  return n === 1 ? '1 lugar' : `${n} lugares`;
}

/**
 * Pasar a una persona a otro taller.
 *
 * Se ofrecen todos los talleres. Los de registro cerrado admiten el cambio,
 * porque eso detiene al formulario público y no a la coordinación; los que no
 * tienen lugar en la bolsa de esta persona se pueden elegir para leer qué hacer,
 * pero no confirmar. La ventana dice además qué correo va a recibir la persona,
 * porque eso es lo que se ve desde fuera.
 *
 * Se cierra con «Cancelar», con la X o con Escape, pero no al pulsar fuera,
 * igual que el formulario de talleres. Si el Worker rechaza el cambio, el error
 * se enseña aquí sin cerrar.
 */
export default function CambiarTaller({ registro, cupos, institucionSede, volverA, onCambiar, onCerrar }) {
  const [tallerId, setTallerId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');
  const dialogoRef = useRef(null);
  const selectorRef = useRef(null);
  const id = useId();

  const deLaSede = esDeLaSede(registro.institucion, institucionSede);
  const siglasSede = (institucionSede || 'la sede').split('·')[0].trim();
  // El padrón trae el nombre del taller y no su id. Los nombres son únicos en
  // la base, así que el nombre basta para no ofrecer el taller en que ya está.
  const opciones = cupos.filter((c) => c.nombre !== registro.taller);
  const elegido = opciones.find((c) => String(c.id) === tallerId);
  // El Worker no deja pasar a nadie por encima del cupo de su bolsa: la
  // auditoría lo leería como una sobreventa. El taller lleno se puede elegir
  // para leer por qué no, pero no confirmar.
  const lleno = Boolean(elegido) && lugaresPara(elegido, deLaSede) <= 0;

  const [previo] = useState(() => volverA ?? document.activeElement);
  useEffect(() => {
    selectorRef.current?.focus();
    return () => {
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus();
    };
  }, [previo]);

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && !guardando) {
        e.preventDefault();
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !dialogoRef.current) return;
      const enfocables = dialogoRef.current.querySelectorAll(
        'button:not(:disabled), select:not(:disabled)'
      );
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo?.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero?.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [guardando, onCerrar]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!elegido) {
      setErrorServidor('Elige el taller nuevo.');
      selectorRef.current?.focus();
      return;
    }
    if (lleno) return;
    setGuardando(true);
    setErrorServidor('');
    try {
      await onCambiar(registro.id_participante, elegido.id);
    } catch (err) {
      setErrorServidor(err.message || 'No se pudo cambiar el taller.');
      setGuardando(false);
    }
  };

  return createPortal(
    <div className="confirm-overlay taller-overlay">
      <div
        ref={dialogoRef}
        className="card taller-dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
      >
        <div className="taller-dialogo-cabecera">
          <h2 id={`${id}-titulo`} className="taller-dialogo-titulo">
            Cambiar de taller
          </h2>
          <button
            type="button"
            className="btn btn-outline btn-close-modal"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar sin cambiar"
          >
            <X size={20} />
          </button>
        </div>

        <form className="taller-formulario" onSubmit={enviar} noValidate>
          <div className="cambio-persona">
            <p className="cambio-persona-nombre">{registro.nombre}</p>
            <p className="taller-ayuda">
              <span className="cifra">{registro.id_participante}</span> · {registro.institucion}
            </p>
          </div>

          <div className="taller-campo">
            <p className="input-label">Taller actual</p>
            <p className="cambio-taller-actual">{registro.taller}</p>
          </div>

          {errorServidor && (
            <div className="taller-error-servidor" role="alert">
              {errorServidor}
            </div>
          )}

          <div className="taller-campo">
            <label htmlFor={`${id}-taller`} className="input-label">
              Taller nuevo
            </label>
            <select
              ref={selectorRef}
              id={`${id}-taller`}
              className="input-field"
              value={tallerId}
              onChange={(e) => {
                setTallerId(e.target.value);
                setErrorServidor('');
              }}
              disabled={guardando}
              aria-describedby={`${id}-ayuda`}
            >
              <option value="">Elige un taller…</option>
              {opciones.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {`${numeroDeTaller(c.id)}. ${c.nombre} — ${textoLugares(lugaresPara(c, deLaSede))}${
                    c.registro_cerrado ? ' · registro cerrado' : ''
                  }`}
                </option>
              ))}
            </select>
            <p id={`${id}-ayuda`} className="taller-ayuda">
              Los lugares son los {deLaSede ? `reservados a ${siglasSede}` : 'generales'}, que son los
              que le tocan a esta persona.
            </p>
          </div>

          {elegido && (
            <div className="cambio-resumen">
              <p className="cambio-resumen-taller">
                <span className="cifra">{numeroDeTaller(elegido.id)}.</span> {elegido.nombre}
              </p>
              {lleno && (
                <p className="cambio-aviso">
                  No le quedan lugares {deLaSede ? `reservados a ${siglasSede}` : 'generales'}. Si
                  aceptan a una persona más, primero súbele el cupo en Talleres y cupos.
                </p>
              )}
              {elegido.registro_cerrado && (
                <p className="cambio-aviso">
                  Tiene el registro cerrado. Eso detiene el formulario público; desde aquí sí se puede
                  inscribir a alguien.
                </p>
              )}
            </div>
          )}

          <p className="cambio-correo">
            {registro.pago_aprobado
              ? 'Se le enviará de nuevo el correo de confirmación, con el taller nuevo y su código QR.'
              : 'Su pago está pendiente, así que no se le envía ningún correo. Cuando lo apruebes, la confirmación saldrá ya con el taller nuevo.'}
          </p>

          <div className="taller-acciones">
            <button type="button" className="btn btn-outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando || lleno}>
              {guardando ? 'Cambiando…' : 'Cambiar de taller'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
