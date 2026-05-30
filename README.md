# Samagama FAQ & AI Knowledge Platform

Welcome to the Samagama FAQ platform. This is a comprehensive, AI-driven knowledge base built using the MERN stack (MongoDB, Express, React, Node.js) with integrated Groq API for dynamic semantic search and AI automated response generation.

# Samagama Platform Features

Samagama is a comprehensive, AI-powered knowledge management and community Q&A platform built with a modern MERN stack (MongoDB, Express, React/Vite, Node.js). The platform is divided into three main pillars: the **Knowledge Base**, the **Community Q&A Board**, and the **Admin Control Panel**.

---

## 1. AI-Powered Knowledge Base (The FAQ Corpus)
The core of the platform is an intelligent, self-organizing FAQ database.
- **Semantic Search Engine**: Users can search for answers using natural language. The backend uses `Xenova/all-MiniLM-L6-v2` embeddings via HNSW (Hierarchical Navigable Small World) algorithms for lightning-fast, meaning-based search instead of strict keyword matching.
- **Canonical Categories Structure**: FAQs are automatically organized into 14 strict canonical categories (e.g., *Campus Life*, *Admissions*, *Placements*) to maintain a clean taxonomy.
- **Auto-Deduplication**: The system prevents the creation of duplicate FAQs by comparing semantic similarities of new entries against the existing corpus.
- **Semantic Caching**: Frequently asked queries are cached with their vector representations for near-instant retrieval on subsequent identical or highly similar searches.

## 2. Community Q&A Board
A gamified community forum where users can ask and answer questions that aren't yet covered by the official FAQ corpus.
- **Yaksha AI Pre-Moderation**: Before a question goes live, Yaksha (the Groq LLM integration) analyzes it. It automatically rephrases the query for clarity, assigns it to a canonical category, and decides if it can be published immediately or if it requires admin review (if it's borderline or potentially off-topic).
- **Gamification & Samagama Points (SP)**: Users are incentivized to contribute. 
  - Answering questions and receiving upvotes earns SP.
  - Getting an answer approved by an admin or promoted to the official FAQ corpus earns massive SP bonuses.
  - The SP Ledger strictly tracks every transaction (earnings and deductions).
- **Answerer Dashboard**: A dedicated view for community contributors to find unanswered, high-value questions where they can earn SP.
- **Voting System**: Reddit-style upvoting and downvoting on both questions and answers to crowdsource quality control.

## 3. Global AI Clustering (Master FAQs)
The system has the ability to self-heal and grow its official knowledge base autonomously.
- **Master FAQ Generation**: The system can analyze dozens of similar community questions and answers, and use the Groq AI to synthesize them into a single, high-quality "Master FAQ". 
- **Automated Promotion**: This Master FAQ is then injected directly into the canonical FAQ corpus, replacing the fragmented community threads.

## 4. Admin Control Panel (`/admin`)
A secure, feature-rich dashboard for administrators to monitor and control the platform.
- **Dashboard & Analytics**: Real-time charts and metrics showing user engagement, top-searched categories, system health, and API usage (including deep tracking of Groq API token consumption and costs).
- **Pending Questions Moderation**: Admins can review borderline questions that the AI flagged, adjust SP rewards for the asker, and either approve (publish) or reject (hide) them.
- **Answer Moderation**: Admins review community answers that were flagged by users or the AI. Admins can manually award custom SP payouts to both the asker and the answerer.
- **Auto-Moderation Engine**: A one-click bulk action where the Groq AI acts as an autonomous moderator, evaluating all flagged answers in the queue, distributing SP rewards, and hiding bad answers instantly.
- **Knowledge Review**: Admins can hand-pick exceptional community answers and "Promote" them directly into the official FAQ corpus with custom XP rewards.
- **FAQ Management (CRUD)**: Direct access to create, edit, or delete official FAQs, with real-time vector embedding updates.
- **User & SP Management**: A directory of all users, sorted by SP/XP, with the ability for admins to manually adjust user balances for special events.

## 5. Modern Architecture & Design
- **Responsive UI/UX**: Built with React and Vite, featuring a premium dark-mode aesthetic with smooth micro-animations, glassmorphism, and responsive layouts.
- **Security**: JWT-based authentication, role-based access control (RBAC), and robust error handling.
- **Data Persistence**: Fully backed by MongoDB Atlas cloud clusters ensuring data integrity, scalability, and vector search readiness.


## Project Structure

This repository is organized into three main services:

- `/client` - The main user-facing frontend application (React, Vite). Features a dynamic Community Board, semantic search, and user SP tracking.
- `/admin` - The administrative dashboard (React, Vite). Used for moderating community questions, reviewing AI suggestions, and viewing system analytics.
- `/backend` - The API server (Node.js, Express, MongoDB). Handles authentication, semantic clustering using HNSW, database interactions, and Groq LLM integrations.
- `/Seed` - Contains testing scripts and seed data for the MongoDB database.

## Prerequisites

Make sure you have the following installed:
- Node.js (v18 or higher recommended)
- MongoDB (Local or Atlas cluster)
- A Groq API Key

## Environment Setup

You need to configure your environment variables before running the project. 

1. Navigate to the `/backend` directory.
2. Rename the provided `.env.example` file to `.env`.
3. Fill in your actual credentials (MongoDB URI, JWT secret, and Groq API key).

```env
# Server Configuration
PORT=5000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/samagama

# Security
JWT_SECRET=your_super_secret_jwt_key

# AI / Inference Integration
GROQ_API_KEY=gsk_your_actual_key_here
```

*Note: Never commit your `.env` file to version control.*

## Installation & Running Locally

You will need to run three separate processes for the complete platform to function locally.

### 1. Start the Backend API
```bash
cd backend
npm install
npm run dev
```
*The backend will run on `http://localhost:5000`*

### 2. Start the Client Application
Open a new terminal window:
```bash
cd client
npm install
npm run dev
```
*The client app will run on `http://localhost:3000`*

### 3. Start the Admin Dashboard
Open a third terminal window:
```bash
cd admin
npm install
npm run dev
```
*The admin panel will run on `http://localhost:3001`*

## Features

- **Semantic Search**: Utilizes `Xenova/all-MiniLM-L6-v2` local embeddings combined with MongoDB Vector Search to instantly find the most relevant FAQs.
- **AI Master Generator**: Leverages the Groq API to automatically cluster un-answered community questions and draft comprehensive "Master FAQs".
- **Dynamic Analytics**: Real-time aggregation of question status, volume trends, and active categories via the Admin panel using Recharts.
- **Gamification (SP Ledger)**: Users earn Samagama Points (SP) for asking and answering questions, validated through the Admin moderation queue.

## License
Proprietary / Private Repository. Do not distribute without permission.
