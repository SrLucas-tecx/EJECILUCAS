/* ==========================================================================
   CHARTS — opciones base de Chart.js compartidas por nutrición y progreso
   ========================================================================== */

const Charts = (() => {

  function gridColor() {
    return getComputedStyle(document.body).getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,.08)';
  }
  function textColor() {
    return getComputedStyle(document.body).getPropertyValue('--color-text-muted').trim() || '#93A0B4';
  }

  function baseOptions(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false, labels: { color: textColor() } },
        tooltip: { backgroundColor: '#1B1F27', titleColor: '#EEF0F3', bodyColor: '#EEF0F3', borderColor: gridColor(), borderWidth: 1 }
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: gridColor() }, ticks: { color: textColor(), font: { family: 'Inter', size: 11 } }, beginAtZero: true }
      },
      ...extra
    };
  }

  function lineOptions(extra = {}) { return baseOptions({ elements: { line: { tension: 0.35 } }, ...extra }); }

  return { baseOptions, lineOptions };
})();
