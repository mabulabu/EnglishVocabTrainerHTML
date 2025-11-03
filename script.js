document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
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
            roundHistory: [], // [{ word, definition, correct: true/false }]
            wordsToPractice: {}, // New: { word: definition }
        },
        assessment: {
            wordList: [],
            currentIndex: 0,
            responses: [],
            level: 50, // The algorithm's current difficulty guess
        }
    };

    // --- DOM ELEMENT SELECTORS ---
    const body = document.body;
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
    const revealBtn = document.getElementById('reveal-btn');
    const nextBtn = document.getElementById('next-btn');

    const assessmentWordEl = document.getElementById('assessment-word');
    const assessmentRatingBtns = document.querySelectorAll('.rating-button');
    const assessmentWordCountEl = document.getElementById('assessment-word-count');
    const assessmentProgressBar = document.getElementById('assessment-progress-bar');
    const skipAssessmentBtn = document.getElementById('skip-assessment-btn');
    const menuAssessmentBtn = document.getElementById('menu-assessment-btn');
    
    const resultsTitleEl = document.getElementById('results-title');
    const resultsSummaryEl = document.getElementById('results-summary');
    const resultsChartContainer = document.getElementById('results-chart-container');
    const resultsWordListEl = document.getElementById('results-word-list');
    const copyWrongWordsBtn = document.getElementById('copy-wrong-words-btn');
    const playAgainBtn = document.getElementById('play-again-btn');

    const themeButtons = document.querySelectorAll('.theme-button');
    const practiceSection = document.getElementById('practice-section');
    const practiceWordList = document.getElementById('practice-word-list');
    const startPracticeBtn = document.getElementById('start-practice-btn');

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const modalContent = document.getElementById('settings-modal-content');
    const modalHeader = document.getElementById('modal-header');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const roundLengthInput = document.getElementById('round-length-input');
    
    const sidePanel = document.getElementById('side-panel');

    // --- INITIALIZATION ---
    loadStateFromLocalStorage();
    loadData();
    initializeEventListeners();
    updateThemeUI();

    // --- LOCAL STORAGE ---
    function saveStateToLocalStorage() {
        try {
            const stateToSave = {
                theme: body.className,
                wordsToPractice: state.session.wordsToPractice
            };
            localStorage.setItem('vocabTrainerState', JSON.stringify(stateToSave));
        } catch (e) { console.error("Could not save state to localStorage", e); }
    }

    function loadStateFromLocalStorage() {
        try {
            const savedState = JSON.parse(localStorage.getItem('vocabTrainerState'));
            if (savedState) {
                body.className = savedState.theme || 'theme-default';
                state.session.wordsToPractice = savedState.wordsToPractice || {};
                updatePracticeWordsDisplay();
            }
        } catch (e) { console.error("Could not load state from localStorage", e); }
    }

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
        setTimeout(() => activeScreen.classList.add('active'), 10);
        state.currentScreen = screenId;
        
        sidePanel.classList.toggle('hidden', screenId !== 'training-screen');
    }

    function updateThemeUI() {
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', body.classList.contains(`theme-${btn.dataset.theme}`));
        });
    }
    
    function updatePracticeWordsDisplay() {
        const words = Object.keys(state.session.wordsToPractice);
        if (words.length > 0) {
            practiceWordList.innerHTML = '';
            words.forEach(word => {
                const wordEl = document.createElement('div');
                wordEl.className = 'practice-word';
                wordEl.innerHTML = `${word} <span class="def"> - ${state.session.wordsToPractice[word]}</span>`;
                wordEl.addEventListener('click', () => wordEl.classList.toggle('show-def'));
                practiceWordList.appendChild(wordEl);
            });
            practiceSection.classList.remove('hidden');
        } else {
            practiceSection.classList.add('hidden');
        }
    }

    // --- EVENT LISTENERS ---
    function initializeEventListeners() {
        navButtons.forEach(button => button.addEventListener('click', () => showScreen(button.dataset.target)));
        selectDifficultyCheck.addEventListener('change', () => difficultySliderContainer.classList.toggle('hidden', !selectDifficultyCheck.checked));
        manualDifficultySlider.addEventListener('input', () => manualDifficultyValue.textContent = manualDifficultySlider.value);
        pasteWordsToggleBtn.addEventListener('click', () => customWordsArea.classList.toggle('hidden'));
        startSessionBtn.addEventListener('click', setupAndStartSession);
        document.addEventListener('keydown', (e) => (state.currentScreen === 'training-screen' && e.code === 'Space') && (e.preventDefault(), handleTrainingSpacebar()));
        assessmentRatingBtns.forEach(btn => btn.addEventListener('click', () => handleAssessmentRating(parseInt(btn.dataset.rating))));
        playAgainBtn.addEventListener('click', () => showScreen('setup-words-screen'));
        copyWrongWordsBtn.addEventListener('click', copyWrongWords);
        settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        closeModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        saveSettingsBtn.addEventListener('click', saveSettings);
        
        // New Listeners
        revealBtn.addEventListener('click', revealDefinition);
        nextBtn.addEventListener('click', nextWord);
        trainingWordEl.addEventListener('click', revealDefinition);
        skipAssessmentBtn.addEventListener('click', finishAssessment);
        menuAssessmentBtn.addEventListener('click', () => showScreen('setup-words-screen'));
        themeButtons.forEach(button => {
            button.addEventListener('click', () => {
                body.className = `theme-${button.dataset.theme}`;
                updateThemeUI();
                saveStateToLocalStorage();
            });
        });
        startPracticeBtn.addEventListener('click', startPracticeSession);
        
        // Draggable Modal
        let isDragging = false, offset = { x: 0, y: 0 };
        modalHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = modalContent.getBoundingClientRect();
            offset.x = e.clientX - rect.left;
            offset.y = e.clientY - rect.top;
            modalContent.style.position = 'absolute';
            modalHeader.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                modalContent.style.left = `${e.clientX - offset.x}px`;
                modalContent.style.top = `${e.clientY - offset.y}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            modalHeader.style.cursor = 'grab';
        });
    }

    // --- SESSION SETUP & LOGIC ---
    function setupAndStartSession() {
        state.settings.useGeneral = useGeneralCheck.checked;
        state.settings.useAcademic = useAcademicCheck.checked;
        state.settings.useCustom = !customWordsArea.classList.contains('hidden') && customWordsArea.value.trim() !== '';
        state.settings.doAssessment = doAssessmentCheck.checked;
        state.settings.manualDifficulty = selectDifficultyCheck.checked;
        state.settings.difficulty = parseInt(manualDifficultySlider.value);
        state.settings.rememberSession = document.getElementById('remember-session').checked;
        state.settings.autoRemoveCount = parseInt(document.getElementById('auto-remove-select').value);

        let combinedList = [];
        if (state.settings.useGeneral) combinedList.push(...state.vocab.general);
        if (state.settings.useAcademic) {
            const academicOffset = state.settings.useGeneral ? 3000 : 0;
            const academicMapped = state.vocab.academic.map(w => ({...w, rank: w.rank + academicOffset}));
            combinedList.push(...academicMapped);
        }
        state.vocab.combined = combinedList.sort((a, b) => a.rank - b.rank);

        if (state.settings.useCustom) {
            const customWords = customWordsArea.value.trim().split('\n').map(w => w.trim().toLowerCase());
            state.session.wordList = state.vocab.combined.filter(wordObj => customWords.includes(wordObj.word));
        }

        if (state.settings.doAssessment) {
            startAssessment();
        } else {
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

        if (state.assessment.currentIndex % 10 === 0 && state.assessment.currentIndex > 0) {
            updateAssessmentDifficulty();
        }

        if (state.assessment.currentIndex >= 70) {
            finishAssessment();
        } else {
            renderAssessmentWord();
        }
    }
    
    function updateAssessmentDifficulty() {
        const last10 = state.assessment.responses.slice(-10);
        const avg = last10.reduce((a, b) => a + b, 0) / last10.length;
        if (avg > 3.2) state.assessment.level += 15;
        else if (avg > 2.5) state.assessment.level += 7;
        else if (avg < 1.8) state.assessment.level -= 15;
        else if (avg < 2.5) state.assessment.level -= 7;
        state.assessment.level = Math.max(0, Math.min(100, state.assessment.level));
    }

    function finishAssessment() {
        state.settings.difficulty = Math.round(state.assessment.level);
        const assessedWords = state.assessment.wordList.slice(0, state.assessment.currentIndex);
        startTraining(assessedWords);
    }

    // --- TRAINING LOGIC ---
    function startTraining(initialWords = []) {
        let trainingList = generateWordSublist(state.settings.difficulty, state.settings.roundLength - initialWords.length);
        state.session.wordList = [...initialWords, ...trainingList];
        state.session.wordList = state.session.wordList.filter(word => (state.session.correctCounts[word.word] || 0) < state.settings.autoRemoveCount);
        state.session.currentWordIndex = 0;
        state.session.roundHistory = [];
        showScreen('training-screen');
        renderTrainingWord(true);
    }
    
    function startPracticeSession() {
        const practiceWords = Object.keys(state.session.wordsToPractice);
        if (practiceWords.length === 0) return alert("No words in your practice list yet!");
        const practiceListObjects = state.vocab.combined.filter(wordObj => practiceWords.includes(wordObj.word));
        state.session.wordList = practiceListObjects;
        state.session.currentWordIndex = 0;
        state.session.roundHistory = [];
        showScreen('training-screen');
        renderTrainingWord(true);
    }

    function renderTrainingWord(isNewWord) {
        if (state.session.currentWordIndex >= state.session.wordList.length) {
            return showResults();
        }
        const word = state.session.wordList[state.session.currentWordIndex];
        if (isNewWord) {
            trainingWordEl.textContent = word.word;
            trainingDefEl.textContent = word.definition;
            trainingWordEl.className = 'fade-in';
            trainingDefEl.className = 'hidden';
        }
    }

    function handleTrainingSpacebar() {
        if (trainingDefEl.classList.contains('hidden')) revealDefinition();
        else nextWord();
    }

    function revealDefinition() {
        if (trainingDefEl.classList.contains('hidden')) {
            trainingDefEl.classList.remove('hidden');
            trainingDefEl.classList.add('fade-in');
        }
    }

    function nextWord() {
        const currentWord = state.session.wordList[state.session.currentWordIndex];
        // For now, let's assume a "correct" answer to test the flow
        state.session.roundHistory.push({ word: currentWord.word, definition: currentWord.definition, correct: true });
        state.session.currentWordIndex++;
        renderTrainingWord(true);
    }
    
    // --- RESULTS LOGIC ---
    function showResults() {
        const total = state.session.roundHistory.length;
        const correct = state.session.roundHistory.filter(r => r.correct).length;
        
        resultsTitleEl.textContent = `Round Complete!`;
        resultsSummaryEl.textContent = `You got ${correct} out of ${total} words correct.`;
        
        resultsChartContainer.innerHTML = '';
        state.session.roundHistory.forEach(item => {
            const bar = document.createElement('div');
            bar.className = `result-bar ${item.correct ? 'correct' : 'incorrect'}`;
            bar.title = item.word;
            resultsChartContainer.appendChild(bar);
        });

        resultsWordListEl.innerHTML = '';
        state.session.roundHistory.forEach(item => {
            const li = document.createElement('div');
            li.className = `result-word-item ${item.correct ? 'correct' : 'incorrect'}`;
            li.innerHTML = `<strong>${item.word}</strong>: ${item.definition}`;
            resultsWordListEl.appendChild(li);
        });
        
        state.session.roundHistory.forEach(item => {
            if (!item.correct) state.session.wordsToPractice[item.word] = item.definition;
        });
        
        saveStateToLocalStorage();
        updatePracticeWordsDisplay();
        showScreen('results-screen');
    }

    function copyWrongWords() {
        const wrongWords = state.session.roundHistory.filter(item => !item.correct).map(item => item.word).join('\n');
        if (wrongWords) navigator.clipboard.writeText(wrongWords).then(() => alert('List of incorrect words copied to clipboard!'));
        else alert('No incorrect words to copy!');
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
        const startIndex = Math.max(0, percentileIndex - Math.floor(count / 2));
        const endIndex = Math.min(totalWords, startIndex + count);
        let sublist = state.vocab.combined.slice(startIndex, endIndex);
        for (let i = sublist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sublist[i], sublist[j]] = [sublist[j], sublist[i]];
        }
        return sublist;
    }
});
