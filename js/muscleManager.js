/* ==========================================================================
   MUSCLE MANAGER — ventana para agregar, editar y quitar músculos, y para
   crear secciones del cuerpo (Brazo y hombro, Torso, Pierna, o las tuyas).
   Los datos y las reglas viven en muscleMap.js; aquí solo está la pantalla.
   Se puede abrir desde el formulario de ejercicios, la biblioteca y Ajustes.
   ========================================================================== */

const MuscleManager = (() => {

  const esc = Utils.escapeHtml;

  /**
   * opts.onClose({ remap, changed }) se llama al cerrar.
   * remap: { idQuitado: idQueLoReemplaza | null } para que quien abrió la ventana
   * actualice lo que tenía seleccionado.
   */
  function open(opts = {}) {
    const host = document.createElement('div');
    const remap = {};
    let changed = false;

    const refresh = () => { changed = true; paint(); };

    function paint() {
      const groups = MuscleMap.groups();
      const all = MuscleMap.allMuscles();
      const hidden = all.filter(m => m.hidden);
      const byId = Object.fromEntries(all.map(m => [m.id, m]));

      host.innerHTML = `
        <p class="text-muted" style="font-size:var(--fs-sm);">Agrega músculos o secciones del cuerpo para entrenamientos más específicos. Los de fábrica no se borran: se ocultan y puedes restaurarlos.</p>
        <div class="mgr-actions">
          <button type="button" class="btn-primary btn-sm" data-act="add-muscle">+ Agregar músculo</button>
          <button type="button" class="btn-secondary btn-sm" data-act="add-group">+ Nueva sección</button>
        </div>
        ${groups.map(g => `
          <section class="mgr-group">
            <header class="mgr-group-head">
              <h4>${esc(g.label)}</h4>
              <div class="mgr-group-actions">
                <button type="button" class="btn-icon-sm" data-act="rename-group" data-id="${esc(g.id)}" title="Renombrar sección" aria-label="Renombrar sección">✏️</button>
                ${g.builtin ? '' : `<button type="button" class="btn-icon-sm" data-act="delete-group" data-id="${esc(g.id)}" title="Eliminar sección" aria-label="Eliminar sección">🗑️</button>`}
              </div>
            </header>
            ${g.muscles.length ? g.muscles.map(id => muscleRow(byId[id])).join('')
              : '<p class="text-muted" style="font-size:var(--fs-sm); margin:0;">Sin músculos en esta sección.</p>'}
          </section>`).join('')}
        ${hidden.length ? `
          <section class="mgr-group">
            <header class="mgr-group-head"><h4>Ocultos</h4></header>
            ${hidden.map(m => `
              <div class="mgr-row">
                <div class="mgr-row-main"><strong>${esc(m.label)}</strong></div>
                <button type="button" class="btn-sm btn-secondary" data-act="restore-muscle" data-id="${esc(m.id)}">Restaurar</button>
              </div>`).join('')}
          </section>` : ''}`;
    }

    function muscleRow(m) {
      const n = MuscleMap.usage(m.id).total;
      return `
        <div class="mgr-row">
          <div class="mgr-row-main">
            <strong>${esc(m.label)}</strong>
            <span class="chip">${MuscleMap.SIZES[m.size]}</span>
            <span class="chip">${n} ejercicio${n === 1 ? '' : 's'}</span>
            ${m.builtin ? '' : '<span class="chip chip-accent">Propio</span>'}
          </div>
          <div class="mgr-row-actions">
            <button type="button" class="btn-icon-sm" data-act="edit-muscle" data-id="${esc(m.id)}" title="Editar" aria-label="Editar ${esc(m.label)}">✏️</button>
            <button type="button" class="btn-icon-sm" data-act="remove-muscle" data-id="${esc(m.id)}" title="${m.builtin ? 'Ocultar' : 'Eliminar'}" aria-label="${m.builtin ? 'Ocultar' : 'Eliminar'} ${esc(m.label)}">🗑️</button>
          </div>
        </div>`;
    }

    host.addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      switch (btn.dataset.act) {
        case 'add-muscle': return muscleForm(null, refresh);
        case 'edit-muscle': return muscleForm(id, refresh);
        case 'remove-muscle': return removeFlow(id, remap, refresh);
        case 'restore-muscle': MuscleMap.restoreMuscle(id); Utils.toast('Músculo restaurado', 'success'); return refresh();
        case 'add-group': return groupForm(null, refresh);
        case 'rename-group': return groupForm(id, refresh);
        case 'delete-group': return deleteGroup(id, refresh);
      }
    });

    UI.openModal({
      title: '💪 Músculos y secciones del cuerpo',
      bodyEl: host,
      wide: true,
      hideFooter: true,
      onOpen: paint,
      onClose: () => { if (opts.onClose) opts.onClose({ remap, changed }); }
    });
  }

  /* ---------------- Agregar / editar músculo ---------------- */

  function muscleForm(id, done) {
    const cur = id ? MuscleMap.allMuscles().find(m => m.id === id) : null;
    const groups = MuscleMap.groups();
    const groupId = cur ? cur.group : groups[0].id;
    const size = cur ? cur.size : 'pequeno';

    UI.openModal({
      title: cur ? 'Editar músculo' : 'Agregar músculo',
      body: `
        <div class="form-grid">
          <label class="field field-wide"><span>Nombre</span>
            <input type="text" id="mgr-label" maxlength="40" value="${esc(cur ? cur.label : '')}" placeholder="Ej. Cuello, Aductores, Core profundo"></label>
          <label class="field"><span>Sección del cuerpo</span>
            <select id="mgr-group">${groups.map(g => `<option value="${esc(g.id)}" ${g.id === groupId ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}</select></label>
          <label class="field"><span>Tamaño del músculo</span>
            <select id="mgr-size">${Object.entries(MuscleMap.SIZES).map(([k, v]) => `<option value="${k}" ${k === size ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
        <p class="text-muted" style="font-size:var(--fs-xs); margin-top:var(--space-3);">${Help.term('tamanomuscular', 'Para qué sirve el tamaño')}</p>`,
      confirmLabel: cur ? 'Guardar cambios' : 'Agregar músculo',
      onConfirm: () => {
        const data = {
          label: document.getElementById('mgr-label').value,
          group: document.getElementById('mgr-group').value,
          size: document.getElementById('mgr-size').value
        };
        try {
          if (cur) MuscleMap.updateMuscle(cur.id, data); else MuscleMap.addMuscle(data);
        } catch (err) { Utils.toast(err.message, 'danger'); return false; }
        Utils.toast(cur ? 'Músculo actualizado' : 'Músculo agregado', 'success');
        done();
      }
    });
    setTimeout(() => { const i = document.getElementById('mgr-label'); if (i) i.focus(); }, 50);
  }

  /* ---------------- Quitar músculo (ocultar si es de fábrica) ---------------- */

  function removeFlow(id, remap, done) {
    const m = MuscleMap.allMuscles().find(x => x.id === id);
    if (!m) return;
    const u = MuscleMap.usage(id);
    const others = MuscleMap.groups().flatMap(g => g.muscles).filter(x => x !== id);
    // Si algún ejercicio solo tiene este músculo como principal, no puede quedarse sin ninguno
    const canDrop = u.soleOnly === 0;

    UI.openModal({
      title: m.builtin ? 'Ocultar músculo' : 'Eliminar músculo',
      body: `
        <p>${m.builtin
          ? `"${esc(m.label)}" es un músculo de fábrica: se ocultará de las listas y podrás restaurarlo cuando quieras.`
          : `Se eliminará "${esc(m.label)}".`}</p>
        ${u.total ? `
          <p>${u.total} ejercicio${u.total === 1 ? '' : 's'} lo ${u.total === 1 ? 'usa' : 'usan'}. ¿Qué hacemos con ${u.total === 1 ? 'él' : 'ellos'}?</p>
          <label class="field"><span>En esos ejercicios</span>
            <select id="mgr-replace">
              ${canDrop ? '<option value="">Solo quitar este músculo</option>' : ''}
              ${others.map(o => `<option value="${esc(o)}">Cambiarlo por ${esc(MuscleMap.muscleLabel(o))}</option>`).join('')}
            </select></label>
          ${canDrop ? '' : '<p class="text-muted" style="font-size:var(--fs-xs);">Algunos ejercicios solo tienen este músculo como principal, por eso hay que elegir con cuál reemplazarlo.</p>'}`
          : ''}`,
      confirmLabel: m.builtin ? 'Ocultar' : 'Eliminar',
      onConfirm: () => {
        let to = null;
        if (u.total) {
          to = document.getElementById('mgr-replace').value || null;
          MuscleMap.replaceInExercises(id, to);
          // lo que ya apuntaba a este músculo ahora apunta al reemplazo
          Object.keys(remap).forEach(k => { if (remap[k] === id) remap[k] = to; });
          remap[id] = to;
        }
        MuscleMap.removeMuscle(id);
        if (State.s.exerciseFilter.muscle === id) State.s.exerciseFilter.muscle = null;
        Utils.toast(m.builtin ? 'Músculo oculto' : 'Músculo eliminado', 'info');
        done();
      }
    });
  }

  /* ---------------- Secciones del cuerpo ---------------- */

  function groupForm(id, done) {
    const cur = id ? MuscleMap.groupList().find(g => g.id === id) : null;
    UI.openModal({
      title: cur ? 'Renombrar sección' : 'Nueva sección del cuerpo',
      body: `
        <label class="field"><span>Nombre de la sección</span>
          <input type="text" id="mgr-group-name" maxlength="40" value="${esc(cur ? cur.label : '')}" placeholder="Ej. Core, Cuello y trapecio, Movilidad"></label>`,
      confirmLabel: cur ? 'Guardar' : 'Crear sección',
      onConfirm: () => {
        const name = document.getElementById('mgr-group-name').value;
        try {
          if (cur) MuscleMap.renameGroup(cur.id, name); else MuscleMap.addGroup(name);
        } catch (err) { Utils.toast(err.message, 'danger'); return false; }
        Utils.toast(cur ? 'Sección actualizada' : 'Sección creada', 'success');
        done();
      }
    });
    setTimeout(() => { const i = document.getElementById('mgr-group-name'); if (i) i.focus(); }, 50);
  }

  function deleteGroup(id, done) {
    const g = MuscleMap.groups({ includeHidden: true }).find(x => x.id === id);
    if (!g) return;
    if (g.muscles.length) { Utils.toast('Mueve primero los músculos de esta sección a otra (con ✏️ en cada músculo)', 'danger'); return; }
    UI.confirm(`¿Eliminar la sección "${esc(g.label)}"?`, () => {
      try { MuscleMap.removeGroup(id); } catch (err) { Utils.toast(err.message, 'danger'); return; }
      Utils.toast('Sección eliminada', 'info');
      done();
    });
  }

  return { open };
})();
