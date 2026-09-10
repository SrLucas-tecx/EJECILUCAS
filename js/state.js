/* ==========================================================================
   STATE — estado de UI en memoria (no persistido salvo el cliente activo,
   que sí se guarda en la base de datos vía Storage).
   ========================================================================== */

const State = (() => {

  const listeners = {};

  const s = {
    activeTab: 'dashboard',
    activeClientId: null,
    exerciseFilter: { muscle: null, equipment: null, search: '' },
    progressRange: 6 // meses a mostrar en gráficas
  };

  function on(event, cb) {
    (listeners[event] = listeners[event] || []).push(cb);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(cb => cb(payload));
  }

  function setActiveClient(id) {
    s.activeClientId = id;
    Storage.get().activeClientId = id;
    Storage.save();
    emit('client:changed', id);
  }

  function getActiveClient() {
    return s.activeClientId ? Storage.find('clients', s.activeClientId) : null;
  }

  function setTab(tab) {
    s.activeTab = tab;
    emit('tab:changed', tab);
  }

  function init() {
    s.activeClientId = Storage.get().activeClientId || (Storage.all('clients')[0]?.id ?? null);
  }

  return { s, on, emit, setActiveClient, getActiveClient, setTab, init };
})();
