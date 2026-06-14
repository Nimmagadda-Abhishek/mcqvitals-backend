# test-backend

A Node.js/Express backend API utilizing MongoDB, AWS S3, Firebase, and Razorpay.

## Features

- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Authentication**: JWT & bcryptjs
- **Storage**: AWS S3 integration with presigned URLs and Multer
- **Integrations**: Firebase, Nodemailer, Razorpay

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- MongoDB instance (local or Atlas)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory. You will need to configure variables for your database, AWS credentials, JWT secrets, and other third-party services.

### 3. Running the Server

**Development Mode** (with auto-reload):
```bash
npm run dev
```

**Production Mode**:
```bash
node index.js
```

### 4. Database Seeding

To populate initial data into your database, you can run:
```bash
npm run data:import
```

## Deployment

This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) configured to deploy the application to an AWS EC2 instance upon pushing to the `main` branch. 

To use it, ensure you have set the following secrets in your GitHub repository settings:
- `EC2_HOST`
- `EC2_USERNAME`
- `EC2_SSH_KEY`
