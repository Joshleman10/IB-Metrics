// ============================================================================
// UTILITY FUNCTIONS
// snapshot-utils.js  
// ============================================================================

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatPercentage(value, total) {
  if (total === 0) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function getVarianceClass(variance) {
  if (!variance || variance === 'N/A') return '';
  const numericVariance = Math.abs(parseFloat(variance));
  if (numericVariance <= PERFORMANCE_THRESHOLDS.VARIANCE.excellent) return 'variance-good';
  if (numericVariance <= PERFORMANCE_THRESHOLDS.VARIANCE.acceptable) return 'variance-warning';
  return 'variance-poor';
}

function getTplhRating(tplh) {
  const thresholds = PERFORMANCE_THRESHOLDS.TPLH;
  if (tplh < thresholds.poor) return { text: 'Needs Improvement', class: 'rating-poor' };
  if (tplh < thresholds.fair) return { text: 'Fair', class: 'rating-fair' };
  if (tplh < thresholds.good) return { text: 'Good', class: 'rating-good' };
  return { text: 'Excellent', class: 'rating-excellent' };
}

function getTphRating(tph) {
  const thresholds = PERFORMANCE_THRESHOLDS.TPH;
  if (tph < thresholds.belowTarget) return { text: 'Below Target', class: 'rating-poor' };
  if (tph < thresholds.onTarget) return { text: 'On Target', class: 'rating-good' };
  return { text: 'Above Target', class: 'rating-excellent' };
}

function getInsightIcon(type) {
  switch (type) {
    case 'warning': return '⚠️';
    case 'success': return '✅';
    case 'info': return 'ℹ️';
    case 'error': return '❌';
    default: return '💡';
  }
}

function updateDataStatus(type, status) {
  const statusElement = document.getElementById(type === 'excel' ? 'excelStatus' : 'laborStatus');
  if (statusElement) {
    statusElement.textContent = status;
    statusElement.className = `status-value ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : ''}`;
  }
}