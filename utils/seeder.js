const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Resource = require('../models/Resource');
const connectDB = require('../config/db');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

connectDB();

const seedData = async () => {
    try {
        await User.deleteMany();
        await Test.deleteMany();
        await Question.deleteMany();
        await Resource.deleteMany();

        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin',
        });

        const test1 = await Test.create({
            title: 'General Aptitude Test',
            description: 'Evaluate your logical and mathematical skills.',
            category: 'Aptitude',
            duration: 60,
            difficulty: 'Intermediate',
            price: 0,
        });

        const questions = [
            {
                testId: test1._id,
                text: 'What is 2 + 2?',
                options: [
                    { text: '3' },
                    { text: '4' },
                    { text: '5' },
                    { text: '6' },
                ],
                correctAnswer: 1,
                explanation: { text: 'Basic arithmetic: 2 plus 2 equals 4.' },
            },
            {
                testId: test1._id,
                text: 'Which planet is known as the Red Planet?',
                options: [
                    { text: 'Earth' },
                    { text: 'Venus' },
                    { text: 'Mars' },
                    { text: 'Jupiter' },
                ],
                correctAnswer: 2,
                explanation: { text: 'Mars has a reddish appearance due to iron oxide on its surface.' },
            },
        ];

        const createdQuestions = await Question.insertMany(questions);

        test1.questions = createdQuestions.map(q => q._id);
        await test1.save();

        await Resource.create([
            {
                title: 'Aptitude Mastery Guide',
                type: 'document',
                url: 'https://example.com/aptitude-guide.pdf',
                category: 'Aptitude'
            },
            {
                title: 'Space Explorations Video',
                type: 'video',
                url: 'https://example.com/space.mp4',
                category: 'Science'
            }
        ]);

        console.log('Data Seeded Successfully!');
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedData();
