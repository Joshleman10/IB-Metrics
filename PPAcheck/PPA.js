const vasLocations = [
  "SM.SHRNKWRP", "LG.SHRNKWRP", "IBCASEPACK", "IBREMOUCA", "IBTAPEBAG",
  "IBCOVERCSUPC", "IBLARGETAPE", "IBTAPETOP", "IBINSPECT", "IB-QA-INSPECT",
  "IBITEMLABEL", "IBBUBBLEWRAP", "IBASSEMBLE", "IBPLASTIC"
];

const reachLocations = [
  "REC6701", "REC7401", "REC7201", "REC7701", "RECVASOUT",
  "REC5401", "IBCONT01", "IBCONT02", "RECVASOUT2",
  "IBPS1", "IBPS2", "BPFLIP"
];

const cartLocations = [
  "IBCARTNORTH01", "IBCARTNORTH02", "IBCARTNORTH03", "IBCARTNORTH04",
  "IBCARTSOUTH05", "IBCARTSOUTH06", "IBCARTSOUTH07", "IBCARTSOUTH08",
  "IBCARTSOUTH10", "IBCARTNORTH09"
];

// Storage key for persistence
const PPA_STORAGE_KEY = 'ppa_fileData';

// Item master data - Initialize as empty object
let itemMasterData = {};
let currentPPARows = null; // Store current data for re-analysis

// Page refresh detection (same pattern as other pages)
window.addEventListener('beforeunload', () => {
  localStorage.setItem('spa_isLeaving', 'true');
});

// Load item master from Air vs Ground directory
console.log('Attempting to load item master from: ../air vs ground analyzer/item_master.json');
fetch('../air vs ground analyzer/item_master.json')
  .then(response => {
    console.log('Fetch response status:', response.status);
    console.log('Fetch response ok:', response.ok);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Raw item master data received:', data);
    if (data && data['Sheet1']) {
      itemMasterData = data['Sheet1'].reduce((map, item) => {
        const key = Math.floor(Number(item.ITEM_NUMBER));
        map[key] = item;
        return map;
      }, {});
      console.log('Item master data loaded successfully. Total items:', Object.keys(itemMasterData).length);
      console.log('Sample item master keys:', Object.keys(itemMasterData).slice(0, 5));
      
      // If we have PPA data waiting, re-run the volume analysis
      if (currentPPARows) {
        console.log('Re-running volume analysis with loaded item master data');
        displayVolumeAnalysisOnly(currentPPARows);
      }
    } else {
      console.error('Item master data structure is unexpected:', data);
    }
  })
  .catch(error => {
    console.error('Error loading item master data:', error);
    console.error('Full error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.warn('Volume analysis will be disabled without item master data');
    
    // Try alternative path
    console.log('Trying alternative path: ../air-vs-ground/item_master.json');
    return fetch('../air-vs-ground/item_master.json')
      .then(response => response.json())
      .then(data => {
        if (data && data['Sheet1']) {
          itemMasterData = data['Sheet1'].reduce((map, item) => {
            const key = Math.floor(Number(item.ITEM_NUMBER));
            map[key] = item;
            return map;
          }, {});
          console.log('Item master loaded from alternative path!');
          // Re-run volume analysis if we have data waiting
          if (currentPPARows) {
            displayVolumeAnalysisOnly(currentPPARows);
          }
        }
      })
      .catch(err => console.log('Alternative path also failed:', err.message));
  });

function handleFile(event) {
  const file = event.target.files[0];
  
  if (!file) return;

  // Check if XLSX library is loaded
  if (typeof XLSX === 'undefined') {
    console.error('XLSX library not loaded');
    alert('Excel processing library not loaded. Please refresh the page and try again.');
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { range: 1 });

      // Save file content to localStorage
      localStorage.setItem(PPA_STORAGE_KEY, JSON.stringify(rows));
      console.log('PPA data saved to localStorage');

      displayPPAResults(rows);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      alert('Error processing Excel file. Please check the file format and try again.');
    }
  };

  reader.onerror = function() {
    console.error('Error reading file');
    alert('Error reading file. Please try again.');
  };

  reader.readAsArrayBuffer(file);
}

function displayPPAResults(rows) {
  try {
    // Store current data for potential re-analysis
    currentPPARows = rows;
    
    const vasSet = new Set();
    const reachSet = new Set();
    const cartSet = new Set();
    
    // Volume analysis for reach truck items
    let reachTruckItems = [];
    let smallVolumeItems = [];

    rows.forEach(row => {
      const loc = String(row["Location ID"] || "").trim().toUpperCase();
      const lp = String(row["LP"] || "").trim();
      const itemNumber = row["Item Number"] || row["C"] || ""; // Column C
      const quantity = Number(row["Quantity"] || row["D"] || 0); // Column D
      
      if (!lp || !loc) return;

      if (vasLocations.includes(loc)) vasSet.add(lp);
      if (reachLocations.includes(loc)) {
        reachSet.add(lp);
        
        // Collect reach truck items for volume analysis
        if (itemNumber && quantity > 0) {
          reachTruckItems.push({
            lp: lp,
            itemNumber: Math.floor(Number(itemNumber)),
            quantity: quantity,
            location: loc
          });
        }
      }
      if (cartLocations.includes(loc)) cartSet.add(lp);
    });

    // Perform volume analysis on reach truck items
    if (Object.keys(itemMasterData).length > 0) {
      reachTruckItems.forEach(item => {
        const masterItem = itemMasterData[item.itemNumber];
        if (masterItem && masterItem.CUBIC_VOL) {
          const totalVolume = masterItem.CUBIC_VOL * item.quantity;
          item.totalVolume = totalVolume;
          
          if (totalVolume < 5000) {
            smallVolumeItems.push(item);
          }
        }
      });
    }

    const total = vasSet.size + reachSet.size + cartSet.size;
    
    // Show results sections
    document.getElementById("summarySection").style.display = "block";
    document.getElementById("detailsSection").style.display = "block";
    document.getElementById("clearButton").style.display = "inline-block";

    // Update results grid
    const resultsDiv = document.getElementById("results");
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div class="result-card vas">
          <div class="result-title">VAS PPA</div>
          <div class="result-value">${vasSet.size}</div>
          <div class="result-subtitle">unique LPs</div>
        </div>
        <div class="result-card reach">
          <div class="result-title">Reach Truck PPA</div>
          <div class="result-value">${reachSet.size}</div>
          <div class="result-subtitle">unique LPs</div>
        </div>
        <div class="result-card cart">
          <div class="result-title">Cart PPA</div>
          <div class="result-value">${cartSet.size}</div>
          <div class="result-subtitle">unique LPs</div>
        </div>
      `;
    }

    // Update details table
    const tableBody = document.getElementById("detailsTableBody");
    if (tableBody) {
      const data = [
        { name: "VAS", count: vasSet.size, class: "vas" },
        { name: "Reach Truck", count: reachSet.size, class: "reach" },
        { name: "Cart", count: cartSet.size, class: "cart" }
      ];

      tableBody.innerHTML = data.map(item => {
        const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0;
        return `
          <tr>
            <td>${item.name}</td>
            <td>${item.count}</td>
            <td>
              ${percentage}%
              <div class="percentage-bar">
                <div class="percentage-fill ${item.class}" style="width: ${percentage}%"></div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Display volume analysis if item master data is available
    if (Object.keys(itemMasterData).length > 0 && reachTruckItems.length > 0) {
      displayVolumeAnalysis(reachTruckItems, smallVolumeItems);
    } else if (reachTruckItems.length > 0) {
      console.warn('Volume analysis unavailable: Item master data not loaded yet. Will retry when data loads.');
    }

    console.log('PPA results displayed successfully');
  } catch (error) {
    console.error('Error displaying PPA results:', error);
  }
}

// Function to run volume analysis only (for when item master loads after PPA data)
function displayVolumeAnalysisOnly(rows) {
  try {
    let reachTruckItems = [];
    let smallVolumeItems = [];

    rows.forEach(row => {
      const loc = String(row["Location ID"] || "").trim().toUpperCase();
      const lp = String(row["LP"] || "").trim();
      const itemNumber = row["Item Number"] || row["C"] || "";
      const quantity = Number(row["Quantity"] || row["D"] || 0);
      
      if (!lp || !loc) return;

      if (reachLocations.includes(loc)) {
        if (itemNumber && quantity > 0) {
          reachTruckItems.push({
            lp: lp,
            itemNumber: Math.floor(Number(itemNumber)),
            quantity: quantity,
            location: loc
          });
        }
      }
    });

    // Perform volume analysis
    if (Object.keys(itemMasterData).length > 0) {
      reachTruckItems.forEach(item => {
        const masterItem = itemMasterData[item.itemNumber];
        if (masterItem && masterItem.CUBIC_VOL) {
          const totalVolume = masterItem.CUBIC_VOL * item.quantity;
          item.totalVolume = totalVolume;
          
          if (totalVolume < 5000) {
            smallVolumeItems.push(item);
          }
        }
      });

      if (reachTruckItems.length > 0) {
        displayVolumeAnalysis(reachTruckItems, smallVolumeItems);
      }
    }
  } catch (error) {
    console.error('Error in volume analysis retry:', error);
  }
}

function displayVolumeAnalysis(reachTruckItems, smallVolumeItems) {
  const volumeAnalysisEl = document.getElementById("volumeAnalysis");
  const smallVolumeCountEl = document.getElementById("smallVolumeCount");
  const smallVolumePercentEl = document.getElementById("smallVolumePercent");
  const totalReachItemsEl = document.getElementById("totalReachItems");

  if (volumeAnalysisEl && smallVolumeCountEl && smallVolumePercentEl && totalReachItemsEl) {
    // Calculate totals
    const totalReachItems = reachTruckItems.length;
    const smallVolumeCount = smallVolumeItems.length;
    const smallVolumePercent = totalReachItems > 0 ? ((smallVolumeCount / totalReachItems) * 100).toFixed(1) : 0;

    // Update display
    smallVolumeCountEl.textContent = smallVolumeCount;
    smallVolumePercentEl.textContent = `(${smallVolumePercent}% of RT items)`;
    totalReachItemsEl.textContent = totalReachItems;

    // Show volume analysis section
    volumeAnalysisEl.style.display = "block";

    console.log(`Volume Analysis: ${smallVolumeCount}/${totalReachItems} reach truck items are small volume (${smallVolumePercent}%)`);
  }
}

function clearPPAData() {
  localStorage.removeItem(PPA_STORAGE_KEY);
  
  // Hide results sections
  document.getElementById("summarySection").style.display = "none";
  document.getElementById("detailsSection").style.display = "none";
  document.getElementById("clearButton").style.display = "none";
  
  // Clear results content
  const resultsDiv = document.getElementById("results");
  const tableBody = document.getElementById("detailsTableBody");
  const volumeAnalysisEl = document.getElementById("volumeAnalysis");
  
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (tableBody) tableBody.innerHTML = '';
  if (volumeAnalysisEl) volumeAnalysisEl.style.display = 'none';
  
  // Reset file input
  const fileInput = document.getElementById("fileInput");
  if (fileInput) fileInput.value = '';
  
  console.log('PPA data cleared');
}

// Handle page load - check for refresh vs SPA navigation
function handlePPAPageLoad() {
  const wasLeaving = localStorage.getItem('spa_isLeaving');
  
  if (!wasLeaving) {
    // This was a refresh, clear PPA data
    console.log('Page refresh detected - clearing PPA data');
    clearPPAData();
  } else {
    // Normal SPA navigation, load saved data
    console.log('SPA navigation detected - loading saved PPA data');
    const saved = localStorage.getItem(PPA_STORAGE_KEY);
    if (saved) {
      try {
        const parsedRows = JSON.parse(saved);
        displayPPAResults(parsedRows);
        console.log('PPA data restored from localStorage');
      } catch (e) {
        console.warn("Failed to restore PPA data from localStorage:", e);
        clearPPAData();
      }
    }
  }
  
  // Clear the leaving flag
  localStorage.removeItem('spa_isLeaving');
}

// Load on page ready
window.addEventListener("DOMContentLoaded", handlePPAPageLoad);