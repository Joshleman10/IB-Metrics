// ============================================================================
// CONFIGURATION & CONSTANTS
// snapshot-config.js
// ============================================================================

// Storage keys for persistence
const SNAPSHOT_STORAGE_KEYS = {
  excelData: 'snapshot_excelData',
  laborData: 'snapshot_laborData',
  kpiResults: 'snapshot_kpiResults'
};

// Performance thresholds for insights
const PERFORMANCE_THRESHOLDS = {
  TPLH: {
    poor: 8,
    fair: 12,
    good: 16,
    excellent: 20
  },
  TPH: {
    belowTarget: 80,
    onTarget: 120,
    aboveTarget: 150
  },
  VARIANCE: {
    excellent: 5,
    acceptable: 15,
    poor: 20
  }
};

// Inbound-related transaction types
const INBOUND_TRANSACTION_TYPES = {
  RECEIPT: '151',           // Inbound Order Receipt (Rcpt)
  PUT: '152',              // Inbound Order Receipt (Put) - KEY METRIC
  DAMAGED: '183',          // Receipt Damaged
  MISC_RETURN_RCPT: '547', // Miscellaneous Return (Rcpt)
  MISC_RETURN_PUT: '548'   // Miscellaneous Return (Put)
};

// Inbound area keywords for filtering
const INBOUND_AREA_KEYWORDS = [
  'inbound',
  'receiving', 
  'putaway',
  'vas'
];

// Global data storage
let excelData = null;
let laborData = null;
let kpiResults = null;