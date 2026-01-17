/**
 * UPDATED: Get categories with timestamp from Dontedit sheet
 * CHANGE: Read L10:N39 instead of L10:M39 to include display order from column N
 * Replace your existing getCategoriesWithTimestamp function with this version
 */
function getCategoriesWithTimestamp() {
  try {
    Logger.log("getCategoriesWithTimestamp called");
    
    const setupSheet = getBudgetSheet("Dontedit");
    if (!setupSheet) {
      return {
        success: false,
        error: "Dontedit sheet not found"
      };
    }
    
 
    
    // UPDATED: Get category data from L10:O39 (active, categories, displayOrder, id)
    const range = setupSheet.getRange("L10:O39");
    const values = range.getValues();
    
    // Check if column O needs ID initialization
    let needsIdInit = false;
    const idUpdates = [];
    
    for (let i = 0; i < values.length; i++) {
      const categoryString = values[i][1]; // Column M
      const categoryId = values[i][3];     // Column O
      
      if (categoryString && categoryString !== "" && (categoryId === "" || categoryId == null)) {
        needsIdInit = true;
        idUpdates.push({ row: i + 10, id: i }); // Auto-assign sequential IDs
        values[i][3] = i; // Update local array
      }
    }
    
    // Write missing IDs to spreadsheet
    if (needsIdInit) {
      for (const update of idUpdates) {
        setupSheet.getRange(update.row, 15).setValue(update.id); // Column O = 15
      }
      Logger.log(`Auto-generated ${idUpdates.length} category IDs`);
    }
    
    const categories = [];
    const activeCategories = [];
    
    for (let i = 0; i < values.length; i++) {
      const isActive = values[i][0] === true;    // Column L is checkbox
      const categoryString = values[i][1];       // Column M is category name
      const displayOrder = values[i][2];         // Column N is display order
      const categoryId = values[i][3];           // Column O is stable ID
      
      if (!categoryString || categoryString === "") continue;
      
      // Parse category to extract name and emoji
      const parsed = parseCategoryNameAndEmoji(categoryString);
      
      const categoryObj = {
        id: categoryId !== null && categoryId !== "" ? categoryId : i,  // Use stable ID from column O
        name: parsed.name,
        emoji: parsed.emoji,
        fullName: categoryString,
        active: isActive,
        order: i,                                              // Spreadsheet order (unchanged)
        displayOrder: displayOrder || (i + 1),                // Display order from column N, fallback to order+1
        zategoryFormula: "=zategory" + (i + 1)  // Direct formula: "=zategory1", "=zategory2"...
      };
      
      categories.push(categoryObj);
      
      if (isActive) {
        activeCategories.push(categoryObj);
      }
    }
    
  
    return {
      success: true,
      categories: categories,
      activeCategories: activeCategories,
    };
    
  } catch (error) {
    Logger.log("Error in getCategoriesWithTimestamp: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}


/**
 * Parse category string to extract name and emoji (add this helper function)
 */
function parseCategoryNameAndEmoji(categoryString) {
  const parts = categoryString.trim().split(' ');
  
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2B00}-\u{2BFF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]/gu;

    
    if (emojiRegex.test(lastPart)) {
      const name = parts.slice(0, -1).join(' ');
      const emoji = lastPart;
      return { name, emoji };
    }
  }
  
  return { name: categoryString, emoji: '' };
}

/**
 * Update categories timestamp in Setup!J11
 * @return {Object} Success response
 */
function updateCategoriesTimestamp() {
  return updateDataTimestamp('categories');
}


// Replace the existing updateCategoryStatus function (lines 12-89) with this:

/**
 * Update a category's active status in the spreadsheet
 * @param {string} categoryName - The name of the category to update
 * @param {boolean} active - The new active status
 * @return {Object} Status object with success/error
 */
function updateCategoryStatus(categoryName, active) {
  try {
    // Get Dontedit sheet (changed from "Setup")
    const setupSheet = getBudgetSheet("Dontedit");
    if (!setupSheet) {
      return {
        success: false,
        error: "Dontedit sheet not found" // Changed error message
      };
    }
    
    // Get category names from M10:M39 (changed from G15:G44)
    const categoryRange = setupSheet.getRange("M10:M39").getValues();
    
    // Find the row for this category
    let rowIndex = -1;
    for (let i = 0; i < categoryRange.length; i++) {
      if (categoryRange[i][0] === categoryName) {
        rowIndex = i + 10; // Changed from i + 15 to i + 10 (M10 starts at row 10)
        break;
      }
    }
    
    if (rowIndex === -1) {
      return {
        success: false,
        error: "Category not found in spreadsheet"
      };
    }
    
    // Update the active status in column L (changed from column F=6 to L=12)
    setupSheet.getRange(rowIndex, 12).setValue(active);
    
    // Update categories timestamp in J11 (changed from wherever it was before)
    updateDataTimestamp('categories');
    
    // Cache handled by CacheManager on frontend
    // Server-side doesn't maintain active categories list
    
    return {
      success: true
    };
  } catch (error) {
    Logger.log("Error in updateCategoryStatus: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}



/**
 * Update a category name and/or emoji in the Setup sheet
 * @param {string} oldFullName - Current full name "Food 🍕" 
 * @param {string} newName - New category name "Groceries"
 * @param {string} newEmoji - New emoji "🛒"
 * @return {Object} Success response or error
 */
function updateCategoryName(oldFullName, newName, newEmoji) {
  try {
    Logger.log("updateCategoryName called with:", { oldFullName, newName, newEmoji });
    
    const setupSheet = getBudgetSheet("Dontedit"); // Changed from "Setup" to "Dontedit"
    if (!setupSheet) {
      return {
        success: false,
        error: "Dontedit sheet not found"
      };
    }
    
    // Get category data from M10:M39 (changed from G15:G44)
    const range = setupSheet.getRange("M10:M39");
    const values = range.getValues();
    
    // Find the category to update
    let categoryRowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      const currentValue = values[i][0];
      if (currentValue && currentValue.toString().trim() === oldFullName.trim()) {
        categoryRowIndex = i;
        break;
      }
    }
    
    if (categoryRowIndex === -1) {
      // If exact match not found, try to find by name part
      for (let i = 0; i < values.length; i++) {
        const currentValue = values[i][0];
        if (currentValue && currentValue.toString().includes(newName)) {
          categoryRowIndex = i;
          break;
        }
      }
    }
    
    if (categoryRowIndex === -1) {
      return {
        success: false,
        error: "Category not found in Dontedit sheet: " + oldFullName
      };
    }
    
    // Validate inputs
    if (!newName || !newName.trim()) {
      return {
        success: false,
        error: "Category name cannot be empty"
      };
    }
    
    if (!newEmoji || !newEmoji.trim()) {
      return {
        success: false,
        error: "Category emoji cannot be empty"
      };
    }
    
    // Create the new full name and normalized name
    const trimmedNewName = newName.trim();
    const newFullName = `${trimmedNewName} ${newEmoji.trim()}`;
    const normalizedNewName = trimmedNewName.toLowerCase();
    
    // Check for duplicates (exclude current row)
    for (let i = 0; i < values.length; i++) {
      if (i === categoryRowIndex) continue;
      
      const existingValue = values[i][0];
      if (!existingValue) continue;
      
      const existingFullName = existingValue.toString().trim();
      if (existingFullName === newFullName) {
        return {
          success: false,
          error: "A category with this name and emoji already exists"
        };
      }
      
      const parsedExisting = parseCategoryNameAndEmoji(existingFullName);
      const existingName = parsedExisting.name ? parsedExisting.name.toString().trim().toLowerCase() : existingFullName.toLowerCase();
      if (existingName === normalizedNewName) {
        return {
          success: false,
          error: "A category with this name already exists"
        };
      }
    }
    
    // Update the category in the spreadsheet
    const actualRowNumber = categoryRowIndex + 10; // M10 is row 10 (changed from 15)
    setupSheet.getRange(actualRowNumber, 13).setValue(newFullName); // Column M (changed from G=7 to M=13)
    
    // Update the named range
    const zategoryNumber = categoryRowIndex + 1;
    const namedRangeName = `zategory${zategoryNumber}`;
    
    try {
      Logger.log(`Named range ${namedRangeName} will automatically reference new value: ${newFullName}`);
    } catch (namedRangeError) {
      Logger.log("Note: Named range update not required - automatic reference: " + namedRangeError.toString());
    }
    
    // Update categories timestamp
    try {
      updateDataTimestamp('categories');
      Logger.log("Updated categories timestamp");
    } catch (timestampError) {
      Logger.log("Warning: Could not update categories timestamp: " + timestampError.toString());
    }
    
    // Cache handled by CacheManager on frontend
    // Server-side doesn't manage cache
    
    Logger.log("Successfully updated category: " + oldFullName + " → " + newFullName);
    
    return {
      success: true,
      oldFullName: oldFullName,
      newFullName: newFullName,
      message: "Category updated successfully"
    };
    
  } catch (error) {
    Logger.log("Error in updateCategoryName: " + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}


/**
 * SIMPLIFIED: Update category display order in spreadsheet column N
 * Add this function to your Code.gs file (replaces the previous overcomplicated version)
 * 
 * @param {Array} displayOrderMap - Array of {id: number, displayOrder: number}
 * @return {Object} Success/error result
 */
function updateCategoryDisplayOrder(displayOrderMap) {
  try {
    Logger.log("updateCategoryDisplayOrder called with:", JSON.stringify(displayOrderMap));
    
    const setupSheet = getBudgetSheet("Dontedit");
    
    if (!setupSheet) {
      return { success: false, error: "Dontedit sheet not found" };
    }
    
    // Get category IDs from O10:O39
    const idRange = setupSheet.getRange("O10:O39").getValues();
    
    let updatedCount = 0;
    const updateLog = [];
    
    // Process each category in the update request
    for (const orderUpdate of displayOrderMap) {
      // Find category row by matching the stable ID
      for (let i = 0; i < idRange.length; i++) {
        const categoryId = idRange[i][0]; // Column O
        
        if (categoryId !== null && categoryId !== "" && categoryId == orderUpdate.id) {
          const rowIndex = i + 10; // O10 starts at row 10
          
          // Update display order in column N (column 14)
          setupSheet.getRange(rowIndex, 14).setValue(orderUpdate.displayOrder);
          
          updatedCount++;
          updateLog.push(`Row ${rowIndex}: ID ${categoryId} → display order ${orderUpdate.displayOrder}`);
          
          Logger.log(`Updated category ID ${categoryId} to display order ${orderUpdate.displayOrder} at row ${rowIndex}`);
          break;
        }
      }
    }
    
    // Update timestamp to invalidate cache
    try {
      updateDataTimestamp('categories');
      Logger.log("Updated categories timestamp");
    } catch (timestampError) {
      Logger.log("Warning: Could not update timestamp: " + timestampError.toString());
    }
    
    Logger.log(`updateCategoryDisplayOrder completed. Updated ${updatedCount} categories`);
    Logger.log("Update log:", updateLog);
    
    return { 
      success: true, 
      updatedCount: updatedCount,
      message: `Updated display order for ${updatedCount} categories`,
      updateLog: updateLog
    };
    
  } catch (error) {
    Logger.log("Error in updateCategoryDisplayOrder: " + error.toString());
    return { 
      success: false, 
      error: error.toString() 
    };
  }
}
