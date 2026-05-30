import mongoose from 'mongoose';

const groqLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'classifyQuery',
      'classifyForPosting',
      'condenseQuery',
      'synthesizeAnswer',
      'checkAnswer',
      'rephraseQuery',
      'clusterQuestions',
      'validateCategory',
      'evaluateAnswerReward',
      'unknown'
    ]
  },
  model: {
    type: String,
    default: 'llama-3.1-8b-instant'
  },
  prompt_summary: {
    type: String,
    default: ''
  },
  response_summary: {
    type: String,
    default: ''
  },
  tokens_prompt: {
    type: Number,
    default: 0
  },
  tokens_completion: {
    type: Number,
    default: 0
  },
  tokens_total: {
    type: Number,
    default: 0
  },
  created_at: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // Auto-delete after 30 days
  }
});

const GroqLog = mongoose.model('GroqLog', groqLogSchema);
export default GroqLog;
