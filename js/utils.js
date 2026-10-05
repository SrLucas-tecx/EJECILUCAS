/* ==========================================================================
   UTILS — funciones puras compartidas por todos los módulos
   ========================================================================== */

const Utils = (() => {

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // Fecha LOCAL en formato YYYY-MM-DD.
  // (toISOString() da la fecha en UTC: en zonas horarias al oeste de UTC, por la tarde/noche
  //  devolvía el día siguiente.)
  function toISODate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function formatDate(iso, opts = {}) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    const { withYear = true, short = false } = opts;
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (short) return `${d.getDate()} ${meses[d.getMonth()]}`;
    return `${d.getDate()} ${meses[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
  }

  function monthLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  }

  function monthKey(iso) {
    return iso.slice(0, 7); // YYYY-MM
  }

  function age(birthISO) {
    if (!birthISO) return null;
    const b = new Date(birthISO + 'T00:00:00');
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }

  function initials(name = '') {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function round(n, decimals = 1) {
    const f = 10 ** decimals;
    return Math.round((n + Number.EPSILON) * f) / f;
  }

  /* ---------------- Fórmulas de entrenamiento ---------------- */

  // 1RM estimado — fórmula de Epley: peso × (1 + reps/30)
  function estimate1RM(weight, reps) {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    return round(weight * (1 + reps / 30), 1);
  }

  // Volumen de una serie: peso × reps. Una serie unilateral trabajó los dos lados
  // (el peso registrado es por lado), así que su volumen cuenta doble.
  function setVolume(weight, reps, unilateral) {
    return (Number(weight) || 0) * (Number(reps) || 0) * (unilateral ? 2 : 1);
  }

  // Volumen total de un conjunto de series [{weight,reps,unilateral}]
  function totalVolume(sets = []) {
    return round(sets.reduce((sum, s) => sum + setVolume(s.weight, s.reps, s.unilateral), 0), 1);
  }

  // Inversa de Epley: peso aproximado con el que podrías hacer `reps` repeticiones,
  // dado un 1RM (estimado o real). Sirve para armar una tabla de PR aproximados.
  function repMaxFromOneRM(oneRM, reps) {
    if (!oneRM || !reps) return 0;
    if (reps === 1) return round(oneRM, 1);
    return round(oneRM / (1 + reps / 30), 1);
  }

  // Serie "efectiva" para hipertrofia: RPE >= 7 o RIR <= 3
  function isEffectiveSet(s) {
    if (s.rpe != null && s.rpe !== '') return Number(s.rpe) >= 7;
    if (s.rir != null && s.rir !== '') return Number(s.rir) <= 3;
    return false;
  }

  function effectiveSets(sets = []) {
    return sets.filter(isEffectiveSet).length;
  }

  // Densidad de entrenamiento: volumen / minutos
  function density(volume, minutes) {
    if (!minutes) return 0;
    return round(volume / minutes, 1);
  }

  // Convierte RIR <-> RPE aproximado (escala 0-10, techo en 10)
  function rirToRpe(rir) {
    if (rir == null || rir === '') return '';
    return clamp(10 - Number(rir), 1, 10);
  }

  /* ---------------- Unidades (kg / lb) ----------------
     Todo se guarda SIEMPRE en kilos internamente; estas funciones solo
     convierten para mostrar en pantalla o para leer lo que el usuario
     tecleó, según la preferencia guardada en Ajustes. */

  function currentUnit() {
    try { return Storage.get()?.settings?.units || 'kg'; } catch (e) { return 'kg'; }
  }
  function kgToLb(kg) { return kg * 2.20462; }
  function lbToKg(lb) { return lb / 2.20462; }
  // kg guardado -> valor a mostrar en el input/etiqueta, en la unidad activa
  function toUnit(kg) {
    if (kg === '' || kg == null || isNaN(kg)) return '';
    return currentUnit() === 'lb' ? round(kgToLb(Number(kg)), 1) : round(Number(kg), 1);
  }
  // valor tecleado por el usuario (en la unidad activa) -> kg para guardar
  function fromUnit(val) {
    if (val === '' || val == null || isNaN(val)) return '';
    return currentUnit() === 'lb' ? round(lbToKg(Number(val)), 2) : round(Number(val), 2);
  }
  function unitLabel() { return currentUnit(); }

  function escapeHtml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // Exporta a un .xlsx real (columnas nativas de Excel, no CSV separado por comas).
  // sheets = { 'Nombre de hoja': [ {col1: val, col2: val}, ... ] }
  function exportExcel(filename, sheets) {
    if (!window.XLSX) { toast('No se pudo cargar el generador de Excel (revisa tu conexión a internet)', 'danger'); return; }
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows && rows.length ? rows : [{ Info: 'Sin datos todavía' }]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    });
    XLSX.writeFile(wb, filename);
  }

  function download(filename, content, mime = 'application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function toast(msg, type = 'info') {
    const host = document.getElementById('toast-host');
    if (!host) { console.log(`[${type}] ${msg}`); return; }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  return {
    uid, toISODate, todayISO, formatDate, monthLabel, monthKey, age, initials, clamp, round,
    estimate1RM, repMaxFromOneRM, setVolume, totalVolume, isEffectiveSet, effectiveSets, density, rirToRpe,
    currentUnit, kgToLb, lbToKg, toUnit, fromUnit, unitLabel,
    escapeHtml, debounce, download, exportExcel, toast
  };
})();
