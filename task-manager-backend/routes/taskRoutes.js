const express = require('express');
const { body } = require('express-validator');
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { protect, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getTasks)
  .post(
    requireAdmin,
    [
      body('title').trim().notEmpty().withMessage('Task title is required'),
      body('project').notEmpty().withMessage('Project ID is required'),
      body('status')
        .optional()
        .isIn(['todo', 'in-progress', 'done'])
        .withMessage('Invalid status'),
      body('dueDate')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('Invalid due date'),
    ],
    validate,
    createTask
  );

router
  .route('/:id')
  .get(getTaskById)
  .put(
    [
      body('status')
        .optional()
        .isIn(['todo', 'in-progress', 'done'])
        .withMessage('Invalid status'),
      body('dueDate')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage('Invalid due date'),
    ],
    validate,
    updateTask
  )
  .delete(requireAdmin, deleteTask);

module.exports = router;
