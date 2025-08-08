// ============================================================================
// KPI CALCULATIONS
// snapshot-calculations.js
// ============================================================================

function calculateKPIs() {
  if (!excelData && !laborData) {
    console.log('No data available for KPI calculation');
    return;
  }

  kpiResults = {
    labor: laborData ? calculateLaborKPIs(laborData) : null,
    excel: excelData ? excelData : null,
    combined: (laborData && excelData) ? calculateCombinedKPIs(laborData, excelData) : null
  };

  saveDataToStorage();
  
  displayKPIs();
  displayDetailedAnalysis();
  displayInsights();
}

function calculateLaborKPIs(data) {
  const kpis = {};
  
  if (data.departments && data.departments.length > 0) {
    // Find ONLY the inbound department - this is an IB-focused snapshot
    const inboundDept = data.departments.find(dept => 
      dept.name.toLowerCase().includes('inbound'));
    
    if (!inboundDept) {
      console.warn('No Inbound department found in labor data');
      return { error: 'No Inbound department found' };
    }
    
    // Focus only on Inbound department metrics
    kpis.inboundDepartment = inboundDept;
    kpis.totalHours = inboundDept.totalHours;
    kpis.totalUnits = inboundDept.totalUnits;
    kpis.totalTransactions = inboundDept.totalTransactions;
    kpis.overallUPH = inboundDept.uph;
    kpis.overallTPH = inboundDept.tph;
    
    // Find Inbound sub-areas if available
    const inboundAreas = data.areas?.filter(area => 
      INBOUND_AREA_KEYWORDS.some(keyword => 
        area.name.toLowerCase().includes(keyword))) || [];
    
    if (inboundAreas.length > 0) {
      kpis.inboundAreas = inboundAreas.map(area => ({
        ...area,
        hoursPercent: inboundDept.totalHours > 0 ? 
          ((area.totalHours / inboundDept.totalHours) * 100).toFixed(1) : 0
      }));
    }
  }
  
  return kpis;
}

function calculateExcelKPIs(data) {
  const kpis = {};
  
  const firstSheet = Object.keys(data)[0];
  if (firstSheet && data[firstSheet]) {
    const transactions = data[firstSheet];
    
    // Calculate specific metrics for type 152 (key for TPLH/TPH)
    const type152Transactions = transactions.filter(row => 
      row["Transaction Type"] === INBOUND_TRANSACTION_TYPES.PUT);
    
    // IMPORTANT: Total transactions should be Type 152 count only
    kpis.totalRecords = type152Transactions.length;  // Changed from transactions.length
    kpis.sheetsCount = Object.keys(data).length;
    
    // Calculate transaction type breakdown (store only counts, not raw data)
    const transactionCounts = new Map();
    const transactionTypes = new Map();
    
    transactions.forEach(row => {
      const type = row["Transaction Type"];
      const desc = row["Description"];
      if (type && desc) {
        transactionCounts.set(type, (transactionCounts.get(type) || 0) + 1);
        transactionTypes.set(type, desc);
      }
    });
    
    kpis.transactionBreakdown = Array.from(transactionCounts.entries()).map(([type, count]) => ({
      type,
      description: transactionTypes.get(type) || 'Unknown',
      count,
      percentage: ((count / transactions.length) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
    
    // Calculate total units from Type 152 only
    kpis.type152Units = type152Transactions.reduce((sum, row) => {
      const units = parseFloat(row["Quantity"]) || 0;
      return sum + units;
    }, 0);
    kpis.type152Count = type152Transactions.length;
    
    // Total units should also be from Type 152 only for consistency
    kpis.totalUnits = kpis.type152Units;
    
    // Store only essential inbound-related transaction summaries
    kpis.inboundTransactionSummary = {
      type151Count: transactions.filter(row => 
        row["Transaction Type"] === INBOUND_TRANSACTION_TYPES.RECEIPT).length,
      type152Count: kpis.type152Count,
      type152Units: kpis.type152Units,
      damagedCount: transactions.filter(row => 
        row["Transaction Type"] === INBOUND_TRANSACTION_TYPES.DAMAGED).length
    };
  }
  
  return kpis;
}

function calculateCombinedKPIs(laborData, excelData) {
  const combined = {};
  
  // Focus only on Inbound department
  const inboundDept = laborData.inboundDepartment;
  
  if (!inboundDept) {
    return { error: 'No Inbound department found in labor data' };
  }
  
  combined.datasetComparison = {
    inboundLaborHours: inboundDept.totalHours,
    type152Records: excelData.totalRecords || 0  // This is now Type 152 count
  };
  
  if (inboundDept && excelData) {
    // TPLH: Only transaction type 152 per Inbound labor hours
    const type152Count = excelData.type152Count || 0;
    combined.TPLH = inboundDept.totalHours > 0 ? type152Count / inboundDept.totalHours : 0;
    
    // TPH: Only units from transaction type 152 per Inbound labor hours
    const type152Units = excelData.type152Units || 0;
    combined.TPH = inboundDept.totalHours > 0 ? type152Units / inboundDept.totalHours : 0;
    
    combined.inboundDepartment = {
      name: inboundDept.name,
      totalHours: inboundDept.totalHours,
      laborUPH: inboundDept.uph,
      laborTPH: inboundDept.tph,
      type152Transactions: type152Count,
      type152Units: type152Units
    };
    
    // Calculate efficiency insights
    combined.inboundEfficiencyInsights = calculateEfficiencyInsights(
      inboundDept, excelData, type152Count
    );
  }
  
  return combined;
}

function calculateEfficiencyInsights(inboundDept, excelData, type152Count) {
  const insights = [];
  
  if (type152Count > 0) {
    const actualTPLH152 = type152Count / inboundDept.totalHours;
    insights.push({
      type: 'receiving_put',
      metric: 'Type 152 TPLH (Inbound Put)',
      laborHours: inboundDept.totalHours.toFixed(1),
      transactions: type152Count,
      actualTPLH: actualTPLH152.toFixed(2),
      laborTPH: inboundDept.tph.toFixed(1),
      variance: inboundDept.tph > 0 ? 
        (((actualTPLH152 - inboundDept.tph) / inboundDept.tph) * 100).toFixed(1) + '%' : 'N/A'
    });
  }
  
  // Check for 151 vs 152 ratio using the summary data
  if (excelData.inboundTransactionSummary) {
    const type151Count = excelData.inboundTransactionSummary.type151Count;
    const type152Count = excelData.inboundTransactionSummary.type152Count;
    
    if (type151Count > 0 && type152Count > 0) {
      const ratio = (type152Count / type151Count).toFixed(2);
      const isBalanced = Math.abs(type152Count - type151Count) / 
        Math.max(type151Count, type152Count) < 0.05;
      
      insights.push({
        type: 'transaction_ratio',
        metric: 'Receipt vs Put Ratio',
        type151Count: type151Count,
        type152Count: type152Count,
        ratio: ratio,
        status: isBalanced ? 'balanced' : 'imbalanced'
      });
    }
  }
  
  return insights;
}