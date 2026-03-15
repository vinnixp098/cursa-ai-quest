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
    document.getElementById('statusText').textContent = message;
    document.getElementById('statusBar').querySelector('.status-dot').className =
        'status-dot' + (loading ? ' loading' : '');
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

    console.log("chave api: ", apiKey)
    if (!apiKey) {
        throw new Error("Informe a chave API");
    }

    for (const model of MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log("Tentando modelo:", model, "tentativa:", attempt);

                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [{ text: prompt }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.7
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
                }

                const data = await response.json();
                console.log("Resposta Gemini:", data);

                if (data.error) {
                    lastError = data.error;

                    if (data.error.code === 503) {
                        await sleep(1200 * attempt);
                        continue;
                    }

                    if (data.error.code === 429) {
                        await sleep(2000 * attempt);
                        continue;
                    }

                    throw new Error(`${data.error.code}: ${data.error.message}`);
                }

                return { data, model };
            } catch (err) {
                lastError = err;
                await sleep(1000 * attempt);
            }
        }
    }

    throw new Error(
        typeof lastError === "object" && lastError?.message
            ? lastError.message
            : "Não foi possível gerar com nenhum modelo."
    );
}

async function generateExam() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const theme = document.getElementById("theme").value.trim();
    const instructions = document.getElementById("instructions").value.trim();
    const banca = document.getElementById("examBoard").value.trim();
    const qty = Number(document.getElementById("quantity").value);

    if (!theme) {
        alert("Por favor, digite um tema!");
        return;
    }

    if (!apiKey) {
        alert("Por favor, informe a chave API!");
        return;
    }

    setStatus("Gerando simulado com fallback de modelos...", true);

    const prompt = `
Você é um elaborador especializado em questões de concursos públicos no estilo da banca "${banca}".

Gere ${qty} questões objetivas para o cargo/tema "${theme}".

Regras obrigatórias:
- Não use imagens.
- Não mencione imagens, gráficos, tabelas ou figuras.
- Cada questão deve ter 5 alternativas: A, B, C, D e E.
- Apenas uma alternativa correta.
- O nível deve ser compatível com concursos públicos.
- As alternativas devem ser plausíveis.
- Evite alternativas absurdas ou muito fáceis de eliminar.
- O enunciado deve ser claro e objetivo.
- A explicação deve indicar por que a alternativa correta está certa.
- ${instructions}

Saída obrigatória:
- Responda somente com JSON válido.
- Não use markdown.
- Não escreva nenhuma observação fora do JSON.
- Não inclua campos além dos definidos abaixo.

JSON esperado:
{
  "questions": [
    {
      "id": 1,
      "subject": "${theme}",
      "text": "texto da questão",
      "options": [
        { "letter": "A", "text": "alternativa A" },
        { "letter": "B", "text": "alternativa B" },
        { "letter": "C", "text": "alternativa C" },
        { "letter": "D", "text": "alternativa D" },
        { "letter": "E", "text": "alternativa E" }
      ],
      "correctAnswer": "A",
      "explanation": "explicação objetiva"
    }
  ]
}
`;

    try {
        const result = await callGeminiWithFallback(prompt, apiKey);
        if (!result?.data) {
            throw new Error("Resposta inválida da API");
        }
        const rawText = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        exam.questions = parsed.questions;
        currentPage = 0;
        renderPaginatedExam();
        startExamUI();
        setStatus(`Simulado gerado com ${result.model}`);
    } catch (e) {
        console.error("Falha final:", e);
        setStatus("Erro ao gerar simulado.");
        alert("Os modelos disponíveis estão com alta demanda agora. Tente novamente em instantes.");
    }
}

function generateMockQuestion(num, theme) {
    const options = ["A", "B", "C", "D", "E"];
    const correctIdx = Math.floor(Math.random() * 5);

    return {
        id: num,
        subject: theme,
        text: `Questão de exemplo sobre ${theme} #${num}: Qual das alternativas abaixo melhor descreve um conceito fundamental desta disciplina no contexto da banca ${document.getElementById('examBoard').value}?`,
        options: [
            "Alternativa contendo uma definição técnica precisa.",
            "Opção com uma pegadinha comum em provas de nível difícil.",
            "Conceito obsoleto que costuma confundir candidatos.",
            "Alternativa que mistura dois conceitos distintos.",
            "Nenhuma das alternativas anteriores está correta."
        ],
        correctAnswer: options[correctIdx],
        userAnswer: null,
        explanation: "Esta é uma explicação detalhada sobre por que a alternativa correta é a selecionada, focando nos critérios da banca examinadora."
    };
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
        qCard.id = `q-card-${globalIndex}`;

        qCard.innerHTML = `
            <span class="question-number">Questão ${q.id}</span>
            <div class="question-subject">${q.subject}</div>
            <div class="question-text">${q.text}</div>
            <div class="options-list">
                ${q.options.map((opt, i) => `
                  <div class="option-item" onclick="selectOption(${globalIndex}, '${opt.letter}')" id="q-${globalIndex}-opt-${i}">
                      <div class="option-letter">${opt.letter}</div>
                      <div class="option-text">${opt.text}</div>
                  </div>
              `).join('')}
            </div>
            <div class="explanation" id="exp-${globalIndex}" style="display: none;">
                <div class="explanation-title">Explicação do Professor:</div>
                <div class="explanation-text">${q.explanation}</div>
            </div>
        `;
        container.appendChild(qCard);
        
        // Restore selection state
        if (q.userAnswer) {
            const selectedIndex = q.options.findIndex(opt => opt.letter === q.userAnswer);
            if (selectedIndex !== -1) {
                const selectedEl = document.getElementById(`q-${globalIndex}-opt-${selectedIndex}`);
                if (selectedEl) selectedEl.classList.add('selected');
            }
        }
    });

    renderNav();
    renderPagination();
    updatePaginationInfo();
}

function renderNav() {
    const nav = document.getElementById('navContainer');
    nav.innerHTML = '';
    const totalPages = Math.ceil(exam.questions.length / QUESTIONS_PER_PAGE);
    for (let page = 0; page < totalPages; page++) {
        const btn = document.createElement('button');
        btn.className = `nav-btn ${page === currentPage ? 'active' : ''}`;
        btn.textContent = `${(page * QUESTIONS_PER_PAGE) + 1}-${Math.min((page + 1) * QUESTIONS_PER_PAGE, exam.questions.length)}`;
        btn.onclick = () => goToPage(page);
        btn.id = `nav-page-${page}`;
        nav.appendChild(btn);
    }
    document.getElementById('questionsNav').style.display = 'block';
}

function renderPagination() {
    const container = document.getElementById('paginationContainer');
    if (!container) return;

    const totalPages = Math.ceil(exam.questions.length / QUESTIONS_PER_PAGE);
    container.innerHTML = `
        <button class="pagination-btn" id="prevPage" onclick="prevPage()" ${currentPage === 0 ? 'disabled' : ''}>
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
        </button>
        <span class="pagination-info" id="paginationInfo"></span>
        <button class="pagination-btn" id="nextPage" onclick="nextPage()" ${currentPage === totalPages - 1 ? 'disabled' : ''}>
            Próxima
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
            </svg>
        </button>
    `;
}

function updatePaginationInfo() {
    const info = document.getElementById('paginationInfo');
    if (!info) return;
    const start = currentPage * QUESTIONS_PER_PAGE + 1;
    const end = Math.min((currentPage + 1) * QUESTIONS_PER_PAGE, exam.questions.length);
    const total = exam.questions.length;
    info.textContent = `Página ${currentPage + 1} de ${Math.ceil(total / QUESTIONS_PER_PAGE)} (${start}-${end} de ${total})`;
}

function goToPage(page) {
    currentPage = Math.max(0, Math.min(page, Math.ceil(exam.questions.length / QUESTIONS_PER_PAGE) - 1));
    renderPaginatedExam();
    updateStats();
}

function nextPage() {
    goToPage(currentPage + 1);
}

function prevPage() {
    goToPage(currentPage - 1);
}

function selectOption(qIdx, selectedLetter) {
    if (isCorrected) return;

    exam.questions[qIdx].userAnswer = selectedLetter;

    const options = document.querySelectorAll(`#q-card-${qIdx} .option-item`);
    options.forEach(opt => opt.classList.remove('selected'));

    const selectedIndex = exam.questions[qIdx].options.findIndex(
        opt => opt.letter === selectedLetter
    );

    if (selectedIndex !== -1) {
        document
            .getElementById(`q-${qIdx}-opt-${selectedIndex}`)
            .classList.add('selected');
    }

    document.getElementById(`nav-btn-${qIdx}`)?.classList.add('answered');
    updateStats();
}

// --- CONTROLES DO SIMULADO ---

function startExamUI() {
    document.getElementById('statsCard').style.display = 'block';
    document.getElementById('actionsCard').style.display = 'block';
    document.getElementById('btnExport').disabled = false;

    if (document.getElementById('useTimer').checked) {
        document.getElementById('timerContainer').style.display = 'block';
        remainingTime = exam.timeLimit;
        startTimer();
    }

    updateStats();
}

function updateStats() {
    const answered = exam.questions.filter(q => q.userAnswer != null).length;
    const total = exam.questions.length;

    console.log("questoes: ", exam.questions)
    console.log("answered: ", answered)
    console.log("total: ", total)

    document.getElementById('answeredCount').textContent = `${answered} respondidas`;
    document.getElementById('totalCount').textContent = `Total: ${total}`;
    document.getElementById('progressFill').style.width = `${(answered / total) * 100}%`;
    document.getElementById('questionCount').textContent = `${total} questões`;
}

// --- CRONÔMETRO ---

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerInterval = setInterval(() => {
        if (remainingTime <= 0) {
            clearInterval(timerInterval);
            finishExam();
            return;
        }
        remainingTime--;
        displayTime();
    }, 1000);
}

function displayTime() {
    const m = Math.floor(remainingTime / 60);
    const s = remainingTime % 60;
    const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const el = document.getElementById('timerDisplay');
    el.textContent = display;

    if (remainingTime < 300) el.className = 'timer-display danger';
    else if (remainingTime < 900) el.className = 'timer-display warning';
}

function toggleTimer() {
    if (timerRunning) {
        clearInterval(timerInterval);
        timerRunning = false;
    } else {
        startTimer();
    }
}

// --- FINALIZAÇÃO E CORREÇÃO ---

function correctExam() {
    if (isCorrected) return;
    isCorrected = true;
    clearInterval(timerInterval);

    let correct = 0;
    let wrong = 0;

    exam.questions.forEach((q, i) => {
        const card = document.getElementById(`q-card-${i}`);
        const navBtn = document.getElementById(`nav-btn-${i}`);

        const correctIndex = q.options.findIndex(opt => opt.letter === q.correctAnswer);
        const userIndex = q.options.findIndex(opt => opt.letter === q.userAnswer);

        if (q.userAnswer === q.correctAnswer) {
            correct++;
            card.classList.add('correct');
            navBtn?.classList.add('correct');
        } else {
            wrong++;
            card.classList.add('wrong');
            navBtn?.classList.add('wrong');

            if (userIndex !== -1) {
                document
                    .getElementById(`q-${i}-opt-${userIndex}`)
                    ?.classList.add('wrong-answer');
            }
        }

        if (correctIndex !== -1) {
            document
                .getElementById(`q-${i}-opt-${correctIndex}`)
                ?.classList.add('correct-answer');
        }

        document.getElementById(`exp-${i}`).style.display = 'block';
    });

    document.getElementById('correctCount').textContent = correct;
    document.getElementById('wrongCount').textContent = wrong;

    const percent = Math.round((correct / exam.questions.length) * 100) || 0;
    document.getElementById('accuracyPercent').textContent = `${percent}%`;

    showResults(correct, wrong, percent);
}

function showResults(c, w, p) {
    document.getElementById('resultScore').textContent = `${p}%`;
    document.getElementById('resultCorrect').textContent = c;
    document.getElementById('resultWrong').textContent = w;
    document.getElementById('resultsModal').classList.add('active');
}

function closeModal() {
    document.getElementById('resultsModal').classList.remove('active');
}

function clearExam() {
    currentPage = 0;
    exam.questions = [];
    document.getElementById('questionsContainer').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📝</div>
            <h3 class="empty-title">Nenhum simulado gerado</h3>
            <p class="empty-text">Configure as opções ao lado e clique em "Gerar Simulado" para começar a estudar.</p>
        </div>
    `;
    document.getElementById('questionsNav').style.display = 'none';
    document.getElementById('statsCard').style.display = 'none';
    document.getElementById('actionsCard').style.display = 'none';
    if (document.getElementById('paginationContainer')) {
        document.getElementById('paginationContainer').style.display = 'none';
    }
}

// --- EXPORTAR PDF (Básico) ---
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`Simulado: ${exam.theme}`, 10, 20);
    doc.setFontSize(12);

    let y = 30;
    exam.questions.forEach((q, i) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${i + 1}. ${q.text.substring(0, 80)}...`, 10, y);
        y += 10;
    });

    doc.save('simulado-questpro.pdf');
}