/* ==========================================================================
   EXERCISES — biblioteca de ejercicios con tutoriales y filtros
   ========================================================================== */

const Exercises = (() => {

  const EQUIPMENT = ['Peso corporal', 'Mancuernas', 'Barra', 'Máquina', 'Polea', 'Bandas', 'Disco o mancuerna', 'Kettlebell'];
  const DIFFICULTY = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };
  const DIFFICULTY_ORDER = { principiante: 0, intermedio: 1, avanzado: 2 };
  const MECHANIC = { compuesto: 'Compuesto', aislamiento: 'Aislamiento' };

  // Tipo del ejercicio; si todavía no lo trae guardado, se deduce (ver Storage.inferMechanic)
  function mechanicOf(ex) {
    return ex && MECHANIC[ex.mechanic] ? ex.mechanic : Storage.inferMechanic(ex);
  }

  // Ejercicio de peso corporal: el peso que se anota es un EXTRA opcional (lastre, chaleco, mancuerna...)
  function isBodyweight(ex) { return !!ex && ex.equipment === 'Peso corporal'; }

  function all() { return Storage.all('exercises'); }
  function get(id) { return Storage.find('exercises', id); }

  // Orden: Principiante -> Intermedio -> Avanzado, y alfabético dentro de cada grupo
  function sorted(list) {
    return [...list].sort((a, b) => {
      const d = (DIFFICULTY_ORDER[a.difficulty] ?? 9) - (DIFFICULTY_ORDER[b.difficulty] ?? 9);
      return d !== 0 ? d : a.name.localeCompare(b.name, 'es');
    });
  }

  function isGif(url = '') { return /\.gif($|\?)/i.test(url); }

  function matches(ex, filter) {
    const { muscle, equipment, search, gymId } = filter;
    if (muscle && !ex.muscles.includes(muscle) && !(ex.secondary || []).includes(muscle)) return false;
    if (equipment && ex.equipment !== equipment) return false;
    if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (gymId && !Gyms.hasExercise(gymId, ex.id)) return false;
    return true;
  }

  function muscleBadges(ex) {
    const primary = ex.muscles.map(m => `<span class="chip chip-accent">${Utils.escapeHtml(MuscleMap.muscleLabel(m))}</span>`).join('');
    const secondary = (ex.secondary || []).map(m => `<span class="chip">${Utils.escapeHtml(MuscleMap.muscleLabel(m))}</span>`).join('');
    const mech = `<span class="chip">${MECHANIC[mechanicOf(ex)]}</span>`;
    const uni = ex.unilateral ? `<span class="chip">🔁 Unilateral</span>` : '';
    const timed = ex.measureByTime ? '<span class="chip">⏱️ Por tiempo</span>' : '';
    return primary + secondary + mech + uni + timed;
  }

  // Gimnasios donde está disponible este ejercicio
  function gymLine(ex) {
    const gs = Gyms.gymsOf(ex.id);
    return gs.length ? `<p class="text-muted exercise-equipment">🏢 ${gs.map(g => Utils.escapeHtml(g.name)).join(' · ')}</p>` : '';
  }

  function card(ex, opts = {}) {
    return `
    <article class="exercise-card" data-id="${ex.id}">
      ${ex.media ? `<div class="exercise-thumb"><img src="${ex.media}" alt="${Utils.escapeHtml(ex.name)}" loading="lazy"></div>` : ''}
      <div class="exercise-card-top">
        <h3>${Utils.escapeHtml(ex.name)}</h3>
        <span class="badge badge-${ex.difficulty}">${DIFFICULTY[ex.difficulty] || ex.difficulty}</span>
      </div>
      <div class="chip-row">${muscleBadges(ex)}</div>
      <p class="text-muted exercise-equipment">🏋️ ${Utils.escapeHtml(ex.equipment || 'Sin equipo')}</p>
      ${gymLine(ex)}
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
    if (filter.gymId && !Gyms.get(filter.gymId)) filter.gymId = null;   // el gimnasio ya no existe

    container.innerHTML = `
      <div class="filter-bar">
        <input type="text" id="ex-search" class="search-input" placeholder="Buscar ejercicio..." value="${Utils.escapeHtml(filter.search || '')}">
        <select id="ex-equipment" class="filter-select">
          <option value="">Todo el equipo</option>
          ${EQUIPMENT.map(eq => `<option ${filter.equipment === eq ? 'selected' : ''}>${eq}</option>`).join('')}
        </select>
        ${Gyms.all().length ? `<select id="ex-gym" class="filter-select" aria-label="Gimnasio">
          <option value="">Todos los gimnasios</option>
          ${Gyms.all().map(g => `<option value="${g.id}" ${filter.gymId === g.id ? 'selected' : ''}>🏢 ${Utils.escapeHtml(g.name)}</option>`).join('')}
        </select>` : ''}
        ${filter.muscle ? `<button class="filter-chip active" id="ex-clear-muscle">🎯 ${Utils.escapeHtml(MuscleMap.muscleLabel(filter.muscle))} ✕</button>` : ''}
        <button class="filter-chip" id="ex-toggle-map">🎯 Filtrar por músculo</button>
        ${opts.pickable ? '' : '<button class="filter-chip" id="ex-gyms">🏢 Gimnasios</button>'}
        ${filter.gymId && !opts.pickable ? '<button class="filter-chip active" id="ex-gym-add">➕ Agregar ejercicios a este gimnasio</button>' : ''}
        ${opts.pickable ? '' : `<button class="btn-primary" id="ex-new" style="margin-left:auto;">+ Nuevo ejercicio</button>`}
      </div>
      <div class="mf-filter-panel" id="ex-map-panel" style="display:none;"></div>
      <div class="cards-grid" id="ex-grid"></div>`;

    const grid = container.querySelector('#ex-grid');
    const paintGrid = () => {
      const list = sorted(all().filter(ex =>
        (filter.gymId || ex.libraryVisible !== false) && matches(ex, State.s.exerciseFilter)));
      grid.innerHTML = list.length ? list.map(ex => card(ex, opts)).join('')
        : `<div class="empty-state"><span class="empty-icon">🔍</span><h3>Sin resultados</h3><p>${State.s.exerciseFilter.gymId ? 'Este gimnasio no tiene ejercicios que coincidan. Agrega los que tenga con el botón de arriba.' : 'Ajusta los filtros o crea un ejercicio nuevo.'}</p></div>`;

      grid.querySelectorAll('.exercise-card').forEach(elCard => {
        const id = elCard.dataset.id;
        elCard.querySelector('[data-act="tutorial"]').addEventListener('click', () => openTutorial(id));
        const pick = elCard.querySelector('[data-act="pick"]');
        if (pick) pick.addEventListener('click', () => opts.onPick && opts.onPick(id));
        const edit = elCard.querySelector('[data-act="edit"]');
        if (edit) edit.addEventListener('click', () => openModal(id, paintGrid));
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
    const gymSel = container.querySelector('#ex-gym');
    if (gymSel) gymSel.addEventListener('change', e => { State.s.exerciseFilter.gymId = e.target.value || null; renderLibrary(container, opts); });
    const gymsBtn = container.querySelector('#ex-gyms');
    if (gymsBtn) gymsBtn.addEventListener('click', () => Gyms.openManager({ onClose: () => renderLibrary(container, opts) }));
    const gymAdd = container.querySelector('#ex-gym-add');
    if (gymAdd) gymAdd.addEventListener('click', () => Gyms.openPicker(filter.gymId, () => renderLibrary(container, opts)));
    const clearBtn = container.querySelector('#ex-clear-muscle');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      State.s.exerciseFilter.muscle = null; renderLibrary(container, opts);
    });
    container.querySelector('#ex-toggle-map').addEventListener('click', () => {
      const panel = container.querySelector('#ex-map-panel');
      const show = panel.style.display === 'none';
      panel.style.display = show ? '' : 'none';
      if (show) {
        panel.dataset.built = '1';
        panel.innerHTML = `<div id="ex-picker"></div>${opts.pickable ? '' : '<button type="button" class="btn-sm btn-secondary mgr-open" id="ex-manage-muscles">⚙️ Gestionar músculos</button>'}`;
        const manage = panel.querySelector('#ex-manage-muscles');
        if (manage) manage.addEventListener('click', () => MuscleManager.open({ onClose: () => renderLibrary(container, opts) }));
        MuscleMap.renderFieldPicker(panel.querySelector('#ex-picker'), {
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
    const client = State.getActiveClient();
    const best = (!ex.measureByTime && ex.trackPR !== false && client) ? Routines.bestSetEver(client.id, ex.id) : null;
    UI.openModal({
      title: ex.name,
      body: `
        ${ex.media ? `<img src="${ex.media}" alt="${Utils.escapeHtml(ex.name)}" class="tutorial-media">` : ''}
        <div class="chip-row">${muscleBadges(ex)}</div>
        <p class="text-muted" style="margin:var(--space-2) 0">🏋️ ${Utils.escapeHtml(ex.equipment || 'Sin equipo')} · ${DIFFICULTY[ex.difficulty] || ''}</p>
        <h4>Ejecución</h4>
        <p>${Utils.escapeHtml(ex.description || 'Sin descripción todavía.')}</p>
        ${ex.tips ? `<h4>Consejo del entrenador</h4><p>${Utils.escapeHtml(ex.tips)}</p>` : ''}
        ${ex.videoUrl ? `<h4>Video</h4><div class="video-embed"><iframe src="${Utils.escapeHtml(toEmbed(ex.videoUrl))}" allowfullscreen loading="lazy"></iframe></div>` : ''}
        ${ex.measureByTime ? `<p class="text-muted" style="font-size:var(--fs-xs);">⏱️ Este ejercicio se registra por duración en segundos.</p>` : ex.trackPR === false ? `<p class="text-muted" style="font-size:var(--fs-xs);">📴 El seguimiento de récords (PR) está desactivado para este ejercicio.</p>` : `
        <h4>📐 Récord (PR)</h4>
        <p class="text-muted" style="font-size:var(--fs-sm);">${best
          ? `Tu mejor registro con ${Utils.escapeHtml(client.name)}: <strong>${Utils.toUnit(best.weight)} ${Utils.unitLabel()} × ${best.reps}</strong> (máximo estimado ${Utils.toUnit(best.rm)} ${Utils.unitLabel()}, ${Utils.formatDate(best.date, { withYear: false })})`
          : (client ? 'Aún no hay entrenamientos registrados de este ejercicio.' : 'Elige un cliente activo para ver su historial.')}</p>
        <button type="button" class="btn-sm btn-secondary" id="ex-pr-calc">📐 Calcular récord aproximado</button>`}
      `,
      hideFooter: true,
      onOpen: () => {
        const btn = document.getElementById('ex-pr-calc');
        if (btn) btn.addEventListener('click', () => openPRCalculator(ex, best));
      }
    });
  }

  /* ---------------- Calculadora de PR aproximado ---------------- */
  // A partir de un peso y las repeticiones hechas, estima el 1RM (Epley) y
  // arma una tabla de pesos aproximados para otros números de repeticiones.

  function openPRCalculator(ex, best) {
    const host = document.createElement('div');
    const unit = Utils.unitLabel();
    let weight = best ? Utils.toUnit(best.weight) : '';
    let reps = best ? best.reps : '';

    const paint = () => {
      const oneRM = (weight && reps) ? Utils.estimate1RM(Utils.fromUnit(weight), reps) : 0;
      const rows = [1, 2, 3, 5, 8, 10, 12, 15].map(r =>
        `<tr><td>${r} rep${r === 1 ? '' : 's'}</td><td>${oneRM ? Utils.toUnit(Utils.repMaxFromOneRM(oneRM, r)) + ' ' + unit : '—'}</td></tr>`).join('');
      host.innerHTML = `
        <p class="text-muted" style="font-size:var(--fs-sm);">Pon un peso y cuántas repeticiones hiciste con él (hasta el fallo técnico). Se estima tu máximo (1RM) con la fórmula de Epley y de ahí se calculan pesos aproximados para otros rangos de reps.</p>
        <div class="field-inline">
          <label class="field"><span>Peso (${unit})</span><input type="number" min="0" step="0.5" id="pc-weight" value="${weight}"></label>
          <label class="field"><span>Repeticiones</span><input type="number" min="1" id="pc-reps" value="${reps}"></label>
        </div>
        <p class="text-muted" style="font-size:var(--fs-xs);">Es una estimación matemática, no un test real — sirve para planear, no como sustituto de probar el peso.</p>
        <h4>Máximo estimado (1RM): ${oneRM ? Utils.toUnit(oneRM) + ' ' + unit : '—'}</h4>
        <table class="table-compact">
          <thead><tr><th>Repeticiones</th><th>Peso aproximado</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      host.querySelector('#pc-weight').addEventListener('input', e => { weight = e.target.value; paint(); });
      host.querySelector('#pc-reps').addEventListener('input', e => { reps = Number(e.target.value) || ''; paint(); });
    };

    UI.openModal({
      title: `📐 Récord aproximado — ${ex.name}`,
      bodyEl: host,
      hideFooter: true,
      onOpen: paint
    });
  }

  function toEmbed(url) {
    const m = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : url;
  }

  // opts.gymId: al crear un ejercicio desde un gimnasio, ese gimnasio ya aparece marcado
  function openModal(id, onDone, opts = {}) {
    const editing = id ? get(id) : null;
    let selectedMuscles = editing ? [...editing.muscles] : [];
    let selectedSecondary = editing ? [...(editing.secondary || [])] : [];
    let mediaData = editing?.media || '';
    const gymList = Gyms.all();
    const gymField = gymList.length ? `<div class="field field-wide"><span>🏢 Disponible en estos gimnasios (opcional)</span>${gymList.map(g => `<label class="field checkbox-field"><input type="checkbox" class="f-gym" value="${g.id}" ${(editing ? Gyms.hasExercise(g.id, editing.id) : opts.gymId === g.id) ? 'checked' : ''}><span>${Utils.escapeHtml(g.name)}</span></label>`).join('')}</div>` : '';

    const body = `
      <div class="form-grid">
        <label class="field field-wide"><span>Nombre del ejercicio</span>
          <input type="text" id="f-name" value="${editing ? Utils.escapeHtml(editing.name) : ''}" required></label>
        <label class="field"><span>Equipo</span>
          <select id="f-equipment">${EQUIPMENT.map(eq => `<option ${editing?.equipment === eq ? 'selected' : ''}>${eq}</option>`).join('')}</select></label>
        <label class="field"><span>Dificultad</span>
          <select id="f-difficulty">${Object.entries(DIFFICULTY).map(([k, v]) => `<option value="${k}" ${editing?.difficulty === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Tipo de ejercicio</span>
          <select id="f-mechanic">${Object.entries(MECHANIC).map(([k, v]) => `<option value="${k}" ${(editing ? mechanicOf(editing) : 'compuesto') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field checkbox-field"><input type="checkbox" id="f-unilateral" ${editing?.unilateral ? 'checked' : ''}><span>Ejercicio unilateral (un lado a la vez)</span></label>
        <label class="field checkbox-field"><input type="checkbox" id="f-measure-time" ${editing?.measureByTime ? 'checked' : ''}><span>Medir este ejercicio por tiempo (segundos) en vez de repeticiones</span></label>
        <label class="field checkbox-field"><input type="checkbox" id="f-trackpr" ${editing?.trackPR === false ? '' : 'checked'}><span>Registrar récords (PR) para este ejercicio</span></label>
        <label class="field"><span>Video (URL de YouTube, opcional)</span>
          <input type="url" id="f-video" value="${editing ? Utils.escapeHtml(editing.videoUrl || '') : ''}" placeholder="https://youtube.com/..."></label>
        <label class="field field-wide"><span>Foto o GIF del ejercicio (opcional)</span>
          <input type="file" id="f-media" accept="image/*,.gif">
          <div id="f-media-preview" class="media-preview">${mediaData ? `<img src="${mediaData}"><button type="button" id="f-media-remove" class="btn-icon-sm">✕</button>` : ''}</div>
        </label>
        <label class="field field-wide"><span>Descripción / ejecución</span>
          <textarea id="f-desc" rows="3">${editing ? Utils.escapeHtml(editing.description || '') : ''}</textarea></label>
        <label class="field field-wide"><span>Consejo del entrenador</span>
          <textarea id="f-tips" rows="2">${editing ? Utils.escapeHtml(editing.tips || '') : ''}</textarea></label>
        ${gymField}
        <div class="field field-wide">
          <button type="button" class="btn-sm btn-secondary mgr-open" id="f-manage-muscles">⚙️ Gestionar músculos</button>
        </div>
        <div class="field field-wide">
          <span>Músculo principal</span>
          <div id="f-map-primary" class="mf-panel"></div>
        </div>
        <div class="field field-wide">
          <span>Músculos secundarios (opcional)</span>
          <div id="f-map-secondary" class="mf-panel"></div>
        </div>
      </div>`;

    // El formulario vive en un elemento propio: así conserva lo escrito al abrir "Gestionar músculos" encima
    const formHost = document.createElement('div');
    formHost.innerHTML = body;

    const renderPickers = () => {
      MuscleMap.renderFieldPicker(document.getElementById('f-map-primary'), {
        selected: selectedMuscles, multi: true,
        onToggle: (id, sel) => { selectedMuscles = sel; }
      });
      MuscleMap.renderFieldPicker(document.getElementById('f-map-secondary'), {
        selected: selectedSecondary, multi: true,
        onToggle: (id, sel) => { selectedSecondary = sel; }
      });
    };
    // Tras gestionar músculos: aplica los reemplazos a lo ya elegido y quita lo que ya no existe
    const applyRemap = remap => {
      const ok = new Set(MuscleMap.groups().flatMap(g => g.muscles));
      const fix = list => [...new Set(list.map(id => (id in remap ? remap[id] : id)).filter(id => id && ok.has(id)))];
      selectedMuscles = fix(selectedMuscles);
      selectedSecondary = fix(selectedSecondary);
    };

    UI.openModal({
      title: editing ? 'Editar ejercicio' : 'Nuevo ejercicio',
      bodyEl: formHost,
      confirmLabel: editing ? 'Guardar cambios' : 'Crear ejercicio',
      onConfirm: () => {
        const name = document.getElementById('f-name').value.trim();
        if (!name) { Utils.toast('El nombre es obligatorio', 'danger'); return false; }
        if (!selectedMuscles.length) { Utils.toast('Selecciona al menos un músculo principal', 'danger'); return false; }
        const data = {
          name,
          equipment: document.getElementById('f-equipment').value,
          difficulty: document.getElementById('f-difficulty').value,
          mechanic: document.getElementById('f-mechanic').value,
          unilateral: document.getElementById('f-unilateral').checked,
          measureByTime: document.getElementById('f-measure-time').checked,
          trackPR: document.getElementById('f-trackpr').checked,
          videoUrl: document.getElementById('f-video').value.trim(),
          description: document.getElementById('f-desc').value.trim(),
          tips: document.getElementById('f-tips').value.trim(),
          media: mediaData,
          muscles: selectedMuscles,
          secondary: selectedSecondary,
          custom: true
        };
        let saved;
        if (editing) { saved = Storage.update('exercises', editing.id, data); Utils.toast('Ejercicio actualizado', 'success'); }
        else { saved = Storage.insert('exercises', data); Utils.toast('Ejercicio creado', 'success'); }
        if (gymList.length) Gyms.setForExercise(saved.id, [...document.querySelectorAll('.f-gym:checked')].map(i => i.value));
        onDone && onDone(saved);
      },
      onOpen: () => {
        renderPickers();
        document.getElementById('f-manage-muscles').addEventListener('click', () => {
          MuscleManager.open({ onClose: ({ remap }) => { applyRemap(remap); renderPickers(); } });
        });
        const preview = document.getElementById('f-media-preview');
        const wireRemove = () => {
          const rm = document.getElementById('f-media-remove');
          if (rm) rm.addEventListener('click', () => { mediaData = ''; preview.innerHTML = ''; });
        };
        wireRemove();
        document.getElementById('f-media').addEventListener('change', e => {
          const file = e.target.files[0];
          if (!file) return;
          Photos.fromFile(file, Photos.PRESETS.exercise)
            .then(data => {
              mediaData = data;
              preview.innerHTML = `<img src="${mediaData}"><button type="button" id="f-media-remove" class="btn-icon-sm">✕</button>`;
              wireRemove();
            })
            .catch(err => Utils.toast(err.message, 'danger'));
        });
      }
    });
  }

  function deleteExercise(id, cb) {
    UI.confirm('¿Eliminar este ejercicio de la biblioteca? Las rutinas que ya lo incluyan mostrarán "(ejercicio eliminado)".', () => {
      Storage.remove('exercises', id);
      Gyms.removeExerciseEverywhere(id);
      Utils.toast('Ejercicio eliminado', 'info');
      cb && cb();
    });
  }

  return { EQUIPMENT, DIFFICULTY, MECHANIC, mechanicOf, isBodyweight, all, get, matches, renderLibrary, openTutorial, openModal, deleteExercise, muscleBadges };
})();
