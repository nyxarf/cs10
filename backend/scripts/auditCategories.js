import '../dns-setup.js';
import { config } from 'dotenv';
config();
await new Promise(r => setTimeout(r, 600));
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);

import FAQCategory from '../models/FAQCategory.js';
import FAQ from '../models/FAQ.js';

const cats = await FAQCategory.find().lean();
console.log('\n=== ALL FAQCategory documents (raw) ===');
cats.forEach(c => console.log(JSON.stringify({ _id: c._id, path: c.path, label: c.label, parent: c.parent, description: c.description?.slice(0,60) })));

console.log('\n=== FAQ category_path distribution ===');
const faqCats = await FAQ.aggregate([{ $group: { _id: '$category_path', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
faqCats.forEach(r => console.log(`  "${r._id}": ${r.count}`));

await mongoose.disconnect();
