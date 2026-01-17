// Add this to your Code.gs to handle Income timestamp from Dontedit J12


function getAllTimestamps() {
  try {
    const donteditSheet = getBudgetSheet("Dontedit");
    
    if (!donteditSheet) {
      console.error('Dontedit sheet not found');
      return {
        success: false,
        error: 'Dontedit sheet not found'
      };
    }
    
    // Read all timestamps from their specific cells
    const timestamps = {
      netWorth: donteditSheet.getRange("J6").getValue(),
      recurring: donteditSheet.getRange("J7").getValue(),
      settings: donteditSheet.getRange("J8").getValue(), 
      masterData: donteditSheet.getRange("J9").getValue(), // Transactions = masterData for expenses
      budget: donteditSheet.getRange("J10").getValue(),
      categories: donteditSheet.getRange("J11").getValue(),
      income: donteditSheet.getRange("J12").getValue()
    };
    
    // Convert all to ISO strings
    const now = new Date().toISOString();
    
    Object.keys(timestamps).forEach(key => {
      const value = timestamps[key];
      if (value) {
        if (value instanceof Date) {
          timestamps[key] = value.toISOString();
        } else {
          timestamps[key] = value.toString();
        }
      } else {
        timestamps[key] = now; // Default to now if empty
      }
    });
    
    return {
      success: true,
      timestamps: timestamps
    };
    
  } catch (error) {
    console.error('Error in getAllTimestamps:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}


// In Google Apps Script (server-side)
function updateDataTimestamp(dataType) {
  try {
    const sheet = getBudgetSheet("Dontedit");
    if (!sheet) return;
    
    const timestampCells = {
      'netWorth': 'J6',
      'recurring': 'J7',
      'settings': 'J8',
      'masterData': 'J9',
      'budget': 'J10',
      'categories': 'J11',
      'income': 'J12'
    };
    
    const cell = timestampCells[dataType];
    if (cell) {
      // ALWAYS use ISO format!
      const isoTimestamp = new Date().toISOString();
      sheet.getRange(cell).setValue(isoTimestamp);
      Logger.log(`Updated ${dataType} timestamp to: ${isoTimestamp}`);
    }
  } catch (error) {
    Logger.log(`Error updating ${dataType} timestamp: ${error}`);
  }
}

