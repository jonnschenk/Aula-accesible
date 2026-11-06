/**
 * Valores derivados del estado. Funciones puras, sin DOM.
 */

/** Mensajes del maestro, del más reciente al más antiguo. */
function teacherMessages(state) {
  return state.messages.filter((m) => m.author === 'maestro').reverse();
}

export const getLastTeacherMessage = (state) => teacherMessages(state)[0] ?? null;

export const isListening = (state) => state.mic === 'listening';
export const isSigning = (state) => state.signPhase === 'signing' || state.signPhase === 'ending';

/** Texto que ve el alumno para un mensaje, según el modo elegido. */
function readable(message, mode) {
  if (!message) return '';
  if (mode === 'original' || !message.simple) return message.text;
  return message.simple;
}

/**
 * Línea de estado bajo «Alumno»: quién tiene la palabra.
 * @returns {{ text: string, live: boolean }}
 */
export function getStatus(state) {
  const last = getLastTeacherMessage(state);
  if (isListening(state)) {
    return { text: state.micPhase === 'ending' ? 'El maestro terminó de hablar' : 'El maestro está hablando', live: true };
  }
  if (last?.status === 'simplifying') return { text: 'Simplificando el mensaje…', live: true };
  if (state.draft.trim()) return { text: 'El maestro está escribiendo…', live: true };
  if (isSigning(state)) return { text: 'Estás señando…', live: true };
  if (last) return { text: `Último mensaje a las ${last.time}`, live: false };
  return { text: 'Esperando al maestro', live: false };
}

/**
 * Subtítulos del alumno.
 * @returns {{ label: string, current: string, previous: string, live: boolean, empty: boolean,
 *             terms: import('./state.js').KeyTerm[], animationUrl: string|null }}
 */
export function getCaptions(state) {
  const [last, before] = teacherMessages(state);
  const mode = state.subtitleMode;
  const base = { previous: '', live: false, empty: false, terms: [], animationUrl: null };

  if (isListening(state)) {
    return {
      ...base,
      label: 'En vivo',
      current: state.draft || 'Escuchando…',
      previous: readable(last, mode),
      live: true,
    };
  }

  if (!last) {
    return { ...base, label: 'Subtítulos', current: 'Aquí aparecerá lo que dice el maestro, en español sencillo.', empty: true };
  }

  const ready = last.status === 'ready';
  let label = 'Español sencillo';
  if (mode === 'original') label = 'Texto original';
  else if (last.status === 'simplifying') label = 'Simplificando…';
  else if (last.status === 'error') label = 'Texto original · no se pudo simplificar';
  else if (!last.simple) label = 'Texto original';

  return {
    ...base,
    label,
    current: readable(last, mode),
    previous: readable(before, mode),
    terms: ready ? (last.terms ?? []) : [],
    animationUrl: ready ? (last.animationUrl ?? null) : null,
  };
}

/** Estado de la cámara del laboratorio de señas. */
export function getCameraView(state) {
  if (state.camera === 'denied' || state.camera === 'nocam') return 'unavailable';
  return state.camera; // off | asking | active | paused
}

export const CAMERA_ERRORS = {
  denied: 'Sin permiso para la cámara',
  nocam: 'No encontramos una cámara',
};
