import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  original_query: {
    type: String,
    required: true,
    trim: true,
  },
  rephrased_query: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  // Structured category path referencing FAQCategory.path (e.g. "root.noc")
  category_path: {
    type: String,
    trim: true,
    default: null,
  },
  category_label: {
    type: String,
    trim: true,
    default: null,
  },
  posted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'answered', 'review', 'hidden', 'closed'],
    default: 'review',
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },
  answer_count: {
    type: Number,
    default: 0,
  },
  view_count: {
    type: Number,
    default: 0,
  },
  upvotes: {
    type: Number,
    default: 0,
  },
  downvotes: {
    type: Number,
    default: 0,
  },
  search_frequency: {
    type: Number,
    default: 0,
  },
  engagement_time: {
    type: Number,
    default: 0,
  },
  net_score: {
    type: Number,
    default: 0,
  },
  is_pinned: {
    type: Boolean,
    default: false,
  },
  reports: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_at: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for common queries
questionSchema.index({ status: 1, category: 1 });
questionSchema.index({ created_at: -1 });
questionSchema.index({ posted_by: 1 });
questionSchema.index({ is_pinned: 1 });

const Question = mongoose.model('Question', questionSchema);
export default Question;
