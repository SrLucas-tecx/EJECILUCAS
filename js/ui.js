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

  /* ---------------- Dashboard ("Hoy") ---------------- */

  // Qué toca entrenar ahora: el día que sigue al último entrenamiento registrado
  // (en la misma rutina). Sin historial, el primer día con ejercicios de la primera rutina.
  function nextWorkout(client) {
    const routines = Routines.all(client.id).filter(r => r.days.some(d => d.exercises.length));
    if (!routines.length) return null;
    const logs = Routines.logsOf(client.id).slice()
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const last = logs.find(l => routines.some(r => r.id === l.routineId));
    if (last) {
      const r = routines.find(x => x.id === last.routineId);
      const idx = r.days.findIndex(d => d.id === last.dayId);
      for (let step = 1; step <= r.days.length; step++) {
        const d = r.days[(idx + step) % r.days.length];
        if (d.exercises.length) return { routine: r, day: d };
      }
    }
    const r = routines[0];
    return { routine: r, day: r.days.find(d => d.exercises.length) };
  }

  function setupSteps(done) {
    const steps = [
      ['Crea una rutina', 'Elige los ejercicios de cada día.', done.routine],
      ['Registra el primer entrenamiento', 'Anota peso y repeticiones de cada serie.', done.workout],
      ['Anota el peso corporal', 'Así podrás ver el progreso mes a mes.', done.weight]
    ];
    return `<ol class="setup-steps">${steps.map(([t, d, ok]) => `
      <li class="${ok ? 'is-done' : ''}"><span class="setup-mark">${ok ? '✓' : ''}</span>
        <div><strong>${t}</strong><span>${d}</span></div></li>`).join('')}</ol>`;
  }

  function renderDashboard(container) {
    const client = State.getActiveClient();
    const totalClients = Clients.all().length;
    const totalExercises = Exercises.all().length;
    const totalRoutines = Storage.all('routines').length;

    if (!client) {
      container.innerHTML = `
        <div class="hero-card">
          <div>
            <h2>Bienvenido a EJERCILUCAS</h2>
            <p>Tu centro de control para entrenar clientes: rutinas, ejercicios con tutoriales, alimentación y progreso — todo guardado en este navegador.</p>
            <button class="btn-primary" onclick="Clients.createClient()">+ Agregar tu primer cliente</button>
          </div>
        </div>
        <div class="chart-card" style="margin-top:var(--space-4);">
          <h4>Para empezar</h4>
          <ol class="setup-steps">
            <li><span class="setup-mark"></span><div><strong>Agrega un cliente</strong><span>Con su nombre y objetivo principal.</span></div></li>
            <li><span class="setup-mark"></span><div><strong>Crea su rutina</strong><span>Elige los ejercicios de la biblioteca.</span></div></li>
            <li><span class="setup-mark"></span><div><strong>Registra sus entrenamientos</strong><span>Y mira cómo avanza cada mes.</span></div></li>
          </ol>
        </div>
        <div class="stat-cards" style="margin-top:var(--space-4);">
          <div class="stat-card"><span>Clientes</span><strong>${totalClients}</strong></div>
          <div class="stat-card"><span>Ejercicios en biblioteca</span><strong>${totalExercises}</strong></div>
          <div class="stat-card"><span>Rutinas creadas</span><strong>${totalRoutines}</strong></div>
        </div>`;
      return;
    }

    const today = Utils.todayISO();
    const progressLogs = Progress.logsOf(client.id);
    const last = progressLogs[progressLogs.length - 1];
    const nutriLog = Nutrition.logOfDate(client.id, today);
    const kcalToday = Nutrition.totals(nutriLog).kcal;
    const routines = Routines.all(client.id);
    const allWorkouts = Routines.logsOf(client.id);
    const recentWorkouts = allWorkouts.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    const trainedToday = allWorkouts.some(w => w.date === today);
    const next = nextWorkout(client);
    const setupDone = { routine: routines.length > 0, workout: allWorkouts.length > 0, weight: progressLogs.length > 0 };
    const setupComplete = setupDone.routine && setupDone.workout && setupDone.weight;

    const ctaTitle = next
      ? (trainedToday ? 'Ya entrenaste hoy ✓' : 'Entrenar hoy')
      : 'Crea la primera rutina';
    const ctaSub = next
      ? `${Utils.escapeHtml(next.routine.name)} · ${Utils.escapeHtml(next.day.name)}${trainedToday ? ' — registrar otra sesión' : ''}`
      : `Para empezar a registrar entrenamientos de ${Utils.escapeHtml(client.name)}`;

    container.innerHTML = `
      ${Backup.reminderBanner()}
      <section class="today-card">
        <div class="today-head">
          <div class="avatar avatar-lg">${Utils.initials(client.name)}</div>
          <div>
            <p class="today-date">Hoy, ${Utils.formatDate(today, { withYear: false })}</p>
            <h2>${Utils.escapeHtml(client.name)}</h2>
            <p class="text-muted">${client.goal || 'Sin objetivo definido'} · Cliente desde ${Utils.formatDate(client.startDate)}</p>
          </div>
        </div>
        <button type="button" class="today-cta ${trainedToday ? 'is-done' : ''}" id="dash-train">
          <span class="today-cta-icon">🏋️</span>
          <span class="today-cta-text"><strong>${ctaTitle}</strong><small>${ctaSub}</small></span>
          <span class="today-cta-go" aria-hidden="true">›</span>
        </button>
      </section>

      <div class="quick-grid">
        <button type="button" class="quick-btn" id="dash-meal"><span>🍽️</span><strong>Registrar comida</strong><small>${kcalToday}${client.targetCalories ? ' / ' + client.targetCalories : ''} kcal hoy</small></button>
        <button type="button" class="quick-btn" id="dash-weight"><span>⚖️</span><strong>Registrar peso</strong><small>${last ? 'Último: ' + Utils.toUnit(last.weight) + ' ' + Utils.unitLabel() : 'Aún sin registros'}</small></button>
        <button type="button" class="quick-btn" id="dash-progress"><span>📊</span><strong>Ver progreso</strong><small>${progressLogs.length} registro${progressLogs.length === 1 ? '' : 's'}</small></button>
      </div>

      ${setupComplete ? '' : `
      <div class="chart-card" style="margin-top:var(--space-4);">
        <h4>Primeros pasos con ${Utils.escapeHtml(client.name)}</h4>
        ${setupSteps(setupDone)}
      </div>`}

      <div class="stat-cards">
        <div class="stat-card"><span>Peso actual</span><strong>${last ? Utils.toUnit(last.weight) + ' ' + Utils.unitLabel() : 'Sin registros'}</strong></div>
        <div class="stat-card"><span>Kcal hoy</span><strong>${kcalToday}${client.targetCalories ? ' / ' + client.targetCalories : ''}</strong></div>
        <div class="stat-card"><span>Rutinas activas</span><strong>${routines.length}</strong></div>
        <div class="stat-card"><span>Entrenamientos registrados</span><strong>${allWorkouts.length}</strong></div>
      </div>

      <div class="dash-columns">
        <div class="chart-card">
          <h4>Últimos entrenamientos</h4>
          ${recentWorkouts.length ? `<ul class="simple-list">${recentWorkouts.map(w => {
            const vol = w.entries.reduce((s, e) => s + (Exercises.get(e.exerciseId)?.measureByTime ? 0 : Utils.totalVolume(e.sets)), 0);
            const timedSeconds = w.entries.reduce((s, e) => s + (Exercises.get(e.exerciseId)?.measureByTime
              ? e.sets.reduce((total, set) => total + (Number(set.time) || 0), 0)
              : 0), 0);
            return `<li><strong>${Utils.formatDate(w.date, { withYear: false })}</strong> — ${Utils.toUnit(vol)} ${Utils.unitLabel()} de volumen${timedSeconds ? ` · ${timedSeconds} s en ejercicios por tiempo` : ''}</li>`;
          }).join('')}</ul>` : `<p class="text-muted">Aún no hay entrenamientos. Toca "Entrenar hoy" para registrar el primero.</p>`}
        </div>
        <div class="chart-card">
          <h4>Evolución de peso</h4>
          ${progressLogs.length
            ? `<div class="chart-canvas-box"><canvas id="dash-weight-chart"></canvas></div>`
            : `<p class="text-muted">Registra el peso de ${Utils.escapeHtml(client.name)} para ver aquí su evolución.</p>`}
        </div>
      </div>`;

    Backup.wireReminder(container, () => renderDashboard(container));

    const refresh = () => renderDashboard(container);
    container.querySelector('#dash-train').addEventListener('click', () => {
      if (next) Routines.openLogger(next.routine.id, refresh, { dayId: next.day.id });
      else Routines.openBuilder(null, refresh);
    });
    container.querySelector('#dash-meal').addEventListener('click', () => Nutrition.openMealModal(client.id, today, null, refresh));
    container.querySelector('#dash-weight').addEventListener('click', () => Progress.openEntry(client.id, null, refresh));
    container.querySelector('#dash-progress').addEventListener('click', () => switchTab('progreso'));

    if (progressLogs.length) {
      const canvas = document.getElementById('dash-weight-chart');
      if (canvas._chart) canvas._chart.destroy();
      canvas._chart = new Chart(canvas, {
        type: 'line',
        data: { labels: progressLogs.map(p => Utils.formatDate(p.date, { withYear: false, short: true })),
          datasets: [{ data: progressLogs.map(p => Utils.toUnit(p.weight)), borderColor: '#5EEAD4', backgroundColor: 'rgba(94,234,212,.15)', fill: true, pointBackgroundColor: '#5EEAD4' }] },
        options: Charts.lineOptions()
      });
    }
  }

  /* ---------------- Ajustes / respaldo ---------------- */

  function renderSettings(container) {
    const usage = Photos.usage();
    container.innerHTML = `
      <div class="section-header"><h2 class="section-title">Ajustes y copia de seguridad</h2><p class="text-muted">Todo se guarda localmente en este navegador. Exporta seguido para no perder información.</p></div>
      <div class="settings-grid">
        <div class="settings-card">
          <h4>💾 Copia de seguridad</h4>
          <p class="text-muted">Descarga un archivo JSON independiente por categoría o crea un respaldo personalizado.</p>
          <p class="text-muted" style="margin:0; font-size:var(--fs-xs);">${Backup.lastBackupText()}</p>
          <h5>Respaldar una categoría</h5>
          <div class="backup-category-list">
            ${Object.entries(Backup.SECTIONS).map(([key, section]) => `
              <button type="button" class="btn-sm btn-secondary" data-backup-section="${key}">📄 ${section.label}</button>
            `).join('')}
          </div>
          <button class="btn-primary" id="st-export">📄 Exportar datos…</button>
          <label class="btn-secondary" style="display:inline-flex;cursor:pointer;">📥 Importar datos…
            <input type="file" id="st-import" accept=".json" style="display:none">
          </label>
          <p class="text-muted" style="font-size:var(--fs-xs);">Al importar, selecciona las categorías del archivo y elige <strong>Combinar</strong> para conservar lo actual o <strong>Reemplazar</strong> para sustituir esas categorías.</p>
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
          <h4>🗄️ Almacenamiento</h4>
          <div class="storage-bar"><div class="storage-bar-fill ${usage.pct >= 85 ? 'is-high' : ''}" style="width:${usage.pct}%"></div></div>
          <p class="text-muted" style="margin:0;">Usando <strong>${Photos.formatSize(usage.total)}</strong> de ~5 MB (${usage.pct}%).
            Fotos: <strong>${Photos.formatSize(usage.photoChars)}</strong> en ${usage.count} imagen${usage.count === 1 ? '' : 'es'}.</p>
          <button class="btn-secondary" id="st-optimize">🗜️ Optimizar fotos guardadas</button>
        </div>
        <div class="settings-card">
          <h4>⚠️ Zona de riesgo</h4>
          <p class="text-muted">Borra toda la información guardada en este navegador. Esta acción no se puede deshacer.</p>
          <button class="btn-danger" id="st-reset">Borrar todos los datos</button>
        </div>
      </div>`;

    container.querySelector('#st-export').addEventListener('click', () => Backup.openExport(() => renderSettings(container)));
    container.querySelectorAll('[data-backup-section]').forEach(button => {
      button.addEventListener('click', () => Backup.exportSection(button.dataset.backupSection));
    });
    container.querySelector('#st-import').addEventListener('change', e => {
      const file = e.target.files[0];
      e.target.value = ''; // permite volver a elegir el mismo archivo
      Backup.startImport(file, bootstrapAfterDataChange);
    });
    container.querySelector('#st-optimize').addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const r = await Photos.optimizeStored((done, total) => { btn.textContent = `Optimizando ${done}/${total}…`; });
      if (!r.processed) Utils.toast('No hay fotos pesadas que optimizar', 'info');
      else Utils.toast(`Listo: ${Photos.formatSize(r.saved)} liberados${r.failed ? ` (${r.failed} no se pudieron procesar)` : ''}`, 'success');
      renderSettings(container);
    });
    container.querySelector('#st-dark').addEventListener('change', e => setDarkMode(e.target.checked));
    container.querySelector('#st-units').addEventListener('change', e => {
      Storage.get().settings.units = e.target.value; Storage.save();
      Utils.toast(`Unidad de peso cambiada a ${e.target.value === 'lb' ? 'libras' : 'kilogramos'}`, 'success');
    });
    container.querySelector('#st-reset').addEventListener('click', () => {
      confirm('Esto borrará TODOS los datos guardados en este navegador. ¿Continuar?', () => {
        Storage.resetAll();
        bootstrapAfterDataChange();
        Utils.toast('Datos reiniciados', 'info');
      });
    });
  }

  /* ---------------- Glosario de términos ---------------- */

  const GLOSSARY = [
    ['Serie', 'Un bloque de repeticiones seguidas, sin descanso entre ellas. Una rutina suele pedir varias series por ejercicio.'],
    ['Reps (repeticiones)', 'Cuántas veces haces el movimiento completo dentro de una serie. "8-12" es un rango objetivo: entre 8 y 12.'],
    ['Obj. (objetivo)', 'Lo que se planea hacer en la rutina (reps obj., peso obj., RIR obj.). Lo que realmente hiciste se anota al registrar el entrenamiento.'],
    ['Fallo técnico', 'El punto en que ya no puedes hacer otra repetición manteniendo la forma correcta. Todas las medidas de intensidad de la app se basan en este punto, no en el fallo absoluto.'],
    ['RIR (repeticiones en reserva)', 'Cuántas repeticiones más habrías podido hacer antes del fallo técnico. RIR 0 = llegaste al fallo; RIR 2 = te sobraban 2 repeticiones.'],
    ['RPE (esfuerzo percibido)', 'Qué tan duro fue, de 1 a 10. RPE 10 = fallo técnico. Se relaciona con el RIR así: RPE = 10 − RIR (RIR 2 ≈ RPE 8).'],
    ['Serie efectiva', 'Una serie lo bastante intensa para estimular el músculo: RPE 7 o más, o RIR 3 o menos. La app las cuenta en el resumen de cada sesión.'],
    ['1RM (repetición máxima)', 'El peso máximo que podrías levantar en una sola repetición. Como probarlo es cansado y riesgoso, la app lo estima con la fórmula de Epley: peso × (1 + reps ÷ 30).'],
    ['PR (récord personal)', 'Tu mejor marca en un ejercicio. En la app, una serie es PR (🏆) cuando su 1RM estimado supera al de todas tus sesiones anteriores de ese ejercicio. Se puede desactivar por ejercicio.'],
    ['Volumen', 'Peso × repeticiones, sumado de todas las series. Sirve para comparar cuánto trabajo total hiciste entre sesiones o meses.'],
    ['Unilateral / Lado', 'Ejercicio que trabaja un lado del cuerpo a la vez (por ejemplo, curl con una mancuerna). "Izquierdo" y "Derecho" se registran por separado y cada lado tiene su propio PR; "Ambos" es una sola fila que representa los dos lados con el mismo peso y reps.'],
    ['Peso corporal + extra', 'En ejercicios de "Peso corporal" (dominadas, fondos…) anotas solo el peso EXTRA que agregas (lastre, chaleco, mancuerna). Vacío o 0 = solo tu cuerpo. El volumen y el 1RM usan el total: peso corporal (del último registro de Progreso) + extra.'],
    ['Anterior / Última vez', 'Lo que hiciste la última vez que entrenaste ese ejercicio, para que sepas qué peso y reps superar.'],
    ['Sobrecarga progresiva (💡)', 'Ir aumentando poco a poco el peso, las reps o las series para seguir progresando. La app sugiere subir peso cuando completaste el tope del rango de reps en todas las series.'],
    ['Kcal y macros', 'Kcal son las calorías. Los macros son proteína, carbohidratos y grasas, que se registran en gramos en la sección de Alimentación.']
  ];

  function openGlossary() {
    openModal({
      title: '❓ Glosario',
      hideFooter: true,
      body: `<dl class="glossary-list">${GLOSSARY.map(([t, d]) => `<dt>${Utils.escapeHtml(t)}</dt><dd>${Utils.escapeHtml(d)}</dd>`).join('')}</dl>
        <p class="text-muted" style="font-size:var(--fs-xs); margin-top:var(--space-3);">Para la tabla RIR ↔ RPE, usa el botón "📏 Guía RIR/RPE" al registrar un entrenamiento.</p>`
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
    openModal, closeModal, confirm, initModal, openGlossary
  };
})();
