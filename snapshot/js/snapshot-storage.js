// ============================================================================
// DATA PERSISTENCE & PAGE LIFECYCLE
// snapshot-storage.js
// ============================================================================

// Page refresh detection (consistent with PPA pattern)
window.addEventListener('beforeunload', () => {
  localStorage.setItem('spa_isLeaving', 'true');
});

function saveDataToStorage() {
  if (excelData) {
    localStorage.setItem(SNAPSHOT_STORAGE_KEYS.excelData, JSON.stringify(excelData));
  }
  
  if (laborData) {
    localStorage.setItem(SNAPSHOT_STORAGE_KEYS.laborData, JSON.stringify(laborData));
  }
  
  if (kpiResults) {
    localStorage.setItem(SNAPSHOT_STORAGE_KEYS.kpiResults, JSON.stringify(kpiResults));
  }
}

function loadSavedData() {
  try {
    // Load Excel data (stored as processed results)
    const savedExcel = localStorage.getItem(SNAPSHOT_STORAGE_KEYS.excelData);
    if (savedExcel) {
      const excelPackage = JSON.parse(savedExcel);
      excelData = excelPackage.excel || excelPackage;
      updateDataStatus('excel', 'Loaded ✅');
      console.log('Excel data restored from localStorage');
    }
    
    // Load Labor data
    const savedLabor = localStorage.getItem(SNAPSHOT_STORAGE_KEYS.laborData);
    if (savedLabor) {
      laborData = JSON.parse(savedLabor);
      updateDataStatus('labor', 'Loaded ✅');
      console.log('Labor data restored from localStorage');
    }
    
    // Load KPI results
    const savedKPIs = localStorage.getItem(SNAPSHOT_STORAGE_KEYS.kpiResults);
    if (savedKPIs) {
      kpiResults = JSON.parse(savedKPIs);
      displayKPIs();
      displayDetailedAnalysis();
      displayInsights();
      console.log('KPI results restored from localStorage');
    } else if (excelData || laborData) {
      // Recalculate KPIs if we have data but no saved results
      calculateKPIs();
    }
  } catch (error) {
    console.warn('Failed to restore snapshot data from localStorage:', error);
    clearAllData();
  }
}

function clearAllData() {
  // Clear localStorage
  Object.values(SNAPSHOT_STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Reset global variables
  excelData = null;
  laborData = null;
  kpiResults = null;
  
  // Reset UI
  updateDataStatus('excel', 'Not Loaded');
  updateDataStatus('labor', 'Not Loaded');
  
  const elementsToHide = ['kpiDashboard', 'analysisSection', 'actionButtons', 'fileInfo'];
  elementsToHide.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
  });
  
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
  
  console.log('All snapshot data cleared');
}

function handleSnapshotPageLoad() {
  const wasLeaving = localStorage.getItem('spa_isLeaving');
  
  if (!wasLeaving) {
    console.log('Page refresh detected - clearing snapshot data');
    clearAllData();
  } else {
    console.log('SPA navigation detected - loading saved snapshot data');
    loadSavedData();
  }
  
  localStorage.removeItem('spa_isLeaving');
}

function exportResults() {
  if (!kpiResults) {
    alert('No results to export. Please load and process data first.');
    return;
  }
  
  const exportData = {
    timestamp: new Date().toISOString(),
    kpiResults: kpiResults,
    summary: {
      laborLoaded: !!kpiResults.labor,
      excelLoaded: !!kpiResults.excel,
      combinedAnalysis: !!kpiResults.combined
    }
  };
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `inbound_snapshot_analysis_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}