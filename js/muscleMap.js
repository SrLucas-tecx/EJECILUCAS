/* ==========================================================================
   MUSCLE MAP — silueta corporal REAL (imagen + overlay SVG clicable)
   hombre / mujer, frontal / posterior.

   Nota técnica importante: las zonas clicables están escritas aquí mismo
   como datos de JavaScript (no en un .json aparte cargado con fetch).
   Esto es a propósito: al abrir index.html directo desde el disco
   (file://), los navegadores BLOQUEAN fetch() a archivos locales por
   seguridad (CORS), así que un mapa que dependa de fetch('musculos.json')
   se queda sin datos y ningún músculo responde al clic. Al incrustar los
   datos en el propio archivo .js evitamos ese problema por completo.
   ========================================================================== */

const MuscleMap = (() => {

  const MUSCLES = {
    'hombro-frontal':  { label: 'Hombro (frontal)', view: 'front' },
    'hombro-lateral':  { label: 'Hombro (lateral)', view: 'front' },
    'pecho':           { label: 'Pecho', view: 'front' },
    'biceps':          { label: 'Bíceps', view: 'front' },
    'antebrazo':       { label: 'Antebrazo', view: 'front' },
    'abdomen':         { label: 'Abdomen', view: 'front' },
    'oblicuos':        { label: 'Oblicuos', view: 'front' },
    'cuadriceps':      { label: 'Cuádriceps', view: 'front' },
    'trapecio':        { label: 'Trapecio', view: 'back' },
    'hombro-posterior':{ label: 'Hombro (posterior)', view: 'back' },
    'espalda':         { label: 'Espalda / dorsales', view: 'back' },
    'triceps':         { label: 'Tríceps', view: 'back' },
    'espalda-baja':    { label: 'Espalda baja', view: 'back' },
    'gluteos':         { label: 'Glúteos', view: 'back' },
    'isquiotibiales':  { label: 'Isquiotibiales', view: 'back' },
    'pantorrillas':    { label: 'Pantorrillas', view: 'back' }
  };

  function muscleLabel(id) { return MUSCLES[id]?.label || id; }

  // Agrupación para el selector por campos (en vez de tocar la silueta).
  const MUSCLE_GROUPS = [
    { label: '💪 Brazo y hombro', muscles: ['hombro-frontal', 'hombro-lateral', 'hombro-posterior', 'biceps', 'triceps', 'antebrazo'] },
    { label: '🫀 Torso', muscles: ['pecho', 'espalda', 'trapecio', 'abdomen', 'oblicuos', 'espalda-baja'] },
    { label: '🦵 Pierna', muscles: ['cuadriceps', 'isquiotibiales', 'gluteos', 'pantorrillas'] }
  ];

  /**
   * Selector de músculos por CAMPO (agrupado Brazo/Torso/Pierna), sin mapa.
   * Mismo tipo de opciones que render(): { selected, onToggle(id, sel), multi }
   */
  function renderFieldPicker(container, options = {}) {
    const { selected = [], onToggle = () => {}, multi = true } = options;

    function paint() {
      container.innerHTML = `
        <div class="mf-picker">
          ${MUSCLE_GROUPS.map(g => `
            <div class="mf-group">
              <div class="mf-group-label">${g.label}</div>
              <div class="mf-group-items">
                ${g.muscles.map(id => `<button type="button" class="mf-chip ${selected.includes(id) ? 'active' : ''}" data-m="${id}">${muscleLabel(id)}</button>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;
      container.querySelectorAll('.mf-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.m;
          if (!multi) selected.length = 0;
          const i = selected.indexOf(id);
          if (i >= 0) selected.splice(i, 1); else selected.push(id);
          paint();
          onToggle(id, selected.slice());
        });
      });
    }

    paint();
    return { getSelected: () => selected.slice() };
  }

  // Imagen de fondo + tamaño natural (viewBox) + zonas clicables por género/vista.
  // Las imágenes viven en la RAÍZ del proyecto (junto a index.html), sin carpeta.
  // Nota: las zonas son deliberadamente generosas (con margen extra) — el mapa es
  // para EJEMPLIFICAR qué músculo se trabaja, no un diagrama médico de precisión,
  // así que se prioriza que sea fácil de tocar sobre que el borde calce exacto.
  const ASSETS = {
    male: {
      front: {
        src: 'Frente_H.png', w: 501, h: 900,
        zones: [
          ['hombro-frontal', 'ellipse', { cx: 138, cy: 146, rx: 46, ry: 42 }],
          ['hombro-frontal', 'ellipse', { cx: 363, cy: 146, rx: 46, ry: 42 }],
          ['pecho', 'rect', { x: 147, y: 108, w: 207, h: 108, rx: 29 }],
          ['biceps', 'rect', { x: 40, y: 149, w: 104, h: 166, rx: 25 }],
          ['biceps', 'rect', { x: 358, y: 149, w: 104, h: 166, rx: 25 }],
          ['antebrazo', 'rect', { x: 3, y: 292, w: 106, h: 136, rx: 21 }],
          ['antebrazo', 'rect', { x: 392, y: 292, w: 106, h: 136, rx: 21 }],
          ['abdomen', 'rect', { x: 184, y: 198, w: 134, h: 149, rx: 19 }],
          ['oblicuos', 'rect', { x: 154, y: 198, w: 49, h: 149, rx: 15 }],
          ['oblicuos', 'rect', { x: 299, y: 198, w: 49, h: 149, rx: 15 }],
          ['cuadriceps', 'rect', { x: 164, y: 350, w: 94, h: 220, rx: 23 }],
          ['cuadriceps', 'rect', { x: 242, y: 350, w: 94, h: 220, rx: 23 }]
        ]
      },
      back: {
        src: 'Espalada_H.png', w: 478, h: 899,
        zones: [
          ['trapecio', 'rect', { x: 165, y: 75, w: 148, h: 90, rx: 22 }],
          ['hombro-posterior', 'ellipse', { cx: 134, cy: 146, rx: 44, ry: 42 }],
          ['hombro-posterior', 'ellipse', { cx: 344, cy: 146, rx: 44, ry: 42 }],
          ['espalda', 'rect', { x: 147, y: 141, w: 184, h: 203, rx: 25 }],
          ['triceps', 'rect', { x: 42, y: 149, w: 98, h: 166, rx: 24 }],
          ['triceps', 'rect', { x: 338, y: 149, w: 98, h: 166, rx: 24 }],
          ['espalda-baja', 'rect', { x: 167, y: 324, w: 145, h: 80, rx: 18 }],
          ['gluteos', 'rect', { x: 154, y: 390, w: 170, h: 85, rx: 25 }],
          ['isquiotibiales', 'rect', { x: 159, y: 455, w: 90, h: 161, rx: 20 }],
          ['isquiotibiales', 'rect', { x: 229, y: 455, w: 90, h: 161, rx: 20 }],
          ['pantorrillas', 'rect', { x: 164, y: 644, w: 79, h: 171, rx: 18 }],
          ['pantorrillas', 'rect', { x: 235, y: 644, w: 79, h: 171, rx: 18 }]
        ]
      }
    },
    female: {
      front: {
        src: 'Frente_M.png', w: 300, h: 900,
        zones: [
          ['hombro-frontal', 'ellipse', { cx: 80, cy: 172, rx: 32, ry: 31 }],
          ['hombro-frontal', 'ellipse', { cx: 216, cy: 172, rx: 32, ry: 31 }],
          ['pecho', 'rect', { x: 85, y: 142, w: 130, h: 92, rx: 20 }],
          ['biceps', 'rect', { x: 23, y: 167, w: 72, h: 147, rx: 18 }],
          ['biceps', 'rect', { x: 203, y: 167, w: 72, h: 147, rx: 18 }],
          ['antebrazo', 'rect', { x: 3, y: 294, w: 68, h: 114, rx: 16 }],
          ['antebrazo', 'rect', { x: 228, y: 294, w: 68, h: 114, rx: 16 }],
          ['abdomen', 'rect', { x: 100, y: 215, w: 100, h: 130, rx: 16 }],
          ['oblicuos', 'rect', { x: 82, y: 215, w: 38, h: 130, rx: 12 }],
          ['oblicuos', 'rect', { x: 180, y: 215, w: 38, h: 130, rx: 12 }],
          ['cuadriceps', 'rect', { x: 88, y: 356, w: 70, h: 185, rx: 18 }],
          ['cuadriceps', 'rect', { x: 142, y: 356, w: 70, h: 185, rx: 18 }]
        ]
      },
      back: {
        src: 'Espalda_M.png', w: 305, h: 900,
        zones: [
          ['trapecio', 'rect', { x: 91, y: 100, w: 126, h: 68, rx: 18 }],
          ['hombro-posterior', 'ellipse', { cx: 81, cy: 174, rx: 32, ry: 31 }],
          ['hombro-posterior', 'ellipse', { cx: 222, cy: 174, rx: 32, ry: 31 }],
          ['espalda', 'rect', { x: 84, y: 148, w: 139, h: 176, rx: 20 }],
          ['triceps', 'rect', { x: 25, y: 169, w: 73, h: 149, rx: 18 }],
          ['triceps', 'rect', { x: 208, y: 169, w: 73, h: 149, rx: 18 }],
          ['espalda-baja', 'rect', { x: 99, y: 304, w: 109, h: 77, rx: 16 }],
          ['gluteos', 'rect', { x: 85, y: 359, w: 137, h: 85, rx: 22 }],
          ['isquiotibiales', 'rect', { x: 91, y: 424, w: 68, h: 176, rx: 18 }],
          ['isquiotibiales', 'rect', { x: 146, y: 424, w: 68, h: 176, rx: 18 }],
          ['pantorrillas', 'rect', { x: 95, y: 643, w: 62, h: 157, rx: 16 }],
          ['pantorrillas', 'rect', { x: 150, y: 643, w: 62, h: 157, rx: 16 }]
        ]
      }
    }
  };

  function zoneMarkup([id, shape, attrs]) {
    const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    const tag = shape === 'ellipse' ? 'ellipse' : 'rect';
    return `<g class="mm-zone" data-muscle="${id}"><${tag} ${attrStr}/><title>${muscleLabel(id)}</title></g>`;
  }

  /**
   * Renderiza el mapa muscular dentro de `container`.
   * options: { selected, onToggle(id, sel), multi, gender ('male'|'female'),
   *            closable, onClose }
   */
  function render(container, options = {}) {
    const { selected = [], onToggle = () => {}, multi = true, closable = false, onClose = () => {} } = options;
    let view = 'front';
    let gender = options.gender || 'male';

    container.innerHTML = `
      <div class="mm-wrap">
        <div class="mm-toolbar">
          <div class="mm-toggle" id="mm-view-toggle">
            <button type="button" class="mm-view-btn active" data-v="front">Frontal</button>
            <button type="button" class="mm-view-btn" data-v="back">Posterior</button>
          </div>
          <div class="mm-toggle" id="mm-gender-toggle">
            <button type="button" class="mm-view-btn ${gender === 'male' ? 'active' : ''}" data-g="male">♂ Hombre</button>
            <button type="button" class="mm-view-btn ${gender === 'female' ? 'active' : ''}" data-g="female">♀ Mujer</button>
          </div>
          ${closable ? `<button type="button" class="mm-close-btn" id="mm-close-btn" title="Cerrar mapa muscular">✕</button>` : ''}
        </div>
        <div class="mm-canvas" id="mm-canvas"></div>
        <div class="mm-legend" id="mm-legend"></div>
      </div>`;

    const canvas = container.querySelector('#mm-canvas');

    function paintCanvas() {
      const data = ASSETS[gender][view];
      canvas.style.aspectRatio = `${data.w} / ${data.h}`;
      canvas.innerHTML = `
        <img src="${data.src}" class="mm-img" alt="Silueta ${gender === 'male' ? 'masculina' : 'femenina'} ${view === 'front' ? 'frontal' : 'posterior'}">
        <svg class="mm-svg" viewBox="0 0 ${data.w} ${data.h}" preserveAspectRatio="xMidYMid meet">
          ${data.zones.map(zoneMarkup).join('')}
        </svg>`;
      canvas.querySelectorAll('.mm-zone').forEach(z => {
        z.addEventListener('click', () => {
          const id = z.dataset.muscle;
          if (!multi) selected.length = 0;
          const i = selected.indexOf(id);
          if (i >= 0) selected.splice(i, 1); else selected.push(id);
          paintZones();
          onToggle(id, selected.slice());
        });
      });
      paintZones();
    }

    function paintZones() {
      canvas.querySelectorAll('.mm-zone').forEach(z => {
        z.classList.toggle('is-selected', selected.includes(z.dataset.muscle));
      });
      const legend = container.querySelector('#mm-legend');
      legend.innerHTML = selected.length
        ? selected.map(id => `<span class="chip chip-accent">${muscleLabel(id)}</span>`).join('')
        : '<span class="text-muted" style="font-size:var(--fs-xs)">Toca un músculo en la silueta para seleccionarlo</span>';
    }

    container.querySelectorAll('.mm-view-btn[data-v]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mm-view-btn[data-v]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        view = btn.dataset.v;
        paintCanvas();
      });
    });
    container.querySelectorAll('.mm-view-btn[data-g]').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mm-view-btn[data-g]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gender = btn.dataset.g;
        paintCanvas();
      });
    });
    if (closable) {
      container.querySelector('#mm-close-btn').addEventListener('click', () => onClose());
    }

    paintCanvas();
    return { getSelected: () => selected.slice() };
  }

  return { MUSCLES, MUSCLE_GROUPS, muscleLabel, render, renderFieldPicker };
})();
