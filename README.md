# Expense Tracker

A personal expense and budget tracker that replaces a spreadsheet. Upload CSV exports from your bank, let rules categorise the transactions, review whatever did not match with a suggested category, and track spending against monthly budgets.

Everything runs in the browser. Your data is stored in the browser's own database (IndexedDB) and never leaves your device. Back it up from the Settings page.

## Features

- **CSV import** with duplicate detection, so overlapping exports are safe to re-import. CommBank's headerless `Date, Amount, Description, Balance` layout is detected automatically; any other export works if it has a header row (signed amount, or separate debit and credit columns). A spreadsheet export with `Category` and `Subcategory` columns keeps those categories.
- **Rules** categorise transactions automatically. Match on all words (any order), contains, starts with, exact text or a regular expression, optionally limited to an amount range. Rules run in priority order with the most specific pattern winning ties. The editor previews exactly which existing transactions a rule would hit before you save it.
- **Review** groups unmatched transactions by merchant and suggests a category for each group, learned from the transactions you have already categorised, from nearby rules, and from a list of common Australian merchants. Accepting a suggestion can create the rule at the same time, so the next import handles it for you.
- **Budgets** per category or subcategory. Set a default amount that applies every month and override individual months. Progress bars and remaining amounts update as you categorise.
- **Reports** show spending by category per month as a stacked chart and a pivot table (with subcategory drill-down), over 6, 12 or 24 months, the current or previous Australian financial year, or everything. Download the table as CSV.
- **Transactions** list with search and filters, inline category editing, bulk categorise and one-click "make a rule from this".
- **Backup and restore** as a single JSON file; rules can be exported and imported separately.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other commands:

```bash
npm test           # unit tests (vitest)
npm run typecheck  # tsc
npm run build      # production build in dist/
npm run preview    # serve the production build
```

There is a fictional sample export at `samples/commbank-sample.csv` to try the import flow.

## Hosting on GitHub Pages

The `Deploy to GitHub Pages` workflow builds and publishes the app on every push to `master`. Turn it on once in the repository settings: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Because the app stores data in the browser, hosting it is just hosting static files; nothing is sent to a server.

## How categorisation works

1. On import, each transaction is run through the enabled rules in priority order (lower number first; ties go to the longer, more specific pattern). The first match wins.
2. Anything left is shown on the Review page, grouped by merchant. The merchant name is derived by stripping the parts of a bank description that change between visits (card suffixes, value dates, reference numbers, booking codes, foreign currency amounts).
3. Suggestions for a group come from three sources, ranked by confidence: similar transactions you already categorised, existing rules whose words mostly overlap, and generic merchant hints.
4. Categories you set by hand are never overwritten by rules unless you explicitly ask for that when re-applying rules.

## Project layout

```
src/domain      pure logic: CSV parsing, dates, money, description normalisation, rule matching, suggestions
src/services    database operations: import, categorise, budgets, backup
src/db          Dexie (IndexedDB) schema and default categories
src/pages       one component per screen
src/components  shared UI: pickers, modal, rule editor, charts
samples/        a fictional CommBank-style CSV
```
