/* ==========================================================================
   PROGRESS — seguimiento de progreso mes a mes por cliente
   ========================================================================== */

const Progress = (() => {

  const MEASURE_FIELDS = [
    ['chest', 'Pecho'], ['waist', 'Cintura'], ['hips', 'Cadera'],
    ['bicep', 'Brazo'], ['thigh', 'Muslo'], ['calf', 'Pantorrilla']
  ];

  const METRICS = {
    weight: 'Peso corporal',
    bodyfat: '% grasa corporal',
    volume: 'Volumen de entrenamiento (mensual)',
    strength: 'Fuerza — peso usado y 1RM estimado'
  };

  function logsOf(clientId) { return Storage.all('progressLogs').filter(p => p.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date)); }

  function loggedExercises(clientId) {
    const ids = new Set();
    Routines.logsOf(clientId).forEach(l => l.entries.forEach(e => ids.add(e.exerciseId)));
    return [...ids].map(id => Exercises.get(id)).filter(Boolean);
  }

  function strengthSeries(clientId, exerciseId) {
    const logs = Routines.logsOf(clientId)
      .filter(l => l.entries.some(e => e.exerciseId === exerciseId))
      .sort((a, b) => a.date.localeCompare(b.date));
    return logs.map(l => {
      const entry = l.entries.find(e => e.exerciseId === exerciseId);
      const best1RM = Math.max(...entry.sets.map(s => Utils.estimate1RM(s.weight, s.reps)));
      const maxWeight = Math.max(...entry.sets.map(s => Number(s.weight) || 0));
      return { date: l.date, est1RM: Utils.round(best1RM, 1), maxWeight: Utils.round(maxWeight, 1) };
    }).filter(s => s.est1RM > 0);
  }

  function elapsedLabel(startISO) {
    const start = new Date(startISO + 'T00:00:00');
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months--;
    months = Math.max(0, months);
    if (months < 1) {
      const days = Math.max(0, Math.round((now - start) / 86400000));
      return { big: `${days} día${days === 1 ? '' : 's'}`, small: 'desde tu foto inicial' };
    }
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (years >= 1) {
      return { big: `${years} ${years === 1 ? 'año' : 'años'}${remMonths ? ` ${remMonths} ${remMonths === 1 ? 'mes' : 'meses'}` : ''}`, small: 'de progreso acumulado' };
    }
    return { big: `${months} ${months === 1 ? 'mes' : 'meses'}`, small: 'de progreso acumulado' };
  }

  function renderPage(container) {
    const client = State.getActiveClient();
    if (!client) { container.innerHTML = UI.noClientMsg(); return; }

    let metric = 'weight';
    let strengthExerciseId = null;

    const paint = () => {
      const c = Storage.find('clients', client.id) || client;
      const logs = logsOf(c.id);
      const first = logs[0], last = logs[logs.length - 1];
      const diff = (first && last && logs.length > 1) ? Utils.round(last.weight - first.weight, 1) : null;
      const exList = loggedExercises(c.id);
      if (!strengthExerciseId && exList.length) strengthExerciseId = exList[0].id;

      container.innerHTML = `
        <div class="section-header" style="justify-content:space-between;">
          <div><h2 class="section-title">Progreso de ${Utils.escapeHtml(c.name)}</h2>
          <p class="text-muted">Compara mes a mes peso, medidas, fuerza y volumen de entrenamiento.</p></div>
          <button class="btn-primary" id="pg-new">+ Registrar progreso</button>
        </div>

        <div class="stat-cards">
          <div class="stat-card"><span>Peso actual</span><strong>${last ? Utils.toUnit(last.weight) + ' ' + Utils.unitLabel() : '—'}</strong></div>
          <div class="stat-card"><span>Cambio total</span><strong class="${diff > 0 ? 'text-danger' : diff < 0 ? 'text-success' : ''}">${diff != null ? (diff > 0 ? '+' : '') + Utils.toUnit(diff) + ' ' + Utils.unitLabel() : '—'}</strong></div>
          <div class="stat-card"><span>% grasa actual</span><strong>${last?.bodyFatPct ? last.bodyFatPct + '%' : '—'}</strong></div>
          <div class="stat-card"><span>Registros</span><strong>${logs.length}</strong></div>
        </div>

        ${beforeAfterMarkup(c)}

        <div class="chart-card" style="margin-top:var(--space-4);">
          <div class="metric-controls">
            <h4 style="margin:0;">📈 Evolución</h4>
            <select id="pg-metric" class="filter-select">
              ${Object.entries(METRICS).map(([k, v]) => `<option value="${k}" ${metric === k ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <select id="pg-strength-exercise" class="filter-select" style="display:${metric === 'strength' ? '' : 'none'};">
              ${exList.length ? exList.map(e => `<option value="${e.id}" ${strengthExerciseId === e.id ? 'selected' : ''}>${Utils.escapeHtml(e.name)}</option>`).join('') : `<option value="">Sin entrenamientos registrados</option>`}
            </select>
          </div>
          <div class="chart-canvas-box chart-canvas-tall"><canvas id="pg-main-chart"></canvas></div>
        </div>

        <div class="section-header" style="justify-content:space-between; margin-top:var(--space-5);">
          <h3 class="section-title" style="font-size:var(--fs-md)">Historial</h3>
          <button class="btn-sm btn-secondary" id="pg-export-excel">📊 Exportar a Excel</button>
        </div>
        <div class="progress-timeline" id="pg-timeline">
          ${logs.slice().reverse().map(entryRow).join('') || `<div class="empty-state"><span class="empty-icon">📈</span><h3>Sin registros</h3><p>Agrega la primera medición de ${Utils.escapeHtml(c.name)}.</p></div>`}
        </div>`;

      container.querySelector('#pg-new').addEventListener('click', () => openEntry(c.id, null, paint));
      container.querySelectorAll('.progress-entry').forEach(row => {
        const id = row.dataset.id;
        row.querySelector('[data-act="edit"]').addEventListener('click', () => openEntry(c.id, id, paint));
        row.querySelector('[data-act="delete"]').addEventListener('click', () => {
          UI.confirm('¿Eliminar este registro de progreso?', () => { Storage.remove('progressLogs', id); paint(); });
        });
      });

      container.querySelector('#pg-metric').addEventListener('change', e => {
        metric = e.target.value;
        container.querySelector('#pg-strength-exercise').style.display = metric === 'strength' ? '' : 'none';
        renderMainChart(c, metric, strengthExerciseId);
      });
      const exSel = container.querySelector('#pg-strength-exercise');
      if (exSel) exSel.addEventListener('change', e => { strengthExerciseId = e.target.value; renderMainChart(c, metric, strengthExerciseId); });

      container.querySelector('#pg-export-excel').addEventListener('click', () => exportExcel(c));

      wireBeforeAfter(container, c, paint);
      renderMainChart(c, metric, strengthExerciseId);
    };

    paint();
  }

  /* ---------------- Antes / Después ---------------- */

  function beforeAfterMarkup(c) {
    const hasBefore = !!c.beforePhoto;
    const elapsed = hasBefore ? elapsedLabel(c.beforePhotoDate || c.startDate || Utils.todayISO()) : null;
    return `
    <div class="before-after-card">
      <h4>📸 Antes / Después</h4>
      <div class="ba-grid">
        <div class="ba-slot">
          <div class="ba-slot-label">Antes</div>
          ${hasBefore ? `<img src="${c.beforePhoto}" class="ba-photo" alt="Foto antes">` : `<div class="ba-photo-empty">📷</div>`}
          ${hasBefore
            ? `<div class="ba-locked-row">
                 <span class="ba-locked-badge">🔒 Fija desde ${Utils.formatDate(c.beforePhotoDate)}</span>
                 <button type="button" class="btn-icon-sm" id="ba-before-delete" title="Eliminar foto inicial">🗑️</button>
               </div>`
            : `<label class="btn-sm btn-secondary ba-upload-label">Subir foto inicial<input type="file" accept="image/*" id="ba-before-input" style="display:none;"></label>`}
        </div>
        <div class="ba-slot">
          <div class="ba-slot-label">Después</div>
          ${c.afterPhoto ? `<img src="${c.afterPhoto}" class="ba-photo" alt="Foto después">` : `<div class="ba-photo-empty">📷</div>`}
          <label class="btn-sm btn-secondary ba-upload-label">${c.afterPhoto ? 'Actualizar foto' : 'Subir foto actual'}<input type="file" accept="image/*" id="ba-after-input" style="display:none;"></label>
        </div>
      </div>
      ${elapsed ? `<div class="ba-elapsed"><strong>${elapsed.big}</strong><span>${elapsed.small}</span></div>`
        : `<p class="text-muted" style="text-align:center; font-size:var(--fs-xs); margin-top:var(--space-2);">Sube la foto "Antes" para empezar a contar el tiempo acumulado.</p>`}
    </div>`;
  }

  function wireBeforeAfter(root, client, onDone) {
    const beforeInput = root.querySelector('#ba-before-input');
    if (beforeInput) beforeInput.addEventListener('change', e => readPhoto(e, data => {
      Storage.update('clients', client.id, { beforePhoto: data, beforePhotoDate: Utils.todayISO() });
      Utils.toast('Foto "antes" guardada — quedará fija', 'success');
      onDone();
    }));
    // Por si se subió la foto equivocada: permite borrarla y volver a empezar
    // (aviso claro de que esto reinicia el conteo de tiempo acumulado).
    const beforeDelete = root.querySelector('#ba-before-delete');
    if (beforeDelete) beforeDelete.addEventListener('click', () => {
      UI.confirm('¿Eliminar la foto "antes"? Podrás subir una nueva, pero el conteo de tiempo acumulado se reiniciará desde la fecha de esa nueva foto.', () => {
        Storage.update('clients', client.id, { beforePhoto: null, beforePhotoDate: null });
        Utils.toast('Foto "antes" eliminada', 'info');
        onDone();
      });
    });
    const afterInput = root.querySelector('#ba-after-input');
    if (afterInput) afterInput.addEventListener('change', e => readPhoto(e, data => {
      Storage.update('clients', client.id, { afterPhoto: data, afterPhotoDate: Utils.todayISO() });
      Utils.toast('Foto "después" actualizada', 'success');
      onDone();
    }));
  }

  // Reduce la foto antes de guardarla (ver photos.js). onFail avisa cuando no se pudo procesar.
  function readPhoto(e, cb, onFail) {
    const file = e.target.files[0];
    if (!file) return;
    Utils.toast('Procesando foto...', 'info');
    Photos.fromFile(file, Photos.PRESETS.photo)
      .then(cb)
      .catch(err => { Utils.toast(err.message, 'danger'); if (onFail) onFail(); });
  }

  /* ---------------- Historial ---------------- */

  function entryRow(p) {
    const measures = MEASURE_FIELDS.filter(([k]) => p.measurements?.[k]).map(([k, l]) => `${l} ${p.measurements[k]}cm`).join(' · ');
    return `
    <article class="progress-entry" data-id="${p.id}">
      ${p.photo ? `<img src="${p.photo}" class="progress-photo" alt="Foto de progreso">` : `<div class="progress-photo progress-photo-empty">📷</div>`}
      <div class="progress-entry-body">
        <div class="progress-entry-top">
          <strong>${Utils.formatDate(p.date)}</strong>
          <div><button class="btn-icon-sm" data-act="edit" title="Editar">✏️</button><button class="btn-icon-sm" data-act="delete" title="Eliminar">🗑️</button></div>
        </div>
        <div class="chip-row">
          <span class="chip chip-accent">${Utils.toUnit(p.weight)} ${Utils.unitLabel()}</span>
          ${p.bodyFatPct ? `<span class="chip">${p.bodyFatPct}% grasa</span>` : ''}
        </div>
        ${measures ? `<p class="text-muted" style="font-size:var(--fs-xs)">${measures}</p>` : ''}
        ${p.notes ? `<p style="font-size:var(--fs-sm)">${Utils.escapeHtml(p.notes)}</p>` : ''}
      </div>
    </article>`;
  }

  function openEntry(clientId, id, onDone) {
    const editing = id ? Storage.find('progressLogs', id) : null;
    let photoData = editing?.photo || '';
    let photoBusy = false;

    const body = `
      <div class="form-grid">
        <label class="field"><span>Fecha</span><input type="date" id="pg-date" value="${editing?.date || Utils.todayISO()}"></label>
        <label class="field"><span>Peso (${Utils.unitLabel()})</span><input type="number" step="0.1" id="pg-weight" value="${editing ? Utils.toUnit(editing.weight) : ''}" required></label>
        <label class="field"><span>% grasa corporal (opcional)</span><input type="number" step="0.1" id="pg-fat" value="${editing?.bodyFatPct ?? ''}"></label>
        ${MEASURE_FIELDS.map(([k, l]) => `<label class="field"><span>${l} (cm)</span><input type="number" step="0.1" id="pg-m-${k}" value="${editing?.measurements?.[k] ?? ''}"></label>`).join('')}
        <label class="field field-wide"><span>Foto de progreso (opcional)</span><input type="file" id="pg-photo" accept="image/*"></label>
        <label class="field field-wide"><span>Notas</span><textarea id="pg-notes" rows="2">${editing ? Utils.escapeHtml(editing.notes || '') : ''}</textarea></label>
      </div>`;

    UI.openModal({
      title: editing ? 'Editar registro' : 'Registrar progreso',
      body,
      confirmLabel: 'Guardar registro',
      onOpen: () => {
        document.getElementById('pg-photo').addEventListener('change', e => {
          photoBusy = true;
          readPhoto(e, data => { photoData = data; photoBusy = false; }, () => { photoBusy = false; });
        });
      },
      onConfirm: () => {
        if (photoBusy) { Utils.toast('Espera un momento: la foto se está procesando', 'info'); return false; }
        const weightInput = Number(document.getElementById('pg-weight').value);
        if (!weightInput) { Utils.toast('El peso es obligatorio', 'danger'); return false; }
        const weight = Utils.fromUnit(weightInput);
        const data = {
          clientId, date: document.getElementById('pg-date').value || Utils.todayISO(),
          weight, bodyFatPct: Number(document.getElementById('pg-fat').value) || null,
          measurements: Object.fromEntries(MEASURE_FIELDS.map(([k]) => [k, Number(document.getElementById(`pg-m-${k}`).value) || null])),
          photo: photoData, notes: document.getElementById('pg-notes').value.trim()
        };
        if (editing) Storage.update('progressLogs', editing.id, data);
        else Storage.insert('progressLogs', data);
        Utils.toast('Progreso guardado', 'success');
        onDone && onDone();
      }
    });
  }

  /* ---------------- Gráfica principal (selector de métrica) ---------------- */

  function renderMainChart(client, metric, exerciseId) {
    const canvas = document.getElementById('pg-main-chart');
    if (!canvas || !window.Chart) return;
    if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null; }

    let labels = [], data = [], label = '', color = '#5EEAD4', type = 'line';
    const unit = Utils.unitLabel();

    if (metric === 'weight') {
      const logs = logsOf(client.id);
      labels = logs.map(p => Utils.formatDate(p.date, { withYear: false, short: true }));
      data = logs.map(p => Utils.toUnit(p.weight));
      label = `Peso (${unit})`; color = '#5EEAD4';
    } else if (metric === 'bodyfat') {
      const logs = logsOf(client.id).filter(p => p.bodyFatPct);
      labels = logs.map(p => Utils.formatDate(p.date, { withYear: false, short: true }));
      data = logs.map(p => p.bodyFatPct);
      label = '% grasa corporal'; color = '#FBBF24';
    } else if (metric === 'volume') {
      const logs = Routines.logsOf(client.id);
      const byMonth = {};
      logs.forEach(l => {
        const key = Utils.monthKey(l.date);
        const vol = l.entries.reduce((s, e) => s + Utils.totalVolume(e.sets), 0);
        byMonth[key] = (byMonth[key] || 0) + vol;
      });
      const keys = Object.keys(byMonth).sort();
      labels = keys.map(k => Utils.monthLabel(k + '-01').slice(0, 3));
      data = keys.map(k => Utils.toUnit(byMonth[k]));
      label = `Volumen (${unit})`; color = '#FF4B6E'; type = 'bar';
    } else if (metric === 'strength') {
      if (!exerciseId) { return; }
      const series = strengthSeries(client.id, exerciseId);
      const ex = Exercises.get(exerciseId);
      labels = series.map(s => Utils.formatDate(s.date, { withYear: false, short: true }));
      const chartOpts = Charts.lineOptions();
      chartOpts.plugins.legend.display = true;
      chartOpts.plugins.legend.position = 'bottom';
      canvas._chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: `Peso máx. usado (${unit})`, data: series.map(s => Utils.toUnit(s.maxWeight)), borderColor: '#5EEAD4', backgroundColor: hexToRgba('#5EEAD4', .12), fill: true, pointBackgroundColor: '#5EEAD4' },
            { label: `1RM estimado (${unit})`, data: series.map(s => Utils.toUnit(s.est1RM)), borderColor: '#FF4B6E', backgroundColor: hexToRgba('#FF4B6E', .12), fill: true, pointBackgroundColor: '#FF4B6E' }
          ]
        },
        options: chartOpts
      });
      return;
    }

    canvas._chart = new Chart(canvas, {
      type,
      data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: type === 'bar' ? color : hexToRgba(color, .15), fill: type === 'line', borderRadius: type === 'bar' ? 6 : 0, pointBackgroundColor: color }] },
      options: type === 'bar' ? Charts.baseOptions() : Charts.lineOptions()
    });
  }

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  /* ---------------- Exportar a Excel (columnas reales, no CSV) ---------------- */

  function exportExcel(client) {
    const unit = Utils.unitLabel();
    const progressRows = logsOf(client.id).map(p => ({
      Fecha: p.date, [`Peso (${unit})`]: Utils.toUnit(p.weight), '% Grasa': p.bodyFatPct || '',
      'Pecho (cm)': p.measurements?.chest || '', 'Cintura (cm)': p.measurements?.waist || '',
      'Cadera (cm)': p.measurements?.hips || '', 'Brazo (cm)': p.measurements?.bicep || '',
      'Muslo (cm)': p.measurements?.thigh || '', 'Pantorrilla (cm)': p.measurements?.calf || '',
      Notas: p.notes || ''
    }));
    const workoutRows = Routines.logsOf(client.id).flatMap(l => l.entries.map(e => {
      const ex = Exercises.get(e.exerciseId);
      const vol = Utils.totalVolume(e.sets);
      const best1RM = Math.max(0, ...e.sets.map(s => Utils.estimate1RM(s.weight, s.reps)));
      return {
        Fecha: l.date, Ejercicio: ex ? ex.name : '(eliminado)', Series: e.sets.length,
        [`Volumen (${unit})`]: Utils.toUnit(vol), [`1RM estimado (${unit})`]: Utils.toUnit(best1RM),
        'Series efectivas': Utils.effectiveSets(e.sets), 'Duración (min)': l.minutes || ''
      };
    }));
    Utils.exportExcel(`pulso-progreso-${client.name.replace(/\s+/g, '-').toLowerCase()}.xlsx`, {
      Progreso: progressRows, Entrenamientos: workoutRows
    });
  }

  return { MEASURE_FIELDS, METRICS, logsOf, renderPage };
})();
