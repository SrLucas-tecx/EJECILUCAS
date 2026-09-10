/* ==========================================================================
   UI — navegación de pestañas, modal genérico, dashboard y copia de seguridad
   ========================================================================== */

const UI = (() => {

  const TAB_TITLES = {
    dashboard: 'Resumen',
    clientes: 'Clientes',
    ejercicios: 'Biblioteca de ejercicios',
    rutinas: 'Rutinas de entrenamiento',
    alimentacion: 'Alimentación',
    progreso: 'Progreso',
    ajustes: 'Ajustes'
  };

  function noClientMsg() {
    return `<div class="empty-state">
      <span class="empty-icon">🧑‍🤝‍🧑</span>
      <h3>Elige o crea un cliente</h3>
      <p>Selecciona un cliente activo arriba, o crea uno nuevo para empezar a trabajar.</p>
      <button class="btn-primary" onclick="Clients.createClient()">+ Nuevo cliente</button>
    </div>`;
  }

  function switchTab(tab) {
    State.setTab(tab);
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('page-title').textContent = TAB_TITLES[tab] || '';
    renderCurrentTab();
    document.querySelector('.page-content')?.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    if (window.innerWidth <= 860) document.querySelector('.app-layout').classList.remove('sidebar-open');
  }

  function renderCurrentTab() {
    const container = document.getElementById('page-content');
    const tab = State.s.activeTab;
    if (tab === 'dashboard') return renderDashboard(container);
    if (tab === 'clientes') return container.innerHTML = `<div class="section-header" style="justify-content:space-between;">
        <div><h2 class="section-title">Tus clientes</h2><p class="text-muted">Cambia de cliente activo o gestiona su información.</p></div>
        <button class="btn-primary" onclick="Clients.createClient()">+ Nuevo cliente</button>
      </div><div class="cards-grid clients-grid"></div>`, Clients.renderList(container.querySelector('.clients-grid'));
    if (tab === 'ejercicios') return Exercises.renderLibrary(container);
    if (tab === 'rutinas') return Routines.renderPage(container);
    if (tab === 'alimentacion') return Nutrition.renderPage(container);
    if (tab === 'progreso') return Progress.renderPage(container);
    if (tab === 'ajustes') return renderSettings(container);
  }

  function refreshActiveClientBanner() {
    const el = document.getElementById('active-client-banner');
    const c = State.getActiveClient();
    if (!el) return;
    el.innerHTML = c
      ? `<span class="avatar avatar-sm">${Utils.initials(c.name)}</span><span>${Utils.escapeHtml(c.name)}</span>`
      : `<span class="text-muted">Sin cliente activo</span>`;
  }

  /* ---------------- Dashboard ---------------- */

  function renderDashboard(container) {
    const client = State.getActiveClient();
    const totalClients = Clients.all().length;
    const totalExercises = Exercises.all().length;
    const totalRoutines = Storage.all('routines').length;

    if (!client) {
      container.innerHTML = `
        <div class="hero-card">
          <div>
            <h2>Bienvenido a PULSO</h2>
            <p>Tu centro de control para entrenar clientes: rutinas, ejercicios con tutoriales, alimentación y progreso — todo guardado en este navegador.</p>
            <button class="btn-primary" onclick="Clients.createClient()">+ Agregar tu primer cliente</button>
          </div>
        </div>
        <div class="stat-cards" style="margin-top:var(--space-4);">
          <div class="stat-card"><span>Clientes</span><strong>${totalClients}</strong></div>
          <div class="stat-card"><span>Ejercicios en biblioteca</span><strong>${totalExercises}</strong></div>
          <div class="stat-card"><span>Rutinas creadas</span><strong>${totalRoutines}</strong></div>
        </div>`;
      return;
    }

    const progressLogs = Progress.logsOf(client.id);
    const last = progressLogs[progressLogs.length - 1];
    const nutriLog = Nutrition.logOfDate(client.id, Utils.todayISO());
    const kcalToday = Nutrition.totals(nutriLog).kcal;
    const routines = Routines.all(client.id);
    const recentWorkouts = Routines.logsOf(client.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

    container.innerHTML = `
      <div class="hero-card hero-card-client">
        <div class="avatar avatar-lg">${Utils.initials(client.name)}</div>
        <div>
          <h2>${Utils.escapeHtml(client.name)}</h2>
          <p class="text-muted">${client.goal || 'Sin objetivo definido'} · Cliente desde ${Utils.formatDate(client.startDate)}</p>
        </div>
      </div>

      <div class="stat-cards">
        <div class="stat-card"><span>Peso actual</span><strong>${last ? last.weight + ' kg' : 'Sin registros'}</strong></div>
        <div class="stat-card"><span>Kcal hoy</span><strong>${kcalToday}${client.targetCalories ? ' / ' + client.targetCalories : ''}</strong></div>
        <div class="stat-card"><span>Rutinas activas</span><strong>${routines.length}</strong></div>
        <div class="stat-card"><span>Entrenamientos registrados</span><strong>${Routines.logsOf(client.id).length}</strong></div>
      </div>

      <div class="dash-columns">
        <div class="chart-card">
          <h4>Últimos entrenamientos</h4>
          ${recentWorkouts.length ? `<ul class="simple-list">${recentWorkouts.map(w => {
            const vol = w.entries.reduce((s, e) => s + Utils.totalVolume(e.sets), 0);
            return `<li><strong>${Utils.formatDate(w.date, { withYear: false })}</strong> — ${Utils.round(vol, 0)} kg de volumen</li>`;
          }).join('')}</ul>` : `<p class="text-muted">Aún no hay entrenamientos registrados.</p>`}
        </div>
        <div class="chart-card">
          <h4>Evolución de peso</h4>
          <canvas id="dash-weight-chart" height="110"></canvas>
        </div>
      </div>`;

    if (progressLogs.length) {
      const canvas = document.getElementById('dash-weight-chart');
      if (canvas._chart) canvas._chart.destroy();
      canvas._chart = new Chart(canvas, {
        type: 'line',
        data: { labels: progressLogs.map(p => Utils.formatDate(p.date, { withYear: false, short: true })),
          datasets: [{ data: progressLogs.map(p => p.weight), borderColor: '#5EEAD4', backgroundColor: 'rgba(94,234,212,.15)', fill: true, pointBackgroundColor: '#5EEAD4' }] },
        options: Charts.lineOptions()
      });
    }
  }

  /* ---------------- Ajustes / respaldo ---------------- */

  function renderSettings(container) {
    container.innerHTML = `
      <div class="section-header"><h2 class="section-title">Ajustes y copia de seguridad</h2><p class="text-muted">Todo se guarda localmente en este navegador. Exporta seguido para no perder información.</p></div>
      <div class="settings-grid">
        <div class="settings-card">
          <h4>💾 Copia de seguridad</h4>
          <p class="text-muted">Descarga todos tus datos (clientes, rutinas, nutrición, progreso) en un archivo JSON.</p>
          <button class="btn-primary" id="st-export">📄 Exportar datos (JSON)</button>
          <label class="btn-secondary" style="display:inline-flex;cursor:pointer;">📥 Importar datos
            <input type="file" id="st-import" accept=".json" style="display:none">
          </label>
        </div>
        <div class="settings-card">
          <h4>🎨 Apariencia</h4>
          <label class="switch-row"><span>Modo oscuro</span>
            <input type="checkbox" id="st-dark" ${Storage.get().settings.darkMode ? 'checked' : ''}></label>
          <label class="field"><span>Unidades de peso</span>
            <select id="st-units">
              <option value="kg" ${Storage.get().settings.units === 'kg' ? 'selected' : ''}>Kilogramos (kg)</option>
              <option value="lb" ${Storage.get().settings.units === 'lb' ? 'selected' : ''}>Libras (lb)</option>
            </select></label>
        </div>
        <div class="settings-card">
          <h4>⚠️ Zona de riesgo</h4>
          <p class="text-muted">Borra toda la información guardada en este navegador. Esta acción no se puede deshacer.</p>
          <button class="btn-danger" id="st-reset">Borrar todos los datos</button>
        </div>
      </div>`;

    container.querySelector('#st-export').addEventListener('click', () => {
      Utils.download(`pulso-respaldo-${Utils.todayISO()}.json`, Storage.exportJSON());
      Utils.toast('Respaldo descargado', 'success');
    });
    container.querySelector('#st-import').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          Storage.importJSON(ev.target.result);
          Utils.toast('Datos importados correctamente', 'success');
          bootstrapAfterDataChange();
        } catch (err) {
          Utils.toast('El archivo no es un respaldo válido', 'danger');
        }
      };
      reader.readAsText(file);
    });
    container.querySelector('#st-dark').addEventListener('change', e => setDarkMode(e.target.checked));
    container.querySelector('#st-units').addEventListener('change', e => {
      Storage.get().settings.units = e.target.value; Storage.save();
    });
    container.querySelector('#st-reset').addEventListener('click', () => {
      confirm('Esto borrará TODOS los datos guardados en este navegador. ¿Continuar?', () => {
        Storage.resetAll();
        bootstrapAfterDataChange();
        Utils.toast('Datos reiniciados', 'info');
      });
    });
  }

  function bootstrapAfterDataChange() {
    State.init();
    Clients.renderSwitcher();
    refreshActiveClientBanner();
    renderCurrentTab();
  }

  function setDarkMode(on) {
    Storage.get().settings.darkMode = on;
    Storage.save();
    document.body.classList.toggle('dark', on);
    const icon = document.getElementById('dark-icon');
    const label = document.getElementById('dark-label');
    if (icon) icon.textContent = on ? '☀️' : '🌙';
    if (label) label.textContent = on ? 'Modo claro' : 'Modo oscuro';
    const check = document.getElementById('st-dark');
    if (check) check.checked = on;
  }

  /* ---------------- Modal genérico (con pila para diálogos anidados) ---------------- */
  /* Ej: constructor de rutina → elegir ejercicio → tutorial, y "volver" hasta el nivel anterior. */

  let onConfirmHandler = null;
  let modalStack = [];
  let currentModalOpts = null;

  function applyModal(opts) {
    const { title, body, bodyEl, confirmLabel = 'Guardar', hideFooter = false, wide = false, onConfirm } = opts;
    const modal = document.getElementById('modal');
    const bodyHost = document.getElementById('modal-body');
    modal.classList.toggle('modal-wide', !!wide);
    document.getElementById('modal-title').textContent = title || '';
    bodyHost.innerHTML = '';
    if (bodyEl) bodyHost.appendChild(bodyEl);
    else bodyHost.innerHTML = body || '';

    document.getElementById('modal-footer').style.display = hideFooter ? 'none' : '';
    document.getElementById('modal-confirm').textContent = confirmLabel;
    onConfirmHandler = onConfirm || null;
    currentModalOpts = opts;
  }

  function openModal(opts) {
    const overlay = document.getElementById('modal-overlay');
    if (overlay.classList.contains('open') && currentModalOpts) {
      modalStack.push(currentModalOpts);
    }
    applyModal(opts);
    overlay.classList.add('open');
    document.body.classList.add('modal-open');
    if (opts.onOpen) opts.onOpen();
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const closing = currentModalOpts;
    if (modalStack.length) {
      applyModal(modalStack.pop());
      if (closing && closing.onClose) closing.onClose();
      return;
    }
    overlay.classList.remove('open');
    document.body.classList.remove('modal-open');
    currentModalOpts = null;
    onConfirmHandler = null;
    if (closing && closing.onClose) closing.onClose();
  }

  function confirm(message, onYes) {
    openModal({
      title: 'Confirmar acción',
      body: `<p>${message}</p>`,
      confirmLabel: 'Sí, continuar',
      onConfirm: () => { onYes(); }
    });
  }

  function initModal() {
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-cancel-x').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
    document.getElementById('modal-confirm').addEventListener('click', () => {
      const result = onConfirmHandler ? onConfirmHandler() : true;
      if (result !== false) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  return {
    TAB_TITLES, noClientMsg, switchTab, renderCurrentTab, refreshActiveClientBanner,
    renderDashboard, renderSettings, bootstrapAfterDataChange, setDarkMode,
    openModal, closeModal, confirm, initModal
  };
})();
