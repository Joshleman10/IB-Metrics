// ============================================================================
// UI RENDERING & DOM MANIPULATION
// snapshot-display.js
// ============================================================================

function displayKPIs() {
  const kpiGrid = document.getElementById('kpiGrid');
  const kpiDashboard = document.getElementById('kpiDashboard');
  
  if (!kpiResults || !kpiGrid) return;
  
  kpiDashboard.style.display = 'block';
  
  let kpiCards = [];
  
  // Check for errors first
  if (kpiResults.labor && kpiResults.labor.error) {
    kpiGrid.innerHTML = `
      <div class="kpi-card error">
        <div class="kpi-title">⚠️ Data Error</div>
        <div class="kpi-value">No Inbound Dept</div>
        <div class="kpi-subtitle">Check labor data format</div>
      </div>
    `;
    return;
  }
  
  // Primary Combined KPIs - Inbound Focus Only
  if (kpiResults.combined && kpiResults.combined.inboundDepartment) {
    const inbound = kpiResults.combined.inboundDepartment;
    
    kpiCards.push(
      createKPICard('IB Labor Hours', inbound.totalHours.toFixed(1), 'inbound department', 'labor'),
      createKPICard('Type 152 Count', inbound.type152Transactions.toLocaleString(), 'put transactions', 'combined'),
      createKPICard('TPLH', kpiResults.combined.TPLH.toFixed(2), 'type 152 trans/hr', 'combined'),
      createKPICard('TPH', kpiResults.combined.TPH.toFixed(1), 'type 152 units/hr', 'combined')
    );
  }
  
  // Excel Transaction Overview (Inbound focused)
  if (kpiResults.excel) {
    kpiCards.push(
      createKPICard('Type 152 Transactions', kpiResults.excel.totalRecords.toLocaleString(), 'put transactions only', 'data'),
      createKPICard('Type 152 Units', (kpiResults.excel.type152Units || 0).toLocaleString(), 'units put away', 'efficiency')
    );
  }
  
  // Inbound Labor Metrics
  if (kpiResults.labor && kpiResults.labor.inboundDepartment) {
    const ib = kpiResults.labor.inboundDepartment;
    kpiCards.push(
      createKPICard('IB Labor UPH', ib.uph.toFixed(1), 'reported units/hr', 'productivity'),
      createKPICard('IB Labor TPH', ib.tph.toFixed(1), 'reported trans/hr', 'productivity')
    );
  }
  
  kpiGrid.innerHTML = kpiCards.join('');
  
  document.getElementById('analysisSection').style.display = 'block';
  document.getElementById('actionButtons').style.display = 'block';
}

function createKPICard(title, value, subtitle, type) {
  return `
    <div class="kpi-card ${type}">
      <div class="kpi-title">${title}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-subtitle">${subtitle}</div>
    </div>
  `;
}

function displayDetailedAnalysis() {
  if (kpiResults.labor) {
    displayLaborAnalysis();
  }
  if (kpiResults.excel) {
    displayProductivityAnalysis();
    displayEfficiencyAnalysis();
  }
  if (kpiResults.combined) {
    displayCombinedAnalysis();
  }
}

function displayLaborAnalysis() {
  const laborBreakdown = document.getElementById('laborBreakdown');
  if (!laborBreakdown || !kpiResults.labor) return;
  
  let html = '<div class="breakdown-grid">';
  
  // Show Inbound department
  if (kpiResults.labor.inboundDepartment) {
    const dept = kpiResults.labor.inboundDepartment;
    html += `
      <div class="breakdown-item">
        <div class="breakdown-header">
          <span class="breakdown-name">${dept.name}</span>
          <span class="breakdown-hours">${dept.totalHours.toFixed(1)}h (100%)</span>
        </div>
        <div class="breakdown-metrics">
          <div class="metric">
            <span class="metric-label">UPH:</span>
            <span class="metric-value">${dept.uph.toFixed(1)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">TPH:</span>
            <span class="metric-value">${dept.tph.toFixed(1)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Units:</span>
            <span class="metric-value">${dept.totalUnits.toLocaleString()}</span>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 100%"></div>
        </div>
      </div>
    `;
  }
  
  // Show Inbound sub-areas if available
  if (kpiResults.labor.inboundAreas) {
    kpiResults.labor.inboundAreas.forEach(area => {
      html += `
        <div class="breakdown-item">
          <div class="breakdown-header">
            <span class="breakdown-name">↳ ${area.name}</span>
            <span class="breakdown-hours">${area.totalHours.toFixed(1)}h (${area.hoursPercent}%)</span>
          </div>
          <div class="breakdown-metrics">
            <div class="metric">
              <span class="metric-label">UPH:</span>
              <span class="metric-value">${area.uph.toFixed(1)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">TPH:</span>
              <span class="metric-value">${area.tph.toFixed(1)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Units:</span>
              <span class="metric-value">${area.totalUnits.toLocaleString()}</span>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${area.hoursPercent}%"></div>
          </div>
        </div>
      `;
    });
  }
  
  html += '</div>';
  laborBreakdown.innerHTML = html;
}

function displayProductivityAnalysis() {
  const productivityMetrics = document.getElementById('productivityMetrics');
  if (!productivityMetrics) return;
  
  let html = '<div class="metrics-grid">';
  
  // Combined efficiency insights
  if (kpiResults.combined && kpiResults.combined.inboundEfficiencyInsights) {
    kpiResults.combined.inboundEfficiencyInsights.forEach(insight => {
      html += `
        <div class="metric-card ${insight.type}">
          <h4>📊 ${insight.metric}</h4>
          <div class="insight-details">
      `;
      
      if (insight.type === 'receiving_put') {
        html += `
          <div class="metric-highlight">${insight.actualTPLH}</div>
          <div class="metric-detail">
            ${insight.transactions} transactions / ${insight.laborHours} hours<br>
            Variance: <span class="${getVarianceClass(insight.variance)}">${insight.variance}</span>
          </div>
        `;
      } else if (insight.type === 'transaction_ratio') {
        html += `
          <div class="metric-highlight">${insight.ratio}</div>
          <div class="metric-detail">
            151: ${insight.type151Count.toLocaleString()} | 152: ${insight.type152Count.toLocaleString()}<br>
            Status: <span class="${insight.status === 'balanced' ? 'balanced' : 'imbalanced'}">${insight.status}</span>
          </div>
        `;
      }
      
      html += `
          </div>
        </div>
      `;
    });
  }
  
  // Transaction type breakdown (top inbound types)
  if (kpiResults.excel && kpiResults.excel.transactionBreakdown) {
    const inboundTypeIds = Object.values(INBOUND_TRANSACTION_TYPES);
    const inboundTypes = kpiResults.excel.transactionBreakdown.filter(t => 
      inboundTypeIds.includes(t.type)).slice(0, 3);
    
    inboundTypes.forEach(transType => {
      html += `
        <div class="metric-card data">
          <h4>📦 ${transType.description.split('(')[0]}</h4>
          <div class="metric-highlight">${transType.count.toLocaleString()}</div>
          <div class="metric-detail">
            ${transType.percentage}% of all transactions<br>
            Type: ${transType.type}
          </div>
        </div>
      `;
    });
  }
  
  html += '</div>';
  productivityMetrics.innerHTML = html;
}

function displayEfficiencyAnalysis() {
  const efficiencyAnalysis = document.getElementById('efficiencyAnalysis');
  if (!efficiencyAnalysis) return;
  
  let html = '<div class="efficiency-grid">';
  
  // Inbound Department Focus
  if (kpiResults.combined && kpiResults.combined.inboundDepartment) {
    const inbound = kpiResults.combined.inboundDepartment;
    
    html += `
      <div class="efficiency-summary">
        <h4>🏭 Inbound Department Performance</h4>
        <div class="efficiency-metrics">
          <div class="efficiency-metric">
            <span class="metric-label">Labor UPH:</span>
            <span class="metric-value">${inbound.laborUPH.toFixed(1)}</span>
          </div>
          <div class="efficiency-metric">
            <span class="metric-label">Labor TPH:</span>
            <span class="metric-value">${inbound.laborTPH.toFixed(1)}</span>
          </div>
          <div class="efficiency-metric">
            <span class="metric-label">Actual TPLH:</span>
            <span class="metric-value">${kpiResults.combined.TPLH.toFixed(2)}</span>
          </div>
          <div class="efficiency-metric">
            <span class="metric-label">Actual TPH:</span>
            <span class="metric-value">${kpiResults.combined.TPH.toFixed(1)}</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Inbound Areas Ranking (if available)
  if (kpiResults.labor && kpiResults.labor.inboundAreas) {
    const sortedAreas = [...kpiResults.labor.inboundAreas]
      .filter(area => area.totalHours > 0)
      .sort((a, b) => b.uph - a.uph);
    
    if (sortedAreas.length > 0) {
      html += `
        <h4>🎯 Inbound Area Efficiency Ranking (by UPH)</h4>
        <div class="ranking-list">
      `;
      
      sortedAreas.forEach((area, index) => {
        const rank = index + 1;
        const rankClass = rank <= 2 ? 'top-rank' : 'normal-rank';
        
        html += `
          <div class="rank-item ${rankClass}">
            <div class="rank-number">${rank}</div>
            <div class="rank-details">
              <div class="rank-name">${area.name}</div>
              <div class="rank-metrics">
                <span>UPH: ${area.uph.toFixed(1)}</span> | 
                <span>Hours: ${area.totalHours.toFixed(1)}</span> | 
                <span>Units: ${area.totalUnits.toLocaleString()}</span>
              </div>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }
  }
  
  html += '</div>';
  efficiencyAnalysis.innerHTML = html;
}

function displayCombinedAnalysis() {
  const combinedInsights = document.getElementById('combinedInsights');
  if (!combinedInsights) return;
  
  let html = '<div class="combined-grid">';
  
  if (kpiResults.combined) {
    // Primary Inbound Department Analysis
    if (kpiResults.combined.inboundDepartment) {
      const inbound = kpiResults.combined.inboundDepartment;
      
      html += `
        <div class="insight-card">
          <h4>🏭 Inbound Department Analysis</h4>
          <div class="insight-content">
            <div class="metric-row">
              <span class="metric-label">Department:</span>
              <span class="metric-value">${inbound.name}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Labor Hours:</span>
              <span class="metric-value">${inbound.totalHours.toFixed(1)}</span>
            </div>
            <div class="metric-row highlight">
              <span class="metric-label">Type 152 TPLH:</span>
              <span class="metric-value">${kpiResults.combined.TPLH.toFixed(2)}</span>
            </div>
            <div class="metric-row highlight">
              <span class="metric-label">Type 152 TPH (Units):</span>
              <span class="metric-value">${kpiResults.combined.TPH.toFixed(1)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Labor Reported TPH:</span>
              <span class="metric-value">${inbound.laborTPH.toFixed(1)}</span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Labor Reported UPH:</span>
              <span class="metric-value">${inbound.laborUPH.toFixed(1)}</span>
            </div>
          </div>
        </div>
      `;
    }
    
    // Detailed Efficiency Insights
    if (kpiResults.combined.inboundEfficiencyInsights) {
      html += `
        <div class="insight-card">
          <h4>📊 Inbound Efficiency Insights</h4>
          <div class="efficiency-insights-grid">
      `;
      
      kpiResults.combined.inboundEfficiencyInsights.forEach(insight => {
        html += `<div class="efficiency-insight ${insight.type}">`;
        
        if (insight.type === 'receiving_put') {
          html += `
            <h5>📦 Type 152 (Put) Analysis</h5>
            <div class="insight-metrics">
              <div class="insight-metric">
                <span class="label">Actual TPLH:</span>
                <span class="value">${insight.actualTPLH}</span>
              </div>
              <div class="insight-metric">
                <span class="label">Labor TPH:</span>
                <span class="value">${insight.laborTPH}</span>
              </div>
              <div class="insight-metric">
                <span class="label">Variance:</span>
                <span class="value ${getVarianceClass(insight.variance)}">${insight.variance}</span>
              </div>
            </div>
          `;
        } else if (insight.type === 'transaction_ratio') {
          html += `
            <h5>⚖️ Receipt vs Put Ratio</h5>
            <div class="insight-metrics">
              <div class="insight-metric">
                <span class="label">151 (Receipt):</span>
                <span class="value">${insight.type151Count.toLocaleString()}</span>
              </div>
              <div class="insight-metric">
                <span class="label">152 (Put):</span>
                <span class="value">${insight.type152Count.toLocaleString()}</span>
              </div>
              <div class="insight-metric">
                <span class="label">Ratio:</span>
                <span class="value ${insight.status === 'balanced' ? 'balanced' : 'imbalanced'}">${insight.ratio}</span>
              </div>
            </div>
          `;
        }
        
        html += `</div>`;
      });
      
      html += `
          </div>
        </div>
      `;
    }
    
    // Performance Summary
    html += `
      <div class="insight-card">
        <h4>📈 Performance Summary</h4>
        <div class="performance-summary">
    `;
    
    if (kpiResults.combined.TPLH && kpiResults.combined.TPH) {
      const tplhRating = getTplhRating(kpiResults.combined.TPLH);
      const tphRating = getTphRating(kpiResults.combined.TPH);
      
      html += `
        <div class="performance-metric">
          <div class="performance-label">TPLH Performance:</div>
          <div class="performance-value ${tplhRating.class}">${tplhRating.text}</div>
          <div class="performance-detail">${kpiResults.combined.TPLH.toFixed(2)} transactions/hour</div>
        </div>
        <div class="performance-metric">
          <div class="performance-label">TPH Performance:</div>
          <div class="performance-value ${tphRating.class}">${tphRating.text}</div>
          <div class="performance-detail">${kpiResults.combined.TPH.toFixed(1)} units/hour</div>
        </div>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  combinedInsights.innerHTML = html;
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.getElementById(tabName + 'Tab').classList.add('active');
}