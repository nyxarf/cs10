import categoryService from '../services/categoryService.js';
import catchAsync from '../utils/catchAsync.js';

class CategoryController {
  getCategories = catchAsync(async (req, res) => {
    const { tree, flat } = await categoryService.getTree();
    // `categories` = flat list for frontend dropdowns; `tree` for hierarchical views
    res.json({ tree, flat, categories: flat });
  });

  getCategory = catchAsync(async (req, res) => {
    const result = await categoryService.getCategoryWithContext(req.params.id);
    res.json(result);
  });

  createCategory = catchAsync(async (req, res) => {
    const { label, description, parentId, path } = req.body;
    const result = await categoryService.createCategory({ label, description, parentId, path });
    res.status(201).json(result);
  });

  updateCategory = catchAsync(async (req, res) => {
    const { label, description, parentId } = req.body;
    const result = await categoryService.updateCategory(req.params.id, { label, description, parentId });
    res.json(result);
  });

  deleteCategory = catchAsync(async (req, res) => {
    const { reassignTo } = req.query;
    const result = await categoryService.deleteCategory(req.params.id, { reassignTo });
    res.json(result);
  });

  getFaqsInSubtree = catchAsync(async (req, res) => {
    const { path } = req.params;
    const { page, limit } = req.query;
    const result = await categoryService.getFaqsInSubtree(path, page, limit);
    res.json(result);
  });

  migrateToTree = catchAsync(async (req, res) => {
    const result = await categoryService.migrateToTree();
    res.json(result);
  });
}

export default new CategoryController();