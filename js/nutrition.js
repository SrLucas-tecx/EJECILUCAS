/* ==========================================================================
   NUTRITION — registro diario de comidas y macronutrientes por cliente
   ========================================================================== */

const Nutrition = (() => {

  function logsOf(clientId) { return Storage.all('nutritionLogs').filter(l => l.clientId === clientId); }
  function logOfDate(clientId, date) { return logsOf(clientId).find(l => l.date === date) || null; }

  function totals(log) {
    const items = (log?.meals || []).flatMap(m => m.items);
    return items.reduce((t, it) => ({
      kcal: t.kcal + (Number(it.kcal) || 0),
      protein: t.protein + (Number(it.protein) || 0),
      carbs: t.carbs + (Number(it.carbs) || 0),
      fat: t.fat + (Number(it.fat) || 0)
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function renderPage(container) {
    const client = State.getActiveClient();
    if (!client) { container.innerHTML = UI.noClientMsg(); return; }
    let date = Utils.todayISO();

    const paint = () => {
      const log = logOfDate(client.id, date) || { clientId: client.id, date, meals: [], waterMl: 0 };
      const t = totals(log);
      const target = client.targetCalories || 0;
      const pct = target ? Utils.clamp(Math.round((t.kcal / target) * 100), 0, 999) : null;

      container.innerHTML = `
        <div class="section-header" style="justify-content:space-between;">
          <div><h2 class="section-title">Alimentación de ${Utils.escapeHtml(client.name)}</h2>
          <p class="text-muted">Registra comidas y compara contra la meta calórica diaria.</p></div>
          <input type="date" id="nu-date" value="${date}">
        </div>

        <div class="nutrition-summary">
          <div class="nutri-kcal-card">
            <div class="kcal-ring" style="--pct:${pct != null ? Math.min(pct, 100) : 0}">
              <span>${t.kcal}</span><small>${target ? 'de ' + target + ' kcal' : 'kcal hoy'}</small>
            </div>
            ${target ? `<span class="text-muted" style="font-size:var(--fs-xs)">${pct}% de la meta diaria</span>` : `<span class="text-muted" style="font-size:var(--fs-xs)">Define una meta calórica en el perfil del cliente</span>`}
          </div>
          <div class="macro-bars">
            ${macroBar('Proteína', t.protein, '#5EEAD4')}
            ${macroBar('Carbohidratos', t.carbs, '#FF9F6B')}
            ${macroBar('Grasas', t.fat, '#FF4B6E')}
            <label class="field" style="margin-top:var(--space-2)"><span>💧 Agua (ml)</span>
              <input type="number" id="nu-water" min="0" step="100" value="${log.waterMl || 0}"></label>
          </div>
        </div>

        <div class="section-header" style="justify-content:space-between; margin-top:var(--space-4);">
          <h3 class="section-title" style="font-size:var(--fs-md)">Comidas del día</h3>
          <button class="btn-primary" id="nu-add-meal">+ Agregar comida</button>
        </div>
        <div id="nu-meals">${(log.meals || []).map((m, i) => mealBlock(m, i)).join('') || `<div class="empty-state"><span class="empty-icon">🍽️</span><h3>Sin comidas registradas</h3><p>Agrega el desayuno, comida, cena o snacks del día.</p></div>`}</div>

        <div class="section-header" style="margin-top:var(--space-5);"><h3 class="section-title" style="font-size:var(--fs-md)">Últimos 7 días</h3></div>
        <div class="chart-card"><canvas id="nu-week-chart" height="90"></canvas></div>
      `;

      container.querySelector('#nu-date').addEventListener('change', e => { date = e.target.value; paint(); });
      container.querySelector('#nu-water').addEventListener('input', Utils.debounce(e => {
        upsert(client.id, date, { waterMl: Number(e.target.value) || 0 });
      }, 300));
      container.querySelector('#nu-add-meal').addEventListener('click', () => openMealModal(client.id, date, null, paint));

      container.querySelectorAll('.meal-block').forEach(block => {
        const idx = Number(block.dataset.i);
        block.querySelector('[data-act="edit"]').addEventListener('click', () => openMealModal(client.id, date, idx, paint));
        block.querySelector('[data-act="delete"]').addEventListener('click', () => {
          const l = logOfDate(client.id, date);
          l.meals.splice(idx, 1);
          Storage.update('nutritionLogs', l.id, { meals: l.meals });
          paint();
        });
      });

      renderWeekChart(client.id, date);
    };

    paint();
  }

  function macroBar(label, grams, color) {
    return `<div class="macro-bar-row">
      <span>${label}</span>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${Utils.clamp(grams, 0, 300) / 3}%;background:${color}"></div></div>
      <strong>${Math.round(grams)} g</strong>
    </div>`;
  }

  function mealBlock(meal, i) {
    const t = meal.items.reduce((s, it) => s + (Number(it.kcal) || 0), 0);
    return `
    <div class="meal-block" data-i="${i}">
      <div class="meal-block-top">
        <h4>${Utils.escapeHtml(meal.name)} <span class="text-muted" style="font-weight:400">· ${meal.time || ''}</span></h4>
        <div>
          <span class="badge">${t} kcal</span>
          <button class="btn-icon-sm" data-act="edit" title="Editar">✏️</button>
          <button class="btn-icon-sm" data-act="delete" title="Eliminar">🗑️</button>
        </div>
      </div>
      <ul class="meal-items">
        ${meal.items.map(it => `<li>${Utils.escapeHtml(it.food)} <span class="text-muted">— ${it.kcal || 0} kcal · P${it.protein || 0} C${it.carbs || 0} G${it.fat || 0}</span></li>`).join('')}
      </ul>
    </div>`;
  }

  function upsert(clientId, date, patch) {
    let log = logOfDate(clientId, date);
    if (!log) log = Storage.insert('nutritionLogs', { clientId, date, meals: [], waterMl: 0, ...patch });
    else Storage.update('nutritionLogs', log.id, patch);
    return log;
  }

  function openMealModal(clientId, date, mealIndex, onDone) {
    const log = logOfDate(clientId, date) || upsert(clientId, date, {});
    const editing = mealIndex != null ? log.meals[mealIndex] : null;
    const draft = editing ? JSON.parse(JSON.stringify(editing)) : { name: '', time: '', items: [{ food: '', kcal: '', protein: '', carbs: '', fat: '' }] };

    const host = document.createElement('div');
    const paint = () => { host.innerHTML = mealFormMarkup(draft); wireMealForm(host, draft, paint); };

    UI.openModal({
      title: editing ? 'Editar comida' : 'Agregar comida',
      bodyEl: host,
      wide: true,
      confirmLabel: 'Guardar comida',
      onConfirm: () => {
        draft.name = host.querySelector('#ml-name').value.trim() || 'Comida';
        draft.time = host.querySelector('#ml-time').value;
        draft.items = draft.items.filter(it => it.food.trim());
        if (!draft.items.length) { Utils.toast('Agrega al menos un alimento', 'danger'); return false; }
        const fresh = logOfDate(clientId, date);
        const meals = [...fresh.meals];
        if (mealIndex != null) meals[mealIndex] = draft; else meals.push(draft);
        Storage.update('nutritionLogs', fresh.id, { meals });
        Utils.toast('Comida guardada', 'success');
        onDone && onDone();
      },
      onOpen: paint
    });
  }

  function mealFormMarkup(draft) {
    return `
      <div class="field-inline">
        <label class="field"><span>Nombre</span><input type="text" id="ml-name" value="${Utils.escapeHtml(draft.name)}" placeholder="Desayuno, Comida, Snack..."></label>
        <label class="field"><span>Hora</span><input type="time" id="ml-time" value="${draft.time || ''}"></label>
      </div>
      <table class="table-compact">
        <thead><tr><th>Alimento</th><th>Kcal</th><th>Prot (g)</th><th>Carb (g)</th><th>Grasa (g)</th><th></th></tr></thead>
        <tbody>
          ${draft.items.map((it, i) => `
            <tr data-i="${i}">
              <td><input type="text" class="ml-input" data-f="food" value="${Utils.escapeHtml(it.food)}" placeholder="Ej. Pechuga de pollo 150g"></td>
              <td><input type="number" min="0" class="ml-input" data-f="kcal" value="${it.kcal}"></td>
              <td><input type="number" min="0" class="ml-input" data-f="protein" value="${it.protein}"></td>
              <td><input type="number" min="0" class="ml-input" data-f="carbs" value="${it.carbs}"></td>
              <td><input type="number" min="0" class="ml-input" data-f="fat" value="${it.fat}"></td>
              <td><button type="button" class="btn-icon-sm ml-remove" data-i="${i}">✕</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      <button type="button" class="btn-sm btn-secondary" id="ml-add-item">+ Alimento</button>`;
  }

  function wireMealForm(host, draft, paint) {
    host.querySelectorAll('.ml-input').forEach(inp => inp.addEventListener('input', e => {
      const i = e.target.closest('tr').dataset.i;
      draft.items[i][e.target.dataset.f] = e.target.dataset.f === 'food' ? e.target.value : (e.target.value === '' ? '' : Number(e.target.value));
    }));
    host.querySelectorAll('.ml-remove').forEach(btn => btn.addEventListener('click', () => { draft.items.splice(btn.dataset.i, 1); paint(); }));
    host.querySelector('#ml-add-item').addEventListener('click', () => { draft.items.push({ food: '', kcal: '', protein: '', carbs: '', fat: '' }); paint(); });
  }

  function renderWeekChart(clientId, centerDate) {
    const canvas = document.getElementById('nu-week-chart');
    if (!canvas || !window.Chart) return;
    const days = [];
    const d0 = new Date(centerDate + 'T00:00:00');
    for (let i = 6; i >= 0; i--) {
      const d = new Date(d0); d.setDate(d0.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const data = days.map(day => Math.round(totals(logOfDate(clientId, day)).kcal));
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: days.map(d => Utils.formatDate(d, { withYear: false, short: true })),
        datasets: [{ label: 'Kcal', data, backgroundColor: '#FF4B6E', borderRadius: 6 }] },
      options: Charts.baseOptions()
    });
  }

  return { logsOf, logOfDate, totals, renderPage };
})();
