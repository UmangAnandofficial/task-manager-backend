const express = require('express');
const { body } = require('express-validator');
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  addMember,
  removeMember,
  deleteProject,
} = require('../controllers/projectController');
const { protect, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(protect);

router
  .route('/')
  .get(getProjects)
  .post(
    requireAdmin,
    [
      body('name').trim().notEmpty().withMessage('Project name is required'),
      body('description').optional().isString(),
      body('members').optional().isArray(),
    ],
    validate,
    createProject
  );

router
  .route('/:id')
  .get(getProjectById)
  .put(
    requireAdmin,
    [
      body('name').optional().trim().notEmpty(),
      body('description').optional().isString(),
    ],
    validate,
    updateProject
  )
  .delete(requireAdmin, deleteProject);

router.post(
  '/:id/members',
  requireAdmin,
  [body('userId').notEmpty().withMessage('userId is required')],
  validate,
  addMember
);

router.delete('/:id/members/:userId', requireAdmin, removeMember);

module.exports = router;
