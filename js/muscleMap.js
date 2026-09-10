/* ==========================================================================
   MUSCLE MAP — silueta corporal SVG interactiva (frontal / posterior)
   Cada músculo es una zona clicable que filtra la biblioteca de ejercicios
   y permite asignarlos rápidamente a una rutina.
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

  function bodyOutline() {
    // Silueta decorativa neutra (misma para frontal y posterior)
    return `<path class="mm-outline" d="M100 14c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18z
      M78 54h44l10 8 20 10 8 34-10 6-16-30-2 46 6 12-4 100-14 4-6-84-4 84-14-4-4-100 6-12-2-46-16 30-10-6 8-34 20-10z"/>`;
  }

  function zone(id, d, extra = '') {
    return `<path class="mm-zone" data-muscle="${id}" d="${d}" ${extra}><title>${muscleLabel(id)}</title></path>`;
  }

  function frontSVG() {
    return `
    <svg viewBox="0 0 200 300" class="mm-svg" data-view="front">
      ${bodyOutline()}
      ${zone('hombro-frontal', 'M68 58a14 10 0 1 0 1 0z', 'transform="translate(0,4)"')}
      ${zone('hombro-frontal', 'M118 58a14 10 0 1 0 1 0z', 'transform="translate(14,4)"')}
      ${zone('pecho', 'M82 60h36l4 28h-44z')}
      ${zone('biceps', 'M60 66l10 4-4 30-12-2z')}
      ${zone('biceps', 'M140 66l-10 4 4 30 12-2z')}
      ${zone('antebrazo', 'M56 100l10 2 2 28-14-2z')}
      ${zone('antebrazo', 'M144 100l-10 2-2 28 14-2z')}
      ${zone('abdomen', 'M84 92h32l3 34h-38z')}
      ${zone('oblicuos', 'M78 92l6 0-2 34-10-2z')}
      ${zone('oblicuos', 'M122 92l-6 0 2 34 10-2z')}
      ${zone('cuadriceps', 'M82 130h16l-2 62h-16z')}
      ${zone('cuadriceps', 'M118 130h-16l2 62h16z')}
    </svg>`;
  }

  function backSVG() {
    return `
    <svg viewBox="0 0 200 300" class="mm-svg" data-view="back">
      ${bodyOutline()}
      ${zone('trapecio', 'M84 54h32l4 14h-40z')}
      ${zone('hombro-posterior', 'M68 58a14 10 0 1 0 1 0z', 'transform="translate(0,4)"')}
      ${zone('hombro-posterior', 'M118 58a14 10 0 1 0 1 0z', 'transform="translate(14,4)"')}
      ${zone('espalda', 'M80 68h40l4 40h-48z')}
      ${zone('triceps', 'M60 66l10 4-4 30-12-2z')}
      ${zone('triceps', 'M140 66l-10 4 4 30 12-2z')}
      ${zone('espalda-baja', 'M82 108h36l3 18h-42z')}
      ${zone('gluteos', 'M80 126h40l-3 18h-34z')}
      ${zone('isquiotibiales', 'M82 144h16l-2 40h-16z')}
      ${zone('isquiotibiales', 'M118 144h-16l2 40h16z')}
      ${zone('pantorrillas', 'M83 186h13l-3 34h-11z')}
      ${zone('pantorrillas', 'M117 186h-13l3 34h11z')}
    </svg>`;
  }

  /**
   * Renderiza el mapa muscular dentro de `container`.
   * options: { selected: [ids], onToggle(id), multi: bool }
   */
  function render(container, options = {}) {
    const { selected = [], onToggle = () => {}, multi = true, activeView } = options;
    let view = activeView || 'front';

    container.innerHTML = `
      <div class="mm-wrap">
        <div class="mm-toggle">
          <button type="button" class="mm-view-btn active" data-v="front">Frontal</button>
          <button type="button" class="mm-view-btn" data-v="back">Posterior</button>
        </div>
        <div class="mm-canvas">${frontSVG()}${backSVG()}</div>
        <div class="mm-legend" id="mm-legend"></div>
      </div>`;

    const svgFront = container.querySelector('svg[data-view="front"]');
    const svgBack = container.querySelector('svg[data-view="back"]');
    svgBack.style.display = 'none';

    container.querySelectorAll('.mm-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.mm-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const v = btn.dataset.v;
        svgFront.style.display = v === 'front' ? '' : 'none';
        svgBack.style.display = v === 'back' ? '' : 'none';
      });
    });

    function paint() {
      container.querySelectorAll('.mm-zone').forEach(z => {
        z.classList.toggle('is-selected', selected.includes(z.dataset.muscle));
      });
      const legend = container.querySelector('#mm-legend');
      legend.innerHTML = selected.length
        ? selected.map(id => `<span class="chip chip-accent">${muscleLabel(id)}</span>`).join('')
        : '<span class="text-muted" style="font-size:var(--fs-xs)">Toca un músculo en la silueta para seleccionarlo</span>';
    }

    container.querySelectorAll('.mm-zone').forEach(z => {
      z.addEventListener('click', () => {
        const id = z.dataset.muscle;
        if (!multi) selected.length = 0;
        const i = selected.indexOf(id);
        if (i >= 0) selected.splice(i, 1); else selected.push(id);
        paint();
        onToggle(id, selected.slice());
      });
    });

    paint();
    return { getSelected: () => selected.slice() };
  }

  return { MUSCLES, muscleLabel, render };
})();
