/**
 * Simuladores del modo demostración.
 * Emiten los MISMOS eventos que los servicios reales, así el controlador
 * no distingue entre demo y producción.
 */
import { CONFIG } from '../config.js';

/** Simula que el navegador concede el permiso de la cámara. */
export function simulateCameraPermission(onGranted) {
  const t = setTimeout(onGranted, CONFIG.DEMO.CAMERA_PERMISSION_MS);
  return () => clearTimeout(t);
}

/**
 * Simula el reconocimiento de señas: manos → parcial (palabra a palabra) → final.
 * Experimental: en el producto solo se reconocen las respuestas rápidas.
 * @param {string} phrase
 * @param {{ fail?: boolean }} options
 * @param {(evt: object) => void} emit  mismos eventos que services/api.connectRecognition
 * @returns {() => void} cancelar
 */
export function simulateSigns(phrase, { fail = false }, emit) {
  const words = phrase.split(' ');
  let i = 0;
  emit({ type: 'hands' });

  const timer = setInterval(() => {
    i += 1;
    if (!fail && i <= words.length) {
      emit({ type: 'partial', text: words.slice(0, i).join(' ') });
      return;
    }
    if (fail && i < 3) return;
    clearInterval(timer);
    emit(fail ? { type: 'unrecognized' } : { type: 'final', text: phrase });
  }, CONFIG.DEMO.SIGN_WORD_MS);

  return () => clearInterval(timer);
}

/**
 * Simula el dictado: el texto crece palabra a palabra y luego hay silencio.
 * @param {string} phrase
 * @param {{ onPartial: (t: string) => void, onSilence: () => void }} handlers
 * @returns {() => void} cancelar
 */
export function simulateDictation(phrase, { onPartial, onSilence }) {
  const words = phrase.split(' ');
  let i = 0;
  const timer = setInterval(() => {
    i += 1;
    if (i <= words.length) {
      onPartial(words.slice(0, i).join(' '));
      return;
    }
    clearInterval(timer);
    onSilence();
  }, CONFIG.DEMO.DICTATION_WORD_MS);
  return () => clearInterval(timer);
}

/**
 * Simula POST /simplificar. Solo conoce los textos de ejemplo; para cualquier
 * otro texto responde sin versión sencilla (el alumno ve el original).
 * @param {Record<string, object>} examples
 */
export function simulateSimplify(text, examples, { fail = false } = {}) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (fail) reject(new Error('demo: simplificación fallida'));
      else resolve(examples[text] ?? { texto_sencillo: null, palabras_clave: [] });
    }, CONFIG.DEMO.SIMPLIFY_MS);
  });
}
