/**
 * Simplify Budget - Google Sheets Budget Management App
 * Built on a modular architecture for improved performance
 */



/**
 * Returns the HTML content for the web app
 * Handles ?authorizeDrive=1 parameter to force Drive scope authorization
 */
function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Simplify Budget")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes an HTML file in another HTML file
 * @param {string} filename - The name of the file to include
 * @return {string} The contents of the file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Sets the budget sheet URL for the current session
 * @param {string} url - The Google Sheet URL
 * @return {Object} Success response or error
 */
function setBudgetSheetUrl(url) {
  try {
    Logger.log("Setting budget sheet URL: " + url);
    
    if (!url) {
      return { 
        success: false, 
        error: "No URL provided" 
      };
    }
    
    // Store in user properties
    PropertiesService.getUserProperties().setProperty('BUDGET_SHEET_URL', url);
    
    // Verify it was stored correctly
    const storedUrl = PropertiesService.getUserProperties().getProperty('BUDGET_SHEET_URL');
    Logger.log("Successfully stored URL: " + storedUrl);

    // TRIAL INITIATION: Start trial when user connects via manual URL
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (userEmail) recordFirstUse(userEmail);
    } catch (e) {
      // Completely silent - don't break anything
    }

    return {
      success: true,
      message: "URL set successfully"
    };
  } catch (error) {
    Logger.log("Error setting sheet URL: " + error);
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}

/**
 * Parse a Google Sheet URL to extract spreadsheet ID and sheet GID
 * @param {string} url - Full Google Sheet URL
 * @return {Object} Object with spreadsheetId and sheetId
 */
function parseSheetUrl(url) {
  try {
    // Extract spreadsheet ID
    const spreadsheetIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = spreadsheetIdMatch ? spreadsheetIdMatch[1] : null;
    
    // Extract GID
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    const sheetId = gidMatch ? gidMatch[1] : null;
    
    return {
      success: true,
      spreadsheetId: spreadsheetId,
      sheetId: sheetId
    };
  } catch (error) {
    return {
      success: false,
      error: "Could not parse Sheet URL: " + error.toString()
    };
  }
}

function verifySheetUrl(url) {
  try {
    if (!url) return { success: false, error: "No URL provided" };
    
    const parsedUrl = parseSheetUrl(url);
    if (!parsedUrl.success) return parsedUrl;
    
    const { spreadsheetId, sheetId } = parsedUrl;
    
    if (!spreadsheetId) return { success: false, error: "Could not extract spreadsheet ID from URL" };
    
    try {
      // Just verify we can open the spreadsheet
      const ss = SpreadsheetApp.openById(spreadsheetId);
      
      // ALWAYS save the IDs if we got this far - don't waste time looking for specific sheets
      const userProps = PropertiesService.getUserProperties();
      userProps.setProperty("BUDGET_SPREADSHEET_ID", spreadsheetId);
      if (sheetId) userProps.setProperty("BUDGET_SHEET_ID", sheetId);
      userProps.setProperty('BUDGET_SHEET_URL', url);
      
      return { success: true, message: "Sheet URL verified and accessible" };
    } catch (e) {
      return { success: false, error: "Cannot access this sheet. Make sure it's shared with you." };
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Get a sheet from spreadsheet using cached URL (failsafe approach)
 * @return {SpreadsheetApp.Sheet} Sheet object or null
 */
function getBudgetSheet(sheetName) {
  try {
    // Get the cached URL - this is fastest and most reliable
    const props = PropertiesService.getUserProperties();
    const sheetUrl = props.getProperty('BUDGET_SHEET_URL');
    
    if (!sheetUrl) {
      Logger.log("Missing cached sheet URL");
      // This error message is specifically checked by frontend to show welcome screen
      throw new Error("No spreadsheet ID found");
    }
    
    // Open the spreadsheet by URL directly
    const ss = SpreadsheetApp.openByUrl(sheetUrl);
    if (!ss) throw new Error("Cannot access spreadsheet");
    
    // If sheet name provided, return that sheet
    if (sheetName) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
      return sheet;
    }
    
    // Otherwise return the first sheet by default
    return ss.getSheets()[0];
  } catch (error) {
    Logger.log("Error in getBudgetSheet: " + error.toString());
    throw error; // Re-throw to propagate to calling functions
  }
}




/**
 * Get user credentials
 * @return {Object} User credentials
 */
function getUserCredentials() {
  try {
    const props = PropertiesService.getUserProperties();
    
    return {
      success: true,
      email: Session.getActiveUser().getEmail(),
      sheetUrl: props.getProperty('BUDGET_SHEET_URL') || ''
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Sets a user property
 * @param {string} key - The property key
 * @param {string} value - The property value
 * @return {Object} Result with success flag
 */
function setUserProperty(key, value) {
  try {
    PropertiesService.getUserProperties().setProperty(key, value);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}



/**
 * Save sheet ID from picker - uses drive.file scope only!
 * Also records first use for trial tracking
 */
function saveSheetFromPicker(fileId, fileName) {
  try {
    console.log("Attempting to access file:", fileId);
    
    const spreadsheet = SpreadsheetApp.openById(fileId);
    const actualFileName = spreadsheet.getName();
    
    const userProps = PropertiesService.getUserProperties();
    userProps.setProperty("BUDGET_SPREADSHEET_ID", fileId);
    userProps.setProperty('BUDGET_SHEET_URL', `https://docs.google.com/spreadsheets/d/${fileId}/edit`);
    
    // TRIAL INITIATION: Start trial when user first connects (FAIL-SAFE)
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (userEmail) recordFirstUse(userEmail);
    } catch (e) {
      // Completely silent - don't break anything
    }
    
    return { success: true, fileName: actualFileName };
  } catch (e) {
    console.error("Error details:", e.toString());
    return { success: false, error: "Cannot access file: " + e.message || e.toString() };
  }
}

/**
 * Test server connection
 * @param {string} sheetUrl - Optional sheet URL to set
 * @return {Object} Simple response to verify connection
 */
function testServerConnection(sheetUrl) {
  try {
    // If URL provided, store it
    if (sheetUrl) {
      const result = setBudgetSheetUrl(sheetUrl);
      if (!result.success) {
        return { success: false, error: result.error };
      }
    }
    
    return {
      success: true,
      timestamp: new Date().toString(),
      message: "Server connection successful",
      userEmail: Session.getActiveUser().getEmail()
    };
  } catch (error) {
    Logger.log("Error in testServerConnection: " + error.toString());
    return { success: false, error: error.toString() };
  }
}



function setCurrencyInSheet(currencySymbol) {
  try {

    // Get user settings for decimal places
    const userProps = PropertiesService.getUserProperties();
    const showDecimals = userProps.getProperty("showDecimals") === "true";
    
    // Generate the currency format once
    const numberFormat = getCurrencyFormat(currencySymbol, showDecimals);
    
    // 1. Format Income:F5:F sheet
    const incomeSheet = getBudgetSheet("Income");
    if (incomeSheet) {
      incomeSheet.getRange("F5:F").setNumberFormat(numberFormat);
      Logger.log("Applied format to Income sheet range F5:F");
    }

    // 2. Format Expenses:F5:F sheet
    const expensesSheet = getBudgetSheet("Expenses");
    if (expensesSheet) {
      expensesSheet.getRange("F5:F").setNumberFormat(numberFormat);
      Logger.log("Applied format to Expenses sheet range F5:F");
    }

    // 3. Format recurring:I6:I sheet
    const recurringSheet = getBudgetSheet("recurring");
    if (recurringSheet) {
      recurringSheet.getRange("I6:I").setNumberFormat(numberFormat);
      Logger.log("Applied format to recurring sheet range I6:I");
    }

    // 4. Format Net Worth ranges
    const netWorthSheet = getBudgetSheet("Net Worth");
    if (netWorthSheet) {

      netWorthSheet.getRange("H37:H").setNumberFormat(numberFormat);
      netWorthSheet.getRange("D5:P18").setNumberFormat(numberFormat);
      netWorthSheet.getRange("J37:J").setNumberFormat(numberFormat);
      
    }


   // 10. Format Setup sheet with specific currency ranges
    const setupSheet = getBudgetSheet("Reports");
    if (setupSheet) {
      // Format specific ranges that contain monetary values
      setupSheet.getRange("E6:L7").setNumberFormat(numberFormat);
      setupSheet.getRange("I61:K71").setNumberFormat(numberFormat);
      setupSheet.getRange("B78:D109").setNumberFormat(numberFormat);
      setupSheet.getRange("F78:F109").setNumberFormat(numberFormat);
      setupSheet.getRange("I78:K109").setNumberFormat(numberFormat);
      setupSheet.getRange("M78:M109").setNumberFormat(numberFormat);
      setupSheet.getRange("C26:D55").setNumberFormat(numberFormat);
      setupSheet.getRange("J26:J55").setNumberFormat(numberFormat);
      setupSheet.getRange("M26:N55").setNumberFormat(numberFormat);
      
      Logger.log("Applied format to Setup sheet specific currency ranges");
    }
    
    return { success: true };
  } catch (e) {
    Logger.log("Error in setCurrencyInSheet: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

/**
 * Get the proper Google Sheets number format for a given currency symbol
 * @param {string} symbol - Currency symbol
 * @param {boolean} showDecimals - Whether to show decimal places (defaults to false)
 * @return {string} Google Sheets number format pattern
 */
function getCurrencyFormat(symbol, showDecimals = false) {
  // Base formats with or without decimals
  const decimalSuffix = showDecimals ? ".00" : "";
  
  // Common currency formats
  const formats = {
    '$': `"$"#,##0${decimalSuffix};("$"#,##0${decimalSuffix})`,
    '€': `[$€]#,##0${decimalSuffix};([$€]#,##0${decimalSuffix})`,
    '£': `"£"#,##0${decimalSuffix};("£"#,##0${decimalSuffix})`,
    '¥': `"¥"#,##0${decimalSuffix};("¥"#,##0${decimalSuffix})`,
    '₹': `"₹"#,##0${decimalSuffix};("₹"#,##0${decimalSuffix})`,
    '₽': `"₽"#,##0${decimalSuffix};("₽"#,##0${decimalSuffix})`,
    '₺': `"₺"#,##0${decimalSuffix};("₺"#,##0${decimalSuffix})`,
    'C$': `"C$"#,##0${decimalSuffix};("C$"#,##0${decimalSuffix})`,
    'A$': `"A$"#,##0${decimalSuffix};("A$"#,##0${decimalSuffix})`,
    'CHF': `CHF#,##0${decimalSuffix};(CHF#,##0${decimalSuffix})`,
    'R$': `"R$"#,##0${decimalSuffix};("R$"#,##0${decimalSuffix})`,
    '₩': `"₩"#,##0${decimalSuffix};("₩"#,##0${decimalSuffix})`,
    'RM': `"RM"#,##0${decimalSuffix};("RM"#,##0${decimalSuffix})`,
    '฿': `"฿"#,##0${decimalSuffix};("฿"#,##0${decimalSuffix})`,
    '₦': `"₦"#,##0${decimalSuffix};("₦"#,##0${decimalSuffix})`,
    // New currencies added:
    'S$': `"S$"#,##0${decimalSuffix};("S$"#,##0${decimalSuffix})`,
    'HK$': `"HK$"#,##0${decimalSuffix};("HK$"#,##0${decimalSuffix})`,
    'R': `"R"#,##0${decimalSuffix};("R"#,##0${decimalSuffix})`,
    'kr': `"kr"#,##0${decimalSuffix};("kr"#,##0${decimalSuffix})`,
    'NZ$': `"NZ$"#,##0${decimalSuffix};("NZ$"#,##0${decimalSuffix})`,
    'zł': `"zł"#,##0${decimalSuffix};("zł"#,##0${decimalSuffix})`,
    '﷼': `"﷼"#,##0${decimalSuffix};("﷼"#,##0${decimalSuffix})`,
    'Rp': `"Rp"#,##0${decimalSuffix};("Rp"#,##0${decimalSuffix})`,
    '₱': `"₱"#,##0${decimalSuffix};("₱"#,##0${decimalSuffix})`,
    'NT$': `"NT$"#,##0${decimalSuffix};("NT$"#,##0${decimalSuffix})`,
    'د.إ': `"د.إ"#,##0${decimalSuffix};("د.إ"#,##0${decimalSuffix})`,
    'د.ا': `"د.ا"#,##0${decimalSuffix};("د.ا"#,##0${decimalSuffix})`,
    '₫': `"₫"#,##0${decimalSuffix};("₫"#,##0${decimalSuffix})`,
    '₴': `"₴"#,##0${decimalSuffix};("₴"#,##0${decimalSuffix})`
  };
  
  // Return the specific format or default to a generic one with the given symbol
  return formats[symbol] || `"${symbol}"#,##0${decimalSuffix};("${symbol}"#,##0${decimalSuffix})`;
}


/**
 * Enhanced setUserSettings with separate timestamp storage
 * Saves timestamp to Dontedit J8, data to Dontedit K8
 * @param {Object} settings - The settings object to save
 * @return {Object} Result with success status and timestamp
 */
function setUserSettings(settings) {
  try {
    const sheet = getBudgetSheet("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Create timestamp
    const timestamp = new Date().toISOString();
    
    // Prepare data without timestamp (clean JSON)
    const cleanSettingsData = {
      settings: settings,
      version: 1
    };
    
    // Save timestamp to J8, data to K8
    sheet.getRange("J8").setValue(timestamp);
    sheet.getRange("K8").setValue(JSON.stringify(cleanSettingsData));
    
    // Cache handled by CacheManager on frontend
    // Server-side doesn't cache in properties
    
    return { 
      success: true, 
      timestamp: timestamp 
    };
    
  } catch (error) {
    Logger.log("Error in setUserSettings: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Update last active timestamp in Dontedit D8
 * @return {Object} Success response or error
 */
function updateLastActiveTimestamp() {
  try {
    const sheet = getBudgetSheet("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Create timestamp
    const timestamp = new Date().toISOString();
    
    // Save timestamp to D8
    sheet.getRange("D8").setValue(timestamp);
    
    Logger.log("Updated last active timestamp to: " + timestamp);
    
    return { 
      success: true, 
      timestamp: timestamp 
    };
    
  } catch (error) {
    Logger.log("Error in updateLastActiveTimestamp: " + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Get user settings from Dontedit K8
 * @param {boolean} useCache - Whether to use cached data
 * @return {Object} Settings data
 */
function getUserSettings(useCache = true) {
  try {
    // Check cache first using CacheManager
    if (useCache) {
      // This would be handled by CacheManager on the frontend
      // Server-side always fetches fresh from sheet
    }
    
    const sheet = getBudgetSheet("Dontedit");
    
    if (!sheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Get data from K8 only (no timestamp)
    const dataCell = sheet.getRange("K8").getValue();
    
    // Handle empty data case
    if (!dataCell) {
      const emptySettings = {
        settings: {},
        version: 1
      };
      
      // Initialize data cell
      sheet.getRange("K8").setValue(JSON.stringify(emptySettings));
      
      return { 
        success: true, 
        settings: emptySettings.settings
      };
    }
    
    // Parse data
    let settingsData;
    try {
      settingsData = JSON.parse(dataCell);
    } catch (e) {
      return { success: false, error: "Invalid JSON in settings data cell K8: " + e.toString() };
    }
    
    // Add version if missing
    if (!settingsData.version) {
      settingsData.version = 1;
    }
    
    // Cache data handled by CacheManager on frontend
    // Server-side doesn't cache in properties
    
    return {
      success: true,
      settings: settingsData.settings || settingsData
    };
    
  } catch (error) {
    Logger.log("Error in getUserSettings: " + error.toString());
    return { success: false, error: error.toString() };
  }
}



/**
 * Fix missing transaction IDs - user-triggered from settings
 */
function fixMissingTransactionIds() {
  try {
    let totalFixed = 0;
    const results = [];
    const sheetsModified = []; // Track which sheets were actually modified
    
    // Define sheets to check with correct ranges and prefixes
    const sheetsToFix = [
      { 
        name: 'Expenses', 
        dataRange: { start: 5, end: 11 }, 
        idCol: 4, // D column
        startRow: 6, // D6:D
        prefix: 'ex-'
      },
      { 
        name: 'Income', 
        dataRange: { start: 5, end: 10 }, 
        idCol: 4, // D column
        startRow: 5, // D5:D
        prefix: 'inc-'
      },
      { 
        name: 'Recurring', 
        dataRange: { start: 6, end: 12 }, 
        idCol: 3, // C column
        startRow: 6, // C6:C
        prefix: 'rec-'
      },
      { 
        name: 'Net Worth', 
        dataRange: { start: 6, end: 12 }, 
        idCol: 3, // C column
        startRow: 37, // C37:C
        prefix: 'net-'
      }
    ];
    
    sheetsToFix.forEach(sheetConfig => {
      const sheet = getBudgetSheet(sheetConfig.name);
      if (!sheet) {
        results.push(`${sheetConfig.name}: Sheet not found`);
        return;
      }
      
      const lastRow = sheet.getLastRow();
      if (lastRow < sheetConfig.startRow) {
        results.push(`${sheetConfig.name}: No data to check`);
        return;
      }
      
      let fixedInSheet = 0;
      
      // Calculate the range from startRow to lastRow
      const rowsToCheck = lastRow - sheetConfig.startRow + 1;
      
      // Read transaction IDs and data
      const idRange = sheet.getRange(sheetConfig.startRow, sheetConfig.idCol, rowsToCheck, 1);
      const ids = idRange.getValues().flat();
      
      const dataRange = sheet.getRange(sheetConfig.startRow, sheetConfig.dataRange.start, rowsToCheck, sheetConfig.dataRange.end - sheetConfig.dataRange.start + 1);
      const dataRows = dataRange.getValues();
      
      // Process each row
      const idsToSet = [];
      for (let i = 0; i < ids.length; i++) {
        const rowNum = i + sheetConfig.startRow;
        const transactionId = ids[i];
        const rowData = dataRows[i];
        
        // Check if row has data - SAME LOGIC as checkDataHealth
        const hasData = rowData.some(cell => 
          cell !== null && cell !== undefined && cell !== ''
        );
        
        if (hasData) {
          // Check for missing IDs OR purely numeric IDs (both need fixing)
          const needsNewId = !transactionId || transactionId === '' || /^\d+$/.test(transactionId.toString());
          
          if (needsNewId) {
            const randomNumber = Math.random().toString(36).substr(2, 9);
            const newId = `${sheetConfig.prefix}${Date.now()}-${randomNumber}`;
            idsToSet.push({ row: rowNum, id: newId });
            fixedInSheet++;
          }
        }
      }
      
      // Batch update the missing/numeric IDs
      if (idsToSet.length > 0) {
        idsToSet.forEach(item => {
          sheet.getRange(item.row, sheetConfig.idCol).setValue(item.id);
        });
        
        // Track that this sheet was modified
        sheetsModified.push(sheetConfig.name);
      }
      
      totalFixed += fixedInSheet;
      results.push(`${sheetConfig.name}: Fixed ${fixedInSheet} rows`);
    });
    
    // Only update timestamps for sheets that were actually modified
    if (totalFixed > 0) {
      // Always update masterData since core data integrity was affected
      updateDataTimestamp('masterData');
      
      // Update specific timestamps based on which sheets were modified
      sheetsModified.forEach(sheetName => {
        if (sheetName === 'Expenses') {
          updateDataTimestamp('budget'); // Expenses affect budget calculations
        }
        if (sheetName === 'Income') {
          updateDataTimestamp('income');
          updateDataTimestamp('budget'); // Income also affects budget
        }
        if (sheetName === 'Recurring') {
          updateDataTimestamp('recurring');
        }
        if (sheetName === 'Net Worth') {
          updateDataTimestamp('netWorth');
        }
      });
    }
    
    return {
      success: true,
      totalFixed: totalFixed,
      results: results,
      sheetsModified: sheetsModified
    };
    
  } catch (error) {
    Logger.log("Error in fixMissingTransactionIds: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Check data health - provides statistics about data integrity
 */
function checkDataHealth() {
  try {
    let totalRows = 0;
    let missingIds = 0;
    let duplicateIds = 0;
    let numericIds = 0; // NEW: Track purely numeric IDs that need fixing
    const results = [];
    const allIds = new Set();
    const duplicatedIds = new Set();
    
    // Define sheets to check - ALIGNED with fixMissingTransactionIds
    const sheetsToCheck = [
      { 
        name: 'Expenses', 
        dataRange: { start: 5, end: 11 }, 
        idCol: 4, // D column
        startRow: 6, // D6:D
        prefix: 'ex-'
      },
      { 
        name: 'Income', 
        dataRange: { start: 5, end: 10 }, 
        idCol: 4, // D column
        startRow: 5, // D5:D
        prefix: 'inc-'
      },
      { 
        name: 'Recurring', 
        dataRange: { start: 6, end: 12 }, 
        idCol: 3, // C column
        startRow: 6, // C6:C
        prefix: 'rec-'
      },
      { 
        name: 'Net Worth', 
        dataRange: { start: 6, end: 12 }, 
        idCol: 3, // C column
        startRow: 37, // C37:C
        prefix: 'net-'
      }
    ];
    
    sheetsToCheck.forEach(sheetConfig => {
      const sheet = getBudgetSheet(sheetConfig.name);
      if (!sheet) {
        results.push(`${sheetConfig.name}: Sheet not found`);
        return;
      }
      
      const lastRow = sheet.getLastRow();
      if (lastRow < sheetConfig.startRow) {
        results.push(`${sheetConfig.name}: No data to check`);
        return;
      }
      
      // Calculate the range from startRow to lastRow
      const rowsToCheck = lastRow - sheetConfig.startRow + 1;
      totalRows += rowsToCheck;
      
      // Read transaction IDs and data - SAME LOGIC as fixMissingTransactionIds
      const idRange = sheet.getRange(sheetConfig.startRow, sheetConfig.idCol, rowsToCheck, 1);
      const ids = idRange.getValues().flat();
      
      const dataRange = sheet.getRange(sheetConfig.startRow, sheetConfig.dataRange.start, rowsToCheck, sheetConfig.dataRange.end - sheetConfig.dataRange.start + 1);
      const dataRows = dataRange.getValues();
      
      let sheetMissingIds = 0;
      let sheetDuplicates = 0;
      let sheetDataRows = 0;
      let sheetNumericIds = 0; // NEW: Track numeric IDs in this sheet
      
      // Process each row - SAME LOGIC as fixMissingTransactionIds
      for (let i = 0; i < ids.length; i++) {
        const transactionId = ids[i];
        const rowData = dataRows[i];
        
        // Check if row has data - EXACT SAME CHECK
        const hasData = rowData.some(cell => 
          cell !== null && cell !== undefined && cell !== ''
        );
        
        if (hasData) {
          sheetDataRows++;
          
          // Check for missing IDs - SAME LOGIC
          if (!transactionId || transactionId === '') {
            sheetMissingIds++;
          } else {
            // NEW: Check if ID is purely numeric (needs fixing)
            const idString = transactionId.toString();
            const isPurelyNumeric = /^\d+$/.test(idString);
            
            if (isPurelyNumeric) {
              sheetNumericIds++;
            }
            
            // Check for duplicates
            if (allIds.has(transactionId)) {
              duplicatedIds.add(transactionId);
              sheetDuplicates++;
            } else {
              allIds.add(transactionId);
            }
          }
        }
      }
      
      missingIds += sheetMissingIds;
      duplicateIds += sheetDuplicates;
      numericIds += sheetNumericIds; // NEW: Add to total
      
      // NEW: Updated result message to include numeric IDs
      results.push(`${sheetConfig.name}: ${sheetDataRows} data rows, ${sheetMissingIds} missing IDs, ${sheetNumericIds} numeric IDs, ${sheetDuplicates} duplicates`);
    });
    
    return {
      success: true,
      totalRows: totalRows,
      missingIds: missingIds,
      numericIds: numericIds, // NEW: Return numeric ID count
      duplicateIds: duplicateIds,
      results: results,
      duplicatedIdsList: Array.from(duplicatedIds)
    };
    
  } catch (error) {
    Logger.log("Error in checkDataHealth: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}


// Add this to your server-side code
function getPickerConfig() {
  try {
    const token = ScriptApp.getOAuthToken();
    return { 
      success: true, 
      token: token
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Create a new budget sheet from template for first-time users
 * @return {Object} Result with sheet ID and URL
 */
function createBudgetSheetFromTemplate() {
  try {
    // Template sheet ID from the provided URL
    const TEMPLATE_SHEET_ID = '1fA8lHlDC8bZKVHSWSGEGkXHNmVylqF0Ef2imI_2jkZ8';
    
    // Get the template spreadsheet
    const templateSpreadsheet = SpreadsheetApp.openById(TEMPLATE_SHEET_ID);
    
    // Create a copy with timestamp only
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
    const newSheetName = `SimplifyBudget_${timestamp}`;
    
    // Make a copy to user's Drive
    const newSpreadsheet = templateSpreadsheet.copy(newSheetName);
    const newSpreadsheetId = newSpreadsheet.getId();
    
    // Save the new sheet ID to user properties
    const userProps = PropertiesService.getUserProperties();
    userProps.setProperty("BUDGET_SPREADSHEET_ID", newSpreadsheetId);
    userProps.setProperty('BUDGET_SHEET_URL', newSpreadsheet.getUrl());

    // TRIAL INITIATION: Start trial when user creates new sheet from template
    try {
      const userEmail = Session.getActiveUser().getEmail();
      if (userEmail) recordFirstUse(userEmail);
    } catch (e) {
      // Completely silent - don't break anything
    }

    return {
      success: true,
      spreadsheetId: newSpreadsheetId,
      url: newSpreadsheet.getUrl(),
      name: newSheetName
    };
  } catch (error) {
    Logger.log("Error creating sheet from template: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Force spreadsheet authorization flow (for web app consent dialog)
 * @return {Object} Result with success status
 */
function requireSpreadsheetAuthorization() {
  const TEMPLATE_SHEET_ID = '1fA8lHlDC8bZKVHSWSGEGkXHNmVylqF0Ef2imI_2jkZ8';
  SpreadsheetApp.openById(TEMPLATE_SHEET_ID);
  return { success: true };
}

/**
 * Get the re-authorization URL to prompt user for all scopes again
 * This is needed when users unchecked drive.file during initial setup
 * @return {Object} Result with the authorization URL
 */
function getDriveAuthorizationUrl() {
  try {
    // Get the authorization URL - this will prompt for ALL scopes again
    // including drive.file that they may have unchecked
    const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    const authUrl = authInfo.getAuthorizationUrl();

    // authUrl will be null if user has all scopes - but they might have
    // unchecked drive.file, so we can't rely on this. Always return a URL.
    if (authUrl) {
      return { success: true, url: authUrl };
    }

    // If no auth URL returned, user may have all scopes OR
    // may have unchecked optional ones. We can't tell the difference.
    // Return the web app URL which will re-trigger auth if needed.
    let webAppUrl = ScriptApp.getService().getUrl().replace('/dev', '/exec');
    return { success: true, url: webAppUrl, note: 'full_auth' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Force Drive authorization flow (needed for Picker file listing)
 * @return {Object} Result with success status
 */
function requireDriveAuthorization() {
  const userProps = PropertiesService.getUserProperties();
  const flag = userProps.getProperty('DRIVE_FILE_AUTH_OK');
  if (!flag) {
    // Create + trash a tiny temp file to trigger drive.file consent
    const blob = Utilities.newBlob('auth-check', 'text/plain', 'SimplifyBudgetAuthCheck.txt');
    const file = DriveApp.createFile(blob);
    file.setTrashed(true);
    userProps.setProperty('DRIVE_FILE_AUTH_OK', '1');
  }
  return { success: true };
}

/**
 * Check if spreadsheet scope is already authorized.
 * Attempts to get an OAuth token scoped to spreadsheets.
 * @return {Object} { success: true, hasPermission: boolean }
 */
function checkSheetsPermission() {
  try {
    const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    const status = authInfo.getAuthorizationStatus();
    return {
      success: true,
      hasPermission: status !== ScriptApp.AuthorizationStatus.REQUIRED
    };
  } catch (error) {
    return { success: true, hasPermission: false };
  }
}

/**
 * Get authorization URL for required scopes, if needed.
 * @return {Object} Result with optional authorization URL
 */
function getAuthorizationUrl() {
  try {
    const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    if (authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
      return { success: true, url: authInfo.getAuthorizationUrl() };
    }
    return { success: true, url: null };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Disconnect budget sheet (remove from user properties)
 * @return {Object} Result with success status
 */
function disconnectBudgetSheet() {
  try {
    const userProps = PropertiesService.getUserProperties();
    userProps.deleteProperty("BUDGET_SPREADSHEET_ID");
    userProps.deleteProperty("BUDGET_SHEET_URL");
    userProps.deleteProperty("BUDGET_SHEET_ID");
    
    return {
      success: true,
      message: "Budget sheet disconnected successfully"
    };
  } catch (error) {
    Logger.log("Error disconnecting sheet: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * TRIAL SYSTEM - Record first use when user connects template
 */

// Secret tracking sheet ID - users cannot see this
const TRIAL_TRACKING_SHEET = PropertiesService.getScriptProperties().getProperty('TRIAL_TRACKING_SHEET');


// Secret encryption key
const ENCRYPTION_KEY = PropertiesService.getScriptProperties().getProperty('ENCRYPTION_KEY');

/**
 * Simple XOR encryption/decryption
 * @param {string} text - Text to encrypt/decrypt
 * @param {string} key - Encryption key
 * @return {string} Encrypted/decrypted text
 */
function xorEncrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/**
 * Obfuscate email address for GDPR compliance
 * @param {string} email - Full email address
 * @return {string} Obfuscated email (first 4 chars + encrypted full email)
 */
function obfuscateEmail(email) {
  if (!email) return '';
  
  // Get first 4 characters (or less if email is shorter)
  const prefix = email.substring(0, 4);
  
  // Encrypt the full email
  const encrypted = xorEncrypt(email, ENCRYPTION_KEY);
  
  // Base64 encode the encrypted data to make it URL-safe
  const encoded = Utilities.base64Encode(encrypted);
  
  // Return prefix + encoded encrypted email
  return prefix + encoded;
}

/**
 * Decode obfuscated email back to original
 * @param {string} obfuscated - Obfuscated email string
 * @return {string} Original email address
 */
function decodeObfuscatedEmail(obfuscated) {
  if (!obfuscated || obfuscated.length <= 4) return '';
  
  try {
    // Extract the encoded part (everything after first 4 chars)
    const encoded = obfuscated.substring(4);
    
    // Decode from base64
    const decoded = Utilities.base64Decode(encoded);
    const encrypted = Utilities.newBlob(decoded).getDataAsString();
    
    // Decrypt using XOR
    const decrypted = xorEncrypt(encrypted, ENCRYPTION_KEY);
    
    return decrypted;
  } catch (e) {
    Logger.log('Error decoding email: ' + e.toString());
    return '';
  }
}

/**
 * Record first use and start trial - BULLETPROOF
 * @param {string} email - User email
 * @return {Object} Trial status result
 */
function recordFirstUse(email) {
  if (!email) {
    return { status: 'error', error: 'No email provided' };
  }
  
  try {
    const sheet = SpreadsheetApp.openById(TRIAL_TRACKING_SHEET).getActiveSheet();
    
    // FAST: Read emails from A3:A100 in one go (98 rows max)
    const emails = sheet.getRange('A3:A100').getValues().flat();
    
    // Check if email already exists
    for (let i = 0; i < emails.length; i++) {
      if (emails[i]) {
        // Decode obfuscated email to compare
        const decodedEmail = decodeObfuscatedEmail(emails[i]);
        if (decodedEmail === email) {
          Logger.log('User already exists in payment sheet: ' + email);
          return checkTrialStatus(email); // Already exists
        }
      }
    }
    
    // Find the next empty row starting from row 3
    let nextEmptyRow = 3;
    for (let i = 0; i < emails.length; i++) {
      if (!emails[i] || emails[i] === '') {
        nextEmptyRow = 3 + i;
        break;
      }
    }
    
    // If no empty rows found in range, use the next row after last email
    if (nextEmptyRow === 3 && emails.length > 0 && emails[emails.length - 1]) {
      // Find last non-empty email
      for (let i = emails.length - 1; i >= 0; i--) {
        if (emails[i]) {
          nextEmptyRow = 3 + i + 1;
          break;
        }
      }
    }
    
    // New user - add to tracking sheet in next available row
    const startDate = new Date();
    const timestamp = new Date();
    
    // Obfuscate email before storing
    const obfuscatedEmail = obfuscateEmail(email);
    
    Logger.log('Recording first use for: ' + email + ' in row: ' + nextEmptyRow);
    // Store start date; leave end date blank on first initialization
    sheet.getRange(nextEmptyRow, 1, 1, 4).setValues([[obfuscatedEmail, startDate, '', timestamp]]);
    
    return { 
      status: 'trial', 
      daysLeft: 30 
    };
  } catch (e) {
    Logger.log('Error in recordFirstUse: ' + e.toString());
    return { status: 'error', error: e.toString() };
  }
}

/**
 * Check current trial status for a user - BULLETPROOF
 * @param {string} email - User email
 * @return {Object} Trial status with days left
 */
function checkTrialStatus(email) {
  if (!email) {
    return { status: 'error', error: 'No email provided' };
  }
  
  try {
    const sheet = SpreadsheetApp.openById(TRIAL_TRACKING_SHEET).getActiveSheet();
    
    // FAST: Read all data from A3:C100 in one go
    const data = sheet.getRange('A3:C100').getValues();
    
    // Find user in tracking sheet
    for (let i = 0; i < data.length; i++) {
      // Decode the obfuscated email to compare
      const storedEmail = data[i][0];
      const decodedEmail = storedEmail ? decodeObfuscatedEmail(storedEmail) : '';
      
      if (decodedEmail === email) {
        const endDate = data[i][2]; // Column C: End_Date
        
        // Update last active timestamp in column D
        const rowNumber = i + 3; // Row 3 + index
        sheet.getRange('D' + rowNumber).setValue(new Date());
        Logger.log('Updated last active for ' + email + ' at row ' + rowNumber);
        
        // NO END DATE = PAID USER
        if (!endDate || endDate === '') {
          return { status: 'paid' };
        }
        
        // VALIDATE END DATE
        const endDateObj = new Date(endDate);
        if (isNaN(endDateObj.getTime())) {
          return { status: 'error', error: 'Invalid end date' };
        }
        
        // CALCULATE DAYS LEFT: end date - today
        const today = new Date();
        const timeDiff = endDateObj.getTime() - today.getTime();
        const daysLeft = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
        
        return { 
          status: daysLeft > 0 ? 'trial' : 'expired', 
          daysLeft: daysLeft
        };
      }
    }
    
    // User not found - record them now and start trial
    return recordFirstUse(email);
  } catch (e) {
    // Return error status instead of crashing
    return { status: 'error', error: e.toString() };
  }
}
