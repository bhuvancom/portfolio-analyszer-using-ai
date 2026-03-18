# Vantage AI Advisor - Backend (Node.js & Express) 🚀

Welcome to the backend of **Vantage AI Advisor**! If you are a first-year Computer Science student, this guide is for you. We'll explain how this system works, from talking to databases to using AI to analyze stocks.

---

## 🏛️ The Architecture

Think of the backend as the "brain" of our application. It handles the data, makes decisions, and talks to other clever systems (like ChatGPT).

### 1. Express.js: The Web Server 🌐
**What is it?** Express is a "framework" for Node.js. It helps us build a web server easily.
**How it works (Routing):** 
Imagine a receptionist at a building. If you say "I want to see the doctor," they send you to Room A. If you say "I want the cafeteria," they send you to Room B.
- In Express, **"Routing"** is this receptionist.
- When the frontend asks for `GET /api/holdings`, the router sends that request to the `holdingsController`.
- Each "Route" is just a URL path linked to a specific piece of JavaScript code.

### 2. Prisma: The Database Translator 🗄️
**What is it?** Prisma is an **ORM** (Object-Relational Mapping).
**Why use it?** 
Databases speak "SQL" (Structured Query Language). JavaScript speak "Objects". 
- Without Prisma, we'd have to write complex SQL strings manually.
- With Prisma, we treat our database tables like normal JavaScript objects. It translates our code into SQL for us!
- **Schema:** The `prisma/schema.prisma` file is our "blueprint". It defines exactly what a "User" or a "Holding" looks like in the database.

### 3. PostgreSQL: The Brain's Memory 🧠
**What is it?** This is our "Relational Database". It stores all your holdings, analysis reports, and user info in organized tables. Unlike a simple file, it's very fast and can handle thousands of users at once.

### 4. OpenTelemetry & Grafana: The System Stethoscope 🩺
When things slow down, we need to know *why*.
- **OpenTelemetry:** It sits inside our code and measures how long things take. It tracks "Spans" (small tasks) and "Traces" (the whole journey of a request).
- **Tempo:** A special database just for storing those Traces.
- **Grafana:** A beautiful dashboard (the "monitor") where we can see charts and "waterfall" diagrams of exactly where the time is being spent.

### 5. AI Integration (ChatGPT/OpenAI) 🤖
We don't just show numbers; we give advice! We send your portfolio data to OpenAI's ChatGPT. It analyzes your diversification and risks, then sends back a professional investment thesis.

---

## 📂 Project Walkthrough

- `src/index.ts`: The entry point. We start our tracing engine here first!
- `src/controllers/`: The "Receptionists". They receive requests and decide which "Service" should handle them.
- `src/services/`: The "Workers". This is where the heavy lifting happens (calculating scores, talking to AI).
- `src/routes/`: The "Maps". They link URLs to Controllers.
- `src/tracing.ts`: The "Stethoscope" setup.

---

## 🛠️ Getting Started

1. **Setup Environment**
   ```bash
   cp .env.example .env
   # Update DATABASE_URL and CHATGPT_API_KEY
   ```

2. **Install & Prepare**
   ```bash
   npm install
   npx prisma generate  # Tells Prisma to read your schema blueprint
   npx prisma db push   # Creates the tables in your database
   ```

3. **Run the Engines**
   ```bash
   npm run dev          # Starts the backend
   docker-compose up -d # Starts the Database, Grafana, and Tempo
   ```

4. **See the Magic**
   Open Grafana at `http://localhost:3001` to see your system's health!

---

> [!TIP]
> **Learning Path:** Start by looking at `src/routes/holdingsRoutes.ts`, then follow it to `src/controllers/holdingsController.ts`. This is the "Request-Response" flow used by 99% of modern web apps!
