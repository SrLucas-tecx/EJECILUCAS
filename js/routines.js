/* ==========================================================================
   ROUTINES — constructor de rutinas por cliente + registro de entrenamientos
   Calcula volumen total, series efectivas y 1RM estimado (fórmula de Epley)
   Los pesos se guardan SIEMPRE en kg; se muestran en kg o lb según Ajustes.
   ========================================================================== */

const Routines = (() => {

  let copiedRoutine = null;

  function all(clientId) { return Storage.all('routines').filter(r => r.clientId === clientId); }
  function get(id) { return Storage.find('routines', id); }
  function logsOf(clientId) { return Storage.all('workoutLogs').filter(l => l.clientId === clientId); }

  function copyRoutine(id, container) {
    const routine = get(id);
    if (!routine) return;
    copiedRoutine = JSON.parse(JSON.stringify(routine));
    Utils.toast(`Rutina "${routine.name}" copiada. Cambia al cliente destino y pégala.`, 'success');
    renderPage(container);
  }

  function pasteRoutine(container) {
    const client = State.getActiveClient();
    if (!copiedRoutine || !client) return;

    const routine = JSON.parse(JSON.stringify(copiedRoutine));
    delete routine.id;
    delete routine.createdAt;
    delete routine.updatedAt;
    routine.clientId = client.id;
    routine.days.forEach(day => { day.id = Utils.uid('day'); });
    Storage.insert('routines', routine);
    Utils.toast(`Rutina "${routine.name}" pegada para ${client.name}`, 'success');
    renderPage(container);
  }

  function newDay(name) {
    return { id: Utils.uid('day'), name: name || `Día ${1}`, exercises: [] };
  }

  // Compatibilidad: rutinas viejas guardaban {sets:3, reps:'8-12', weight, rir} planos.
  // Esto los convierte (sin tocar el storage hasta que el usuario edite algo) a un
  // arreglo de series individuales, igual que se ve en el registro de entrenamiento.
  function normalizeTargetSets(ex) {
    if (Array.isArray(ex.targetSets)) return ex.targetSets;
    const n = Number(ex.sets) || 3;
    return Array.from({ length: n }, () => ({ reps: ex.reps ?? '8-12', weight: ex.weight ?? '', rir: ex.rir ?? '', side: 'ambos' }));
  }

  /* ---------------- Historial por ejercicio: última sesión, récords y sugerencia de peso ---------------- */

  // Última sesión ANTERIOR a `date` en la que el cliente hizo este ejercicio (en cualquier rutina)
  function priorSession(clientId, exerciseId, date, excludeId) {
    const timed = !!Exercises.get(exerciseId)?.measureByTime;
    const prev = logsOf(clientId)
      .filter(l => l.id !== excludeId && l.date < date && l.entries.some(e =>
        e.exerciseId === exerciseId && e.sets.some(s => timed
          ? Number(s.time) > 0
          : Number(s.weight) > 0 && Number(s.reps) > 0)))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prev) return null;
    const sets = prev.entries.find(e => e.exerciseId === exerciseId).sets
      .filter(s => timed ? Number(s.time) > 0 : Number(s.weight) > 0 && Number(s.reps) > 0);
    return sets.length ? { date: prev.date, sets } : null;
  }

  /* ---------------- Peso corporal + extra ----------------
     En ejercicios de "Peso corporal" el campo de peso pasa a ser el EXTRA (opcional) que se agrega.
     Cada serie guarda: extra (lo que se anotó), bw (peso corporal del cliente en esa fecha) y
     weight = bw + extra (la carga TOTAL). Así el volumen, el 1RM estimado y los PR siguen
     funcionando sin cambios, y una serie sin extra (solo el cuerpo) también cuenta.
     Las series guardadas antes de esta función no tienen bw: se asume bw = 0 y no se alteran. */

  // Peso corporal (kg) del cliente: el último registro de Progreso hasta esa fecha
  // (si todos son posteriores, el más cercano). 0 si no hay ninguno.
  function bodyWeightKg(clientId, date) {
    const logs = Progress.logsOf(clientId).filter(p => Number(p.weight) > 0);
    if (!logs.length) return 0;
    const upTo = logs.filter(p => p.date <= date);
    return Number((upTo.length ? upTo[upTo.length - 1] : logs[0]).weight) || 0;
  }

  const totalLoad = (bw, extra) => Utils.round((Number(bw) || 0) + (Number(extra) || 0), 2);

  // Serie nueva del registro a partir de una serie objetivo de la rutina
  function newLogSet(ts, ex, clientId, date) {
    const side = sideOf(ts);
    if (ex?.measureByTime) {
      return { time: '', weight: ts.weight || '', reps: '', rpe: '', rir: '', side };
    }
    if (Exercises.isBodyweight(ex)) {
      const bw = bodyWeightKg(clientId, date);
      const extra = (ts.weight === '' || ts.weight == null) ? '' : (Number(ts.weight) || 0);
      return { extra, bw, weight: totalLoad(bw, extra), reps: '', rpe: '', rir: '', side };
    }
    return { weight: ts.weight || '', reps: '', rpe: '', rir: '', side };
  }

  function setExtra(s, extra) { s.extra = extra; s.weight = totalLoad(s.bw, extra); }

  // Texto de la carga de una serie: "+10 kg" / "Peso corporal" / "20 kg"
  function loadText(s, bodyweight, unit) {
    if (!bodyweight) return `${Utils.toUnit(s.weight)} ${unit}`;
    const extra = Number(s.extra ?? s.weight) || 0;
    return extra ? `+${Utils.toUnit(extra)} ${unit}` : 'Peso corporal';
  }

  // El lado de una serie: 'ambos' (bilateral, o unilateral hecho parejo en una sola fila),
  // 'izq' o 'der'. Los datos guardados antes de esta función no tienen el campo -> 'ambos'.
  function sideOf(s) { return s.side || 'ambos'; }

  // Mejor 1RM estimado (Epley) de todas las sesiones anteriores a `date`.
  // `side`, si se pasa, solo cuenta las series de ese lado (para ejercicios unilaterales,
  // cada lado tiene su propio récord — es común tener una diferencia de fuerza entre lados).
  function bestBefore(clientId, exerciseId, date, excludeId, side) {
    let best = 0;
    logsOf(clientId).forEach(l => {
      if (l.id === excludeId || l.date >= date) return;
      l.entries.forEach(e => {
        if (e.exerciseId !== exerciseId) return;
        e.sets.forEach(s => {
          if (side && sideOf(s) !== side) return;
          best = Math.max(best, Utils.estimate1RM(s.weight, s.reps));
        });
      });
    });
    return best;
  }

  // Índice de la serie que supera el récord previo (solo la mejor de la sesión), o -1.
  // Sin historial previo no hay récord que superar, así que no se marca nada.
  function prSetIndex(entry, prevBest, side) {
    if (!prevBest) return -1;
    let idx = -1, top = prevBest;
    entry.sets.forEach((s, j) => {
      if (side && sideOf(s) !== side) return;
      const rm = Utils.estimate1RM(s.weight, s.reps);
      if (rm > top) { top = rm; idx = j; }
    });
    return idx;
  }

  // Índices de serie que son récord en este entry. Los ejercicios unilaterales evalúan cada
  // lado por separado (una serie del lado más fuerte no debe "tapar" el récord del otro lado).
  // Devuelve un Set vacío si el ejercicio tiene desactivado el seguimiento de PR.
  function prIndexesForEntry(entry, exercise, clientId, date, excludeId) {
    const out = new Set();
    if (exercise && exercise.trackPR === false) return out;
    if (exercise && exercise.unilateral) {
      ['izq', 'der'].forEach(side => {
        const idx = prSetIndex(entry, bestBefore(clientId, entry.exerciseId, date, excludeId, side), side);
        if (idx >= 0) out.add(idx);
      });
    } else {
      const idx = prSetIndex(entry, bestBefore(clientId, entry.exerciseId, date, excludeId));
      if (idx >= 0) out.add(idx);
    }
    return out;
  }

  function countPRs(draft) {
    return draft.entries.reduce((n, e) =>
      n + (Exercises.get(e.exerciseId)?.measureByTime ? 0 : prIndexesForEntry(e, Exercises.get(e.exerciseId), draft.clientId, draft.date, draft.id).size), 0);
  }

  // La mejor serie registrada JAMÁS (cualquier fecha) de este ejercicio con este cliente.
  // Se usa para precargar la calculadora de PR con un punto de partida razonable.
  function bestSetEver(clientId, exerciseId) {
    let best = null;
    logsOf(clientId).forEach(l => l.entries.forEach(e => {
      if (e.exerciseId !== exerciseId) return;
      e.sets.forEach(s => {
        if (!(Number(s.weight) > 0 && Number(s.reps) > 0)) return;
        const rm = Utils.estimate1RM(s.weight, s.reps);
        if (!best || rm > best.rm) best = { date: l.date, weight: s.weight, reps: s.reps, rm, side: sideOf(s) };
      });
    }));
    return best;
  }

  // Doble progresión: si en la sesión anterior TODAS las series llegaron al tope del rango
  // de reps objetivo, se sugiere subir el peso (+2.5 kg o +5 lb).
  function overloadHint(prior, routineExercise) {
    if (!prior || prior.sets.length < 2 || !routineExercise) return null;
    const nums = normalizeTargetSets(routineExercise)
      .flatMap(s => String(s.reps ?? '').match(/\d+/g) || []).map(Number);
    if (!nums.length) return null;
    const top = Math.max(...nums);
    if (!prior.sets.every(s => Number(s.reps) >= top)) return null;
    const from = Utils.toUnit(Math.max(...prior.sets.map(s => Number(s.weight))));
    const inc = Utils.currentUnit() === 'lb' ? 5 : 2.5;
    return { top, from, to: Utils.round(from + inc, 1) };
  }

  function rmCellHtml(s, isPR) {
    if (!(s.weight && s.reps)) return '—';
    return `${Utils.toUnit(Utils.estimate1RM(s.weight, s.reps))} ${Utils.unitLabel()}${isPR ? ' <span class="pr-badge">🏆 PR</span>' : ''}`;
  }

  // Actualiza las celdas de 1RM / PR de un ejercicio sin repintar todo el formulario
  function refreshRmCells(host, draft, i) {
    const entry = draft.entries[i];
    const ex = Exercises.get(entry.exerciseId);
    if (ex && (ex.trackPR === false || ex.measureByTime)) return;   // estos ejercicios no muestran columna de PR
    const prIdx = prIndexesForEntry(entry, ex, draft.clientId, draft.date, draft.id);
    host.querySelectorAll(`tr[data-i="${i}"]`).forEach(tr => {
      const cell = tr.querySelector('.rm-cell');
      if (cell) cell.innerHTML = rmCellHtml(entry.sets[Number(tr.dataset.j)], prIdx.has(Number(tr.dataset.j)));
    });
  }

  function renderPage(container) {
    const client = State.getActiveClient();
    if (!client) { container.innerHTML = UI.noClientMsg(); return; }

    const routines = all(client.id);
    container.innerHTML = `
      <div class="section-header" style="justify-content:space-between;">
        <div><h2 class="section-title">Rutinas de ${Utils.escapeHtml(client.name)}</h2>
        <p class="text-muted">Crea rutinas por día, asigna ejercicios y registra el entrenamiento real.</p></div>
        <div class="client-card-actions">
          ${copiedRoutine ? '<button class="btn-sm btn-secondary" id="rt-paste">📥 Pegar rutina copiada</button>' : ''}
          <button class="btn-primary" id="rt-new">+ Nueva rutina</button>
        </div>
      </div>
      <div class="routines-list" id="rt-list"></div>`;

    container.querySelector('#rt-new').addEventListener('click', () => openBuilder(null, () => renderPage(container)));
    const pasteButton = container.querySelector('#rt-paste');
    if (pasteButton) pasteButton.addEventListener('click', () => pasteRoutine(container));
    const list = container.querySelector('#rt-list');
    list.innerHTML = routines.length ? routines.map(routineCard).join('')
      : `<div class="empty-state"><span class="empty-icon">📋</span><h3>Sin rutinas todavía</h3><p>Crea la primera rutina para ${Utils.escapeHtml(client.name)}.</p></div>`;

    list.querySelectorAll('.routine-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('[data-act="edit"]').addEventListener('click', () => openBuilder(id, () => renderPage(container)));
      card.querySelector('[data-act="copy"]').addEventListener('click', () => copyRoutine(id, container));
      card.querySelector('[data-act="log"]').addEventListener('click', () => openLogger(id, () => renderPage(container)));
      card.querySelector('[data-act="history"]').addEventListener('click', () => openHistory(id, () => renderPage(container)));
      card.querySelector('[data-act="pdf"]').addEventListener('click', () => exportPDF(get(id)));
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
      ${r.notes ? `<p class="text-muted" style="font-size:var(--fs-xs); margin:0 0 var(--space-2);">📝 ${Utils.escapeHtml(r.notes)}</p>` : ''}
      <div class="client-card-actions">
        <button class="btn-sm btn-secondary" data-act="edit">✏️ Editar</button>
        <button class="btn-sm btn-secondary" data-act="copy">📋 Copiar rutina</button>
        <button class="btn-sm btn-primary" data-act="log">🏋️ Registrar entrenamiento</button>
        <button class="btn-sm btn-secondary" data-act="history">📜 Historial</button>
        <button class="btn-sm btn-secondary" data-act="pdf">📄 PDF</button>
        <button class="btn-icon-sm" data-act="delete" title="Eliminar">🗑️</button>
      </div>
    </article>`;
  }

  /* ---------------- Guía de referencia RIR / RPE ---------------- */

  function openRirRpeGuide() {
    UI.openModal({
      title: '📏 Guía RIR / RPE',
      hideFooter: true,
      body: `
        <p><strong>Fallo técnico:</strong> el punto de una serie donde la fatiga impide completar una repetición extra manteniendo la forma correcta. Todas las métricas de intensidad se basan en este fallo técnico, no en el fallo concéntrico absoluto.</p>
        <table class="table-compact" style="margin-top:var(--space-3);">
          <thead><tr><th>RPE</th><th>RIR</th><th>Nivel</th><th>Objetivo típico</th></tr></thead>
          <tbody>
            <tr><td>10</td><td>0</td><td>Máximo / Fallo técnico</td><td>Hipertrofia (series finales) / Test de fuerza</td></tr>
            <tr><td>9</td><td>1</td><td>Muy alto</td><td>Hipertrofia (estímulo óptimo) / Fuerza máxima</td></tr>
            <tr><td>8</td><td>2</td><td>Alto / desafiante</td><td>Fuerza / Hipertrofia (volumen acumulativo)</td></tr>
            <tr><td>7</td><td>3</td><td>Moderado</td><td>Potencia / primeras series de la sesión</td></tr>
          </tbody>
        </table>
        <p class="text-muted" style="font-size:var(--fs-xs); margin-top:var(--space-2);">RIR 3+ se considera de menor intensidad (calentamiento o aproximación).</p>
      `
    });
  }

  /* ---------------- Exportar rutina a PDF ----------------
     Se dibuja directo con jsPDF (texto vectorial), SIN pasar por html2canvas.
     La versión anterior tomaba una "foto" (canvas) de un <div> oculto y la
     insertaba como imagen; en navegadores con protección anti-fingerprinting
     (Opera GX la trae activada por defecto) el navegador puede negarse a
     entregar los píxeles reales del canvas, y el PDF sale completamente en
     blanco sin que salte ningún error. Dibujar el texto directamente evita
     el canvas por completo, así que ese problema no puede volver a pasar. */

  function exportPDF(routine) {
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) { Utils.toast('No se pudo cargar el generador de PDF (revisa tu conexión a internet)', 'danger'); return; }
    const client = Storage.find('clients', routine.clientId);
    const unit = Utils.unitLabel();
    const doc = new jsPDFCtor({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const margin = 15, pageW = 210, pageH = 297;
    const contentW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = needed => { if (y + needed > pageH - margin) { doc.addPage(); y = margin; } };
    const rowH = 6.2;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(20);
    doc.text(`EJERCILUCAS - ${routine.name}`, margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`Cliente: ${client ? client.name : ''} - Generado el ${Utils.formatDate(Utils.todayISO())}`, margin, y);
    y += 6;

    if (routine.notes) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60);
      const lines = doc.splitTextToSize(routine.notes, contentW - 8);
      const boxH = lines.length * 4.2 + 5;
      ensureSpace(boxH + 4);
      doc.setFillColor(247, 247, 247);
      doc.rect(margin, y, contentW, boxH, 'F');
      doc.setDrawColor(255, 75, 110); doc.setLineWidth(1);
      doc.line(margin, y, margin, y + boxH);
      doc.text(lines, margin + 4, y + 5);
      y += boxH + 6;
    }

    routine.days.forEach(day => {
      ensureSpace(16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20);
      doc.text(day.name, margin, y);
      doc.setDrawColor(255, 75, 110); doc.setLineWidth(0.6);
      doc.line(margin, y + 1.8, margin + contentW, y + 1.8);
      y += 9;

      if (!day.exercises.length) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(140);
        doc.text('Sin ejercicios', margin, y);
        y += 8;
        return;
      }

      day.exercises.forEach(ex => {
        const meta = Exercises.get(ex.exerciseId);
        const uni = !!meta?.unilateral;
        const bwEx = Exercises.isBodyweight(meta);
        const sets = normalizeTargetSets(ex);
        const sideLabel = { izq: 'Izq.', der: 'Der.', ambos: 'Ambos' };
        const pesoLabel = bwEx ? `Extra obj. (${unit})` : `Peso obj. (${unit})`;
        const pesoVal = w => w ? (bwEx ? '+' : '') + Utils.toUnit(w) : (bwEx ? 'Peso corporal' : '—');

        ensureSpace(10);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20);
        doc.text(`${meta ? meta.name : '(ejercicio eliminado)'}${uni ? ' (unilateral)' : ''}`, margin, y);
        y += 5;

        const metricLabel = meta?.measureByTime ? 'Tiempo (seg)' : 'Reps obj.';
        const cols = uni
          ? [{ label: 'Serie', w: 14 }, { label: 'Lado', w: 24 }, { label: metricLabel, w: 34 },
             { label: pesoLabel, w: 52 }, { label: 'RIR obj.', w: contentW - 124 }]
          : [{ label: 'Serie', w: 16 }, { label: metricLabel, w: 44 },
             { label: pesoLabel, w: 60 }, { label: 'RIR obj.', w: contentW - 120 }];

        ensureSpace(rowH * (sets.length + 1) + 4);

        let x = margin;
        doc.setFillColor(242, 242, 242);
        doc.rect(margin, y, contentW, rowH, 'F');
        doc.setDrawColor(220); doc.setLineWidth(0.2);
        doc.rect(margin, y, contentW, rowH);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(90);
        cols.forEach(c => { doc.text(c.label, x + c.w / 2, y + rowH / 2 + 1.2, { align: 'center' }); x += c.w; });
        y += rowH;

        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(30);
        sets.forEach((s, k) => {
          ensureSpace(rowH);
          x = margin;
          doc.rect(margin, y, contentW, rowH);
          const metricValue = meta?.measureByTime ? `${s.time ?? ''} s` : s.reps ?? '';
          const values = uni
            ? [k + 1, sideLabel[sideOf(s)], metricValue, pesoVal(s.weight), s.rir === '' || s.rir == null ? '—' : s.rir]
            : [k + 1, metricValue, pesoVal(s.weight), s.rir === '' || s.rir == null ? '—' : s.rir];
          cols.forEach((c, ci) => { doc.text(String(values[ci]), x + c.w / 2, y + rowH / 2 + 1.2, { align: 'center' }); x += c.w; });
          y += rowH;
        });
        y += 4;
      });
    });

    ensureSpace(8);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(160);
    doc.text('Generado con EJERCILUCAS - Entrenador Personal', margin, y);

    doc.save(`rutina-${routine.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }

  /* ---------------- Constructor de rutina ---------------- */

  function openBuilder(routineId, onDone) {
    const client = State.getActiveClient();
    const editing = routineId ? get(routineId) : null;
    const draft = editing ? JSON.parse(JSON.stringify(editing)) : { clientId: client.id, name: '', notes: '', days: [newDay('Día 1')] };
    const builderState = { activeDayIndex: 0, copiedExercises: null };

    const bodyHost = document.createElement('div');
    const paint = (dayIndex = builderState.activeDayIndex) => {
      builderState.activeDayIndex = Math.max(0, Math.min(dayIndex, draft.days.length - 1));
      bodyHost.innerHTML = builderMarkup(draft, builderState.activeDayIndex, builderState.copiedExercises !== null);
      wireBuilder(bodyHost, draft, paint, builderState);
    };

    UI.openModal({
      title: editing ? 'Editar rutina' : 'Nueva rutina',
      bodyEl: bodyHost,
      wide: true,
      confirmLabel: 'Guardar rutina',
      onConfirm: () => {
        const name = bodyHost.querySelector('#rt-name').value.trim();
        if (!name) { Utils.toast('Ponle nombre a la rutina', 'danger'); return false; }
        draft.name = name;
        draft.notes = bodyHost.querySelector('#rt-notes').value.trim();
        if (!draft.days.some(d => d.exercises.length)) { Utils.toast('Agrega al menos un ejercicio', 'danger'); return false; }
        if (editing) Storage.update('routines', editing.id, draft);
        else Storage.insert('routines', draft);
        Utils.toast('Rutina guardada', 'success');
        onDone && onDone();
      },
      onOpen: paint
    });
  }

  function builderMarkup(draft, activeDayIndex, hasCopiedExercises) {
    return `
      <div style="text-align:right; margin-bottom:var(--space-2);"><button type="button" class="btn-sm btn-secondary" id="rt-glossary">❓ Glosario (RIR, PR, RPE…)</button></div>
      <label class="field field-wide"><span>Nombre de la rutina</span>
        <input type="text" id="rt-name" value="${Utils.escapeHtml(draft.name)}" placeholder="Ej. Fuerza 4 días - Ana"></label>
      <label class="field field-wide"><span>Anotaciones (opcional)</span>
        <textarea id="rt-notes" rows="2" placeholder="Notas para esta rutina: progresiones, lesiones a cuidar, etc.">${Utils.escapeHtml(draft.notes || '')}</textarea></label>
      <div class="rt-days-tabs" id="rt-days-tabs">
        ${draft.days.map((d, i) => `<button type="button" class="rt-day-tab ${i === 0 ? 'active' : ''}" data-i="${i}">${Utils.escapeHtml(d.name)}</button>`).join('')}
        <button type="button" class="rt-day-add" id="rt-day-add">+ Día</button>
      </div>
      <div id="rt-day-panels">
        ${draft.days.map((d, i) => dayPanel(d, i, activeDayIndex, hasCopiedExercises)).join('')}
      </div>`;
  }

  function dayPanel(day, i, activeDayIndex, hasCopiedExercises) {
    return `
    <div class="rt-day-panel" data-i="${i}" style="display:${i === activeDayIndex ? '' : 'none'}">
      <div class="field-inline">
        <input type="text" class="rt-day-name" data-i="${i}" value="${Utils.escapeHtml(day.name)}">
        <button type="button" class="btn-icon-sm rt-day-remove" data-i="${i}" title="Eliminar día">🗑️</button>
      </div>
      <div class="rt-day-copy-actions">
        <button type="button" class="btn-sm btn-secondary rt-day-copy" data-i="${i}">📋 Copiar ejercicios</button>
        <button type="button" class="btn-sm btn-secondary rt-day-paste" data-i="${i}" ${hasCopiedExercises ? '' : 'disabled'}>📥 Pegar ejercicios</button>
      </div>
      <div class="rt-ex-list" data-i="${i}">
        ${day.exercises.map((ex, j) => exerciseBlock(ex, i, j)).join('') || `<p class="text-muted" style="font-size:var(--fs-sm)">Sin ejercicios en este día todavía.</p>`}
      </div>
      <button type="button" class="btn-sm btn-secondary rt-add-ex" data-i="${i}">+ Agregar ejercicio</button>
    </div>`;
  }

  function sideSelect(cls, dataAttrs, value) {
    return `<select class="${cls}" ${dataAttrs}>
      <option value="ambos" ${value === 'ambos' ? 'selected' : ''}>Ambos lados</option>
      <option value="izq" ${value === 'izq' ? 'selected' : ''}>Izquierdo</option>
      <option value="der" ${value === 'der' ? 'selected' : ''}>Derecho</option>
    </select>`;
  }

  function exerciseBlock(ex, dayI, exI) {
    const meta = Exercises.get(ex.exerciseId);
    const uni = !!meta?.unilateral;
    const bwEx = Exercises.isBodyweight(meta);
    const timed = !!meta?.measureByTime;
    const sets = normalizeTargetSets(ex);
    const unit = Utils.unitLabel();
    return `
    <div class="rt-ex-block" draggable="true" data-i="${dayI}" data-j="${exI}">
      <div class="rt-ex-block-top">
        <span class="drag-handle" title="Arrastra para reordenar">⠿⠿</span>
        <h4>${meta ? Utils.escapeHtml(meta.name) : '(ejercicio eliminado)'}${uni ? ' <span class="chip">🔁 Unilateral</span>' : ''}${bwEx ? ' <span class="chip">🧍 Peso corporal</span>' : ''}${timed ? ' <span class="chip">⏱️ Por tiempo</span>' : ''}</h4>
        <button type="button" class="btn-icon-sm rt-ex-remove" data-i="${dayI}" data-j="${exI}" title="Quitar ejercicio">🗑️</button>
      </div>
      <table class="table-compact">
        <thead><tr><th>Serie</th>${uni ? '<th class="col-side">Lado</th>' : ''}<th>${timed ? 'Tiempo obj. (seg)' : 'Reps obj.'}</th><th>${bwEx ? `Extra obj. (${unit})` : `Peso obj. (${unit})`}</th><th>RIR obj.</th><th></th></tr></thead>
        <tbody>
          ${sets.map((s, k) => `
            <tr data-i="${dayI}" data-j="${exI}" data-k="${k}">
              <td>${k + 1}</td>
              ${uni ? `<td class="col-side">${sideSelect('rt-set-side', `data-i="${dayI}" data-j="${exI}" data-k="${k}"`, sideOf(s))}</td>` : ''}
              <td><input type="${timed ? 'number' : 'text'}" min="${timed ? '0' : ''}" class="rt-set-input" data-f="${timed ? 'time' : 'reps'}" value="${Utils.escapeHtml(String(timed ? s.time ?? '' : s.reps ?? ''))}" placeholder="${timed ? '30' : '8-12'}"></td>
              <td><input type="number" min="0" step="0.5" class="rt-set-input" data-f="weight" ${bwEx ? 'placeholder="0 = solo peso corporal"' : ''} value="${Utils.toUnit(s.weight)}"></td>
              <td><input type="number" min="0" max="10" class="rt-set-input" data-f="rir" value="${s.rir ?? ''}"></td>
              <td><button type="button" class="btn-icon-sm rt-set-remove" data-i="${dayI}" data-j="${exI}" data-k="${k}" title="Eliminar serie">✕</button></td>
            </tr>`).join('') || `<tr><td colspan="${uni ? 6 : 5}" class="text-muted">Sin series</td></tr>`}
        </tbody>
      </table>
      <button type="button" class="btn-sm btn-secondary rt-set-add" data-i="${dayI}" data-j="${exI}">+ Serie</button>
    </div>`;
  }

  function wireBuilder(host, draft, paint, builderState) {
    host.querySelector('#rt-glossary').addEventListener('click', () => UI.openGlossary());
    host.querySelector('#rt-name').addEventListener('input', e => { draft.name = e.target.value; });
    host.querySelector('#rt-notes').addEventListener('input', e => { draft.notes = e.target.value; });

    host.querySelectorAll('.rt-day-tab').forEach(tab => tab.addEventListener('click', () => {
      host.querySelectorAll('.rt-day-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const i = tab.dataset.i;
      builderState.activeDayIndex = Number(i);
      host.querySelectorAll('.rt-day-panel').forEach(p => p.style.display = p.dataset.i === i ? '' : 'none');
    }));

    host.querySelector('#rt-day-add').addEventListener('click', () => {
      draft.days.push(newDay(`Día ${draft.days.length + 1}`));
      paint(draft.days.length - 1);
    });

    host.querySelectorAll('.rt-day-name').forEach(inp => inp.addEventListener('input', e => {
      draft.days[e.target.dataset.i].name = e.target.value;
      host.querySelectorAll('.rt-day-tab')[e.target.dataset.i].textContent = e.target.value || `Día ${Number(e.target.dataset.i) + 1}`;
    }));

    host.querySelectorAll('.rt-day-remove').forEach(btn => btn.addEventListener('click', () => {
      if (draft.days.length === 1) { Utils.toast('La rutina necesita al menos un día', 'danger'); return; }
      draft.days.splice(btn.dataset.i, 1);
      paint(Math.min(Number(btn.dataset.i), draft.days.length - 1));
    }));

    host.querySelectorAll('.rt-day-copy').forEach(btn => btn.addEventListener('click', () => {
      const day = draft.days[Number(btn.dataset.i)];
      if (!day.exercises.length) { Utils.toast('Agrega ejercicios a este día antes de copiarlos', 'danger'); return; }
      builderState.copiedExercises = JSON.parse(JSON.stringify(day.exercises));
      Utils.toast(`Ejercicios de "${day.name}" copiados. Selecciona otro día y pégalos.`, 'success');
      paint(Number(btn.dataset.i));
    }));

    host.querySelectorAll('.rt-day-paste').forEach(btn => btn.addEventListener('click', () => {
      const dayIndex = Number(btn.dataset.i);
      const pasteExercises = () => {
        draft.days[dayIndex].exercises = JSON.parse(JSON.stringify(builderState.copiedExercises));
        Utils.toast(`Ejercicios pegados en "${draft.days[dayIndex].name}"`, 'success');
        paint(dayIndex);
      };
      if (!builderState.copiedExercises) return;
      if (draft.days[dayIndex].exercises.length) {
        UI.confirm(`Se reemplazarán los ejercicios actuales de "${Utils.escapeHtml(draft.days[dayIndex].name)}". ¿Continuar?`, pasteExercises);
        return;
      }
      pasteExercises();
    }));

    host.querySelectorAll('.rt-add-ex').forEach(btn => btn.addEventListener('click', () => {
      const dayI = Number(btn.dataset.i);
      pickExerciseDialog(exId => {
        const timed = !!Exercises.get(exId)?.measureByTime;
        draft.days[dayI].exercises.push({
          exerciseId: exId,
          targetSets: Array.from({ length: 3 }, () => ({
            ...(timed ? { time: '' } : { reps: '8-12' }),
            weight: '', rir: '', side: 'ambos'
          }))
        });
        paint();
      });
    }));

    host.querySelectorAll('.rt-ex-remove').forEach(btn => btn.addEventListener('click', () => {
      draft.days[btn.dataset.i].exercises.splice(btn.dataset.j, 1);
      paint();
    }));

    host.querySelectorAll('.rt-set-add').forEach(btn => btn.addEventListener('click', () => {
      const ex = draft.days[btn.dataset.i].exercises[btn.dataset.j];
      if (!Array.isArray(ex.targetSets)) ex.targetSets = normalizeTargetSets(ex);
      const timed = !!Exercises.get(ex.exerciseId)?.measureByTime;
      ex.targetSets.push({ ...(timed ? { time: '' } : { reps: '8-12' }), weight: '', rir: '', side: 'ambos' });
      paint();
    }));

    host.querySelectorAll('.rt-set-remove').forEach(btn => btn.addEventListener('click', () => {
      const ex = draft.days[btn.dataset.i].exercises[btn.dataset.j];
      if (!Array.isArray(ex.targetSets)) ex.targetSets = normalizeTargetSets(ex);
      ex.targetSets.splice(btn.dataset.k, 1);
      paint();
    }));

    host.querySelectorAll('.rt-set-input').forEach(inp => inp.addEventListener('input', e => {
      const tr = e.target.closest('tr');
      const i = tr.dataset.i, j = tr.dataset.j, k = tr.dataset.k, f = e.target.dataset.f;
      const ex = draft.days[i].exercises[j];
      if (!Array.isArray(ex.targetSets)) ex.targetSets = normalizeTargetSets(ex);
      ex.targetSets[k][f] = f === 'weight'
        ? (e.target.value === '' ? '' : Utils.fromUnit(e.target.value))
        : e.target.value;
    }));

    host.querySelectorAll('.rt-set-side').forEach(sel => sel.addEventListener('change', e => {
      const i = e.target.dataset.i, j = e.target.dataset.j, k = e.target.dataset.k;
      const ex = draft.days[i].exercises[j];
      if (!Array.isArray(ex.targetSets)) ex.targetSets = normalizeTargetSets(ex);
      ex.targetSets[k].side = e.target.value;
    }));

    // Arrastrar y soltar para reordenar ejercicios dentro del mismo día
    let dragSrc = null;
    host.querySelectorAll('.rt-ex-block').forEach(block => {
      block.addEventListener('dragstart', () => {
        dragSrc = { i: Number(block.dataset.i), j: Number(block.dataset.j) };
        block.classList.add('dragging');
      });
      block.addEventListener('dragend', () => block.classList.remove('dragging'));
      block.addEventListener('dragover', e => { e.preventDefault(); block.classList.add('drag-over'); });
      block.addEventListener('dragleave', () => block.classList.remove('drag-over'));
      block.addEventListener('drop', e => {
        e.preventDefault();
        block.classList.remove('drag-over');
        if (!dragSrc) return;
        const destI = Number(block.dataset.i), destJ = Number(block.dataset.j);
        if (dragSrc.i !== destI || (dragSrc.i === destI && dragSrc.j === destJ)) { dragSrc = null; return; }
        const arr = draft.days[destI].exercises;
        const [moved] = arr.splice(dragSrc.j, 1);
        arr.splice(destJ, 0, moved);
        dragSrc = null;
        paint();
      });
    });
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

  function openLogger(routineId, onDone, initial = {}) {
    const routine = get(routineId);
    const client = State.getActiveClient();
    const host = document.createElement('div');
    let dayIndex = 0;
    if (initial.dayId) {
      const idx = routine.days.findIndex(d => d.id === initial.dayId);
      if (idx >= 0) dayIndex = idx;
    }
    let logDraft = null;

    const findExisting = (dayId, date) => Storage.all('workoutLogs')
      .find(l => l.clientId === client.id && l.routineId === routine.id && l.dayId === dayId && l.date === date);

    const buildDraft = (keepDate) => {
      const day = routine.days[dayIndex];
      const date = keepDate || Utils.todayISO();
      const existing = findExisting(day.id, date);
      if (existing) {
        logDraft = JSON.parse(JSON.stringify(existing));
        day.exercises.forEach(ex => {
          if (!logDraft.entries.find(e => e.exerciseId === ex.exerciseId)) {
            const exMeta = Exercises.get(ex.exerciseId);
            logDraft.entries.push({ exerciseId: ex.exerciseId, sets: normalizeTargetSets(ex).map(ts => newLogSet(ts, exMeta, client.id, date)) });
          }
        });
      } else {
        logDraft = {
          clientId: client.id, routineId: routine.id, dayId: day.id, date, minutes: '',
          entries: day.exercises.map(ex => ({
            exerciseId: ex.exerciseId,
            sets: normalizeTargetSets(ex).map(ts => newLogSet(ts, Exercises.get(ex.exerciseId), client.id, date))
          }))
        };
      }
    };

    const paint = () => {
      host.innerHTML = loggerMarkup(routine, dayIndex, logDraft);
      wireLogger(host, routine, logDraft, (i) => { dayIndex = i; buildDraft(); paint(); }, refreshSummary, () => { buildDraft(logDraft.date); paint(); });
      refreshSummary();
    };
    const refreshSummary = () => {
      const sum = host.querySelector('#log-summary');
      if (!sum) return;
      const allSets = logDraft.entries.flatMap(e => {
        const timed = !!Exercises.get(e.exerciseId)?.measureByTime;
        return e.sets.filter(s => timed ? Number(s.time) > 0 : s.weight !== '' && s.reps !== '');
      });
      const volumeSets = logDraft.entries.filter(e => !Exercises.get(e.exerciseId)?.measureByTime)
        .flatMap(e => e.sets).filter(s => s.weight !== '' && s.reps !== '');
      const vol = Utils.toUnit(Utils.totalVolume(volumeSets));
      const eff = Utils.effectiveSets(allSets);
      const editingNote = logDraft.id ? ' · ✏️ editando un registro ya guardado de este día' : '';
      const prs = countPRs(logDraft);
      const prNote = prs ? ` · 🏆 <strong>${prs}</strong> récord${prs === 1 ? '' : 's'}` : '';
      sum.innerHTML = `<strong>${vol} ${Utils.unitLabel()}</strong> volumen total · <strong>${eff}</strong> series efectivas · <strong>${allSets.length}</strong> series registradas${prNote}${editingNote}`;
    };

    buildDraft(initial.date);

    UI.openModal({
      title: `Registrar: ${routine.name}`,
      bodyEl: host,
      wide: true,
      confirmLabel: 'Guardar entrenamiento',
      onConfirm: () => {
        const cleaned = { ...logDraft, entries: logDraft.entries.map(e => {
          const ex = Exercises.get(e.exerciseId);
          return { ...e, sets: e.sets.filter(s => ex?.measureByTime
            ? Number(s.time) > 0
            : s.weight !== '' && s.reps !== '')
            .map(s => {
              const out = { ...s, unilateral: !!(ex && ex.unilateral && sideOf(s) === 'ambos') };
              // Series nuevas de peso corporal: extra numérico y carga total = cuerpo + extra.
              // (Las anteriores a esta función no tienen extra ni bw y se dejan tal cual.)
              if (Exercises.isBodyweight(ex) && (s.extra !== undefined || s.bw !== undefined)) {
                out.extra = Number(s.extra) || 0;
                out.weight = totalLoad(s.bw, out.extra);
              }
              return out;
            }) };
        }).filter(e => e.sets.length) };
        if (!cleaned.entries.length) { Utils.toast('Registra al menos una serie', 'danger'); return false; }
        if (logDraft.id) {
          Storage.update('workoutLogs', logDraft.id, cleaned);
          Utils.toast('Entrenamiento actualizado', 'success');
        } else {
          Storage.insert('workoutLogs', cleaned);
          Utils.toast('Entrenamiento registrado', 'success');
        }
        onDone && onDone();
      },
      onOpen: paint
    });
  }

  // Última vez, en texto: por lado si el ejercicio es unilateral (los lados no se promedian:
  // un desbalance de fuerza entre lados es información útil, no ruido a esconder).
  function lastTimeText(prior, uni, unit, bwEx, timed = false) {
    if (timed) {
      const best = prior.sets.reduce((a, s) => Number(s.time) > Number(a.time) ? s : a);
      return `Última vez (${Utils.formatDate(prior.date, { withYear: false })}): mejor serie <strong>${best.time} s</strong>`;
    }
    if (!uni) {
      const best = prior.sets.reduce((b, s) => Utils.estimate1RM(s.weight, s.reps) > Utils.estimate1RM(b.weight, b.reps) ? s : b);
      return `Última vez (${Utils.formatDate(prior.date, { withYear: false })}): mejor serie <strong>${loadText(best, bwEx, unit)} × ${best.reps}</strong>`;
    }
    const bySide = {};
    prior.sets.forEach(s => {
      const sd = sideOf(s);
      if (!bySide[sd] || Utils.estimate1RM(s.weight, s.reps) > Utils.estimate1RM(bySide[sd].weight, bySide[sd].reps)) bySide[sd] = s;
    });
    const labels = { izq: 'Izq', der: 'Der', ambos: 'Ambos' };
    const parts = ['izq', 'der', 'ambos'].filter(k => bySide[k])
      .map(k => `${labels[k]}: <strong>${loadText(bySide[k], bwEx, unit)} × ${bySide[k].reps}</strong>`);
    return `Última vez (${Utils.formatDate(prior.date, { withYear: false })}): ${parts.join(' · ')}`;
  }

  function loggerMarkup(routine, dayIndex, draft) {
    const unit = Utils.unitLabel();
    return `
      <div class="rt-days-tabs">
        ${routine.days.map((d, i) => `<button type="button" class="rt-day-tab ${i === dayIndex ? 'active' : ''}" data-i="${i}">${Utils.escapeHtml(d.name)}</button>`).join('')}
      </div>
      <div class="field-inline" style="margin:var(--space-2) 0; justify-content:space-between;">
        <div class="field-inline">
          <label class="field"><span>Fecha</span><input type="date" id="log-date" value="${draft.date}"></label>
          <label class="field"><span>Duración (min)</span><input type="number" id="log-minutes" value="${draft.minutes}" min="0"></label>
        </div>
        <div class="field-inline">
          <button type="button" class="btn-sm btn-secondary" id="log-rir-guide">📏 Guía RIR/RPE</button>
          <button type="button" class="btn-sm btn-secondary" id="log-glossary">❓ Glosario</button>
        </div>
      </div>
      <div id="log-summary" class="log-summary"></div>
      ${draft.entries.map((entry, i) => {
        const meta = Exercises.get(entry.exerciseId);
        const uni = !!meta?.unilateral;
        const bwEx = Exercises.isBodyweight(meta);
        const timed = !!meta?.measureByTime;
        const bwKg = bwEx ? bodyWeightKg(draft.clientId, draft.date) : 0;
        const tracks = !timed && meta?.trackPR !== false;
        const showPrior = tracks || timed;
        const prior = showPrior ? priorSession(draft.clientId, entry.exerciseId, draft.date, draft.id) : null;
        const prIdx = tracks ? prIndexesForEntry(entry, meta, draft.clientId, draft.date, draft.id) : new Set();
        const routineEx = routine.days[dayIndex].exercises.find(x => x.exerciseId === entry.exerciseId);
        const hint = (tracks && !uni && !bwEx) ? overloadHint(prior, routineEx) : null;   // el aviso de sobrecarga no distingue lado todavía
        const cols = 6 + (uni ? 1 : 0) + (showPrior ? 1 : 0) + (tracks ? 1 : 0);
        return `
        <div class="log-exercise">
          <div class="log-ex-head">
            <h4>${meta ? Utils.escapeHtml(meta.name) : 'Ejercicio'}${uni ? ' <span class="chip">🔁 Unilateral</span>' : ''}${bwEx ? ' <span class="chip">🧍 Peso corporal</span>' : ''}${timed ? ' <span class="chip">⏱️ Por tiempo</span>' : ''}</h4>
            ${prior ? `<button type="button" class="btn-sm btn-secondary log-copy-prev" data-i="${i}">↺ Copiar última sesión</button>` : ''}
          </div>
          ${bwEx ? `<p class="log-prev-info">${timed
            ? 'Puedes anotar un lastre opcional; el resultado principal de este ejercicio se registra por tiempo.'
            : bwKg
            ? `Peso corporal: <strong>${Utils.toUnit(bwKg)} ${unit}</strong> + el extra que anotes (déjalo vacío si no agregas peso). El volumen y el 1RM usan el peso total.`
            : 'Registra el peso corporal del cliente en Progreso para que el volumen y el 1RM lo incluyan; mientras tanto solo cuenta el extra.'}</p>` : ''}
          ${showPrior ? `<p class="log-prev-info">${prior ? lastTimeText(prior, uni, unit, bwEx, timed) : 'Sin sesiones anteriores registradas de este ejercicio.'}</p>` : ''}
          ${hint ? `<p class="log-suggest">💡 Completaste ${hint.top}+ reps en todas las series con ${hint.from} ${unit}. Prueba con ${hint.to} ${unit}.</p>` : ''}
          <table class="table-compact">
            <thead><tr>
              <th>Serie</th>${uni ? '<th>Lado</th>' : ''}${showPrior ? '<th>Anterior</th>' : ''}
              <th>${bwEx ? `Extra (${unit})` : `Peso (${unit})`}</th><th>${timed ? 'Tiempo (seg)' : 'Reps'}</th><th>RIR</th><th>RPE</th>${tracks ? '<th>1RM est.</th>' : ''}<th></th>
            </tr></thead>
            <tbody>
              ${entry.sets.map((s, j) => {
                const prev = prior && prior.sets[j];
                const prevTag = prev && uni ? { izq: 'Izq ', der: 'Der ', ambos: '' }[sideOf(prev)] : '';
                const prevMetric = prev ? timed ? `${prev.time} s` : `${loadText(prev, bwEx, unit)} × ${prev.reps}` : '—';
                return `
                <tr data-i="${i}" data-j="${j}">
                  <td>${j + 1}</td>
                  ${uni ? `<td>${sideSelect('log-set-side', `data-i="${i}" data-j="${j}"`, sideOf(s))}</td>` : ''}
                  ${showPrior ? `<td class="prev-cell">${prev ? `${prevTag}${prevMetric}` : '—'}</td>` : ''}
                  <td>${bwEx
                    ? `<input type="number" min="0" step="0.5" class="rt-input" data-f="extra" placeholder="0" value="${Utils.toUnit(s.extra ?? s.weight)}">`
                    : `<input type="number" min="0" step="0.5" class="rt-input" data-f="weight" value="${Utils.toUnit(s.weight)}">`}</td>
                  <td><input type="number" min="0" class="rt-input" data-f="${timed ? 'time' : 'reps'}" value="${timed ? s.time ?? '' : s.reps}"></td>
                  <td><input type="number" min="0" max="10" class="rt-input" data-f="rir" value="${s.rir}"></td>
                  <td><input type="number" min="1" max="10" class="rt-input" data-f="rpe" value="${s.rpe}"></td>
                  ${tracks ? `<td class="rm-cell">${rmCellHtml(s, prIdx.has(j))}</td>` : ''}
                  <td><button type="button" class="btn-icon-sm log-set-remove" data-i="${i}" data-j="${j}" title="Eliminar serie">✕</button></td>
                </tr>`;
              }).join('') || `<tr><td colspan="${cols}" class="text-muted">Sin series — agrega una abajo</td></tr>`}
            </tbody>
          </table>
          <button type="button" class="btn-sm btn-secondary log-add-set" data-i="${i}">+ Serie</button>
        </div>`;
      }).join('')}`;
  }

  function wireLogger(host, routine, draft, onDayChange, refreshSummary, onDateChange) {
    host.querySelectorAll('.rt-day-tab').forEach(tab => tab.addEventListener('click', () => {
      onDayChange(Number(tab.dataset.i));
    }));
    host.querySelector('#log-date').addEventListener('change', e => {
      draft.date = e.target.value || Utils.todayISO();
      onDateChange && onDateChange();
    });
    host.querySelector('#log-minutes').addEventListener('input', e => draft.minutes = Number(e.target.value) || '');
    host.querySelector('#log-rir-guide').addEventListener('click', openRirRpeGuide);
    host.querySelector('#log-glossary').addEventListener('click', () => UI.openGlossary());

    const repaint = () => {
      const activeIdx = [...host.querySelectorAll('.rt-day-tab')].findIndex(t => t.classList.contains('active'));
      host.innerHTML = loggerMarkup(routine, activeIdx, draft);
      wireLogger(host, routine, draft, onDayChange, refreshSummary, onDateChange);
      refreshSummary();
    };

    host.querySelectorAll('.log-add-set').forEach(btn => btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i);
      const ex = Exercises.get(draft.entries[i].exerciseId);
      const lastSide = draft.entries[i].sets.length ? sideOf(draft.entries[i].sets[draft.entries[i].sets.length - 1]) : 'ambos';
      // Para unilaterales, alternar de lado en la nueva serie es lo más común (izq, der, izq, der...)
      const nextSide = (ex?.unilateral && lastSide !== 'ambos') ? (lastSide === 'izq' ? 'der' : 'izq') : 'ambos';
      draft.entries[i].sets.push(newLogSet({ weight: '', side: nextSide }, ex, draft.clientId, draft.date));
      repaint();
    }));

    host.querySelectorAll('.log-set-remove').forEach(btn => btn.addEventListener('click', () => {
      draft.entries[btn.dataset.i].sets.splice(btn.dataset.j, 1);
      repaint();
    }));

    host.querySelectorAll('.rt-input').forEach(inp => inp.addEventListener('input', e => {
      const tr = e.target.closest('tr');
      const i = Number(tr.dataset.i), j = tr.dataset.j, f = e.target.dataset.f;
      const st = draft.entries[i].sets[j];
      const val = e.target.value === '' ? '' : ((f === 'weight' || f === 'extra') ? Utils.fromUnit(e.target.value) : Number(e.target.value));
      if (f === 'extra') setExtra(st, val); else st[f] = val;
      refreshRmCells(host, draft, i);
      refreshSummary();
    }));

    // El lado cambia a qué récord se compara cada serie, así que repinta completo
    host.querySelectorAll('.log-set-side').forEach(sel => sel.addEventListener('change', e => {
      const i = Number(e.target.dataset.i), j = Number(e.target.dataset.j);
      draft.entries[i].sets[j].side = e.target.value;
      repaint();
    }));

    // Rellena el objetivo medido y el peso con lo que hizo en la última sesión
    host.querySelectorAll('.log-copy-prev').forEach(btn => btn.addEventListener('click', () => {
      const entry = draft.entries[btn.dataset.i];
      const prior = priorSession(draft.clientId, entry.exerciseId, draft.date, draft.id);
      if (!prior) return;
      prior.sets.forEach((ps, j) => {
        const exMeta = Exercises.get(entry.exerciseId);
        const bwEx = Exercises.isBodyweight(exMeta);
        const timed = !!exMeta?.measureByTime;
        if (!entry.sets[j]) entry.sets[j] = newLogSet({ weight: '', side: sideOf(ps) }, exMeta, draft.clientId, draft.date);
        const cur = entry.sets[j];
        if (timed ? cur.time == null || cur.time === '' : cur.reps === '') {
          if (timed) cur.time = ps.time;
          else cur.reps = ps.reps;
          if (bwEx) { if (cur.extra === '' || cur.extra == null) setExtra(cur, Number(ps.extra ?? ps.weight) || 0); }
          else if (cur.weight === '') cur.weight = ps.weight;
          if (!cur.side || cur.side === 'ambos') cur.side = sideOf(ps);
        }
      });
      repaint();
    }));
  }

  /* ---------------- Historial de entrenamientos pasados ---------------- */

  function openHistory(routineId, onDone) {
    const routine = get(routineId);
    const client = State.getActiveClient();
    const host = document.createElement('div');

    const paint = () => {
      const logs = Storage.all('workoutLogs')
        .filter(l => l.clientId === client.id && l.routineId === routineId)
        .sort((a, b) => b.date.localeCompare(a.date));
      host.innerHTML = historyMarkup(routine, logs);
      wireHistory(host, routine, logs, paint, onDone);
    };

    UI.openModal({
      title: `📜 Historial: ${routine.name}`,
      bodyEl: host,
      wide: true,
      hideFooter: true,
      onOpen: paint
    });
  }

  function historyMarkup(routine, logs) {
    if (!logs.length) {
      return `<div class="empty-state"><span class="empty-icon">📜</span><h3>Sin entrenamientos registrados</h3><p>Aún no hay sesiones guardadas para esta rutina.</p></div>`;
    }
    return `<div class="history-list">${logs.map(l => sessionCard(routine, l)).join('')}</div>`;
  }

  function sessionCard(routine, log) {
    const day = routine.days.find(d => d.id === log.dayId);
    const allSets = log.entries.flatMap(e => e.sets);
    const volumeSets = log.entries.filter(e => !Exercises.get(e.exerciseId)?.measureByTime)
      .flatMap(e => e.sets);
    const vol = Utils.toUnit(Utils.totalVolume(volumeSets));
    const timedSeconds = log.entries.reduce((sum, e) => sum + (Exercises.get(e.exerciseId)?.measureByTime
      ? e.sets.reduce((total, set) => total + (Number(set.time) || 0), 0)
      : 0), 0);
    const eff = Utils.effectiveSets(allSets);
    const unit = Utils.unitLabel();
    return `
    <div class="history-session" data-id="${log.id}">
      <div class="history-session-top">
        <div class="history-session-date">
          <strong>${Utils.formatDate(log.date)}</strong>
          <span class="chip">${day ? Utils.escapeHtml(day.name) : 'Día eliminado'}</span>
        </div>
        <div class="text-muted history-session-stats">${vol} ${unit} vol. · ${eff} series efectivas${timedSeconds ? ` · ${timedSeconds} s por tiempo` : ''}${log.minutes ? ' · ' + log.minutes + ' min' : ''}</div>
        <div class="history-session-actions">
          <button type="button" class="btn-icon-sm hs-toggle" title="Ver detalle">👁️</button>
          <button type="button" class="btn-icon-sm hs-edit" title="Editar">✏️</button>
          <button type="button" class="btn-icon-sm hs-delete" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="history-session-detail" style="display:none;">
        ${log.entries.map(e => {
          const meta = Exercises.get(e.exerciseId);
          const uni = !!meta?.unilateral;
          const bwEx = Exercises.isBodyweight(meta);
          const timed = !!meta?.measureByTime;
          const sideLabel = { izq: 'Izquierdo', der: 'Derecho', ambos: 'Ambos' };
          return `
          <div class="history-ex">
            <strong>${meta ? Utils.escapeHtml(meta.name) : '(ejercicio eliminado)'}${uni ? ' <span class="chip">🔁 Unilateral</span>' : ''}</strong>
            <table class="table-compact">
              <thead><tr><th>Serie</th>${uni ? '<th>Lado</th>' : ''}<th>${bwEx ? `Extra (${unit})` : `Peso (${unit})`}</th><th>${timed ? 'Tiempo (seg)' : 'Reps'}</th><th>RIR</th><th>RPE</th>${timed ? '' : '<th>1RM est.</th>'}</tr></thead>
              <tbody>
                ${e.sets.map((s, i) => `<tr>
                  <td>${i + 1}</td>
                  ${uni ? `<td>${sideLabel[sideOf(s)]}</td>` : ''}
                  <td>${bwEx ? (Number(s.extra ?? s.weight) ? Utils.toUnit(s.extra ?? s.weight) : 'PC') : Utils.toUnit(s.weight)}</td><td>${timed ? `${s.time ?? ''} s` : s.reps}</td>
                  <td>${s.rir === '' || s.rir == null ? '—' : s.rir}</td>
                  <td>${s.rpe === '' || s.rpe == null ? '—' : s.rpe}</td>
                  ${timed ? '' : `<td>${s.weight && s.reps ? Utils.toUnit(Utils.estimate1RM(s.weight, s.reps)) + ' ' + unit : '—'}</td>`}
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function wireHistory(host, routine, logs, paint, onDone) {
    host.querySelectorAll('.history-session').forEach(card => {
      const id = card.dataset.id;
      const log = logs.find(l => l.id === id);
      card.querySelector('.hs-toggle').addEventListener('click', () => {
        const detail = card.querySelector('.history-session-detail');
        detail.style.display = detail.style.display === 'none' ? '' : 'none';
      });
      card.querySelector('.hs-edit').addEventListener('click', () => {
        UI.closeModal();
        openLogger(routine.id, () => openHistory(routine.id, onDone), { dayId: log.dayId, date: log.date });
      });
      card.querySelector('.hs-delete').addEventListener('click', () => {
        UI.confirm('¿Eliminar esta sesión de entrenamiento? No se puede deshacer.', () => {
          Storage.remove('workoutLogs', id);
          Utils.toast('Sesión eliminada', 'info');
          paint();
        });
      });
    });
  }

  return { all, get, logsOf, normalizeTargetSets, renderPage, openBuilder, openLogger, openHistory,
           priorSession, bestBefore, prSetIndex, overloadHint, sideOf, bestSetEver };
})();
