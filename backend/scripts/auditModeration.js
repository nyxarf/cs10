import '../dns-setup.js';
import { config } from 'dotenv';
config();
await new Promise(r => setTimeout(r, 600));
import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI);

import Answer from '../models/Answer.js';
import Question from '../models/Question.js';

const answerStatuses = await Answer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
const questionStatuses = await Question.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

console.log('\n=== Answer status distribution ===');
answerStatuses.forEach(s => console.log(`  ${s._id}: ${s.count}`));

console.log('\n=== Question status distribution ===');
questionStatuses.forEach(s => console.log(`  ${s._id}: ${s.count}`));

const flaggedAnswers = await Answer.find({ status: 'flagged' })
  .populate('answered_by', 'name')
  .populate({ path: 'question_id', select: 'rephrased_query category' })
  .limit(3).lean();
console.log('\n=== Sample flagged answers ===');
flaggedAnswers.forEach(a => console.log(`  id=${a._id}  answerer=${a.answered_by?.name}  question="${a.question_id?.rephrased_query?.slice(0,50)}"`));

const reviewQuestions = await Question.find({ status: 'review' })
  .populate('posted_by', 'name').limit(3).lean();
console.log('\n=== Sample review questions ===');
reviewQuestions.forEach(q => console.log(`  id=${q._id}  by=${q.posted_by?.name}  q="${q.rephrased_query?.slice(0,50)}"`));

await mongoose.disconnect();
