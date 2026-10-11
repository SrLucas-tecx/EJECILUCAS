/* ==========================================================================
   TEMPLATES — plantillas de rutina según los días disponibles
   Una plantilla es una "receta": por cada día lista huecos (músculo + tipo de
   ejercicio + series). build() completa cada hueco con ejercicios de tu
   biblioteca según el equipo disponible y la prioridad elegida, y el resultado
   se abre en el constructor de rutinas para editarlo antes de guardar.
   ========================================================================== */

const Templates = (() => {

  /* ---------------- Reglas de hipertrofia ---------------- */

  const REPS = { compuesto: '6-10', aislamiento: '10-15', aislamientoAmplio: '12-20' };
  // Músculos que toleran bien rangos altos de repeticiones (deltoide lateral y pantorrillas)
  const WIDE_RANGE = ['hombro-lateral', 'pantorrillas'];


  /* ---------------- Plantillas ---------------- */

  const C = (muscle, sets) => ({ muscle, mech: 'compuesto', sets });
  const A = (muscle, sets) => ({ muscle, mech: 'aislamiento', sets });

  const TEMPLATES = [
    {
      id: 'fb2', name: 'Full Body A/B', short: 'Cuerpo completo',
      description: 'Dos sesiones de cuerpo completo. Es la opción de tiempo mínimo: cada músculo se trabaja 2 veces por semana, con volumen cercano al mínimo efectivo.',
      days: [
        { name: 'Cuerpo completo A', slots: [C('cuadriceps', 4), C('pecho', 3), C('espalda', 3), A('isquiotibiales', 3), A('hombro-lateral', 3), A('biceps', 2), A('triceps', 2), A('abdomen', 3)] },
        { name: 'Cuerpo completo B', slots: [C('isquiotibiales', 4), C('gluteos', 3), C('pecho', 3), C('espalda', 3), A('cuadriceps', 3), A('hombro-lateral', 3), A('biceps', 2), A('triceps', 2), A('pantorrillas', 3)] }
      ]
    },
    {
      id: 'fb3', name: 'Full Body A/B/C', short: 'Cuerpo completo',
      description: 'Tres sesiones de cuerpo completo con días no consecutivos. Cada músculo se trabaja 3 veces por semana: muy buena frecuencia con pocas sesiones.',
      days: [
        { name: 'Cuerpo completo A', slots: [C('cuadriceps', 4), C('pecho', 4), C('espalda', 4), A('hombro-lateral', 3), A('biceps', 3), A('triceps', 3)] },
        { name: 'Cuerpo completo B', slots: [C('isquiotibiales', 4), C('gluteos', 3), C('hombro-frontal', 3), C('espalda', 4), A('pecho', 3), A('abdomen', 3), A('pantorrillas', 3)] },
        { name: 'Cuerpo completo C', slots: [C('cuadriceps', 4), C('pecho', 4), C('espalda', 4), A('isquiotibiales', 3), A('hombro-lateral', 3), A('biceps', 3), A('triceps', 3), A('pantorrillas', 3)] }
      ]
    },
    {
      id: 'ppl3', name: 'Empuje / Jalón / Pierna (1 vuelta)', short: 'Push/Pull/Legs',
      description: 'Push/Pull/Legs una sola vez por semana. Cada músculo se trabaja 1 vez, así que cada sesión concentra más series. Si puedes entrenar 6 días, usa la versión de 2 vueltas.',
      days: [
        { name: 'Empuje', slots: [C('pecho', 4), C('hombro-frontal', 3), A('pecho', 3), A('hombro-lateral', 4), A('triceps', 3), A('triceps', 3)] },
        { name: 'Jalón', slots: [C('espalda', 4), C('espalda', 4), A('hombro-posterior', 3), A('biceps', 3), A('biceps', 3)] },
        { name: 'Pierna', slots: [C('cuadriceps', 4), C('isquiotibiales', 4), C('gluteos', 3), A('cuadriceps', 3), A('isquiotibiales', 3), A('pantorrillas', 4), A('abdomen', 3)] }
      ]
    },
    {
      id: 'ul4', name: 'Torso / Pierna', short: 'Torso/Pierna',
      description: 'Dos días de torso y dos de pierna, alternados. Cada músculo se trabaja 2 veces por semana con descanso entre sesiones: el equilibrio clásico entre frecuencia y recuperación.',
      days: [
        { name: 'Torso A', slots: [C('pecho', 4), C('espalda', 4), C('hombro-frontal', 4), A('hombro-lateral', 4), A('hombro-posterior', 3), A('biceps', 4), A('triceps', 4)] },
        { name: 'Pierna A', slots: [C('cuadriceps', 4), C('isquiotibiales', 4), C('gluteos', 3), A('pantorrillas', 4), A('abdomen', 4)] },
        { name: 'Torso B', slots: [C('espalda', 4), C('pecho', 4), A('pecho', 4), A('espalda', 4), A('hombro-lateral', 4), A('hombro-posterior', 3), A('biceps', 4), A('triceps', 4)] },
        { name: 'Pierna B', slots: [C('cuadriceps', 4), C('gluteos', 3), A('isquiotibiales', 5), A('cuadriceps', 4), A('pantorrillas', 4), A('abdomen', 4)] }
      ]
    },
    {
      id: 'ulppl5', name: 'Torso / Pierna + Empuje / Jalón / Pierna', short: 'Híbrido',
      description: 'Combina Torso/Pierna con Push/Pull/Legs: pecho y espalda 2 veces por semana, con una sesión extra de pierna. Buena opción con 5 días.',
      days: [
        { name: 'Torso', slots: [C('pecho', 4), C('espalda', 4), C('hombro-frontal', 4), A('hombro-lateral', 4), A('biceps', 4), A('triceps', 4)] },
        { name: 'Pierna', slots: [C('cuadriceps', 4), C('isquiotibiales', 5), C('gluteos', 3), A('pantorrillas', 4), A('abdomen', 4)] },
        { name: 'Empuje', slots: [C('pecho', 4), A('pecho', 4), A('hombro-lateral', 4), A('hombro-posterior', 3), A('triceps', 4)] },
        { name: 'Jalón', slots: [C('espalda', 4), A('espalda', 4), A('hombro-posterior', 3), A('biceps', 4)] },
        { name: 'Pierna ligera', slots: [C('cuadriceps', 4), A('isquiotibiales', 6), A('gluteos', 3), A('cuadriceps', 4), A('pantorrillas', 4), A('abdomen', 4)] }
      ]
    },
    {
      id: 'ppl6', name: 'Empuje / Jalón / Pierna (2 vueltas)', short: 'Push/Pull/Legs',
      description: 'Push/Pull/Legs dos veces por semana. Cada músculo se trabaja 2 veces: el mayor volumen y frecuencia, para quien puede entrenar 6 días y recuperarse bien.',
      days: [
        { name: 'Empuje A', slots: [C('pecho', 4), C('hombro-frontal', 3), A('pecho', 3), A('hombro-lateral', 4), A('triceps', 4)] },
        { name: 'Jalón A', slots: [C('espalda', 4), C('espalda', 3), A('hombro-posterior', 3), A('biceps', 3), A('abdomen', 3)] },
        { name: 'Pierna A', slots: [C('cuadriceps', 4), C('isquiotibiales', 3), C('gluteos', 3), A('cuadriceps', 4), A('pantorrillas', 4), A('abdomen', 3)] },
        { name: 'Empuje B', slots: [C('pecho', 4), C('hombro-frontal', 3), A('pecho', 3), A('hombro-lateral', 4), A('triceps', 4)] },
        { name: 'Jalón B', slots: [C('espalda', 4), A('espalda', 3), A('hombro-posterior', 3), A('biceps', 3), A('biceps', 3), A('abdomen', 3)] },
        { name: 'Pierna B', slots: [C('isquiotibiales', 4), C('cuadriceps', 4), C('gluteos', 3), A('isquiotibiales', 3), A('pantorrillas', 4)] }
      ]
    }
  ];

  const DAY_OPTIONS = [2, 3, 4, 5, 6];
  const forDays = n => TEMPLATES.filter(t => t.days.length === n);

  /* ---------------- Equipo y prioridad de ejercicios ---------------- */

  const EQUIPMENT_PROFILES = {
    gym:        { label: 'Gimnasio', hint: 'Gimnasio completo: barras, máquinas, poleas y mancuernas.', allowed: null },
    mancuernas: { label: 'Mancuernas', hint: 'Mancuernas y banco, además de peso corporal y bandas.', allowed: ['Peso corporal', 'Mancuernas', 'Disco o mancuerna', 'Kettlebell', 'Bandas'] },
    casa:       { label: 'En casa', hint: 'Solo peso corporal y bandas elásticas.', allowed: ['Peso corporal', 'Bandas'] }
  };

  const PRIORITIES = {
    principiante: {
      label: 'Principiante primero',
      hint: 'Empieza por los ejercicios más fáciles de aprender y de ejecutar bien (máquinas, mancuernas, peso corporal).'
    },
    tension: {
      label: 'Poleas y máquinas primero',
      hint: 'Prioriza la tensión constante en todo el recorrido; después van mancuernas y barra.'
    }
  };

  const DIFF = { principiante: 0, intermedio: 1, avanzado: 2 };
  const EQ_ORDER = ['Máquina', 'Mancuernas', 'Polea', 'Barra', 'Kettlebell', 'Disco o mancuerna', 'Peso corporal', 'Bandas'];

  // Menor puntaje = se elige antes
  function rankOf(ex, priority) {
    const diff = DIFF[ex.difficulty] ?? 1;
    const eq = EQ_ORDER.indexOf(ex.equipment);
    const eqIdx = eq < 0 ? EQ_ORDER.length : eq;
    if (priority === 'tension') return [['Polea', 'Máquina'].includes(ex.equipment) ? 0 : 1, diff, eqIdx];
    return [diff, eqIdx, 0];
  }

  function compare(a, b, priority) {
    const ra = rankOf(a, priority), rb = rankOf(b, priority);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return a.name.localeCompare(b.name, 'es');
  }

  /* ---------------- Generador ---------------- */

  function pick(slot, pool, allowed, priority, uses) {
    // Se omiten los ejercicios por tiempo y las planchas (son isométricos: no se miden en repeticiones)
    const isometric = ex => /^plancha/i.test(ex.name.trim());
    const fits = ex => ex.muscles.includes(slot.muscle) && !ex.measureByTime && !isometric(ex) && (!allowed || allowed.includes(ex.equipment));
    let cands = pool.filter(ex => fits(ex) && Exercises.mechanicOf(ex) === slot.mech);
    if (!cands.length) cands = pool.filter(fits);          // sin ese tipo con este equipo: se acepta el otro
    if (!cands.length) return null;
    cands.sort((a, b) => compare(a, b, priority));
    // Variedad: se prefiere el ejercicio menos usado en lo que va de la rutina (así Empuje A y B no repiten)
    let best = cands[0], bestUses = uses.get(best.id) || 0;
    cands.forEach(ex => { const u = uses.get(ex.id) || 0; if (u < bestUses) { best = ex; bestUses = u; } });
    return best;
  }

  // Series objetivo de un ejercicio: reps por tipo y reserva (RIR) 0-3.
  // Compuestos: reserva 2 y la última serie con 1. Aislamiento: reserva 1 y las últimas series al fallo (0).
  function makeSets(slot, ex) {
    const mech = Exercises.mechanicOf(ex);
    const n = slot.sets;
    const reps = mech === 'compuesto' ? REPS.compuesto : (WIDE_RANGE.includes(slot.muscle) ? REPS.aislamientoAmplio : REPS.aislamiento);
    return Array.from({ length: n }, (_, i) => {
      let rir;
      if (mech === 'compuesto') rir = i === n - 1 ? 1 : 2;
      else rir = i >= (n >= 3 ? n - 2 : n - 1) ? 0 : 1;
      return { reps, weight: '', rir, side: 'ambos' };
    });
  }

  function build(tpl, opts) {
    const { equipment = 'gym', priority = 'principiante' } = opts || {};
    const allowed = (EQUIPMENT_PROFILES[equipment] || EQUIPMENT_PROFILES.gym).allowed;
    const pool = Exercises.all();
    const uses = new Map();
    const missing = [];
    const volume = {};
    let totalSets = 0, failureSets = 0;

    const days = tpl.days.map(day => {
      const exercises = [];
      day.slots.forEach(slot => {
        const ex = pick(slot, pool, allowed, priority, uses);
        if (!ex) {
          const label = `${MuscleMap.muscleLabel(slot.muscle)} (${slot.mech})`;
          if (!missing.includes(label)) missing.push(label);
          return;
        }
        uses.set(ex.id, (uses.get(ex.id) || 0) + 1);
        const targetSets = makeSets(slot, ex);
        volume[slot.muscle] = (volume[slot.muscle] || 0) + targetSets.length;
        totalSets += targetSets.length;
        failureSets += targetSets.filter(s => s.rir === 0).length;
        exercises.push({ exercise: ex, muscle: slot.muscle, targetSets });
      });
      return { name: day.name, exercises, sets: exercises.reduce((n, e) => n + e.targetSets.length, 0) };
    });

    return { template: tpl, days, missing, volume, totalSets, failureSets,
             failurePct: totalSets ? Math.round(failureSets / totalSets * 100) : 0 };
  }

  function planToDraft(plan, clientId, name) {
    return {
      clientId,
      name,
      notes: `Plantilla: ${plan.template.name}. Compuestos de 6 a 10 repeticiones con 1 a 3 en reserva; aislamiento de 10 a 15 (hasta 20 en hombro lateral y pantorrillas), con las últimas series al fallo. Descanso: 2 a 3 min en compuestos y 60 a 90 s en aislamiento.`,
      days: plan.days.filter(d => d.exercises.length).map(d => ({
        id: Utils.uid('day'),
        name: d.name,
        exercises: d.exercises.map(e => ({ exerciseId: e.exercise.id, targetSets: e.targetSets }))
      }))
    };
  }

  /* ---------------- Asistente ---------------- */

  const esc = Utils.escapeHtml;

  function rirText(sets) {
    const first = sets[0].rir, last = sets[sets.length - 1].rir;
    return first === last ? `${first}` : `${first}→${last}`;
  }

  function volumeChips(plan) {
    const client = State.getActiveClient();
    const days = plan.days.map(d => ({ name: d.name, exercises: d.exercises.map(e => ({ exerciseId: e.exercise.id, targetSets: e.targetSets })) }));
    const a = Volume.analyze(days, client && client.id);
    const cls = { ok: 'is-ok', warn: 'is-low', danger: 'is-high', neutral: '' };
    return a.rows.map(r =>
      `<span class="chip tpl-vol-chip ${cls[r.level]}" title="${esc(`${r.direct} directas + ${r.indirect} indirectas = ${r.total} efectivas. ${r.hint}`)}">${esc(MuscleMap.muscleLabel(r.id))} · ${r.direct}</span>`).join('');
  }

  function previewMarkup(plan) {
    const days = plan.days.map(d => `
      <div class="tpl-day">
        <div class="tpl-day-head"><h4>${esc(d.name)}</h4><span class="badge">${d.exercises.length} ejercicios · ${d.sets} series</span></div>
        ${d.exercises.map(e => `
          <div class="tpl-ex">
            <strong>${esc(e.exercise.name)}</strong>
            <span>${e.targetSets.length} × ${esc(e.targetSets[0].reps)} reps · reserva ${rirText(e.targetSets)} · ${esc(e.exercise.equipment || '')}</span>
          </div>`).join('') || '<p class="text-muted" style="font-size:var(--fs-sm)">Sin ejercicios disponibles para este día con el equipo elegido.</p>'}
      </div>`).join('');

    return `
      ${plan.missing.length ? `<div class="dep-warning">No hay ejercicios con este equipo para: ${esc(plan.missing.join(', '))}. Puedes agregar uno propio desde la biblioteca o cambiar el equipo.</div>` : ''}
      <h4>${Help.term('seriesdirectas', 'Series directas por semana')}</h4>
      <div class="tpl-vol">${volumeChips(plan)}</div>
      <p class="text-muted" style="font-size:var(--fs-xs); margin:var(--space-2) 0 var(--space-3);">
        Verde: en rango. Ámbar: conviene revisar (pocas series directas, bajo el mínimo o cerca del máximo). Rojo: supera el máximo recuperable.
        El número es de series directas; el panel de volumen del constructor suma además las indirectas.
        Series al fallo (reserva 0): ${plan.failurePct}% del total.</p>
      ${days}`;
  }

  function choice(group, value, label, hint, active) {
    return `<button type="button" class="tpl-choice ${active ? 'active' : ''}" data-group="${group}" data-v="${esc(value)}" aria-pressed="${active}">
      <strong>${esc(label)}</strong><small>${esc(hint)}</small></button>`;
  }

  function openWizard(onDone) {
    const client = State.getActiveClient();
    if (!client) { Utils.toast('Elige o crea un cliente primero', 'danger'); return; }

    const st = { days: 4, templateId: null, equipment: 'gym', priority: 'principiante', name: '', nameTouched: false };
    const host = document.createElement('div');
    let plan = null;

    const paint = () => {
      const list = forDays(st.days);
      if (!list.some(t => t.id === st.templateId)) st.templateId = list[0].id;
      const tpl = list.find(t => t.id === st.templateId);
      if (!st.nameTouched) st.name = `${tpl.name} - ${client.name}`;
      plan = build(tpl, { equipment: st.equipment, priority: st.priority });

      host.innerHTML = `
        <p class="text-muted" style="font-size:var(--fs-sm);">Una ${Help.term('plantilla', 'plantilla')} arma la rutina con ejercicios de tu biblioteca. Después podrás cambiar todo antes de guardarla.</p>

        <section class="tpl-section">
          <h4>1. ¿Cuántos días por semana puede entrenar ${esc(client.name)}?</h4>
          <div class="seg tpl-seg" role="group" aria-label="Días por semana">
            ${DAY_OPTIONS.map(n => `<button type="button" class="seg-btn ${n === st.days ? 'active' : ''}" data-group="days" data-v="${n}">${n}</button>`).join('')}
          </div>
        </section>

        <section class="tpl-section">
          <h4>2. División</h4>
          <div class="tpl-choices">${list.map(t => choice('template', t.id, t.name, t.description, t.id === st.templateId)).join('')}</div>
        </section>

        <section class="tpl-section">
          <h4>3. Equipo disponible</h4>
          <div class="seg tpl-seg" role="group" aria-label="Equipo disponible">
            ${Object.entries(EQUIPMENT_PROFILES).map(([k, p]) => `<button type="button" class="seg-btn ${k === st.equipment ? 'active' : ''}" data-group="equipment" data-v="${k}">${p.label}</button>`).join('')}
          </div>
          <p class="text-muted" style="font-size:var(--fs-xs); margin:6px 0 0;">${esc(EQUIPMENT_PROFILES[st.equipment].hint)}</p>
        </section>

        <section class="tpl-section">
          <h4>4. ¿Qué ejercicios priorizar?</h4>
          <div class="tpl-choices">${Object.entries(PRIORITIES).map(([k, p]) => choice('priority', k, p.label, p.hint, k === st.priority)).join('')}</div>
        </section>

        <section class="tpl-section">
          <label class="field"><span>Nombre de la rutina</span>
            <input type="text" id="tpl-name" value="${esc(st.name)}"></label>
        </section>

        <section class="tpl-section tpl-preview">
          <h4>Vista previa</h4>
          ${previewMarkup(plan)}
        </section>`;

      host.querySelectorAll('[data-group]').forEach(btn => btn.addEventListener('click', () => {
        const g = btn.dataset.group, v = btn.dataset.v;
        if (g === 'days') { st.days = Number(v); st.templateId = null; }
        if (g === 'template') st.templateId = v;
        if (g === 'equipment') st.equipment = v;
        if (g === 'priority') st.priority = v;
        paint();
      }));
      host.querySelector('#tpl-name').addEventListener('input', e => { st.name = e.target.value; st.nameTouched = true; });
    };

    UI.openModal({
      title: '📐 Crear rutina desde plantilla',
      bodyEl: host,
      wide: true,
      confirmLabel: 'Revisar y editar',
      onOpen: paint,
      onConfirm: () => {
        if (!plan.days.some(d => d.exercises.length)) { Utils.toast('Esta combinación no tiene ejercicios disponibles', 'danger'); return false; }
        const name = (st.name || '').trim() || `${plan.template.name} - ${client.name}`;
        const draft = planToDraft(plan, client.id, name);
        // Al cerrar este diálogo se abre el constructor ya con la rutina armada (no se guarda hasta que el usuario lo haga)
        setTimeout(() => Routines.openBuilder(null, onDone, draft), 0);
      }
    });
  }

  return { TEMPLATES, EQUIPMENT_PROFILES, PRIORITIES, build, openWizard };
})();
