let exam = {
    id: null,
    theme: '',
    questions: [],
    startedAt: null,
    timeLimit: 0,
    timeUsed: 0
};

let timerInterval = null;
let remainingTime = 0;
let timerRunning = false;
let isCorrected = false;
let currentPage = 0;
const QUESTIONS_PER_PAGE = 5;

// --- FUNÇÕES DE INICIALIZAÇÃO ---

function setStatus(message, loading = false) {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusBar')?.querySelector('.status-dot');
    
    if (statusText) statusText.textContent = message;
    if (statusDot) statusDot.className = 'status-dot' + (loading ? ' loading' : '');
}

// --- GERAÇÃO DO SIMULADO ---

const MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001",
    "gemini-flash-lite-latest"
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithFallback(prompt, apiKey) {
    let lastError = null;

    if (!apiKey) throw new Error("Informe a chave API");

    for (const model of MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7 }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
                }

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                return { data, model };
            } catch (err) {
                lastError = err;
                await sleep(1000 * attempt);
            }
        }
    }
    throw lastError;
}

async function generateExam() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const theme = document.getElementById("theme").value.trim();
    const instructions = document.getElementById("instructions").value.trim();
    const banca = document.getElementById("examBoard").value.trim();
    const qty = Number(document.getElementById("quantity").value);

    if (!theme || !apiKey) {
        alert("Por favor, preencha o tema e a chave API!");
        return;
    }

    setStatus("Gerando simulado...", true);
    isCorrected = false; // Resetar estado de correção

    const prompt = `Gere ${qty} questões de múltipla escolha sobre "${theme}" no estilo da banca "${banca}". Saída em JSON puro: { "questions": [{ "id": 1, "subject": "${theme}", "text": "...", "options": [{"letter": "A", "text": "..."}], "correctAnswer": "A", "explanation": "..." }] }. ${instructions}`;

    try {
        const result = await callGeminiWithFallback(prompt, apiKey);
        const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        exam.questions = parsed.questions.map(q => ({ ...q, userAnswer: null }));
        currentPage = 0;
        
        startExamUI();
        renderPaginatedExam();
        setStatus(`Simulado gerado com ${result.model}`);
    } catch (e) {
        console.error(e);
        setStatus("Erro ao gerar simulado.");
    }
}

// --- UI E RENDERIZAÇÃO ---

function renderPaginatedExam() {
    const container = document.getElementById('questionsContainer');
    const start = currentPage * QUESTIONS_PER_PAGE;
    const end = start + QUESTIONS_PER_PAGE;
    const pageQuestions = exam.questions.slice(start, end);

    container.innerHTML = '';

    pageQuestions.forEach((q, pageIndex) => {
        const globalIndex = start + pageIndex;
        const qCard = document.createElement('div');
        qCard.className = 'question-card';
        
        // Se já foi corrigido, aplica classes visuais de erro/acerto no card
        if (isCorrected) {
            const isRight = q.userAnswer === q.correctAnswer;
            qCard.classList.add(isRight ? 'correct' : 'wrong');
        }

        qCard.innerHTML = `
            <span class="question-number">Questão ${q.id}</span>
            <div class="question-subject">${q.subject}</div>
            <div class="question-text">${q.text}</div>
            <div class="options-list">
                ${q.options.map((opt, i) => {
                    let stateClass = '';
                    if (isCorrected) {
                        if (opt.letter === q.correctAnswer) stateClass = 'correct-answer';
                        else if (q.userAnswer === opt.letter) stateClass = 'wrong-answer';
                    } else if (q.userAnswer === opt.letter) {
                        stateClass = 'selected';
                    }

                    return `
                        <div class="option-item ${stateClass}" onclick="selectOption(${globalIndex}, '${opt.letter}')">
                            <div class="option-letter">${opt.letter}</div>
                            <div class="option-text">${opt.text}</div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="explanation" style="display: ${isCorrected ? 'block' : 'none'};">
                <div class="explanation-title">Explicação:</div>
                <div class="explanation-text">${q.explanation}</div>
            </div>
        `;
        container.appendChild(qCard);
    });

    renderNav();
    renderPagination();
    updatePaginationInfo();
}

function selectOption(qIdx, selectedLetter) {
    if (isCorrected) return; // Bloqueia troca de resposta após finalizar
    exam.questions[qIdx].userAnswer = selectedLetter;
    renderPaginatedExam(); // Re-renderiza a página para mostrar a seleção
    updateStats();
}

function renderNav() {
    const nav = document.getElementById('navContainer');
    if (!nav) return;
    nav.innerHTML = '';
    const totalPages = Math.ceil(exam.questions.length / QUESTIONS_PER_PAGE);
    
    for (let page = 0; page < totalPages; page++) {
        const btn = document.createElement('button');
        btn.className = `nav-btn ${page === currentPage ? 'active' : ''}`;
        
        // Marca visualmente as páginas na navegação se já corrigido
        if (isCorrected) {
            const start = page * QUESTIONS_PER_PAGE;
            const pageQs = exam.questions.slice(start, start + QUESTIONS_PER_PAGE);
            const hasError = pageQs.some(q => q.userAnswer !== q.correctAnswer);
            btn.classList.add(hasError ? 'nav-wrong' : 'nav-correct');
        }

        btn.textContent = `${(page * QUESTIONS_PER_PAGE) + 1}`;
        btn.onclick = () => goToPage(page);
        nav.appendChild(btn);
    }
    document.getElementById('questionsNav').style.display = 'block';
}

// --- CONTROLES DE PAGINAÇÃO ---

function goToPage(page) {
    const totalPages = Math.ceil(exam.questions.length / QUESTIONS_PER_PAGE);
    currentPage = Math.max(0, Math.min(page, totalPages - 1));
    renderPaginatedExam();
}

function nextPage() { goToPage(currentPage + 1); }
function prevPage() { goToPage(currentPage - 1); }

function renderPagination() {
    const container = document.getElementById('paginationContainer');
    if (!container) return;
    container.style.display = 'flex';
    const totalPages = Math.ceil(exam.questions.length / QUESTIONS_PER_PAGE);
    
    container.innerHTML = `
        <button class="pagination-btn" onclick="prevPage()" ${currentPage === 0 ? 'disabled' : ''}>Anterior</button>
        <span id="paginationInfo"></span>
        <button class="pagination-btn" onclick="nextPage()" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Próxima</button>
    `;
}

function updatePaginationInfo() {
    const info = document.getElementById('paginationInfo');
    if (!info) return;
    const total = exam.questions.length;
    info.textContent = `Página ${currentPage + 1} de ${Math.ceil(total / QUESTIONS_PER_PAGE)}`;
}

// --- FINALIZAÇÃO E CORREÇÃO ---

function correctExam() {
    if (isCorrected || exam.questions.length === 0) return;
    
    isCorrected = true;
    if (timerInterval) clearInterval(timerInterval);

    let correct = 0;
    let wrong = 0;

    // Cálculo baseado no ARRAY de dados
    exam.questions.forEach(q => {
        if (q.userAnswer === q.correctAnswer) correct++;
        else wrong++;
    });

    // Atualiza estatísticas na tela
    document.getElementById('correctCount').textContent = correct;
    document.getElementById('wrongCount').textContent = wrong;
    const percent = Math.round((correct / exam.questions.length) * 100) || 0;
    document.getElementById('accuracyPercent').textContent = `${percent}%`;

    // Atualiza a visualização para mostrar gabaritos e explicações
    renderPaginatedExam();
    showResults(correct, wrong, percent);
}

function showResults(c, w, p) {
    const modal = document.getElementById('resultsModal');
    if (!modal) return;
    document.getElementById('resultScore').textContent = `${p}%`;
    document.getElementById('resultCorrect').textContent = c;
    document.getElementById('resultWrong').textContent = w;
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('resultsModal').classList.remove('active');
}

// --- AUXILIARES ---

function startExamUI() {
    document.getElementById('statsCard').style.display = 'block';
    document.getElementById('actionsCard').style.display = 'block';
    updateStats();
}

function updateStats() {
    const answered = exam.questions.filter(q => q.userAnswer !== null).length;
    const total = exam.questions.length;
    
    const answeredEl = document.getElementById('answeredCount');
    const totalEl = document.getElementById('totalCount');
    const progressEl = document.getElementById('progressFill');

    if (answeredEl) answeredEl.textContent = `${answered} respondidas`;
    if (totalEl) totalEl.textContent = `Total: ${total}`;
    if (progressEl) progressEl.style.width = `${(answered / total) * 100}%`;
}

function clearExam() {
    isCorrected = false;
    currentPage = 0;
    exam.questions = [];
    document.getElementById('questionsContainer').innerHTML = '';
    document.getElementById('statsCard').style.display = 'none';
    document.getElementById('actionsCard').style.display = 'none';
    document.getElementById('questionsNav').style.display = 'none';
}