// ============================================================================
// DATA HANDLING & PROCESSING
// snapshot-data.js
// ============================================================================

function handleFile(event) {
  const file = event.target.files[0];
  
  if (!file) return;

  displayFileInfo(file);

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
      
      // Process all sheets
      const processedData = {};
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        // Use default parsing instead of { range: 1 } which was causing issues
        const rows = XLSX.utils.sheet_to_json(sheet);
        processedData[sheetName] = rows;
      });

      // Process the data immediately without storing raw Excel data
      const processedKPIs = {
        excel: calculateExcelKPIs({ [workbook.SheetNames[0]]: processedData[workbook.SheetNames[0]] }),
        timestamp: new Date().toISOString(),
        fileName: file.name
      };
      
      excelData = processedKPIs.excel;
      localStorage.setItem(SNAPSHOT_STORAGE_KEYS.excelData, JSON.stringify(processedKPIs));
      
      updateDataStatus('excel', 'Loaded ✅');
      console.log('Excel data processed and stored:', processedKPIs);
      
      calculateKPIs();
    } catch (error) {
      console.error('Error processing Excel file:', error);
      alert('Error processing Excel file. Please check the file format and try again.');
      updateDataStatus('excel', 'Error ❌');
    }
  };

  reader.onerror = function() {
    console.error('Error reading file');
    alert('Error reading file. Please try again.');
    updateDataStatus('excel', 'Error ❌');
  };

  reader.readAsArrayBuffer(file);
}

function displayFileInfo(file) {
  const fileInfoEl = document.getElementById('fileInfo');
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const fileDateEl = document.getElementById('fileDate');
  
  if (fileInfoEl && fileNameEl && fileSizeEl && fileDateEl) {
    fileInfoEl.style.display = 'block';
    fileNameEl.textContent = file.name;
    
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const sizeInKB = (file.size / 1024).toFixed(1);
    const sizeDisplay = file.size > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
    fileSizeEl.textContent = sizeDisplay;
    
    const fileDate = new Date(file.lastModified);
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    fileDateEl.textContent = `Modified: ${fileDate.toLocaleDateString(undefined, options)}`;
  }
}

function handlePasteClick() {
  const processingStatus = document.getElementById('processingStatus');
  
  // Show processing status
  if (processingStatus) {
    processingStatus.style.display = 'block';
    processingStatus.innerHTML = '<span class="processing-text">📋 Ready to paste - use Ctrl+V (Cmd+V on Mac)</span>';
  }
  
  // Try to read from clipboard directly
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText()
      .then(pastedData => {
        if (pastedData && pastedData.trim().length > 10) {
          if (processingStatus) {
            processingStatus.innerHTML = '<span class="processing-text">🔄 Processing pasted data...</span>';
          }
          
          setTimeout(() => {
            processPastedDataFromClipboard(pastedData);
          }, 300);
        } else {
          showPasteError(processingStatus, 'No valid data found in clipboard');
        }
      })
      .catch(err => {
        // Fallback to textarea method
        useFallbackPasteMethod(processingStatus);
      });
  } else {
    // Fallback for older browsers
    useFallbackPasteMethod(processingStatus);
  }
}

function useFallbackPasteMethod(processingStatus) {
  const hiddenTextarea = document.getElementById('hiddenPasteArea');
  
  if (hiddenTextarea) {
    hiddenTextarea.focus();
    hiddenTextarea.value = '';
    
    const handlePaste = (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text');
      
      if (pastedData && pastedData.trim().length > 10) {
        if (processingStatus) {
          processingStatus.innerHTML = '<span class="processing-text">🔄 Processing pasted data...</span>';
        }
        
        setTimeout(() => {
          processPastedDataFromClipboard(pastedData);
        }, 300);
      } else {
        showPasteError(processingStatus, 'No valid data found in clipboard');
      }
      
      hiddenTextarea.removeEventListener('paste', handlePaste);
    };
    
    hiddenTextarea.addEventListener('paste', handlePaste);
    
    setTimeout(() => {
      if (processingStatus && processingStatus.innerHTML.includes('Ready to paste')) {
        processingStatus.style.display = 'none';
      }
      hiddenTextarea.removeEventListener('paste', handlePaste);
    }, 10000);
  }
}

function processPastedDataFromClipboard(rawData) {
  const processingStatus = document.getElementById('processingStatus');
  
  if (!rawData || !rawData.trim()) {
    showPasteError(processingStatus, 'No data to process');
    return;
  }

  try {
    laborData = parseLaborData(rawData.trim());
    localStorage.setItem(SNAPSHOT_STORAGE_KEYS.laborData, JSON.stringify(laborData));
    
    updateDataStatus('labor', 'Loaded ✅');
    
    if (processingStatus) {
      processingStatus.innerHTML = '<span class="processing-text success">✅ Data processed successfully!</span>';
      setTimeout(() => {
        processingStatus.style.display = 'none';
      }, 2000);
    }
    
    console.log('Labor data processed:', laborData);
    calculateKPIs();
  } catch (error) {
    console.error('Error processing pasted data:', error);
    showPasteError(processingStatus, 'Error processing data. Please check format.', 3000);
    updateDataStatus('labor', 'Error ❌');
  }
}

function showPasteError(processingStatus, message, timeout = 2000) {
  if (processingStatus) {
    processingStatus.innerHTML = `<span class="processing-text error">❌ ${message}</span>`;
    setTimeout(() => {
      processingStatus.style.display = 'none';
    }, timeout);
  }
}

function parseLaborData(rawData) {
  const lines = rawData.split('\n').map(line => line.trim()).filter(line => line);
  const parsed = {
    departments: [],
    areas: [],
    functions: [],
    metadata: {}
  };

  let currentSection = null;
  let isTableData = false;

  lines.forEach((line, index) => {
    // Skip header/navigation lines
    if (line.includes('Chewy Labor Management') || 
        line.includes('Welcome,') || 
        line.includes('Reports') ||
        line.includes('Actions')) {
      return;
    }

    // Extract metadata
    if (line.includes('Last Updated:')) {
      parsed.metadata.lastUpdated = line.split('Last Updated:')[1]?.trim();
      return;
    }
    
    if (line.includes('FC:')) {
      parsed.metadata.fc = line.split('FC:')[1]?.trim();
      return;
    }

    // Identify sections
    if (line === 'Labor Department Totals') {
      currentSection = 'departments';
      isTableData = true;
      return;
    } else if (line === 'Labor Area Totals') {
      currentSection = 'areas';
      isTableData = true;
      return;
    } else if (line.includes('Labor Function') || line.includes('Total Hours')) {
      isTableData = true;
      return;
    }

    // Process table data
    if (isTableData && currentSection) {
      const parts = line.split(/\s{2,}|\t/);
      
      if (parts.length >= 5 && !line.includes('Totals') && !line.includes('Labor')) {
        const item = {
          name: parts[0],
          totalHours: parseFloat(parts[1]) || 0,
          totalUnits: parseInt(parts[2]) || 0,
          uph: parseFloat(parts[3]) || 0,
          totalTransactions: parseInt(parts[4]) || 0,
          tph: parseFloat(parts[5]) || 0
        };

        if (currentSection === 'departments') {
          parsed.departments.push(item);
        } else if (currentSection === 'areas') {
          parsed.areas.push(item);
        }
      }
    }

    // Reset section on new headers or totals
    if (line.includes('Totals') && !line.includes('Labor Department Totals') && !line.includes('Labor Area Totals')) {
      isTableData = false;
    }
  });

  return parsed;
}