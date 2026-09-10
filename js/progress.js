/* ==========================================================================
   PROGRESS — seguimiento de progreso mes a mes por cliente
   ========================================================================== */

const Progress = (() => {

  const MEASURE_FIELDS = [
    ['chest', 'Pecho'], ['waist', 'Cintura'], ['hips', 'Cadera'],
    ['bicep', 'Brazo'], ['thigh', 'Muslo'], ['calf', 'Pantorrilla']
  ];

  function logsOf(clientId) { return Storage.all('progressLogs').filter(p => p.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date)); }

  function renderPage(container) {
    const client = State.getActiveClient();
    if (!client) { container.innerHTML = UI.noClientMsg(); return; }

    const paint = () => {
      const logs = logsOf(client.id);
      const first = logs[0], last = logs[logs.length - 1];
      const diff = (first && last && logs.length > 1) ? Utils.round(last.weight - first.weight, 1) : null;

      container.innerHTML = `
        <div class="section-header" style="justify-content:space-between;">
          <div><h2 class="section-title">Progreso de ${Utils.escapeHtml(client.name)}</h2>
          <p class="text-muted">Compara mes a mes peso, medidas y volumen de entrenamiento.</p></div>
          <button class="btn-primary" id="pg-new">+ Registrar progreso</button>
        </div>

        <div class="stat-cards">
          <div class="stat-card"><span>Peso actual</span><strong>${last ? last.weight + ' kg' : '—'}</strong></div>
          <div class="stat-card"><span>Cambio total</span><strong class="${diff > 0 ? 'text-danger' : diff < 0 ? 'text-success' : ''}">${diff != null ? (diff > 0 ? '+' : '') + diff + ' kg' : '—'}</strong></div>
          <div class="stat-card"><span>% grasa actual</span><strong>${last?.bodyFatPct ? last.bodyFatPct + '%' : '—'}</strong></div>
          <div class="stat-card"><span>Registros</span><strong>${logs.length}</strong></div>
        </div>

        <div class="chart-grid">
          <div class="chart-card"><h4>Peso corporal (kg)</h4><canvas id="pg-weight-chart" height="110"></canvas></div>
          <div class="chart-card"><h4>Volumen de entrenamiento por mes (kg)</h4><canvas id="pg-volume-chart" height="110"></canvas></div>
        </div>

        <h3 class="section-title" style="font-size:var(--fs-md); margin-top:var(--space-5);">Historial</h3>
        <div class="progress-timeline" id="pg-timeline">
          ${logs.slice().reverse().map(entryRow).join('') || `<div class="empty-state"><span class="empty-icon">📈</span><h3>Sin registros</h3><p>Agrega la primera medición de ${Utils.escapeHtml(client.name)}.</p></div>`}
        </div>`;

      container.querySelector('#pg-new').addEventListener('click', () => openEntry(client.id, null, paint));
      container.querySelectorAll('.progress-entry').forEach(row => {
        const id = row.dataset.id;
        row.querySelector('[data-act="edit"]').addEventListener('click', () => openEntry(client.id, id, paint));
        row.querySelector('[data-act="delete"]').addEventListener('click', () => {
          UI.confirm('¿Eliminar este registro de progreso?', () => { Storage.remove('progressLogs', id); paint(); });
        });
      });

      renderWeightChart(logs);
      renderVolumeChart(client.id);
    };

    paint();
  }

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
          <span class="chip chip-accent">${p.weight} kg</span>
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

    const body = `
      <div class="form-grid">
        <label class="field"><span>Fecha</span><input type="date" id="pg-date" value="${editing?.date || Utils.todayISO()}"></label>
        <label class="field"><span>Peso (kg)</span><input type="number" step="0.1" id="pg-weight" value="${editing?.weight ?? ''}" required></label>
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
          const file = e.target.files[0];
          if (!file) return;
          if (file.size > 1.5 * 1024 * 1024) { Utils.toast('La imagen es muy pesada para guardarse localmente (máx. ~1.5MB)', 'danger'); return; }
          const reader = new FileReader();
          reader.onload = ev => { photoData = ev.target.result; };
          reader.readAsDataURL(file);
        });
      },
      onConfirm: () => {
        const weight = Number(document.getElementById('pg-weight').value);
        if (!weight) { Utils.toast('El peso es obligatorio', 'danger'); return false; }
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

  function renderWeightChart(logs) {
    const canvas = document.getElementById('pg-weight-chart');
    if (!canvas || !window.Chart) return;
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: logs.map(p => Utils.formatDate(p.date, { withYear: false, short: true })),
        datasets: [{ label: 'Peso', data: logs.map(p => p.weight), borderColor: '#5EEAD4', backgroundColor: 'rgba(94,234,212,.15)', fill: true, pointBackgroundColor: '#5EEAD4' }]
      },
      options: Charts.lineOptions()
    });
  }

  function renderVolumeChart(clientId) {
    const canvas = document.getElementById('pg-volume-chart');
    if (!canvas || !window.Chart) return;
    const logs = Routines.logsOf(clientId);
    const byMonth = {};
    logs.forEach(l => {
      const key = Utils.monthKey(l.date);
      const vol = l.entries.reduce((s, e) => s + Utils.totalVolume(e.sets), 0);
      byMonth[key] = (byMonth[key] || 0) + vol;
    });
    const keys = Object.keys(byMonth).sort();
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: keys.map(k => Utils.monthLabel(k + '-01').slice(0, 3)), datasets: [{ label: 'Volumen', data: keys.map(k => Utils.round(byMonth[k], 0)), backgroundColor: '#FF4B6E', borderRadius: 6 }] },
      options: Charts.baseOptions()
    });
  }

  return { MEASURE_FIELDS, logsOf, renderPage };
})();
