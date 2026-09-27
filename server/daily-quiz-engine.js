const https = require('https');
const { MASTER_CURRICULUM_BANK, getDailyQuiz, getTierForClass } = require('./drive-quiz-provider');

const TURSO_URL = (process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.replace(/^libsql:\/\//i, 'https://').replace(/\/$/, '') : 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io') + '/v2/pipeline';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

function queryTurso(sql, args = []) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      requests: [
        { type: "execute", stmt: { sql, args: args.map(a => typeof a === 'number' ? { type: 'integer', value: String(a) } : { type: 'text', value: String(a) }) } },
        { type: "close" }
      ]
    });

    const req = https.request(TURSO_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TURSO_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const ALL_CLASSES = [
  'Nursery-A', 'LKG-A', 'UKG-A', 'I-A', 'II-A', 'III-A', 'IV-A', 'V-A', 'VI-A', 'VII-A', 'VIII-A', 'IX-A', 'X-A'
];

const ALL_SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi', 'General Knowledge', 'Computer Science'];

/**
 * GENERATE 20 AUTHENTIC SUBJECT-PURE QUESTIONS FOR A QUIZ
 */
async function generateUniqueQuestionsForQuiz(quizId, className, subject, dateStr = null) {
  const quizObj = getDailyQuiz(className, subject, dateStr);
  const selectedQuestions = quizObj.questions || [];

  if (selectedQuestions.length === 0) return 0;

  // Delete old questions for this quiz
  await queryTurso("DELETE FROM app_quiz_questions WHERE quiz_id = ?", [quizId]);

  // Insert 20 distinct questions in one batch
  const requests = selectedQuestions.map(qObj => ({
    type: "execute",
    stmt: {
      sql: "INSERT INTO app_quiz_questions (quiz_id, question_text, options, correct_answer_index, explanation) VALUES (?, ?, ?, ?, ?)",
      args: [
        { type: "integer", value: String(quizId) },
        { type: "text", value: qObj.question_text },
        { type: "text", value: JSON.stringify(qObj.options) },
        { type: "integer", value: String(qObj.correct_answer_index) },
        { type: "text", value: qObj.explanation }
      ]
    }
  }));
  requests.push({ type: "close" });

  const payload = JSON.stringify({ requests });
  await new Promise((resolve, reject) => {
    const req = https.request(TURSO_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TURSO_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  return selectedQuestions.length;
}

/**
 * REGENERATE ALL QUIZZES WITH 100% AUTHENTIC QUESTIONS
 */
async function regenerateAllQuizzesWithUniqueQuestions(dateStr) {
  if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);
  console.log(`[Daily Quiz Engine] Populating 100% subject-pure questions for ${dateStr}...`);

  let totalQuestions = 0;

  for (const cName of ALL_CLASSES) {
    for (const sub of ALL_SUBJECTS) {
      let quizId = null;
      const existRes = await queryTurso(
        "SELECT id FROM app_quizzes WHERE class_name = ? AND LOWER(subject) = LOWER(?) AND date = ? LIMIT 1",
        [cName, sub, dateStr]
      );

      if (existRes.results?.[0]?.response?.result?.rows?.length > 0) {
        quizId = Number(existRes.results[0].response.result.rows[0][0].value);
      } else {
        await queryTurso(
          "INSERT INTO app_quizzes (date, class_name, subject) VALUES (?, ?, ?)",
          [dateStr, cName, sub]
        );
        const newRes = await queryTurso(
          "SELECT id FROM app_quizzes WHERE class_name = ? AND LOWER(subject) = LOWER(?) AND date = ? LIMIT 1",
          [cName, sub, dateStr]
        );
        if (newRes.results?.[0]?.response?.result?.rows?.length > 0) {
          quizId = Number(newRes.results[0].response.result.rows[0][0].value);
        }
      }

      if (quizId) {
        const count = await generateUniqueQuestionsForQuiz(quizId, cName, sub, dateStr);
        totalQuestions += count;
      }
    }
  }

  console.log(`[Daily Quiz Engine] Successfully regenerated all quizzes with ${totalQuestions} pure questions for ${dateStr}!`);
  return { ok: true, date: dateStr, totalQuestions };
}

module.exports = {
  generateDailyQuizzes: regenerateAllQuizzesWithUniqueQuestions,
  regenerateAllQuizzesWithUniqueQuestions,
  generateUniqueQuestionsForQuiz,
  getDailyQuiz,
  ALL_CLASSES,
  ALL_SUBJECTS
};
