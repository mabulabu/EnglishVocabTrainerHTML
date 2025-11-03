document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    // A central object to hold the application's state.
    const state = {
        currentScreen: 'welcome-screen',
        vocab: {
            general: [],
            academic: [],
            combined: [],
            custom: []
        },
        settings: {
            useGeneral: true,
            useAcademic: false,
            useCustom: false,
            doAssessment: false,
            manualDifficulty: false,
            difficulty: 50, // 0-100 percentile
            rememberSession: false,
            autoRemoveCount: 2,
            roundLength: 100,
        },
        session: {
            wordList: [],
            currentWordIndex: 0,
            correctCounts: {}, // { word: count }
            roundHistory: [], // [{ word, correct: true/false }]
        },
        assessment: {
            wordList: [],
            currentIndex: 0,
            responses: [],
            level: 50, // The algorithm's current difficulty guess
        }
    };

    // --- DOM ELEMENT SELECTORS ---
    const screens = document.querySelectorAll('main > section');
    const navButtons = document.querySelectorAll('.cta-button[data-target]');
    
    const useGeneralCheck = document.getElementById('use-general-vocab');
    const useAcademicCheck = document.getElementById('use-academic-vocab');
    const pasteWordsToggleBtn = document.getElementById('paste-words-toggle-btn');
    const customWordsArea = document.getElementById('custom-words-paste-area');

    const doAssessmentCheck = document.getElementById('do-assessment');
    const selectDifficultyCheck = document.getElementById('select-difficulty-manual');
    const difficultySliderContainer = document.getElementById('difficulty-slider-container');
    const manualDifficultySlider = document.getElementById('manual-difficulty-slider');
    const manualDifficultyValue = document.getElementById('manual-difficulty-value');
    
    const startSessionBtn = document.getElementById('start-session-btn');
    
    const trainingWordEl = document.getElementById('training-word');
    const trainingDefEl = document.getElementById('training-definition');

    const assessmentWordEl = document.getElementById('assessment-word');
    const assessmentRatingBtns = document.querySelectorAll('.rating-button');
    const assessmentWordCountEl = document.getElementById('assessment-word-count');
    const assessmentProgressBar = document.getElementById('assessment-progress-bar');
    
    const resultsTitleEl = document.getElementById('results-title');
    const resultsSummaryEl = document.getElementById('results-summary');
    const resultsChartContainer = document.getElementById('results-chart-container');
    const resultsWordListEl = document.getElementById('results-word-list');
    const copyWrongWordsBtn = document.getElementById('copy-wrong-words-btn');
    const playAgainBtn = document.getElementById('play-again-btn');

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const roundLengthInput = document.getElementById('round-length-input');
    
    const sidePanel = document.getElementById('side-panel');

    // --- INITIALIZATION ---
    loadData();
    initializeEventListeners();

    // --- DATA LOADING ---
    async function loadData() {
        try {
            const [generalRes, academicRes] = await Promise.all([
                fetch('data/vocab_data.json'),
                fetch('data/academic_vocab.json')
            ]);
            state.vocab.general = await generalRes.json();
            state.vocab.academic = await academicRes.json();
            console.log(`Loaded ${state.vocab.general.length} general and ${state.vocab.academic.length} academic words.`);
        } catch (error) {
            console.error("Failed to load vocabulary data:", error);
            document.body.innerHTML = "<h1>Error loading vocabulary data. Please refresh.</h1>";
        }
    }

    // --- UI & SCREEN MANAGEMENT ---
    function showScreen(screenId) {
        screens.forEach(screen => {
            screen.classList.remove('active');
            screen.classList.add('hidden');
        });
        const activeScreen = document.getElementById(screenId);
        activeScreen.classList.remove('hidden');
        // A slight delay to allow the CSS transition to work
        setTimeout(() => activeScreen.classList.add('active'), 10);
        state.currentScreen = screenId;
        
        // Show/hide side panel based on screen
        if (screenId === 'training-screen') {
            sidePanel.classList.remove('hidden');
        } else {
            sidePanel.classList.add('hidden');
        }
    }

    // --- EVENT LISTENERS ---
    function initializeEventListeners() {
        // Navigation buttons
        navButtons.forEach(button => {
            button.addEventListener('click', () => showScreen(button.dataset.target));
        });

        // Setup screen toggles
        selectDifficultyCheck.addEventListener('change', () => {
            difficultySliderContainer.classList.toggle('hidden', !selectDifficultyCheck.checked);
        });
        manualDifficultySlider.addEventListener('input', () => {
            manualDifficultyValue.textContent = manualDifficultySlider.value;
        });
        pasteWordsToggleBtn.addEventListener('click', () => {
            customWordsArea.classList.toggle('hidden');
        });

        // Start button
        startSessionBtn.addEventListener('click', setupAndStartSession);
        
        // Training screen (spacebar)
        document.addEventListener('keydown', (e) => {
            if (state.currentScreen === 'training-screen' && e.code === 'Space') {
                e.preventDefault();
                handleTrainingSpacebar();
            }
        });
        
        // Assessment buttons
        assessmentRatingBtns.forEach(btn => {
            btn.addEventListener('click', () => handleAssessmentRating(parseInt(btn.dataset.rating)));
        });

        // Results screen buttons
        playAgainBtn.addEventListener('click', () => showScreen('setup-words-screen'));
        copyWrongWordsBtn.addEventListener('click', copyWrongWords);

        // Settings modal
        settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        saveSettingsBtn.addEventListener('click', saveSettings);
    }

    // --- SESSION SETUP & LOGIC ---
    function setupAndStartSession() {
        // 1. Update settings from UI
        state.settings.useGeneral = useGeneralCheck.checked;
        state.settings.useAcademic = useAcademicCheck.checked;
        state.settings.useCustom = !customWordsArea.classList.contains('hidden') && customWordsArea.value.trim() !== '';
        state.settings.doAssessment = doAssessmentCheck.checked;
        state.settings.manualDifficulty = selectDifficultyCheck.checked;
        state.settings.difficulty = parseInt(manualDifficultySlider.value);
        state.settings.rememberSession = document.getElementById('remember-session').checked;
        state.settings.autoRemoveCount = parseInt(document.getElementById('auto-remove-select').value);

        // 2. Combine word lists based on selection
        let combinedList = [];
        if (state.settings.useGeneral) combinedList.push(...state.vocab.general);
        if (state.settings.useAcademic) {
            // Add a rank offset to academic words to place them after general words if both are selected
            const academicOffset = state.settings.useGeneral ? 3000 : 0;
            const academicMapped = state.vocab.academic.map(w => ({...w, rank: w.rank + academicOffset}));
            combinedList.push(...academicMapped);
        }
        state.vocab.combined = combinedList.sort((a, b) => a.rank - b.rank);

        // Handle custom list
        if (state.settings.useCustom) {
            const customWords = customWordsArea.value.trim().split('\n').map(w => w.trim().toLowerCase());
            // Find full word objects from our loaded data
            state.session.wordList = state.vocab.combined.filter(wordObj => customWords.includes(wordObj.word));
        }

        // 3. Decide which flow to start
        if (state.settings.doAssessment) {
            startAssessment();
        } else {
            state.session.difficulty = state.settings.difficulty;
            startTraining();
        }
    }

    // --- ASSESSMENT LOGIC ---
    function startAssessment() {
        state.assessment.level = state.settings.manualDifficulty ? state.settings.difficulty : 50;
        state.assessment.currentIndex = 0;
        state.assessment.responses = [];
        state.assessment.wordList = generateWordSublist(state.assessment.level, 70);
        
        showScreen('assessment-screen');
        renderAssessmentWord();
    }

    function renderAssessmentWord() {
        const word = state.assessment.wordList[state.assessment.currentIndex];
        assessmentWordEl.textContent = word.word;
        assessmentWordCountEl.textContent = state.assessment.currentIndex + 1;
        assessmentProgressBar.style.width = `${((state.assessment.currentIndex + 1) / 70) * 100}%`;
    }

    function handleAssessmentRating(rating) {
        state.assessment.responses.push(rating);
        state.assessment.currentIndex++;

        if ((state.assessment.currentIndex % 10 === 0) && state.assessment.currentIndex > 0) {
            updateAssessmentDifficulty();
        }

        if (state.assessment.currentIndex >= 70) {
            finishAssessment();
        } else {
            renderAssessmentWord();
        }
    }
    
    function updateAssessmentDifficulty() {
        const last10Responses = state.assessment.responses.slice(-10);
        const averageRating = last10Responses.reduce((a, b) => a + b, 0) / last10Responses.length;
        
        // Smart "algo": adjust level based on user confidence
        if (averageRating > 3.2) state.assessment.level += 15; // User is confident, jump difficulty
        else if (averageRating > 2.5) state.assessment.level += 7;
        else if (averageRating < 1.8) state.assessment.level -= 15;
        else if (averageRating < 2.5) state.assessment.level -= 7;
        
        // Clamp the level between 0 and 100
        state.assessment.level = Math.max(0, Math.min(100, state.assessment.level));
        
        // Add new words based on the updated level
        const newWords = generateWordSublist(state.assessment.level, 10);
        state.assessment.wordList.splice(state.assessment.currentIndex, 0, ...newWords);
    }

    function finishAssessment() {
        state.settings.difficulty = Math.round(state.assessment.level);
        // showResults() could be called here with assessment data
        startTraining(); // Transition to training at the determined level
    }

    // --- TRAINING LOGIC ---
    function startTraining() {
        // Filter word list based on difficulty
        state.session.wordList = generateWordSublist(state.settings.difficulty, state.settings.roundLength);
        
        // Remove words that have been correctly guessed enough times
        state.session.wordList = state.session.wordList.filter(word => 
            (state.session.correctCounts[word.word] || 0) < state.settings.autoRemoveCount
        );
        
        state.session.currentWordIndex = 0;
        state.session.roundHistory = [];
        
        showScreen('training-screen');
        renderTrainingWord(true); // isNewWord = true
    }
    
    function renderTrainingWord(isNewWord) {
        if (state.session.currentWordIndex >= state.session.wordList.length) {
            showResults();
            return;
        }

        const word = state.session.wordList[state.session.currentWordIndex];
        
        if (isNewWord) {
            trainingWordEl.textContent = word.word;
            trainingDefEl.textContent = word.definition;
            trainingWordEl.classList.remove('hidden');
            trainingDefEl.classList.add('hidden');
            trainingWordEl.classList.add('fade-in');
        } else { // Reveal definition
            trainingDefEl.classList.remove('hidden');
            trainingDefEl.classList.add('fade-in');
        }
        
        // Update progress bar (implementation needed)
    }

    function handleTrainingSpacebar() {
        if (trainingDefEl.classList.contains('hidden')) {
            // Definition is hidden, so reveal it
            renderTrainingWord(false);
        } else {
            // Definition is visible, move to next word
            state.session.currentWordIndex++;
            renderTrainingWord(true);
        }
    }
    
    // --- RESULTS LOGIC ---
    function showResults() {
        // This is a placeholder; real history needs to be built during training
        // For demonstration, we'll create some fake history
        state.session.roundHistory = state.session.wordList.map(word => ({
            word: word.word,
            definition: word.definition,
            correct: Math.random() > 0.3 // ~70% correct
        }));

        const total = state.session.roundHistory.length;
        const correct = state.session.roundHistory.filter(r => r.correct).length;
        
        resultsTitleEl.textContent = `Round Complete!`;
        resultsSummaryEl.textContent = `You got ${correct} out of ${total} words correct.`;
        
        // Render chart
        resultsChartContainer.innerHTML = '';
        state.session.roundHistory.forEach(item => {
            const bar = document.createElement('div');
            bar.className = `result-bar ${item.correct ? 'correct' : 'incorrect'}`;
            bar.title = item.word;
            resultsChartContainer.appendChild(bar);
        });

        // Render word list
        resultsWordListEl.innerHTML = '';
        state.session.roundHistory.forEach(item => {
            const li = document.createElement('div');
            li.className = `result-word-item ${item.correct ? 'correct' : 'incorrect'}`;
            li.innerHTML = `<strong>${item.word}</strong>: ${item.definition}`;
            resultsWordListEl.appendChild(li);
        });
        
        showScreen('results-screen');
    }

    function copyWrongWords() {
        const wrongWords = state.session.roundHistory
            .filter(item => !item.correct)
            .map(item => item.word)
            .join('\n');
            
        if (wrongWords) {
            navigator.clipboard.writeText(wrongWords).then(() => {
                alert('List of incorrect words copied to clipboard!');
            });
        } else {
            alert('No incorrect words to copy!');
        }
    }
    
    // --- SETTINGS LOGIC ---
    function saveSettings() {
        state.settings.roundLength = parseInt(roundLengthInput.value);
        settingsModal.classList.add('hidden');
        alert('Settings saved!');
    }

    // --- HELPER FUNCTIONS ---
    function generateWordSublist(difficultyPercent, count) {
        const totalWords = state.vocab.combined.length;
        if (totalWords === 0) return [];

        const percentileIndex = Math.floor((difficultyPercent / 100) * totalWords);
        
        // Get a slice of words around that percentile
        const startIndex = Math.max(0, percentileIndex - Math.floor(count / 2));
        const endIndex = Math.min(totalWords, startIndex + count);
        
        let sublist = state.vocab.combined.slice(startIndex, endIndex);

        // Shuffle the sublist to make it random
        for (let i = sublist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sublist[i], sublist[j]] = [sublist[j], sublist[i]];
        }
        
        return sublist;
    }
});
