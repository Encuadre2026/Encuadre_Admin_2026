import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  COLORES_TALLER,
  LARGO_MAXIMO_NOMBRE,
  MAX_LUGARES_POR_BOLSA,
  cursivasDeTexto,
  erroresDelTaller,
  normalizar,
  numeroDeTaller,
  tallerParaEnviar,
  trozosDelNombre,
} from '../talleres';

/** El orden en que se revisan los campos, para llevar el foco al primero con error. */
const CAMPOS = ['nombre', 'imparte', 'cursivas', 'cupo_maximo', 'lugares_reservados_uaa'];

/**
 * Agregar o editar un taller.
 *
 * `taller` es el taller tal y como viene en `cupos` —con sus inscritos— o
 * `null` para uno nuevo. `onGuardar` recibe lo que hay que mandar al Worker y
 * lanza el error de la API si no sale; el formulario lo enseña sin cerrarse,
 * para que nadie pierda lo que escribió.
 *
 * Se cierra con «Cancelar», con la X o con Escape, pero NO al pulsar fuera: es
 * un formulario, y un clic desviado no puede tirar lo tecleado. Al cerrarse, el
 * foco vuelve al botón que lo abrió.
 */
export default function FormularioTaller({
  taller,
  idSiguiente,
  reparto,
  otros,
  siglasSede,
  volverA,
  onGuardar,
  onCerrar,
}) {
  const esNuevo = !taller;
  const [borrador, setBorrador] = useState(() => ({
    nombre: taller?.nombre ?? '',
    imparte: taller?.imparte ?? '',
    color: taller?.color ?? 'morado',
    cursivas: (taller?.cursivas ?? []).join(', '),
    cupo_maximo: String(taller?.cupo_maximo ?? reparto.general),
    lugares_reservados_uaa: String(taller?.lugares_reservados_uaa ?? reparto.uaa),
  }));
  // Los errores se enseñan a partir del primer intento de guardar, y desde ahí
  // se corrigen solos mientras se escribe. Enseñarlos antes pondría en rojo
  // un formulario que la persona ni siquiera ha empezado a llenar.
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');

  const dialogoRef = useRef(null);
  const nombreRef = useRef(null);
  const id = useId();
  const idDe = (campo) => `${id}-${campo}`;

  const inscritosGeneral = taller?.inscritos_general ?? 0;
  const inscritosUaa = taller?.inscritos_uaa ?? 0;
  const errores = erroresDelTaller(borrador, { inscritosGeneral, inscritosUaa, otros, siglasSede });
  const visibles = intentado ? errores : {};
  const numero = numeroDeTaller(esNuevo ? idSiguiente : taller.id);

  // El foco entra al abrir y vuelve al cerrar al botón que la abrió. Ese botón
  // llega en `volverA`; el elemento enfocado es solo el respaldo, porque Safari
  // no enfoca un botón al pulsarlo con el ratón.
  const [previo] = useState(() => volverA ?? document.activeElement);
  useEffect(() => {
    nombreRef.current?.focus();
    return () => {
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus();
    };
  }, [previo]);

  // Escape cierra, y Tab no sale de la ventana mientras está abierta.
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && !guardando) {
        e.preventDefault();
        onCerrar();
        return;
      }
      if (e.key !== 'Tab' || !dialogoRef.current) return;
      const enfocables = dialogoRef.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'
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

  const cambiar = (campo) => (e) => {
    setBorrador((b) => ({ ...b, [campo]: e.target.value }));
    setErrorServidor('');
  };

  const enviar = async (e) => {
    e.preventDefault();
    setIntentado(true);
    const primero = CAMPOS.find((campo) => errores[campo]);
    if (primero) {
      document.getElementById(idDe(primero))?.focus();
      return;
    }
    setGuardando(true);
    setErrorServidor('');
    try {
      await onGuardar(tallerParaEnviar(borrador, taller?.id));
    } catch (err) {
      setErrorServidor(err.message || 'No se pudo guardar el taller.');
      setGuardando(false);
    }
  };

  /** Ayuda y error de un campo, enlazados con aria-describedby. */
  const descritoPor = (campo, conAyuda = true) =>
    [conAyuda ? `${idDe(campo)}-ayuda` : null, visibles[campo] ? `${idDe(campo)}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const mensajeDeError = (campo) =>
    visibles[campo] ? (
      <p id={`${idDe(campo)}-error`} className="taller-campo-error">
        {visibles[campo]}
      </p>
    ) : null;

  const nombreVista = normalizar(borrador.nombre);
  const imparteVista = normalizar(borrador.imparte);
  const general = Number(borrador.cupo_maximo) || 0;
  const uaa = Number(borrador.lugares_reservados_uaa) || 0;

  return createPortal(
    <div className="confirm-overlay taller-overlay">
      <div
        ref={dialogoRef}
        className="card taller-dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDe('titulo')}
      >
        <div className="taller-dialogo-cabecera">
          <h2 id={idDe('titulo')} className="taller-dialogo-titulo">
            {esNuevo ? 'Agregar taller' : `Editar el taller ${numero}`}
          </h2>
          <button
            type="button"
            className="btn btn-outline btn-close-modal"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar sin guardar"
          >
            <X size={20} />
          </button>
        </div>

        <form className="taller-formulario" onSubmit={enviar} noValidate>
          {errorServidor && (
            <div className="taller-error-servidor" role="alert">
              {errorServidor}
            </div>
          )}

          <div className="taller-campo">
            <label htmlFor={idDe('nombre')} className="input-label">
              Nombre del taller
            </label>
            <textarea
              ref={nombreRef}
              id={idDe('nombre')}
              className="input-field taller-campo-nombre"
              rows={3}
              maxLength={LARGO_MAXIMO_NOMBRE}
              value={borrador.nombre}
              onChange={cambiar('nombre')}
              // Un salto de línea en el nombre no significa nada —el Worker lo
              // convierte en espacio—, así que Enter guarda, como en una casilla.
              onKeyDown={(e) => {
                // Mientras se compone una letra con un teclado que lo necesita, Enter
                // confirma esa letra, no el formulario.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              aria-invalid={Boolean(visibles.nombre)}
              aria-describedby={descritoPor('nombre')}
            />
            <p id={`${idDe('nombre')}-ayuda`} className="taller-ayuda">
              Tal como aparecerá en el formulario, en los correos y en el gafete.{' '}
              <span className="cifra">
                {borrador.nombre.length} / {LARGO_MAXIMO_NOMBRE}
              </span>
            </p>
            {mensajeDeError('nombre')}
          </div>

          <div className="taller-campo">
            <label htmlFor={idDe('imparte')} className="input-label">
              Quién lo imparte <span className="taller-opcional">(opcional)</span>
            </label>
            <input
              id={idDe('imparte')}
              className="input-field"
              type="text"
              value={borrador.imparte}
              onChange={cambiar('imparte')}
              aria-invalid={Boolean(visibles.imparte)}
              aria-describedby={descritoPor('imparte', false)}
            />
            {mensajeDeError('imparte')}
          </div>

          <fieldset className="taller-campo taller-colores">
            <legend className="input-label">Color del renglón «Imparte»</legend>
            <div className="taller-colores-opciones">
              {COLORES_TALLER.map((c) => (
                <label key={c.valor} className="taller-color">
                  <input
                    type="radio"
                    name={idDe('color')}
                    value={c.valor}
                    checked={borrador.color === c.valor}
                    onChange={cambiar('color')}
                  />
                  <span className={`taller-muestra taller-muestra--${c.valor}`} aria-hidden="true" />
                  {c.nombre}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="taller-campo">
            <label htmlFor={idDe('cursivas')} className="input-label">
              Partes del nombre en cursiva <span className="taller-opcional">(opcional)</span>
            </label>
            <input
              id={idDe('cursivas')}
              className="input-field"
              type="text"
              value={borrador.cursivas}
              onChange={cambiar('cursivas')}
              aria-invalid={Boolean(visibles.cursivas)}
              aria-describedby={descritoPor('cursivas')}
            />
            <p id={`${idDe('cursivas')}-ayuda`} className="taller-ayuda">
              Por ejemplo, las palabras en inglés. Escríbelas igual que en el nombre y
              sepáralas con comas.
            </p>
            {mensajeDeError('cursivas')}
          </div>

          <div className="taller-lugares">
            <div className="taller-campo">
              <label htmlFor={idDe('cupo_maximo')} className="input-label">
                Lugares generales
              </label>
              <input
                id={idDe('cupo_maximo')}
                className="input-field cifra"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_LUGARES_POR_BOLSA}
                step={1}
                value={borrador.cupo_maximo}
                onChange={cambiar('cupo_maximo')}
                aria-invalid={Boolean(visibles.cupo_maximo)}
                aria-describedby={descritoPor('cupo_maximo')}
              />
              <p id={`${idDe('cupo_maximo')}-ayuda`} className="taller-ayuda">
                Para cualquier institución.
                {esNuevo ? '' : ` Inscritos: ${inscritosGeneral}.`}
              </p>
              {mensajeDeError('cupo_maximo')}
            </div>

            <div className="taller-campo">
              <label htmlFor={idDe('lugares_reservados_uaa')} className="input-label">
                Lugares para la {siglasSede}
              </label>
              <input
                id={idDe('lugares_reservados_uaa')}
                className="input-field cifra"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_LUGARES_POR_BOLSA}
                step={1}
                value={borrador.lugares_reservados_uaa}
                onChange={cambiar('lugares_reservados_uaa')}
                aria-invalid={Boolean(visibles.lugares_reservados_uaa)}
                aria-describedby={descritoPor('lugares_reservados_uaa')}
              />
              <p id={`${idDe('lugares_reservados_uaa')}-ayuda`} className="taller-ayuda">
                Solo para la {siglasSede}.{esNuevo ? '' : ` Inscritos: ${inscritosUaa}.`}
              </p>
              {mensajeDeError('lugares_reservados_uaa')}
            </div>
          </div>

          <p className="taller-total">
            En total, <strong className="cifra">{general + uaa}</strong>{' '}
            {general + uaa === 1 ? 'lugar' : 'lugares'}.
          </p>

          {/* Cómo queda en el formulario de registro, que es lo que más cuesta
              imaginar: las cursivas y el color no se ven en ninguna otra parte
              del panel. */}
          <div className="taller-vista">
            <p className="rotulo-seccion">Así se verá en el registro</p>
            <div className="taller-vista-renglon">
              <span className="cifra">{numero}. </span>
              {nombreVista ? (
                trozosDelNombre(nombreVista, cursivasDeTexto(borrador.cursivas)).map((t, i) =>
                  t.cursiva ? <em key={i}>{t.texto}</em> : <span key={i}>{t.texto}</span>
                )
              ) : (
                <span className="taller-vista-vacio">Nombre del taller</span>
              )}
              {imparteVista && (
                <span className={`taller-vista-imparte taller-muestra-texto--${borrador.color}`}>
                  Imparte: {imparteVista}
                </span>
              )}
            </div>
          </div>

          <div className="taller-acciones">
            <button type="button" className="btn btn-outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : esNuevo ? 'Agregar taller' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
