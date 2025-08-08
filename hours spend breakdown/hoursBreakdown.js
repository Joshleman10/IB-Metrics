function createChart(breakdownTotals, canvasId, title, dataset = null) {
  try {
    const ctx = document.getElementById(canvasId);
    
    if (!ctx) {
      console.error(`Canvas element ${canvasId} not found`);
      return;
    }
    
    // Destroy existing chart
    if (dataset === 'A' && chartA) {
      chartA.destroy();
      chartA = null;
    } else if (dataset === 'B' && chartB) {
      chartB.destroy();
      chartB = null;
    } else if (!dataset && currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    const sortedGroups = Object.entries(breakdownTotals)
      .sort(([,a], [,b]) => b - a);

    const chartData = {
      labels: sortedGroups.map(([group]) => group),
      data: sortedGroups.map(([, hours]) => hours),
      backgroundColor: sortedGroups.map(([group]) => groupColors[group] || '#95a5a6')
    };

    // Check if Chart.js and plugins are properly loaded
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded');
      return;
    }

    const chartConfig = {
      type: "pie",
      data: {
        labels: chartData.labels,
        datasets: [{
          label: "Hours Breakdown",
          data: chartData.data,
          backgroundColor: chartData.backgroundColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { 
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const total = context.chart._metasets[0].total;
                const value = context.raw;
                const percent = ((value / total) * 100).toFixed(2);
                return `${context.label}: ${value.toFixed(2)} hrs (${percent}%)`;
              }
            }
          },
          title: {
            display: true,
            text: title,
            font: { size: 14 }
          }
        }
      }
    };

    // Only add datalabels plugin if it's available and working
    try {
      if (typeof ChartDataLabels !== 'undefined') {
        chartConfig.options.plugins.datalabels = {
          color: '#fff',
          font: { weight: 'bold', size: 10 },
          formatter: (value, context) => {
            const total = context.chart._metasets[0].total;
            const percent = ((value / total) * 100).toFixed(1);
            return percent > 3 ? `${percent}%` : '';
          }
        };
        chartConfig.plugins = [ChartDataLabels];
      }
    } catch (pluginError) {
      console.warn('ChartDataLabels plugin error, creating chart without labels:', pluginError);
    }

    const chart = new Chart(ctx, chartConfig);

    // Store chart reference
    if (dataset === 'A') {
      chartA = chart;
      console.log('Chart A created successfully');
    } else if (dataset === 'B') {
      chartB = chart;
      console.log('Chart B created successfully');
    } else {
      currentChart = chart;
      console.log('Main chart created successfully');
    }

  } catch (error) {
    console.error(`Error creating chart ${canvasId}:`, error);
  }
}

// Register Chart.js plugin
Chart.register(ChartDataLabels);

// Updated mapping to include all inbound labor functions
const trackedLabels = {
  "Putaway": [
    "Reach-Truck Putaway", 
    "Non- PIT Manual Putaway", 
    "Non-PIT Manual Putaway",
    "Putaway - Unknown"
  ],
  "Breakdown": [
    "Break Down Receiving", 
    "Breakdown Receiver"
  ],
  "Container Unload": [
    "Container Unload"
  ],
  "Heat Shrink": [
    "Heat Shrink"
  ],
  "VAS": [
    "VAS", 
    "VAS Execute"
  ],
  "Full Pallet Receiving": [
    "Full Pallet Receiving"
  ],
  "Unloader": [
    "Unloader"
  ],
  "Pallet Operations": [
    "Pallet Wrapper",
    "Pallet Wrangler – Dock Stocker IB"
  ],
  "Receiving": [
    "Receiving"
  ],
  "Support": [
    "Inbound Lead",
    "Problem Solver", 
    "Vendor Compliance"
  ],
  "Unallocated": [
    "On-Clock Unallocated"
  ]
};

const groupColors = {
  "Putaway": "#1e88e5",
  "Breakdown": "#43a047", 
  "Container Unload": "#fdd835",
  "Heat Shrink": "#fb8c00",
  "VAS": "#8e24aa",
  "Full Pallet Receiving": "#4caf50",
  "Unloader": "#546e7a",
  "Pallet Operations": "#795548",
  "Receiving": "#009688",
  "Support": "#ff9800",
  "Unallocated": "#e53935"
};

let currentChart = null;
let chartA = null;
let chartB = null;
let datasetA = null;
let datasetB = null;
let isComparisonMode = false;
let singleModeData = null;

// Storage keys for persistence
const STORAGE_KEYS = {
  singleData: 'hoursBreakdown_singleData',
  datasetA: 'hoursBreakdown_datasetA', 
  datasetB: 'hoursBreakdown_datasetB',
  mode: 'hoursBreakdown_mode',
  isLeaving: 'spa_isLeaving'
};

// Detect page refresh vs SPA navigation
window.addEventListener('beforeunload', () => {
  // Mark that we're navigating away normally
  localStorage.setItem(STORAGE_KEYS.isLeaving, 'true');
});

// Clear data on fresh page load (refresh)
function handlePageLoad() {
  const wasLeaving = localStorage.getItem(STORAGE_KEYS.isLeaving);
  
  if (!wasLeaving) {
    // This was a refresh, clear all data
    console.log('Page refresh detected - clearing all data');
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } else {
    // Normal SPA navigation, load saved data
    console.log('SPA navigation detected - loading saved data');
    loadFromStorage();
  }
  
  // Clear the leaving flag
  localStorage.removeItem(STORAGE_KEYS.isLeaving);
  updatePDFButtonVisibility();
}

// Save data to localStorage for persistence across SPA navigation
function saveToStorage() {
  try {
    if (singleModeData) {
      localStorage.setItem(STORAGE_KEYS.singleData, JSON.stringify(singleModeData));
    }
    if (datasetA) {
      localStorage.setItem(STORAGE_KEYS.datasetA, JSON.stringify(datasetA));
    }
    if (datasetB) {
      localStorage.setItem(STORAGE_KEYS.datasetB, JSON.stringify(datasetB));
    }
    localStorage.setItem(STORAGE_KEYS.mode, isComparisonMode ? 'comparison' : 'single');
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

// Load data from localStorage
function loadFromStorage() {
  try {
    const savedMode = localStorage.getItem(STORAGE_KEYS.mode);
    const savedSingleData = localStorage.getItem(STORAGE_KEYS.singleData);
    const savedDatasetA = localStorage.getItem(STORAGE_KEYS.datasetA);
    const savedDatasetB = localStorage.getItem(STORAGE_KEYS.datasetB);

    console.log('=== STORAGE LOADING DEBUG ===');
    console.log('Raw storage values:', { 
      savedMode, 
      savedSingleData: savedSingleData ? 'EXISTS' : 'NULL',
      savedDatasetA: savedDatasetA ? 'EXISTS' : 'NULL', 
      savedDatasetB: savedDatasetB ? 'EXISTS' : 'NULL'
    });

    // Parse and store the data in memory
    if (savedSingleData) {
      singleModeData = JSON.parse(savedSingleData);
      console.log('✓ singleModeData parsed successfully');
    }
    if (savedDatasetA) {
      datasetA = JSON.parse(savedDatasetA);
      console.log('✓ datasetA parsed:', { total: datasetA.total, keys: Object.keys(datasetA.totals) });
    }
    if (savedDatasetB) {
      datasetB = JSON.parse(savedDatasetB);
      console.log('✓ datasetB parsed:', { total: datasetB.total, keys: Object.keys(datasetB.totals) });
    }

    console.log('Memory state after parsing:', {
      hasSingleData: !!singleModeData,
      hasDatasetA: !!datasetA,
      hasDatasetB: !!datasetB
    });

    // Wait for DOM to be fully ready before restoring UI
    setTimeout(() => {
      if (savedMode === 'comparison' && (datasetA || datasetB)) {
        console.log('🔄 Starting comparison mode restoration...');
        setComparisonMode();
        
        // Wait for comparison mode to be fully set before restoring data
        setTimeout(() => {
          console.log('🔄 Starting dataset restoration...');
          
          if (datasetA && datasetB) {
            console.log('📊 Both datasets available - restoring both');
            restoreDatasetA().then(() => {
              console.log('✓ Dataset A restoration completed');
              return restoreDatasetB();
            }).then(() => {
              console.log('✓ Dataset B restoration completed');
              console.log('📈 Generating comparison analysis...');
              setTimeout(() => generateComparisonAnalysis(), 100);
            });
          } else if (datasetA) {
            console.log('📊 Only Dataset A available - restoring A only');
            restoreDatasetA();
          } else if (datasetB) {
            console.log('📊 Only Dataset B available - restoring B only');
            restoreDatasetB();
          }
        }, 300);
        
      } else if (singleModeData) {
        console.log('🔄 Restoring single mode');
        restoreSingleMode();
      }
    }, 100);
    
  } catch (e) {
    console.error('❌ Error loading from localStorage:', e);
  }
}

// Mode switching functions
function backToSingleMode() {
  isComparisonMode = false;
  document.getElementById('comparisonModeBtn').classList.remove('active');
  document.getElementById('singleModeContainer').style.display = 'block';
  document.getElementById('comparisonModeContainer').style.display = 'none';
  updatePDFButtonVisibility();
}

function setComparisonMode() {
  console.log('Setting comparison mode...');
  isComparisonMode = true;
  document.getElementById('comparisonModeBtn').classList.add('active');
  document.getElementById('singleModeContainer').style.display = 'none';
  document.getElementById('comparisonModeContainer').style.display = 'block';
  
  // Verify DOM elements are visible
  setTimeout(() => {
    const containerVisible = document.getElementById('comparisonModeContainer').style.display === 'block';
    const elementsA = {
      totalHoursA: !!document.getElementById('totalHoursA'),
      hoursTableA: !!document.getElementById('hoursTableA'),
      hoursChartA: !!document.getElementById('hoursChartA')
    };
    const elementsB = {
      totalHoursB: !!document.getElementById('totalHoursB'),
      hoursTableB: !!document.getElementById('hoursTableB'),
      hoursChartB: !!document.getElementById('hoursChartB')
    };
    
    console.log('Comparison mode DOM check:', {
      containerVisible,
      elementsA,
      elementsB
    });
  }, 100);
  
  updatePDFButtonVisibility();
  saveToStorage();
}

function updatePDFButtonVisibility() {
  const pdfBtn = document.getElementById('pdfBtn');
  const pdfBtnComparison = document.getElementById('pdfBtnComparison');
  const hasData = singleModeData || (datasetA && datasetB);
  
  console.log('PDF Button visibility check:', { hasData, singleModeData, datasetA, datasetB, isComparisonMode });
  
  if (isComparisonMode) {
    // Hide single mode PDF button, show comparison mode PDF button
    if (pdfBtn) pdfBtn.style.display = 'none';
    if (pdfBtnComparison) {
      pdfBtnComparison.style.display = (datasetA && datasetB) ? 'inline-block' : 'none';
      console.log('Comparison PDF Button display set to:', pdfBtnComparison.style.display);
    }
  } else {
    // Hide comparison mode PDF button, show single mode PDF button
    if (pdfBtnComparison) pdfBtnComparison.style.display = 'none';
    if (pdfBtn) {
      pdfBtn.style.display = singleModeData ? 'inline-block' : 'none';
      console.log('Single PDF Button display set to:', pdfBtn.style.display);
    }
  }
}

function showResults() {
  document.getElementById("inputSection").style.display = "none";
  document.getElementById("totalHours").style.display = "block";
  document.getElementById("hoursChart").style.display = "block";
  document.getElementById("resetButton").style.display = "inline-block";
  document.getElementById("resultsTable").style.display = "table";
}

function hideResults() {
  document.getElementById("inputSection").style.display = "block";
  document.getElementById("totalHours").style.display = "none";
  document.getElementById("hoursChart").style.display = "none";
  document.getElementById("resetButton").style.display = "none";
  document.getElementById("resultsTable").style.display = "none";
}

function showResultsA() {
  document.getElementById("totalHoursA").style.display = "block";
  document.getElementById("hoursChartA").style.display = "block";
  document.getElementById("resultsTableA").style.display = "table";
}

function showResultsB() {
  document.getElementById("totalHoursB").style.display = "block";
  document.getElementById("hoursChartB").style.display = "block";
  document.getElementById("resultsTableB").style.display = "table";
}

// Single mode clipboard processing
async function processClipboardData() {
  try {
    const text = await navigator.clipboard.readText();
    
    if (!text.trim()) {
      alert('No data found in clipboard. Please copy your Chewy LMS data first.');
      return;
    }
    
    processData(text);
    
  } catch (err) {
    console.error('Failed to read clipboard: ', err);
    alert('Unable to read from clipboard. Please make sure you have copied the data first.');
  }
}

// Comparison mode clipboard processing
async function processClipboardDataA() {
  try {
    const text = await navigator.clipboard.readText();
    
    if (!text.trim()) {
      alert('No data found in clipboard. Please copy your Dataset A first.');
      return;
    }
    
    console.log('📥 Processing Dataset A from clipboard...');
    datasetA = processDataComparison(text, 'A');
    console.log('💾 Dataset A processed:', datasetA ? 'SUCCESS' : 'FAILED');
    
    if (datasetA) {
      showResultsA();
      console.log('📊 Dataset A results shown');
      
      // Force save to storage immediately
      console.log('💾 Saving Dataset A to localStorage...');
      localStorage.setItem(STORAGE_KEYS.datasetA, JSON.stringify(datasetA));
      console.log('✅ Dataset A saved to localStorage');
      
      checkForComparison();
    }
    
  } catch (err) {
    console.error('Failed to read clipboard: ', err);
    alert('Unable to read from clipboard. Please make sure you have copied the data first.');
  }
}

async function processClipboardDataB() {
  try {
    const text = await navigator.clipboard.readText();
    
    if (!text.trim()) {
      alert('No data found in clipboard. Please copy your Dataset B first.');
      return;
    }
    
    console.log('📥 Processing Dataset B from clipboard...');
    datasetB = processDataComparison(text, 'B');
    console.log('💾 Dataset B processed:', datasetB ? 'SUCCESS' : 'FAILED');
    
    if (datasetB) {
      showResultsB();
      console.log('📊 Dataset B results shown');
      
      // Force save to storage immediately
      console.log('💾 Saving Dataset B to localStorage...');
      localStorage.setItem(STORAGE_KEYS.datasetB, JSON.stringify(datasetB));
      console.log('✅ Dataset B saved to localStorage');
      
      checkForComparison();
    }
    
  } catch (err) {
    console.error('Failed to read clipboard: ', err);
    alert('Unable to read from clipboard. Please make sure you have copied the data first.');
  }
}

function processData(text) {
  const breakdownTotals = parseTextData(text);
  const inboundTotal = Object.values(breakdownTotals).reduce((a, b) => a + b, 0);
  
  if (inboundTotal === 0) {
    document.getElementById("totalHours").textContent = "No matching data found. Please check your data format.";
    return;
  }
  
  // Store single mode data for persistence BEFORE showing results
  singleModeData = { totals: breakdownTotals, total: inboundTotal, rawText: text };
  console.log('Storing singleModeData:', singleModeData); // Debug log
  
  showResults();
  sessionStorage.setItem('hoursBreakdownInput', text);
  
  document.getElementById("totalHours").textContent = `Total Inbound Hours: ${inboundTotal.toFixed(2)} hrs`;
  
  updateTable(breakdownTotals, inboundTotal, 'hoursTable');
  createChart(breakdownTotals, 'hoursChart', 'Inbound Hours by Function Group');
  
  updatePDFButtonVisibility();
  saveToStorage();
}

function processDataComparison(text, dataset) {
  console.log(`🔄 Processing data for Dataset ${dataset}...`);
  const breakdownTotals = parseTextData(text);
  const inboundTotal = Object.values(breakdownTotals).reduce((a, b) => a + b, 0);
  
  if (inboundTotal === 0) {
    document.getElementById(`totalHours${dataset}`).textContent = "No matching data found.";
    console.log(`❌ Dataset ${dataset}: No matching data found`);
    return null;
  }
  
  document.getElementById(`totalHours${dataset}`).textContent = `Total: ${inboundTotal.toFixed(2)} hrs`;
  
  updateTable(breakdownTotals, inboundTotal, `hoursTable${dataset}`);
  createChart(breakdownTotals, `hoursChart${dataset}`, `Dataset ${dataset}`, dataset);
  
  const datasetObj = { totals: breakdownTotals, total: inboundTotal, rawText: text };
  console.log(`✅ Dataset ${dataset} processed successfully:`, {
    total: datasetObj.total,
    groupCount: Object.keys(datasetObj.totals).length
  });
  
  updatePDFButtonVisibility();
  
  // Save individual dataset to localStorage immediately
  const storageKey = dataset === 'A' ? STORAGE_KEYS.datasetA : STORAGE_KEYS.datasetB;
  localStorage.setItem(storageKey, JSON.stringify(datasetObj));
  console.log(`💾 Dataset ${dataset} saved to localStorage with key: ${storageKey}`);
  
  // Also save the current mode
  localStorage.setItem(STORAGE_KEYS.mode, 'comparison');
  console.log(`💾 Mode saved as: comparison`);
  
  return datasetObj;
}

function parseTextData(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const rows = lines.map(line => line.split(/\t+|\s{2,}/));

  const breakdownTotals = {};
  Object.keys(trackedLabels).forEach(group => {
    breakdownTotals[group] = 0;
  });

  rows.forEach((row) => {
    const category = row[0]?.trim();
    const hoursStr = row[1]?.trim();
    const hours = parseFloat(hoursStr);

    if (!category || !hoursStr || isNaN(hours)) {
      return;
    }

    for (const group in trackedLabels) {
      if (trackedLabels[group].includes(category)) {
        breakdownTotals[group] += hours;
        break;
      }
    }
  });

  // Remove groups with 0 hours
  Object.keys(breakdownTotals).forEach(group => {
    if (breakdownTotals[group] === 0) {
      delete breakdownTotals[group];
    }
  });

  return breakdownTotals;
}

function updateTable(breakdownTotals, inboundTotal, tableId) {
  const tbody = document.getElementById(tableId);
  tbody.innerHTML = '';

  const sortedGroups = Object.entries(breakdownTotals)
    .sort(([,a], [,b]) => b - a);

  sortedGroups.forEach(([group, hours]) => {
    const percent = (hours / inboundTotal) * 100;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${group}</td>
      <td>${hours.toFixed(2)}</td>
      <td>${percent.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });
}

function checkForComparison() {
  console.log('Checking for comparison:', { datasetA: !!datasetA, datasetB: !!datasetB });
  if (datasetA && datasetB) {
    console.log('Both datasets available, generating comparison analysis');
    generateComparisonAnalysis();
  } else {
    console.log('Missing dataset for comparison:', { hasA: !!datasetA, hasB: !!datasetB });
  }
}

function generateComparisonAnalysis() {
  const analysisDiv = document.getElementById('comparisonAnalysis');
  const resultsDiv = document.getElementById('comparisonResults');
  
  // Get all unique function groups
  const allGroups = new Set([
    ...Object.keys(datasetA.totals),
    ...Object.keys(datasetB.totals)
  ]);

  let analysisHTML = '<div style="margin-bottom: 1.5rem;">';
  analysisHTML += `<p><strong>Percentage Comparison vs 4-Week Average:</strong> `;
  analysisHTML += `<span style="color: #dc3545;">Red = Overspend</span> | `;
  analysisHTML += `<span style="color: #28a745;">Green = Underspend</span></p>`;
  analysisHTML += '</div>';

  Array.from(allGroups).sort().forEach(group => {
    const hoursA = datasetA.totals[group] || 0;
    const hoursB = datasetB.totals[group] || 0;
    const percentA = datasetA.total > 0 ? (hoursA / datasetA.total * 100) : 0;
    const percentB = datasetB.total > 0 ? (hoursB / datasetB.total * 100) : 0;
    const percentDiff = percentB - percentA;

    let changeClass = 'unchanged';
    let changeText = 'No change';
    
    if (Math.abs(percentDiff) > 0.1) { // Only show if difference is > 0.1%
      if (percentDiff > 0) {
        changeClass = 'increase'; // Red for overspend
        changeText = `+${percentDiff.toFixed(1)}% vs 4wk avg`;
      } else {
        changeClass = 'decrease'; // Green for underspend
        changeText = `${percentDiff.toFixed(1)}% vs 4wk avg`;
      }
    } else {
      changeText = `${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(1)}% vs 4wk avg`;
    }

    analysisHTML += `
      <div class="comparison-result-item ${changeClass}">
        <div class="function-name">${group}</div>
        <div>
          <div style="font-size: 0.9rem; color: #6c757d;">
            4wk Avg: ${percentA.toFixed(1)}% | 
            Daily: ${percentB.toFixed(1)}%
          </div>
          <div class="hours-change ${changeClass}">${changeText}</div>
        </div>
      </div>
    `;
  });

  resultsDiv.innerHTML = analysisHTML;
  analysisDiv.style.display = 'block';
}

function resetPage() {
  sessionStorage.removeItem('hoursBreakdownInput');
  localStorage.removeItem(STORAGE_KEYS.singleData);
  singleModeData = null;
  document.getElementById('hoursTable').innerHTML = '';
  
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
  
  hideResults();
  updatePDFButtonVisibility();
}

function resetComparison() {
  localStorage.removeItem(STORAGE_KEYS.datasetA);
  localStorage.removeItem(STORAGE_KEYS.datasetB);
  datasetA = null;
  datasetB = null;
  
  if (chartA) {
    chartA.destroy();
    chartA = null;
  }
  
  if (chartB) {
    chartB.destroy();
    chartB = null;
  }
  
  document.getElementById('hoursTableA').innerHTML = '';
  document.getElementById('hoursTableB').innerHTML = '';
  document.getElementById('totalHoursA').style.display = 'none';
  document.getElementById('totalHoursB').style.display = 'none';
  document.getElementById('hoursChartA').style.display = 'none';
  document.getElementById('hoursChartB').style.display = 'none';
  document.getElementById('resultsTableA').style.display = 'none';
  document.getElementById('resultsTableB').style.display = 'none';
  document.getElementById('comparisonAnalysis').style.display = 'none';
  updatePDFButtonVisibility();
}

// Restore functions for data persistence
function restoreSingleMode() {
  if (singleModeData) {
    console.log('Restoring singleModeData:', singleModeData); // Debug log
    
    // Show results first to ensure elements are visible
    showResults();
    
    // Small delay to ensure canvas is properly sized
    setTimeout(() => {
      document.getElementById("totalHours").textContent = `Total Inbound Hours: ${singleModeData.total.toFixed(2)} hrs`;
      updateTable(singleModeData.totals, singleModeData.total, 'hoursTable');
      createChart(singleModeData.totals, 'hoursChart', 'Inbound Hours by Function Group');
    }, 100);
  }
}

function restoreDatasetA() {
  return new Promise((resolve) => {
    console.log('🔍 Dataset A restore attempt:', {
      hasDatasetA: !!datasetA,
      datasetAData: datasetA ? { total: datasetA.total, groupCount: Object.keys(datasetA.totals).length } : 'NULL'
    });
    
    if (datasetA) {
      // Check if DOM elements exist
      const totalEl = document.getElementById('totalHoursA');
      const tableEl = document.getElementById('hoursTableA');
      const chartEl = document.getElementById('hoursChartA');
      
      console.log('🔍 Dataset A DOM check:', {
        totalEl: !!totalEl,
        tableEl: !!tableEl, 
        chartEl: !!chartEl,
        containerVisible: document.getElementById('comparisonModeContainer').style.display
      });
      
      if (totalEl && tableEl && chartEl) {
        try {
          totalEl.textContent = `Total: ${datasetA.total.toFixed(2)} hrs`;
          console.log('✓ Dataset A total updated');
          
          updateTable(datasetA.totals, datasetA.total, 'hoursTableA');
          console.log('✓ Dataset A table updated');
          
          createChart(datasetA.totals, 'hoursChartA', 'Dataset A', 'A');
          console.log('✓ Dataset A chart created');
          
          showResultsA();
          console.log('✓ Dataset A results shown');
          
          console.log('🎉 Dataset A restored successfully');
        } catch (error) {
          console.error('❌ Error during Dataset A restoration:', error);
        }
      } else {
        console.error('❌ Dataset A DOM elements missing:', {
          totalEl: !!totalEl,
          tableEl: !!tableEl,
          chartEl: !!chartEl
        });
      }
    } else {
      console.warn('⚠️ No Dataset A data to restore');
    }
    resolve();
  });
}

function restoreDatasetB() {
  return new Promise((resolve) => {
    console.log('🔍 Dataset B restore attempt:', {
      hasDatasetB: !!datasetB,
      datasetBData: datasetB ? { total: datasetB.total, groupCount: Object.keys(datasetB.totals).length } : 'NULL'
    });
    
    if (datasetB) {
      // Check if DOM elements exist
      const totalEl = document.getElementById('totalHoursB');
      const tableEl = document.getElementById('hoursTableB');
      const chartEl = document.getElementById('hoursChartB');
      
      console.log('🔍 Dataset B DOM check:', {
        totalEl: !!totalEl,
        tableEl: !!tableEl,
        chartEl: !!chartEl,
        containerVisible: document.getElementById('comparisonModeContainer').style.display
      });
      
      if (totalEl && tableEl && chartEl) {
        try {
          totalEl.textContent = `Total: ${datasetB.total.toFixed(2)} hrs`;
          console.log('✓ Dataset B total updated');
          
          updateTable(datasetB.totals, datasetB.total, 'hoursTableB');
          console.log('✓ Dataset B table updated');
          
          createChart(datasetB.totals, 'hoursChartB', 'Dataset B', 'B');
          console.log('✓ Dataset B chart created');
          
          showResultsB();
          console.log('✓ Dataset B results shown');
          
          console.log('🎉 Dataset B restored successfully');
        } catch (error) {
          console.error('❌ Error during Dataset B restoration:', error);
        }
      } else {
        console.error('❌ Dataset B DOM elements missing:', {
          totalEl: !!totalEl,
          tableEl: !!tableEl,
          chartEl: !!chartEl
        });
      }
    } else {
      console.warn('⚠️ No Dataset B data to restore');
    }
    resolve();
  });
}

// Enhanced PDF Generation Function with Charts and Better Formatting
async function generatePDFReport() {
  try {
    console.log('PDF Generation started - Mode:', isComparisonMode ? 'Comparison' : 'Single');
    console.log('Data available:', { singleModeData: !!singleModeData, datasetA: !!datasetA, datasetB: !!datasetB });
    
    // Load required libraries if not already loaded
    if (typeof window.jsPDF === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPosition = margin;

    // Helper function to add a new page if needed
    function checkPageBreak(additionalHeight = 20) {
      if (yPosition + additionalHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    }

    // Helper function to draw a horizontal line
    function drawLine(y, startX = margin, endX = pageWidth - margin) {
      doc.setDrawColor(200, 200, 200);
      doc.line(startX, y, endX, y);
    }

    // Helper function to add section header
    function addSectionHeader(title, y) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(41, 128, 185); // Blue color
      doc.text(title, margin, y);
      drawLine(y + 3);
      return y + 15;
    }

    // Title and Header ONLY
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(52, 73, 94); // Dark blue-gray
    doc.text('Inbound Hours Breakdown Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Subtitle with date
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(127, 140, 141); // Gray
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    
    // Add decorative line
    doc.setDrawColor(52, 152, 219);
    doc.setLineWidth(2);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 20;

    console.log('About to generate PDF for mode:', isComparisonMode ? 'Comparison' : 'Single');

    if (isComparisonMode && datasetA && datasetB) {
      console.log('Generating comparison PDF');
      await generateComparisonPDF(doc, pageWidth, pageHeight, margin, yPosition, checkPageBreak, drawLine, addSectionHeader);
    } else if (singleModeData) {
      console.log('Generating single analysis PDF');
      await generateSingleAnalysisPDF(doc, pageWidth, pageHeight, margin, yPosition, checkPageBreak, drawLine, addSectionHeader);
    } else {
      console.log('No data available for PDF');
      doc.setFontSize(12);
      doc.setTextColor(231, 76, 60); // Red
      doc.text('No data available to generate report.', margin, yPosition);
    }

    // Save the PDF
    const fileName = isComparisonMode ? 'inbound-hours-comparison-report.pdf' : 'inbound-hours-analysis-report.pdf';
    doc.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  }
}

// Generate Comparison Mode PDF
async function generateComparisonPDF(doc, pageWidth, pageHeight, margin, yPosition, checkPageBreak, drawLine, addSectionHeader) {
  // Executive Summary Section
  yPosition = addSectionHeader('Executive Summary', yPosition);
  
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(44, 62, 80);
  
  const totalHoursA = datasetA.total;
  const totalHoursB = datasetB.total;
  const hoursDifference = totalHoursB - totalHoursA;
  const percentChange = totalHoursA > 0 ? ((hoursDifference / totalHoursA) * 100) : 0;
  
  doc.text(`Dataset A (4-Week Average): ${totalHoursA.toFixed(2)} hours`, margin, yPosition);
  yPosition += 8;
  doc.text(`Dataset B (Daily Data): ${totalHoursB.toFixed(2)} hours`, margin, yPosition);
  yPosition += 8;
  
  // Color code the difference
  const changeColor = hoursDifference > 0 ? [231, 76, 60] : [46, 204, 113]; // Red for increase, Green for decrease
  doc.setTextColor(...changeColor);
  doc.text(`Total Change: ${hoursDifference >= 0 ? '+' : ''}${hoursDifference.toFixed(2)} hours (${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%)`, margin, yPosition);
  doc.setTextColor(44, 62, 80); // Reset to dark
  yPosition += 20;

  checkPageBreak(100);

  // Add charts
  yPosition = await addChartsToComparison(doc, yPosition, pageWidth, margin, checkPageBreak);

  checkPageBreak(150);

  // Check if we need a new page for the table
  checkPageBreak(100);
  
  // Detailed Analysis Section
  yPosition = addSectionHeader('Detailed Function Analysis', yPosition);
  
  // Create a more readable table with better spacing
  const tableWidth = pageWidth - 2 * margin;
  const colWidths = [50, 25, 25, 30, 30]; // Adjusted widths
  const colPositions = [
    margin, 
    margin + colWidths[0], 
    margin + colWidths[0] + colWidths[1], 
    margin + colWidths[0] + colWidths[1] + colWidths[2], 
    margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
  ];

  // Helper function to redraw table headers after page break
  function drawTableHeaders(yPos) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(52, 152, 219);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yPos - 4, tableWidth, 10, 'F');
    
    doc.text('Function Group', colPositions[0] + 1, yPos + 2);
    doc.text('4wk %', colPositions[1] + 1, yPos + 2);
    doc.text('Daily %', colPositions[2] + 1, yPos + 2);
    doc.text('Difference', colPositions[3] + 1, yPos + 2);
    doc.text('Status', colPositions[4] + 1, yPos + 2);
    return yPos + 12;
  }

  // Draw initial table headers
  yPosition = drawTableHeaders(yPosition);

  // Table data - ensure we capture all groups
  const allGroups = new Set([...Object.keys(datasetA.totals), ...Object.keys(datasetB.totals)]);
  const sortedGroups = Array.from(allGroups).sort((a, b) => {
    // Sort by Dataset A percentage (descending) for consistency
    const percentA_a = datasetA.total > 0 ? ((datasetA.totals[a] || 0) / datasetA.total * 100) : 0;
    const percentA_b = datasetA.total > 0 ? ((datasetA.totals[b] || 0) / datasetA.total * 100) : 0;
    return percentA_b - percentA_a;
  });
  
  console.log('PDF: Processing', sortedGroups.length, 'function groups:', sortedGroups); // Debug log
  
  let rowIndex = 0;
  sortedGroups.forEach(group => {
    // Check for page break and redraw headers if needed
    if (checkPageBreak(12)) {
      yPosition = drawTableHeaders(yPosition);
      rowIndex = 0; // Reset row index for alternating colors after page break
    }
    
    const hoursA = datasetA.totals[group] || 0;
    const hoursB = datasetB.totals[group] || 0;
    const percentA = datasetA.total > 0 ? (hoursA / datasetA.total * 100) : 0;
    const percentB = datasetB.total > 0 ? (hoursB / datasetB.total * 100) : 0;
    const percentDiff = percentB - percentA;

    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, yPosition - 4, tableWidth, 10, 'F');
    }

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(44, 62, 80);
    
    // Function name (truncate if too long)
    const groupName = group.length > 18 ? group.substring(0, 15) + '...' : group;
    doc.text(groupName, colPositions[0] + 1, yPosition + 2);
    
    doc.text(`${percentA.toFixed(1)}%`, colPositions[1] + 1, yPosition + 2);
    doc.text(`${percentB.toFixed(1)}%`, colPositions[2] + 1, yPosition + 2);
    
    // Color code the difference
    const diffColor = Math.abs(percentDiff) > 1 ? (percentDiff > 0 ? [231, 76, 60] : [46, 204, 113]) : [44, 62, 80];
    doc.setTextColor(...diffColor);
    doc.text(`${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(1)}%`, colPositions[3] + 1, yPosition + 2);
    
    // Status indicator
    let status = 'Normal';
    if (Math.abs(percentDiff) > 2) status = percentDiff > 0 ? 'Over' : 'Under';
    doc.text(status, colPositions[4] + 1, yPosition + 2);
    
    doc.setTextColor(44, 62, 80); // Reset color
    yPosition += 10;
    rowIndex++;
  });

  // Key insights section
  if (yPosition > pageHeight - 100) {
    doc.addPage();
    yPosition = margin;
  } else {
    yPosition += 15;
  }
  
  yPosition = addSectionHeader('Key Insights & Recommendations', yPosition);
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  // Summary stats
  const totalGroups = sortedGroups.length;
  const overspendGroups = sortedGroups.filter(group => {
    const hoursA = datasetA.totals[group] || 0;
    const hoursB = datasetB.totals[group] || 0;
    const percentA = datasetA.total > 0 ? (hoursA / datasetA.total * 100) : 0;
    const percentB = datasetB.total > 0 ? (hoursB / datasetB.total * 100) : 0;
    return (percentB - percentA) > 2;
  }).length;
  
  const underspendGroups = sortedGroups.filter(group => {
    const hoursA = datasetA.totals[group] || 0;
    const hoursB = datasetB.totals[group] || 0;
    const percentA = datasetA.total > 0 ? (hoursA / datasetA.total * 100) : 0;
    const percentB = datasetB.total > 0 ? (hoursB / datasetB.total * 100) : 0;
    return (percentB - percentA) < -2;
  }).length;

  // Overall summary
  doc.setFont(undefined, 'bold');
  doc.text('Summary:', margin, yPosition);
  yPosition += 12;
  doc.setFont(undefined, 'normal');
  doc.text(`• Total Functions Analyzed: ${totalGroups}`, margin, yPosition);
  yPosition += 10;
  doc.setTextColor(231, 76, 60);
  doc.text(`• Functions Over Budget (>2%): ${overspendGroups}`, margin, yPosition);
  yPosition += 10;
  doc.setTextColor(46, 204, 113);
  doc.text(`• Functions Under Budget (>2%): ${underspendGroups}`, margin, yPosition);
  yPosition += 15;
  doc.setTextColor(44, 62, 80);
  
  // Find biggest changes
  const significantChanges = sortedGroups
    .map(group => {
      const hoursA = datasetA.totals[group] || 0;
      const hoursB = datasetB.totals[group] || 0;
      const percentA = datasetA.total > 0 ? (hoursA / datasetA.total * 100) : 0;
      const percentB = datasetB.total > 0 ? (hoursB / datasetB.total * 100) : 0;
      return { group, diff: percentB - percentA };
    })
    .filter(item => Math.abs(item.diff) > 1)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (significantChanges.length > 0) {
    doc.setFont(undefined, 'bold');
    doc.text('Significant Changes (>1% vs 4-week average):', margin, yPosition);
    yPosition += 12;
    doc.setFont(undefined, 'normal');
    
    significantChanges.slice(0, 6).forEach((change, index) => {
      checkPageBreak(12);
      const color = change.diff > 0 ? [231, 76, 60] : [46, 204, 113];
      const arrow = change.diff > 0 ? '^' : 'v'; // Use simple ASCII characters
      const status = change.diff > 0 ? 'OVER' : 'UNDER';
      
      doc.setTextColor(44, 62, 80);
      doc.text(`${index + 1}. ${change.group}:`, margin + 5, yPosition);
      doc.setTextColor(...color);
      doc.text(`${arrow} ${status} by ${Math.abs(change.diff).toFixed(1)}%`, margin + 90, yPosition);
      yPosition += 10;
    });
  } else {
    doc.setFont(undefined, 'bold');
    doc.setTextColor(46, 204, 113);
    doc.text('✓ All functions are within 1% of their 4-week average', margin, yPosition);
    yPosition += 12;
  }
}

// Generate Single Analysis PDF
async function generateSingleAnalysisPDF(doc, pageWidth, pageHeight, margin, yPosition, checkPageBreak, drawLine, addSectionHeader) {
  console.log('Starting single analysis PDF generation');
  
  // Add chart first
  yPosition = await addChartToSingle(doc, yPosition, pageWidth, margin, checkPageBreak);

  // Force page break after chart for better layout
  doc.addPage();
  yPosition = margin;

  // Detailed breakdown table (starts on page 2)
  yPosition = addSectionHeader('Function Breakdown', yPosition);
  
  // Table setup
  const tableWidth = pageWidth - 2 * margin;
  const colWidths = [60, 30, 30, 40];
  const colPositions = [margin, margin + colWidths[0], margin + colWidths[0] + colWidths[1], 
                       margin + colWidths[0] + colWidths[1] + colWidths[2]];

  // Helper function to redraw table headers after page break
  function drawTableHeaders(yPos) {
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(52, 152, 219);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yPos - 4, tableWidth, 10, 'F');
    
    doc.text('Function Group', colPositions[0] + 1, yPos + 2);
    doc.text('Hours', colPositions[1] + 1, yPos + 2);
    doc.text('Percentage', colPositions[2] + 1, yPos + 2);
    doc.text('Category', colPositions[3] + 1, yPos + 2);
    return yPos + 12;
  }

  // Draw initial table headers
  yPosition = drawTableHeaders(yPosition);

  // Sort by hours descending
  const sortedGroups = Object.entries(singleModeData.totals).sort(([,a], [,b]) => b - a);
  
  let rowIndex = 0;
  sortedGroups.forEach(([group, hours]) => {
    // Check for page break and redraw headers if needed
    if (checkPageBreak(12)) {
      yPosition = drawTableHeaders(yPosition);
      rowIndex = 0; // Reset row index for alternating colors after page break
    }
    
    const percent = (hours / singleModeData.total) * 100;
    
    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, yPosition - 4, tableWidth, 10, 'F');
    }

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(44, 62, 80);
    
    // Function name
    const groupName = group.length > 20 ? group.substring(0, 17) + '...' : group;
    doc.text(groupName, colPositions[0] + 1, yPosition + 2);
    doc.text(hours.toFixed(2), colPositions[1] + 1, yPosition + 2);
    doc.text(`${percent.toFixed(1)}%`, colPositions[2] + 1, yPosition + 2);
    
    // Categorize by percentage
    let category = 'Minor';
    let categoryColor = [127, 140, 141]; // Gray
    if (percent >= 30) {
      category = 'Major';
      categoryColor = [231, 76, 60]; // Red
    } else if (percent >= 10) {
      category = 'Significant';
      categoryColor = [230, 126, 34]; // Orange
    } else if (percent >= 5) {
      category = 'Moderate';
      categoryColor = [241, 196, 15]; // Yellow
    }
    
    doc.setTextColor(...categoryColor);
    doc.text(category, colPositions[3] + 1, yPosition + 2);
    doc.setTextColor(44, 62, 80);
    
    yPosition += 10;
    rowIndex++;
  });

  // End of report - no insights section
  console.log('Single analysis PDF generation completed');
}

// Add charts to comparison PDF
async function addChartsToComparison(doc, yPosition, pageWidth, margin, checkPageBreak) {
  try {
    checkPageBreak(80);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('Visual Comparison Charts', margin, yPosition);
    yPosition += 15;

    // Create and use separate canvases for each chart
    // Generate chart for Dataset A
    const tempCanvasA = document.createElement('canvas');
    tempCanvasA.width = 400;
    tempCanvasA.height = 300;
    tempCanvasA.style.display = 'none';
    document.body.appendChild(tempCanvasA);

    const chartA = await createTempChart(tempCanvasA, datasetA.totals, 'Dataset A (4-Week Average)');
    const imgDataA = tempCanvasA.toDataURL('image/png');
    
    doc.text('Dataset A - 4 Week Average', margin, yPosition);
    doc.addImage(imgDataA, 'PNG', margin, yPosition + 5, 80, 60);
    
    // Clean up chart A before creating chart B
    chartA.destroy();
    document.body.removeChild(tempCanvasA);
    
    // Generate chart for Dataset B with new canvas
    const tempCanvasB = document.createElement('canvas');
    tempCanvasB.width = 400;
    tempCanvasB.height = 300;
    tempCanvasB.style.display = 'none';
    document.body.appendChild(tempCanvasB);

    const chartB = await createTempChart(tempCanvasB, datasetB.totals, 'Dataset B (Daily Data)');
    const imgDataB = tempCanvasB.toDataURL('image/png');
    
    doc.text('Dataset B - Daily Data', pageWidth/2 + 10, yPosition);
    doc.addImage(imgDataB, 'PNG', pageWidth/2 + 10, yPosition + 5, 80, 60);
    
    yPosition += 75;

    // Clean up chart B
    chartB.destroy();
    document.body.removeChild(tempCanvasB);
    
    return yPosition;
  } catch (error) {
    console.warn('Could not generate charts for PDF:', error);
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text('Charts could not be generated for this report.', margin, yPosition);
    return yPosition + 15;
  }
}

// Add chart to single analysis PDF
async function addChartToSingle(doc, yPosition, pageWidth, margin, checkPageBreak) {
  try {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 500;
    tempCanvas.height = 400;
    tempCanvas.style.display = 'none';
    document.body.appendChild(tempCanvas);

    checkPageBreak(100);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('Hours Distribution Chart', margin, yPosition);
    yPosition += 15;

    const chart = await createTempChart(tempCanvas, singleModeData.totals, 'Inbound Hours by Function');
    const imgData = tempCanvas.toDataURL('image/png');
    
    // Center the chart
    const chartWidth = 120;
    const chartHeight = 90;
    const chartX = (pageWidth - chartWidth) / 2;
    
    doc.addImage(imgData, 'PNG', chartX, yPosition, chartWidth, chartHeight);
    yPosition += chartHeight + 10;

    // Clean up
    chart.destroy();
    document.body.removeChild(tempCanvas);
    
    return yPosition;
  } catch (error) {
    console.warn('Could not generate chart for PDF:', error);
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text('Chart could not be generated for this report.', margin, yPosition);
    return yPosition + 15;
  }
}

// Create temporary chart for PDF
function createTempChart(canvas, data, title) {
  return new Promise((resolve, reject) => {
    try {
      const ctx = canvas.getContext('2d');
      
      // Clear any existing chart data on the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const sortedGroups = Object.entries(data).sort(([,a], [,b]) => b - a);
      const chartData = {
        labels: sortedGroups.map(([group]) => group),
        data: sortedGroups.map(([, hours]) => hours),
        backgroundColor: sortedGroups.map(([group]) => groupColors[group] || '#95a5a6')
      };

      const chart = new Chart(ctx, {
        type: "pie",
        data: {
          labels: chartData.labels,
          datasets: [{
            label: "Hours",
            data: chartData.data,
            backgroundColor: chartData.backgroundColor
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: 'right',
              labels: {
                padding: 10,
                usePointStyle: true,
                font: { size: 8 }
              }
            },
            tooltip: { enabled: false },
            title: {
              display: true,
              text: title,
              font: { size: 12 }
            },
            // Remove datalabels plugin to clean up chart
            datalabels: {
              display: false
            }
          },
          animation: {
            duration: 0, // Disable animation for faster rendering
            onComplete: () => {
              // Small delay to ensure chart is fully rendered
              setTimeout(() => resolve(chart), 100);
            }
          }
        },
        // Don't include datalabels plugin for cleaner charts
        plugins: []
      });
    } catch (error) {
      console.error('Error creating temp chart:', error);
      reject(error);
    }
  });
}

// Load saved data on page load
window.addEventListener('DOMContentLoaded', () => {
  handlePageLoad();
});