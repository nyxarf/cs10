import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '..', '.env') });

import FAQCategory from '../models/FAQCategory.js';
import FAQ from '../models/FAQ.js';
import { syncCanonicalCategories, clusterAllFAQs, CANONICAL_CATEGORIES } from '../services/clusteringService.js';

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Find all categories currently in the DB
    const allCats = await FAQCategory.find();
    console.log(`Found ${allCats.length} categories in the database.`);

    const canonicalPaths = CANONICAL_CATEGORIES.map(c => c.path);

    // 2. Delete any categories that are NOT in the canonical list
    const toDelete = allCats.filter(c => !canonicalPaths.includes(c.path));
    if (toDelete.length > 0) {
      console.log(`Deleting ${toDelete.length} invalid categories...`);
      for (const cat of toDelete) {
        await FAQCategory.findByIdAndDelete(cat._id);
        console.log(` - Deleted: ${cat.path}`);
      }
    } else {
      console.log('No invalid categories to delete.');
    }

    // 3. Sync the correct 14 canonical categories
    console.log('Syncing the 14 Canonical Categories...');
    await syncCanonicalCategories();

    // 4. Fix any FAQs that were pointing to the deleted invalid categories
    console.log('Re-clustering all FAQs to ensure they use valid canonical paths...');
    const result = await clusterAllFAQs({ scope: 'all' });
    
    console.log('✅ Done! Summary:', result);

    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

run();
