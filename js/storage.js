/* ==========================================================================
   STORAGE — única fuente de verdad persistida en localStorage
   Toda la app lee/escribe la base de datos a través de este módulo.
   ========================================================================== */

const Storage = (() => {

  const DB_KEY = 'pulso_db_v1';

  const EMPTY_DB = () => ({
    version: 1,
    settings: { darkMode: true, units: 'kg' },
    activeClientId: null,
    lastBackupAt: null,        // ISO del último respaldo completo hecho
    backupSnoozeUntil: null,   // ISO hasta cuándo se pospone el recordatorio
    clients: [],
    exercises: [],
    routines: [],
    workoutLogs: [],
    nutritionLogs: [],
    progressLogs: []
  });

  let db = null;

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      db = raw ? JSON.parse(raw) : EMPTY_DB();
      // completar llaves faltantes si la versión guardada es más vieja
      const base = EMPTY_DB();
      db = { ...base, ...db };
    } catch (e) {
      console.error('No se pudo leer la base de datos local, se reinicia.', e);
      db = EMPTY_DB();
    }
    if (!db.exercises.length) seedExercises();
    // Migración: ejercicios guardados antes de estos campos no los traen.
    db.exercises.forEach(ex => {
      if (typeof ex.unilateral !== 'boolean') ex.unilateral = false;
      if (typeof ex.measureByTime !== 'boolean') ex.measureByTime = false;
      if (typeof ex.trackPR !== 'boolean') ex.trackPR = true;
    });
    save();
    return db;
  }

  // Devuelve true si se guardó, false si falló (p. ej. cuota llena)
  const WARN_CHARS = 4250000;   // ~85 % de los ~5 MB de localStorage
  let warnedFull = false;

  function save() {
    try {
      const json = JSON.stringify(db);
      localStorage.setItem(DB_KEY, json);
      if (!warnedFull && json.length > WARN_CHARS) {
        warnedFull = true;
        Utils.toast('Almacenamiento casi lleno (>85 %). Ve a Ajustes → Optimizar fotos.', 'info');
      }
      return true;
    } catch (e) {
      console.error('No se pudo guardar en localStorage (¿cuota llena?)', e);
      Utils.toast('No se pudo guardar: almacenamiento local lleno', 'danger');
      return false;
    }
  }

  // Sustituye toda la base por `next`. Si no se puede guardar, restaura la anterior.
  function replaceAll(next) {
    const prev = db;
    db = next;
    if (save()) return true;
    db = prev;
    return false;
  }

  function get() { return db; }

  /* ---------------- CRUD genérico por colección ---------------- */

  function all(collection) { return db[collection]; }

  function find(collection, id) { return db[collection].find(x => x.id === id) || null; }

  function insert(collection, obj) {
    if (!obj.id) obj.id = Utils.uid(collection.slice(0, 3));
    obj.createdAt = obj.createdAt || new Date().toISOString();
    db[collection].push(obj);
    save();
    return obj;
  }

  function update(collection, id, patch) {
    const item = find(collection, id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    save();
    return item;
  }

  function remove(collection, id) {
    db[collection] = db[collection].filter(x => x.id !== id);
    save();
  }

  function removeWhere(collection, predicate) {
    db[collection] = db[collection].filter(x => !predicate(x));
    save();
  }

  /* ---------------- Import / Export ---------------- */

  function exportJSON() {
    return JSON.stringify(db, null, 2);
  }

  function importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') throw new Error('Archivo inválido');
    db = { ...EMPTY_DB(), ...parsed };
    save();
    return db;
  }

  function resetAll() {
    db = EMPTY_DB();
    seedExercises();
    save();
  }

  /* ---------------- Datos semilla: biblioteca inicial de ejercicios ---------------- */

  function seedExercises() {
    const base = [
      { name: 'Press de banca con barra', muscles: ['pecho'], secondary: ['triceps', 'hombro-frontal'], equipment: 'Barra', difficulty: 'intermedio',
        description: 'Acostado en banco plano, baja la barra al pecho controlando el descenso y empuja hacia arriba sin bloquear las muñecas.',
        tips: 'Escápulas retraídas y pies firmes en el piso todo el movimiento.', videoUrl: '' },
      { name: 'Press inclinado con mancuernas', muscles: ['pecho'], secondary: ['hombro-frontal', 'triceps'], equipment: 'Mancuernas', difficulty: 'intermedio',
        description: 'Banco a 30-45°, empuja las mancuernas hacia arriba y adentro sin chocar arriba.',
        tips: 'Un ángulo mayor a 45° quita énfasis al pectoral y lo pasa al hombro.', videoUrl: '' },
      { name: 'Aperturas en polea', muscles: ['pecho'], secondary: [], equipment: 'Polea', difficulty: 'principiante',
        description: 'De pie entre poleas, junta las manos al frente con un ligero codo flexionado.',
        tips: 'Ideal como serie efectiva final por su tensión constante.', videoUrl: '' },
      { name: 'Dominadas', muscles: ['espalda'], secondary: ['biceps'], equipment: 'Peso corporal', difficulty: 'avanzado',
        description: 'Cuelga de la barra con agarre prono, sube hasta que la barbilla pase la barra.',
        tips: 'Si no llegas a completar reps, usa banda de asistencia o negativas.', videoUrl: '' },
      { name: 'Remo con barra', muscles: ['espalda'], secondary: ['biceps', 'trapecio'], equipment: 'Barra', difficulty: 'intermedio',
        description: 'Con torso inclinado ~45°, lleva la barra hacia el abdomen apretando escápulas.',
        tips: 'Evita usar impulso lumbar; el movimiento nace de la espalda.', videoUrl: '' },
      { name: 'Jalón al pecho', muscles: ['espalda'], secondary: ['biceps'], equipment: 'Polea', difficulty: 'principiante',
        description: 'Sentado, jala la barra hacia la parte alta del pecho controlando el regreso.',
        tips: 'Buena alternativa a dominadas para principiantes.', videoUrl: '' },
      { name: 'Peso muerto convencional', muscles: ['espalda-baja'], secondary: ['isquiotibiales', 'gluteos'], equipment: 'Barra', difficulty: 'avanzado',
        description: 'Desde el piso, extiende cadera y rodillas a la vez manteniendo la barra pegada a las piernas.',
        tips: 'La espalda se mantiene neutra en todo momento, nunca redondeada.', videoUrl: '' },
      { name: 'Sentadilla trasera', muscles: ['cuadriceps'], secondary: ['gluteos', 'espalda-baja'], equipment: 'Barra', difficulty: 'avanzado',
        description: 'Barra en la espalda alta, desciende hasta paralelo o más manteniendo el torso erguido.',
        tips: 'Rodillas siguen la dirección de los pies durante el descenso.', videoUrl: '' },
      { name: 'Prensa de piernas', muscles: ['cuadriceps'], secondary: ['gluteos'], equipment: 'Máquina', difficulty: 'principiante',
        description: 'Empuja la plataforma extendiendo las rodillas sin bloquearlas al final.',
        tips: 'Buena opción de bajo estrés lumbar comparado con sentadilla.', videoUrl: '' },
      { name: 'Zancadas', muscles: ['cuadriceps'], secondary: ['gluteos', 'isquiotibiales'], equipment: 'Mancuernas', difficulty: 'intermedio',
        description: 'Da un paso al frente y baja hasta que ambas rodillas formen 90°.',
        tips: 'Mantén el torso vertical para enfocar más el cuádriceps.', videoUrl: '' },
      { name: 'Curl femoral acostado', muscles: ['isquiotibiales'], secondary: [], equipment: 'Máquina', difficulty: 'principiante',
        description: 'Boca abajo, flexiona las rodillas llevando el rodillo hacia los glúteos.',
        tips: 'Evita levantar la cadera del banco durante la fase concéntrica.', videoUrl: '' },
      { name: 'Hip thrust', muscles: ['gluteos'], secondary: ['isquiotibiales'], equipment: 'Barra', difficulty: 'intermedio',
        description: 'Espalda alta apoyada en banco, empuja la cadera hacia arriba hasta la extensión completa.',
        tips: 'Pausa 1 segundo arriba apretando el glúteo con fuerza.', videoUrl: '' },
      { name: 'Elevación de talones de pie', muscles: ['pantorrillas'], secondary: [], equipment: 'Máquina', difficulty: 'principiante',
        description: 'Sube el talón lo más posible y baja controlando el estiramiento completo.',
        tips: 'El rango completo importa más que la carga en este ejercicio.', videoUrl: '' },
      { name: 'Press militar con barra', muscles: ['hombro-frontal'], secondary: ['triceps', 'hombro-lateral'], equipment: 'Barra', difficulty: 'intermedio',
        description: 'De pie, empuja la barra desde los hombros hasta la extensión completa de brazos.',
        tips: 'Aprieta glúteos y abdomen para no arquear la zona lumbar.', videoUrl: '' },
      { name: 'Elevaciones laterales', muscles: ['hombro-lateral'], secondary: [], equipment: 'Mancuernas', difficulty: 'principiante',
        description: 'Levanta las mancuernas a los lados hasta la altura del hombro con un ligero codo flexionado.',
        tips: 'Sube liderando con el codo, no con la muñeca.', videoUrl: '' },
      { name: 'Face pull', muscles: ['hombro-posterior'], secondary: ['trapecio'], equipment: 'Polea', difficulty: 'principiante',
        description: 'Jala la cuerda hacia el rostro separando las manos al final del recorrido.',
        tips: 'Excelente para salud del hombro y postura.', videoUrl: '' },
      { name: 'Curl de bíceps con barra', muscles: ['biceps'], secondary: [], equipment: 'Barra', difficulty: 'principiante',
        description: 'De pie, flexiona los codos llevando la barra hacia los hombros sin balancear el torso.',
        tips: 'Codos pegados al torso durante todo el recorrido.', videoUrl: '' },
      { name: 'Curl martillo', muscles: ['biceps'], secondary: ['antebrazo'], equipment: 'Mancuernas', difficulty: 'principiante',
        description: 'Curl con agarre neutro (palmas enfrentadas) que suma trabajo de antebrazo.',
        tips: 'Ideal para variar el estímulo del bíceps braquial.', videoUrl: '' },
      { name: 'Press francés', muscles: ['triceps'], secondary: [], equipment: 'Barra', difficulty: 'intermedio',
        description: 'Acostado, baja la barra controlando hacia la frente y extiende los codos.',
        tips: 'Codos apuntando al techo, fijos durante todo el movimiento.', videoUrl: '' },
      { name: 'Extensión de tríceps en polea', muscles: ['triceps'], secondary: [], equipment: 'Polea', difficulty: 'principiante',
        description: 'Con la cuerda o barra, extiende los codos manteniéndolos pegados al torso.',
        tips: 'Buena opción para series efectivas de alto volumen.', videoUrl: '' },
      { name: 'Crunch abdominal', muscles: ['abdomen'], secondary: [], equipment: 'Peso corporal', difficulty: 'principiante',
        description: 'Acostado, flexiona el torso acercando las costillas a la pelvis.',
        tips: 'Exhala en la contracción para activar mejor el recto abdominal.', videoUrl: '' },
      { name: 'Plancha', muscles: ['abdomen'], secondary: ['oblicuos'], equipment: 'Peso corporal', difficulty: 'principiante',
        description: 'Sostén el cuerpo en línea recta apoyado en antebrazos y punta de pies.',
        tips: 'Aprieta glúteos y abdomen; evita que la cadera caiga.', videoUrl: '' },
      { name: 'Giro ruso con peso', muscles: ['oblicuos'], secondary: ['abdomen'], equipment: 'Disco o mancuerna', difficulty: 'intermedio',
        description: 'Sentado con torso inclinado hacia atrás, gira el peso de un lado a otro del cuerpo.',
        tips: 'Controla la velocidad; no es un ejercicio de balanceo.', videoUrl: '' }
    ].map(e => ({ id: Utils.uid('exe'), createdAt: new Date().toISOString(), custom: false, ...e }));
    db.exercises = base;
  }

  return {
    load, save, get,
    all, find, insert, update, remove, removeWhere,
    exportJSON, importJSON, resetAll, replaceAll
  };
})();
