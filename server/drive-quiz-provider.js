const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generateProceduralQuestionsForSubject } = require('./infinite-question-engine');

/**
 * Tapowan Public School - Master CBSE NCERT Zero-Read Drive Quiz Provider
 * Provides 100% authentic, grade-appropriate, subject-pure questions for all 13 classes & 7 subjects.
 * Zero Turso DB read consumption: served instantly from memory / local JSON cache with date-seeded rotation.
 */

// Helper to build a question object
function q(text, options, correctIdx, explanation, chapter = 'General') {
  return {
    question_text: text,
    options: options,
    correct_answer_index: correctIdx,
    explanation: explanation || `Correct answer is ${options[correctIdx]}.`,
    chapter: chapter
  };
}

const MASTER_CURRICULUM_BANK = {
  // =========================================================================
  // PRE-PRIMARY: Nursery, LKG, UKG
  // =========================================================================
  pre_primary: {
    'Mathematics': [
      q('How many wheels does a tricycle have?', ['3', '2', '4', '1'], 0, 'A tricycle has 3 wheels.'),
      q('How many fingers are there on one human hand?', ['5', '4', '6', '10'], 0, 'A hand has 5 fingers.'),
      q('Which shape looks like a full moon or a coin?', ['Circle', 'Square', 'Triangle', 'Rectangle'], 0, 'Circles are round like coins.'),
      q('How many corners does a Triangle have?', ['3', '4', '2', '5'], 0, 'A triangle has 3 corners.'),
      q('Which number comes right AFTER 4?', ['5', '3', '6', '2'], 0, '5 comes after 4.'),
      q('Which number comes right BEFORE 8?', ['7', '9', '6', '10'], 0, '7 comes before 8.'),
      q('What is 2 + 2?', ['4', '3', '5', '6'], 0, '2 + 2 = 4.'),
      q('What is 5 - 1?', ['4', '3', '5', '2'], 0, '5 - 1 = 4.'),
      q('Which is BIGGER: Elephant or Mouse?', ['Elephant', 'Mouse', 'Both same', 'None'], 0, 'An elephant is much bigger.'),
      q('How many sides does a square have?', ['4', '3', '5', '2'], 0, 'A square has 4 equal sides.'),
      q('What is 1 + 1?', ['2', '1', '3', '0'], 0, '1 + 1 = 2.'),
      q('What is 3 + 0?', ['3', '0', '4', '30'], 0, 'Adding zero leaves number unchanged.'),
      q('Count the stars: ⭐ ⭐ ⭐', ['3', '2', '4', '5'], 0, 'There are 3 stars.'),
      q('Which shape has 4 sides like a door?', ['Rectangle', 'Circle', 'Triangle', 'Star'], 0, 'Doors are rectangular.'),
      q('Which number is SMALLER: 2 or 7?', ['2', '7', 'Equal', '9'], 0, '2 is smaller than 7.')
    ],
    'Science': [
      q('Which animal gives us healthy milk and eats green grass?', ['Cow', 'Lion', 'Tiger', 'Fox'], 0, 'Cows give us nutritious milk.'),
      q('We see colorful things with our ___', ['Eyes', 'Ears', 'Nose', 'Tongue'], 0, 'Eyes are for seeing.'),
      q('We listen to songs and voices with our ___', ['Ears', 'Eyes', 'Hands', 'Legs'], 0, 'Ears are for hearing.'),
      q('We smell flowers and food with our ___', ['Nose', 'Eyes', 'Teeth', 'Feet'], 0, 'Nose is for smelling.'),
      q('What shines brightly in the sky during the daytime?', ['Sun', 'Moon', 'Stars', 'Rainbow'], 0, 'The Sun gives us daytime light.'),
      q('What shines in the sky at night along with stars?', ['Moon', 'Sun', 'Clouds', 'Fire'], 0, 'The Moon shines at night.'),
      q('What is the color of fresh tree leaves?', ['Green', 'Red', 'Blue', 'Black'], 0, 'Chlorophyll makes leaves green.'),
      q('What is the color of a ripe juicy Apple?', ['Red', 'Blue', 'Black', 'Purple'], 0, 'Apples are red.'),
      q('Where do fish live and swim?', ['In Water', 'In Trees', 'On Land', 'In Air'], 0, 'Fish live in water.'),
      q('Which bird has a green body and a red beak?', ['Parrot', 'Crow', 'Pigeon', 'Sparrow'], 0, 'Parrots have green feathers and red beaks.'),
      q('Which animal is called the King of the Jungle?', ['Lion', 'Deer', 'Monkey', 'Rabbit'], 0, 'Lion is the king of the jungle.'),
      q('What do honeybees make for us?', ['Honey', 'Milk', 'Juice', 'Water'], 0, 'Bees make sweet honey.'),
      q('What falls from clouds when it rains?', ['Water drops', 'Leaves', 'Sand', 'Rocks'], 0, 'Rain consists of liquid water drops.')
    ],
    'English': [
      q("What is the first letter of the English Alphabet?", ['A', 'B', 'C', 'Z'], 0, "Alphabet begins with A."),
      q("What is the opposite of 'HOT'?", ['Cold', 'Warm', 'Big', 'Fast'], 0, "Opposite of hot is cold."),
      q("What is the opposite of 'BIG'?", ['Small', 'Tall', 'Heavy', 'Long'], 0, "Opposite of big is small."),
      q("What is the opposite of 'DAY'?", ['Night', 'Sun', 'Morning', 'Light'], 0, "Opposite of day is night."),
      q("What is the plural of 'CAT'?", ['Cats', 'Caties', 'Cates', 'Kittens'], 0, "One cat, two cats."),
      q("Which of these letters is a Vowel?", ['A', 'B', 'C', 'D'], 0, "A, E, I, O, U are vowels."),
      q("Which of these letters is a Vowel?", ['E', 'T', 'M', 'P'], 0, "E is a vowel."),
      q("Complete the rhyming sound: CAT - BAT - ___", ['MAT', 'DOG', 'SUN', 'BUS'], 0, "Cat, bat, mat rhyme."),
      q("What is the opposite of 'HAPPY'?", ['Sad', 'Glad', 'Fun', 'Joy'], 0, "Opposite of happy is sad."),
      q("How many letters are in the English Alphabet?", ['26', '24', '28', '20'], 0, "There are 26 letters in English.")
    ],
    'Hindi': [
      q("हिंदी वर्णमाला का पहला स्वर कौन सा है?", ['अ', 'क', 'ख', 'ज्ञ'], 0, "स्वर 'अ' से शुरू होते हैं।"),
      q("'फल' शब्द का सही अर्थ क्या है?", ['Fruit', 'Water', 'House', 'Tree'], 0, "फल का अर्थ Fruit होता है।"),
      q("'दिन' का विलोम (उल्टा) शब्द क्या है?", ['रात', 'सुबह', 'दोपहर', 'शाम'], 0, "दिन का विलोम रात होता है।"),
      q("'बड़ा' का विलोम शब्द क्या है?", ['छोटा', 'लंबा', 'मोटा', 'गर्म'], 0, "बड़ा का विलोम छोटा होता है।"),
      q("भारत का राष्ट्रीय पक्षी कौन सा है?", ['मोर', 'तोता', 'कौआ', 'कबूतर'], 0, "मोर भारत का राष्ट्रीय पक्षी है।"),
      q("'जल' का दूसरा नाम क्या है?", ['पानी', 'आग', 'हवा', 'मिट्टी'], 0, "जल को पानी भी कहते हैं।")
    ]
  },

  // =========================================================================
  // PRIMARY: Classes 1 to 5
  // =========================================================================
  primary: {
    'Mathematics': [
      q('What is the place value of 7 in the number 472?', ['70 (Tens)', '7 (Ones)', '700 (Hundreds)', '7000'], 0, '7 is in tens place: 7 × 10 = 70.', 'Place Value'),
      q('What is 15 × 6?', ['90', '80', '95', '100'], 0, '15 × 6 = 90.', 'Multiplication'),
      q('What is the Roman numeral for 10?', ['X', 'V', 'L', 'C'], 0, 'X represents 10.', 'Roman Numerals'),
      q('What is the Roman numeral for 50?', ['L', 'X', 'C', 'D'], 0, 'L represents 50.', 'Roman Numerals'),
      q('How many centimeters (cm) are in 1 meter (m)?', ['100 cm', '10 cm', '1000 cm', '50 cm'], 0, '1 m = 100 cm.', 'Measurement'),
      q('How many grams (g) make 1 kilogram (kg)?', ['1000 g', '100 g', '500 g', '10 g'], 0, '1 kg = 1000 g.', 'Measurement'),
      q('What is the perimeter of a square with side 6 cm?', ['24 cm', '36 cm', '12 cm', '18 cm'], 0, 'Perimeter = 4 × side = 4 × 6 = 24 cm.', 'Geometry'),
      q('What is the area of a rectangle with length 8 cm and width 5 cm?', ['40 sq cm', '26 sq cm', '13 sq cm', '80 sq cm'], 0, 'Area = Length × Width = 8 × 5 = 40 sq cm.', 'Mensuration'),
      q('Which is the smallest 3-digit number?', ['100', '99', '101', '999'], 0, '100 is the smallest three-digit number.', 'Number System'),
      q('What is 1/2 of 100?', ['50', '25', '75', '40'], 0, 'Half of 100 is 50.', 'Fractions'),
      q('Which number is an Even number?', ['24', '13', '17', '31'], 0, '24 ends in 4 and is divisible by 2.', 'Numbers'),
      q('What is the average (mean) of 10, 20, and 30?', ['20', '15', '25', '60'], 0, 'Average = (10+20+30)/3 = 60/3 = 20.', 'Statistics')
    ],
    'Science': [
      q('Which part of the plant prepares food by Photosynthesis?', ['Leaves', 'Roots', 'Stem', 'Flowers'], 0, 'Leaves are the food factories of green plants.', 'Plant Biology'),
      q('Which gas do humans inhale to stay alive?', ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Helium'], 0, 'Humans inhale oxygen for respiration.', 'Human Body'),
      q('Which gas do green plants absorb from the air during daytime?', ['Carbon Dioxide', 'Oxygen', 'Argon', 'Hydrogen'], 0, 'Plants absorb CO2 for photosynthesis.', 'Plant Biology'),
      q('What is the boiling point of pure water at sea level?', ['100°C', '0°C', '50°C', '200°C'], 0, 'Water boils at 100°C.', 'Matter'),
      q('What is the freezing point of water?', ['0°C', '100°C', '32°C', '-10°C'], 0, 'Water freezes into ice at 0°C.', 'Matter'),
      q('How many bones are in an adult human skeletal system?', ['206', '300', '150', '250'], 0, 'An adult has 206 bones.', 'Anatomy'),
      q('Which organ pumps blood throughout the human body?', ['Heart', 'Lungs', 'Stomach', 'Brain'], 0, 'The heart pumps blood continuously.', 'Circulatory System'),
      q('Which planet is known as the Blue Planet?', ['Earth', 'Mars', 'Jupiter', 'Venus'], 0, 'Earth is called the Blue Planet due to vast oceans.', 'Solar System'),
      q('Which vitamin is produced naturally when skin is exposed to morning sunlight?', ['Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B'], 0, 'Sunlight triggers Vitamin D synthesis.', 'Nutrition'),
      q('Animals that eat ONLY plants are called:', ['Herbivores', 'Carnivores', 'Omnivores', 'Parasites'], 0, 'Herbivores feed only on plants.', 'Ecosystem')
    ],
    'Social Science': [
      q('How many continents are there on planet Earth?', ['7', '5', '8', '6'], 0, 'There are 7 continents.', 'Geography'),
      q('Which is the largest ocean on Earth?', ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], 0, 'The Pacific Ocean is the largest.', 'Geography'),
      q('What is the capital city of India?', ['New Delhi', 'Mumbai', 'Kolkata', 'Chennai'], 0, 'New Delhi is the national capital of India.', 'Civics'),
      q('Who is known as the Father of the Nation in India?', ['Mahatma Gandhi', 'Subhas Chandra Bose', 'Bhagat Singh', 'Jawaharlal Nehru'], 0, 'Mahatma Gandhi is revered as the Father of the Nation.', 'History'),
      q('What is the national animal of India?', ['Royal Bengal Tiger', 'Lion', 'Elephant', 'Peacock'], 0, 'The Royal Bengal Tiger is the national animal.', 'National Symbols'),
      q('On which date do we celebrate India’s Independence Day?', ['15th August', '26th January', '2nd October', '14th November'], 0, 'India gained independence on 15 August 1947.', 'History'),
      q('On which date do we celebrate Republic Day in India?', ['26th January', '15th August', '5th September', '2nd October'], 0, 'Republic Day celebrates the Constitution taking effect on 26 Jan 1950.', 'Civics'),
      q('Which state in India is known as the Land of Five Rivers?', ['Punjab', 'Haryana', 'Rajasthan', 'Gujarat'], 0, 'Punjab derives its name from five rivers (Panj Ab).', 'Geography'),
      q('Which is the highest mountain peak in the world?', ['Mount Everest', 'K2', 'Kanchenjunga', 'Makalu'], 0, 'Mount Everest (8848.86 m) in Himalayas is the highest.', 'Geography'),
      q('Which monument in Agra was built by Mughal Emperor Shah Jahan?', ['Taj Mahal', 'Red Fort', 'Qutub Minar', 'Hawa Mahal'], 0, 'Shah Jahan built the Taj Mahal in memory of Mumtaz Mahal.', 'History')
    ],
    'Hindi': [
      q("किसी व्यक्ति, वस्तु, स्थान या भाव के नाम को क्या कहते हैं?", ['संज्ञा', 'सर्वनाम', 'विशेषण', 'क्रिया'], 0, "नाम बताने वाले शब्द संज्ञा कहलाते हैं।", "व्याकरण"),
      q("संज्ञा के स्थान पर प्रयोग होने वाले शब्दों को क्या कहते हैं?", ['सर्वनाम', 'विशेषण', 'क्रिया', 'अव्यय'], 0, "जैसे: वह, यह, तुम, हम सर्वनाम हैं।", "व्याकरण"),
      q("संज्ञा या सर्वनाम की विशेषता बताने वाले शब्द क्या कहलाते हैं?", ['विशेषण', 'क्रिया', 'कारक', 'संधि'], 0, "जैसे: सुंदर, मीठा, लाल विशेषण हैं।", "व्याकरण"),
      q("'अंधे की लाठी' मुहावरे का सही अर्थ क्या है?", ['एकमात्र सहारा', 'लाठी से चलना', 'रास्ता भूलना', 'मदद न करना'], 0, "अंधे की लाठी का अर्थ एकमात्र सहारा होना है।", "मुहावरे"),
      q("'आँखों का तारा' मुहावरे का सही अर्थ क्या है?", ['बहुत प्यारा होना', 'तारे देखना', 'आँख में दर्द', 'दूर की चीज'], 0, "आँखों का तारा मतलब अत्यंत प्रिय होना।", "मुहावरे"),
      q("'सूर्य' का सही पर्यायवाची शब्द कौन सा है?", ['दिनकर / रवि', 'शशि', 'पवन', 'वारि'], 0, "दिनकर, भास्कर, रवि सूर्य के पर्यायवाची हैं।", "पर्यायवाची"),
      q("'सत्य' का विलोम (विपरीतार्थक) शब्द क्या है?", ['असत्य / झूठ', 'सच', 'धर्म', 'न्याय'], 0, "सत्य का विलोम असत्य होता है।", "विलोम"),
      q("'आकाश' का सही पर्यायवाची शब्द क्या है?", ['गगन / नभ', 'धरा', 'सागर', 'अनल'], 0, "गगन, नभ, अंबर आकाश के पर्यायवाची हैं।", "पर्यायवाची")
    ],
    'English': [
      q("Identify the Noun in: 'The teacher wrote on the green board.'", ['Teacher / Board', 'Wrote', 'Green', 'On'], 0, "'Teacher' and 'Board' are naming words (nouns).", "Grammar"),
      q("Identify the Verb in: 'The children played in the park.'", ['played', 'children', 'park', 'in'], 0, "'Played' is the action word (verb).", "Grammar"),
      q("Identify the Adjective in: 'She has a shiny red bicycle.'", ['Shiny / Red', 'Bicycle', 'She', 'Has'], 0, "'Shiny' and 'Red' describe the bicycle.", "Grammar"),
      q("What is the plural of 'Child'?", ['Children', 'Childs', 'Childrens', 'Childes'], 0, "'Child' has irregular plural 'children'.", "Vocabulary"),
      q("What is the past tense of 'Go'?", ['Went', 'Gone', 'Goes', 'Going'], 0, "Past tense of go is went.", "Tenses"),
      q("Choose the correct article: 'He ate ___ apple in the morning.'", ['an', 'a', 'the', 'no article'], 0, "'Apple' starts with vowel sound 'a', so we use 'an'.", "Articles"),
      q("What is the synonym of 'Huge'?", ['Gigantic', 'Tiny', 'Small', 'Narrow'], 0, "Gigantic means extremely large or huge.", "Vocabulary"),
      q("What is the antonym of 'Ancient'?", ['Modern', 'Old', 'Historic', 'Past'], 0, "Ancient means very old; opposite is Modern.", "Vocabulary")
    ],
    'Computer Science': [
      q('Which part of the computer is known as the Brain of Computer?', ['CPU (Central Processing Unit)', 'Monitor', 'Keyboard', 'Mouse'], 0, 'CPU executes all processing instructions.', 'Computer Fundamentals'),
      q('Which of the following is an INPUT device?', ['Keyboard', 'Monitor', 'Printer', 'Speaker'], 0, 'Keyboard inputs alphanumeric characters.', 'Hardware'),
      q('Which of the following is an OUTPUT device?', ['Monitor / Printer', 'Mouse', 'Keyboard', 'Scanner'], 0, 'Monitors and printers output processed information.', 'Hardware'),
      q('What is the full form of RAM in computer memory?', ['Random Access Memory', 'Read Access Memory', 'Real Active Memory', 'Run Auto Memory'], 0, 'RAM is primary volatile memory.', 'Memory'),
      q('Which keyboard shortcut is universally used to COPY text or files?', ['Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z'], 0, 'Ctrl + C copies the selection.', 'Shortcuts'),
      q('Which keyboard shortcut is universally used to PASTE copied items?', ['Ctrl + V', 'Ctrl + C', 'Ctrl + P', 'Ctrl + S'], 0, 'Ctrl + V pastes from clipboard.', 'Shortcuts'),
      q('What is the full form of WWW in internet browsing?', ['World Wide Web', 'World Wide Word', 'Wide World Web', 'Web World Wide'], 0, 'WWW stands for World Wide Web.', 'Internet')
    ],
    'General Knowledge': [
      q('Which is the national flower of India?', ['Lotus', 'Rose', 'Sunflower', 'Jasmine'], 0, 'Lotus (Nelumbo Nucifera) is the national flower.', 'India GK'),
      q('Who wrote the national anthem of India (Jana Gana Mana)?', ['Rabindranath Tagore', 'Bankim Chandra Chattopadhyay', 'Sarojini Naidu', 'Premchand'], 0, 'Rabindranath Tagore composed the national anthem.', 'National Symbols'),
      q('Which is the longest river flowing in India?', ['Ganga', 'Yamuna', 'Godavari', 'Brahmaputra'], 0, 'River Ganga (2525 km) is the longest in India.', 'Geography'),
      q('Which is the fastest land animal in the world?', ['Cheetah', 'Lion', 'Horse', 'Leopard'], 0, 'Cheetah can reach speeds up to 120 km/h.', 'Nature'),
      q('How many days are there in a Leap Year?', ['366 days', '365 days', '364 days', '360 days'], 0, 'A leap year has 366 days (Feb 29).', 'Science GK')
    ]
  },

  // =========================================================================
  // MIDDLE SCHOOL: Classes 6, 7, 8
  // =========================================================================
  middle: {
    'Mathematics': [
      q('What is the value of: (-15) + (+25) - (-10)?', ['20', '0', '-20', '50'], 0, '-15 + 25 + 10 = 10 + 10 = 20.', 'Integers'),
      q('Solve for x: 3x - 7 = 14', ['7', '5', '9', '21'], 0, '3x = 21 => x = 7.', 'Linear Equations'),
      q('What is the square of 15 (15²)?', ['225', '215', '235', '150'], 0, '15 × 15 = 225.', 'Squares'),
      q('What is the square root of 196 (√196)?', ['14', '16', '12', '18'], 0, '14 × 14 = 196.', 'Roots'),
      q('The sum of all three interior angles of any triangle is always:', ['180°', '360°', '90°', '270°'], 0, 'Angles of a triangle sum to 180°.', 'Geometry'),
      q('According to Pythagoras Theorem in a right triangle:', ['Hypotenuse² = Base² + Perpendicular²', 'Hypotenuse = Base + Perpendicular', 'Hypotenuse² = Base² - Perpendicular²', 'Hypotenuse = Base × Height'], 0, 'H² = P² + B².', 'Geometry'),
      q('What is the formula for the Simple Interest (SI)?', ['SI = (P × R × T) / 100', 'SI = P + R + T', 'SI = (P × R) / T', 'SI = P × (1 + R)^T'], 0, 'Simple Interest = PRT/100.', 'Commercial Math'),
      q('What is the value of any non-zero number raised to the power 0 (e.g. 7⁰)?', ['1', '0', '7', 'Undefined'], 0, 'x⁰ = 1 for any non-zero x.', 'Exponents'),
      q('What is the ratio of 25 cm to 1 meter in simplest form?', ['1 : 4', '1 : 25', '1 : 5', '4 : 1'], 0, '25 cm / 100 cm = 1/4 = 1:4.', 'Ratio'),
      q('A regular hexagon has each side measuring 6 cm. What is its perimeter?', ['36 cm', '30 cm', '24 cm', '42 cm'], 0, 'Perimeter = 6 × 6 = 36 cm.', 'Mensuration')
    ],
    'Science': [
      q('Which cellular organelle is universally known as the Powerhouse of the Cell?', ['Mitochondria', 'Nucleus', 'Ribosome', 'Chloroplast'], 0, 'Mitochondria produce ATP energy.', 'Cell Biology'),
      q('What is the chemical formula of common table salt?', ['NaCl', 'H2O', 'HCl', 'NaOH'], 0, 'Sodium chloride is NaCl.', 'Chemistry'),
      q('What is the SI unit of Force?', ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'], 0, 'Force is measured in Newtons.', 'Physics'),
      q('What is the SI unit of Work and Energy?', ['Joule (J)', 'Newton (N)', 'Watt (W)', 'Volt (V)'], 0, 'Work and energy are measured in Joules.', 'Physics'),
      q('Acids turn Blue Litmus paper into what color?', ['Red', 'Blue', 'Green', 'Yellow'], 0, 'Acids turn blue litmus red.', 'Chemistry'),
      q('Bases turn Red Litmus paper into what color?', ['Blue', 'Red', 'Colorless', 'Purple'], 0, 'Bases turn red litmus blue.', 'Chemistry'),
      q('What is the pH value of pure neutral water at 25°C?', ['7 (Neutral)', '0 (Acidic)', '14 (Basic)', '4'], 0, 'pH 7 is neutral.', 'Chemistry'),
      q('Which metal is liquid at standard room temperature?', ['Mercury (Hg)', 'Iron (Fe)', 'Gold (Au)', 'Copper (Cu)'], 0, 'Mercury is liquid at room temperature.', 'Chemistry'),
      q('Through which medium can sound waves NOT travel?', ['Vacuum', 'Water', 'Steel', 'Air'], 0, 'Sound requires a material medium.', 'Physics'),
      q('Which blood cells fight bacterial infections in human immune system?', ['White Blood Cells (WBCs)', 'Red Blood Cells', 'Platelets', 'Plasma'], 0, 'WBCs fight pathogens.', 'Biology')
    ],
    'Social Science': [
      q('Which major ancient city of the Indus Valley civilization means "Mound of the Dead"?', ['Mohenjo-daro', 'Harappa', 'Lothal', 'Kalibangan'], 0, 'Mohenjo-daro means Mound of the Dead in Sindhi.', 'Ancient History'),
      q('Which great Mauryan Emperor gave up war after the Kalinga War and embraced Buddhism?', ['Ashoka the Great', 'Chandragupta Maurya', 'Bindusara', 'Samudragupta'], 0, 'Ashoka adopted Dhamma and peace after Kalinga War in 261 BCE.', 'Ancient History'),
      q('Who was the first and only woman monarch to rule the Delhi Sultanate?', ['Razia Sultana', 'Noor Jahan', 'Chand Bibi', 'Mumtaz Mahal'], 0, 'Razia Sultana ruled 1236-1240 CE.', 'Medieval History'),
      q('Which Mughal Emperor founded the Din-i-Ilahi religion promoting universal harmony?', ['Akbar the Great', 'Babur', 'Shah Jahan', 'Aurangzeb'], 0, 'Akbar promoted Sulh-i-Kul and Din-i-Ilahi.', 'Medieval History'),
      q('In which atmospheric layer do weather phenomena (clouds, rainfall, winds) occur?', ['Troposphere', 'Stratosphere', 'Mesosphere', 'Thermosphere'], 0, 'Troposphere holds 75% of atmospheric mass and weather.', 'Geography'),
      q('Where did the historic Indian Revolt of 1857 begin on May 10, 1857?', ['Meerut', 'Delhi', 'Kanpur', 'Jhansi'], 0, 'Sepoy mutiny started in Meerut cantonment.', 'Modern History'),
      q('Who is recognized as the Chief Architect of the Indian Constitution?', ['Dr. B. R. Ambedkar', 'Mahatma Gandhi', 'Jawaharlal Nehru', 'Sardar Patel'], 0, 'Dr. B. R. Ambedkar chaired the Drafting Committee.', 'Civics'),
      q('What is the minimum voting age for Indian citizens in general elections?', ['18 Years', '21 Years', '16 Years', '25 Years'], 0, 'The 61st Amendment lowered voting age to 18.', 'Civics'),
      q('Which type of soil covers the fertile Northern Plains of India?', ['Alluvial Soil', 'Black Soil', 'Red Soil', 'Laterite Soil'], 0, 'Alluvial soil deposited by Himalayan rivers is very fertile.', 'Geography'),
      q('What is the grassroots local self-government body in an Indian village?', ['Gram Panchayat', 'Zila Parishad', 'Municipal Corporation', 'Vidhan Sabha'], 0, 'Gram Panchayat governs village affairs.', 'Civics')
    ],
    'Hindi': [
      q("'सूर्योदय' शब्द का सही संधि-विच्छेद क्या होगा?", ['सूर्य + उदय', 'सूर्यो + दय', 'सूर + उदय', 'सूर्य + दय'], 0, "अ + उ = ओ (गुण स्वर संधि)।", "संधि"),
      q("'दशानन' (दस सिर वाला अर्थात् रावण) में कौन सा समास है?", ['बहुव्रीहि समास', 'द्विगु समास', 'तत्पुरुष समास', 'कर्मधारय समास'], 0, "तीसरे विशेष अर्थ का बोध कराने पर बहुव्रीहि समास होता है।", "समास"),
      q("'तरनि तनूजा तट तमाल तरुवर बहु छाए' में कौन सा अलंकार है?", ['अनुप्रास अलंकार', 'यमक अलंकार', 'उपमा अलंकार', 'रूपक अलंकार'], 0, "'त' वर्ण की आवृत्ति से अनुप्रास अलंकार है।", "अलंकार"),
      q("'कनक कनक ते सौ गुनी, मादकता अधिकाय' में कौन सा अलंकार है?", ['यमक अलंकार', 'अनुप्रास अलंकार', 'श्लेष अलंकार', 'उपमा अलंकार'], 0, "कनक शब्द के दो भिन्न अर्थ (सोना और धतूरा) होने से यमक अलंकार है।", "अलंकार"),
      q("'अंगूठा दिखाना' मुहावरे का सही अर्थ क्या है?", ['साफ मना कर देना', 'मदद करना', 'अंगूठा काटना', 'ताली बजाना'], 0, "समय पर साफ इनकार करना।", "मुहावरे"),
      q("'अमृत' शब्द का सही पर्यायवाची शब्द कौन सा है?", ['सुधा / पीयूष', 'विष', 'गरल', 'वारि'], 0, "सुधा और पीयूष अमृत के पर्यायवाची हैं।", "पर्यायवाची"),
      q("रचना की दृष्टि से वाक्य के कितने भेद होते हैं?", ['तीन (सरल, संयुक्त, मिश्र)', 'दो', 'चार', 'आठ'], 0, "सरल वाक्य, संयुक्त वाक्य, मिश्र वाक्य।", "वाक्य भेद")
    ],
    'English': [
      q("Identify the sentence in Passive Voice:", ['A song was sung by Sheela.', 'Sheela sang a song.', 'Sheela is singing.', 'Sheela will sing.'], 0, "Action receiver is subject in passive voice.", "Voice"),
      q("Choose the correct preposition: 'She has lived here ___ 2020.'", ['since', 'for', 'from', 'at'], 0, "'Since' is used for a specific point in time.", "Prepositions"),
      q("Choose the correct preposition: 'He waited for the train ___ two hours.'", ['for', 'since', 'at', 'during'], 0, "'For' is used for duration of time.", "Prepositions"),
      q("What is the meaning of the idiom: 'A piece of cake'?", ['A very easy task', 'A sweet dessert', 'A difficult exam', 'A birthday gift'], 0, "It means very easy to do.", "Idioms"),
      q("Identify the figure of speech: 'The wind whispered through the dark trees.'", ['Personification', 'Simile', 'Metaphor', 'Hyperbole'], 0, "Attributing human traits to wind is Personification.", "Poetic Devices"),
      q("Identify the figure of speech: 'He fought like a lion in battle.'", ['Simile', 'Metaphor', 'Personification', 'Alliteration'], 0, "Comparison using 'like' is a Simile.", "Poetic Devices"),
      q("Choose the correctly spelt word:", ['Accommodation', 'Acommodation', 'Accomodation', 'Acomodation'], 0, "Accommodation has double c and double m.", "Spelling")
    ],
    'Computer Science': [
      q('How many bits are in 1 Byte of computer storage?', ['8 Bits', '4 Bits (1 Nibble)', '16 Bits', '1024 Bits'], 0, '1 Byte = 8 bits.', 'Data Units'),
      q('How many Kilobytes (KB) are in 1 Megabyte (MB)?', ['1024 KB', '1000 KB', '512 KB', '2048 KB'], 0, '1 MB = 1024 KB.', 'Data Units'),
      q('Which HTML tag is used to create a clickable hyperlink?', ['<a>', '<link>', '<href>', '<url>'], 0, '<a href="..."> creates hyperlinks.', 'HTML'),
      q('What network topology connects all devices to a single central hub/switch?', ['Star Topology', 'Bus Topology', 'Ring Topology', 'Mesh Topology'], 0, 'Star topology routes through a central switch.', 'Networking'),
      q('What is the output of Python expression: `15 // 4`?', ['3', '3.75', '3.0', '4'], 0, 'Integer floor division // drops decimals.', 'Python'),
      q('Which symbol is used for single-line comments in Python?', ['# (Hash)', '//', '/*', '<!--'], 0, '# initiates a comment in Python.', 'Python')
    ],
    'General Knowledge': [
      q('Which planet in our solar system is known as the Red Planet?', ['Mars', 'Venus', 'Jupiter', 'Mercury'], 0, 'Mars has iron oxide on surface giving red color.', 'Astronomy'),
      q('Where is the headquarters of the United Nations (UN) located?', ['New York City, USA', 'Geneva, Switzerland', 'Paris, France', 'London, UK'], 0, 'UN headquarters is in NYC.', 'World GK'),
      q('Which Indian scientist won the Nobel Prize in Physics for light scattering effect?', ['Sir C. V. Raman', 'Homi Bhabha', 'A. P. J. Abdul Kalam', 'Satyendra Nath Bose'], 0, 'C. V. Raman won Nobel Prize in 1930.', 'Science GK'),
      q('Which is the highest civilian award of the Republic of India?', ['Bharat Ratna', 'Padma Vibhushan', 'Param Vir Chakra', 'Padma Bhushan'], 0, 'Bharat Ratna is India’s highest civilian honour.', 'Awards')
    ]
  },

  // =========================================================================
  // SENIOR HIGH: Classes 9 & 10
  // =========================================================================
  senior: {
    'Mathematics': [
      q('In quadratic equation ax² + bx + c = 0, what is the discriminant formula?', ['D = b² - 4ac', 'D = b² + 4ac', 'D = 2a / b', 'D = 4ac - b²'], 0, 'Discriminant D = b² - 4ac.', 'Quadratic Equations'),
      q('If discriminant D = b² - 4ac > 0, the roots of the quadratic equation are:', ['Real and Distinct (Unequal)', 'Real and Equal', 'Imaginary / Complex', 'Zero'], 0, 'D > 0 produces two distinct real roots.', 'Quadratic Equations'),
      q('What is the fundamental trigonometric identity relating sin and cos?', ['sin²θ + cos²θ = 1', 'sin²θ - cos²θ = 1', 'sinθ + cosθ = 1', 'tan²θ + 1 = sin²θ'], 0, 'sin²θ + cos²θ = 1 for all angles θ.', 'Trigonometry'),
      q('What is the exact value of tan(45°)?', ['1', '0', '1/√3', '√3'], 0, 'tan(45°) = 1.', 'Trigonometry'),
      q('What is the nth term formula (a_n) of an Arithmetic Progression (AP)?', ['a_n = a + (n - 1)d', 'a_n = a + nd', 'a_n = a - (n - 1)d', 'a_n = n(a + d)'], 0, 'a_n = a + (n-1)d.', 'Arithmetic Progressions'),
      q('What is the distance between points (0, 0) and (3, 4) in coordinate plane?', ['5 units', '7 units', '25 units', '1 unit'], 0, 'd = √(3² + 4²) = √25 = 5.', 'Coordinate Geometry'),
      q('What is the Total Surface Area of a Sphere of radius r?', ['4πr²', '2πr²', '4/3 πr³', 'πr²'], 0, 'TSA of sphere = 4πr².', 'Mensuration'),
      q('A line that touches a circle at exactly ONE single point is called a:', ['Tangent', 'Secant', 'Chord', 'Diameter'], 0, 'A tangent touches at one point.', 'Circles'),
      q('What is the probability of a guaranteed / certain event?', ['1', '0', '0.5', '100'], 0, 'Probability of a sure event is 1.', 'Probability'),
      q('According to empirical relationship in statistics: 3 Median =', ['Mode + 2 Mean', 'Mode - 2 Mean', '2 Mode + Mean', 'Mode + Mean'], 0, '3 Median = Mode + 2 Mean.', 'Statistics')
    ],
    'Science': [
      q("According to Ohm's Law in electricity, the relation between Voltage V, Current I, and Resistance R is:", ['V = I × R', 'I = V × R', 'R = V × I', 'V = I / R'], 0, 'V = IR.', 'Electricity'),
      q('What is the SI unit of Electric Power?', ['Watt (W)', 'Joule (J)', 'Volt (V)', 'Ampere (A)'], 0, 'Power is measured in Watts (1 W = 1 J/s).', 'Electricity'),
      q("Newton's First Law of Motion is also known as the Law of:", ['Inertia', 'Action-Reaction', 'Momentum', 'Gravitation'], 0, 'First law defines inertia.', 'Physics'),
      q('What is the Mirror Formula in optics?', ['1/f = 1/v + 1/u', '1/f = 1/v - 1/u', 'f = v + u', '1/f = v × u'], 0, 'Mirror formula: 1/f = 1/v + 1/u.', 'Optics'),
      q('What is the Lens Formula in optics?', ['1/f = 1/v - 1/u', '1/f = 1/v + 1/u', 'f = v / u', '1/f = v - u'], 0, 'Lens formula: 1/f = 1/v - 1/u.', 'Optics'),
      q('Which functional unit of human kidney filters blood to produce urine?', ['Nephron', 'Neuron', 'Alveoli', 'Glomerulus'], 0, 'Nephrons filter blood in kidneys.', 'Life Processes'),
      q('Which functional unit of the human nervous system conducts electrical impulses?', ['Neuron (Nerve Cell)', 'Nephron', 'Capillary', 'Axon'], 0, 'Neurons conduct nerve signals.', 'Control & Coordination'),
      q('What is the chemical formula of Baking Soda (Sodium Bicarbonate)?', ['NaHCO3', 'Na2CO3', 'NaCl', 'NaOH'], 0, 'Sodium hydrogen carbonate is NaHCO3.', 'Chemistry'),
      q('What is the chemical formula of Plaster of Paris (POP)?', ['CaSO4 · 1/2 H2O', 'CaSO4 · 2 H2O', 'CaCO3', 'CaO'], 0, 'Calcium sulphate hemihydrate is POP.', 'Chemistry'),
      q('In modern periodic table, elements are arranged in increasing order of their:', ['Atomic Number (Z)', 'Atomic Mass', 'Number of Neutrons', 'Density'], 0, 'Moseley arranged table by atomic number.', 'Periodic Classification')
    ],
    'Social Science': [
      q('From where did Mahatma Gandhi launch the historic Salt March (Dandi March) in 1930?', ['Sabarmati Ashram (Ahmedabad)', 'Champaran', 'Wardha', 'Dandi Beach'], 0, 'Gandhi marched 240 miles from Sabarmati to Dandi.', 'Nationalism in India'),
      q('In which year did the French Revolution start with the storming of the Bastille?', ['1789', '1776', '1804', '1815'], 0, 'Storming of Bastille took place on 14 July 1789.', 'World History'),
      q('Which institution acts as the central monetary authority and issues banknotes in India?', ['Reserve Bank of India (RBI)', 'State Bank of India', 'Ministry of Finance', 'NITI Aayog'], 0, 'RBI regulates banking and currency in India.', 'Economics'),
      q('Which sector of the economy includes agriculture, fishing, forestry, and mining?', ['Primary Sector', 'Secondary Sector (Manufacturing)', 'Tertiary Sector (Services)', 'Quaternary'], 0, 'Direct extraction of natural resources is Primary Sector.', 'Economics'),
      q('Which Constitutional Amendment established constitutional status for Panchayati Raj in India?', ['73rd Constitutional Amendment Act, 1992', '42nd Amendment', '44th Amendment', '86th Amendment'], 0, 'The 73rd Amendment institutionalized Panchayati Raj.', 'Civics'),
      q('How many lists of legislative powers are defined in the 7th Schedule of Indian Constitution?', ['Three (Union, State, Concurrent Lists)', 'Two', 'Four', 'One'], 0, 'Union List, State List, Concurrent List divide powers.', 'Civics'),
      q('Which black soil in India is most suitable for commercial Cotton cultivation?', ['Regur Soil (Black Soil)', 'Alluvial Soil', 'Red Soil', 'Laterite Soil'], 0, 'Regur soil in Deccan trap is ideal for cotton.', 'Geography'),
      q('What is the imaginary line passing through 82°30’ E longitude in India called?', ['Standard Meridian of India (IST)', 'Tropic of Cancer', 'Equator', 'Prime Meridian'], 0, '82°30’ E passes near Mirzapur (UP) determining IST.', 'Geography')
    ],
    'Hindi': [
      q("'अमित द्वारा पत्र लिखा जाता है।' यह किस प्रकार का वाच्य है?", ['कर्मवाच्य', 'कर्तृवाच्य', 'भाववाच्य', 'मिश्रवाच्य'], 0, "कर्म की प्रधानता होने के कारण यह कर्मवाच्य है।", "वाच्य"),
      q("'चरण कमल बंदौ हरि राई' में कौन सा अलंकार है?", ['रूपक अलंकार', 'उपमा अलंकार', 'यमक अलंकार', 'उत्प्रेक्षा अलंकार'], 0, "चरण पर कमल का अभेद आरोप होने से रूपक अलंकार है।", "अलंकार"),
      q("'पीपर पात सरिस मन डोला' में कौन सा अलंकार है?", ['उपमा अलंकार', 'रूपक अलंकार', 'अनुप्रास अलंकार', 'अतिशयोक्ति अलंकार'], 0, "'सरिस' वाचक शब्द आने से उपमा अलंकार है।", "अलंकार"),
      q("वाक्य में संज्ञा, सर्वनाम या क्रिया का व्याकरणिक परिचय देना क्या कहलाता है?", ['पद परिचय', 'संधि', 'समास', 'वाक्य रूपांतरण'], 0, "वाक्य के पदों का व्याकरणिक विवरण पद परिचय कहलाता है।", "पद परिचय"),
      q("श्रृंगार रस का स्थायी भाव क्या होता है?", ['रति (प्रेम)', 'उत्साह', 'हास', 'क्रोध'], 0, "श्रृंगार रस का स्थायी भाव रति होता है।", "रस"),
      q("रौद्र रस का स्थायी भाव क्या होता है?", ['क्रोध', 'भय', 'शोक', 'विस्मय'], 0, "रौद्र रस का स्थायी भाव क्रोध होता है।", "रस")
    ],
    'English': [
      q("Choose the sentence with correct Subject-Verb Agreement:", ['Neither of the boys was present.', 'Neither of the boys were present.', 'Neither of boys are present.', 'Neither boys was present.'], 0, "'Neither' is singular and takes singular verb 'was'.", "Concord"),
      q("Change to Indirect Speech: He said, 'I am learning Python.'", ['He said that he was learning Python.', 'He said that I am learning Python.', 'He says he was learning.', 'He told he is learning.'], 0, "Present continuous shifts to past continuous in reported speech.", "Reported Speech"),
      q("What is the poetic device: 'Death lays his icy hands on kings.'", ['Personification', 'Simile', 'Metaphor', 'Oxymoron'], 0, "Giving human traits to Death is Personification.", "Poetic Devices"),
      q("What is the antonym of 'Ephemeral' (transient)?", ['Permanent / Eternal', 'Fleeting', 'Brief', 'Short'], 0, "Ephemeral means lasting short time; antonym is Permanent.", "Vocabulary"),
      q("What is a person who loves and collects books called?", ['Bibliophile', 'Philatelist', 'Numismatist', 'Ornithologist'], 0, "A lover of books is a Bibliophile.", "Vocabulary")
    ],
    'Computer Science': [
      q('Which Python data structure is IMMUTABLE (cannot be modified after creation)?', ['Tuple (e.g. (1, 2, 3))', 'List (e.g. [1, 2, 3])', 'Dictionary', 'Set'], 0, 'Tuples cannot be altered after declaration.', 'Python'),
      q('Which SQL clause is used to filter query results after GROUP BY aggregate grouping?', ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], 0, 'HAVING filters aggregate expressions.', 'SQL Database'),
      q('Which SQL command is a Data Definition Language (DDL) command?', ['CREATE / ALTER / DROP', 'SELECT', 'INSERT', 'UPDATE'], 0, 'CREATE defines database schema structures.', 'SQL Database'),
      q('What is the standard port number for secure web traffic (HTTPS)?', ['443', '80 (HTTP)', '21 (FTP)', '25 (SMTP)'], 0, 'HTTPS operates on TCP port 443.', 'Computer Networks'),
      q('What is the legal legislation regulating electronic commerce and cyber crimes in India?', ['Information Technology (IT) Act, 2000', 'Indian Penal Code 1860', 'Cyber Bill 2012', 'Digital Act 2015'], 0, 'The IT Act, 2000 governs cyber laws in India.', 'Cyber Ethics')
    ],
    'General Knowledge': [
      q('Which Indian space mission successfully made a soft landing near Moon’s South Pole?', ['Chandrayaan-3', 'Chandrayaan-1', 'Mangalyaan', 'Aditya-L1'], 0, 'Chandrayaan-3 landed on August 23, 2023 (National Space Day).', 'Space Science'),
      q('Where is the headquarters of the World Health Organization (WHO) located?', ['Geneva, Switzerland', 'New York, USA', 'Washington DC, USA', 'Rome, Italy'], 0, 'WHO headquarters is located in Geneva.', 'World Bodies'),
      q('Which Indian space observatory is dedicated to studying the Sun from L1 point?', ['Aditya-L1', 'Gaganyaan', 'Astrosat', 'XPoSat'], 0, 'Aditya-L1 was launched to Sun-Earth Lagrange point 1.', 'Space Science')
    ]
  }
};

function getTierForClass(cName) {
  if (!cName) return 'primary';
  const str = String(cName).toUpperCase();
  if (str.includes('NURSERY') || str.includes('LKG') || str.includes('UKG')) return 'pre_primary';
  if (str.includes('10') || str.includes('X-') || str === 'X' || str.includes('9') || str.includes('IX-') || str === 'IX') return 'senior';
  if (str.includes('6') || str.includes('VI') || str.includes('7') || str.includes('VII') || str.includes('8') || str.includes('VIII')) return 'middle';
  return 'primary';
}

/**
 * Deterministic PRNG seeded by (date + className + subject)
 */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getDailyQuiz(className = 'VI-A', subject = 'Social Science', dateStr = null) {
  if (!dateStr) {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    dateStr = new Date(now.getTime() + istOffset).toISOString().slice(0, 10);
  }

  const tier = getTierForClass(className);
  const tierBank = MASTER_CURRICULUM_BANK[tier] || MASTER_CURRICULUM_BANK.primary;
  
  // Strict subject matching: NEVER fallback to Science for SST/Hindi/Maths/CS/GK!
  let bank = tierBank[subject];
  if (!bank || bank.length === 0) {
    // Try matching in other tiers for that EXACT subject
    for (const otherTier of ['middle', 'senior', 'primary', 'pre_primary']) {
      if (MASTER_CURRICULUM_BANK[otherTier]?.[subject]?.length > 0) {
        bank = MASTER_CURRICULUM_BANK[otherTier][subject];
        break;
      }
    }
  }

  if (!bank || bank.length === 0) {
    bank = tierBank['Mathematics'] || [];
  }

  // Seeded deterministic shuffle
  const seedString = `${dateStr}__${className}__${subject.toLowerCase()}`;
  const hash = crypto.createHash('md5').update(seedString).digest('hex');
  const seedInt = parseInt(hash.slice(0, 8), 16);
  const prng = seededRandom(seedInt);

  // Clone bank
  const pool = [...bank];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const selected = [];
  const count = Math.min(20, pool.length);

  for (let idx = 0; idx < count; idx++) {
    const item = pool[idx];
    const rawOpts = [...item.options];
    const correctVal = rawOpts[item.correct_answer_index];

    // Shuffle options deterministically
    for (let i = rawOpts.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [rawOpts[i], rawOpts[j]] = [rawOpts[j], rawOpts[i]];
    }

    const newCorrectIdx = rawOpts.indexOf(correctVal);

    selected.push({
      id: `q-${idx + 1}`,
      question_index: idx + 1,
      question_text: item.question_text,
      options: rawOpts,
      correct_answer_index: newCorrectIdx >= 0 ? newCorrectIdx : 0,
      explanation: item.explanation,
      chapter: item.chapter
    });
  }

  // GUARANTEE EXACTLY 20 QUESTIONS:
  // If pool had fewer than 20 questions, top up the remaining from procedural infinite engine
  if (selected.length < 20) {
    const needed = 20 - selected.length;
    const procQuestions = generateProceduralQuestionsForSubject(subject, needed, seedInt + 999);
    for (const pq of procQuestions) {
      const currentIdx = selected.length;
      selected.push({
        id: `q-${currentIdx + 1}`,
        question_index: currentIdx + 1,
        question_text: pq.question_text,
        options: pq.options,
        correct_answer_index: pq.correct_answer_index,
        explanation: pq.explanation,
        chapter: pq.chapter
      });
    }
  }

  return {
    date: dateStr,
    class_name: className,
    subject: subject,
    total_questions: selected.length,
    questions: selected
  };
}

module.exports = {
  MASTER_CURRICULUM_BANK,
  getDailyQuiz,
  getTierForClass
};
