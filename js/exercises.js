/* ==========================================================================
   EXERCISES — biblioteca de ejercicios con tutoriales y filtros
   ========================================================================== */

const Exercises = (() => {

  const EQUIPMENT = ['Peso corporal', 'Mancuernas', 'Barra', 'Máquina', 'Polea', 'Bandas', 'Disco o mancuerna', 'Kettlebell'];
  const DIFFICULTY = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };

  function all() { return Storage.all('exercises'); }
  function get(id) { return Storage.find('exercises', id); }

  function matches(ex, filter) {
    const { muscle, equipment, search } = filter;
    if (muscle && !ex.muscles.includes(muscle) && !(ex.secondary || []).includes(muscle)) return false;
    if (equipment && ex.equipment !== equipment) return false;
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }

  function muscleBadges(ex) {
    const primary = ex.muscles.map(m => `<span class="chip chip-accent">${MuscleMap.muscleLabel(m)}</span>`).join('');
    const secondary = (ex.secondary || []).map(m => `<span class="chip">${MuscleMap.muscleLabel(m)}</span>`).join('');
    return primary + secondary;
  }

  function card(ex, opts = {}) {
    return `
    <article class="exercise-card" data-id="${ex.id}">
      <div class="exercise-card-top">
        <h3>${Utils.escapeHtml(ex.name)}</h3>
        <span class="badge badge-${ex.difficulty}">${DIFFICULTY[ex.difficulty] || ex.difficulty}</span>
      </div>
      <div class="chip-row">${muscleBadges(ex)}</div>
      <p class="text-muted exercise-equipment">🏋️ ${Utils.escapeHtml(ex.equipment || 'Sin equipo')}</p>
      <div class="exercise-card-actions">
        <button class="btn-sm btn-secondary" data-act="tutorial">📖 Tutorial</button>
        ${opts.pickable ? `<button class="btn-sm btn-primary" data-act="pick">+ Agregar a rutina</button>` : `
        <button class="btn-icon-sm" data-act="edit" title="Editar">✏️</button>
        <button class="btn-icon-sm" data-act="delete" title="Eliminar">🗑️</button>`}
      </div>
    </article>`;
  }

  function renderLibrary(container, opts = {}) {
    if (!container) return;
    const filter = State.s.exerciseFilter;

    container.innerHTML = `
      <div class="filter-bar">
        <input type="text" id="ex-search" class="search-input" placeholder="Buscar ejercicio..." value="${Utils.escapeHtml(filter.search || '')}">
        <select id="ex-equipment" class="filter-select">
          <option value="">Todo el equipo</option>
          ${EQUIPMENT.map(eq => `<option ${filter.equipment === eq ? 'selected' : ''}>${eq}</option>`).join('')}
        </select>
        ${filter.muscle ? `<button class="filter-chip active" id="ex-clear-muscle">🎯 ${MuscleMap.muscleLabel(filter.muscle)} ✕</button>` : ''}
        <button class="filter-chip" id="ex-toggle-map">🧍 Mapa muscular</button>
        ${opts.pickable ? '' : `<button class="btn-primary" id="ex-new" style="margin-left:auto;">+ Nuevo ejercicio</button>`}
      </div>
      <div class="mm-panel" id="ex-map-panel" style="display:none;"></div>
      <div class="cards-grid" id="ex-grid"></div>`;

    const grid = container.querySelector('#ex-grid');
    const paintGrid = () => {
      const list = all().filter(ex => matches(ex, State.s.exerciseFilter));
      grid.innerHTML = list.length ? list.map(ex => card(ex, opts)).join('')
        : `<div class="empty-state"><span class="empty-icon">🔍</span><h3>Sin resultados</h3><p>Ajusta los filtros o crea un ejercicio nuevo.</p></div>`;

      grid.querySelectorAll('.exercise-card').forEach(elCard => {
        const id = elCard.dataset.id;
        elCard.querySelector('[data-act="tutorial"]').addEventListener('click', () => openTutorial(id));
        const pick = elCard.querySelector('[data-act="pick"]');
        if (pick) pick.addEventListener('click', () => opts.onPick && opts.onPick(id));
        const edit = elCard.querySelector('[data-act="edit"]');
        if (edit) edit.addEventListener('click', () => openModal(id));
        const del = elCard.querySelector('[data-act="delete"]');
        if (del) del.addEventListener('click', () => deleteExercise(id, paintGrid));
      });
    };

    container.querySelector('#ex-search').addEventListener('input', Utils.debounce(e => {
      State.s.exerciseFilter.search = e.target.value; paintGrid();
    }, 200));
    container.querySelector('#ex-equipment').addEventListener('change', e => {
      State.s.exerciseFilter.equipment = e.target.value; paintGrid();
    });
    const clearBtn = container.querySelector('#ex-clear-muscle');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      State.s.exerciseFilter.muscle = null; renderLibrary(container, opts);
    });
    container.querySelector('#ex-toggle-map').addEventListener('click', () => {
      const panel = container.querySelector('#ex-map-panel');
      const show = panel.style.display === 'none';
      panel.style.display = show ? '' : 'none';
      if (show && !panel.dataset.built) {
        panel.dataset.built = '1';
        MuscleMap.render(panel, {
          selected: filter.muscle ? [filter.muscle] : [],
          multi: false,
          onToggle: (id, sel) => {
            State.s.exerciseFilter.muscle = sel[0] || null;
            renderLibrary(container, opts);
          }
        });
      }
    });
    const newBtn = container.querySelector('#ex-new');
    if (newBtn) newBtn.addEventListener('click', () => openModal(null, paintGrid));

    paintGrid();
  }

  function openTutorial(id) {
    const ex = get(id);
    if (!ex) return;
    UI.openModal({
      title: ex.name,
      body: `
        <div class="chip-row">${muscleBadges(ex)}</div>
        <p class="text-muted" style="margin:var(--space-2) 0">🏋️ ${Utils.escapeHtml(ex.equipment || 'Sin equipo')} · ${DIFFICULTY[ex.difficulty] || ''}</p>
        <h4>Ejecución</h4>
        <p>${Utils.escapeHtml(ex.description || 'Sin descripción todavía.')}</p>
        ${ex.tips ? `<h4>Consejo del entrenador</h4><p>${Utils.escapeHtml(ex.tips)}</p>` : ''}
        ${ex.videoUrl ? `<h4>Video</h4><div class="video-embed"><iframe src="${Utils.escapeHtml(toEmbed(ex.videoUrl))}" allowfullscreen loading="lazy"></iframe></div>` : ''}
      `,
      hideFooter: true
    });
  }

  function toEmbed(url) {
    const m = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }

  function openModal(id, onDone) {
    const editing = id ? get(id) : null;
    let selectedMuscles = editing ? [...editing.muscles] : [];
    let selectedSecondary = editing ? [...(editing.secondary || [])] : [];

    const body = `
      <div class="form-grid">
        <label class="field field-wide"><span>Nombre del ejercicio</span>
          <input type="text" id="f-name" value="${editing ? Utils.escapeHtml(editing.name) : ''}" required></label>
        <label class="field"><span>Equipo</span>
          <select id="f-equipment">${EQUIPMENT.map(eq => `<option ${editing?.equipment === eq ? 'selected' : ''}>${eq}</option>`).join('')}</select></label>
        <label class="field"><span>Dificultad</span>
          <select id="f-difficulty">${Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${editing?.difficulty === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Video (URL de YouTube, opcional)</span>
          <input type="url" id="f-video" value="${editing ? Utils.escapeHtml(editing.videoUrl || '') : ''}" placeholder="https://youtube.com/..."></label>
        <label class="field field-wide"><span>Descripción / ejecución</span>
          <textarea id="f-desc" rows="3">${editing ? Utils.escapeHtml(editing.description || '') : ''}</textarea></label>
        <label class="field field-wide"><span>Consejo del entrenador</span>
          <textarea id="f-tips" rows="2">${editing ? Utils.escapeHtml(editing.tips || '') : ''}</textarea></label>
        <div class="field field-wide">
          <span>Músculo principal (toca en la silueta)</span>
          <div id="f-map-primary" class="mm-panel"></div>
        </div>
        <div class="field field-wide">
          <span>Músculos secundarios (opcional)</span>
          <div id="f-map-secondary" class="mm-panel"></div>
        </div>
      </div>`;

    UI.openModal({
      title: editing ? 'Editar ejercicio' : 'Nuevo ejercicio',
      body,
      confirmLabel: editing ? 'Guardar cambios' : 'Crear ejercicio',
      onConfirm: () => {
        const name = document.getElementById('f-name').value.trim();
        if (!name) { Utils.toast('El nombre es obligatorio', 'danger'); return false; }
        if (!selectedMuscles.length) { Utils.toast('Selecciona al menos un músculo principal', 'danger'); return false; }
        const data = {
          name,
          equipment: document.getElementById('f-equipment').value,
          difficulty: document.getElementById('f-difficulty').value,
          videoUrl: document.getElementById('f-video').value.trim(),
          description: document.getElementById('f-desc').value.trim(),
          tips: document.getElementById('f-tips').value.trim(),
          muscles: selectedMuscles,
          secondary: selectedSecondary,
          custom: true
        };
        if (editing) { Storage.update('exercises', editing.id, data); Utils.toast('Ejercicio actualizado', 'success'); }
        else { Storage.insert('exercises', data); Utils.toast('Ejercicio creado', 'success'); }
        onDone && onDone();
      },
      onOpen: () => {
        MuscleMap.render(document.getElementById('f-map-primary'), {
          selected: selectedMuscles, multi: true,
          onToggle: (id, sel) => { selectedMuscles = sel; }
        });
        MuscleMap.render(document.getElementById('f-map-secondary'), {
          selected: selectedSecondary, multi: true,
          onToggle: (id, sel) => { selectedSecondary = sel; }
        });
      }
    });
  }

  function deleteExercise(id, cb) {
    UI.confirm('¿Eliminar este ejercicio de la biblioteca? Las rutinas que ya lo incluyan mostrarán "(ejercicio eliminado)".', () => {
      Storage.remove('exercises', id);
      Utils.toast('Ejercicio eliminado', 'info');
      cb && cb();
    });
  }

  return { EQUIPMENT, DIFFICULTY, all, get, matches, renderLibrary, openTutorial, openModal, deleteExercise, muscleBadges };
})();
