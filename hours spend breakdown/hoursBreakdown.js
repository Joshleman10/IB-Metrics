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
}// Register Chart.js plugin
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

function createChart(breakdownTotals, canvasId, title, dataset = null) {
  const ctx = document.getElementById(canvasId);
  
  // Destroy existing chart
  if (dataset === 'A' && chartA) {
    chartA.destroy();
  } else if (dataset === 'B' && chartB) {
    chartB.destroy();
  } else if (!dataset && currentChart) {
    currentChart.destroy();
  }

  const sortedGroups = Object.entries(breakdownTotals)
    .sort(([,a], [,b]) => b - a);

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
        },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 10 },
          formatter: (value, context) => {
            const total = context.chart._metasets[0].total;
            const percent = ((value / total) * 100).toFixed(1);
            return percent > 3 ? `${percent}%` : '';
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });

  // Store chart reference
  if (dataset === 'A') {
    chartA = chart;
  } else if (dataset === 'B') {
    chartB = chart;
  } else {
    currentChart = chart;
  }
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

// PDF Generation Function
async function generatePDFReport() {
  try {
    // Load jsPDF from CDN if not already loaded
    if (typeof window.jsPDF === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      
      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let yPosition = margin;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Inbound Hours Breakdown Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    if (isComparisonMode && datasetA && datasetB) {
      // Comparison Report
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Side-by-Side Comparison Analysis', margin, yPosition);
      yPosition += 15;

      // Dataset headers
      doc.setFontSize(12);
      doc.text('Dataset A (4-Week Average)', margin, yPosition);
      doc.text('Dataset B (Daily Data)', pageWidth / 2 + 10, yPosition);
      yPosition += 10;

      // Get all unique groups
      const allGroups = new Set([...Object.keys(datasetA.totals), ...Object.keys(datasetB.totals)]);
      
      Array.from(allGroups).sort().forEach(group => {
        const hoursA = datasetA.totals[group] || 0;
        const hoursB = datasetB.totals[group] || 0;
        const percentA = datasetA.total > 0 ? (hoursA / datasetA.total * 100) : 0;
        const percentB = datasetB.total > 0 ? (hoursB / datasetB.total * 100) : 0;
        const percentDiff = percentB - percentA;

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(group, margin, yPosition);
        
        doc.setFont(undefined, 'normal');
        doc.text(`${percentA.toFixed(1)}%`, margin + 60, yPosition);
        doc.text(`${percentB.toFixed(1)}%`, pageWidth / 2 + 70, yPosition);
        
        // Difference with color indication
        const diffText = `${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(1)}%`;
        doc.text(diffText, pageWidth - margin - 30, yPosition);
        
        yPosition += 8;
        
        if (yPosition > 270) {
          doc.addPage();
          yPosition = margin;
        }
      });

    } else if (singleModeData) {
      // Single Analysis Report
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Single Analysis Report', margin, yPosition);
      yPosition += 15;

      doc.setFontSize(12);
      doc.text(`Total Inbound Hours: ${singleModeData.total.toFixed(2)} hrs`, margin, yPosition);
      yPosition += 15;

      // Table headers
      doc.setFont(undefined, 'bold');
      doc.text('Function Group', margin, yPosition);
      doc.text('Hours', margin + 80, yPosition);
      doc.text('Percentage', margin + 120, yPosition);
      yPosition += 10;

      // Table data
      const sortedGroups = Object.entries(singleModeData.totals).sort(([,a], [,b]) => b - a);
      
      sortedGroups.forEach(([group, hours]) => {
        const percent = (hours / singleModeData.total) * 100;
        
        doc.setFont(undefined, 'normal');
        doc.text(group, margin, yPosition);
        doc.text(hours.toFixed(2), margin + 80, yPosition);
        doc.text(`${percent.toFixed(2)}%`, margin + 120, yPosition);
        yPosition += 8;
        
        if (yPosition > 270) {
          doc.addPage();
          yPosition = margin;
        }
      });
    } else {
      // No data available
      doc.setFontSize(12);
      doc.text('No data available to generate report.', margin, yPosition);
    }

    // Save the PDF
    const fileName = isComparisonMode ? 'inbound-hours-comparison.pdf' : 'inbound-hours-analysis.pdf';
    doc.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF. Please try again.');
  }
}

// Load saved data on page load
window.addEventListener('DOMContentLoaded', () => {
  handlePageLoad();
});