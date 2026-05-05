# Task Manager Backend

REST API for the Team Task Manager full-stack assignment.

## Tech Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- bcryptjs password hashing
- express-validator

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the root (copy from `.env.example`):
   ```
   PORT=5000
   MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/taskmanager?retryWrites=true&w=majority
   JWT_SECRET=your_secret_here
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173
   ```

3. Seed an admin user:
   ```
   npm run seed
   ```
   Creates: `admin@taskmanager.com` / `admin123`

4. Start the dev server:
   ```
   npm run dev
   ```
   Or in production: `npm start`

## API Endpoints

### Auth
- `POST /api/auth/signup` — register a new member
- `POST /api/auth/login` — login (returns JWT)
- `GET /api/auth/me` — current user (requires auth)

### Users (admin only)
- `GET /api/users` — list all users
- `PUT /api/users/:id/role` — change user role

### Projects
- `GET /api/projects` — list (admin sees all, members see theirs)
- `POST /api/projects` — create (admin only)
- `GET /api/projects/:id` — single project
- `PUT /api/projects/:id` — update (admin only)
- `DELETE /api/projects/:id` — delete + cascade tasks (admin only)
- `POST /api/projects/:id/members` — add member (admin only)
- `DELETE /api/projects/:id/members/:userId` — remove member (admin only)

### Tasks
- `GET /api/tasks?project=X&status=Y&assignedTo=me` — list
- `POST /api/tasks` — create (admin only)
- `GET /api/tasks/:id` — single task
- `PUT /api/tasks/:id` — update (admin: full, member: status only on own tasks)
- `DELETE /api/tasks/:id` — delete (admin only)

### Dashboard
- `GET /api/dashboard` — stats + my tasks for current user

## Roles
- **admin**: full access — can create/manage projects, tasks, members
- **member**: can view projects they're members of, can update status of tasks assigned to them

All endpoints (except signup/login) require `Authorization: Bearer <token>` header.
