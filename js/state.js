/**
 * Estado único de la aplicación.
 * Los módulos de UI se suscriben y se vuelven a pintar cuando cambia.
 */

/**
 * @typedef {'off'|'asking'|'active'|'paused'|'denied'|'nocam'} CameraStatus
 * @typedef {'simplifying'|'ready'|'error'} SimplifyStatus
 *
 * @typedef {Object} KeyTerm
 * @property {string} word
 * @property {string} definition
 *
 * @typedef {Object} Message
 * @property {string} id
 * @property {'alumno'|'maestro'|'sistema'} author
 * @property {'texto'|'voz'|'rapida'|'lsm'} [via]
 * @property {string} text              Texto original
 * @property {string} time              HH:MM
 * @property {SimplifyStatus} [status]  Solo mensajes del maestro
 * @property {string} [simple]          Español sencillo
 * @property {KeyTerm[]} [terms]        Palabras clave
 * @property {string} [animationUrl]    Animación experimental (opcional)
 */

export const initialState = Object.freeze({
  // Conversación
  messages: /** @type {Message[]} */ ([]),

  // Maestro: borrador y dictado
  draft: '',
  draftError: null, // null | 'long'
  mic: 'off', // 'off' | 'listening' | 'denied'
  micPhase: null, // null | 'speaking' | 'ending'

  // Alumno: lectura
  subtitleMode: 'simple', // 'simple' | 'original'
  largeText: false,

  // Alumno: señas (experimental)
  labOpen: false,
  camera: /** @type {CameraStatus} */ ('off'),
  signPhase: null, // null | 'signing' | 'ending'
  interim: '',

  // Sistema
  online: true,
  toast: null, // { text, tone: 'ok'|'info'|'warn', undo: boolean }
  undoSnapshot: null,
  announcement: { id: 0, text: '' },

  // Demo
  demoOpen: false,
  failNextSimplify: false,
});

/**
 * Crea un almacén mínimo con suscripción.
 * @param {object} initial
 */
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get: () => state,

    /** @param {object|((s: object) => object)} patch */
    set(patch) {
      const prev = state;
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((fn) => fn(state, prev));
    },

    /** @param {(state: object, prev: object) => void} fn */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
