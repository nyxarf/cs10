import authService from '../services/authService.js';
import catchAsync from '../utils/catchAsync.js';
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';

/**
 * Controller handling user authentication requests (registration and logins).
 */
class AuthController {
  /**
   * Registers a new user.
   */
  register = catchAsync(async (req, res) => {
    const { name, email, password, role } = req.body;
    const result = await authService.register({ name, email, password, role });
    res.status(201).json({
      success: true,
      token: result.token,
      user: result.user,
    });
  });

  /**
   * Authenticates user and returns JWT.
   */
  login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json({
      success: true,
      token: result.token,
      user: result.user,
    });
  });

  /**
   * Returns the logged-in user's profile including their questions and answers.
   */
  getProfile = catchAsync(async (req, res) => {
    const userId = req.user._id;

    const [questions, answers] = await Promise.all([
      Question.find({ posted_by: userId })
        .sort({ created_at: -1 })
        .select('rephrased_query original_query category status answer_count view_count net_score created_at')
        .lean(),
      Answer.find({ answered_by: userId })
        .sort({ created_at: -1 })
        .populate('question_id', 'rephrased_query category status')
        .select('content status net_score upvotes downvotes promoted_to_corpus created_at question_id')
        .lean(),
    ]);

    res.json({
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        xp: req.user.xp,
        answers_count: req.user.answers_count,
        questions_count: req.user.questions_count,
        created_at: req.user.created_at,
      },
      questions,
      answers,
    });
  });
}

export default new AuthController();
