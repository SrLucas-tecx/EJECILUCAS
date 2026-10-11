/* ==========================================================================
   VOLUME — volumen semanal por músculo de una rutina
   Cuenta series directas (músculo principal) e indirectas (músculos
   secundarios, que valen la mitad), las compara con el mínimo efectivo (MEV)
   y el máximo recuperable (MRV), y avisa de frecuencia baja o "volumen basura"
   (demasiadas series del mismo músculo en una sola sesión).
   Supone que cada día de la rutina se entrena una vez por semana.
   ========================================================================== */

const Volume = (() => {

  const RANGE = { grande: [12, 20], pequeno: [8, 15] };   // series DIRECTAS por semana recomendadas
  const DEFAULTS = { mev: 10, mrv: 25 };                  // referencias en series semanales
  const INDIRECT_WEIGHT = 0.5;
  const SESSION_LIMIT = 10;     // más de esto en una sesión = volumen basura
  const SESSION_NOTICE = 8;     // 9-10: al límite

  const esc = Utils.escapeHtml;
  const fmt = n => String(Utils.round(n, 1));

  /* ---------------- Referencias (por cliente) ---------------- */

  function targetsFor(clientId) {
    const c = clientId ? Storage.find('clients', clientId) : null;
    const t = (c && c.volumeTargets) || {};
    const mev = Number(t.mev) > 0 ? Number(t.mev) : DEFAULTS.mev;
    let mrv = Number(t.mrv) > mev ? Number(t.mrv) : Math.max(DEFAULTS.mrv, mev + 1);
    return { mev, mrv, nearMrv: Math.max(mev, mrv - 3), custom: !!(c && c.volumeTargets) };
  }

  /* ---------------- Cálculo ---------------- */

  const setsOf = entry => (Array.isArray(entry.targetSets) ? entry.targetSets.length : (Number(entry.sets) || 3));

  // Músculos que reciben mucho trabajo indirecto de otros ejercicios (los presses ya trabajan el hombro frontal,
  // los remos el hombro posterior y el trapecio, etc.): se evalúan con las series efectivas, no solo las directas.
  const INDIRECT_METRIC = new Set(['hombro-frontal', 'hombro-posterior', 'trapecio', 'antebrazo', 'espalda-baja', 'oblicuos']);

  // Los grupos grandes se miden en series efectivas (directas + la mitad de las indirectas); los pequeños, en directas.
  function metricOf(r) {
    const useTotal = MuscleMap.sizeOf(r.id) === 'grande' || INDIRECT_METRIC.has(r.id);
    return { useTotal, value: useTotal ? r.total : r.direct, kind: useTotal ? 'efectivas' : 'directas' };
  }

  function levelOf(r, t) {
    const size = MuscleMap.sizeOf(r.id);
    const [lo, hi] = RANGE[size] || RANGE.pequeno;
    const { value, kind } = metricOf(r);
    const min = Math.min(t.mev, lo);   // los músculos pequeños no piden más que su rango mínimo
    if (r.total > t.mrv) return { level: 'danger', hint: `Supera el máximo recuperable (${t.mrv}): riesgo de fatiga acumulada y estancamiento.` };
    if (r.direct === 0 && size !== 'grande') return { level: 'neutral', hint: 'Solo trabajo indirecto (es músculo secundario de otros ejercicios).' };
    if (value < min) return { level: 'warn', hint: `Por debajo del mínimo efectivo (${min} series ${kind}). Suma series.` };
    if (r.total >= t.nearMrv) return { level: 'warn', hint: `Cerca del máximo recuperable (${t.mrv}). Cuida la recuperación.` };
    if (value < lo) return { level: 'warn', hint: `Mejorable: lo recomendado es ${lo}-${hi} series ${kind} por semana.` };
    if (value > hi) return { level: 'warn', hint: `Por encima de lo recomendado (${lo}-${hi} ${kind}), aunque dentro del máximo recuperable.` };
    return { level: 'ok', hint: '' };
  }

  /**
   * days: [{ name, exercises: [{ exerciseId, targetSets }] }]
   * Devuelve { targets, rows, warnings, untrained } con rows ordenadas por sección del cuerpo.
   */
  function analyze(days, clientId) {
    const targets = targetsFor(clientId);
    const acc = {};
    const slot = id => (acc[id] = acc[id] || { id, direct: 0, indirect: 0, days: [] });

    days.forEach(day => {
      const perDay = {};
      (day.exercises || []).forEach(entry => {
        const ex = Exercises.get(entry.exerciseId);
        if (!ex) return;
        const n = setsOf(entry);
        (ex.muscles || []).forEach(m => { slot(m).direct += n; perDay[m] = (perDay[m] || 0) + n; });
        (ex.secondary || []).forEach(m => { if (!(ex.muscles || []).includes(m)) slot(m).indirect += n; });
      });
      Object.entries(perDay).forEach(([m, n]) => slot(m).days.push({ name: day.name, sets: n }));
    });

    const rows = Object.values(acc).map(r => {
      const total = Utils.round(r.direct + INDIRECT_WEIGHT * r.indirect, 1);
      const full = { ...r, total, freq: r.days.length, maxSession: Math.max(0, ...r.days.map(d => d.sets)) };
      return { ...full, ...levelOf(full, targets) };
    });

    // Orden: por sección del cuerpo (las de fábrica primero, luego las propias)
    const order = MuscleMap.groups({ includeHidden: true }).flatMap(g => g.muscles);
    rows.sort((a, b) => {
      const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

    const warnings = [];
    rows.forEach(r => {
      const name = MuscleMap.muscleLabel(r.id);
      const worst = r.days.reduce((w, d) => (d.sets > w.sets ? d : w), { sets: 0 });
      if (r.maxSession > SESSION_LIMIT) {
        warnings.push({ level: 'danger', text: `${name}: ${r.maxSession} series directas en "${worst.name}". Pasar de ${SESSION_NOTICE}-${SESSION_LIMIT} por sesión es volumen basura: reparte parte en otro día.` });
      } else if (r.maxSession > SESSION_NOTICE) {
        warnings.push({ level: 'warn', text: `${name}: ${r.maxSession} series directas en "${worst.name}", al límite de ${SESSION_NOTICE}-${SESSION_LIMIT} por sesión.` });
      }
      if (days.length >= 2 && r.freq === 1 && r.direct >= 6) {
        warnings.push({ level: 'warn', text: `${name} se trabaja solo 1 día a la semana. Lo ideal es repartirlo en 2 o 3 sesiones no consecutivas.` });
      }
      if (r.freq > 3) {
        warnings.push({ level: 'warn', text: `${name} se trabaja ${r.freq} días a la semana: revisa que alcance a recuperarse entre sesiones.` });
      }
    });

    const used = new Set(rows.map(r => r.id));
    const untrained = MuscleMap.groups().flatMap(g => g.muscles).filter(id => !used.has(id));
    return { targets, rows, warnings, untrained, days: days.length };
  }

  /* ---------------- Panel (se usa en el constructor de rutina) ---------------- */

  let settingsOpen = false;

  function barHtml(r, scale, t) {
    const pct = v => Math.min(100, (v / scale) * 100);
    const indirectPart = Utils.round(r.total - r.direct, 1);
    return `
      <div class="vol-bar" role="img" aria-label="${esc(MuscleMap.muscleLabel(r.id))}: ${fmt(r.total)} series efectivas por semana">
        <span class="vol-fill" style="width:${pct(r.direct)}%"></span>
        <span class="vol-fill vol-fill-ind" style="left:${pct(r.direct)}%; width:${pct(Math.max(0, indirectPart))}%"></span>
        <span class="vol-mark" style="left:${pct(t.mev)}%" title="Mínimo efectivo (${t.mev})"></span>
        <span class="vol-mark vol-mark-max" style="left:${pct(t.mrv)}%" title="Máximo recuperable (${t.mrv})"></span>
      </div>`;
  }

  function rowHtml(r, scale, t) {
    const range = RANGE[MuscleMap.sizeOf(r.id)] || RANGE.pequeno;
    return `
      <div class="vol-row is-${r.level}">
        <div class="vol-name"><strong>${esc(MuscleMap.muscleLabel(r.id))}</strong>
          ${r.freq ? `<span class="chip">${r.freq}×/sem</span>` : ''}</div>
        ${barHtml(r, scale, t)}
        <div class="vol-nums"><strong>${fmt(r.total)}</strong>
          <small>${r.direct} directas${r.indirect ? ` + ${r.indirect} indirectas` : ''} · rec. ${range[0]}-${range[1]} ${metricOf(r).kind}</small></div>
        ${r.hint ? `<div class="vol-hint">${esc(r.hint)}</div>` : ''}
      </div>`;
  }

  function panelHtml(days, clientId, open) {
    const a = analyze(days, clientId);
    const t = a.targets;
    const scale = Math.max(t.mrv + 5, Math.ceil(Math.max(0, ...a.rows.map(r => r.total))));
    const count = lvl => a.rows.filter(r => r.level === lvl).length;
    const bad = count('danger') + a.warnings.filter(w => w.level === 'danger').length;
    const warn = count('warn');
    const summary = a.rows.length
      ? `${count('ok')} en rango${warn ? ` · ${warn} por revisar` : ''}${bad ? ` · ${bad} en exceso` : ''}`
      : 'Agrega ejercicios para ver el volumen';

    const byGroup = MuscleMap.groups({ includeHidden: true }).map(g => ({
      label: g.label, rows: a.rows.filter(r => g.muscles.includes(r.id))
    }));
    const known = new Set(byGroup.flatMap(g => g.rows.map(r => r.id)));
    const others = a.rows.filter(r => !known.has(r.id));
    if (others.length) byGroup.push({ label: 'Otros', rows: others });

    return `
      <details class="vol-panel" id="vol-panel" ${open ? 'open' : ''}>
        <summary><span>📊 Volumen semanal</span><span class="vol-summary">${summary}</span></summary>
        <div class="vol-body">
          <p class="vol-intro">Cada día de la rutina se cuenta como una sesión por semana. Las series directas son las del músculo principal; las indirectas (músculos secundarios) valen la mitad. En músculos grandes se mide el total (efectivas); en los pequeños, las directas.
            Referencias: ${Help.term('mev', 'mínimo efectivo')} ${t.mev} y ${Help.term('mrv', 'máximo recuperable')} ${t.mrv} series por semana.</p>
          ${a.rows.length ? byGroup.filter(g => g.rows.length).map(g => `
            <div class="vol-group">
              <div class="vol-group-label">${esc(g.label)}</div>
              ${g.rows.map(r => rowHtml(r, scale, t)).join('')}
            </div>`).join('') : ''}
          ${a.rows.length ? `<div class="vol-legend"><span><i class="vol-key"></i> directas</span><span><i class="vol-key vol-key-ind"></i> indirectas (mitad)</span><span><i class="vol-key vol-key-mark"></i> mínimo y máximo</span></div>` : ''}
          ${a.warnings.length ? `
            <div class="vol-warnings">
              ${a.warnings.map(w => `<div class="vol-warning is-${w.level}">${esc(w.text)}</div>`).join('')}
              <p class="text-muted" style="font-size:var(--fs-xs); margin:4px 0 0;">${Help.term('volumenbasura', '¿Qué es el volumen basura?')}</p>
            </div>` : ''}
          ${a.untrained.length && a.rows.length ? `<p class="text-muted vol-untrained">Sin trabajo en esta rutina: ${a.untrained.map(id => esc(MuscleMap.muscleLabel(id))).join(', ')}.</p>` : ''}
          <details class="vol-settings" ${settingsOpen ? 'open' : ''}>
            <summary>⚙️ Ajustar referencias de este cliente</summary>
            <p class="text-muted" style="font-size:var(--fs-xs); margin:0 0 var(--space-2);">Un principiante suele progresar cerca del mínimo; un avanzado necesita más. Se guardan solo para este cliente.</p>
            <div class="field-inline">
              <label class="field"><span>Mínimo efectivo</span><input type="number" id="vol-mev" min="1" max="40" inputmode="numeric" value="${t.mev}"></label>
              <label class="field"><span>Máximo recuperable</span><input type="number" id="vol-mrv" min="2" max="50" inputmode="numeric" value="${t.mrv}"></label>
              <button type="button" class="btn-sm btn-secondary" id="vol-reset" ${t.custom ? '' : 'disabled'}>Restablecer</button>
            </div>
          </details>
        </div>
      </details>`;
  }

  // onChange: se llama cuando cambian las referencias (para repintar); onToggle(open): recuerda si el panel está abierto
  function wirePanel(host, { clientId, onChange, onToggle } = {}) {
    const panel = host.querySelector('#vol-panel');
    if (!panel) return;
    panel.addEventListener('toggle', () => { if (onToggle) onToggle(panel.open); });
    const settings = panel.querySelector('.vol-settings');
    if (settings) settings.addEventListener('toggle', () => { settingsOpen = settings.open; });

    const save = () => {
      const mev = Number(panel.querySelector('#vol-mev').value);
      const mrv = Number(panel.querySelector('#vol-mrv').value);
      if (!(mev >= 1) || !(mrv > mev)) { Utils.toast('El máximo debe ser mayor que el mínimo', 'danger'); if (onChange) onChange(); return; }
      if (clientId) Storage.update('clients', clientId, { volumeTargets: { mev: Math.round(mev), mrv: Math.round(mrv) } });
      if (onChange) onChange();
    };
    panel.querySelector('#vol-mev').addEventListener('change', save);
    panel.querySelector('#vol-mrv').addEventListener('change', save);
    panel.querySelector('#vol-reset').addEventListener('click', () => {
      if (clientId) Storage.update('clients', clientId, { volumeTargets: null });
      if (onChange) onChange();
    });
  }

  return { RANGE, DEFAULTS, INDIRECT_WEIGHT, targetsFor, analyze, panelHtml, wirePanel };
})();
