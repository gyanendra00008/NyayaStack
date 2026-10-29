# NyayaStack

A full-stack legal technology platform built with Node.js, Express, MongoDB, React, Vite, Redux Toolkit, and Tailwind CSS.

## Project Structure

```text
NyayaStack/
├── backend/          # Express API server & Mongoose models
│   ├── src/
│   │   ├── config/   # Database connection
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
│
└── frontend/         # React + Vite client
    ├── src/
    │   ├── assets/
    │   ├── components/ # Reusable UI & layout components
    │   ├── hooks/      # Custom React / Redux hooks
    │   ├── pages/      # View pages
    │   ├── routes/     # React Router configuration
    │   ├── services/   # Axios API client
    │   ├── store/      # Redux Toolkit store & slices
    │   ├── utils/      # Helper utilities
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json
```

## Getting Started

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API server runs by default on `http://localhost:3000`.

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The Vite client runs by default on `http://localhost:5173`.
