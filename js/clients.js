/* ==========================================================================
   CLIENTS — alta/edición/borrado de clientes y selector de cliente activo
   (equivalente al selector de "bazar activo", aquí aplicado a clientes)
   ========================================================================== */

const Clients = (() => {

  const GOALS = ['Pérdida de grasa', 'Ganancia muscular', 'Rendimiento deportivo', 'Salud general', 'Rehabilitación'];

  function all() { return Storage.all('clients'); }
  function get(id) { return Storage.find('clients', id); }

  function renderSwitcher() {
    const sel = document.getElementById('client-select-global');
    if (!sel) return;
    const list = all();
    sel.innerHTML = list.length
      ? list.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')
      : `<option value="">Sin clientes</option>`;
    sel.value = State.s.activeClientId || '';
  }

  function switchClient(id) {
    State.setActiveClient(id || null);
    UI.refreshActiveClientBanner();
    UI.renderCurrentTab();
  }

  function createClient() { openModal(null); }

  function openModal(id) {
    const editing = id ? get(id) : null;
    const body = `
      <div class="form-grid">
        <label class="field"><span>Nombre completo</span>
          <input type="text" id="f-name" value="${editing ? Utils.escapeHtml(editing.name) : ''}" placeholder="Ej. Ana Torres" required></label>
        <label class="field"><span>Objetivo principal</span>
          <select id="f-goal">${GOALS.map(g => `<option ${editing?.goal === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
        <label class="field"><span>Correo</span>
          <input type="email" id="f-email" value="${editing ? Utils.escapeHtml(editing.email || '') : ''}"></label>
        <label class="field"><span>Teléfono</span>
          <input type="tel" id="f-phone" value="${editing ? Utils.escapeHtml(editing.phone || '') : ''}"></label>
        <label class="field"><span>Fecha de nacimiento</span>
          <input type="date" id="f-birth" value="${editing?.birthdate || ''}"></label>
        <label class="field"><span>Altura (cm)</span>
          <input type="number" id="f-height" value="${editing?.height || ''}" min="0"></label>
        <label class="field"><span>Fecha de inicio</span>
          <input type="date" id="f-start" value="${editing?.startDate || Utils.todayISO()}"></label>
        <label class="field"><span>Meta calórica diaria (kcal)</span>
          <input type="number" id="f-kcal" value="${editing?.targetCalories || ''}" min="0"></label>
        <label class="field field-wide"><span>Notas</span>
          <textarea id="f-notes" rows="3" placeholder="Lesiones, preferencias, disponibilidad...">${editing ? Utils.escapeHtml(editing.notes || '') : ''}</textarea></label>
      </div>`;

    UI.openModal({
      title: editing ? 'Editar cliente' : 'Nuevo cliente',
      body,
      confirmLabel: editing ? 'Guardar cambios' : 'Crear cliente',
      onConfirm: () => {
        const name = document.getElementById('f-name').value.trim();
        if (!name) { Utils.toast('El nombre es obligatorio', 'danger'); return false; }
        const data = {
          name,
          goal: document.getElementById('f-goal').value,
          email: document.getElementById('f-email').value.trim(),
          phone: document.getElementById('f-phone').value.trim(),
          birthdate: document.getElementById('f-birth').value,
          height: Number(document.getElementById('f-height').value) || null,
          startDate: document.getElementById('f-start').value || Utils.todayISO(),
          targetCalories: Number(document.getElementById('f-kcal').value) || null,
          notes: document.getElementById('f-notes').value.trim()
        };
        if (editing) {
          Storage.update('clients', editing.id, data);
          Utils.toast('Cliente actualizado', 'success');
        } else {
          const created = Storage.insert('clients', data);
          Utils.toast('Cliente creado', 'success');
          State.setActiveClient(created.id);
        }
        renderSwitcher();
        UI.refreshActiveClientBanner();
        UI.renderCurrentTab();
      }
    });
  }

  function deleteClient(id) {
    const c = get(id);
    if (!c) return;
    UI.confirm(`¿Eliminar a "${c.name}"? Se borrarán también sus rutinas, registros de nutrición y progreso.`, () => {
      Storage.remove('clients', id);
      Storage.removeWhere('routines', r => r.clientId === id);
      Storage.removeWhere('workoutLogs', r => r.clientId === id);
      Storage.removeWhere('nutritionLogs', r => r.clientId === id);
      Storage.removeWhere('progressLogs', r => r.clientId === id);
      if (State.s.activeClientId === id) {
        State.setActiveClient(all()[0]?.id || null);
      }
      renderSwitcher();
      UI.refreshActiveClientBanner();
      UI.renderCurrentTab();
      Utils.toast('Cliente eliminado', 'info');
    });
  }

  function card(c) {
    const isActive = c.id === State.s.activeClientId;
    const a = Utils.age(c.birthdate);
    const lastProgress = Storage.all('progressLogs').filter(p => p.clientId === c.id).sort((x, y) => y.date.localeCompare(x.date))[0];
    return `
    <article class="client-card ${isActive ? 'is-active' : ''}" data-id="${c.id}">
      <div class="client-card-top">
        <div class="avatar">${Utils.initials(c.name)}</div>
        <div class="client-card-info">
          <h3>${Utils.escapeHtml(c.name)}</h3>
          <span class="text-muted" style="font-size:var(--fs-xs)">${c.goal || 'Sin objetivo definido'}${a ? ' · ' + a + ' años' : ''}</span>
        </div>
        ${isActive ? '<span class="badge badge-accent">Activo</span>' : ''}
      </div>
      <div class="client-card-stats">
        <div><strong>${lastProgress ? lastProgress.weight + ' kg' : '—'}</strong><span>Último peso</span></div>
        <div><strong>${Storage.all('routines').filter(r => r.clientId === c.id).length}</strong><span>Rutinas</span></div>
        <div><strong>${Utils.formatDate(c.startDate, { withYear: false })}</strong><span>Desde</span></div>
      </div>
      <div class="client-card-actions">
        <button class="btn-sm btn-secondary" data-act="select">${isActive ? '✓ Activo' : 'Usar cliente'}</button>
        <button class="btn-icon-sm" data-act="edit" title="Editar">✏️</button>
        <button class="btn-icon-sm" data-act="delete" title="Eliminar">🗑️</button>
      </div>
    </article>`;
  }

  function renderList(container) {
    if (!container) return;
    const list = all();
    container.innerHTML = list.length
      ? list.map(card).join('')
      : `<div class="empty-state">
           <span class="empty-icon">🧑‍🤝‍🧑</span>
           <h3>Aún no tienes clientes</h3>
           <p>Agrega tu primer cliente para empezar a planear rutinas, nutrición y progreso.</p>
           <button class="btn-primary" onclick="Clients.createClient()">+ Nuevo cliente</button>
         </div>`;

    container.querySelectorAll('.client-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('[data-act="select"]').addEventListener('click', () => {
        switchClient(id);
        renderSwitcher();
        renderList(container);
      });
      card.querySelector('[data-act="edit"]').addEventListener('click', () => openModal(id));
      card.querySelector('[data-act="delete"]').addEventListener('click', () => deleteClient(id));
    });
  }

  return { GOALS, all, get, renderSwitcher, switchClient, createClient, openModal, deleteClient, renderList };
})();
