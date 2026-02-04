/**
 * NetWorth Server Functions for Simplify Budget
 * Add these functions to your Code.gs or transaction.js file
 */

/**
 * Creates a month-year only format (MMM YYYY) for net worth entries
 * @param {string|Date} dateInput - The date to process
 * @returns {string} A string in "Jul 2025" format
 */
function createMonthYearOnly(dateInput) {
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
  
  // Format as "Jul 2025" - month and year only
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}


/**
 * Optimized getNetWorthData - Fixed range C36:K3000 for maximum performance
 * @return {Object} Result with net worth entries and timestamp
 */
function getNetWorthData() {
  try {
    const netWorthSheet = getBudgetSheet("Net Worth");
    
    if (!netWorthSheet) {
      return { success: false, error: "Net Worth sheet not found" };
    }

    const timestamp = getNetWorthTimestamp_();

    // CHECK IF SHEET IS EMPTY FIRST
    const lastRow = netWorthSheet.getLastRow();
    
    // If only headers or less (row 36 or below), return empty immediately
    if (lastRow <= 36) {
      return {
        success: true,
        entries: [],
        goals: getNetWorthGoalsFromDontedit_(),
        timestamp: timestamp,
        meta: {
          totalRows: 0,
          processedRows: 0,
          skippedRows: 0,
          isEmpty: true
        }
      };
    }


    
    // Fixed column indices based on C36:K36 structure
    const COL = {
      ASSET_ID: 0,        // Column C
      DATE: 1,            // Column D
      ASSET: 2,           // Column E
      TYPE: 3,            // Column F
      NAME: 4,            // Column G
      AMOUNT: 5,          // Column H
      CHANGE: 6,          // Column I
      CHANGE_AMOUNT: 7,   // Column J
      NOTES: 8            // Column K
    };
    
    // ONLY READ THE ROWS THAT ACTUALLY HAVE DATA
    const dataStartRow = 37;
    const numRowsToRead = lastRow - dataStartRow + 1;
    
    // Only read if there's actual data
    if (numRowsToRead <= 0) {
      return {
        success: true,
        entries: [],
        goals: getNetWorthGoalsFromDontedit_(),
        timestamp: timestamp,
        meta: {
          totalRows: 0,
          processedRows: 0,
          skippedRows: 0,
          isEmpty: true
        }
      };
    }
    
    // Read only the actual data range (not 2965 rows!)
    const actualRange = `C${dataStartRow}:K${lastRow}`;
    
    const dataRows = netWorthSheet.getRange(actualRange).getValues();
    const displayValues = netWorthSheet.getRange(actualRange).getDisplayValues();
    
    // Process data into structured entries
    const entries = [];
    let processedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // Skip completely empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        skippedCount++;
        continue;
      }
      
      // Extract essential data
      const assetId = row[COL.ASSET_ID];
      const rawDate = row[COL.DATE];
      const displayDate = displayValues[i][COL.DATE];
      const asset = row[COL.ASSET];
      const name = row[COL.NAME];
      const amount = row[COL.AMOUNT];
      
      // Use display date and trim whitespace  
      const date = displayDate ? displayDate.toString().trim() : null;
      
      // Skip rows without essential data
      if (!date || !asset || !name || (amount === null || amount === undefined || amount === '')) {
        skippedCount++;
        continue;
      }

      // Use the processed date
      const entryDate = date;

      // Parse amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        skippedCount++;
        continue;
      }

      // Parse change amount
      const changeAmount = row[COL.CHANGE_AMOUNT];
      const parsedChangeAmount = changeAmount ? parseFloat(changeAmount) : 0;

      // Use the asset ID from column, or generate one if not present
      const finalAssetId = assetId ? assetId.toString() : generateAssetId();
      
      entries.push({
        id: finalAssetId,
        assetId: finalAssetId,
        rowIndex: i + dataStartRow, // Actual sheet row number
        date: entryDate,
        asset: asset.toString(),
        type: row[COL.TYPE] ? row[COL.TYPE].toString() : '',
        name: name.toString(),
        amount: parsedAmount,
        change: row[COL.CHANGE] ? row[COL.CHANGE].toString() : '',
        changeAmount: isNaN(parsedChangeAmount) ? 0 : parsedChangeAmount,
        notes: row[COL.NOTES] ? row[COL.NOTES].toString() : ''
      });

      processedCount++;
    }


    const goals = getNetWorthGoalsFromDontedit_();

    return {
      success: true,
      entries: entries,
      goals: goals,
      timestamp: timestamp,
      meta: {
        totalRows: dataRows.length,
        processedRows: processedCount,
        skippedRows: skippedCount,
        range: actualRange,
        lastRow: lastRow
      }
    };
    
  } catch (error) {
    console.log("ERROR in getNetWorthData: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Read net worth goals from Dontedit K6
 * @return {Array} Goals array
 */
function getNetWorthGoalsFromDontedit_() {
  try {
    const sheet = getBudgetSheet("Dontedit");
    if (!sheet) return [];
    const raw = sheet.getRange("K6").getValue();
    if (!raw) return [];

    let text = raw;
    if (raw instanceof Date) {
      return [];
    }
    if (typeof raw !== 'string') {
      text = raw.toString();
    }

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.goals)) return parsed.goals;
    return [];
  } catch (error) {
    Logger.log("Error reading net worth goals: " + error.toString());
    return [];
  }
}

/**
 * Write net worth goals to Dontedit K6 and update J6 timestamp
 * @param {Object|Array} payload - {goals:[...]} or goals array
 * @return {Object} Result with timestamp
 */
function saveNetWorthGoals(payload) {
  try {
    const sheet = getBudgetSheet("Dontedit");
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }

    const goalsArray = Array.isArray(payload)
      ? payload
      : (payload && Array.isArray(payload.goals) ? payload.goals : []);

    sheet.getRange("K6").setValue(JSON.stringify({ goals: goalsArray }));

    // Update timestamp in J6
    updateDataTimestamp('netWorth');

    const timestamp = getNetWorthTimestamp_();

    return {
      success: true,
      goals: goalsArray,
      timestamp: timestamp
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Read net worth timestamp from Dontedit J6
 * @return {string} ISO timestamp
 */
function getNetWorthTimestamp_() {
  try {
    const sheet = getBudgetSheet("Dontedit");
    if (!sheet) return new Date().toISOString();
    const value = sheet.getRange("J6").getValue();
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value) {
      return value.toString();
    }
    return new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}





/**
 * Save batch net worth entries using ID as the primary identifier
 * @param {Array} entries - Array of net worth entry objects
 * @return {Object} Result object with success status
 */
function saveBatchNetWorth(entries) {

  
  try {
    const sheet = getBudgetSheet("Net Worth");
    
    if (!sheet) {
      return { success: false, error: "Net Worth sheet not found" };
    }

    // Get existing data to find matches
    const startRow = 37;
    const lastRow = Math.max(sheet.getLastRow(), startRow);
    
    // First, get the headers to understand column structure
    const headerRange = "C36:K36";
    const headers = sheet.getRange(headerRange).getValues()[0];
    
    // Read existing data (C37:K + however many rows)
    const existingRange = "C" + startRow + ":K" + lastRow;
    const existingData = sheet.getRange(existingRange).getValues();
    
    // Build map of existing entries by ID
    const existingIdMap = {};
    const availableRows = [];
    
    for (let i = 0; i < existingData.length; i++) {
      const row = existingData[i];
      const actualRowNum = startRow + i;
      
      // Check if row has data
      const hasData = row.some(cell => cell && cell.toString().trim() !== '');
      
      if (hasData) {
        const id = row[0]; // column C - Asset ID
        if (id) {
          // Store the row number for this ID
          existingIdMap[id.toString()] = actualRowNum;
        }
      } else {
        // Empty row available for new entries
        availableRows.push(actualRowNum);
      }
    }
    
  

    // Process entries for save
    const toUpdate = [];
    const toInsert = [];
    let nextNewRow = lastRow + 1;

    for (const entry of entries) {
      if (entry.amount === undefined || entry.amount === null || isNaN(parseFloat(entry.amount))) {
        continue;
      }

      // Create values array for spreadsheet (C:K columns)
      const values = [
        entry.id || entry.assetId || generateAssetId(), // C - Asset ID
        createMonthYearOnly(entry.date),                          // D - Date
        entry.asset || '',                             // E - Asset
        entry.type || '',                              // F - Type
        entry.name || '',                              // G - Name
        parseFloat(entry.amount) || 0,                 // H - Amount
        entry.change || '',                            // I - Change
        parseFloat(entry.changeAmount) || 0,           // J - Change Amount
        entry.notes || ''                              // K - Notes
      ];
      
      // Check if this entry's ID exists in the map
      if (entry.id && existingIdMap[entry.id]) {
        const rowNum = existingIdMap[entry.id];
        toUpdate.push({ row: rowNum, values: values });
      } else {
        // New entry - use available row or append
        let targetRow;
        if (availableRows.length > 0) {
          targetRow = availableRows.shift();
        } else {
          targetRow = nextNewRow++;
        }
        
        toInsert.push({ row: targetRow, values: values });
      }
    }


    // Execute updates
    toUpdate.forEach(update => {
      sheet.getRange(update.row, 3, 1, 9).setValues([update.values]); // C:K = 9 columns
    });
    
    // Execute inserts
    toInsert.forEach(insert => {
      sheet.getRange(insert.row, 3, 1, 9).setValues([insert.values]); // C:K = 9 columns
    });
    
    // Update timestamp
    updateDataTimestamp('netWorth');
    const timestamp = getNetWorthTimestamp_();
    

    // Prepare the list of entries to return for client-side update
    const savedEntries = [];
    [...toUpdate, ...toInsert].forEach(item => {
      // Handle date - could be Date object or string
      let dateValue = item.values[1];
      if (dateValue instanceof Date) {
        dateValue = dateValue.toISOString();
      } else if (typeof dateValue === 'string') {
        // Already a string, keep it as is
        dateValue = dateValue;
      } else {
        // Fallback
        dateValue = new Date().toISOString();
      }

      savedEntries.push({
        id: item.values[0],          // C - Asset ID
        date: dateValue,             // D - Date
        asset: item.values[2],       // E - Asset
        type: item.values[3],        // F - Type
        name: item.values[4],        // G - Name
        amount: item.values[5],      // H - Amount
        change: item.values[6],      // I - Change
        changeAmount: item.values[7], // J - Change Amount
        notes: item.values[8]         // K - Notes
      });
    });

    return {
      success: true,
      updated: toUpdate.length,
      inserted: toInsert.length,
      total: toUpdate.length + toInsert.length,
      entries: savedEntries,
      timestamp: timestamp
    };

  } catch (error) {
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}


/**
 * Clear net worth row by ID or unique key
 * @param {string} identifier - Row ID or unique identifier to clear
 * @return {Object} Result object with success status
 */
function clearNetWorthRow(identifier) {
 
  
  try {
    const sheet = getBudgetSheet("Net Worth");
    
    if (!sheet) {
      return { success: false, error: "Net Worth sheet not found" };
    }
    
    // Initialize variables
    let rowToDelete = null;
    const startRow = 37;
    const lastRow = Math.max(sheet.getLastRow(), startRow);
    
    // Get data for search
    const searchRange = "C" + startRow + ":K" + lastRow;
    const data = sheet.getRange(searchRange).getValues();
      
    // Search directly for assetId match first (most efficient)
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === identifier) { // Column C = assetId
        rowToDelete = startRow + i;
        console.log("Found exact assetId match at row " + rowToDelete);
        break;
      }
    }
    
    // If not found by ID, try general search
    if (!rowToDelete) {
      // Search through data to find matching row by any field
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const actualRowNum = startRow + i;
        
        // Check if any cell contains the identifier
        const rowContainsId = row.some(cell => 
          cell && cell.toString().includes(identifier)
        );
        
        if (rowContainsId) {
          rowToDelete = actualRowNum;
          break;
        }
      }
    }
    
    if (!rowToDelete) {
      return {
        success: false,
        error: "Net worth entry not found: " + identifier
      };
    }

    // Clear the row (columns C through K = 9 columns)
    sheet.getRange(rowToDelete, 3, 1, 9).clearContent();
    
    // Update timestamp
    updateDataTimestamp('netWorth');
    
    return {
      success: true,
      message: "Net worth entry cleared successfully",
      identifier: identifier,
      rowIndex: rowToDelete,
      timestamp: timestamp
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}

/**
 * Get net worth data with timestamp
 * @return {Object} Result with entries and timestamp for caching
 */
function getNetWorthWithTimestamp() {
  try {
    const result = getNetWorthData();

    if (!result.success) {
      return result;
    }

    // Get timestamp from Dontedit J6
    if (!result.timestamp) {
      result.timestamp = getNetWorthTimestamp_();
    }

    return result;

  } catch (error) {
    console.log("Error in getNetWorthWithTimestamp: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}
