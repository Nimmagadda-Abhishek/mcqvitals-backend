const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const User = require('../models/User');
const Test = require('../models/Test');
const Question = require('../models/Question');
const Resource = require('../models/Resource');
const connectDB = require('../config/db');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

connectDB();

const questionsDirectory = path.resolve(__dirname, '../qestions');

const readJson = (fileName) => JSON.parse(
    fs.readFileSync(path.join(questionsDirectory, fileName), 'utf8')
);

const normalizeAnswer = (answer, optionKeys) => {
    const answers = (Array.isArray(answer) ? answer : [answer]).flatMap((item) => (
        typeof item === 'string' && item.includes(',') ? item.split(',') : item
    ));
    if (answers.length === 1 && String(answers[0]).toLowerCase() === 'none') return [];
    return answers.map((item) => {
        if (typeof item === 'number') return item;
        if (typeof item === 'string' && optionKeys.includes(item.toLowerCase())) {
            return optionKeys.indexOf(item.toLowerCase());
        }
        return Number(item);
    });
};

const normalizeQuestion = (question, testId) => {
    const sourceOptions = question.options;
    const optionKeys = Object.keys(sourceOptions);
    const options = Array.isArray(sourceOptions)
        ? sourceOptions.map((option) => ({
            text: option.text,
            images: option.images || [],
        }))
        : optionKeys.map((key) => ({ text: sourceOptions[key] }));
    const rawAnswer = question.correctAnswer ?? question.correct_answer ?? question.answer;
    const answers = normalizeAnswer(rawAnswer, optionKeys);
    const normalized = {
        testId,
        text: question.text || question.question,
        images: question.images || [],
        options,
        explanation: typeof question.explanation === 'string'
            ? { text: question.explanation }
            : (question.explanation || { text: '' }),
    };

    if (answers.length !== 1) {
        normalized.questionType = 'multiple_choice';
        normalized.multipleCorrectAnswers = answers;
    } else {
        normalized.questionType = 'single';
        normalized.correctAnswer = answers[0];
    }

    return normalized;
};

const loadQuestionData = async () => {
    const exportedTests = readJson('test-platform.tests.json');
    const exportedQuestions = readJson('test-platform.questions.json');
    const testRecords = exportedTests.map((sourceTest) => ({
        title: sourceTest.title,
        description: sourceTest.description,
        category: sourceTest.category,
        duration: sourceTest.duration,
        difficulty: sourceTest.difficulty,
        price: sourceTest.price,
        isFree: sourceTest.isFree,
        rating: sourceTest.rating,
    }));
    const sourceTestIds = exportedTests.map((sourceTest) => sourceTest._id.$oid);
    const physiologyFiles = fs.readdirSync(questionsDirectory)
        .filter((fileName) => fileName.endsWith('.json'))
        .filter((fileName) => !fileName.startsWith('test-platform.'));

    for (const fileName of physiologyFiles) {
        testRecords.push({
            title: path.basename(fileName, '.json'),
            description: `Questions imported from ${fileName}`,
            category: 'Physiology',
            duration: 60,
            difficulty: 'Intermediate',
            price: 0,
            isFree: true,
        });
    }

    const createdTests = await Test.insertMany(testRecords);
    const questions = [];

    exportedQuestions.forEach((question) => {
        const sourceTestId = question.testId.$oid;
        const testIndex = sourceTestIds.indexOf(sourceTestId);
        questions.push(normalizeQuestion(question, createdTests[testIndex]._id));
    });

    physiologyFiles.forEach((fileName, fileIndex) => {
        const test = createdTests[sourceTestIds.length + fileIndex];
        readJson(fileName).forEach((question) => {
            questions.push(normalizeQuestion(question, test._id));
        });
    });

    const createdQuestions = await Question.insertMany(questions);
    const questionsByTest = new Map();
    createdQuestions.forEach((question) => {
        const key = question.testId.toString();
        const testQuestions = questionsByTest.get(key) || [];
        testQuestions.push(question._id);
        questionsByTest.set(key, testQuestions);
    });

    await Promise.all(createdTests.map((test) => Test.updateOne(
        { _id: test._id },
        { $set: { questions: questionsByTest.get(test._id.toString()) || [] } },
    )));

    return { tests: createdTests.length, questions: createdQuestions.length };
};

const seedData = async () => {
    try {
        await User.deleteMany();
        await Test.deleteMany();
        await Question.deleteMany();
        await Resource.deleteMany();

        const admin = await User.create({
            name: 'Admin User',
            email: 'mcqvitals@gmail.com',
            password: 'Mcqvitals@2026',
            role: 'admin',
        });

        const seededQuestionData = await loadQuestionData();

        await Resource.create([
            {
                title: 'Aptitude Mastery Guide',
                type: 'document',
                url: 'https://example.com/aptitude-guide.pdf',
                category: 'Aptitude',
                uploadedBy: admin._id,
            },
            {
                title: 'Space Explorations Video',
                type: 'video',
                url: 'https://example.com/space.mp4',
                category: 'Science',
                uploadedBy: admin._id,
            }
        ]);

        console.log(`Data Seeded Successfully! ${seededQuestionData.tests} tests and ${seededQuestionData.questions} questions imported.`);
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedData();
