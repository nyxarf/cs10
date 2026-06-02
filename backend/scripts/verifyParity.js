import { config } from 'dotenv';
config();
import '../dns-setup.js';
await new Promise(r => setTimeout(r, 600));
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);

import adminService from '../services/adminService.js';
const dash = await adminService.getDashboard();

console.log('=== Admin Dashboard Counts ===');
console.log('communityQueryCount (open+answered):', dash.communityQueryCount);
console.log('totalSearchQueries:', dash.totalSearchQueries);
console.log('spotlightedCount:', dash.spotlightedCount);

// Also verify from the user-facing side
const Question = (await import('../models/Question.js')).default;
const spotlightCutoff = new Date(Date.now() - 2 * 60 * 1000);
const userVisible = await Question.countDocuments({ status: { $in: ['open', 'answered'] } });
const userOpen = await Question.countDocuments({ status: 'open' });
const allQuestions = await Question.countDocuments();
const spotlightUser = await Question.countDocuments({
  status: 'open',
  answer_count: 0,
  created_at: { $lt: spotlightCutoff },
});

console.log('\n=== Community Board (user-facing) Counts ===');
console.log('Default filter (status=open):', userOpen);
console.log('Visible total (open+answered):', userVisible);
console.log('ALL questions in DB (was wrongly shown before fix):', allQuestions);
console.log('Spotlighted (user side):', spotlightUser);

console.log('\n=== Parity Check ===');
console.log('communityQueryCount matches visible total:', dash.communityQueryCount === userVisible ? 'PASS ✓' : `FAIL ✗ (admin=${dash.communityQueryCount}, user=${userVisible})`);
console.log('spotlightedCount matches user spotlight:', dash.spotlightedCount === spotlightUser ? 'PASS ✓' : `FAIL ✗ (admin=${dash.spotlightedCount}, user=${spotlightUser})`);
console.log('Reduction from all->visible:', allQuestions - userVisible, 'questions were hidden/review/closed (now correctly excluded)');

await mongoose.disconnect();
