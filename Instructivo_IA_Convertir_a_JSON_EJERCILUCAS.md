# EJERCILUCAS · Instructivo para la IA: convertir archivos a JSON importable

Formato de importación versión 1 · Entrega este documento COMPLETO a la IA junto con el archivo a convertir.
La app lo importa en **Ajustes → Importar datos…** (acepta solo `.json`).

---

## A1. Tu tarea

Eres un conversor de datos. Recibirás un archivo (Excel, CSV, PDF, Word, imagen o texto) con información de un entrenador personal: clientes, ejercicios, rutinas, entrenamientos hechos, alimentación, progreso corporal o gimnasios. Debes producir **un único objeto JSON** que EJERCILUCAS pueda importar sin errores. La app descarta los registros mal formados, así que sigue este documento al pie de la letra.

## A2. Reglas absolutas

1. **Salida = solo JSON válido.** Sin texto antes ni después, sin bloques markdown (sin ```), sin comentarios, sin comas finales, comillas dobles siempre, UTF-8 con acentos.
2. **No inventes datos.** Dato ausente → texto `""`, número `""` o `null` donde se indica, booleano `false`, lista `[]`. Nunca «N/A», «—» ni «desconocido».
3. **Omite las secciones sin datos de origen.** No pongas `"workoutLogs": []` si el archivo no habla de entrenamientos: en modo *Reemplazar* una lista vacía borraría los que ya existen.
4. **Nunca generes imágenes ni base64.** No incluyas `beforePhoto`, `afterPhoto`, `photo` ni `media` (la persona las sube después).
5. **Un dato, un lugar.** No dupliques información salvo las referencias por id de A5.
6. **Respeta los nombres de campo exactos** (distinguen mayúsculas): `clientId`, `exerciseId`, `targetSets`, `bodyFatPct`, etc.
7. **Conserva el texto original** (nombres, notas) sin corregir ni traducir. Solo recorta espacios.
8. **Dudas y supuestos** → `_notas_conversion` (único texto extra permitido).
9. **Todos los pesos se guardan SIEMPRE en kg**, aunque el origen use libras (ver A4).

## A3. Envoltorio (estructura raíz)

A diferencia de otras apps, **las secciones van directamente en la raíz** (no dentro de «datos»).

```json
{
  "_meta": { "app": "pulso", "version": 1, "exportedAt": "2026-10-13T12:00:00.000Z", "sections": ["clients", "progressLogs"], "photos": false },
  "clients": [ ],
  "progressLogs": [ ],
  "_notas_conversion": ["Texto libre con supuestos o filas omitidas"]
}
```

- `_meta.app` = `"pulso"` (nombre interno de la base, no lo cambies), `version` = `1` (número), `photos` = `false`.
- `_meta.sections` = lista con exactamente las secciones presentes.
- `exportedAt`: fecha y hora ISO 8601 UTC actual.
- **Secciones válidas** (claves de la raíz): `clients`, `exercises`, `routines`, `routineTemplates`, `gyms`, `workoutLogs`, `nutritionLogs`, `progressLogs`, `settings`. Cualquier otra clave se ignora.
- `settings` (apariencia, unidades, músculos propios): **no la incluyas** salvo que la persona lo pida expresamente.

## A4. Convenciones de tipos (aplican a TODO)

| Tipo | Regla | Correcto | Incorrecto |
|---|---|---|---|
| Fecha | `"AAAA-MM-DD"` o `""` | `"2026-03-21"` | `"21/03/2026"`, `"21 de marzo"` |
| Hora | `"HH:MM"` 24 h o `""` | `"07:30"` | `"7:30 AM"` |
| Peso | Número JSON **en kg**, punto decimal | `82.5` | `"82,5 kg"`, `"180 lb"` |
| Medidas | Número en **cm** o `null` | `98.5` | `"98 cm"` |
| Cantidad / reps | Número entero ≥ 0 (reps de rutina: texto, ver A6.4) | `10` | `"10 reps"` |
| Booleano | `true` / `false` reales | `true` | `"Sí"`, `1` |
| Texto vacío | `""` | `""` | `null`, `"N/A"` |

- **Fechas del origen:** formato mexicano DD/MM/AAAA. Serial de Excel → días desde 1899-12-30. Sin año o ambigua → `""` y anótalo.
- **Libras → kg:** `kg = lb × 0.45359237`, redondeado a 2 decimales. Si el origen está en libras, convierte **cada** peso y anótalo en `_notas_conversion`. En rutinas, pon además `"targetWeightUnit": "lb"` para que se *muestre* en libras (el valor guardado sigue en kg).
- **Peso corporal en medidas:** si el origen trae peso en lb, conviértelo a kg igual.
- Celdas con fórmulas: usa el valor calculado. Celdas solo con espacios = vacío.

## A5. IDs y relaciones

### IDs deterministas

Los `id` deben ser **estables**: la misma fila convertida dos veces debe dar el mismo id (así *Combinar* actualiza en vez de duplicar). `slug(texto)` = minúsculas, sin acentos (á→a, ñ→n), todo lo que no sea letra o número → `-`, sin guiones al inicio ni al final, máximo 40 caracteres. Si hay colisión, agrega `-2`, `-3`.

| Entidad | Formato de id | Ejemplo |
|---|---|---|
| Cliente | `cli-<slug(nombre)>` | `cli-ana-torres` |
| Ejercicio | `exe-<slug(nombre)>` | `exe-press-de-banca-con-barra` |
| Rutina | `rut-<slug(cliente)>-<slug(nombre rutina)>` | `rut-ana-torres-fuerza-4-dias` |
| Día de rutina | `day-<slug(rutina)>-<slug(nombre día)>` | `day-fuerza-4-dias-torso-a` |
| Plantilla | `plt-<slug(nombre)>` | `plt-full-body-ab` |
| Gimnasio | `gym-<slug(nombre)>` | `gym-smart-fit-centro` |
| Entrenamiento | `log-<fecha>-<slug(cliente)>-<slug(día)>` | `log-2026-03-21-ana-torres-torso-a` |
| Alimentación | `nut-<slug(cliente)>-<fecha>` | `nut-ana-torres-2026-03-21` |
| Progreso | `pro-<slug(cliente)>-<fecha>` | `pro-ana-torres-2026-03-21` |

### Referencias (deben apuntar a ids que existan en el mismo JSON, o a datos que la persona confirme que ya existen en la app)

| Campo | Apunta a |
|---|---|
| `routines[].clientId`, `workoutLogs[].clientId`, `nutritionLogs[].clientId`, `progressLogs[].clientId` | `clients[].id` |
| `routines[].days[].exercises[].exerciseId`, `workoutLogs[].entries[].exerciseId`, `gyms[].exerciseIds[]` | `exercises[].id` |
| `workoutLogs[].routineId` y `dayId` | `routines[].id` y `routines[].days[].id` |

### Clientes que ya existen en la app

Los clientes creados en la app tienen ids aleatorios (p. ej. `cli_mk2x9a_f3d8qw`). Si el archivo es de un cliente que **ya existe**, la persona debe darte su id (en la petición de la Parte B). En ese caso **no crees** el cliente en `clients`; usa ese id en `clientId`. Si no te da el id, crea el cliente con `cli-<slug(nombre)>` y anótalo.

### Ejercicios: siempre inclúyelos

Toda rutina o entrenamiento referencia ejercicios. **Incluye en `exercises` cada ejercicio que uses**, con el **nombre exacto** del origen. Al importar, la app empareja por nombre con su biblioteca (si ya existe «Dominadas», no la duplica y redirige las referencias). Nunca uses un `exerciseId` que no esté en `exercises`.

## A6. Esquemas por sección

### A6.1 `clients`

| Campo | Tipo | Regla |
|---|---|---|
| `id`, `name` | texto | obligatorios |
| `goal` | texto | exactamente uno de: `"Pérdida de grasa"`, `"Ganancia muscular"`, `"Rendimiento deportivo"`, `"Salud general"`, `"Rehabilitación"`. Si no coincide o no hay → `""` y pon el original en `notes` |
| `email`, `phone` | texto | `""` si no hay |
| `birthdate`, `startDate` | fecha | `startDate` `""` si no hay |
| `height` | número cm o `null` | |
| `targetCalories` | número kcal o `null` | meta diaria |
| `notes` | texto | lesiones, preferencias, disponibilidad |

No incluyas `beforePhoto`, `afterPhoto` ni `volumeTargets`.

### A6.2 `exercises`

| Campo | Tipo | Regla |
|---|---|---|
| `id`, `name` | texto | obligatorios |
| `muscles` | lista de ids | **obligatorio, al menos 1** (músculo principal). Ver lista abajo |
| `secondary` | lista de ids | músculos secundarios; `[]` si no hay; sin repetir los de `muscles` |
| `equipment` | texto | exactamente uno de: `"Peso corporal"`, `"Mancuernas"`, `"Barra"`, `"Máquina"`, `"Polea"`, `"Bandas"`, `"Disco o mancuerna"`, `"Kettlebell"` |
| `difficulty` | texto | `"principiante"`, `"intermedio"` o `"avanzado"` (por defecto `"intermedio"`) |
| `mechanic` | texto | `"compuesto"` (varias articulaciones) o `"aislamiento"` (una articulación) |
| `description`, `tips`, `videoUrl` | texto | `""` si no hay |
| `unilateral` | booleano | un lado a la vez |
| `measureByTime` | booleano | se mide en segundos (planchas, isométricos) |
| `trackPR` | booleano | `true` por defecto; `false` en `measureByTime` |
| `custom` | booleano | siempre `true` |
| `media` | texto | siempre `""` |

**Ids de músculo permitidos (usa solo estos):** `hombro-frontal`, `hombro-lateral`, `hombro-posterior`, `pecho`, `biceps`, `triceps`, `antebrazo`, `espalda` (dorsales), `trapecio`, `abdomen`, `oblicuos`, `espalda-baja`, `cuadriceps`, `isquiotibiales`, `gluteos`, `pantorrillas`. Si el origen dice «Dorsal» → `espalda`; «Core» → `abdomen`; «Hombro» sin más detalle → `hombro-lateral`; «Pierna» sin más → `cuadriceps`. Anota cada equivalencia dudosa.

**Equipo no listado** (p. ej. «TRX», «Paralelas»): elige el más cercano o `"Peso corporal"` y anótalo.

### A6.3 `gyms`

`id`, `name` (obligatorio), `notes` (texto), `exerciseIds` (lista de ids de `exercises`, `[]` si no se sabe).

### A6.4 `routines` (rutinas de un cliente)

| Campo | Tipo | Regla |
|---|---|---|
| `id`, `clientId`, `name` | texto | obligatorios |
| `notes` | texto | |
| `targetWeightUnit` | texto | `"kg"` o `"lb"` (solo cómo se muestra; los pesos siguen en kg) |
| `days` | lista | **obligatoria**, al menos 1 día |

Cada **día**: `{ "id", "name", "exercises": [ ... ] }` (`exercises` es obligatorio aunque esté vacío).

Cada **ejercicio del día**:

| Campo | Tipo | Regla |
|---|---|---|
| `exerciseId` | texto | id de `exercises` |
| `targetSets` | lista | una entrada por serie planeada |
| `tempo` | texto (opcional) | solo si el origen lo trae, formato `"3-1-1"` o `"3-1-1-0"`; si no, omite el campo |
| `restSeconds` | número (opcional) | descanso en segundos; omítelo si no hay |

Cada **serie meta** (`targetSets[]`):

| Campo | Tipo | Regla |
|---|---|---|
| `reps` | **texto** | `"8-12"`, `"10"`. Ejercicios `measureByTime`: usa `time` (número, segundos) en vez de `reps` |
| `weight` | número kg o `""` | peso meta |
| `rir` | número 0-10 o `""` | repeticiones en reserva |
| `side` | texto | `"ambos"` (por defecto), `"izq"` o `"der"` |

«3 × 10» → 3 series con `reps: "10"`. «4×8-12 @ 60 kg» → 4 series con `reps:"8-12"`, `weight:60`.
En ejercicios de **Peso corporal**, `weight` es el **extra** (lastre); `""` o `0` = solo el cuerpo.

### A6.5 `routineTemplates`

Igual que `routines` pero **sin `clientId`**, con `name` y `description` (texto). Inclúyela solo si la persona pide expresamente «plantillas».

### A6.6 `workoutLogs` (entrenamientos ya realizados)

| Campo | Tipo | Regla |
|---|---|---|
| `id` | texto | ver A5 |
| `clientId`, `routineId`, `dayId` | texto | deben existir en el JSON (o confirmados por la persona) |
| `date` | fecha | obligatoria |
| `minutes` | número o `""` | duración total |
| `entries` | lista | **obligatoria** |

Cada **entrada**: `{ "exerciseId": "...", "sets": [ ... ] }` con `sets` obligatorio. Incluye solo series realmente hechas (con peso y reps; o `time` en ejercicios por tiempo).

Cada **serie hecha**:

| Campo | Tipo | Regla |
|---|---|---|
| `weight` | número kg | carga usada (`0` si fue solo el cuerpo y no hay peso corporal) |
| `reps` | número | repeticiones hechas |
| `rir` | número o `""` | |
| `rpe` | número 1-10 o `""` | |
| `side` | texto | `"ambos"`, `"izq"`, `"der"` |
| `unilateral` | booleano | `true` solo si el ejercicio es unilateral **y** `side` es `"ambos"` (volumen doble); en los demás casos `false` |

**Ejercicio por tiempo:** `{ "time": 45, "weight": 0, "reps": "", "rir": "", "rpe": "", "side": "ambos" }`.

**Ejercicio de Peso corporal:** agrega `extra` (lastre en kg, `0` si ninguno) y `bw` (peso corporal en kg ese día, `0` si no se sabe) y pon `weight = bw + extra`.

Reglas: un solo registro por cliente + rutina + día + fecha. Si el origen trae un entrenamiento que no corresponde a ninguna rutina, **crea una rutina mínima** (`rut-<cliente>-registro-libre` con un día `Sesión libre`) con los ejercicios usados, y anótalo.

### A6.7 `nutritionLogs`

| Campo | Tipo | Regla |
|---|---|---|
| `id`, `clientId`, `date` | | obligatorios; un registro por cliente y fecha |
| `waterMl` | número | `0` si no hay |
| `meals` | lista | **obligatoria** |

Cada **comida**: `{ "name": "Desayuno", "time": "08:00", "items": [ { "food": "Huevos revueltos", "kcal": 220, "protein": 14, "carbs": 2, "fat": 17 } ] }`.
`items` es obligatorio; `food` texto; `kcal`, `protein`, `carbs`, `fat` números (gramos en los macros) o `""` si el origen no los trae. No calcules macros por tu cuenta.

### A6.8 `progressLogs`

| Campo | Tipo | Regla |
|---|---|---|
| `id`, `clientId`, `date` | | obligatorios |
| `weight` | número kg | peso corporal (obligatorio en la app; sin dato → no crees el registro) |
| `bodyFatPct` | número o `null` | % de grasa |
| `measurements` | objeto | claves `chest`, `waist`, `hips`, `bicep`, `thigh`, `calf` (pecho, cintura, cadera, brazo, muslo, pantorrilla) en **cm**; `null` donde no hay dato. Incluye las 6 claves |
| `notes` | texto | |
| `photo` | — | no incluir |

## A7. Mapeo desde archivos libres

Sinónimos frecuentes:

| Campo destino | Encabezados típicos |
|---|---|
| `clients.name` | Cliente, Nombre, Alumno, Atleta |
| `clients.goal` | Objetivo, Meta, Fin |
| `clients.targetCalories` | Calorías, Kcal objetivo, Meta calórica |
| `exercises.name` | Ejercicio, Movimiento |
| `exercises.muscles` | Músculo, Grupo muscular, Zona |
| `exercises.equipment` | Equipo, Material, Máquina |
| `targetSets.reps` | Reps, Repeticiones, Rango |
| `targetSets.weight` / `weight` | Peso, Carga, Kg, Lb |
| `targetSets.rir` / `rir` | RIR, Reserva |
| `rpe` | RPE, Esfuerzo |
| `progressLogs.weight` | Peso corporal, Báscula |
| `progressLogs.bodyFatPct` | % grasa, Grasa corporal |

Reglas para formatos difíciles:

- **PDF o imagen escaneada:** lee con OCR; si un dato es ilegible o dudoso → vacío y anótalo. Nunca adivines cifras.
- **Tablas partidas en varias páginas:** únelas; ignora encabezados repetidos y filas de totales o promedios.
- **Filas vacías, numeradas sin datos, de ejemplo o de relleno de plantilla** (`Ejemplo:`, `#ND`): ignóralas y anótalo.
- **Una celda con varias series** («3x10 con 40 kg»): expándelas a series individuales.
- **Series con pesos distintos** («10×40, 8×45, 6×50»): una serie por cada par.
- **Texto narrativo** (Word, notas): extrae solo hechos explícitos (fechas, pesos, reps, nombres).
- **Hojas sin relación con EJERCILUCAS:** ignóralas y anótalo.
- **Fechas con alternativas o estimadas:** `""` y anótalo; nunca elijas una opción.
- **Varios archivos del mismo cliente:** entrega un solo JSON unificado; une los registros que sean la misma entidad aunque cambie la escritura (misma persona, mismo ejercicio) con un solo id. Si hay contradicciones, usa el dato más específico o reciente y anótalo.

## A8. Procedimiento obligatorio

1. Inventario del archivo: hojas o secciones, columnas y número de filas.
2. Decide qué secciones de A3 contiene realmente (regla A2.3).
3. Crea `clients` (si aplica) y `exercises` primero, para tener ids que referenciar.
4. Genera los `id` con las fórmulas de A5, sin colisiones.
5. Convierte fila por fila aplicando A4 (**pesos a kg**, fechas ISO). Cada fila útil debe aparecer en el JSON; las omitidas se listan en `_notas_conversion` con su motivo.
6. Resuelve las referencias (A5) y confirma que no queda ningún id inexistente.
7. Ejecuta la validación de A9.
8. Entrega solo el JSON.

## A9. Validación final (mentalmente, antes de responder)

- [ ] ¿Es JSON parseable (sin comas finales, sin comentarios, sin ```)?
- [ ] `_meta.app` = `"pulso"`, `version` = 1; `_meta.sections` = secciones presentes.
- [ ] ¿Ninguna sección vacía «de relleno»? ¿`settings` omitida?
- [ ] Todos los `id` son únicos dentro de su sección.
- [ ] Cada `clientId`, `exerciseId`, `routineId`, `dayId` apunta a un id existente.
- [ ] Todo ejercicio usado en rutinas/entrenamientos está en `exercises` con su nombre exacto.
- [ ] `exercises[].muscles` no está vacío y solo usa los ids permitidos; `equipment` y `difficulty` son valores válidos.
- [ ] Cada rutina tiene `days` (lista) y cada día tiene `exercises` (lista).
- [ ] Cada `workoutLog` tiene `date` y `entries[].sets` como lista; sin series vacías.
- [ ] Todas las fechas `AAAA-MM-DD`, horas `HH:MM`.
- [ ] **Todos los pesos están en kg.** Dinero/cantidades/medidas son números JSON; booleanos `true`/`false`.
- [ ] `reps` en `targetSets` es texto; `reps` en `workoutLogs` es número.
- [ ] Ninguna imagen ni base64; ningún dato «verosímil» inventado.
- [ ] Ninguna fila de ejemplo, total o plantilla se convirtió en registro.
- [ ] Conteos: filas del origen = elementos del JSON + filas omitidas anotadas en `_notas_conversion`.

## A10. Archivos muy grandes

Si no cabe en una sola respuesta, entrega varios JSON, cada uno con el envoltorio completo y un subconjunto de secciones (archivo 1: `clients`, `exercises`, `gyms`; archivo 2: `routines`; archivo 3: `workoutLogs`; archivo 4: `nutritionLogs`, `progressLogs`). Los ids deterministas hacen que las partes sean coherentes. Se importan todas en modo **Combinar**, en ese orden. Cada archivo es solo JSON, sin texto alrededor.

## A11. Ejemplo completo y válido

```json
{
  "_meta": {
    "app": "pulso",
    "version": 1,
    "exportedAt": "2026-10-13T12:00:00.000Z",
    "sections": ["clients", "exercises", "routines", "workoutLogs", "progressLogs"],
    "photos": false
  },
  "clients": [
    {
      "id": "cli-ana-torres",
      "name": "Ana Torres",
      "goal": "Ganancia muscular",
      "email": "ana@ejemplo.com",
      "phone": "55-1234-5678",
      "birthdate": "1995-06-14",
      "height": 165,
      "startDate": "2026-03-01",
      "targetCalories": 2200,
      "notes": "Molestia leve en hombro izquierdo"
    }
  ],
  "exercises": [
    {
      "id": "exe-press-de-banca-con-barra",
      "name": "Press de banca con barra",
      "muscles": ["pecho"],
      "secondary": ["triceps", "hombro-frontal"],
      "equipment": "Barra",
      "difficulty": "intermedio",
      "mechanic": "compuesto",
      "description": "",
      "tips": "",
      "videoUrl": "",
      "unilateral": false,
      "measureByTime": false,
      "trackPR": true,
      "custom": true,
      "media": ""
    },
    {
      "id": "exe-plancha",
      "name": "Plancha",
      "muscles": ["abdomen"],
      "secondary": ["oblicuos"],
      "equipment": "Peso corporal",
      "difficulty": "principiante",
      "mechanic": "aislamiento",
      "description": "",
      "tips": "",
      "videoUrl": "",
      "unilateral": false,
      "measureByTime": true,
      "trackPR": false,
      "custom": true,
      "media": ""
    }
  ],
  "routines": [
    {
      "id": "rut-ana-torres-fuerza-2-dias",
      "clientId": "cli-ana-torres",
      "name": "Fuerza 2 días",
      "notes": "",
      "targetWeightUnit": "kg",
      "days": [
        {
          "id": "day-fuerza-2-dias-torso",
          "name": "Torso",
          "exercises": [
            {
              "exerciseId": "exe-press-de-banca-con-barra",
              "tempo": "3-1-1",
              "restSeconds": 150,
              "targetSets": [
                { "reps": "6-10", "weight": 40, "rir": 2, "side": "ambos" },
                { "reps": "6-10", "weight": 40, "rir": 2, "side": "ambos" },
                { "reps": "6-10", "weight": 40, "rir": 1, "side": "ambos" }
              ]
            },
            {
              "exerciseId": "exe-plancha",
              "targetSets": [
                { "time": 45, "weight": "", "rir": "", "side": "ambos" }
              ]
            }
          ]
        }
      ]
    }
  ],
  "workoutLogs": [
    {
      "id": "log-2026-03-21-ana-torres-torso",
      "clientId": "cli-ana-torres",
      "routineId": "rut-ana-torres-fuerza-2-dias",
      "dayId": "day-fuerza-2-dias-torso",
      "date": "2026-03-21",
      "minutes": 55,
      "entries": [
        {
          "exerciseId": "exe-press-de-banca-con-barra",
          "sets": [
            { "weight": 40, "reps": 10, "rir": 2, "rpe": 8, "side": "ambos", "unilateral": false },
            { "weight": 40, "reps": 9, "rir": 2, "rpe": 8, "side": "ambos", "unilateral": false },
            { "weight": 42.5, "reps": 7, "rir": 1, "rpe": 9, "side": "ambos", "unilateral": false }
          ]
        },
        {
          "exerciseId": "exe-plancha",
          "sets": [
            { "time": 45, "weight": 0, "reps": "", "rir": "", "rpe": "", "side": "ambos", "unilateral": false }
          ]
        }
      ]
    }
  ],
  "progressLogs": [
    {
      "id": "pro-ana-torres-2026-03-21",
      "clientId": "cli-ana-torres",
      "date": "2026-03-21",
      "weight": 62.4,
      "bodyFatPct": 24.5,
      "measurements": { "chest": 90, "waist": 70, "hips": 96, "bicep": 28, "thigh": 55, "calf": 36 },
      "notes": ""
    }
  ],
  "_notas_conversion": [
    "Pesos convertidos de lb a kg (x 0.45359237).",
    "Fila 14 omitida: ejemplo de plantilla."
  ]
}
```

## A12. Errores frecuentes (evítalos)

| Error | Consecuencia | Correcto |
|---|---|---|
| Pesos en libras sin convertir | Cargas, volumen y 1RM mal calculados | Convertir a kg siempre |
| `"pagado": "Sí"`, `"hecho": 1` u otros booleanos como texto | Valores incorrectos | `true` / `false` |
| IDs aleatorios o con marca de tiempo | Al reimportar se duplica todo | IDs deterministas (A5) |
| `"workoutLogs": []` sin datos de origen | En *Reemplazar* borra los entrenamientos existentes | Omitir la sección |
| Poner las secciones dentro de `"datos"` | La app no reconoce ninguna sección | Secciones en la raíz |
| `exerciseId` sin el ejercicio en `exercises` | Ejercicio «(eliminado)» | Incluir siempre el ejercicio |
| Músculos con nombre («Pecho») o ids inventados | El ejercicio no aparece en filtros ni volumen | Solo los ids de A6.2 |
| `muscles: []` | El registro se descarta | Al menos un músculo |
| Rutina sin `days` o día sin `exercises` | El registro se descarta | Siempre listas |
| `reps` numérico en `targetSets` | Pierde el formato de rango | Texto: `"8-12"` |
| `reps` como texto en `workoutLogs` | Cálculos de volumen incorrectos | Número |
| Series vacías en `workoutLogs` | Ruido y volumen falso | Solo series hechas |
| `clientId` con el nombre en vez del id | Registros «huérfanos» sin cliente | Id del cliente |
| Imágenes en base64 inventadas | JSON enorme, almacenamiento lleno | No incluir |
| Texto o ``` alrededor del JSON | La importación falla | Solo el objeto JSON |

---

# PARTE B. Plantilla de petición (la persona la envía junto con el archivo)

> Sigue el «Instructivo para la IA» (Parte A) al pie de la letra. Convierte el archivo adjunto en un único JSON importable en EJERCILUCAS.
> **Contenido del archivo:** [describe: rutina / registro de entrenamientos / dieta / medidas y peso / lista de ejercicios / gimnasios…].
> **Cliente:** [nombre]. **¿Ya existe en la app?** [No / Sí, su id es: ______ ].
> **Unidad de peso del archivo:** [kg / lb].
> **Fecha de referencia** (si el archivo no la trae): [AAAA-MM-DD o «no sé»].
> Si algo es ambiguo, déjalo vacío y anótalo en `_notas_conversion`. Responde solo con el JSON.

---

# PARTE C. Cómo importarlo (para la persona)

1. Guarda la respuesta de la IA como un archivo `.json` (por ejemplo `ana-torres.json`).
2. En la app: **Ajustes → 📥 Importar datos…** y elige el archivo.
3. Marca las secciones que quieres aplicar y elige el modo:
   - **Combinar** (recomendado): agrega lo nuevo y actualiza lo que tenga el mismo id; no borra nada.
   - **Reemplazar**: borra la sección actual y deja exactamente la del archivo.
4. Deja marcada la casilla de descargar un respaldo antes de importar.
5. Si hay varios archivos, impórtalos en este orden: clientes/ejercicios → rutinas → entrenamientos → alimentación y progreso.
