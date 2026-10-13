/* ==========================================================================
   GYMS — gimnasios y qué ejercicios o máquinas tiene cada uno
   Un gimnasio es { id, name, notes, exerciseIds: [] }. Los ejercicios viven
   siempre en la biblioteca (exercises.js); el gimnasio solo guarda sus ids.
   Así un ejercicio puede estar en varios gimnasios sin duplicarse, y la
   biblioteca se puede filtrar por gimnasio.
   ========================================================================== */

const Gyms = (() => {

  const esc = Utils.escapeHtml;
  const norm = s => String(s || '').trim().toLowerCase();
  const byName = (a, b) => a.name.localeCompare(b.name, 'es');

  /* ---------------- Datos ---------------- */

  function all() { return (Storage.all('gyms') || []).slice().sort(byName); }
  function get(id) { return id ? Storage.find('gyms', id) : null; }

  // Ids de ejercicios del gimnasio que todavía existen en la biblioteca
  function exerciseIds(g) {
    const ok = new Set(Exercises.all().map(e => e.id));
    return (g.exerciseIds || []).filter(id => ok.has(id));
  }
  function hasExercise(gymId, exId) {
    const g = get(gymId);
    return !!g && (g.exerciseIds || []).includes(exId);
  }
  function gymsOf(exId) { return all().filter(g => (g.exerciseIds || []).includes(exId)); }

  function addExercises(gymId, ids) {
    const g = get(gymId);
    if (!g) return;
    const set = new Set(g.exerciseIds || []);
    ids.forEach(id => set.add(id));
    Storage.update('gyms', gymId, { exerciseIds: [...set] });
  }
  function removeFromGym(gymId, exId) {
    const g = get(gymId);
    if (g) Storage.update('gyms', gymId, { exerciseIds: (g.exerciseIds || []).filter(x => x !== exId) });
  }
  // Deja el ejercicio asignado exactamente a los gimnasios de gymIds
  function setForExercise(exId, gymIds) {
    Storage.all('gyms').forEach(g => {
      const list = g.exerciseIds || [];
      const want = gymIds.includes(g.id), has = list.includes(exId);
      if (want && !has) Storage.update('gyms', g.id, { exerciseIds: [...list, exId] });
      else if (!want && has) Storage.update('gyms', g.id, { exerciseIds: list.filter(x => x !== exId) });
    });
  }
  function removeExerciseEverywhere(exId) {
    Storage.all('gyms').forEach(g => {
      if ((g.exerciseIds || []).includes(exId)) Storage.update('gyms', g.id, { exerciseIds: g.exerciseIds.filter(x => x !== exId) });
    });
  }

  function checkName(name, exceptId) {
    if (!name) throw new Error('Escribe el nombre del gimnasio');
    const twin = Storage.all('gyms').find(g => g.id !== exceptId && norm(g.name) === norm(name));
    if (twin) throw new Error(`Ya existe un gimnasio llamado "${twin.name}"`);
  }

  const countText = n => `${n} ejercicio${n === 1 ? '' : 's'}`;
  const muscleNames = ex => ex.muscles.map(m => MuscleMap.muscleLabel(m)).join(', ');

  /* ---------------- Lista de gimnasios ---------------- */

  function openManager(opts = {}) {
    const host = document.createElement('div');

    const paint = () => {
      const list = all();
      host.innerHTML = `
        <p class="text-muted" style="font-size:var(--fs-sm);">Guarda los gimnasios donde entrenan tus clientes y qué ejercicios o máquinas tiene cada uno. Después puedes filtrar la biblioteca por gimnasio para armar rutinas con lo que sí hay.</p>
        <div class="mgr-actions"><button type="button" class="btn-primary btn-sm" data-act="new">+ Nuevo gimnasio</button></div>
        ${list.length ? list.map(g => `
          <section class="mgr-group" data-id="${esc(g.id)}">
            <header class="mgr-group-head">
              <h4>🏢 ${esc(g.name)}</h4>
              <div class="mgr-group-actions">
                <button type="button" class="btn-icon-sm" data-act="edit" title="Editar" aria-label="Editar ${esc(g.name)}">✏️</button>
                <button type="button" class="btn-icon-sm" data-act="delete" title="Eliminar" aria-label="Eliminar ${esc(g.name)}">🗑️</button>
              </div>
            </header>
            <div class="chip-row"><span class="chip chip-accent">${countText(exerciseIds(g).length)}</span></div>
            ${g.notes ? `<p class="text-muted gym-notes">${esc(g.notes)}</p>` : ''}
            <button type="button" class="btn-sm btn-primary mgr-open" data-act="open">Ver y agregar ejercicios</button>
          </section>`).join('')
        : `<div class="empty-state"><span class="empty-icon">🏢</span><h3>Aún no tienes gimnasios</h3>
            <p>Crea uno y agrégale los ejercicios y máquinas que tiene.</p></div>`}`;
    };

    host.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const card = btn.closest('[data-id]');
      const id = card && card.dataset.id;
      switch (btn.dataset.act) {
        case 'new': return gymForm(null, paint);
        case 'edit': return gymForm(id, paint);
        case 'open': return openGym(id, paint);
        case 'delete': return deleteGym(id, paint);
      }
    });

    UI.openModal({
      title: '🏢 Mis gimnasios',
      bodyEl: host,
      wide: true,
      hideFooter: true,
      onOpen: paint,
      onClose: () => { if (opts.onClose) opts.onClose(); }
    });
  }

  function gymForm(id, done) {
    const cur = id ? get(id) : null;
    UI.openModal({
      title: cur ? 'Editar gimnasio' : 'Nuevo gimnasio',
      body: `
        <label class="field"><span>Nombre del gimnasio</span>
          <input type="text" id="gy-name" maxlength="60" value="${esc(cur ? cur.name : '')}" placeholder="Ej. Smart Fit Centro, Gimnasio de casa"></label>
        <label class="field" style="margin-top:var(--space-3);"><span>Notas (opcional)</span>
          <textarea id="gy-notes" rows="2" placeholder="Dirección, horario, equipo que le falta...">${esc(cur ? cur.notes || '' : '')}</textarea></label>`,
      confirmLabel: cur ? 'Guardar cambios' : 'Crear gimnasio',
      onConfirm: () => {
        const name = document.getElementById('gy-name').value.trim();
        const notes = document.getElementById('gy-notes').value.trim();
        try { checkName(name, cur && cur.id); } catch (err) { Utils.toast(err.message, 'danger'); return false; }
        if (cur) Storage.update('gyms', cur.id, { name, notes });
        else Storage.insert('gyms', { name, notes, exerciseIds: [] });
        Utils.toast(cur ? 'Gimnasio actualizado' : 'Gimnasio creado', 'success');
        done && done();
      }
    });
    setTimeout(() => { const i = document.getElementById('gy-name'); if (i) i.focus(); }, 50);
  }

  function deleteGym(id, done) {
    const g = get(id);
    if (!g) return;
    UI.confirm(`¿Eliminar el gimnasio "${esc(g.name)}"? Los ejercicios no se borran de la biblioteca, solo dejan de estar asignados a él.`, () => {
      Storage.remove('gyms', id);
      Utils.toast('Gimnasio eliminado', 'info');
      done && done();
    });
  }

  /* ---------------- Ejercicios de un gimnasio ---------------- */

  function openGym(gymId, done) {
    const g0 = get(gymId);
    if (!g0) return;
    const host = document.createElement('div');
    let search = '';

    host.innerHTML = `
      ${g0.notes ? `<p class="text-muted gym-notes">${esc(g0.notes)}</p>` : ''}
      <div class="mgr-actions">
        <button type="button" class="btn-primary btn-sm" id="gy-add">+ Agregar ejercicios de la biblioteca</button>
        <button type="button" class="btn-secondary btn-sm" id="gy-new">+ Crear ejercicio o máquina nueva</button>
      </div>
      <input type="search" id="gy-search" class="search-input gym-search" placeholder="Buscar en este gimnasio..." aria-label="Buscar en este gimnasio">
      <div id="gy-list"></div>`;

    const paintList = () => {
      const g = get(gymId);
      const list = host.querySelector('#gy-list');
      if (!g) { list.innerHTML = ''; return; }
      const items = exerciseIds(g).map(id => Exercises.get(id))
        .filter(ex => ex && (!search || ex.name.toLowerCase().includes(search.toLowerCase())));
      if (!items.length) {
        list.innerHTML = `<div class="empty-state"><span class="empty-icon">🏋️</span>
          <h3>${search ? 'Sin resultados' : 'Este gimnasio no tiene ejercicios'}</h3>
          <p>${search ? 'Prueba con otro nombre.' : 'Agrega los que ya tienes en la biblioteca o crea una máquina nueva.'}</p></div>`;
        return;
      }
      // Agrupados por equipo (Máquina, Polea, Mancuernas...) para ver qué tiene el gimnasio de un vistazo
      const groups = {};
      items.forEach(ex => { (groups[ex.equipment || 'Sin equipo'] = groups[ex.equipment || 'Sin equipo'] || []).push(ex); });
      const order = k => { const i = Exercises.EQUIPMENT.indexOf(k); return i < 0 ? 99 : i; };
      list.innerHTML = Object.keys(groups).sort((a, b) => order(a) - order(b)).map(eq => `
        <section class="mgr-group">
          <header class="mgr-group-head"><h4>🏋️ ${esc(eq)} <span class="chip">${groups[eq].length}</span></h4></header>
          ${groups[eq].sort(byName).map(ex => `
            <div class="mgr-row" data-ex="${esc(ex.id)}">
              <div class="mgr-row-main"><strong>${esc(ex.name)}</strong><span class="chip">${esc(muscleNames(ex))}</span></div>
              <div class="mgr-row-actions">
                <button type="button" class="btn-icon-sm" data-act="rm" title="Quitar de este gimnasio" aria-label="Quitar ${esc(ex.name)} de este gimnasio">✕</button>
              </div>
            </div>`).join('')}
        </section>`).join('');
    };

    host.addEventListener('click', e => {
      const btn = e.target.closest('[data-act="rm"]');
      if (!btn) return;
      removeFromGym(gymId, btn.closest('[data-ex]').dataset.ex);
      Utils.toast('Quitado del gimnasio', 'info');
      paintList();
    });
    host.querySelector('#gy-add').addEventListener('click', () => openPicker(gymId, paintList));
    host.querySelector('#gy-new').addEventListener('click', () => Exercises.openModal(null, paintList, { gymId }));
    host.querySelector('#gy-search').addEventListener('input', Utils.debounce(e => { search = e.target.value; paintList(); }, 150));

    UI.openModal({
      title: `🏢 ${g0.name}`,
      bodyEl: host,
      wide: true,
      hideFooter: true,
      onOpen: paintList,
      onClose: () => { if (done) done(); }
    });
  }

  /* ---------------- Agregar ejercicios de la biblioteca (selección múltiple) ---------------- */

  function openPicker(gymId, onDone) {
    const g = get(gymId);
    if (!g) return;
    const have = new Set(g.exerciseIds || []);
    const selected = new Set();
    const f = { search: '', equipment: '', muscle: '' };
    const host = document.createElement('div');

    host.innerHTML = `
      <p class="text-muted" style="font-size:var(--fs-sm);">Marca los ejercicios que tiene este gimnasio. Puedes filtrar por equipo o músculo y marcar todos los que se ven de una vez (por ejemplo, todas las máquinas).</p>
      <div class="filter-bar">
        <input type="search" id="gp-search" class="search-input" placeholder="Buscar ejercicio..." aria-label="Buscar ejercicio">
        <select id="gp-eq" class="filter-select" aria-label="Equipo">
          <option value="">Todo el equipo</option>
          ${Exercises.EQUIPMENT.map(eq => `<option>${esc(eq)}</option>`).join('')}
        </select>
        <select id="gp-muscle" class="filter-select" aria-label="Músculo">
          <option value="">Todos los músculos</option>
          ${MuscleMap.groups().filter(gr => gr.muscles.length).map(gr => `<optgroup label="${esc(gr.label)}">${gr.muscles.map(id => `<option value="${esc(id)}">${esc(MuscleMap.muscleLabel(id))}</option>`).join('')}</optgroup>`).join('')}
        </select>
      </div>
      <div class="gym-pick-actions">
        <button type="button" class="btn-sm btn-secondary" id="gp-all">Marcar los que se ven</button>
        <button type="button" class="btn-sm btn-secondary" id="gp-none">Quitar marcas</button>
        <span class="gym-count" id="gp-count"></span>
      </div>
      <div class="gym-pick-list" id="gp-list"></div>`;

    const visible = () => Exercises.all()
      .filter(ex => !have.has(ex.id) && Exercises.matches(ex, { muscle: f.muscle || null, equipment: f.equipment, search: f.search }))
      .sort(byName);

    const updateCount = () => {
      host.querySelector('#gp-count').textContent = selected.size ? `${selected.size} marcado${selected.size === 1 ? '' : 's'}` : '';
      const btn = document.getElementById('modal-confirm');
      if (btn) btn.textContent = selected.size ? `Agregar (${selected.size})` : 'Agregar';
    };

    const paintList = () => {
      const list = visible();
      host.querySelector('#gp-list').innerHTML = list.length
        ? list.map(ex => `
          <label class="section-check gym-pick-row">
            <input type="checkbox" data-id="${esc(ex.id)}" ${selected.has(ex.id) ? 'checked' : ''}>
            <span>${esc(ex.name)}<span class="gym-meta">${esc(muscleNames(ex))} · ${esc(ex.equipment || 'Sin equipo')}</span></span>
          </label>`).join('')
        : `<div class="empty-state"><span class="empty-icon">✅</span><h3>${have.size && !f.search && !f.equipment && !f.muscle ? 'Ya agregaste toda la biblioteca' : 'Sin resultados'}</h3>
            <p>Prueba con otros filtros o crea un ejercicio nuevo desde el gimnasio.</p></div>`;
    };

    host.addEventListener('change', e => {
      const cb = e.target.closest('input[data-id]');
      if (!cb) return;
      if (cb.checked) selected.add(cb.dataset.id); else selected.delete(cb.dataset.id);
      updateCount();
    });
    host.querySelector('#gp-search').addEventListener('input', Utils.debounce(e => { f.search = e.target.value; paintList(); }, 150));
    host.querySelector('#gp-eq').addEventListener('change', e => { f.equipment = e.target.value; paintList(); });
    host.querySelector('#gp-muscle').addEventListener('change', e => { f.muscle = e.target.value; paintList(); });
    host.querySelector('#gp-all').addEventListener('click', () => { visible().forEach(ex => selected.add(ex.id)); paintList(); updateCount(); });
    host.querySelector('#gp-none').addEventListener('click', () => { selected.clear(); paintList(); updateCount(); });

    UI.openModal({
      title: `Agregar a ${g.name}`,
      bodyEl: host,
      wide: true,
      confirmLabel: 'Agregar',
      onOpen: () => { paintList(); updateCount(); },
      onConfirm: () => {
        if (!selected.size) { Utils.toast('Marca al menos un ejercicio', 'danger'); return false; }
        addExercises(gymId, [...selected]);
        Utils.toast(`${countText(selected.size)} agregado${selected.size === 1 ? '' : 's'} a ${g.name}`, 'success');
        onDone && onDone();
      }
    });
  }

  return { all, get, exerciseIds, hasExercise, gymsOf, addExercises, removeFromGym, setForExercise,
           removeExerciseEverywhere, openManager, openGym, openPicker };
})();
