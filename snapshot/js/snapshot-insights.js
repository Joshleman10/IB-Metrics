// ============================================================================
// ANALYTICS & RECOMMENDATIONS
// snapshot-insights.js
// ============================================================================

function displayInsights() {
  const insights = generateInsights();
  
  if (insights.length === 0) return;
  
  let insightsSection = document.getElementById('insightsSection');
  if (!insightsSection) {
    insightsSection = document.createElement('div');
    insightsSection.id = 'insightsSection';
    insightsSection.className = 'insights-section';
    
    const kpiDashboard = document.getElementById('kpiDashboard');
    kpiDashboard.parentNode.insertBefore(insightsSection, kpiDashboard.nextSibling);
  }
  
  let html = '<h2>💡 Inbound Performance Insights</h2><div class="insights-grid">';
  
  insights.forEach(insight => {
    html += `
      <div class="insight-card ${insight.type}">
        <div class="insight-header">
          <span class="insight-icon">${getInsightIcon(insight.type)}</span>
          <h4>${insight.title}</h4>
        </div>
        <p>${insight.message}</p>
        ${insight.recommendation ? `<div class="insight-recommendation">${insight.recommendation}</div>` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  insightsSection.innerHTML = html;
  insightsSection.style.display = 'block';
}

function generateInsights() {
  const insights = [];
  
  if (!kpiResults) return insights;
  
  // TPLH Performance Insights
  if (kpiResults.combined && kpiResults.combined.TPLH) {
    const tplh = kpiResults.combined.TPLH;
    const thresholds = PERFORMANCE_THRESHOLDS.TPLH;
    
    if (tplh < thresholds.poor) {
      insights.push({
        type: 'warning',
        title: 'Low TPLH Performance',
        message: `TPLH of ${tplh.toFixed(2)} is below optimal range (${thresholds.poor}-${thresholds.good} transactions/hour).`,
        recommendation: 'Consider reviewing putaway processes and staff allocation in the Inbound department.'
      });
    } else if (tplh > thresholds.excellent) {
      insights.push({
        type: 'success',
        title: 'Excellent TPLH Performance',
        message: `TPLH of ${tplh.toFixed(2)} indicates outstanding inbound efficiency.`,
        recommendation: 'Document current best practices to maintain this high performance level.'
      });
    } else if (tplh >= thresholds.fair && tplh <= thresholds.excellent) {
      insights.push({
        type: 'success',
        title: 'Good TPLH Performance',
        message: `TPLH of ${tplh.toFixed(2)} is within the good performance range.`
      });
    }
  }
  
  // TPH Performance Insights
  if (kpiResults.combined && kpiResults.combined.TPH) {
    const tph = kpiResults.combined.TPH;
    const thresholds = PERFORMANCE_THRESHOLDS.TPH;
    
    if (tph < thresholds.belowTarget) {
      insights.push({
        type: 'warning',
        title: 'TPH Below Target',
        message: `TPH of ${tph.toFixed(1)} units/hour may indicate throughput opportunities.`,
        recommendation: 'Analyze putaway efficiency and consider process improvements.'
      });
    } else if (tph > thresholds.aboveTarget) {
      insights.push({
        type: 'success',
        title: 'High TPH Performance',
        message: `TPH of ${tph.toFixed(1)} units/hour shows excellent throughput.`
      });
    }
  }
  
  // Variance Analysis
  if (kpiResults.combined && kpiResults.combined.inboundEfficiencyInsights) {
    const putInsight = kpiResults.combined.inboundEfficiencyInsights.find(i => i.type === 'receiving_put');
    if (putInsight && putInsight.variance !== 'N/A') {
      const variance = Math.abs(parseFloat(putInsight.variance));
      const thresholds = PERFORMANCE_THRESHOLDS.VARIANCE;
      
      if (variance > thresholds.poor) {
        insights.push({
          type: 'warning',
          title: 'High Variance Between Actual and Labor Data',
          message: `${variance.toFixed(1)}% variance between actual TPLH and labor-reported TPH.`,
          recommendation: 'Review data collection methods and labor reporting accuracy.'
        });
      } else if (variance <= thresholds.excellent) {
        insights.push({
          type: 'success',
          title: 'Excellent Data Alignment',
          message: `Only ${variance.toFixed(1)}% variance shows accurate labor reporting.`
        });
      }
    }
  }
  
  // Transaction Balance Analysis
  if (kpiResults.combined && kpiResults.combined.inboundEfficiencyInsights) {
    const ratioInsight = kpiResults.combined.inboundEfficiencyInsights.find(i => i.type === 'transaction_ratio');
    if (ratioInsight && ratioInsight.status === 'imbalanced') {
      const ratio = parseFloat(ratioInsight.ratio);
      if (ratio < 0.9) {
        insights.push({
          type: 'info',
          title: 'More Receipts Than Puts',
          message: `Ratio of ${ratioInsight.ratio} indicates more receipts (151) than puts (152).`,
          recommendation: 'Monitor for potential putaway backlog or processing delays.'
        });
      } else if (ratio > 1.1) {
        insights.push({
          type: 'info',
          title: 'More Puts Than Receipts',
          message: `Ratio of ${ratioInsight.ratio} indicates more puts (152) than receipts (151).`,
          recommendation: 'Verify data timing - may indicate catch-up putaway processing.'
        });
      }
    }
  }
  
  // Data Quality Insights
  if (kpiResults.labor && kpiResults.excel) {
    const hasInbound = kpiResults.labor.inboundDepartment;
    if (!hasInbound) {
      insights.push({
        type: 'error',
        title: 'No Inbound Department Found',
        message: 'Could not locate "Inbound" department in labor data.',
        recommendation: 'Verify labor data format and department naming conventions.'
      });
    }
  }
  
  // Area Performance Insights
  if (kpiResults.labor && kpiResults.labor.inboundAreas) {
    const areas = kpiResults.labor.inboundAreas;
    const lowPerformingAreas = areas.filter(area => 
      area.uph < kpiResults.labor.overallUPH * 0.8);
    
    if (lowPerformingAreas.length > 0) {
      insights.push({
        type: 'info',
        title: 'Underperforming Inbound Areas',
        message: `${lowPerformingAreas.length} inbound area(s) performing below department average.`,
        recommendation: 'Review processes in: ' + lowPerformingAreas.map(a => a.name).join(', ')
      });
    }
  }
  
  return insights;
}

// ============================================================================
// ENHANCED ANALYTICS (Future Enhancement Ready)
// ============================================================================

function calculateTrendAnalysis(currentData, historicalData) {
  // Placeholder for future trend analysis
  return {
    tplhTrend: 'stable',
    tphTrend: 'improving',
    recommendations: []
  };
}

function generatePerformanceBenchmarks() {
  // Placeholder for industry benchmark comparison
  return {
    industryTPLH: { 
      min: PERFORMANCE_THRESHOLDS.TPLH.poor, 
      avg: PERFORMANCE_THRESHOLDS.TPLH.fair, 
      max: PERFORMANCE_THRESHOLDS.TPLH.good 
    },
    industryTPH: { 
      min: PERFORMANCE_THRESHOLDS.TPH.belowTarget, 
      avg: PERFORMANCE_THRESHOLDS.TPH.onTarget, 
      max: PERFORMANCE_THRESHOLDS.TPH.aboveTarget 
    }
  };
}

function detectAnomalies(kpiData) {
  // Placeholder for anomaly detection
  const anomalies = [];
  
  if (kpiData.combined && kpiData.combined.TPLH) {
    const tplh = kpiData.combined.TPLH;
    if (tplh < 3 || tplh > 30) {
      anomalies.push({
        type: 'outlier',
        metric: 'TPLH',
        value: tplh,
        message: 'TPLH value appears to be an outlier'
      });
    }
  }
  
  return anomalies;
}