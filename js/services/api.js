/**
 * Cliente del backend en Python.
 * Contrato PROPUESTO: confírmalo con el equipo de backend y ajusta aquí.
 * Todas las rutas parten de CONFIG.API_URL.
 */
import { CONFIG } from '../config.js';

const url = (path) => `${CONFIG.API_URL.replace(/\/$/, '')}${path}`;

/**
 * GET /salud → 200 si el servicio responde.
 * La interfaz solo muestra «Conectado» después de esta comprobación.
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  if (!CONFIG.API_URL) return false;
  try {
    const res = await fetch(url('/salud'), { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * POST /simplificar
 * Petición:  { "texto": "Es el proceso con el que las plantas producen azúcares usando la luz." }
 * Respuesta: {
 *   "texto_sencillo": "Las plantas usan la luz para hacer azúcar.",
 *   "palabras_clave": [{ "palabra": "Azúcares", "definicion": "Lo que la planta fabrica…" }],
 *   "animacion_url": null            // opcional · experimental
 * }
 * @param {string} text
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function simplifyText(text, { signal } = {}) {
  const res = await fetch(url('/simplificar'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: text }),
    signal,
  });
  if (!res.ok) throw new Error(`simplifyText: HTTP ${res.status}`);
  return res.json();
}

/**
 * Convierte la respuesta del backend al formato interno del mensaje.
 * @returns {{ simple?: string, terms: {word: string, definition: string}[], animationUrl?: string }}
 */
export function toMessagePatch(res) {
  return {
    simple: res.texto_sencillo || undefined,
    terms: (res.palabras_clave ?? []).map((t) => ({ word: t.palabra, definition: t.definicion })),
    animationUrl: res.animacion_url || undefined,
  };
}

/**
 * WebSocket del laboratorio de señas (CONFIG.RECOGNITION_WS_URL). Experimental.
 *
 * El navegador envía cuadros de la cámara (Blob JPEG) o puntos del cuerpo.
 * El servidor responde con mensajes JSON:
 *   { "tipo": "manos",        "detectadas": true }
 *   { "tipo": "parcial",      "texto": "¿Qué es la…" }
 *   { "tipo": "final",        "texto": "¿Qué es la fotosíntesis?" }
 *   { "tipo": "no_reconocido" }
 *
 * @param {(evt: {type: string, text?: string}) => void} onEvent
 * @param {() => void} onDisconnect
 */
export function connectRecognition(onEvent, onDisconnect) {
  const ws = new WebSocket(CONFIG.RECOGNITION_WS_URL);
  ws.binaryType = 'blob';

  ws.addEventListener('message', ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    const map = {
      manos: () => msg.detectadas && onEvent({ type: 'hands' }),
      parcial: () => onEvent({ type: 'partial', text: msg.texto }),
      final: () => onEvent({ type: 'final', text: msg.texto }),
      no_reconocido: () => onEvent({ type: 'unrecognized' }),
    };
    map[msg.tipo]?.();
  });
  ws.addEventListener('close', onDisconnect);
  ws.addEventListener('error', onDisconnect);

  return {
    send(frame) { if (ws.readyState === WebSocket.OPEN) ws.send(frame); },
    close() { ws.close(); },
  };
}
