/* ==========================================================================
   BACKUP — exportar / importar por secciones
   - Exportar: solo las secciones que marques.
   - Importar: lee el archivo, muestra qué secciones trae, aplicas solo las
     elegidas en modo "Combinar" (por id, sin duplicar) o "Reemplazar".
   - Todo el resultado se valida (normalize) ANTES de guardarse.
   ========================================================================== */

const Backup = (() => {

  // Secciones de primer nivel de la base de datos.
  // kind: 'array' (lista de registros con id) | 'object' (diccionario)
  // deps: secciones a las que hace referencia por id
  const SECTIONS = {
    clients:       { label: 'Clientes',                         kind: 'array',  deps: [] },
    exercises:     { label: 'Biblioteca de ejercicios',         kind: 'array',  deps: [] },
    routines:      { label: 'Rutinas',                          kind: 'array',  deps: ['clients', 'exercises'] },
    workoutLogs:   { label: 'Entrenamientos registrados',       kind: 'array',  deps: ['clients', 'routines', 'exercises'] },
    nutritionLogs: { label: 'Alimentación',                     kind: 'array',  deps: ['clients'] },
    progressLogs:  { label: 'Progreso (medidas y fotos)',       kind: 'array',  deps: ['clients'] },
    settings:      { label: 'Ajustes (modo oscuro y unidades)', kind: 'object', deps: [] }
  };

  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const norm = s => String(s || '').trim().toLowerCase();
  const clone = v => JSON.parse(JSON.stringify(v));
  const label = k => SECTIONS[k].label;

  /* ---------------- Validación ---------------- */

  // Un registro roto (p. ej. una rutina sin "days") haría fallar la pantalla
  // que lo dibuja, así que se descarta aquí en vez de guardarse.
  const VALID = {
    clients:       r => typeof r.name === 'string',
    exercises:     r => typeof r.name === 'string' && Array.isArray(r.muscles),
    routines:      r => Array.isArray(r.days) && r.days.every(d => isObj(d) && Array.isArray(d.exercises)),
    workoutLogs:   r => typeof r.date === 'string' && Array.isArray(r.entries) && r.entries.every(e => isObj(e) && Array.isArray(e.sets)),
    nutritionLogs: r => typeof r.date === 'string' && Array.isArray(r.meals) && r.meals.every(m => isObj(m) && Array.isArray(m.items)),
    progressLogs:  r => typeof r.date === 'string'
  };

  /** Devuelve { data, dropped } con la base completa ya saneada. */
  function normalize(input) {
    const data = { ...input };
    let dropped = 0;

    Object.entries(SECTIONS).forEach(([k, s]) => {
      if (s.kind === 'object') { data[k] = isObj(data[k]) ? data[k] : {}; return; }
      const list = Array.isArray(data[k]) ? data[k] : [];
      const seen = new Set();
      data[k] = list
        .filter(r => {
          const ok = isObj(r) && VALID[k](r);
          if (!ok) dropped++;
          return ok;
        })
        .map(r => (r.id ? r : { ...r, id: Utils.uid(k.slice(0, 3)) }))
        .filter(r => {
          if (seen.has(r.id)) { dropped++; return false; }
          seen.add(r.id);
          return true;
        });
    });

    data.settings = { darkMode: true, units: 'kg', ...data.settings };
    if (!['kg', 'lb'].includes(data.settings.units)) data.settings.units = 'kg';
    data.settings.darkMode = !!data.settings.darkMode;

    // El cliente activo debe seguir existiendo
    if (!data.clients.some(c => c.id === data.activeClientId)) {
      data.activeClientId = data.clients[0]?.id ?? null;
    }
    return { data, dropped };
  }

  // Registros que apuntan a un cliente que ya no existe (no se verían en ningún lado)
  function countOrphans(db) {
    const ids = new Set(db.clients.map(c => c.id));
    return ['routines', 'workoutLogs', 'nutritionLogs', 'progressLogs']
      .reduce((n, k) => n + db[k].filter(r => !ids.has(r.clientId)).length, 0);
  }

  /* ---------------- Utilidades de secciones ---------------- */

  function countOf(data, k) {
    const v = data[k];
    return Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : 0;
  }
  function countText(data, k) {
    if (SECTIONS[k].kind === 'object') return 'configuración';
    const n = countOf(data, k);
    return `${n} registro${n === 1 ? '' : 's'}`;
  }

  // ¿Qué secciones trae este archivo? (también sirve con respaldos completos viejos)
  function sectionsInFile(json) {
    return Object.keys(SECTIONS).filter(k => SECTIONS[k].kind === 'array' ? Array.isArray(json[k]) : isObj(json[k]));
  }

  // Secciones elegidas que hacen referencia a otras que NO están elegidas
  function missingDeps(keys) {
    const chosen = new Set(keys);
    return keys
      .map(k => ({ k, missing: SECTIONS[k].deps.filter(d => !chosen.has(d)) }))
      .filter(x => x.missing.length);
  }

  function depsHtml(keys, mode /* 'export' | 'import' */) {
    const list = missingDeps(keys);
    if (!list.length) return '';
    const lines = list.map(({ k, missing }) => {
      const names = missing.map(label).join(', ');
      return mode === 'export'
        ? `<strong>${label(k)}</strong> usa <em>${names}</em>. Si no las incluyes, este archivo solo se podrá restaurar en una app que ya tenga esos datos.`
        : `<strong>${label(k)}</strong> usa <em>${names}</em>. Asegúrate de que ya existan en esta app o quedarán "huérfanos" (sin cliente o sin ejercicio).`;
    });
    return `⚠️ ${lines.join('<br>⚠️ ')}`;
  }

  function sectionChecks(keys, dataForCounts, extraCountData) {
    return keys.map(k => `
      <label class="section-check">
        <input type="checkbox" data-k="${k}" checked>
        <span>${label(k)}</span>
        <small>${extraCountData
          ? `archivo: ${countText(extraCountData, k)} · aquí: ${countText(dataForCounts, k)}`
          : countText(dataForCounts, k)}</small>
      </label>`).join('');
  }

  const checkedKeys = host => [...host.querySelectorAll('input[data-k]:checked')].map(i => i.dataset.k);

  /* ---------------- Recordatorio de respaldo ---------------- */

  const REMIND_AFTER_DAYS = 7;   // desde cuántos días sin respaldo se avisa
  const SNOOZE_DAYS = 3;         // "Más tarde" lo pospone este tiempo
  const DAY_MS = 86400000;
  const daysSince = iso => Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);

  function markDone() {
    const db = Storage.get();
    db.lastBackupAt = new Date().toISOString();
    db.backupSnoozeUntil = null;
    Storage.save();
  }

  function snooze() {
    Storage.get().backupSnoozeUntil = new Date(Date.now() + SNOOZE_DAYS * DAY_MS).toISOString();
    Storage.save();
  }

  // null = no hay que avisar; si no, { never } o { days }
  function reminderInfo() {
    const db = Storage.get();
    if (!db.clients.length) return null;                                   // nada que respaldar todavía
    if (db.backupSnoozeUntil && new Date(db.backupSnoozeUntil) > new Date()) return null;
    if (!db.lastBackupAt) {
      const oldest = db.clients.map(c => c.createdAt).filter(Boolean).sort()[0];
      return oldest && daysSince(oldest) < 1 ? null : { never: true };     // no molestar el primer día
    }
    const days = daysSince(db.lastBackupAt);
    return days >= REMIND_AFTER_DAYS ? { never: false, days } : null;
  }

  function lastBackupText() {
    const at = Storage.get().lastBackupAt;
    if (!at) return 'Aún no hay ningún respaldo completo registrado.';
    const d = daysSince(at);
    return `Último respaldo completo: ${d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`}.`;
  }

  function reminderBanner() {
    const r = reminderInfo();
    if (!r) return '';
    const text = r.never
      ? 'Todavía no has hecho ningún respaldo. Tus datos viven solo en este navegador: si lo limpias, se pierden.'
      : `Tu último respaldo fue hace ${r.days} días. Tus datos viven solo en este navegador.`;
    return `
      <div class="backup-reminder" id="bk-reminder">
        <span>💾 ${text}</span>
        <div class="backup-reminder-actions">
          <button type="button" class="btn-sm btn-primary" id="bk-remind-now">Hacer respaldo</button>
          <button type="button" class="btn-sm btn-secondary" id="bk-remind-later">Más tarde</button>
        </div>
      </div>`;
  }

  function wireReminder(container, onChange) {
    const now = container.querySelector('#bk-remind-now');
    const later = container.querySelector('#bk-remind-later');
    if (now) now.addEventListener('click', () => openExport(onChange));
    if (later) later.addEventListener('click', () => { snooze(); onChange(); });
  }

  /* ---------------- EXPORTAR ---------------- */

  // Quita las fotos (base64) de una sección; conserva el resto del registro
  function withoutPhotos(k, list) {
    const fields = Photos.FIELDS[k];
    if (!fields) return list;
    return list.map(r => { const c = { ...r }; fields.forEach(f => { delete c[f]; }); return c; });
  }

  function buildExport(keys, includePhotos = true) {
    const db = Storage.get();
    const out = { _meta: { app: 'pulso', version: 1, exportedAt: new Date().toISOString(), sections: keys, photos: includePhotos } };
    keys.forEach(k => { out[k] = includePhotos || SECTIONS[k].kind === 'object' ? db[k] : withoutPhotos(k, db[k]); });
    return JSON.stringify(out, null, 2);
  }

  function openExport(onDone) {
    const db = Storage.get();
    const host = document.createElement('div');
    host.innerHTML = `
      <p class="text-muted">Marca las secciones que quieres incluir en el archivo.</p>
      <div class="section-check-list">${sectionChecks(Object.keys(SECTIONS), db)}</div>
      <button type="button" class="btn-sm btn-secondary" id="bk-toggle-all">Marcar / desmarcar todo</button>
      <label class="section-check" style="margin-top:var(--space-3);">
        <input type="checkbox" id="bk-photos" checked>
        <span>Incluir fotos <small style="display:block;font-weight:400;">Sin fotos el archivo pesa mucho menos.</small></span>
      </label>
      <p class="text-muted" id="bk-size" style="font-size:var(--fs-xs); margin-top:var(--space-2);"></p>
      <div class="dep-warning" id="bk-warn" style="display:none;"></div>`;

    const warn = host.querySelector('#bk-warn');
    const includePhotos = () => host.querySelector('#bk-photos').checked;
    const refresh = () => {
      const keys = checkedKeys(host);
      const html = depsHtml(keys, 'export');
      warn.innerHTML = html;
      warn.style.display = html ? '' : 'none';
      host.querySelector('#bk-size').textContent = keys.length
        ? `Tamaño estimado del archivo: ${Photos.formatSize(buildExport(keys, includePhotos()).length)}`
        : '';
    };
    host.addEventListener('change', refresh);
    refresh();
    host.querySelector('#bk-toggle-all').addEventListener('click', () => {
      const boxes = [...host.querySelectorAll('input[data-k]')];
      const allOn = boxes.every(b => b.checked);
      boxes.forEach(b => { b.checked = !allOn; });
      refresh();
    });

    UI.openModal({
      title: '📄 Exportar datos',
      bodyEl: host,
      confirmLabel: 'Descargar',
      onConfirm: () => {
        const keys = checkedKeys(host);
        if (!keys.length) { Utils.toast('Elige al menos una sección', 'danger'); return false; }
        const all = keys.length === Object.keys(SECTIONS).length;
        const photos = includePhotos();
        const name = `pulso-${all ? 'respaldo' : 'parcial'}${photos ? '' : '-sin-fotos'}-${Utils.todayISO()}.json`;
        Utils.download(name, buildExport(keys, photos));
        Utils.toast(all ? 'Respaldo completo descargado' : `Descargadas ${keys.length} sección(es)`, 'success');
        if (all) markDone();          // solo un export con TODAS las secciones cuenta como respaldo
        if (onDone) onDone();
      }
    });
  }

  /* ---------------- IMPORTAR ---------------- */

  function startImport(file, onDone) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      let json;
      try { json = JSON.parse(ev.target.result); } catch (e) { json = null; }
      if (!isObj(json)) { Utils.toast('El archivo no es un respaldo válido', 'danger'); return; }
      const found = sectionsInFile(json);
      if (!found.length) { Utils.toast('El archivo no trae ninguna sección reconocible de PULSO', 'danger'); return; }
      openImport(json, found, onDone);
    };
    reader.readAsText(file);
  }

  function openImport(json, found, onDone) {
    const db = Storage.get();
    const host = document.createElement('div');
    host.innerHTML = `
      <p class="text-muted">Este archivo trae ${found.length} sección${found.length === 1 ? '' : 'es'}. Elige cuáles aplicar:</p>
      <div class="section-check-list">${sectionChecks(found, db, json)}</div>

      <h4>¿Cómo aplicarlas?</h4>
      <div class="mode-options">
        <label class="section-check"><input type="radio" name="bk-mode" value="merge" checked>
          <span>Combinar <small style="display:block;font-weight:400;">Agrega lo nuevo y actualiza lo que tenga el mismo id. No borra nada de lo que ya tienes.</small></span></label>
        <label class="section-check"><input type="radio" name="bk-mode" value="replace">
          <span>Reemplazar <small style="display:block;font-weight:400;">Borra la sección actual y deja exactamente la del archivo.</small></span></label>
      </div>

      <label class="section-check" style="margin-top:var(--space-3);">
        <input type="checkbox" id="bk-safety" checked>
        <span>Descargar un respaldo de mis datos actuales antes de importar</span>
      </label>
      <div class="dep-warning" id="bk-warn" style="display:none;"></div>`;

    const warn = host.querySelector('#bk-warn');
    const mode = () => host.querySelector('input[name="bk-mode"]:checked').value;
    const refresh = () => {
      const parts = [];
      const deps = depsHtml(checkedKeys(host), 'import');
      if (deps) parts.push(deps);
      if (mode() === 'replace') parts.push('🗑️ <strong>Reemplazar</strong> borra lo que tengas ahora en las secciones marcadas.');
      if (json._meta && json._meta.photos === false) {
        parts.push(mode() === 'replace'
          ? '📷 Este archivo se exportó <strong>sin fotos</strong>: al reemplazar se perderán las fotos que tengas ahora en esas secciones.'
          : '📷 Este archivo se exportó <strong>sin fotos</strong>: al combinar se conservan las fotos que ya tienes.');
      }
      warn.innerHTML = parts.join('<br>');
      warn.classList.toggle('danger', mode() === 'replace');
      warn.style.display = parts.length ? '' : 'none';
      const btn = document.getElementById('modal-confirm');
      if (btn) btn.textContent = mode() === 'replace' ? 'Reemplazar datos' : 'Importar';
    };
    host.addEventListener('change', refresh);

    UI.openModal({
      title: '📥 Importar datos',
      bodyEl: host,
      confirmLabel: 'Importar',
      onOpen: refresh,
      onConfirm: () => {
        const keys = checkedKeys(host);
        if (!keys.length) { Utils.toast('Elige al menos una sección', 'danger'); return false; }
        if (host.querySelector('#bk-safety').checked) {
          Utils.download(`pulso-antes-de-importar-${Utils.todayISO()}.json`, Storage.exportJSON());
        }
        let report;
        try { report = applyImport(json, keys, mode()); }
        catch (err) { console.error(err); Utils.toast(err.message || 'No se pudo importar', 'danger'); return false; }

        const notes = [];
        if (report.dropped) notes.push(`${report.dropped} registro(s) inválidos omitidos`);
        if (report.orphans) notes.push(`${report.orphans} registro(s) sin cliente`);
        Utils.toast(notes.length ? `Importado — ${notes.join(' · ')}` : 'Datos importados correctamente', notes.length ? 'info' : 'success');
        onDone && onDone();
      }
    });
  }

  /**
   * Aplica las secciones elegidas sobre los datos actuales.
   * Trabaja sobre una COPIA, valida todo el conjunto y solo entonces guarda.
   */
  function applyImport(json, keys, mode /* 'merge' | 'replace' */) {
    const next = clone(Storage.get());

    // 1) Los ejercicios semilla se crean con ids aleatorios en cada instalación, así que
    //    el mismo "Press de banca" tiene ids distintos en cada navegador. Emparejamos por
    //    nombre para no duplicarlos y para que rutinas/registros sigan apuntando bien.
    const idMap = {};
    const replacingExercises = keys.includes('exercises') && mode === 'replace';
    if (Array.isArray(json.exercises) && !replacingExercises) {
      const localById = new Set(next.exercises.map(x => x.id));
      const localByName = new Map(next.exercises.map(x => [norm(x.name), x]));
      json.exercises.filter(isObj).forEach(x => {
        const twin = localByName.get(norm(x.name));
        if (x.id && !localById.has(x.id) && twin) idMap[x.id] = twin.id;
      });
    }
    if (Object.keys(idMap).length) {
      const remap = id => idMap[id] || id;
      (json.routines || []).forEach(r => (r.days || []).forEach(d => (d.exercises || []).forEach(e => { e.exerciseId = remap(e.exerciseId); })));
      (json.workoutLogs || []).forEach(l => (l.entries || []).forEach(e => { e.exerciseId = remap(e.exerciseId); }));
    }

    // 2) Aplicar cada sección elegida
    keys.forEach(k => {
      const incoming = json[k];
      if (SECTIONS[k].kind === 'object') {
        next[k] = mode === 'replace' ? { ...incoming } : { ...next[k], ...incoming };
        return;
      }
      if (mode === 'replace') { next[k] = incoming; return; }

      const photoFields = Photos.FIELDS[k] || [];
      const map = new Map(next[k].map(x => [x.id, x]));
      incoming.filter(isObj).forEach(x => {
        if (k === 'exercises' && idMap[x.id]) return;   // ya existe uno con ese nombre
        const id = x.id || Utils.uid(k.slice(0, 3));
        const old = map.get(id);
        const rec = { ...x, id };
        // si el archivo viene sin fotos, no pisar las que ya tienes
        if (old) photoFields.forEach(f => { if (!rec[f] && old[f]) rec[f] = old[f]; });
        map.set(id, rec);                               // agrega lo nuevo / actualiza lo existente
      });
      next[k] = [...map.values()];
    });

    // 3) Validar TODO el conjunto antes de guardar
    const { data, dropped } = normalize(next);
    if (!Storage.replaceAll(data)) throw new Error('No se pudo guardar: almacenamiento local lleno. Tus datos anteriores siguen intactos.');

    if (keys.includes('settings')) UI.setDarkMode(data.settings.darkMode);
    return { dropped, orphans: countOrphans(data) };
  }

  return { SECTIONS, normalize, openExport, startImport, applyImport, buildExport,
           markDone, reminderInfo, reminderBanner, wireReminder, lastBackupText };
})();
