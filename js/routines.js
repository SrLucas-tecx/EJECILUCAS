/* ==========================================================================
   ROUTINES — constructor de rutinas por cliente + registro de entrenamientos
   Calcula volumen total, series efectivas y 1RM estimado (fórmula de Epley)
   ========================================================================== */

const Routines = (() => {

  function all(clientId) { return Storage.all('routines').filter(r => r.clientId === clientId); }
  function get(id) { return Storage.find('routines', id); }
  function logsOf(clientId) { return Storage.all('workoutLogs').filter(l => l.clientId === clientId); }

  function newDay(name) {
    return { id: Utils.uid('day'), name: name || `Día ${1}`, exercises: [] };
  }

  function renderPage(container) {
    const client = State.getActiveClient();
    if (!client) { container.innerHTML = UI.noClientMsg(); return; }

    const routines = all(client.id);
    container.innerHTML = `
      <div class="section-header" style="justify-content:space-between;">
        <div><h2 class="section-title">Rutinas de ${Utils.escapeHtml(client.name)}</h2>
        <p class="text-muted">Crea rutinas por día, asigna ejercicios y registra el entrenamiento real.</p></div>
        <button class="btn-primary" id="rt-new">+ Nueva rutina</button>
      </div>
      <div class="routines-list" id="rt-list"></div>`;

    container.querySelector('#rt-new').addEventListener('click', () => openBuilder(null, () => renderPage(container)));
    const list = container.querySelector('#rt-list');
    list.innerHTML = routines.length ? routines.map(routineCard).join('')
      : `<div class="empty-state"><span class="empty-icon">📋</span><h3>Sin rutinas todavía</h3><p>Crea la primera rutina para ${Utils.escapeHtml(client.name)}.</p></div>`;

    list.querySelectorAll('.routine-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('[data-act="edit"]').addEventListener('click', () => openBuilder(id, () => renderPage(container)));
      card.querySelector('[data-act="log"]').addEventListener('click', () => openLogger(id, () => renderPage(container)));
      card.querySelector('[data-act="delete"]').addEventListener('click', () => {
        UI.confirm('¿Eliminar esta rutina?', () => {
          Storage.remove('routines', id);
          Utils.toast('Rutina eliminada', 'info');
          renderPage(container);
        });
      });
    });
  }

  function routineCard(r) {
    const totalEx = r.days.reduce((n, d) => n + d.exercises.length, 0);
    return `
    <article class="routine-card" data-id="${r.id}">
      <div class="routine-card-top">
        <h3>${Utils.escapeHtml(r.name)}</h3>
        <span class="badge">${r.days.length} días · ${totalEx} ejercicios</span>
      </div>
      <div class="chip-row">${r.days.map(d => `<span class="chip">${Utils.escapeHtml(d.name)}</span>`).join('')}</div>
      <div class="client-card-actions">
        <button class="btn-sm btn-secondary" data-act="edit">✏️ Editar</button>
        <button class="btn-sm btn-primary" data-act="log">🏋️ Registrar entrenamiento</button>
        <button class="btn-icon-sm" data-act="delete" title="Eliminar">🗑️</button>
      </div>
    </article>`;
  }

  /* ---------------- Constructor de rutina ---------------- */

  function openBuilder(routineId, onDone) {
    const client = State.getActiveClient();
    const editing = routineId ? get(routineId) : null;
    const draft = editing ? JSON.parse(JSON.stringify(editing)) : { clientId: client.id, name: '', days: [newDay('Día 1')] };

    const bodyHost = document.createElement('div');
    const paint = () => { bodyHost.innerHTML = builderMarkup(draft); wireBuilder(bodyHost, draft, paint); };

    UI.openModal({
      title: editing ? 'Editar rutina' : 'Nueva rutina',
      bodyEl: bodyHost,
      wide: true,
      confirmLabel: 'Guardar rutina',
      onConfirm: () => {
        const name = bodyHost.querySelector('#rt-name').value.trim();
        if (!name) { Utils.toast('Ponle nombre a la rutina', 'danger'); return false; }
        draft.name = name;
        if (!draft.days.some(d => d.exercises.length)) { Utils.toast('Agrega al menos un ejercicio', 'danger'); return false; }
        if (editing) Storage.update('routines', editing.id, draft);
        else Storage.insert('routines', draft);
        Utils.toast('Rutina guardada', 'success');
        onDone && onDone();
      },
      onOpen: paint
    });
  }

  function builderMarkup(draft) {
    return `
      <label class="field field-wide"><span>Nombre de la rutina</span>
        <input type="text" id="rt-name" value="${Utils.escapeHtml(draft.name)}" placeholder="Ej. Fuerza 4 días - Ana"></label>
      <div class="rt-days-tabs" id="rt-days-tabs">
        ${draft.days.map((d, i) => `<button type="button" class="rt-day-tab ${i === 0 ? 'active' : ''}" data-i="${i}">${Utils.escapeHtml(d.name)}</button>`).join('')}
        <button type="button" class="rt-day-add" id="rt-day-add">+ Día</button>
      </div>
      <div id="rt-day-panels">
        ${draft.days.map((d, i) => dayPanel(d, i)).join('')}
      </div>`;
  }

  function dayPanel(day, i) {
    return `
    <div class="rt-day-panel" data-i="${i}" style="display:${i === 0 ? '' : 'none'}">
      <div class="field-inline">
        <input type="text" class="rt-day-name" data-i="${i}" value="${Utils.escapeHtml(day.name)}">
        <button type="button" class="btn-icon-sm rt-day-remove" data-i="${i}" title="Eliminar día">🗑️</button>
      </div>
      <table class="table-compact">
        <thead><tr><th>Ejercicio</th><th>Series</th><th>Reps objetivo</th><th>Peso objetivo</th><th>RIR</th><th></th></tr></thead>
        <tbody>
          ${day.exercises.map((ex, j) => exerciseRow(ex, i, j)).join('') || `<tr><td colspan="6" class="text-muted">Sin ejercicios en este día</td></tr>`}
        </tbody>
      </table>
      <button type="button" class="btn-sm btn-secondary rt-add-ex" data-i="${i}">+ Agregar ejercicio</button>
    </div>`;
  }

  function exerciseRow(ex, dayI, exI) {
    const meta = Exercises.get(ex.exerciseId);
    return `<tr data-i="${dayI}" data-j="${exI}">
      <td>${meta ? Utils.escapeHtml(meta.name) : '(ejercicio eliminado)'}</td>
      <td><input type="number" min="1" class="rt-input" data-f="sets" value="${ex.sets ?? 3}"></td>
      <td><input type="text" class="rt-input" data-f="reps" value="${ex.reps ?? '8-12'}"></td>
      <td><input type="number" min="0" step="0.5" class="rt-input" data-f="weight" value="${ex.weight ?? ''}"></td>
      <td><input type="number" min="0" max="10" class="rt-input" data-f="rir" value="${ex.rir ?? ''}"></td>
      <td><button type="button" class="btn-icon-sm rt-ex-remove" data-i="${dayI}" data-j="${exI}">✕</button></td>
    </tr>`;
  }

  function wireBuilder(host, draft, paint) {
    host.querySelectorAll('.rt-day-tab').forEach(tab => tab.addEventListener('click', () => {
      host.querySelectorAll('.rt-day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const i = tab.dataset.i;
      host.querySelectorAll('.rt-day-panel').forEach(p => p.style.display = p.dataset.i === i ? '' : 'none');
    }));

    host.querySelector('#rt-day-add').addEventListener('click', () => {
      draft.days.push(newDay(`Día ${draft.days.length + 1}`));
      paint();
    });

    host.querySelectorAll('.rt-day-name').forEach(inp => inp.addEventListener('input', e => {
      draft.days[e.target.dataset.i].name = e.target.value;
      host.querySelectorAll('.rt-day-tab')[e.target.dataset.i].textContent = e.target.value || `Día ${Number(e.target.dataset.i) + 1}`;
    }));

    host.querySelectorAll('.rt-day-remove').forEach(btn => btn.addEventListener('click', () => {
      if (draft.days.length === 1) { Utils.toast('La rutina necesita al menos un día', 'danger'); return; }
      draft.days.splice(btn.dataset.i, 1);
      paint();
    }));

    host.querySelectorAll('.rt-add-ex').forEach(btn => btn.addEventListener('click', () => {
      const dayI = Number(btn.dataset.i);
      pickExerciseDialog(exId => {
        draft.days[dayI].exercises.push({ exerciseId: exId, sets: 3, reps: '8-12', weight: '', rir: '' });
        paint();
      });
    }));

    host.querySelectorAll('.rt-ex-remove').forEach(btn => btn.addEventListener('click', () => {
      draft.days[btn.dataset.i].exercises.splice(btn.dataset.j, 1);
      paint();
    }));

    host.querySelectorAll('.rt-input').forEach(inp => inp.addEventListener('input', e => {
      const tr = e.target.closest('tr');
      const i = tr.dataset.i, j = tr.dataset.j, f = e.target.dataset.f;
      draft.days[i].exercises[j][f] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    }));
  }

  function pickExerciseDialog(onPick) {
    const host = document.createElement('div');
    UI.openModal({
      title: 'Elige un ejercicio',
      bodyEl: host,
      wide: true,
      hideFooter: true,
      onOpen: () => Exercises.renderLibrary(host, { pickable: true, onPick: id => { UI.closeModal(); onPick(id); } })
    });
  }

  /* ---------------- Registro de entrenamiento (logger) ---------------- */

  function openLogger(routineId, onDone) {
    const routine = get(routineId);
    const client = State.getActiveClient();
    const host = document.createElement('div');
    let dayIndex = 0;
    let logDraft = null;

    const buildDraft = () => {
      const day = routine.days[dayIndex];
      logDraft = {
        clientId: client.id, routineId: routine.id, dayId: day.id, date: Utils.todayISO(), minutes: '',
        entries: day.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          sets: Array.from({ length: Number(ex.sets) || 1 }, () => ({ weight: ex.weight || '', reps: '', rpe: '', rir: '' }))
        }))
      };
    };

    const paint = () => {
      host.innerHTML = loggerMarkup(routine, dayIndex, logDraft);
      wireLogger(host, routine, logDraft, (i) => { dayIndex = i; buildDraft(); paint(); }, refreshSummary);
      refreshSummary();
    };
    const refreshSummary = () => {
      const sum = host.querySelector('#log-summary');
      if (!sum) return;
      const allSets = logDraft.entries.flatMap(e => e.sets).filter(s => s.weight !== '' && s.reps !== '');
      const vol = Utils.totalVolume(allSets);
      const eff = Utils.effectiveSets(allSets);
      sum.innerHTML = `<strong>${vol} kg</strong> volumen total · <strong>${eff}</strong> series efectivas · <strong>${allSets.length}</strong> series registradas`;
    };

    buildDraft();

    UI.openModal({
      title: `Registrar: ${routine.name}`,
      bodyEl: host,
      wide: true,
      confirmLabel: 'Guardar entrenamiento',
      onConfirm: () => {
        const cleaned = { ...logDraft, entries: logDraft.entries.map(e => ({ ...e, sets: e.sets.filter(s => s.weight !== '' && s.reps !== '') })).filter(e => e.sets.length) };
        if (!cleaned.entries.length) { Utils.toast('Registra al menos una serie', 'danger'); return false; }
        Storage.insert('workoutLogs', cleaned);
        Utils.toast('Entrenamiento registrado', 'success');
        onDone && onDone();
      },
      onOpen: paint
    });
  }

  function loggerMarkup(routine, dayIndex, draft) {
    return `
      <div class="rt-days-tabs">
        ${routine.days.map((d, i) => `<button type="button" class="rt-day-tab ${i === dayIndex ? 'active' : ''}" data-i="${i}">${Utils.escapeHtml(d.name)}</button>`).join('')}
      </div>
      <div class="field-inline" style="margin:var(--space-2) 0;">
        <label class="field"><span>Fecha</span><input type="date" id="log-date" value="${draft.date}"></label>
        <label class="field"><span>Duración (min)</span><input type="number" id="log-minutes" value="${draft.minutes}" min="0"></label>
      </div>
      <div id="log-summary" class="log-summary"></div>
      ${draft.entries.map((entry, i) => {
        const meta = Exercises.get(entry.exerciseId);
        return `
        <div class="log-exercise">
          <h4>${meta ? Utils.escapeHtml(meta.name) : 'Ejercicio'}</h4>
          <table class="table-compact">
            <thead><tr><th>Serie</th><th>Peso (kg)</th><th>Reps</th><th>RIR</th><th>RPE</th><th>1RM est.</th></tr></thead>
            <tbody>
              ${entry.sets.map((s, j) => `
                <tr data-i="${i}" data-j="${j}">
                  <td>${j + 1}</td>
                  <td><input type="number" min="0" step="0.5" class="rt-input" data-f="weight" value="${s.weight}"></td>
                  <td><input type="number" min="0" class="rt-input" data-f="reps" value="${s.reps}"></td>
                  <td><input type="number" min="0" max="10" class="rt-input" data-f="rir" value="${s.rir}"></td>
                  <td><input type="number" min="1" max="10" class="rt-input" data-f="rpe" value="${s.rpe}"></td>
                  <td class="rm-cell">${s.weight && s.reps ? Utils.estimate1RM(s.weight, s.reps) + ' kg' : '—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          <button type="button" class="btn-sm btn-secondary log-add-set" data-i="${i}">+ Serie</button>
        </div>`;
      }).join('')}`;
  }

  function wireLogger(host, routine, draft, onDayChange, refreshSummary) {
    host.querySelectorAll('.rt-day-tab').forEach(tab => tab.addEventListener('click', () => {
      onDayChange(Number(tab.dataset.i));
    }));
    host.querySelector('#log-date').addEventListener('input', e => draft.date = e.target.value);
    host.querySelector('#log-minutes').addEventListener('input', e => draft.minutes = Number(e.target.value) || '');

    host.querySelectorAll('.log-add-set').forEach(btn => btn.addEventListener('click', () => {
      draft.entries[btn.dataset.i].sets.push({ weight: '', reps: '', rpe: '', rir: '' });
      // repintar todo el logger del día actual conservando el draft
      host.innerHTML = loggerMarkup(routine, [...host.querySelectorAll('.rt-day-tab')].findIndex(t => t.classList.contains('active')), draft);
      wireLogger(host, routine, draft, onDayChange, refreshSummary);
      refreshSummary();
    }));

    host.querySelectorAll('.rt-input').forEach(inp => inp.addEventListener('input', e => {
      const tr = e.target.closest('tr');
      const i = tr.dataset.i, j = tr.dataset.j, f = e.target.dataset.f;
      draft.entries[i].sets[j][f] = e.target.value === '' ? '' : Number(e.target.value);
      const rmCell = tr.querySelector('.rm-cell');
      const s = draft.entries[i].sets[j];
      rmCell.textContent = (s.weight && s.reps) ? Utils.estimate1RM(s.weight, s.reps) + ' kg' : '—';
      refreshSummary();
    }));
  }

  return { all, get, logsOf, renderPage, openBuilder, openLogger };
})();
