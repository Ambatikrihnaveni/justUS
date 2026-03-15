# justUS Backend

Couple communication app backend built with Node.js, Express, and MongoDB.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure `.env` file with your MongoDB URI and JWT secret.

3. Start development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Messages
- `GET /api/messages/:userId` - Get chat history with user
- `POST /api/messages` - Send new message

## Folder Structure
- `controllers/` - Request handlers (business logic)
- `models/` - MongoDB schemas
- `routes/` - API route definitions
- `middleware/` - Custom middleware (auth, etc.)
- `sockets/` - Socket.io event handlers
- `uploads/` - Uploaded files storage
