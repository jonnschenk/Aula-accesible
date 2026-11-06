/**
 * Panel del maestro: conversación y campo para escribir o dictar.
 */
import { CONFIG } from '../config.js';
import { $, autosize, setIcon } from '../utils/dom.js';
import { isListening, isSigning } from '../selectors.js';

const AUTHOR = { alumno: 'Alumno', maestro: 'Maestro', sistema: 'Aviso' };
const VIA = { texto: 'Escrito', voz: 'Dictado', rapida: 'Respuesta rápida', lsm: 'Con señas · experimental' };

/**
 * @param {HTMLElement} root  sección del panel del maestro
 * @param {ReturnType<import('../state.js').createStore>} store
 * @param {ReturnType<import('../controller.js').createController>} controller
 */
export function initMaestro(root, store, controller) {
  const el = {
    copyButton: $('[data-action="copy-conversation"]', root),
    clearButton: $('[data-action="clear-conversation"]', root),
    conversation: $('[data-conversation]', root),
    template: $('#message-template'),
    composer: $('[data-composer]', root),
    input: $('[data-composer-input]', root),
    mic: $('[data-action="toggle-mic"]', root),
    micIcon: $('[data-mic-icon]', root),
    send: $('[data-composer-send]', root),
    feedback: $('[data-composer-feedback]', root),
  };

  // ---- Campo de texto -----------------------------------------------------------
  el.input.addEventListener('input', () => {
    controller.setDraft(el.input.value);
    autosize(el.input);
  });

  el.input.addEventListener('keydown', (event) => {
    // Enter envía; Mayús + Enter salta de línea
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      controller.sendTeacherMessage();
    }
  });

  el.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    controller.sendTeacherMessage();
  });

  // ---- Conversación -------------------------------------------------------------

  function metaText(parts) {
    return parts.filter(Boolean).join(' · ');
  }

  function buildMessage(message) {
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.classList.add(message.author === 'sistema' ? 'message--system' : `message--${message.author}`);
    node.querySelector('[data-message-text]').textContent = message.text;

    const meta = node.querySelector('[data-message-meta]');
    if (message.author === 'sistema') {
      meta.remove();
      return node;
    }

    const STATUS = {
      simplifying: 'Simplificando…',
      ready: message.simple ? 'Simplificado' : 'Enviado',
      error: 'No se pudo simplificar',
    };
    const status = message.author === 'maestro' ? STATUS[message.status] : '';
    meta.textContent = metaText([AUTHOR[message.author], VIA[message.via], message.time, status]);

    if (message.status === 'error') {
      meta.classList.add('message__meta--error');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button button--plain button--sm';
      retry.dataset.action = 'retry-simplify';
      retry.dataset.messageId = message.id;
      retry.textContent = 'Reintentar';
      meta.append(retry);
    }
    return node;
  }

  function buildInterim(s) {
    const ending = s.signPhase === 'ending';
    const node = buildMessage({ author: 'alumno', text: ending ? (s.interim || '…') : `${s.interim}…` });
    node.classList.add('message--interim');
    node.querySelector('[data-message-meta]').textContent = metaText(['Alumno', ending ? 'Revisando' : 'Señando…']);
    return node;
  }

  function buildEmpty() {
    const li = document.createElement('li');
    li.className = 'conversation__empty';
    li.textContent = 'Escribe o dicta. El alumno lo verá en español sencillo.';
    return li;
  }

  function renderConversation(s, prev) {
    const changed = !prev || prev.messages !== s.messages || prev.interim !== s.interim || prev.signPhase !== s.signPhase;
    if (!changed) return;

    const nodes = s.messages.map(buildMessage);
    if (isSigning(s)) nodes.push(buildInterim(s));
    el.conversation.replaceChildren(...(nodes.length ? nodes : [buildEmpty()]));
    el.conversation.scrollTop = el.conversation.scrollHeight;
  }

  // ---- Avisos sobre el campo ----------------------------------------------------------

  function hint(text, tone = '') {
    const p = document.createElement('p');
    p.className = `hint${tone ? ` hint--${tone}` : ''}`;
    if (tone === 'error') p.setAttribute('role', 'alert');
    if (tone === 'live') {
      const dot = document.createElement('span');
      dot.className = 'pulse';
      dot.setAttribute('aria-hidden', 'true');
      p.append(dot);
    }
    p.append(text);
    return p;
  }

  function renderFeedback(s) {
    const items = [];
    if (isListening(s)) {
      items.push(hint(s.micPhase === 'ending' ? 'Enviando en un momento…' : 'Escuchando… el alumno ve el texto en vivo.', 'live'));
    }
    if (s.mic === 'denied') items.push(hint('Sin permiso para el micrófono. Puedes escribir.', 'error'));
    if (s.draftError === 'long') {
      const extra = s.draft.length - CONFIG.MAX_MESSAGE_LENGTH;
      items.push(hint(`Sobran ${extra.toLocaleString('es-MX')} caracteres. Usa frases cortas.`, 'error'));
    }
    el.feedback.replaceChildren(...items);
  }

  // ---- Pintado general ------------------------------------------------------------------

  function render(s, prev) {
    const listening = isListening(s);

    el.copyButton.disabled = !s.messages.length;
    el.clearButton.disabled = !s.messages.length;

    renderConversation(s, prev);

    // Campo
    if (el.input.value !== s.draft) {
      el.input.value = s.draft;
      autosize(el.input);
    }
    el.input.readOnly = listening;
    el.input.placeholder = listening ? 'Escuchando…' : 'Escribe o dicta una frase corta…';
    el.input.setAttribute('aria-invalid', String(Boolean(s.draftError)));
    el.composer.classList.toggle('composer--listening', listening);
    el.composer.classList.toggle('composer--invalid', Boolean(s.draftError));

    // Micrófono
    el.mic.setAttribute('aria-pressed', String(listening));
    const micLabel = listening ? 'Detener y enviar' : 'Dictar con el micrófono';
    el.mic.setAttribute('aria-label', micLabel);
    el.mic.title = micLabel;
    setIcon(el.micIcon, listening ? 'icon-stop' : 'icon-mic');

    // Enviar
    el.send.disabled = listening || !s.draft.trim();

    renderFeedback(s);
  }

  store.subscribe(render);
  render(store.get());
}
