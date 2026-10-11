/* ==========================================================================
   HELP — lenguaje simple: términos con explicación al tocar, glosario con
   buscador y guía de bienvenida. Todo el texto de ayuda vive aquí, en un solo
   lugar, para poder corregirlo sin tocar el resto de la app.
   ========================================================================== */

const Help = (() => {

  // key -> { name: nombre en palabras simples, text: explicación, example?: ejemplo corto }
  const TERMS = {
    serie: {
      name: 'Serie',
      text: 'Un bloque de repeticiones seguidas, sin descansar entre ellas. Cada ejercicio suele tener varias series.'
    },
    reps: {
      name: 'Repeticiones (reps)',
      text: 'Cuántas veces haces el movimiento completo dentro de una serie. "8-12" es una meta con rango: entre 8 y 12.'
    },
    meta: {
      name: 'Meta',
      text: 'Lo que se planea hacer en la rutina (reps meta, peso meta, reserva meta). Lo que realmente hiciste se anota al registrar el entrenamiento.'
    },
    fallo: {
      name: 'Fallo técnico',
      text: 'El punto en que ya no puedes hacer otra repetición manteniendo la forma correcta. La app mide el esfuerzo con base en este punto, no en el límite absoluto.'
    },
    rir: {
      name: 'Reserva (RIR)',
      text: 'RIR significa "repeticiones en reserva": cuántas repeticiones más habrías podido hacer antes del fallo técnico. 0 = no podías ninguna más; 2 = te sobraban 2.',
      example: 'Hiciste 10 reps y sentiste que podías hacer 2 más → anota 2.'
    },
    rpe: {
      name: 'Esfuerzo (RPE)',
      text: 'RPE significa "esfuerzo percibido": qué tan dura fue la serie, de 1 a 10. 10 = esfuerzo máximo. Se relaciona con la reserva: esfuerzo = 10 − reserva.',
      example: 'Con 2 reps en reserva, el esfuerzo es 8.'
    },
    efectiva: {
      name: 'Serie efectiva',
      text: 'Una serie lo bastante intensa para estimular el músculo: esfuerzo 7 o más, o reserva de 3 o menos. La app las cuenta en el resumen de cada sesión.'
    },
    rm: {
      name: 'Máximo estimado (1RM)',
      text: '1RM es el peso máximo que podrías levantar una sola vez. Como probarlo cansa y es riesgoso, la app lo estima con la fórmula de Epley: peso × (1 + reps ÷ 30).',
      example: '60 kg × 10 reps → máximo estimado de 80 kg.'
    },
    pr: {
      name: 'Récord (PR)',
      text: 'Tu mejor marca en un ejercicio. Una serie es récord (🏆) cuando su máximo estimado supera al de todas tus sesiones anteriores de ese ejercicio. Se puede desactivar por ejercicio.'
    },
    volumen: {
      name: 'Volumen',
      text: 'Peso × repeticiones, sumado en todas las series. Sirve para comparar cuánto trabajo total hiciste entre sesiones o entre meses.',
      example: '3 series de 10 reps con 50 kg = 1,500 kg de volumen.'
    },
    unilateral: {
      name: 'Unilateral y lado',
      text: 'Ejercicio que trabaja un lado del cuerpo a la vez (por ejemplo, un curl con una sola mancuerna). Izquierdo y Derecho se registran por separado y cada lado tiene su propio récord. "Ambos lados" es una sola fila para los dos lados con el mismo peso y reps.'
    },
    pesocorporal: {
      name: 'Peso corporal + extra',
      text: 'En ejercicios de peso corporal (dominadas, fondos…) solo anotas el peso EXTRA que agregas (lastre, chaleco, mancuerna). Vacío o 0 = solo tu cuerpo. El volumen y el máximo estimado usan el total: peso corporal (del último registro de Progreso) + extra.'
    },
    anterior: {
      name: 'Anterior / Última vez',
      text: 'Lo que hiciste la última vez que entrenaste ese ejercicio, para que sepas qué peso y reps superar.'
    },
    sobrecarga: {
      name: 'Sobrecarga progresiva (💡)',
      text: 'Ir aumentando poco a poco el peso, las reps o las series para seguir progresando. La app sugiere subir el peso cuando completaste el tope del rango de reps en todas las series.'
    },
    plantilla: {
      name: 'Plantilla de rutina',
      text: 'Una rutina ya armada según los días que el cliente puede entrenar. La app elige ejercicios de tu biblioteca y puedes cambiarlos antes de guardar.'
    },
    compuesto: {
      name: 'Compuesto y aislamiento',
      text: 'Compuesto: mueve varias articulaciones y músculos a la vez (sentadilla, press de banca) y se trabaja con cargas altas, de 6 a 10 repeticiones. Aislamiento: trabaja un músculo con una sola articulación (curl, elevaciones laterales), de 10 a 15 repeticiones.'
    },
    seriesdirectas: {
      name: 'Series directas por semana',
      text: 'Series que trabajan ese músculo como objetivo principal. No cuentan el trabajo indirecto (por ejemplo, el tríceps en los press); el panel de volumen de la rutina sí lo suma, a la mitad. Referencia: músculos grandes 12 a 20 series efectivas por semana; pequeños, 8 a 15 directas.'
    },
    tamanomuscular: {
      name: 'Tamaño del músculo',
      text: 'Los músculos grandes (pecho, espalda, cuádriceps, glúteos, isquiotibiales) toleran más volumen: de 12 a 20 series por semana. Los pequeños (bíceps, tríceps, hombros, pantorrillas) se trabajan con 8 a 15. Las plantillas usan este dato para marcar si el volumen es adecuado.'
    },
    mev: {
      name: 'Mínimo efectivo (MEV)',
      text: 'Las series semanales mínimas por músculo para empezar a ver adaptaciones: unas 10. Por debajo de eso, el estímulo suele ser insuficiente para crecer.'
    },
    mrv: {
      name: 'Máximo recuperable (MRV)',
      text: 'Las series semanales máximas que un músculo puede recuperar: unas 22 a 25. Por encima aparece fatiga acumulada y estancamiento.'
    },
    volumenbasura: {
      name: 'Volumen basura',
      text: 'Más de 8 a 10 series del mismo músculo en una sola sesión. Las series extra aportan poco estímulo y mucha fatiga; es mejor pasarlas a otro día.'
    },
    macros: {
      name: 'Kcal y macros',
      text: 'Kcal son las calorías. Los macros son proteína, carbohidratos y grasas, que se registran en gramos en Alimentación.'
    }
  };

  const esc = s => Utils.escapeHtml(String(s ?? ''));

  /* ---------------- Término tocable ---------------- */

  // HTML de un texto que, al tocarlo, explica qué significa.
  function term(key, label) {
    if (!TERMS[key]) return esc(label || key);
    return `<button type="button" class="term" data-term="${key}">${esc(label || TERMS[key].name)}<span class="term-i" aria-hidden="true">ⓘ</span></button>`;
  }

  let pop = null;
  let popKey = null;

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.id = 'term-pop';
    pop.className = 'term-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-live', 'polite');
    document.body.appendChild(pop);
    pop.addEventListener('click', e => {
      if (e.target.closest('.term-pop-close')) hidePop();
      if (e.target.closest('.term-pop-more')) { hidePop(); openGlossary(); }
    });
    return pop;
  }

  function hidePop() {
    if (pop) pop.classList.remove('open');
    popKey = null;
  }

  function showTerm(key) {
    const t = TERMS[key];
    if (!t) return;
    const el = ensurePop();
    el.innerHTML = `
      <div class="term-pop-head"><strong>${esc(t.name)}</strong>
        <button type="button" class="term-pop-close" aria-label="Cerrar">✕</button></div>
      <p>${esc(t.text)}</p>
      ${t.example ? `<p class="term-pop-example"><span>Ejemplo:</span> ${esc(t.example)}</p>` : ''}
      <button type="button" class="term-pop-more">Ver todo el glosario</button>`;
    el.classList.add('open');
    popKey = key;
  }

  function init() {
    // Un solo escuchador para todos los términos, incluso los que se dibujan después
    document.addEventListener('click', e => {
      const btn = e.target.closest('.term');
      if (btn) {
        e.preventDefault();
        if (popKey === btn.dataset.term) hidePop(); else showTerm(btn.dataset.term);
        return;
      }
      if (pop && pop.classList.contains('open') && !e.target.closest('#term-pop')) hidePop();
    });
    // Escape cierra primero el aviso; solo si no hay aviso, cierra la ventana
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && pop && pop.classList.contains('open')) {
        e.stopImmediatePropagation();
        hidePop();
      }
    }, true);
  }

  /* ---------------- Glosario con buscador ---------------- */

  function openGlossary() {
    const host = document.createElement('div');
    const list = () => Object.values(TERMS);
    const paint = q => {
      const needle = (q || '').trim().toLowerCase();
      const rows = list().filter(t => !needle || (t.name + ' ' + t.text).toLowerCase().includes(needle));
      host.querySelector('#gl-list').innerHTML = rows.length
        ? rows.map(t => `<dt>${esc(t.name)}</dt><dd>${esc(t.text)}${t.example ? ` <em>Ejemplo: ${esc(t.example)}</em>` : ''}</dd>`).join('')
        : '<p class="text-muted">No hay términos con esa búsqueda.</p>';
    };
    host.innerHTML = `
      <input type="search" id="gl-search" class="search-input" style="width:100%; margin-bottom:var(--space-3);" placeholder="Buscar: reserva, récord, volumen…" aria-label="Buscar en el glosario">
      <dl class="glossary-list" id="gl-list"></dl>
      <p class="text-muted" style="font-size:var(--fs-xs); margin-top:var(--space-3);">Para la tabla de reserva y esfuerzo (RIR ↔ RPE), usa el botón "📏 Guía" al registrar un entrenamiento.</p>`;
    UI.openModal({
      title: '❓ Glosario',
      bodyEl: host,
      hideFooter: true,
      onOpen: () => {
        paint('');
        host.querySelector('#gl-search').addEventListener('input', e => paint(e.target.value));
      }
    });
  }

  /* ---------------- Guía de bienvenida ---------------- */

  const TOUR = [
    { icon: '👋', title: 'Bienvenido a EJERCILUCAS', text: 'Aquí llevas a tus clientes: sus rutinas, entrenamientos, comidas y progreso. Todo se guarda en este navegador. Te lo explico en 4 pasos cortos.' },
    { icon: '🧑‍🤝‍🧑', title: '1. Agrega un cliente', text: 'Toca el botón ➕ de arriba para crear a tu primer cliente. Con su nombre y su objetivo basta para empezar.' },
    { icon: '📋', title: '2. Crea su rutina', text: 'En "Rutinas" arma los días y elige los ejercicios de la biblioteca. Cada ejercicio tiene su tutorial.' },
    { icon: '🏋️', title: '3. Registra el entrenamiento', text: 'En "Resumen" toca "Entrenar hoy". Anota el peso y las repeticiones, y marca ✓ cada serie: el descanso se cronometra solo.' },
    { icon: '💡', title: '¿Hay una palabra que no entiendes?', text: 'Toca cualquier término con ⓘ (como "Reserva (RIR)") y verás qué significa. También tienes el glosario en ❓ y esta guía en Ajustes.' }
  ];

  function markTourDone() {
    Storage.get().settings.tourDone = true;
    Storage.save();
  }

  function startTour() {
    const host = document.createElement('div');
    let i = 0;
    const paint = () => {
      const s = TOUR[i];
      const last = i === TOUR.length - 1;
      const noClients = !Clients.all().length;
      host.innerHTML = `
        <div class="tour-step">
          <div class="tour-icon" aria-hidden="true">${s.icon}</div>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.text)}</p>
        </div>
        <div class="tour-dots" aria-label="Paso ${i + 1} de ${TOUR.length}">
          ${TOUR.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}
        </div>
        <div class="tour-actions">
          ${i > 0 ? '<button type="button" class="btn-secondary" id="tour-prev">Atrás</button>' : '<button type="button" class="btn-secondary" id="tour-skip">Omitir</button>'}
          ${last
            ? (noClients
              ? '<button type="button" class="btn-primary" id="tour-end" data-add="1">➕ Agregar mi primer cliente</button>'
              : '<button type="button" class="btn-primary" id="tour-end">Empezar</button>')
            : '<button type="button" class="btn-primary" id="tour-next">Siguiente</button>'}
        </div>`;
      const on = (id, fn) => { const b = host.querySelector(id); if (b) b.addEventListener('click', fn); };
      on('#tour-prev', () => { i--; paint(); });
      on('#tour-next', () => { i++; paint(); });
      on('#tour-skip', () => UI.closeModal());
      on('#tour-end', e => {
        const add = e.currentTarget.dataset.add;
        UI.closeModal();
        if (add) Clients.createClient();
      });
    };
    UI.openModal({
      title: 'Guía de inicio',
      bodyEl: host,
      hideFooter: true,
      onOpen: paint,
      onClose: markTourDone
    });
  }

  // Solo se abre sola a quien empieza de cero; quien ya tiene clientes no la necesita
  function maybeStartTour() {
    const s = Storage.get().settings;
    if (s.tourDone) return false;
    if (Clients.all().length) { markTourDone(); return false; }
    startTour();
    return true;
  }

  return { TERMS, term, init, openGlossary, startTour, maybeStartTour };
})();
