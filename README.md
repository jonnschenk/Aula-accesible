# Aula Accesible · Frontend (v2)

**Demo en vivo:** [jonnschenk.github.io/Aula-accesible](https://jonnschenk.github.io/Aula-accesible/)

Una sola pantalla compartida para que un **alumno sordo** no se quede fuera de la clase.

- **Maestro → Alumno:** el maestro escribe o dicta. El alumno ve **subtítulos en vivo en español sencillo** y **palabras clave** con una definición corta.
- **Alumno → Maestro:** el alumno responde con **respuestas rápidas** («No entendí», «Más despacio»…) o escribiendo.
- **Experimental:** responder con señas (solo el vocabulario de las respuestas rápidas) y, si el backend la entrega, una animación en señas. Ninguna se presenta como traducción validada.

> Prototipo para el AI Hackathon por México × Clara. La v1 dependía de una animación 3D en LSM; la v2 funciona solo con texto y suma las señas como apoyo.

Tecnologías: HTML, Sass con BEM y JavaScript nativo con módulos ES. No usa frameworks. El único paso de compilación es Sass.

---

## 1. Cómo correrlo

Los módulos ES no funcionan con `file://`. Sirve la carpeta por HTTP:

```bash
cd frontend
python -m http.server 8000
# abrir http://localhost:8000
```

El micrófono y la cámara solo funcionan en `localhost` o con HTTPS. El dictado real usa la Web Speech API (Chrome o Edge).

En modo demo, el botón **Demo** de la cabecera simula una clase, el dictado, las señas y los errores.

### Compilar estilos

`css/main.css` ya viene compilado. Para recompilarlo después de editar el Sass:

```bash
npm install --global sass
sass scss/main.scss css/main.css
```

`css/main.css` es el archivo compilado que carga la página; los cambios visuales se hacen en `scss/`.

## Estructura y convenciones

```text
index.html, fuentes.html   Pantalla de clase y explicación del prototipo
assets/img/                Logos e ícono
css/main.css               CSS generado por Sass
LICENSE                    Licencia Apache-2.0
scss/                      Tokens, base, layout y componentes
js/
  main.js                  Arranque y eventos globales
  state.js                 Store y estado
  controller.js            Acciones y coordinación de servicios
  selectors.js             Valores derivados del estado
  data/                    Respuestas y datos de demo
  services/                API, cámara, dictado y simulaciones
  ui/                      Renderizado por área de interfaz
docs/captura.png           Captura de la demo
```

El CSS sigue **BEM** (`bloque__elemento--modificador`). Los atributos `data-*` conectan HTML y JavaScript; los estados accesibles se expresan con atributos como `aria-pressed`, `aria-current` y `hidden`. El flujo principal es **evento → controller → store → ui**, con `selectors` para derivar lo que se muestra.

## Conexión con backend

`js/config.js` deja `DEMO_MODE: true` por defecto. Para conectar servicios, configura `DEMO_MODE: false`, `API_URL` y, si se habilita el laboratorio experimental, `RECOGNITION_WS_URL`. No incluyas llaves de API en el frontend.

- **`POST /simplificar`** recibe `{ "texto": "..." }` y puede responder con `texto_sencillo`, `palabras_clave` (cada una con `palabra` y `definicion`) y `animacion_url` opcional.
- **WebSocket de señas:** el navegador envía cuadros JPEG al servicio configurado. El contrato de eventos contempla `manos`, `parcial`, `final` y `no_reconocido`. Solo se busca reconocer respuestas rápidas; la animación y el reconocimiento son experimentales y no constituyen una traducción validada.

El contrato es una interfaz propuesta para integrar el frontend; el backend debe confirmar rutas, formatos, CORS y manejo de datos antes de habilitar producción.

## Accesibilidad y privacidad

Hay etiquetas para los campos, controles operables por teclado, foco visible, anuncios `aria-live`, opción de texto grande y soporte para `prefers-reduced-motion`. Los tokens de color y sus contrastes documentados están en `scss/abstracts/_tokens.scss`. El prototipo no es una certificación de conformidad WCAG.

En modo demo no se necesita backend y la conversación permanece en memoria del navegador; se pierde al recargar. El micrófono y la cámara requieren permiso. Al conectar el reconocimiento, los cuadros JPEG se envían al WebSocket configurado; el frontend no define la retención del servidor, que debe aclararse con el equipo responsable.

## Cómo se hizo

- **Versión original (hackathon):** Jonathan Ramírez hizo el diseño UX/UI y el frontend; su equipo desarrolló el backend de la animación 3D. La animación cargó, pero solo de forma local, en la computadora donde corría el backend.
- **Versión 2:** Jonathan Ramírez hizo el rediseño y el frontend, con asistencia de IA. Esta versión no tiene backend: la demo simula el dictado, la simplificación y las señas.
- **Uso de IA:** partí de un diseño base en Claude Design, sobre el que hice el diseño final, y usé Claude para revisar y depurar el código y para integrar el backend y el frontend en la versión original. Las decisiones de producto, diseño y accesibilidad son mías.

Autor: Jonathan Ramírez · GitHub: [jonnschenk](https://github.com/jonnschenk)

## Licencia

Este proyecto se distribuye bajo la licencia [Apache-2.0](LICENSE).
# Aula-accesible
