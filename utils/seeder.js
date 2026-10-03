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
const biochemistryFile = 'biochemistry_carbohydrate_chemistry.json';
const anatomyFile = path.resolve(__dirname, '../anatomy-pgmee-topicwise-mcqs.json');
const physiologyTopicFile = path.resolve(__dirname, '../physiology-pgmee-topicwise-mcqs.json');
const pharmacologyTopicFile = path.resolve(__dirname, '../pharmacology-pgmee-topicwise-mcqs.json');
const biochemistryModules = [
    { title: 'Gluconeogenesis and Glucose Homeostasis', questionIds: [1, 4, 18, 21, 22] },
    { title: 'Glycolysis and Energy Metabolism', questionIds: [2, 5, 12, 19, 35, 38] },
    { title: 'TCA Cycle and Oxidative Metabolism', questionIds: [6, 10, 14, 20, 24, 25, 32, 36] },
    { title: 'Glycogen Metabolism and Regulation', questionIds: [9, 13, 17, 27, 28, 34, 37] },
    { title: 'Galactose and Reducing Sugar Metabolism', questionIds: [3, 15, 23, 31] },
    { title: 'Glycosaminoglycans and Proteoglycans', questionIds: [7, 8, 29] },
    { title: 'Thiamine and TPP-Dependent Enzymes', questionIds: [11, 33] },
    { title: 'Purine Metabolism and Hyperuricemia', questionIds: [16] },
    { title: 'Carbohydrate Digestion', questionIds: [26] },
    { title: 'Pentose Phosphate Pathway and G6PD Deficiency', questionIds: [30] },
];

const readJson = (fileName) => JSON.parse(
    fs.readFileSync(path.join(questionsDirectory, fileName), 'utf8')
);

const extractFirstAnatomyQuestion = (sourceQuestion) => {
    const sourceOptions = sourceQuestion.options;
    if (!Array.isArray(sourceOptions)) return null;

    const options = [];
    const optionPattern = /(^|[\s\n])([a-e])\.\s*/gi;
    for (const sourceOption of sourceOptions) {
        const text = String(sourceOption || '');
        const matches = [...text.matchAll(optionPattern)];
        let optionsRestarted = false;
        if (matches.length === 0) {
            if (options.length === 0) return null;
            options[options.length - 1] += ` ${text}`;
            continue;
        }

        for (let index = 0; index < matches.length; index += 1) {
            const match = matches[index];
            const label = match[2].toLowerCase();
            if (label === 'a' && options.length >= 2) {
                optionsRestarted = true;
                break;
            }
            if (label !== String.fromCharCode(97 + options.length)) return null;

            const start = match.index + match[0].length;
            const end = matches[index + 1]?.index ?? text.length;
            const optionText = text.slice(start, end).trim();
            if (!optionText) return null;
            options.push(optionText);
            if (options.length > 5) return null;
        }

        if (matches.some((match) => match[2].toLowerCase() === 'a') && options.length >= 2) {
            const firstRestart = matches.findIndex((match) => match[2].toLowerCase() === 'a');
            if (firstRestart > 0) break;
        }
    }

    const answerText = String(sourceQuestion.correct_answer || '');
    const answerStart = answerText.search(/\b1\./);
    if (answerStart === -1) return null;
    const answerSection = answerText.slice(answerStart + 2);
    const nextAnswer = answerSection.search(/\s+\d+\.\s*[a-e]\./i);
    const firstAnswer = (nextAnswer === -1 ? answerSection : answerSection.slice(0, nextAnswer)).trim();
    const answerLabels = [...firstAnswer.matchAll(/(?:^|;)\s*([a-e])\./gi)]
        .map((match) => match[1].toLowerCase());
    if (answerLabels.length === 0) return null;

    const correctAnswers = answerLabels.map((label) => 'abcde'.indexOf(label));
    if (correctAnswers.some((answer) => answer < 0 || answer >= options.length)) return null;

    const sourceText = String(sourceQuestion.question || '')
        .replace(/^Q\s*\d+\.\s*/i, '');
    const nextQuestion = sourceText.search(/\s+\d+\.\s+/);
    const text = (nextQuestion === -1 ? sourceText : sourceText.slice(0, nextQuestion)).trim();
    const explanation = String(sourceQuestion.explanation || '').trim();
    if (!text || !explanation) return null;

    return { text, options, correctAnswers, explanation };
};

const extractLabeledCorrectAnswer = (question) => {
    const answerText = String(question.correct_answer || '');
    const answerMatch = answerText.match(/\b([a-e])\.\s*/i);
    if (!answerMatch) return null;

    const answerIndex = 'abcde'.indexOf(answerMatch[1].toLowerCase());
    return answerIndex < question.options.length ? answerIndex : null;
};

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
            text: typeof option === 'string'
                ? option.replace(/^[a-e]\.\s*/i, '')
                : option.text,
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
        reference: question.reference || '',
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
        .filter((fileName) => !fileName.startsWith('test-platform.'))
        .filter((fileName) => fileName !== biochemistryFile);

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

    const physiologyTopicData = JSON.parse(fs.readFileSync(physiologyTopicFile, 'utf8'));
    physiologyTopicData.topics.forEach((topic) => {
        const title = topic.topic_name.replace(/^Topic\s+\d+:\s*/i, '');
        testRecords.push({
            title,
            description: `Physiology questions on ${title.toLowerCase()}.`,
            category: 'Physiology',
            duration: 60,
            difficulty: 'Intermediate',
            price: 0,
            isFree: true,
        });
    });

    const pharmacologyData = JSON.parse(fs.readFileSync(pharmacologyTopicFile, 'utf8'));
    const pharmacologyTopics = pharmacologyData.subjects
        .filter((subject) => subject.subject === 'Pharmacology')
        .flatMap((subject) => subject.topics);
    if (pharmacologyTopics.length === 0) {
        throw new Error('No Pharmacology topics found in pharmacology-pgmee-topicwise-mcqs.json.');
    }
    pharmacologyTopics.forEach((topic) => {
        const title = topic.topic_name.replace(/^Topic\s+\d+:\s*/i, '');
        testRecords.push({
            title,
            description: `Pharmacology questions on ${title.toLowerCase()}.`,
            category: 'Pharmacology',
            duration: 60,
            difficulty: 'Intermediate',
            price: 0,
            isFree: true,
        });
    });

    biochemistryModules.forEach((module) => {
        testRecords.push({
            title: module.title,
            description: `Biochemistry questions on ${module.title.toLowerCase()}.`,
            category: 'Biochemistry',
            duration: 60,
            difficulty: 'Intermediate',
            price: 0,
            isFree: true,
        });
    });

    const anatomyData = JSON.parse(fs.readFileSync(anatomyFile, 'utf8'));
    anatomyData.topics.forEach((topic) => {
        const title = topic.topic_name.replace(/^Topic\s+\d+:\s*/i, '');
        testRecords.push({
            title,
            description: `Anatomy questions on ${title.toLowerCase()}.`,
            category: 'Anatomy',
            duration: 60,
            difficulty: 'Intermediate',
            price: 0,
            isFree: true,
        });
    });

    const existingTests = await Test.find({
        title: { $in: [...new Set(testRecords.map((test) => test.title))] },
        category: { $in: [...new Set(testRecords.map((test) => test.category))] },
    });
    const testsByKey = new Map(existingTests.map((test) => [
        `${test.category}\0${test.title}`,
        test,
    ]));
    const createdTests = [];
    let newTestCount = 0;
    for (const testRecord of testRecords) {
        const key = `${testRecord.category}\0${testRecord.title}`;
        let test = testsByKey.get(key);
        if (!test) {
            test = await Test.create(testRecord);
            testsByKey.set(key, test);
            newTestCount += 1;
        }
        createdTests.push(test);
    }
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

    const physiologyTopicTestStartIndex = sourceTestIds.length + physiologyFiles.length;
    let importedPhysiologyTopicQuestions = 0;
    let skippedPhysiologyTopicQuestions = 0;
    physiologyTopicData.topics.forEach((topic, topicIndex) => {
        const test = createdTests[physiologyTopicTestStartIndex + topicIndex];
        topic.questions.forEach((sourceQuestion) => {
            const correctAnswer = extractLabeledCorrectAnswer(sourceQuestion);
            if (correctAnswer === null) {
                skippedPhysiologyTopicQuestions += 1;
                return;
            }

            questions.push(normalizeQuestion({
                ...sourceQuestion,
                correctAnswer,
            }, test._id));
            importedPhysiologyTopicQuestions += 1;
        });
    });

    const pharmacologyTestStartIndex = physiologyTopicTestStartIndex + physiologyTopicData.topics.length;
    let importedPharmacologyQuestions = 0;
    let skippedPharmacologyQuestions = 0;
    pharmacologyTopics.forEach((topic, topicIndex) => {
        const test = createdTests[pharmacologyTestStartIndex + topicIndex];
        topic.questions.forEach((sourceQuestion) => {
            const correctAnswer = extractLabeledCorrectAnswer(sourceQuestion);
            if (correctAnswer === null) {
                skippedPharmacologyQuestions += 1;
                return;
            }

            questions.push(normalizeQuestion({
                ...sourceQuestion,
                correctAnswer,
            }, test._id));
            importedPharmacologyQuestions += 1;
        });
    });

    const biochemistryQuestions = readJson(biochemistryFile);
    const biochemistryTestStartIndex = pharmacologyTestStartIndex + pharmacologyTopics.length;
    const testByQuestionId = new Map();
    biochemistryModules.forEach((module, moduleIndex) => {
        const test = createdTests[biochemistryTestStartIndex + moduleIndex];
        module.questionIds.forEach((questionId) => {
            if (testByQuestionId.has(questionId)) {
                throw new Error(`Biochemistry question ${questionId} is assigned to multiple modules.`);
            }
            testByQuestionId.set(questionId, test);
        });
    });

    biochemistryQuestions.forEach((question) => {
        const test = testByQuestionId.get(question.id);
        if (!test) {
            throw new Error(`Biochemistry question ${question.id} is not assigned to a module.`);
        }
        questions.push(normalizeQuestion(question, test._id));
    });

    const anatomyTestStartIndex = biochemistryTestStartIndex + biochemistryModules.length;
    let importedAnatomyQuestions = 0;
    let skippedAnatomyQuestions = 0;
    anatomyData.topics.forEach((topic, topicIndex) => {
        const test = createdTests[anatomyTestStartIndex + topicIndex];
        topic.questions.forEach((sourceQuestion) => {
            const extracted = extractFirstAnatomyQuestion(sourceQuestion);
            if (!extracted) {
                skippedAnatomyQuestions += 1;
                return;
            }

            questions.push(normalizeQuestion({
                question: extracted.text,
                options: extracted.options.map((text) => ({ text })),
                correctAnswer: extracted.correctAnswers,
                explanation: extracted.explanation,
            }, test._id));
            importedAnatomyQuestions += 1;
        });
    });

    const existingQuestions = await Question.find({
        testId: { $in: createdTests.map((test) => test._id) },
    }).select('testId text');
    const questionKeys = new Set(existingQuestions.map((question) => (
        `${question.testId}\0${question.text.trim().toLowerCase()}`
    )));
    const newQuestions = questions.filter((question) => {
        const key = `${question.testId}\0${question.text.trim().toLowerCase()}`;
        if (questionKeys.has(key)) return false;
        questionKeys.add(key);
        return true;
    });
    const createdQuestions = newQuestions.length
        ? await Question.insertMany(newQuestions)
        : [];
    const questionsByTest = new Map();
    createdQuestions.forEach((question) => {
        const key = question.testId.toString();
        const testQuestions = questionsByTest.get(key) || [];
        testQuestions.push(question._id);
        questionsByTest.set(key, testQuestions);
    });

    await Promise.all([...questionsByTest].map(([testId, questionIds]) => Test.updateOne(
        { _id: testId },
        { $addToSet: { questions: { $each: questionIds } } },
    )));

    return {
        tests: newTestCount,
        questions: createdQuestions.length,
        importedAnatomyQuestions,
        skippedAnatomyQuestions,
        importedPhysiologyTopicQuestions,
        skippedPhysiologyTopicQuestions,
        importedPharmacologyQuestions,
        skippedPharmacologyQuestions,
    };
};

const seedData = async () => {
    try {
        let admin = await User.findOne({ email: 'mcqvitals@gmail.com' });
        if (!admin) {
            admin = await User.create({
                name: 'Admin User',
                email: 'mcqvitals@gmail.com',
                password: 'Mcqvitals@2026',
                role: 'admin',
            });
        }

        const seededQuestionData = await loadQuestionData();

        const resources = [
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
        ];
        for (const resource of resources) {
            const existingResource = await Resource.findOne({
                title: resource.title,
                category: resource.category,
            });
            if (!existingResource) await Resource.create(resource);
        }

        console.log(`Data Seeded Successfully! ${seededQuestionData.tests} new tests and ${seededQuestionData.questions} new questions imported. `
            + `${seededQuestionData.importedAnatomyQuestions} Anatomy questions imported; `
            + `${seededQuestionData.skippedAnatomyQuestions} skipped. `
            + `${seededQuestionData.importedPhysiologyTopicQuestions} topic-wise Physiology questions imported; `
            + `${seededQuestionData.skippedPhysiologyTopicQuestions} skipped. `
            + `${seededQuestionData.importedPharmacologyQuestions} Pharmacology questions imported; `
            + `${seededQuestionData.skippedPharmacologyQuestions} skipped.`);
        process.exit();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

seedData();
