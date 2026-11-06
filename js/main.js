/**
 * Aula Accesible · punto de entrada.
 */
import { $ } from './utils/dom.js';
import { createStore, initialState } from './state.js';
import { createController } from './controller.js';
import { initAlumno } from './ui/alumno.js';
import { initMaestro } from './ui/maestro.js';
import { initFeedback } from './ui/feedback.js';
import { initDemoPanel } from './ui/demo-panel.js';

const store = createStore(initialState);

const controller = createController(store, {
  cameraVideo: $('[data-camera-video]'),
});

initAlumno($('[data-panel="alumno"]'), store, controller);
initMaestro($('[data-panel="maestro"]'), store, controller);
initFeedback(document, store);
initDemoPanel(document, store, controller);

// Un solo manejador para todos los botones con data-action="…"
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  controller.actions[button.dataset.action]?.(button);
});

controller.init();
