import type { Category } from '../domain/types.ts'

/** Starting taxonomy, modelled on the spreadsheet this app replaces. */
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Mortgage', type: 'expense', subcategories: ['Fixed', 'Variable'], sortOrder: 10 },
  { name: 'Utilities', type: 'expense', subcategories: ['Council Tax', 'Gas & Electricity', 'Water', 'Telecommunications', 'Google Storage', 'TV Subscriptions'], sortOrder: 20 },
  { name: 'Insurance', type: 'expense', subcategories: ['Car', 'Health', 'Home'], sortOrder: 30 },
  { name: 'Splurge', type: 'expense', subcategories: ['Groceries', 'Splurge'], sortOrder: 40 },
  { name: 'Kids', type: 'expense', subcategories: ['Activities', 'Clothing', 'Gifts', 'Health', 'LAC', 'Music Lessons', 'Nanny', 'Other', 'Photos', 'Pocket Money', 'School Fees', 'Shopping', 'Toys', 'Tutoring'], sortOrder: 50 },
  { name: 'Health', type: 'expense', subcategories: ['Bupa Refund', 'Gym', 'Hair & Beauty', 'Medicare', 'Medtronic', 'NDIS', 'Other', 'Pharmacy', 'Psychologist', 'Sol Cleanse', 'Specialists', 'Yoga'], sortOrder: 60 },
  { name: 'Transport', type: 'expense', subcategories: ['Fines', 'Fuel', 'Parking', 'Registration', 'Servicing', 'Taxi', 'Train'], sortOrder: 70 },
  { name: 'Shopping', type: 'expense', subcategories: ['Amazon', 'Apple Subscriptions', 'Books', 'Clothing & Fashion', 'Electronics', 'Gift', 'Miscellaneous', 'Other', 'Shoes', 'Stationery'], sortOrder: 80 },
  { name: 'Home', type: 'expense', subcategories: ['Appliances', 'Decor', 'Gardening', 'Home Improvement', 'Maintenance'], sortOrder: 90 },
  { name: 'Entertainment', type: 'expense', subcategories: ['Alcohol', 'Eating Out', 'Hotels', 'Theatre & Cinemas'], sortOrder: 100 },
  { name: 'Holiday', type: 'expense', subcategories: [], sortOrder: 110 },
  { name: 'Work', type: 'expense', subcategories: ['Education', 'Expenses', 'Professional Fees'], sortOrder: 120 },
  { name: 'Miscellaneous', type: 'expense', subcategories: ['Bank Fees', 'Charity', 'Fines'], sortOrder: 130 },
  { name: 'Cash Withdrawal', type: 'expense', subcategories: [], sortOrder: 140 },
  { name: 'Smile', type: 'expense', subcategories: ['Holiday Fund'], sortOrder: 150 },
  { name: 'Tea Money', type: 'expense', subcategories: [], sortOrder: 160 },
  { name: 'Salary', type: 'income', subcategories: [], sortOrder: 200 },
  { name: 'Transfer', type: 'transfer', subcategories: [], sortOrder: 300 },
]
