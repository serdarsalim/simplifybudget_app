

// ======== INCOME SERVER FUNCTIONS ========


/**
 * Get income data from Income sheet range D4:J6000 - OPTIMIZED with fixed range
 * Headers: transactionId | Date | Amount | Name | Account | Source | Notes 📝
 * @return {Object} Result with income transactions data
 */
function getIncomeData() {
  try {
    const incomeSheet = getBudgetSheet("Income");
    
    if (!incomeSheet) {
      return { success: false, error: "Income sheet not found" };
    }

    // CHECK IF SHEET IS EMPTY FIRST (this is the key fix!)
    const lastRow = incomeSheet.getLastRow();
    
    // If only headers or less (row 4 or below), return empty immediately
    if (lastRow <= 4) {
      console.log("Income sheet is empty - returning empty array");
      return {
        success: true,
        income: [],
        meta: {
          totalRows: 0,
          processedRows: 0,
          skippedRows: 0,
          isEmpty: true
        }
      };
    }

    
    // Direct column mapping based on known positions
    const columnMap = {
      transactionId: 0,  // Column D
      date: 1,           // Column E  
      amount: 2,         // Column F
      name: 3,           // Column G
      account: 4,        // Column H
      source: 5,         // Column I
      notes: 6           // Column J
    };

    // ONLY READ THE ROWS THAT ACTUALLY HAVE DATA
    const dataStartRow = 5;
    const numRowsToRead = lastRow - dataStartRow + 1;
    
    // Only read if there's actual data
    if (numRowsToRead <= 0) {
      return {
        success: true,
        income: [],
        timestamp: new Date().toISOString(),
        meta: {
          totalRows: 0,
          processedRows: 0,
          skippedRows: 0,
          isEmpty: true
        }
      };
    }
    
    // Read only the actual data range (not 6000 rows!)
    const actualRange = `D${dataStartRow}:J${lastRow}`;
    
    const incomeData = incomeSheet.getRange(actualRange).getValues();
    const displayData = incomeSheet.getRange(actualRange).getDisplayValues();

    const income = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < incomeData.length; i++) {
      const row = incomeData[i];
      const displayRow = displayData[i];
      
      // Skip empty rows
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        skippedCount++;
        continue;
      }

      // Extract data using direct column mapping
      const transactionId = row[columnMap.transactionId] || '';
      const date = row[columnMap.date];
      const amount = row[columnMap.amount];
      const name = row[columnMap.name] || '';
      const account = row[columnMap.account] || '';
      const source = row[columnMap.source] || 'Other';
      const notes = row[columnMap.notes] || '';
      
      // Skip rows without essential data
      if (!amount || parseFloat(amount) <= 0) {
        skippedCount++;
        continue;
      }

      // Parse date - use display value to avoid timezone conversion
      let incomeDate = null;
      if (date) {
        incomeDate = displayRow[1].toString(); // Column E (index 1) contains the date
      }

      // Parse amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        skippedCount++;
        continue;
      }

      income.push({
        id: transactionId || "INC-" + (i + dataStartRow),
        rowIndex: i + dataStartRow,
        date: incomeDate,
        name: name.toString(),
        category: 'Income 💵',
        amount: parsedAmount,
        account: account.toString(),
        source: source.toString(),
        notes: notes.toString()
      });

      processedCount++;
    }

    return {
      success: true,
      income: income,
      meta: {
        totalRows: incomeData.length,
        processedRows: processedCount,
        skippedRows: skippedCount,
        range: actualRange,
        lastRow: lastRow
      }
    };

  } catch (error) {
    console.log("ERROR in getIncomeData: " + error.toString());
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}

/**
 * Save batch income transactions - FIXED with correct column order
 * D=transactionId, E=Date, F=Amount, G=Name, H=Account, I=Source, J=Notes
 */
function saveBatchIncome(income) {
  const sh = getBudgetSheet("Income");
  if (!sh) return { success: false, error: "Income sheet missing" };

  // 1) pull only col D (transactionId), build map + empty‐row list
  const startRow = 5;
  const lastRow = Math.max(sh.getLastRow(), startRow);
  const ids = sh.getRange(startRow, 4, lastRow - startRow + 1).getValues().flat(); // Column D = 4
  const map = {};
  const holes = [];
  ids.forEach((id, i) => {
    const r = startRow + i;
    if (id) map[id] = r;
    else if (holes.length < income.length) holes.push(r);
  });

  // 2) separate out updates vs inserts
  const toUpdate = [];
  const toInsert = [];
  for (const e of income) {
    if (!e.amount || +e.amount <= 0) continue;
    const row = map[e.id];
    
    // Create values array matching exact header order: D=transactionId, E=Date, F=Amount, G=Name, H=Account, I=Source, J=Notes
    const values = [
      e.id,                           // D - transactionId
      createDateOnly(e.date),              // E - Date  
      +e.amount,                     // F - Amount
      e.name || e.description || "", // G - Name
      e.account && e.account.trim() !== '' ? e.account : 'Other',  // H - Account
      e.source || "Other",           // I - Source
      e.notes || ""                  // J - Notes
    ];
    
    if (row) {
      toUpdate.push({ row, values });
    } else {
      const target = holes.length ? holes.shift() : ++lastRow;
      toInsert.push({ row: target, values });
      map[e.id] = target;
    }
  }

  // 3) batch‐write updates (D:J = 7 columns)
  toUpdate.forEach(u => {
    sh.getRange(u.row, 4, 1, 7).setValues([u.values]);
  });
  
  // 4) batch‐write inserts (D:J = 7 columns)
  toInsert.forEach(i => {
    sh.getRange(i.row, 4, 1, 7).setValues([i.values]);
  });
  
  // Update master timestamp and income timestamp
 updateDataTimestamp('masterData');
updateDataTimestamp('income');
  return {
    success: true,
    updated: toUpdate.length,
    inserted: toInsert.length,
    reused: income.length - toUpdate.length - toInsert.length
  };
}

/**
 * Clear income transaction row by ID - searches column D, clears D:J
 * @param {string} transactionId - Transaction ID to clear
 * @return {Object} Result object with success status
 */
function clearIncomeRow(transactionId) {
  try {
    // Get the income sheet
    const sheet = getBudgetSheet("Income");
    if (!sheet) {
      return { success: false, error: "Income sheet not found" };
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
        error: "Income transaction not found: " + transactionId
      };
    }
    
    // Determine the row of the found cell
    const rowIndex = finder.getRow();
    
    // Clear the cells in that row (columns D through J = 7 columns)
    sheet.getRange(rowIndex, 4, 1, 7).clearContent();
    
    // Update master timestamp
    updateDataTimestamp('masterData');
    updateDataTimestamp('income');
    
    return {
      success: true,
      message: "Income transaction row cleared successfully",
      transactionId,
      rowIndex
    };
    
  } catch (e) {
    Logger.log("Error in clearIncomeRow: " + e.toString());
    return { success: false, error: e.toString() };
  }
}





/**
 * Get monthly income and expense totals from Dontedit sheet D6:F130
 * D = Month (MMM YYYY), E = Monthly Income, F = Monthly Spending
 * @return {Object} Result with success status and monthly data array
 */
function getMonthlyIncomeAndExpenses() {
  try {
    const sheet = getBudgetSheet("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Get monthly data from D6:F130 (Month, Income, Spending)
    const range = sheet.getRange("D6:F130");
    const values = range.getValues();
    
    const monthlyData = [];
    
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const monthStr = row[0];    // D - Month string "Jan 2025"
      const income = row[1];      // E - Monthly Income
      const expenses = row[2];    // F - Monthly Spending
      
      // Skip empty rows
      if (!monthStr) continue;
      
      // Parse month string to proper date
      let monthDate;
      try {
        // Convert "Jan 2025" to Date object
        monthDate = new Date(monthStr + " 1"); // Add day to make valid date
        if (isNaN(monthDate.getTime())) {
          continue; // Skip invalid dates
        }
      } catch (e) {
        continue; // Skip unparseable dates
      }
      
      // Parse income and expenses
      const incomeTotal = parseFloat(income) || 0;
      const expenseTotal = parseFloat(expenses) || 0;
      
      monthlyData.push({
        month: monthDate.toISOString(),
        monthDisplay: monthStr,
        income: incomeTotal,
        expenses: expenseTotal
      });
    }
    
    Logger.log(`Found ${monthlyData.length} months of income/expense data`);
    
    return {
      success: true,
      monthlyData: monthlyData,
      meta: {
        totalRows: values.length,
        processedRows: monthlyData.length,
        range: "D6:F130"
      }
    };
    
  } catch (error) {
    Logger.log("ERROR in getMonthlyIncomeAndExpenses: " + error.toString());
    return { 
      success: false, 
      error: error.toString()
    };
  }
}


