const express = require('express');
const { body } = require('express-validator');
const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  acceptTask,
  rejectTask,
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
      // status creation pe ignore karenge - hamesha 'new' se start hota hai
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
        .isIn(['new', 'assigned', 'in-progress', 'resolved'])
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

// new lifecycle endpoints - sirf assigned member ke liye
router.post('/:id/accept', acceptTask);
router.post(
  '/:id/reject',
  [
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 300 })
      .withMessage('Reason must be under 300 characters'),
  ],
  validate,
  rejectTask
);

module.exports = router;
