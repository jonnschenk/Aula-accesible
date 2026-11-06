/**
 * Controlador: toda la lógica de la app.
 * La UI solo llama acciones de aquí y pinta el estado; nunca cambia el estado directo.
 */
import { CONFIG } from './config.js';
import { initialState } from './state.js';
import { isListening, isSigning } from './selectors.js';
import { nowHHMM, uid, copyText } from './utils/dom.js';
import * as api from './services/api.js';
import * as camera from './services/camera.js';
import * as speech from './services/speech.js';
import * as demo from './services/demo.js';
import { QUICK_REPLIES } from './data/quick-replies.js';
import { EXAMPLE_CONVERSATION, DICTATION_SCRIPT, SIGN_SCRIPT, SIMPLIFIED } from './data/demo-data.js';

/**
 * @param {ReturnType<import('./state.js').createStore>} store
 * @param {{ cameraVideo: HTMLVideoElement }} media
 */
export function createController(store, { cameraVideo }) {
  const { get, set } = store;
  const timers = { toast: 0, signEnd: 0, micEnd: 0 };
  let cancelSigns = null;
  let cancelDictation = null;
  let cancelPermission = null;
  let recognition = null;
  let signIndex = 0;
  let dictationIndex = 0;

  // ------------------------------------------------------------------------
  // Utilidades internas
  // ------------------------------------------------------------------------

  /** Anuncio para lectores de pantalla (región aria-live). */
  function announce(text) {
    set((s) => ({ announcement: { id: s.announcement.id + 1, text } }));
  }

  function showToast(text, tone = 'info', { undo = false, ms = 4000 } = {}) {
    clearTimeout(timers.toast);
    set({ toast: { text, tone, undo } });
    announce(text);
    timers.toast = setTimeout(() => set({ toast: null, undoSnapshot: null }), ms);
  }

  function addMessage(message) {
    const full = { id: uid(), time: nowHHMM(), ...message };
    set((s) => ({ messages: [...s.messages, full] }));
    return full.id;
  }

  function updateMessage(id, patch) {
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }

  // ------------------------------------------------------------------------
  // Maestro: escribir, dictar y simplificar
  // ------------------------------------------------------------------------

  function setDraft(text) {
    const patch = { draft: text };
    if (get().draftError === 'long' && text.length <= CONFIG.MAX_MESSAGE_LENGTH) patch.draftError = null;
    set(patch);
  }

  /**
   * Envía un mensaje del maestro y pide la versión sencilla.
   * @param {string} [text]  si se omite, usa el borrador
   * @param {'texto'|'voz'} [via]
   */
  async function sendTeacherMessage(text, via = 'texto') {
    const s = get();
    const content = (text ?? s.draft).trim();
    if (!content || (text === undefined && isListening(s))) return;
    if (content.length > CONFIG.MAX_MESSAGE_LENGTH) {
      set({ draftError: 'long' });
      return;
    }

    const id = addMessage({ author: 'maestro', via, text: content, status: 'simplifying' });
    if (text === undefined) set({ draft: '', draftError: null });
    await simplify(id, content);
  }

  async function simplify(id, text) {
    if (!get().online) {
      updateMessage(id, { status: 'error' });
      return;
    }
    try {
      let res;
      if (CONFIG.DEMO_MODE) {
        const fail = get().failNextSimplify;
        set({ failNextSimplify: false });
        res = await demo.simulateSimplify(text, SIMPLIFIED, { fail });
      } else {
        res = await api.simplifyText(text);
      }
      const patch = api.toMessagePatch(res);
      updateMessage(id, { ...patch, status: 'ready' });
      announce(`Mensaje del maestro: ${patch.simple ?? text}`);
    } catch (err) {
      updateMessage(id, { status: 'error' });
      announce('No se pudo simplificar. El alumno ve el texto original.');
      if (err instanceof TypeError) set({ online: false }); // fallo de red
    }
  }

  /** @param {HTMLElement} [button]  botón con data-message-id */
  function retrySimplify(button) {
    const message = get().messages.find((m) => m.id === button?.dataset.messageId);
    if (!message) return;
    updateMessage(message.id, { status: 'simplifying' });
    simplify(message.id, message.text);
  }

  // ---- Dictado --------------------------------------------------------------

  function toggleMic() {
    if (isListening(get())) finishDictation();
    else startDictation();
  }

  function startDictation() {
    stopDictation();
    set({ mic: 'listening', micPhase: 'speaking', draft: '', draftError: null });
    announce('Micrófono activo. El alumno ve el texto mientras hablas.');

    const handlers = {
      onPartial: (text) => {
        clearTimeout(timers.micEnd);
        set({ draft: text, micPhase: 'speaking' });
      },
      onSilence: () => {
        set({ micPhase: 'ending' });
        timers.micEnd = setTimeout(finishDictation, CONFIG.AUTO_SEND_DELAY_MS);
      },
      onError: (reason) => {
        stopDictation();
        set({ mic: reason === 'denied' ? 'denied' : 'off', micPhase: null });
        announce(reason === 'denied' ? 'Sin permiso para el micrófono.' : 'Se interrumpió el dictado.');
      },
    };

    if (CONFIG.DEMO_MODE) {
      const phrase = DICTATION_SCRIPT[dictationIndex % DICTATION_SCRIPT.length];
      dictationIndex += 1;
      cancelDictation = demo.simulateDictation(phrase, handlers);
    } else if (speech.isSupported()) {
      cancelDictation = speech.startDictation(handlers);
    } else {
      set({ mic: 'off', micPhase: null });
      showToast('Tu navegador no permite dictar. Usa Chrome o escribe el mensaje.', 'warn');
    }
  }

  function stopDictation() {
    cancelDictation?.();
    cancelDictation = null;
    clearTimeout(timers.micEnd);
  }

  /** Termina el dictado y envía lo dicho (botón Detener o silencio). */
  function finishDictation() {
    stopDictation();
    const text = get().draft.trim();
    set({ mic: 'off', micPhase: null, draft: '' });
    if (text) sendTeacherMessage(text, 'voz');
    else announce('Micrófono apagado.');
  }

  // ------------------------------------------------------------------------
  // Alumno: responder
  // ------------------------------------------------------------------------

  /** @returns {boolean} true si se envió */
  function sendQuickReply(id) {
    const reply = QUICK_REPLIES.find((r) => r.id === id);
    if (!reply) return false;
    addMessage({ author: 'alumno', via: 'rapida', text: reply.text });
    announce(`Enviado al maestro: ${reply.text}`);
    return true;
  }

  /** @returns {boolean} true si se envió */
  function sendStudentText(text) {
    const content = text.trim();
    if (!content) return false;
    addMessage({ author: 'alumno', via: 'texto', text: content });
    announce('Mensaje enviado al maestro.');
    return true;
  }

  function setSubtitleMode(mode) {
    set({ subtitleMode: mode });
    announce(mode === 'original' ? 'Mostrando el texto original.' : 'Mostrando español sencillo.');
  }

  function toggleLargeText() {
    set((s) => ({ largeText: !s.largeText }));
  }

  // ------------------------------------------------------------------------
  // Alumno: señas (experimental)
  // ------------------------------------------------------------------------

  function toggleLab() {
    if (get().labOpen) {
      cameraOff();
      set({ labOpen: false });
    } else {
      set({ labOpen: true });
      announce('Responder con señas, experimental. Enciende la cámara para empezar.');
    }
  }

  async function cameraOn() {
    set({ camera: 'asking' });
    announce('Esperando permiso de la cámara.');

    if (CONFIG.DEMO_MODE) {
      cancelPermission = demo.simulateCameraPermission(() => {
        set({ camera: 'active' });
        announce('Cámara activa.');
      });
      return;
    }

    try {
      await camera.start(cameraVideo);
      set({ camera: 'active' });
      announce('Cámara activa.');
      startRecognition();
    } catch (err) {
      const status = camera.errorToStatus(err);
      set({ camera: status });
      announce(status === 'denied' ? 'Sin permiso para la cámara.' : 'No encontramos una cámara.');
    }
  }

  /** Apaga la cámara al cerrar el laboratorio: no se queda grabando. */
  function cameraOff() {
    stopSigning();
    cancelPermission?.();
    recognition?.close();
    recognition = null;
    camera.stop();
    set({ camera: 'off', signPhase: null, interim: '' });
  }

  function cameraTogglePause() {
    const { camera: status } = get();
    if (status === 'active') {
      stopSigning();
      camera.setPaused(true);
      set({ camera: 'paused', signPhase: null, interim: '' });
      announce('Cámara en pausa.');
    } else if (status === 'paused') {
      camera.setPaused(false);
      set({ camera: 'active' });
      announce('Cámara activa.');
    }
  }

  /** Eventos del reconocimiento (mismos en demo y producción). */
  function handleRecognition(evt) {
    const s = get();
    if (s.camera !== 'active') return;

    switch (evt.type) {
      case 'hands':
        if (!isSigning(s)) set({ signPhase: 'signing', interim: '' });
        break;
      case 'partial':
        set({ signPhase: 'signing', interim: evt.text });
        break;
      case 'final':
        set({ signPhase: 'ending', interim: evt.text });
        announce(`Entendimos: ${evt.text}. Se enviará en un momento.`);
        scheduleSignCommit(evt.text);
        break;
      case 'unrecognized':
        set({ signPhase: 'ending', interim: '' });
        scheduleSignCommit(null);
        break;
      default:
        break;
    }
  }

  /** Envío automático después de revisar (se puede descartar). */
  function scheduleSignCommit(text) {
    clearTimeout(timers.signEnd);
    timers.signEnd = setTimeout(() => {
      set({ signPhase: null, interim: '' });
      if (text) {
        addMessage({ author: 'alumno', via: 'lsm', text });
      } else {
        showToast('No reconocimos las señas. Usa una respuesta rápida o escribe.', 'warn');
      }
    }, CONFIG.AUTO_SEND_DELAY_MS);
  }

  function stopSigning() {
    cancelSigns?.();
    cancelSigns = null;
    clearTimeout(timers.signEnd);
  }

  function discardSigns() {
    stopSigning();
    set({ signPhase: null, interim: '' });
    announce('Se descartó la interpretación.');
  }

  function startRecognition() {
    if (!CONFIG.RECOGNITION_WS_URL) return;
    recognition?.close();
    recognition = api.connectRecognition(handleRecognition, () => set({ online: false }));
    camera.streamFrames(cameraVideo, (frame) => recognition?.send(frame));
  }

  // ------------------------------------------------------------------------
  // Conversación y sistema
  // ------------------------------------------------------------------------

  async function copyConversation() {
    const label = { maestro: 'Maestro', alumno: 'Alumno', sistema: 'Aviso' };
    const text = get().messages.map((m) => `[${m.time}] ${label[m.author]}: ${m.text}`).join('\n');
    const ok = await copyText(text);
    showToast(ok ? 'Conversación copiada.' : 'No se pudo copiar.', ok ? 'ok' : 'warn');
  }

  function clearConversation() {
    const { messages } = get();
    if (!messages.length) return;
    set({ messages: [], undoSnapshot: { messages } });
    showToast('Conversación borrada.', 'info', { undo: true, ms: 8000 });
  }

  function undo() {
    const snapshot = get().undoSnapshot;
    if (!snapshot) return;
    clearTimeout(timers.toast);
    set({ ...snapshot, undoSnapshot: null, toast: null });
    announce('Recuperamos la conversación.');
  }

  function closeToast() {
    clearTimeout(timers.toast);
    set({ toast: null });
  }

  async function reconnect() {
    const ok = CONFIG.DEMO_MODE ? true : await api.checkHealth();
    set({ online: ok });
    announce(ok ? 'Conexión recuperada.' : 'Seguimos sin conexión.');
  }

  function reset() {
    stopDictation();
    cameraOff();
    clearTimeout(timers.toast);
    signIndex = 0;
    dictationIndex = 0;
    set({ ...initialState, announcement: { id: get().announcement.id + 1, text: 'Demostración reiniciada.' } });
  }

  // ------------------------------------------------------------------------
  // Controles de demostración
  // ------------------------------------------------------------------------

  function simulateSigns(fail) {
    set({ labOpen: true, camera: 'active' });
    stopSigning();
    const reply = QUICK_REPLIES.find((r) => r.id === SIGN_SCRIPT[signIndex % SIGN_SCRIPT.length]);
    if (!fail) signIndex += 1;
    cancelSigns = demo.simulateSigns(reply.text, { fail }, handleRecognition);
  }

  const demoActions = {
    example: () => {
      reset();
      set({
        messages: EXAMPLE_CONVERSATION.map((m) => ({
          id: uid(),
          ...m,
          ...(m.author === 'maestro'
            ? { ...api.toMessagePatch(SIMPLIFIED[m.text] ?? {}), status: 'ready' }
            : {}),
        })),
      });
    },
    dictation: startDictation,
    signs: () => simulateSigns(false),
    'signs-fail': () => simulateSigns(true),
    'mic-denied': () => { stopDictation(); set({ mic: 'denied', micPhase: null, draft: '' }); },
    'camera-denied': () => { stopSigning(); set({ labOpen: true, camera: 'denied', signPhase: null, interim: '' }); },
    offline: () => { stopDictation(); set({ online: false, mic: 'off', micPhase: null }); },
    reset,
  };

  // ------------------------------------------------------------------------
  // Arranque
  // ------------------------------------------------------------------------

  async function init() {
    if (!CONFIG.DEMO_MODE && CONFIG.API_URL) {
      set({ online: await api.checkHealth() });
    }
  }

  return {
    init,
    /** Acciones de botones con data-action="…". Reciben el botón pulsado. */
    actions: {
      'toggle-mic': toggleMic,
      'retry-simplify': retrySimplify,
      'toggle-large-text': toggleLargeText,
      'toggle-lab': toggleLab,
      'camera-on': cameraOn,
      'camera-toggle-pause': cameraTogglePause,
      'discard-signs': discardSigns,
      'copy-conversation': copyConversation,
      'clear-conversation': clearConversation,
      undo,
      'close-toast': closeToast,
      reconnect,
    },
    setDraft,
    sendTeacherMessage: () => sendTeacherMessage(),
    sendQuickReply,
    sendStudentText,
    setSubtitleMode,
    demo: demoActions,
    setFailNextSimplify: (value) => set({ failNextSimplify: value }),
    toggleDemo: (open) => set((s) => ({ demoOpen: open ?? !s.demoOpen })),
  };
}
