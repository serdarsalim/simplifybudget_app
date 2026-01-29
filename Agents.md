# SimBudget Codebase Guide for AI Agents

This document provides a quick reference for AI agents working on the SimBudget codebase. It explains where different functionality lives and how the pieces connect.

## Architecture Overview

SimBudget is a Google Apps Script web app with:
- **Backend**: Google Apps Script (server-side JavaScript in `.js` files)
- **Frontend**: HTML templates with embedded JavaScript (`.html` files)
- **Data Storage**: Google Sheets as the database
- **User Settings**: Stored as JSON in the "Dontedit" sheet

## File Structure

### Backend (Server-Side)

| File | Purpose |
|------|---------|
| `Code.js` | Main server-side entry point. Contains `doGet()`, user settings functions, sheet operations, trial tracking |
| `zTransactions.js` | Transaction CRUD operations (add, update, delete expenses) |
| `zRecurring.js` | Recurring transaction logic |
| `zIncome.js` | Income tracking operations |
| `zNetWorth.js` | Net worth entry management |
| `zCategories.js` | Budget category operations |
| `translate.js` | Translations and i18n support |

### Frontend (Client-Side)

| File | Purpose |
|------|---------|
| `Index.html` | Main app shell, loads all components |
| `Init.html` | App initialization and bootstrap |
| `API.html` | Client-side API wrapper (calls `google.script.run`) |
| `Styles.html` | Global CSS styles |
| `Sidebar.html` | Navigation sidebar component |
| `Utils.html` | Utility functions (formatting, date helpers, etc.) |

### Feature Modules

| File | Purpose |
|------|---------|
| `monthlyGrid.js.html` | Monthly calendar view for expenses |
| `yearlyGrid.js.html` | Yearly overview grid for expenses |
| `dashboard.js.html` + `dashboard.html` | Dashboard analytics and charts |
| `categories.js.html` | Category management UI |
| `income.js.html` | Income tracking UI |
| `recurring.js.html` | Recurring transactions UI |
| `networth.js.html` | Net Worth tracker (assets, debts, charts) |
| `Settings.html` + `settings.js.html` | User settings page |
| `CacheManager.js.html` | Client-side caching layer |
| `TransactionManager.js.html` | Transaction state management |
| `transactionEntry.js.html` | Expense entry modal component |

## Key Data Locations

### User Settings
- **Storage**: Cell `K8` of "Dontedit" sheet (JSON format)
- **Timestamp**: Cell `J8` of "Dontedit" sheet
- **Functions**: `getUserSettings()`, `setUserSettings()` in Code.js

Settings JSON structure:
```json
{
  "currencySymbol": "$",
  "language": "en",
  "darkMode": false,
  "showDecimals": true,
  "displayCurrency": "$",
  "exchangeRate": 1,
  "showCategoryTotals": true,
  "showCurrencySymbolGrid": true,
  "netWorthDefaultChart": "allocation",
  "defaultAccount": ""
}
```

### Currency Symbol
- **Storage**: Cell `M76` of "Dontedit" sheet
- **Function**: `setCurrencyInSpreadsheet()` in Code.js

### User Credentials / Sheet URL
- **Storage**: User Properties (per-user, server-side)
- **Functions**: `getUserCredentials()`, `setBudgetSheetUrl()` in Code.js

### Trial/License Tracking
- **Storage**: External spreadsheet (TRACKING_SPREADSHEET_ID)
- **Sheet**: "Users" tab
- **Functions**: `checkTrialStatus()`, `recordFirstUse()` in Code.js

## Common Patterns

### Adding a New Setting

1. Add the setting to `saveSettings()` in `settings.js.html`
2. Add to `applySettingsToForm()` in `settings.js.html`
3. Add to defaults in `applyDefaultsWithAutoLanguage()` in `settings.js.html`
4. Add UI element in `Settings.html`
5. Add event listener in `initEventListeners()` in `settings.js.html`

### Expense Modal Account Dropdown

The account dropdown in expense modals is populated from Net Worth "Liquid Assets":
- Location: `monthlyGrid.js.html` and `yearlyGrid.js.html`
- Source: CacheManager.getNetWorthWithTimestamp()
- Filter: `entry.asset === 'Liquid Assets'` for current month
- Default: Uses `defaultAccount` from user settings

### Net Worth Categories

Hardcoded in `networth.js.html` as `ASSET_CATEGORIES`:
- Liquid Assets (Accounts) - bank accounts, wallets, etc.
- Investments
- Real Estate
- Other Assets
- Credit Cards
- Loans
- Other Debts

### API Calls Pattern

Client-side uses `API.html` which wraps `google.script.run`:
```javascript
API.functionName(params, successCallback, errorCallback);
```

### Caching

CacheManager (in `CacheManager.js.html`) caches:
- Transactions
- Categories
- Net Worth entries
- Settings
- Income

Use `CacheManager.invalidateAll()` when major data changes occur.

## Important Notes

- The app runs in an iframe within Google's domain
- OAuth scopes are defined in `appsscript.json`
- `.clasp.json` links to the Google Apps Script project
- Test files prefixed with `Zz` or `zz` are for development only
