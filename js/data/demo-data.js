/**
 * Datos de demostración (ficticios). Se usan solo con CONFIG.DEMO_MODE.
 * En producción, la simplificación y las palabras clave vienen del backend.
 */

/**
 * Respuestas simuladas del servicio de simplificación, por texto original.
 * Misma forma que la respuesta de POST /simplificar.
 */
export const SIMPLIFIED = {
  'Hoy vamos a ver la fotosíntesis.': {
    texto_sencillo: 'Hoy vamos a estudiar la fotosíntesis.',
    palabras_clave: [
      { palabra: 'Fotosíntesis', definicion: 'Cómo las plantas hacen su alimento usando la luz del sol.' },
    ],
  },
  'Es el proceso con el que las plantas producen azúcares usando la luz.': {
    texto_sencillo: 'Las plantas usan la luz para hacer azúcar.',
    palabras_clave: [
      { palabra: 'Proceso', definicion: 'Pasos que pasan en orden.' },
      { palabra: 'Azúcares', definicion: 'Lo que la planta fabrica para tener energía.' },
    ],
  },
  'Muy bien. Ahora pongan atención al pizarrón.': {
    texto_sencillo: 'Muy bien. Ahora mira el pizarrón.',
    palabras_clave: [],
  },
  'Las plantas absorben agua por la raíz y dióxido de carbono por las hojas.': {
    texto_sencillo: 'La planta toma agua por la raíz. Por las hojas toma un gas del aire.',
    palabras_clave: [
      { palabra: 'Absorber', definicion: 'Tomar algo y meterlo, como una esponja con el agua.' },
      { palabra: 'Raíz', definicion: 'Parte de la planta que está bajo la tierra.' },
      { palabra: 'Dióxido de carbono', definicion: 'Un gas del aire. Las plantas lo usan para crecer.' },
    ],
  },
};

/** Clase de ejemplo. */
export const EXAMPLE_CONVERSATION = [
  { author: 'maestro', via: 'texto', text: 'Hoy vamos a ver la fotosíntesis.', time: '10:02' },
  { author: 'alumno', via: 'rapida', text: 'Tengo una pregunta.', time: '10:02' },
  { author: 'alumno', via: 'texto', text: '¿Qué es la fotosíntesis?', time: '10:02' },
  { author: 'maestro', via: 'voz', text: 'Es el proceso con el que las plantas producen azúcares usando la luz.', time: '10:03' },
];

/** Frases que «dicta» el maestro simulado, en orden. */
export const DICTATION_SCRIPT = [
  'Muy bien. Ahora pongan atención al pizarrón.',
  'Las plantas absorben agua por la raíz y dióxido de carbono por las hojas.',
];

/** Respuestas rápidas que «reconoce» la cámara simulada, en orden (ids). */
export const SIGN_SCRIPT = ['despacio', 'repetir', 'entendi'];
