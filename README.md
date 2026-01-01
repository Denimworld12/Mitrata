# Mitrata - Social Networking Platform 🌐

<div align="center">

<img width="1465" height="1026" alt="Untitled design (1)" src="https://github.com/user-attachments/assets/f021ec31-4b2b-4d24-aa17-2b2fd7ece380" />


**A modern, full-stack social networking platform for professional and personal connections**

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)

</div>

---

## 📖 About Mitrata

Mitrata is a feature-rich social networking application that combines the best aspects of professional networking with personal connection-building. Built with the MERN stack and enhanced with real-time capabilities, Mitrata delivers a seamless, app-like experience optimized for both mobile and desktop users.

Whether you're looking to expand your professional network, share your thoughts with the world, or engage in real-time conversations, Mitrata provides all the tools you need in one elegant platform.

---

## ✨ Key Features

### 💬 Real-time Messaging
- Instant chat functionality powered by Socket.io
- "Delete for Everyone" message capability
- Media sharing support (images, files)
- Read receipts and typing indicators

### 📱 Dynamic Feed
- Mobile-optimized post feed
- Share text updates and images
- Interactive likes and comments system
- Infinite scroll for seamless browsing

### 🤝 Professional Networking
- LinkedIn-style bidirectional connection system
- Send and receive connection requests
- Manage your professional network
- View connection suggestions

### 👤 Smart Profiles
- Comprehensive user profiles
- Work experience showcase
- Education history tracking
- **Automated PDF Resume Generator**
- Profile picture and banner customization

### 📱 App-Like Experience
- Fully responsive design
- Visual Viewport optimization
- Keyboard-aware UI adjustments
- Progressive Web App (PWA) ready

### 🏆 Leaderboard
- "Top Profiles" ranking algorithm
- Recognition for active community members
- Based on post contributions and engagement

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 13+ (React 18)
- **State Management**: Redux Toolkit
- **Styling**: CSS Modules
- **Real-time**: Socket.io Client
- **HTTP Client**: Axios
- **Deployment**: Vercel

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io
- **File Storage**: Cloudinary
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Bcrypt password hashing
- **File Upload**: Multer middleware

---

## 📂 Project Structure

```
mitrata/
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # Next.js file-based routing
│   │   │   ├── index.js        # Landing page
│   │   │   ├── login.js        # Authentication
│   │   │   ├── dashboard/      # Main app dashboard
│   │   │   └── profile/        # User profiles
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Post/           # Post components
│   │   │   ├── Chat/           # Messaging components
│   │   │   └── Profile/        # Profile components
│   │   ├── config/             # Configuration files
│   │   │   ├── store.js        # Redux store
│   │   │   └── api.js          # API configuration
│   │   └── layout/             # Layout components
│   │       ├── DashboardLayout.js
│   │       └── UserLayout.js
│   ├── public/                 # Static assets
│   ├── vercel.json             # Vercel deployment config
│   └── package.json
│
└── backend/
    ├── models/                 # Mongoose schemas
    │   ├── User.js             # User model
    │   ├── Profile.js          # Profile model
    │   ├── Connection.js       # Connection model
    │   ├── Post.js             # Post model
    │   └── Message.js          # Message model
    ├── controllers/            # Business logic
    │   ├── authController.js
    │   ├── postController.js
    │   ├── connectionController.js
    │   └── messageController.js
    ├── routes/                 # API endpoints
    │   ├── auth.js
    │   ├── posts.js
    │   ├── connections.js
    │   └── messages.js
    ├── middleware/             # Custom middleware
    │   ├── auth.js             # JWT verification
    │   └── upload.js           # Multer configuration
    ├── utils/                  # Utility functions
    ├── server.js               # Express server setup
    └── package.json
```

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn package manager
- Cloudinary account (for media storage)

### 1. Clone the Repository
```bash
https://github.com/Denimworld12/SocialMedia.git
cd mitrata
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
touch .env
```

Add the following environment variables to `.env`:
```env
# Database
MONGODB_URI=your_mongodb_connection_string

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:3000
```

```bash
# Start the backend server
npm start

# For development with auto-restart
npm run dev
```

The backend server will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create .env.local file
touch .env.local
```

Add the following environment variables to `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

```bash
# Start the development server
npm run dev
```

The frontend application will run on `http://localhost:3000`

---

## 🌐 Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Import your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Ensure `vercel.json` is in your frontend root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

5. Deploy!

### Backend (Railway/Render/Heroku)

1. Choose your hosting platform
2. Connect your GitHub repository
3. Add environment variables
4. Configure build command: `npm install`
5. Configure start command: `npm start`
6. Deploy!

---

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Post Endpoints
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/like` - Like/unlike post
- `POST /api/posts/:id/comment` - Add comment

### Connection Endpoints
- `GET /api/connections` - Get user connections
- `POST /api/connections/request` - Send connection request
- `PUT /api/connections/:id/accept` - Accept connection request
- `DELETE /api/connections/:id` - Remove connection

### Message Endpoints
- `GET /api/messages/:userId` - Get conversation with user
- `POST /api/messages` - Send message
- `DELETE /api/messages/:id` - Delete message

---

## 🤝 Contributing

Contributions are what make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 👥 Authors

**Nikhil Gupta**
- GitHub: [@Nikhil Gupta](https://github.com/Denimworld12)
- LinkedIn: [Nikhil Gupta](https://www.linkedin.com/in/nikhilgupta795/)

---

## 🙏 Acknowledgments

- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.io Documentation](https://socket.io/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)

---

## 📧 Contact

Project Link: [https://social-media-eight-mu-88.vercel.app/](https://social-media-eight-mu-88.vercel.app/)

---

<div align="center">

**Made with ❤️ by Nikhil Gupta**

⭐ Star this repository if you found it helpful!


</div>
