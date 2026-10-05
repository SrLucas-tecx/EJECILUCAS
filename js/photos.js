/* ==========================================================================
   PHOTOS — compresión de imágenes y control del espacio en localStorage
   Las fotos se guardan como base64 dentro de la base de datos, y localStorage
   solo tiene ~5 MB. Aquí se reducen antes de guardarlas y se mide el espacio.
   ========================================================================== */

const Photos = (() => {

  const MAX_INPUT_BYTES = 15 * 1024 * 1024;   // archivo original máximo que se acepta
  const MAX_GIF_BYTES = 2 * 1024 * 1024;      // los GIF no se comprimen (perderían la animación)
  const CAPACITY = 5000000;                   // ~caracteres que caben en localStorage
  const WARN_LEVEL = 0.85;                    // avisar al pasar de este porcentaje

  const PRESETS = {
    photo:    { maxSide: 1000, quality: 0.75 },   // antes/después y progreso
    exercise: { maxSide: 800,  quality: 0.78 }    // foto del ejercicio
  };

  // Dónde viven las fotos dentro de la base de datos
  const FIELDS = {
    clients: ['beforePhoto', 'afterPhoto'],
    progressLogs: ['photo'],
    exercises: ['media']
  };

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('No se pudo leer el archivo'));
      r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = src;
    });
  }

  // dataURL -> dataURL JPEG reducido (el lado más largo queda en maxSide como máximo)
  async function shrink(src, opts = {}) {
    const { maxSide, quality } = { ...PRESETS.photo, ...opts };
    const img = await loadImage(src);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';            // JPEG no tiene transparencia
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  // Archivo de un <input type=file> -> dataURL listo para guardar.
  // Rechaza con un Error cuyo mensaje se puede mostrar tal cual en un toast.
  async function fromFile(file, opts = PRESETS.photo) {
    if (!file) return null;
    if (!file.type || !file.type.startsWith('image/')) throw new Error('El archivo no es una imagen');
    if (file.size > MAX_INPUT_BYTES) throw new Error('La imagen es demasiado grande (máx. 15 MB)');
    const original = await readAsDataURL(file);
    if (file.type === 'image/gif') {
      if (file.size > MAX_GIF_BYTES) throw new Error('El GIF pesa demasiado (máx. ~2 MB)');
      return original;
    }
    const small = await shrink(original, opts);
    return small.length < original.length ? small : original;   // nunca dejarla más pesada
  }

  /* ---------------- Uso de espacio ---------------- */

  function usage() {
    const db = Storage.get();
    const total = JSON.stringify(db).length;
    let photoChars = 0, count = 0;
    Object.entries(FIELDS).forEach(([col, fields]) => {
      (db[col] || []).forEach(r => fields.forEach(f => {
        if (typeof r[f] === 'string' && r[f]) { photoChars += r[f].length; count++; }
      }));
    });
    return { total, photoChars, count, capacity: CAPACITY, pct: Math.min(100, Math.round(total / CAPACITY * 100)) };
  }

  function formatSize(chars) {
    return chars < 1024 * 1024 ? `${Math.round(chars / 1024)} KB` : `${(chars / 1048576).toFixed(1)} MB`;
  }

  /* ---------------- Optimizar lo que ya está guardado ---------------- */

  // Recomprime las fotos existentes que pesen más de ~150 KB. Los GIF no se tocan.
  async function optimizeStored(onProgress) {
    const db = Storage.get();
    const jobs = [];
    Object.entries(FIELDS).forEach(([col, fields]) => (db[col] || []).forEach(r => fields.forEach(f => {
      const v = r[f];
      if (typeof v === 'string' && v.startsWith('data:image/') && !v.startsWith('data:image/gif') && v.length > 150000) {
        jobs.push({ r, f, preset: col === 'exercises' ? PRESETS.exercise : PRESETS.photo });
      }
    })));

    let saved = 0, done = 0, failed = 0;
    for (const j of jobs) {
      try {
        const before = j.r[j.f];
        const small = await shrink(before, j.preset);
        if (small.length < before.length * 0.9) { saved += before.length - small.length; j.r[j.f] = small; }
      } catch (e) {
        failed++;
        console.warn('No se pudo optimizar una foto', e);
      }
      done++;
      if (onProgress) onProgress(done, jobs.length);
    }
    if (saved) Storage.save();
    return { processed: jobs.length, saved, failed };
  }

  return { PRESETS, FIELDS, CAPACITY, WARN_LEVEL, fromFile, shrink, usage, formatSize, optimizeStored };
})();
