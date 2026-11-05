const fs = require('fs');
const path = require('path');
const fetch = globalThis.fetch || require('node-fetch');

// Direct .env parser
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '.env'),
    'C:\\Users\\Admin\\Desktop\\My Project\\Slip And Receipt\\All fixed\\TapowanPublicSchool-fixed\\.env'
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      });
      break;
    }
  }
}
loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TURSO_URL = 'https://tapowan-v2-tapowan.aws-ap-south-1.turso.io/v2/pipeline';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkwOTIyMTUsImlkIjoiMDFhMDhlMzQtODMwMS03MDI0LTk5ZWQtMGQ0MmYwMGJiNjFlIiwia2lkIjoiVFRPdk5ISlFYZVAtX1FsNG9ZUXM4cTBTYXRiZzJ1UmVhYjlUbjFyem1tcyIsInJpZCI6ImVjNjc2YzExLTRhNGUtNGZhNi1hMTM1LTJmZDk4YTIxNzliMSJ9.RmzczPOvgV3Hd83byF7fMfQsCzlJnF8r9MCGtzTfZDj8k--VqtItniZN5GCiPfv4-dCEmDZaIWDGPOnM-EknDA';

function getTodayISTString() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().slice(0, 10);
}

// 13 Classes & Specific Subject Syllabi Mapping
const CLASS_SYLLABUS = [
  {
    className: 'Nursery-A',
    displayName: 'Nursery',
    subjects: {
      'English': 'Alphabet letters (A-Z), phonic sounds, simple 3-letter words (cat, dog, sun), rhymes, identifying animals and fruits',
      'Hindi': 'स्वर (अ-अः), व्यंजन (क-ज्ञ), सरल शब्द (फल, जल, घर), रंग और पशु-पक्षियों के नाम',
      'Mathematics': 'Counting 1-20, recognition of shapes (circle, square, triangle), big vs small, more vs less, basic patterns'
    }
  },
  {
    className: 'LKG-A',
    displayName: 'LKG',
    subjects: {
      'English': 'Vowels and consonants, rhyming words, opposite words (hot/cold, big/small), simple action words, sight words',
      'Hindi': 'दो और तीन अक्षर वाले शब्द (कमल, सड़क, महल), विलोम शब्द, लिंग, गिनती १-१०',
      'Mathematics': 'Single-digit addition and subtraction (up to 10), backward counting, missing numbers, shape properties'
    }
  },
  {
    className: 'UKG-A',
    displayName: 'UKG',
    subjects: {
      'English': 'Articles (a, an), singular/plural (cat/cats, box/boxes), pronouns (he, she, it), simple sentence reading',
      'Hindi': 'मात्राओं का ज्ञान (ा, ि, ी, ु, ू), सरल वाक्य, रंग, फल-सब्जियों के नाम, लिंग व वचन',
      'Mathematics': 'Numbers 1-100, addition and subtraction up to 20, tens and ones place value, telling time (o clock)',
      'EVS': 'Five sense organs, parts of plant, living vs non-living, helpers in society (doctor, teacher, police), seasons and water'
    }
  },
  {
    className: 'I-A',
    displayName: 'Class 1',
    subjects: {
      'Mathematics': 'Addition & Subtraction up to 100, number names, place value (tens and ones), measurement (length, weight), coins & currency',
      'Science': 'Human body organs, living & non-living things, plant parts (roots, stem, leaf), domestic & wild animals, weather & seasons',
      'English': 'Nouns (naming words), pronouns (he, she, they), adjectives, opposite words, articles (a, an, the)',
      'Social Science': 'Family types, our neighborhood, helpers in community, national symbols (Tiranga, Lotus, Tiger), road safety rules',
      'Hindi': 'मात्राएँ, विलोम शब्द, पर्यायवाची, लिंग, वचन, सरल वाक्य रचना',
      'Computer Science': 'Parts of computer (Monitor, CPU, Keyboard, Mouse, Printer), rules of computer lab, MS Paint tools'
    }
  },
  {
    className: 'II-A',
    displayName: 'Class 2',
    subjects: {
      'Mathematics': '2-digit addition with carry, subtraction with borrow, multiplication tables (2 to 10), shapes, clocks & calendar',
      'Science': 'Types of plants (herbs, shrubs, trees), animal habitats, water cycle basics, human digestive & respiratory organs',
      'English': 'Verbs (action words), tenses (past/present), prepositions (in, on, under, behind), conjunctions (and, but)',
      'Social Science': 'Means of transport (land, air, water), festivals of India, Indian freedom heroes, globe & cardinal directions',
      'Hindi': 'व्याकरण: संज्ञा, सर्वनाम, विशेषण, पर्यायवाची, मुहावरे, वाक्य शुद्धि',
      'Computer Science': 'Input vs Output devices, keyboard special keys (Spacebar, Enter, Backspace, Caps Lock), MS Paint shapes'
    }
  },
  {
    className: 'III-A',
    displayName: 'Class 3',
    subjects: {
      'Mathematics': '3-digit & 4-digit numbers, Roman numerals (I-XX), multiplication, division with remainder, fractions (1/2, 1/4), perimeter',
      'Science': 'Birds beaks & claws, photosynthesis, human skeleton & digestion, states of matter (solid, liquid, gas), soil types',
      'English': 'Adverbs of manner, degrees of comparison, collective nouns, punctuation, formal vocabulary, story comprehension',
      'Social Science': 'Solar system & 8 planets, continents & oceans, early humans & fire, historic monuments of India, Indian states',
      'Hindi': 'संज्ञा के भेद, सर्वनाम, पर्यायवाची, विलोम, मुहावरे (नौ दो ग्यारह होना), अपठित गद्यांश',
      'Computer Science': 'Hardware vs Software, Windows desktop & Taskbar, file & folder organization, keyboard shortcuts (Ctrl+C, Ctrl+V)'
    }
  },
  {
    className: 'IV-A',
    displayName: 'Class 4',
    subjects: {
      'Mathematics': 'Factors and Multiples (HCF & LCM), 5-digit place value, fraction addition/subtraction, perimeter & area of rectangles',
      'Science': 'Photosynthesis & stomata, human teeth types, digestion, adaptation in desert & aquatic plants, water purification',
      'English': 'Subject-verb agreement, adverbs of time/place, direct/indirect speech basics, idioms, formal letters',
      'Social Science': 'Physical divisions of India (Himalayas, Northern Plains, Thar Desert, Deccan Plateau), climate, forest conservation',
      'Hindi': 'क्रिया और काल (वर्तमान, भूत, भविष्य), उपसर्ग, प्रत्यय, मुहावरे, पर्यायवाची, पत्र लेखन',
      'Computer Science': 'Storage devices (RAM, ROM, Hard Disk, Pen Drive), MS Word document formatting, fonts, operating system basics'
    }
  },
  {
    className: 'V-A',
    displayName: 'Class 5',
    subjects: {
      'Mathematics': 'Large numbers (lakhs & crores), prime/composite numbers, decimals, percentages, volume of cubes, angle types',
      'Science': 'Skeletal & nervous system (brain cerebrum/cerebellum), simple machines (lever, pulley), communicable diseases, natural disasters',
      'English': 'Tenses (all 12 basic forms), active and passive voice, homophones, complex sentences, analytical paragraph writing',
      'Social Science': 'Latitudes & Longitudes (Equator, Prime Meridian), 1857 Revolt, Indian National Movement, democratic governance',
      'Hindi': 'संधि के नियम, समास, पद परिचय, मुहावरे व लोकोक्तियाँ, अपठित काव्यांश',
      'Computer Science': 'Internet & WWW, search engines vs browsers, email components (To, Cc, Bcc), MS PowerPoint slide design'
    }
  },
  {
    className: 'VI-A',
    displayName: 'Class 6',
    subjects: {
      'Mathematics': 'Integers on number line, fractions & decimals, basic algebra (x + 5 = 12), ratio & proportion, geometry (polygons, circles)',
      'Science': 'Components of food (carbohydrates, vitamins, deficiency diseases), separation of substances, flower anatomy, motion & measurement',
      'English': 'Transitive/intransitive verbs, modal auxiliaries (must, should, can), reported speech, notice writing, formal letters',
      'Social Science': 'Indus Valley Civilization (Harappa & Mohenjo-daro), Ashoka the Great, Globe & motions of Earth, Panchayati Raj System',
      'Hindi': 'स्वर संधि, कारक (कर्ता, कर्म, करण...), समास परिचय, शब्द शुद्धि, निबंध लेखन',
      'Computer Science': 'Computer memory units (Bit, Byte, KB, MB, GB, TB), flowcharts & algorithms, MS Excel formulas (SUM, AVERAGE)'
    }
  },
  {
    className: 'VII-A',
    displayName: 'Class 7',
    subjects: {
      'Mathematics': 'Integers properties, simple linear equations (3x - 7 = 14), lines and angles, triangles (Pythagoras theorem), simple interest (SI = PRT/100)',
      'Science': 'Nutrition in Plants (photosynthesis, stomata), Nutrition in Animals (bile, villi), Heat (conduction, convection), Acids Bases Salts (litmus, neutralization), Respiration, Transportation in plants/animals (heart, xylem/phloem), Electric current heating/magnetic effects',
      'English': 'Advanced active/passive voice, indirect speech, conditional clauses, prepositional phrases, notice & email writing',
      'Social Science': 'Delhi Sultanate, Mughal Empire (Akbar, Shah Jahan), Interior of Earth (crust, mantle, core), Atmosphere layers, State Government (MLA, Governor)',
      'Hindi': 'स्वर संधि के भेद, समास (तत्पुरुष, द्वंद्व, द्विगु, बहुव्रीहि), मुहावरे, अलंकार (अनुप्रास, उपमा), संवाद लेखन',
      'Computer Science': 'HTML tags (h1-h6, p, a href, img src, table), Computer Network topologies (Star, Bus, Ring, LAN, WAN), Number systems (Binary to Decimal)'
    }
  },
  {
    className: 'VIII-A',
    displayName: 'Class 8',
    subjects: {
      'Mathematics': 'Rational numbers, Linear equations in one variable, Quadrilateral properties, Square & Cube roots, Compound Interest, Algebraic Identities ((a+b)^2, a^2-b^2), Cylinder surface area & volume',
      'Science': 'Crop production (Kharif/Rabi), Microorganisms (bacteria, fungi, antibiotics, pasteurization), Metals and Non-metals (reactivity series), Coal & Petroleum, Cell structure & organelles (mitochondria, nucleus), Force and Pressure (P = F/A), Friction, Sound, Light laws of reflection',
      'English': 'Complex sentences, non-finite verbs (infinitives, gerunds, participles), transformation of sentences, letter to editor, article writing',
      'Social Science': '1857 Revolt, Battle of Plassey & Buxar, Land and Soil resources, Indian Constitution & Secularism, Judiciary & Supreme Court (PIL)',
      'Hindi': 'व्यंजन ও विसर्ग संधि, अलंकार (यमक, श्लेष, रूपक, उत्प्रेक्षा), वाच्य परिवर्तन, विज्ञापन लेखन, सूचना लेखन',
      'Computer Science': 'Python programming (variables, loops, if-elif-else, functions), Relational Database (SQL concepts, primary key), Web design with CSS'
    }
  },
  {
    className: 'IX-A',
    displayName: 'Class 9',
    subjects: {
      'Mathematics': 'Number Systems (irrational numbers, rationalisation), Polynomials (factor theorem, algebraic identities), Coordinate Geometry, Linear Equations in Two Variables (ax+by+c=0), Triangles congruence (SAS, ASA, RHS), Heron Formula, Surface Areas and Volumes of Spheres/Cones, Statistics',
      'Science': 'Matter in Our Surroundings (latent heat, evaporation), Atoms and Molecules (mole concept, Dalton, chemical formulae), Structure of the Atom (Thomson, Rutherford, Bohr, subatomic particles), Fundamental Unit of Life (cell organelles, mitochondria ATP, lysosomes), Tissues (xylem, phloem, epithelial, nervous neuron), Motion (equations of motion v=u+at, s=ut+1/2at^2), Force & Newton Laws (F=ma), Gravitation (universal law, g=9.8), Work and Energy (KE=1/2mv^2, PE=mgh), Sound (longitudinal waves, echo, ultrasound)',
      'English': 'Reported speech, Modals, Determiners, Subject-verb concord, Descriptive paragraph, Analytical paragraph, Diary entry',
      'Social Science': 'The French Revolution (1789, Bastille), Russian Revolution (Lenin, Bolsheviks), Physical Features of India (Himalayas, Peninsular Plateau), Drainage (Ganga, Indus, Brahmaputra), What is Democracy, Constitutional Design, Economics: People as Resource & Poverty',
      'Hindi': 'पद परिचय, वाक्य रूपांतरण (सरल, संयुक्त, मिश्र), समास, रस व अलंकार, औपचारिक एवं अनौपचारिक पत्र लेखन',
      'Computer Science': 'Python Data Structures (Lists, Tuples, Dictionaries, Slicing), String functions, Custom functions, Cyber Safety & Digital Footprints'
    }
  },
  {
    className: 'X-A',
    displayName: 'Class 10',
    subjects: {
      'Mathematics': 'Real Numbers (Fundamental Theorem of Arithmetic), Polynomials zeroes & coefficients, Pair of Linear Equations in Two Variables (consistency, elimination), Quadratic Equations (quadratic formula, discriminant D = b^2 - 4ac), Arithmetic Progressions (an = a + (n-1)d, Sn = n/2(2a + (n-1)d)), Triangles (Basic Proportionality Theorem), Coordinate Geometry (distance & section formulas), Trigonometry (identities sin^2 + cos^2 = 1, heights & distances), Circles tangents, Statistics (Mean, Median, Mode formulas), Probability (P(E) = n(E)/n(S))',
      'Science': 'Chemical Reactions and Equations (balancing, redox, displacement), Acids Bases and Salts (pH scale, chlor-alkali, bleaching powder, Plaster of Paris), Metals and Non-metals (reactivity series, electrolytic refining), Carbon and its Compounds (homologous series, covalent bonds, esterification, soaps & micelles), Life Processes (autotrophic/heterotrophic nutrition, respiration aerobic/anaerobic, double circulation in human heart, nephron in kidney), Control and Coordination (neuron reflex arc, brain cerebrum/cerebellum, plant hormones auxin/gibberellin), Reproduction (binary fission, budding, sexual reproduction in plants & humans), Heredity (Mendel monohybrid 3:1, dihybrid 9:3:3:1), Light (mirror formula, lens formula, Snell law, power of lens in Dioptres), Human Eye (myopia, hypermetropia, prism dispersion, twinkling of stars), Electricity (Ohm law V=IR, series/parallel resistance, Joule law H=I^2Rt, commercial unit 1 kWh = 3.6x10^6 J), Magnetic Effects (Fleming Left/Right Hand Rule, solenoid, electromagnetic induction), Our Environment (10% energy law, biological magnification, ozone depletion)',
      'English': 'Advanced Subject-Verb Concord, Reported Speech commands/questions, Modals, Determiners, Analytical Paragraph, Formal Letters (Letter to Editor, Complaint, Order)',
      'Social Science': 'Rise of Nationalism in Europe (Napoleonic Code, Unification of Germany/Italy), Nationalism in India (Rowlatt Act, Jallianwala Bagh, Non-Cooperation, Salt March), Resources and Development (soils of India), Water Resources (multipurpose projects, rainwater harvesting), Agriculture (Rabi/Kharif, food crops), Power Sharing (Belgium vs Sri Lanka), Federalism (Union/State/Concurrent lists, decentralisation 73rd amendment), Sectors of Indian Economy (Primary, Secondary, Tertiary, GDP, disguised unemployment), Money and Credit (formal vs informal loans, SHGs, RBI), Globalisation and Indian Economy (MNCs, WTO, trade barriers)',
      'Hindi': 'पद परिचय, वाक्य भेद (सरल, संयुक्त, मिश्र), वाच्य (कर्तृवाच्य, कर्मवाच्य, भाववाच्य), अलंकार (अनुप्रास, यमक, उपमा, रूपक, उत्प्रेक्षा, मानवीकरण, अतिशयोक्ति), रस (श्रृंगार, वीर, करुण, रौद्र...), विज्ञापन ও संदेश लेखन',
      'Computer Science': 'Python Programming (functions, file handling text/csv, modules), Relational Database & SQL (DDL: CREATE/ALTER/DROP, DML: INSERT/SELECT/UPDATE/DELETE, Clauses: WHERE, ORDER BY, GROUP BY, HAVING, Aggregate functions: COUNT, SUM, AVG, MIN, MAX), Computer Networks (LAN, WAN, topologies, TCP/IP, HTTP/HTTPS, DNS, Cyber Ethics & IT Act)'
    }
  }
];

async function executePipeline(requests) {
  const res = await fetch(TURSO_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TURSO_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests: [...requests, { type: 'close' }] })
  });
  if (!res.ok) {
    throw new Error(`Turso HTTP Pipeline error: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

async function generateAIQuestions(gradeName, subjectName, topicStr, attempt = 1) {
  const isHindi = subjectName === 'Hindi';
  const prompt = `You are a senior CBSE curriculum teacher for Tapowan Public School.
Generate exactly 20 authentic, rigorous Multiple Choice Questions (MCQs) for students of "${gradeName}" strictly for the subject "${subjectName}".
Syllabus / Topics: ${topicStr}.
Language: ${isHindi ? 'Hindi (Devanagari script)' : 'English'}.

CRITICAL RULES:
1. All 20 questions MUST strictly belong to the subject "${subjectName}".
2. Do NOT mix questions from other subjects (e.g., if subject is Social Science, include ONLY History, Geography, Civics, Economics; do NOT include Science or Math questions).
3. Questions must test real NCERT textbook concepts for this specific grade level.
4. Provide exactly 4 clear, plausible options per question.
5. Provide correct_answer_index (0 for A, 1 for B, 2 for C, 3 for D).
6. Provide a detailed explanation for the correct answer.

Format output as pure JSON ONLY with no markdown ticks:
{
  "questions": [
    {
      "question_text": "...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_index": 0,
      "explanation": "..."
    }
  ]
}`;

  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  if (openRouterKey) {
    const models = ['openrouter/free', 'google/gemma-4-31b-it:free', 'nvidia/nemotron-3-super-120b-a12b:free'];
    for (const model of models) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + openRouterKey,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://tapowanpublicschool.com',
            'X-Title': 'Tapowan Public School CBSE Daily Quiz'
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (res.ok) {
          const data = await res.json();
          let rawText = data?.choices?.[0]?.message?.content || '';
          rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 10) {
              return parsed.questions.slice(0, 20);
            }
          }
        } else if (res.status === 429) {
          console.warn(`⏳ [OpenRouter Rate Limit] Waiting 5s for ${gradeName} - ${subjectName}...`);
          await new Promise(r => setTimeout(r, 5000));
        }
      } catch (err) {
        console.warn(`[OpenRouter (${model}) Error for ${gradeName} - ${subjectName}]:`, err.message);
      }
    }
  }

  return [];
}

async function generateAndPopulateAllRealCBSE() {
  const todayStr = getTodayISTString();
  console.log('========================================================================');
  console.log(`🚀 POPULATING 100% AUTHENTIC CBSE CURRICULUM QUESTIONS FOR ${todayStr}`);
  console.log('========================================================================');

  // 1. Fetch existing quizzes
  const resAll = await executePipeline([
    { type: 'execute', stmt: { sql: 'SELECT id, class_name, subject FROM app_quizzes;' } }
  ]);
  const existingMap = {};
  const rows = resAll.results?.[0]?.response?.result?.rows || [];
  rows.forEach(r => {
    const id = r[0]?.value;
    const cls = r[1]?.value;
    const sub = r[2]?.value;
    if (cls && sub) {
      existingMap[`${cls}:::${sub.toLowerCase()}`] = Number(id);
    }
  });

  let totalQuizzes = 0;
  let totalQuestionsCount = 0;

  for (const grade of CLASS_SYLLABUS) {
    console.log(`\n🏫 Processing: ${grade.displayName} (${grade.className})`);

    for (const [subjectName, topicStr] of Object.entries(grade.subjects)) {
      const key = `${grade.className}:::${subjectName.toLowerCase()}`;
      let quizId = existingMap[key];

      // Ensure quiz entry exists in DB
      if (!quizId) {
        const createRes = await executePipeline([
          {
            type: 'execute',
            stmt: {
              sql: 'INSERT INTO app_quizzes (date, class_name, subject) VALUES (?, ?, ?)',
              args: [{ type: 'text', value: todayStr }, { type: 'text', value: grade.className }, { type: 'text', value: subjectName }]
            }
          }
        ]);
        quizId = Number(createRes.results?.[0]?.response?.result?.last_insert_rowid);
        existingMap[key] = quizId;
      }

      // Generate 20 authentic questions via Gemini 3.6 Flash
      console.log(`  👉 Generating authentic questions for [${grade.displayName}] - ${subjectName}...`);
      let questions = await generateAIQuestions(grade.displayName, subjectName, topicStr);

      if (questions && questions.length >= 10) {
        // Safe atomic update: update date, delete old questions, insert new 20 questions
        const pipelineRequests = [
          {
            type: 'execute',
            stmt: {
              sql: 'UPDATE app_quizzes SET date = ? WHERE id = ?',
              args: [{ type: 'text', value: todayStr }, { type: 'integer', value: String(quizId) }]
            }
          },
          {
            type: 'execute',
            stmt: {
              sql: 'DELETE FROM app_quiz_questions WHERE quiz_id = ?',
              args: [{ type: 'integer', value: String(quizId) }]
            }
          }
        ];

        questions.forEach(q => {
          const opts = Array.isArray(q.options) && q.options.length >= 4 ? q.options.slice(0, 4) : ['Option A', 'Option B', 'Option C', 'Option D'];
          const correctIdx = typeof q.correct_answer_index === 'number' ? Math.min(3, Math.max(0, q.correct_answer_index)) : 0;
          const explanation = q.explanation || `Study ${subjectName} concepts to understand the solution.`;

          pipelineRequests.push({
            type: 'execute',
            stmt: {
              sql: 'INSERT INTO app_quiz_questions (quiz_id, question_text, options, correct_answer_index, explanation) VALUES (?, ?, ?, ?, ?)',
              args: [
                { type: 'integer', value: String(quizId) },
                { type: 'text', value: String(q.question_text) },
                { type: 'text', value: JSON.stringify(opts) },
                { type: 'integer', value: String(correctIdx) },
                { type: 'text', value: String(explanation) }
              ]
            }
          });
        });

        await executePipeline(pipelineRequests);
        console.log(`  ✅ Saved ${questions.length} authentic questions for [${grade.displayName}] - ${subjectName} (Quiz ID: ${quizId})!`);
        totalQuizzes++;
        totalQuestionsCount += questions.length;
      } else {
        console.warn(`  ⚠️ Could not generate fresh questions for [${grade.displayName}] - ${subjectName}. Preserving previous questions safely.`);
      }

      // 4-second delay between requests to stay strictly below 15 RPM limit
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  console.log('\n========================================================================');
  console.log(`🎉 ALL DONE: Successfully populated ${totalQuestionsCount} authentic questions across ${totalQuizzes} quizzes for ${todayStr}!`);
  console.log('========================================================================');
}

if (require.main === module) {
  generateAndPopulateAllRealCBSE()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { generateAll1400Questions: generateAndPopulateAllRealCBSE, CLASS_SYLLABUS };
