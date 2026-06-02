import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema({
  category_path: {
    type: String,
    required: true,
    trim: true,
  },
  question: {
    type: String,
    required: true,
    trim: true,
  },
  answer: {
    type: String,
    required: true,
    trim: true,
  },
  fingerprint: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length === 384;
      },
      message: 'Embedding vector must be exactly 384 numbers.'
    }
  },
  source: {
    type: String,
    enum: ['manual', 'community', 'ai_master'],
    default: 'manual',
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  keywords: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10,
  },
  is_pinned: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for regular queries
faqSchema.index({ category_path: 1 });
faqSchema.index({ source: 1 });
faqSchema.index({ created_at: -1 });
faqSchema.index({ priority: -1 });
faqSchema.index({ is_pinned: 1 });

// Text index for local keyword search fallback
faqSchema.index({ question: 'text', answer: 'text' });

faqSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

const FAQ = mongoose.model('FAQ', faqSchema);
export default FAQ;
