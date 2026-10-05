/* ==========================================================================
   APP — punto de entrada: carga la base de datos y conecta la interfaz
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  Storage.load();
  State.init();
  UI.initModal();

  // Modo oscuro según lo guardado
  UI.setDarkMode(Storage.get().settings.darkMode);

  // Navegación del sidebar
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => UI.switchTab(btn.dataset.tab));
  });

  // Selector de cliente activo (equivalente al selector de bazar activo)
  document.getElementById('client-select-global').addEventListener('change', e => {
    Clients.switchClient(e.target.value);
  });
  document.getElementById('btn-new-client-header').addEventListener('click', () => Clients.createClient());
  document.getElementById('btn-glossary').addEventListener('click', () => UI.openGlossary());

  // Botón hamburguesa (móvil)
  document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
    document.querySelector('.app-layout').classList.toggle('sidebar-open');
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', () => {
    document.querySelector('.app-layout').classList.remove('sidebar-open');
  });

  // Menú de respaldo rápido desde el pie del sidebar
  const backupBtn = document.getElementById('backup-menu-btn');
  const backupMenu = document.getElementById('backup-menu');
  backupBtn.addEventListener('click', e => { e.stopPropagation(); backupMenu.classList.toggle('open'); });
  document.addEventListener('click', () => backupMenu.classList.remove('open'));
  document.getElementById('backup-export-quick').addEventListener('click', () => {
    Utils.download(`ejercilucas-respaldo-${Utils.todayISO()}.json`, Storage.exportJSON());
    Backup.markDone();
    UI.renderCurrentTab();
    Utils.toast('Respaldo descargado', 'success');
  });
  document.getElementById('dark-toggle-btn').addEventListener('click', () => {
    UI.setDarkMode(!Storage.get().settings.darkMode);
  });

  // Estado inicial de la interfaz
  Clients.renderSwitcher();
  UI.refreshActiveClientBanner();
  UI.switchTab('dashboard');

  if (!Clients.all().length) {
    Utils.toast('Agrega tu primer cliente para comenzar', 'info');
  }
});
