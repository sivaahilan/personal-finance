/**
 * Generic merchant hints used only to *suggest* a category for transactions
 * that no rule matches. Each hint is a list of keyword phrases; a phrase
 * matches when every one of its words appears in the description.
 */
export interface KeywordHint {
  phrases: string[]
  category: string
  subcategory: string
}

export const KEYWORD_HINTS: KeywordHint[] = [
  { phrases: ['woolworths', 'coles', 'aldi', 'iga', 'harris farm', 'supamart', 'foodworks', 'costco', 'fruit', 'butcher', 'bakery', 'markets'], category: 'Splurge', subcategory: 'Groceries' },
  { phrases: ['ampol', 'bp ', '7-eleven', 'shell', 'caltex', 'united petroleum', 'metro petroleum', 'mobil', 'speedway', 'petrol', 'fuel', 'coles express'], category: 'Transport', subcategory: 'Fuel' },
  { phrases: ['transportfornsw', 'opal', 'etoll', 'linkt', 'toll'], category: 'Transport', subcategory: 'Train' },
  { phrases: ['uber trip', 'uber *trip', 'didi', 'cabs', 'taxi', 'gm cab', 'taxipay', 'spotto', '13cabs'], category: 'Transport', subcategory: 'Taxi' },
  { phrases: ['parking', 'wilson parking', 'secure parking', 'council parking'], category: 'Transport', subcategory: 'Parking' },
  { phrases: ['service nsw', 'rego', 'registration'], category: 'Transport', subcategory: 'Registration' },
  { phrases: ['tyre', 'mechanic', 'auto', 'car service'], category: 'Transport', subcategory: 'Servicing' },
  { phrases: ['infringement', 'fine', 'sdro', 'revenue nsw'], category: 'Transport', subcategory: 'Fines' },
  { phrases: ['pharmacy', 'chemist', 'chempro', 'priceline', 'terry white', 'iherb'], category: 'Health', subcategory: 'Pharmacy' },
  { phrases: ['medicare', 'mcare benefits'], category: 'Health', subcategory: 'Medicare' },
  { phrases: ['ndis'], category: 'Health', subcategory: 'NDIS' },
  { phrases: ['psycholog', 'psychology'], category: 'Health', subcategory: 'Psychologist' },
  { phrases: ['gym', 'fitness', 'anytime', 'f45'], category: 'Health', subcategory: 'Gym' },
  { phrases: ['yoga', 'pilates'], category: 'Health', subcategory: 'Yoga' },
  { phrases: ['barber', 'hair', 'salon', 'beauty'], category: 'Health', subcategory: 'Hair & Beauty' },
  { phrases: ['dental', 'dentist', 'smile', 'physio', 'chiro', 'clinic', 'medical', 'doctors', 'specialist', 'pathology', 'radiology'], category: 'Health', subcategory: 'Specialists' },
  { phrases: ['bupa', 'medibank', 'hcf', 'nib'], category: 'Insurance', subcategory: 'Health' },
  { phrases: ['aami', 'nrma', 'allianz', 'budget direct', 'youi', 'ctp', 'insurance'], category: 'Insurance', subcategory: 'Car' },
  { phrases: ['loan repayment', 'ln repay', 'home loan', 'mortgage'], category: 'Mortgage', subcategory: 'Variable' },
  { phrases: ['salary', 'payroll', 'wages'], category: 'Salary', subcategory: '' },
  { phrases: ['telstra', 'optus', 'vodafone', 'amaysim', 'boost', 'tpg', 'aussie broadband', 'nbn'], category: 'Utilities', subcategory: 'Telecommunications' },
  { phrases: ['energyaustralia', 'agl', 'origin energy', 'red energy', 'alinta', 'ausgrid', 'electricity', 'gas'], category: 'Utilities', subcategory: 'Gas & Electricity' },
  { phrases: ['sydney water', 'water'], category: 'Utilities', subcategory: 'Water' },
  { phrases: ['council', 'rates', 'bpay council'], category: 'Utilities', subcategory: 'Council Tax' },
  { phrases: ['google storage', 'icloud', 'dropbox', 'google one'], category: 'Utilities', subcategory: 'Google Storage' },
  { phrases: ['netflix', 'stan', 'disney', 'binge', 'kayo', 'paramount', 'nba league pass', 'youtube premium', 'prime video'], category: 'Utilities', subcategory: 'TV Subscriptions' },
  { phrases: ['apple.com/bill', 'apple.com bill', 'itunes'], category: 'Shopping', subcategory: 'Apple Subscriptions' },
  { phrases: ['amazon'], category: 'Shopping', subcategory: 'Amazon' },
  { phrases: ['officeworks', 'stationery', 'stationary'], category: 'Shopping', subcategory: 'Stationery' },
  { phrases: ['kindle', 'booktopia', 'dymocks', 'book', 'books'], category: 'Shopping', subcategory: 'Books' },
  { phrases: ['jb hi-fi', 'jb hifi', 'apple store', 'harvey norman', 'the good guys', 'electronics'], category: 'Shopping', subcategory: 'Electronics' },
  { phrases: ['david jones', 'myer', 'uniqlo', 'zara', 'indite', 'inditex', 'h&m', 'cotton on', 'the iconic', 'iconic', 'country road', 'witchery', 'seed', 'kathmandu', 'lululemon', 'sass & bide', 'vestiaire', 'mecca', 'sephora'], category: 'Shopping', subcategory: 'Clothing & Fashion' },
  { phrases: ['shoes', 'athletes foot', 'platypus', 'hype dc', 'nike', 'adidas'], category: 'Shopping', subcategory: 'Shoes' },
  { phrases: ['bunnings', 'mitre 10', 'paint', 'hardware', 'plumbing', 'handyman', 'electrician'], category: 'Home', subcategory: 'Home Improvement' },
  { phrases: ['flower power', 'nursery', 'garden', 'gardener', 'mowing'], category: 'Home', subcategory: 'Gardening' },
  { phrases: ['appliances', 'miele', 'winning appliances', 'bing lee'], category: 'Home', subcategory: 'Appliances' },
  { phrases: ['adairs', 'ikea', 'freedom', 'furniture', 'interiors', 'decor', 'prints', 'homewares'], category: 'Home', subcategory: 'Decor' },
  { phrases: ['bws', 'dan murphy', 'liquor', 'cellars', 'wines', 'bottle shop', 'vintage cellars', 'liquorland'], category: 'Entertainment', subcategory: 'Alcohol' },
  { phrases: ['cinema', 'hoyts', 'event cinemas', 'ticketek', 'ticketmaster', 'theatre', 'opera house', 'trybooking', 'humanitix', 'summertix', 'moshtix'], category: 'Entertainment', subcategory: 'Theatre & Cinemas' },
  { phrases: ['restaurant', 'cafe', 'coffee', 'pizza', 'sushi', 'thai', 'kitchen', 'bar and dining', 'bistro', 'grill', 'burger', 'uber eats', 'ubereats', 'menulog', 'doordash', 'deliveroo', 'gelato', 'patisserie', 'bakerie', 'dining', 'eatery', 'noodle', 'dumpling', 'mcdonalds', "mcdonald's", 'kfc', 'hungry jacks', 'guzman', 'oporto', 'boost juice', 'bubble tea'], category: 'Entertainment', subcategory: 'Eating Out' },
  { phrases: ['hotel', 'hilton', 'marriott', 'ibis', 'meriton', 'accor'], category: 'Entertainment', subcategory: 'Hotels' },
  { phrases: ['airbnb', 'jetstar', 'qantas', 'virgin australia', 'rex', 'booking.com', 'expedia', 'wise', 'duty free', 'international atm'], category: 'Holiday', subcategory: '' },
  { phrases: ['kmart', 'target', 'big w', 'best & less', 'cotton on kids', 'shoes & sox'], category: 'Kids', subcategory: 'Clothing' },
  { phrases: ['school', 'schoolsonline', 'tuition', 'college', 'grammar'], category: 'Kids', subcategory: 'School Fees' },
  { phrases: ['ymca', 'swim', 'swimming', 'gymnastics', 'acrobatics', 'dance', 'soccer', 'football', 'netball', 'tennis', 'timezone', 'zoo', 'museum', 'performing art'], category: 'Kids', subcategory: 'Activities' },
  { phrases: ['toys', 'toyworld', 'kidstuff', 'lego'], category: 'Kids', subcategory: 'Toys' },
  { phrases: ['tutor', 'tutoring', 'kumon'], category: 'Kids', subcategory: 'Tutoring' },
  { phrases: ['music', 'piano', 'guitar', 'flute', 'violin'], category: 'Kids', subcategory: 'Music Lessons' },
  { phrases: ['pocket money', 'chores'], category: 'Kids', subcategory: 'Pocket Money' },
  { phrases: ['intnl transaction fee', 'international transaction fee', 'cash adv fee', 'account fee', 'bank fee', 'interest on cash', 'overdrawn fee', 'atm fee'], category: 'Miscellaneous', subcategory: 'Bank Fees' },
  { phrases: ['oxfam', 'red cross', 'salvation', 'charity', 'donation', 'unicef', 'wwf'], category: 'Miscellaneous', subcategory: 'Charity' },
  { phrases: ['wdl atm', 'atm withdrawal', 'cash out', 'cardless cash'], category: 'Cash Withdrawal', subcategory: '' },
  { phrases: ['ahpra', 'professional fees', 'membership', 'cpd', 'conference'], category: 'Work', subcategory: 'Professional Fees' },
  { phrases: ['transfer to', 'transfer from', 'fast transfer', 'payid', 'osko'], category: 'Transfer', subcategory: '' },
]
