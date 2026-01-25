# Simplify Budget

**Personal Finance Management Application**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

---

## Overview

**Simplify Budget** is a personal finance management application built on **Google Apps Script** and **Google Sheets**.
It helps users track expenses, manage budgets, and understand their financial position — while keeping **100% ownership of their data** inside their own Google account.

The app runs as a Google Apps Script project and uses Google Sheets as its database.

---

## Features

* 📊 **Interactive Dashboard** – Financial overview at a glance
* 💸 **Budget Management** – Set and monitor spending limits
* 🧾 **Expense Tracking** – Categorize and log expenses easily
* 🔁 **Subscription Management** – Track recurring payments
* 📈 **Net Worth Calculation** – Assets vs liabilities
* 🌍 **Multi-language Support** – EN, DE, TR, FR, ES, MS, and more
* 💱 **Multi-currency Support** – 20+ currencies
* 🌙 **Dark Mode**
* ☁️ **Google Sheets Integration** – Your data stays in your Drive
* 💾 **Auto-save Settings**

---

## Tech Stack

* Google Apps Script
* Google Sheets
* HTML / CSS / JavaScript
* `clasp` (Command Line Apps Script)
* Visual Studio Code

---

## Getting Started (Local Development)

### Prerequisites

* Google account
* Google Sheets access
* Node.js (v18+ recommended)
* Visual Studio Code

---

## Installation & Setup (Recommended Way)

### 1. Install `clasp`

```bash
npm install -g @google/clasp
```

Login to your Google account:

```bash
clasp login
```

---

### 2. Clone the Repository

```bash
git clone https://github.com/yourusername/simplifybudget.git
cd simplifybudget
```

---

### 3. Create a New Apps Script Project in Drive

Create a new Apps Script project **linked to Google Drive**:

```bash
clasp create --title "Simplify Budget" --type standalone
```

This will:

* create a new Apps Script project in your Google Drive
* generate a `.clasp.json` file locally

---

### 4. Push the Code to Google Apps Script

```bash
clasp push
```

Once pushed:

* the code is now **hosted in your Google Drive**
* editable via **Apps Script Editor** or **VS Code**

You can open it directly in the browser:

```bash
clasp open
```

---

## Connecting to Google Sheets

1. Create a new Google Sheet (or use an existing one)
2. Copy the Sheet ID from the URL
3. Paste it into the app’s **Settings** panel
4. Click **Test Connection**
5. Start adding categories and expenses

---

## Development Workflow (VS Code)

Recommended loop:

```bash
# edit files in VS Code
clasp push

# pull changes made in Apps Script editor (if any)
clasp pull
```

---

## Deployment

To deploy the app as a Web App:

```bash
clasp deploy
```

Then:

* Set **Execute as**: *Me*
* Set **Who has access**: *Only myself* or *Anyone with link*

---

## Data & Privacy

* All financial data lives in **your own Google Sheet**
* No external databases
* No third-party tracking
* Permissions are limited to spreadsheet access only

---

## Support

For issues, ideas, or contributions:

* Open a GitHub Issue
* Submit a Pull Request

Community contributions are welcome.

---

## License

MIT License

Copyright (c) 2025 Serdar Domurcuk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

---

**Simplify Budget**
also available on https://simplifybudget.com
