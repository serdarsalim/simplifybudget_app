
/**
 * Update recurring data timestamp - matches existing pattern
 */
function updateRecurringDataTimestamp() {
  try {
    const sheet = getBudgetSheet("Dontedit");
    
    if (!sheet) return;
    
    // Save timestamp to J7 (following your pattern)
    const timestamp = new Date().toISOString();
    sheet.getRange("J7").setValue(timestamp);
    
    // Clear recurring cache
    props.deleteProperty("CACHED_RECURRING_DATA");
    
    Logger.log("Updated recurring timestamp: " + timestamp);
    
  } catch (error) {
    Logger.log("Error updating recurring timestamp: " + error.toString());
  }
}


/**
 * Optimized getRecurringData - Only reads actual data rows
 * @return {Object} Result with recurring transactions data
 */
function getRecurringData() {  
  try {
    const recurringSheet = getBudgetSheet("Recurring");
    
    if (!recurringSheet) {
      return { success: false, error: "Recurring sheet not found" };
    }

    // CHECK IF SHEET IS EMPTY FIRST
    const lastRow = recurringSheet.getLastRow();
    
    // If only headers or less (row 5 or below), return empty immediately
    if (lastRow <= 5) {
      return {
        success: true,
        recurring: [],
        meta: {
          totalRows: 0,
          processedRows: 0,
          skippedRows: 0,
          isEmpty: true
        }
      };
    }

    // Fixed column indices based on C5:N5 structure
    const COL = {
      TRANSACTION_ID: 0,  // Column C
      START_DATE: 1,      // Column D
      NAME: 2,            // Column E
      CATEGORY: 3,        // Column F
      TYPE: 4,            // Column G
      FREQUENCY: 5,       // Column H
      AMOUNT: 6,          // Column I
      ACCOUNT: 7,         // Column J
      END_DATE: 8,        // Column K
      OWNER: 9,           // Column L
      NOTES: 10,          // Column M
      SOURCE: 11          // Column N
    };

    // ONLY READ THE ROWS THAT ACTUALLY HAVE DATA
    const dataStartRow = 6;
    const numRowsToRead = lastRow - dataStartRow + 1;
    
    // Only read if there's actual data
    if (numRowsToRead <= 0) {
      return {
        success: true,
        recurring: [],
        meta: {
          totalRows: 0,
          processedRows: 0,
          skippedRows: 0,
          isEmpty: true
        }
      };
    }
    
    // Read only the actual data range (not 495 rows!)
    const actualRange = `C${dataStartRow}:N${lastRow}`;
    
    const dataRows = recurringSheet.getRange(actualRange).getValues();
    const displayRows = recurringSheet.getRange(actualRange).getDisplayValues();
    
    const recurring = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const displayRow = displayRows[i];
      
      // Skip completely empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        skippedCount++;
        continue;
      }

      // Extract essential data
      const transactionId = row[COL.TRANSACTION_ID] || '';
      const name = row[COL.NAME] || '';
      const amount = row[COL.AMOUNT] || 0;
      
      // Skip rows without essential data
      if (!name || !amount) {
        skippedCount++;
        continue;
      }

      // Parse amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        skippedCount++;
        continue;
      }

      // Parse dates
      let startDate = null;
      let endDate = null;

      if (row[COL.START_DATE]) {
        startDate = displayRow[COL.START_DATE].toString();
      }
      
      if (row[COL.END_DATE]) {
        endDate = displayRow[COL.END_DATE].toString();
      }

      // Build transaction object
      recurring.push({
        id: transactionId || `recurring-${i + dataStartRow}`,
        rowIndex: i + dataStartRow, // Actual sheet row number
        startDate: startDate,
        endDate: endDate,
        name: name.toString(),
        category: row[COL.CATEGORY] ? row[COL.CATEGORY].toString() : '',
        type: row[COL.TYPE] ? row[COL.TYPE].toString() : '',
        frequency: row[COL.FREQUENCY] ? row[COL.FREQUENCY].toString() : 'Monthly',
        amount: parsedAmount,
        account: row[COL.ACCOUNT] ? row[COL.ACCOUNT].toString() : '',
        source: row[COL.SOURCE] ? row[COL.SOURCE].toString() : '',
        owner: row[COL.OWNER] ? row[COL.OWNER].toString() : '',
        notes: row[COL.NOTES] ? row[COL.NOTES].toString() : ''
        // Status and nextPayment calculated client-side
      });

      processedCount++;
    }

    return {
      success: true,
      recurring: recurring,
      meta: {
        totalRows: dataRows.length,
        processedRows: processedCount,
        skippedRows: skippedCount,
        range: actualRange,
        lastRow: lastRow
      }
    };

  } catch (error) {
    console.log("ERROR in getRecurringData: " + error.toString());
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}


/**
 * Simplified clearRecurringTransaction - Only clears columns C-M
 * @param {string} transactionId - Transaction ID to clear
 * @return {Object} Result object
 */
function clearRecurringTransaction(transactionId) {
  try {
    const sheet = getBudgetSheet("Recurring");
    
    if (!sheet) {
      return { success: false, error: "Recurring sheet not found" };
    }

    // Find the transaction
    const finder = sheet.createTextFinder(transactionId.toString())
                       .matchEntireCell(true)
                       .matchCase(false)
                       .useRegularExpression(false)
                       .findNext();
    
    if (!finder) {
      return {
        success: false,
        error: "Recurring transaction not found: " + transactionId
      };
    }

    const rowIndex = finder.getRow();
    
    // Clear only columns C through N(12 columns)
    sheet.getRange(rowIndex, 3, 1, 12).clearContent();
    // Update any caches
   updateDataTimestamp('masterData');
    updateDataTimestamp('recurring');
    
    return {
      success: true,
      message: "Recurring transaction row cleared successfully",
      transactionId: transactionId,
      rowIndex: rowIndex
    };

  } catch (error) {
    Logger.log("Error in clearRecurringTransaction: " + error.toString());
    return { success: false, error: error.toString() };
  }
}


/**
 * Optimized saveRecurringTransaction - Fixed range C6:N500 for maximum performance
 * @param {Array} recurring - Array of recurring transaction objects
 * @return {Object} Result object
 */
function saveRecurringTransaction(recurring) {
  try {
    const sheet = getBudgetSheet("Recurring");
    
    if (!sheet) {
      return { success: false, error: "Recurring sheet not found" };
    }

    // FIXED RANGE: Read existing data C6:N500 (495 rows, 12 columns)
    const FIXED_DATA_RANGE = "C6:N500";
    const existingData = sheet.getRange(FIXED_DATA_RANGE).getValues();
    
    // Fixed column indices (same as getRecurringData)
    const COL = {
      TRANSACTION_ID: 0,  // Column C
      START_DATE: 1,      // Column D
      NAME: 2,            // Column E
      CATEGORY: 3,        // Column F
      TYPE: 4,            // Column G
      FREQUENCY: 5,       // Column H
      AMOUNT: 6,          // Column I
      ACCOUNT: 7,         // Column J
      END_DATE: 8,        // Column K
      OWNER: 9,           // Column L
      NOTES: 10,          // Column M
      SOURCE: 11          // Column N
    };

    // Build ID map and find available holes
    const idMap = {};
    const holes = [];
    
    existingData.forEach((row, index) => {
      const rowNumber = index + 6; // Actual sheet row
      const id = row[COL.TRANSACTION_ID];
      
      if (id && id.toString().trim() !== '') {
        idMap[id] = index; // Store array index, not sheet row
      } else {
        holes.push(index); // Store array index for holes
      }
    });

    // Prepare batch updates
    const rowsToUpdate = [...existingData]; // Copy existing data
    const updatedRows = new Set();
    let insertCount = 0;
    let updateCount = 0;

    // Process each recurring transaction
    for (const item of recurring) {
      if (!item.amount || parseFloat(item.amount) <= 0) continue;
      
      // Create values array
      const values = new Array(12);
      
      // Fill values using fixed column indices
      values[COL.TRANSACTION_ID] = item.id || `REC-${Date.now()}`;
      values[COL.START_DATE] = item.startDate ? createDateOnly(item.startDate) : createDateOnly(new Date());
      values[COL.NAME] = item.name || '';
      
      // Handle category - preserve Income emoji or use cache
      if (item.category === 'Income 💵') {
        values[COL.CATEGORY] = 'Income 💵';
      } else {
        values[COL.CATEGORY] = getZategoryFromCache(item.category);
      }
      
      values[COL.TYPE] = item.type || 'TRUE';
      values[COL.FREQUENCY] = item.frequency || 'Monthly';
      values[COL.AMOUNT] = parseFloat(item.amount) || 0;
      values[COL.ACCOUNT] = (item.account && item.account.trim() !== '') ? item.account : 'Other';
      values[COL.END_DATE] = item.endDate ? createDateOnly(item.endDate) : '';
      values[COL.OWNER] = ''; // Always empty for now
      values[COL.NOTES] = item.notes || '';
      values[COL.SOURCE] = item.source || '';

      // Find where to place this transaction
      const existingIndex = idMap[item.id];
      
      if (existingIndex !== undefined) {
        // Update existing row
        rowsToUpdate[existingIndex] = values;
        updatedRows.add(existingIndex);
        updateCount++;
      } else {
        // Insert in available hole or at end
        const targetIndex = holes.length > 0 ? holes.shift() : null;
        
        if (targetIndex !== null) {
          // Use available hole
          rowsToUpdate[targetIndex] = values;
          updatedRows.add(targetIndex);
          idMap[item.id] = targetIndex;
        } else {
          // Find first empty row at end
          let insertIndex = -1;
          for (let i = 0; i < rowsToUpdate.length; i++) {
            if (!updatedRows.has(i) && 
                (!rowsToUpdate[i][COL.TRANSACTION_ID] || 
                 rowsToUpdate[i][COL.TRANSACTION_ID].toString().trim() === '')) {
              insertIndex = i;
              break;
            }
          }
          
          if (insertIndex !== -1) {
            rowsToUpdate[insertIndex] = values;
            updatedRows.add(insertIndex);
            idMap[item.id] = insertIndex;
          }
        }
        insertCount++;
      }
    }

    // Write only changed rows instead of entire range
    const changedRows = Array.from(updatedRows);
    for (const rowIndex of changedRows) {
      const sheetRow = rowIndex + 6; // Convert to actual sheet row number
      sheet.getRange(sheetRow, 3, 1, 12).setValues([rowsToUpdate[rowIndex]]);
    }
    
    // Update timestamps
    updateDataTimestamp('masterData');
    updateDataTimestamp('recurring');


    return {
      success: true,
      updated: updateCount,
      inserted: insertCount,
      totalProcessed: updateCount + insertCount,
      rowsModified: changedRows.length
    };

  } catch (error) {
    Logger.log("Error in saveRecurringTransaction: " + error.toString());
    return { success: false, error: error.toString() };
  }
}