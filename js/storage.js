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
    migrateExercises();
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
    migrateExercises();
    save();
  }

  /* ---------------- Tipo de ejercicio (compuesto / aislamiento) y biblioteca ampliada ---------------- */

  const MECHANICS = ['compuesto', 'aislamiento'];
  const SEED_VERSION = 2;   // sube este número cuando se agreguen ejercicios nuevos a la biblioteca base
  const normName = s => String(s || '').trim().toLowerCase();

  const COMPOUND_NAMES = new Set([
    'press de banca con barra', 'press inclinado con mancuernas', 'dominadas', 'remo con barra', 'jalón al pecho',
    'peso muerto convencional', 'sentadilla trasera', 'prensa de piernas', 'zancadas', 'hip thrust', 'press militar con barra'
  ]);
  const ISOLATION_NAMES = new Set(['face pull', 'curl martillo', 'plancha', 'giro ruso con peso']);

  // Para ejercicios sin el campo `mechanic` (guardados antes de esta versión, importados o creados a mano)
  function inferMechanic(ex) {
    const n = normName(ex && ex.name);
    if (COMPOUND_NAMES.has(n)) return 'compuesto';
    if (ISOLATION_NAMES.has(n)) return 'aislamiento';
    return ((ex && ex.secondary) || []).length >= 1 ? 'compuesto' : 'aislamiento';
  }

  function migrateExercises() {
    db.settings = db.settings || {};
    db.exercises.forEach(ex => { if (!MECHANICS.includes(ex.mechanic)) ex.mechanic = inferMechanic(ex); });
    // Agrega los ejercicios nuevos de la biblioteca base UNA sola vez (por nombre, sin duplicar ni tocar los tuyos)
    if ((Number(db.settings.seedVersion) || 1) < SEED_VERSION) {
      const have = new Set(db.exercises.map(e => normName(e.name)));
      extraExercises().forEach(e => { if (!have.has(normName(e.name))) db.exercises.push(e); });
      db.settings.seedVersion = SEED_VERSION;
    }
  }

  function extraExercises() {
    // [nombre, músculos, secundarios, equipo, dificultad, tipo, descripción, consejo, unilateral?]
    const R = [
      ['Flexiones', ['pecho'], ['triceps', 'hombro-frontal'], 'Peso corporal', 'principiante', 'compuesto', 'Manos a la anchura de los hombros y cuerpo en línea recta: baja el pecho cerca del suelo y empuja hacia arriba.', 'Si es muy difícil, apoya las rodillas o las manos en una superficie elevada.'],
      ['Fondos en paralelas', ['pecho'], ['triceps', 'hombro-frontal'], 'Peso corporal', 'avanzado', 'compuesto', 'Con el torso inclinado al frente, baja hasta unos 90° en los codos y empuja hacia arriba.', 'Más inclinado carga más el pecho; más erguido, más el tríceps.'],
      ['Press con mancuernas plano', ['pecho'], ['triceps', 'hombro-frontal'], 'Mancuernas', 'principiante', 'compuesto', 'Acostado en banco plano, empuja las mancuernas hacia arriba y baja con control hasta sentir estiramiento en el pecho.', 'Codos a unos 45° del torso, no completamente abiertos.'],
      ['Press en máquina de pecho', ['pecho'], ['triceps', 'hombro-frontal'], 'Máquina', 'principiante', 'compuesto', 'Sentado con la espalda apoyada, empuja las asas al frente sin bloquear los codos.', 'Ajusta el asiento para que las asas queden a la altura del pecho medio.'],
      ['Cruce de poleas alto', ['pecho'], [], 'Polea', 'intermedio', 'aislamiento', 'De pie con las poleas arriba, lleva las manos hacia abajo y al frente cruzándolas un poco.', 'Aprovecha el estiramiento al abrir: ahí el pecho recibe más estímulo.'],
      ['Aperturas con mancuernas', ['pecho'], [], 'Mancuernas', 'principiante', 'aislamiento', 'Acostado, abre los brazos con los codos ligeramente flexionados y vuelve juntando las mancuernas.', 'No bajes más de lo que tu hombro tolere sin molestia.'],
      ['Aperturas con banda', ['pecho'], [], 'Bandas', 'principiante', 'aislamiento', 'De pie con la banda por detrás de la espalda, junta las manos al frente con los codos ligeramente flexionados.', 'Controla el regreso; no dejes que la banda te jale de golpe.'],
      ['Remo con mancuerna a una mano', ['espalda'], ['biceps', 'trapecio'], 'Mancuernas', 'principiante', 'compuesto', 'Con una mano y una rodilla apoyadas en el banco, lleva la mancuerna hacia la cadera.', 'Piensa en llevar el codo hacia atrás, no la mano.', true],
      ['Remo en polea baja', ['espalda'], ['biceps', 'hombro-posterior'], 'Polea', 'principiante', 'compuesto', 'Sentado con el torso firme, jala el agarre hacia el abdomen juntando las escápulas.', 'No te balancees: el torso casi no se mueve.'],
      ['Remo en máquina', ['espalda'], ['biceps', 'hombro-posterior'], 'Máquina', 'principiante', 'compuesto', 'Con el pecho apoyado, jala las asas hacia atrás apretando la espalda.', 'Haz una pausa breve al final para sentir la contracción.'],
      ['Remo invertido', ['espalda'], ['biceps'], 'Peso corporal', 'principiante', 'compuesto', 'Colgado bajo una barra o mesa firme, con el cuerpo recto, jala el pecho hacia la barra.', 'Cuanto más horizontal el cuerpo, más difícil.'],
      ['Remo con banda', ['espalda'], ['biceps'], 'Bandas', 'principiante', 'compuesto', 'Sentado con la banda en los pies, jala hacia el abdomen juntando las escápulas.', 'Mantén la espalda recta durante todo el movimiento.'],
      ['Pullover en polea', ['espalda'], [], 'Polea', 'intermedio', 'aislamiento', 'De pie frente a la polea alta y con los brazos casi rectos, lleva la barra o cuerda hacia los muslos.', 'Es un ejercicio de estiramiento para el dorsal: sube hasta sentirlo.'],
      ['Pullover con banda', ['espalda'], [], 'Bandas', 'principiante', 'aislamiento', 'Con la banda anclada arriba y los brazos casi rectos, llévala hacia los muslos.', 'Evita arquear la zona lumbar.'],
      ['Press de hombro con mancuernas', ['hombro-frontal'], ['triceps', 'hombro-lateral'], 'Mancuernas', 'principiante', 'compuesto', 'Sentado o de pie, empuja las mancuernas desde los hombros hasta extender los brazos.', 'Aprieta el abdomen para no arquear la espalda.'],
      ['Press de hombro en máquina', ['hombro-frontal'], ['triceps', 'hombro-lateral'], 'Máquina', 'principiante', 'compuesto', 'Sentado con la espalda apoyada, empuja las asas hacia arriba sin bloquear los codos.', 'Ajusta el asiento para que las asas partan a la altura de los hombros.'],
      ['Flexiones pike', ['hombro-frontal'], ['triceps', 'hombro-lateral'], 'Peso corporal', 'intermedio', 'compuesto', 'Con las caderas arriba formando una V invertida, baja la cabeza hacia el suelo y empuja.', 'Cuanto más cerca estén los pies de las manos, más trabajo de hombro.'],
      ['Elevaciones laterales en polea', ['hombro-lateral'], [], 'Polea', 'intermedio', 'aislamiento', 'De lado a la polea baja, levanta el brazo hasta la altura del hombro con el codo ligeramente flexionado.', 'La polea mantiene tensión también abajo, donde las mancuernas casi no cargan.'],
      ['Elevaciones laterales con banda', ['hombro-lateral'], [], 'Bandas', 'principiante', 'aislamiento', 'Pisa la banda y levanta los brazos a los lados hasta la altura de los hombros.', 'Sube liderando con el codo.'],
      ['Pájaros con mancuernas', ['hombro-posterior'], ['trapecio'], 'Mancuernas', 'principiante', 'aislamiento', 'Con el torso inclinado, abre los brazos a los lados con los codos ligeramente flexionados.', 'Usa poco peso y no te ayudes con impulso.'],
      ['Pec deck inverso', ['hombro-posterior'], ['trapecio'], 'Máquina', 'principiante', 'aislamiento', 'Sentado de frente al respaldo, abre los brazos hacia atrás sin encogerte de hombros.', 'Haz una pausa al final del recorrido.'],
      ['Face pull con banda', ['hombro-posterior'], ['trapecio'], 'Bandas', 'principiante', 'aislamiento', 'Con la banda anclada a la altura del rostro, jala hacia la cara separando las manos al final.', 'Excelente para la salud del hombro y la postura.'],
      ['Curl alternado con mancuernas', ['biceps'], [], 'Mancuernas', 'principiante', 'aislamiento', 'De pie, flexiona un codo a la vez girando la palma hacia arriba.', 'Mantén el codo pegado al torso.'],
      ['Curl inclinado con mancuernas', ['biceps'], [], 'Mancuernas', 'intermedio', 'aislamiento', 'Sentado en banco inclinado, deja los brazos colgando y flexiona los codos.', 'Estira el bíceps al máximo abajo: ahí está gran parte del estímulo.'],
      ['Curl en polea', ['biceps'], [], 'Polea', 'principiante', 'aislamiento', 'De pie frente a la polea baja, flexiona los codos llevando la barra o cuerda hacia los hombros.', 'La tensión se mantiene durante todo el recorrido.'],
      ['Curl con banda', ['biceps'], [], 'Bandas', 'principiante', 'aislamiento', 'Pisa la banda y flexiona los codos llevando las manos a los hombros.', 'Codos quietos y pegados al torso.'],
      ['Extensión de tríceps sobre la cabeza en polea', ['triceps'], [], 'Polea', 'intermedio', 'aislamiento', 'De espaldas a la polea, con las manos detrás de la cabeza, extiende los codos hacia arriba.', 'Es la variante que más estira la cabeza larga del tríceps.'],
      ['Extensión de tríceps sobre la cabeza con mancuerna', ['triceps'], [], 'Mancuernas', 'principiante', 'aislamiento', 'Con una mancuerna sostenida con ambas manos detrás de la cabeza, extiende los codos.', 'Codos apuntando al frente, sin abrirlos.'],
      ['Extensión de tríceps con banda', ['triceps'], [], 'Bandas', 'principiante', 'aislamiento', 'Con la banda anclada arriba, extiende los codos hacia abajo manteniéndolos pegados al torso.', 'Controla el regreso.'],
      ['Fondos en banco', ['triceps'], ['pecho', 'hombro-frontal'], 'Peso corporal', 'principiante', 'compuesto', 'Con las manos en el borde de un banco, baja el cuerpo doblando los codos y empuja hacia arriba.', 'Mantén la espalda cerca del banco para cuidar los hombros.'],
      ['Sentadilla con peso corporal', ['cuadriceps'], ['gluteos'], 'Peso corporal', 'principiante', 'compuesto', 'Pies a la anchura de los hombros, baja controlando hasta paralelo o más y sube.', 'Rodillas siguen la dirección de los pies.'],
      ['Sentadilla goblet', ['cuadriceps'], ['gluteos'], 'Mancuernas', 'principiante', 'compuesto', 'Sostén una mancuerna al pecho, baja profundo con el torso erguido y sube.', 'Muy buena para aprender el patrón de sentadilla.'],
      ['Sentadilla búlgara', ['cuadriceps'], ['gluteos'], 'Mancuernas', 'intermedio', 'compuesto', 'Con el pie de atrás apoyado en un banco, baja con la pierna de adelante hasta que el muslo quede paralelo.', 'Un paso largo carga más glúteo; uno corto, más cuádriceps.', true],
      ['Zancadas con peso corporal', ['cuadriceps'], ['gluteos', 'isquiotibiales'], 'Peso corporal', 'principiante', 'compuesto', 'Da un paso al frente y baja hasta que ambas rodillas formen unos 90°.', 'Torso vertical para enfocar el cuádriceps.'],
      ['Extensión de cuádriceps', ['cuadriceps'], [], 'Máquina', 'principiante', 'aislamiento', 'Sentado, extiende las rodillas hasta casi bloquearlas y baja con control.', 'Pausa arriba apretando el cuádriceps.'],
      ['Peso muerto rumano con barra', ['isquiotibiales'], ['gluteos', 'espalda-baja'], 'Barra', 'intermedio', 'compuesto', 'Con la barra pegada a las piernas, lleva la cadera atrás hasta sentir el estiramiento de los isquios y sube.', 'Espalda neutra y rodillas casi fijas.'],
      ['Peso muerto rumano con mancuernas', ['isquiotibiales'], ['gluteos', 'espalda-baja'], 'Mancuernas', 'principiante', 'compuesto', 'Con una mancuerna en cada mano, lleva la cadera atrás hasta sentir el estiramiento y sube.', 'Mantén las mancuernas cerca de las piernas.'],
      ['Peso muerto rumano a una pierna', ['isquiotibiales'], ['gluteos', 'espalda-baja'], 'Peso corporal', 'intermedio', 'compuesto', 'Apoyado en una pierna, inclina el torso al frente llevando la otra pierna atrás y vuelve.', 'Apoya una mano en una pared si pierdes el equilibrio.', true],
      ['Curl femoral sentado', ['isquiotibiales'], [], 'Máquina', 'principiante', 'aislamiento', 'Sentado, flexiona las rodillas llevando el rodillo hacia abajo y atrás.', 'Con la cadera flexionada, el isquiotibial queda más estirado: mejor estímulo.'],
      ['Puente de isquiotibiales', ['isquiotibiales'], ['gluteos'], 'Peso corporal', 'principiante', 'aislamiento', 'Acostado boca arriba con los talones apoyados, flexiona las rodillas llevando los talones hacia los glúteos y eleva la cadera.', 'Si es fácil, hazlo con una pierna.'],
      ['Curl nórdico', ['isquiotibiales'], [], 'Peso corporal', 'avanzado', 'aislamiento', 'De rodillas con los pies sujetos, baja el torso al frente lo más lento posible y ayúdate con las manos para subir.', 'Empieza con rango corto y ve ampliándolo.'],
      ['Puente de glúteos', ['gluteos'], ['isquiotibiales'], 'Peso corporal', 'principiante', 'compuesto', 'Acostado boca arriba, sube la cadera apretando los glúteos y baja con control.', 'Pausa 1 segundo arriba.'],
      ['Hip thrust con mancuerna', ['gluteos'], ['isquiotibiales'], 'Mancuernas', 'principiante', 'compuesto', 'Con la espalda alta en un banco y la mancuerna sobre la cadera, empuja hacia arriba hasta la extensión completa.', 'Barbilla al pecho y costillas abajo para no arquear la espalda.'],
      ['Patada de glúteo en polea', ['gluteos'], [], 'Polea', 'principiante', 'aislamiento', 'Con el tobillo en la polea baja, lleva la pierna hacia atrás sin arquear la espalda.', 'El movimiento sale de la cadera, no de la zona lumbar.'],
      ['Abducción de cadera en máquina', ['gluteos'], [], 'Máquina', 'principiante', 'aislamiento', 'Sentado, abre las piernas contra la resistencia y vuelve con control.', 'Inclina el torso un poco al frente para enfocar el glúteo.'],
      ['Abducción de cadera con banda', ['gluteos'], [], 'Bandas', 'principiante', 'aislamiento', 'Con la banda sobre las rodillas, abre las piernas contra la resistencia.', 'Controla el regreso.'],
      ['Elevación de talones sentado', ['pantorrillas'], [], 'Máquina', 'principiante', 'aislamiento', 'Sentado con las rodillas dobladas, sube los talones y baja hasta estirar por completo.', 'Trabaja más el sóleo que la versión de pie.'],
      ['Elevación de talones a una pierna', ['pantorrillas'], [], 'Peso corporal', 'principiante', 'aislamiento', 'Apoyado en una pierna en el borde de un escalón, sube el talón y baja hasta estirar por completo.', 'Sujétate de algo para el equilibrio.', true],
      ['Elevación de piernas colgado', ['abdomen'], ['oblicuos'], 'Peso corporal', 'avanzado', 'aislamiento', 'Colgado de una barra, sube las piernas flexionando la cadera y curvando la pelvis.', 'Evita balancearte; si es difícil, flexiona las rodillas.'],
      ['Crunch en polea', ['abdomen'], [], 'Polea', 'intermedio', 'aislamiento', 'De rodillas frente a la polea alta, flexiona el torso llevando los codos hacia las rodillas.', 'Redondea la columna; no jales con los brazos.'],
      ['Hiperextensiones', ['espalda-baja'], ['gluteos', 'isquiotibiales'], 'Peso corporal', 'principiante', 'compuesto', 'En el banco de hiperextensiones, baja el torso con la espalda recta y sube hasta alinear el cuerpo.', 'No hiperextiendas arriba.'],
      ['Encogimientos con mancuernas', ['trapecio'], [], 'Mancuernas', 'principiante', 'aislamiento', 'De pie con una mancuerna en cada mano, sube los hombros hacia las orejas y baja con control.', 'Sin rotar los hombros.']
    ];
    return R.map(([name, muscles, secondary, equipment, difficulty, mechanic, description, tips, unilateral]) => ({
      id: Utils.uid('exe'), createdAt: new Date().toISOString(), custom: false,
      name, muscles, secondary, equipment, difficulty, mechanic, description, tips, videoUrl: '',
      unilateral: !!unilateral, measureByTime: false, trackPR: true
    }));
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
    exportJSON, importJSON, resetAll, replaceAll, inferMechanic
  };
})();
