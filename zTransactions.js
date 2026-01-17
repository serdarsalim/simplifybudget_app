// Server side code for transaction management
// This file contains functions to manage transactions, including getting, saving, and clearing transactions.

/**
 * Creates a date-only object at noon to avoid timezone issues
 * @param {string|Date} dateInput - The date to process
 * @returns {Date} A date object set to noon
 */
function createDateOnly(dateInput) {
  let date;
  
  if (dateInput instanceof Date) {
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    // Handle MM/DD/YYYY format from client
    if (dateInput.includes('/')) {
      const parts = dateInput.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1; // Month is 0-indexed
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        date = new Date(year, month, day);
      } else {
        // Invalid format, use current date
        date = new Date();
      }
    } else {
      // Assume ISO format
      date = new Date(dateInput.split('T')[0]);
    }
  } else {
    // Fallback to current date
    date = new Date();
  }
  
  // Format as "1-Jul-2025" - unambiguous and timezone-safe
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function getExpenseData(month, year) {
  try {
    // If no month/year provided, return ALL data (no filtering)
    const getAllData = (month == null || year == null);
    
    if (!getAllData) {
      month = parseInt(month);
      year = parseInt(year);
    }
    
    const donteditSheet = getBudgetSheet("Dontedit");
    
    const lastRow = donteditSheet.getLastRow();
    const startRow = 5;
    
    if (lastRow < startRow) {
      return { 
        success: true, 
        expenses: [], 
        meta: { 
          month: month,
          year: year,
          totalRows: 0,
          isEmpty: true
        } 
      };
    }
    
    // OPTIONAL OPTIMIZATION: For very large sheets, you could check if ANY data exists 
    // for the requested month before reading everything
    // This would require a formula or separate index, so might not be worth it
    
    // Read only what we need - no Notes column
    const range = `FV${startRow}:GB${lastRow}`;
    const data = donteditSheet.getRange(range).getValues();
    const displayData = donteditSheet.getRange(range).getDisplayValues();
    
    const expenses = [];
    let skippedCount = 0;
    let incomeSkipped = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const displayRow = displayData[i];
      
      // Skip empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        skippedCount++;
        continue;
      }
      
      const dateValue = row[1];      // FW
      const categoryValue = row[2];  // FX  
      const amountValue = row[4];    // FZ
      
      if (!dateValue || !categoryValue || !amountValue) {
        skippedCount++;
        continue;
      }
      
      // Track income but don't skip
      if (categoryValue.toString().toLowerCase().includes('income')) {
        incomeSkipped++;
      }
      
      // Parse date
      const expenseDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (isNaN(expenseDate.getTime())) {
        skippedCount++;
        continue;
      }
      
      // Filter by month/year only if specific month/year requested
      if (getAllData || (expenseDate.getMonth() === month && expenseDate.getFullYear() === year)) {
        const amount = parseFloat(amountValue);
        if (isNaN(amount) || amount <= 0) {
          skippedCount++;
          continue;
        }
        
        expenses.push({
          rowIndex: i + startRow,
          account: (row[0] || "").toString(),            // FV
          date: displayRow[1].toString(),                // FW - Use display value to avoid timezone conversion
          category: categoryValue.toString(),            // FX
          name: (row[3] || "").toString(),               // FY
          amount: amount,                                // FZ
          label: (row[5] || "").toString(),              // GA
          transactionId: (row[6] || "").toString(),      // GB
          notes: ""  // Always empty since we're not reading it (it's in GC)
        });
      } else {
        skippedCount++;
      }
    }
    
    return {
      success: true,
      expenses: expenses,
      meta: {
        month: getAllData ? null : month,
        year: getAllData ? null : year,
        getAllData: getAllData,
        totalRows: data.length,
        monthMatches: expenses.length,
        processedRows: expenses.length,
        skippedRows: skippedCount,
        incomeSkipped: incomeSkipped,
        range: range,
        isEmpty: expenses.length === 0
      }
    };
  } catch (error) {
    Logger.log("ERROR in getExpenseData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}


/**
 * Enhanced saveBatchExpenses that reuses cleared rows
 */
function saveBatchExpenses(expenses) {
  const sh = getBudgetSheet("Expenses");
  if (!sh)  return { success: false, error: "Expenses sheet missing" };

  // 1) pull only col D, build map + empty‐row list
  const startRow = 5;
  let lastRow  = Math.max(sh.getLastRow(), startRow);
  const ids      = sh.getRange(startRow, 4, lastRow - startRow + 1).getValues().flat();
  const map = {};
  const holes = [];
  ids.forEach((id, i) => {
    const r = startRow + i;
    if (id)       map[id] = r;
    else if (holes.length < expenses.length) holes.push(r);
  });

  // 2) separate out updates vs inserts
  const toUpdate = [];
  const toInsert = [];
  for (const e of expenses) {
    if (!e.amount || +e.amount <= 0) continue;
    const row = map[e.transactionId];
    const values = [
      e.transactionId,
      createDateOnly(e.date),
      +e.amount,
     getZategoryFromCache(e.category),
      e.name || e.description || "",
      e.label  || "",
      e.notes  || "",
      e.account && e.account.trim() !== '' ? e.account : 'Other' 
    ];
    if (row)       toUpdate.push({ row, values });
    else {
      const target = holes.length ? holes.shift() : ++lastRow;
      toInsert.push({ row: target, values });
      map[e.transactionId] = target;
    }
  }

  // 3) batch‐write updates
  toUpdate.forEach(u => {
    sh.getRange(u.row, 4, 1, 8).setValues([u.values]);
  });
  // 4) batch‐write inserts (they may not be contiguous—group if you can)
  toInsert.forEach(i => {
    sh.getRange(i.row, 4, 1, 8).setValues([i.values]);
  });
  // Update master timestamp
   updateDataTimestamp('masterData');

  return {
    success: true,
    updated: toUpdate.length,
    inserted: toInsert.length,
    reused: expenses.length - toUpdate.length - toInsert.length
  };
}

/**
 * Clear a transaction row by ID (sets all cells to blank)
 * @param {string} transactionId - Transaction ID to clear
 * @return {Object} Result object with success status
 */
function clearTransactionRow(transactionId) {
  try {
    // Get the expenses sheet
    const sheet = getBudgetSheet("Expenses");
    if (!sheet) {
      return { success: false, error: "Expenses sheet not found" };
    }
    
    // Use TextFinder to locate the exact ID in column D
    const finder = sheet.createTextFinder(transactionId.toString())
                       .matchEntireCell(true)
                       .matchCase(false)
                       .useRegularExpression(false)
                       .findNext();
    if (!finder) {
      return {
        success: false,
        error: "Transaction not found: " + transactionId
      };
    }
    
    // Determine the row of the found cell
    const rowIndex = finder.getRow();
    
    // Clear the cells in that row (columns D through K)
    sheet.getRange(rowIndex, 4, 1, 8).clearContent();
    
    // Update any caches (removed unused destructuring)
    // Update master timestamp
    updateDataTimestamp('masterData');
    return {
      success: true,
      message: "Transaction row cleared successfully",
      transactionId,
      rowIndex
    };
    
  } catch (e) {
    Logger.log("Error in clearTransactionRow: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get current month and year
 * @return {Object} Object with month and year properties
 */
function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: now.getMonth() + 1, // JavaScript months are 0-based
    year: now.getFullYear()
  };
}







/**
 * Helper function to copy budget from previous month to current month
 * @param {Object} budgetData - The budget data object
 * @param {number} currentYear - Current year
 * @param {number} currentMonth - Current month (0-based)
 * @return {boolean} True if copy was performed, false otherwise
 */
function copyPreviousMonthBudget(budgetData, currentYear, currentMonth) {
  // Generate month keys
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  
  // Calculate previous month
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = currentYear - 1;
  }
  const previousMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
  
  // Check if current month already has budgets
  const currentMonthBudgets = budgetData.budgets[currentMonthKey];
  if (currentMonthBudgets && Object.keys(currentMonthBudgets).length > 0) {
    // Current month already has budgets, don't copy
    return false;
  }
  
  // Check if previous month has budgets to copy
  const previousMonthBudgets = budgetData.budgets[previousMonthKey];
  if (!previousMonthBudgets || Object.keys(previousMonthBudgets).length === 0) {
    // Previous month has no budgets to copy
    return false;
  }
  
  // Copy budgets from previous month to current month
  budgetData.budgets[currentMonthKey] = JSON.parse(JSON.stringify(previousMonthBudgets));
  
  Logger.log(`Copied budgets from ${previousMonthKey} to ${currentMonthKey}`);
  return true;
}

/**
 * Enhanced getBudgetData function with separate timestamp reading
 * Reads timestamp from Dontedit J10, data from Dontedit K10
 * Auto-copies budget from previous month if current month is empty
 * @param {boolean} useCache - Whether to use cached data
 * @return {Object} Budget data with timestamp
 */
function getBudgetData() {
  try {
    // Check cache handled by CacheManager on frontend
    // Server-side always fetches fresh from sheet
    
    const sheet = getBudgetSheet("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Get data from K10
    const dataCell = sheet.getRange("K10").getValue();
    
    // Handle empty data case
    if (!dataCell) {
      const emptyData = {
        categories: [],
        budgets: {},
        version: 1
      };
      
      // Initialize data cell
      sheet.getRange("K10").setValue(JSON.stringify(emptyData));
      
      return { 
        success: true, 
        budgetData: emptyData
      };
    }
    
    // Parse data
    let budgetData;
    try {
      budgetData = JSON.parse(dataCell);
    } catch (e) {
      return { success: false, error: "Invalid JSON in budget data cell K10: " + e.toString() };
    }
    
    // Add version if missing
    if (!budgetData.version) {
      budgetData.version = 1;
    }
    
    // Auto-copy budget from previous month if current month is empty
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    if (copyPreviousMonthBudget(budgetData, currentYear, currentMonth)) {
      // Save the updated budget data with copied values
      saveBudgetData(budgetData);
    }
    
    // Cache handled by CacheManager on frontend
    // Server-side doesn't cache in properties
    
    return {
      success: true,
      budgetData: budgetData
    };
    
  } catch (error) {
    Logger.log("Error in getBudgetData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}


/**
 * Enhanced saveBudgetData function with centralized timestamp
 * Saves data to Dontedit K10, timestamp managed by centralized system in J10
 * @param {Object} budgetData - Complete budget data object
 * @return {Object} Result with success status
 */
function saveBudgetData(budgetData) {
  try {
    const sheet = getBudgetSheet("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Prepare data without timestamp (clean JSON)
    const cleanBudgetData = {
      ...budgetData,
      version: 1
    };
    
    // Save data to K10
    sheet.getRange("K10").setValue(JSON.stringify(cleanBudgetData));
    
    // Update timestamp in J10 for the centralized system
    updateDataTimestamp('budget');
    
    // Cache handled by CacheManager on frontend
    // Server-side doesn't cache in properties
    
    return { 
      success: true
    };
    
  } catch (error) {
    Logger.log("Error in saveBudgetData: " + error.toString());
    return { success: false, error: error.toString() };
  }
}



// Global cache for server-side categories
var _serverCategoriesCache = null;

/**
 * Get zategory formula from server cache
 */
function getZategoryFromCache(categoryName) {
  // Load cache if not already loaded
  if (!_serverCategoriesCache) {
    const result = getCategoriesWithTimestamp();
    if (result.success) {
      _serverCategoriesCache = result.categories;
    } else {
      throw new Error("Failed to load categories");
    }
  }
  
  const categoryObj = _serverCategoriesCache.find(cat => 
    cat.fullName === categoryName || cat.name === categoryName
  );
  
  if (!categoryObj) {
    throw new Error("Category not found: " + categoryName);
  }
  
  return categoryObj.zategoryFormula;
}