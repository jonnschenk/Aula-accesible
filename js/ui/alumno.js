/**
 * Panel del alumno: estado, subtítulos, palabras clave, señas y respuestas.
 */
import { CONFIG } from '../config.js';
import { $, $$, autosize, showView } from '../utils/dom.js';
import { CAMERA_ERRORS, getCameraView, getCaptions, getStatus, isSigning } from '../selectors.js';
import { QUICK_REPLIES } from '../data/quick-replies.js';

const SENT_FEEDBACK_MS = 1200;

/**
 * @param {HTMLElement} root  sección del panel del alumno
 * @param {ReturnType<import('../state.js').createStore>} store
 * @param {ReturnType<import('../controller.js').createController>} controller
 */
export function initAlumno(root, store, controller) {
  const el = {
    statusPulse: $('[data-status-pulse]', root),
    statusText: $('[data-status-text]', root),
    modeButtons: $$('[data-subtitle-mode]', root),
    largeButton: $('[data-action="toggle-large-text"]', root),

    captionsLabel: $('[data-captions-label]', root),
    captionsPrevious: $('[data-captions-previous]', root),
    captionsCurrent: $('[data-captions-current]', root),
    captionsVideo: $('[data-captions-video]', root),
    captionsPlayer: $('[data-captions-video-player]', root),

    terms: $('[data-terms]', root),
    termsList: $('[data-terms-list]', root),

    lab: $('[data-lab]', root),
    cameraVideo: $('[data-camera-video]', root),
    cameraViews: $$('[data-camera-view]', root),
    cameraChip: $('[data-camera-chip]', root),
    cameraError: $('[data-camera-error]', root),
    cameraStart: $('[data-camera-start]', root),
    cameraPause: $('[data-camera-pause]', root),
    labResult: $('[data-lab-result]', root),
    labResultLabel: $('[data-lab-result-label]', root),
    labResultText: $('[data-lab-result-text]', root),
    labProgress: $('[data-lab-progress]', root),
    labToggle: $('.composer [data-action="toggle-lab"]', root),

    replies: $('[data-replies]', root),
    writer: $('[data-writer]', root),
    writerInput: $('[data-writer-input]', root),
    writerSend: $('[data-writer-send]', root),
  };

  // ---- Respuestas rápidas (se crean una sola vez) ----------------------------
  el.replies.replaceChildren(...QUICK_REPLIES.map((reply) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'replies__button';
    button.textContent = reply.label;
    button.addEventListener('click', () => {
      if (!controller.sendQuickReply(reply.id)) return;
      button.dataset.sent = '';
      setTimeout(() => delete button.dataset.sent, SENT_FEEDBACK_MS);
    });
    li.append(button);
    return li;
  }));

  // ---- Eventos ----------------------------------------------------------------
  el.modeButtons.forEach((button) => {
    button.addEventListener('click', () => controller.setSubtitleMode(button.dataset.subtitleMode));
  });

  const sendWriter = () => {
    if (controller.sendStudentText(el.writerInput.value)) {
      el.writerInput.value = '';
      updateWriter();
    }
  };
  const updateWriter = () => {
    autosize(el.writerInput);
    el.writerSend.disabled = !el.writerInput.value.trim();
  };
  el.writerInput.addEventListener('input', updateWriter);
  el.writerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendWriter();
    }
  });
  el.writer.addEventListener('submit', (event) => {
    event.preventDefault();
    sendWriter();
  });

  // ---- Pintado ----------------------------------------------------------------

  function renderHeader(s) {
    const status = getStatus(s);
    el.statusText.textContent = status.text;
    el.statusPulse.hidden = !status.live;
    el.modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.subtitleMode === s.subtitleMode)));
    el.largeButton.setAttribute('aria-pressed', String(s.largeText));
  }

  function renderCaptions(s) {
    const c = getCaptions(s);
    el.captionsLabel.textContent = c.label;
    el.captionsPrevious.textContent = c.previous;
    el.captionsPrevious.hidden = !c.previous;
    el.captionsCurrent.textContent = c.current;
    el.captionsCurrent.className = [
      'captions__current',
      s.largeText && !c.empty ? 'captions__current--large' : '',
      c.empty ? 'captions__current--empty' : '',
      c.live ? 'captions__current--live' : '',
    ].filter(Boolean).join(' ');
    // Mientras habla, el texto cambia muy seguido: no se anuncia palabra por palabra
    el.captionsCurrent.setAttribute('aria-live', c.live ? 'off' : 'polite');

    // Animación experimental: solo si el servicio la entregó
    el.captionsVideo.hidden = !c.animationUrl;
    if (c.animationUrl && el.captionsPlayer.getAttribute('src') !== c.animationUrl) {
      el.captionsPlayer.src = c.animationUrl;
    }

    renderTerms(c.terms);
  }

  function renderTerms(terms) {
    el.terms.hidden = !terms.length;
    el.termsList.replaceChildren(...terms.map((term) => {
      const li = document.createElement('li');
      li.className = 'terms__item';
      const word = document.createElement('p');
      word.className = 'terms__word';
      word.textContent = term.word;
      const definition = document.createElement('p');
      definition.className = 'terms__definition';
      definition.textContent = term.definition;
      li.append(word, definition);
      return li;
    }));
  }

  function renderLab(s, prev) {
    el.lab.hidden = !s.labOpen;
    el.labToggle.setAttribute('aria-pressed', String(s.labOpen));
    if (s.labOpen && prev && !prev.labOpen) el.lab.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (!s.labOpen) return;

    const view = getCameraView(s);
    showView(el.cameraViews, 'data-camera-view', view);
    el.cameraVideo.hidden = view !== 'active' || !el.cameraVideo.srcObject;
    el.cameraError.textContent = CAMERA_ERRORS[s.camera] ?? '';
    el.cameraChip.textContent = s.signPhase === 'signing' ? 'Manos detectadas' : `En vivo${CONFIG.DEMO_MODE ? ' · simulado' : ''}`;

    const on = s.camera === 'active' || s.camera === 'paused';
    el.cameraStart.hidden = on || s.camera === 'asking';
    el.cameraStart.textContent = s.camera === 'denied' || s.camera === 'nocam' ? 'Intentar de nuevo' : 'Encender cámara';
    el.cameraPause.hidden = !on;
    el.cameraPause.textContent = s.camera === 'paused' ? 'Reanudar' : 'Pausar';

    const signing = isSigning(s);
    const ending = s.signPhase === 'ending';
    el.labResult.hidden = !signing;
    el.labResultLabel.textContent = ending ? (s.interim ? 'Entendimos' : 'No reconocimos las señas') : 'Interpretando…';
    el.labResultText.textContent = ending ? (s.interim ? `«${s.interim}»` : '') : `${s.interim}…`;
    el.labResultText.hidden = ending && !s.interim;
    el.labProgress.hidden = !ending; // al mostrarse, la animación CSS reinicia
  }

  function render(s, prev) {
    renderHeader(s);
    renderCaptions(s);
    renderLab(s, prev);
  }

  store.subscribe(render);
  render(store.get());
  updateWriter();
}
