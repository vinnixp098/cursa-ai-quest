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

// --- FUNÇÕES DE INICIALIZAÇÃO ---

function setStatus(message, loading = false) {
    document.getElementById('statusText').textContent = message;
    document.getElementById('statusBar').querySelector('.status-dot').className =
        'status-dot' + (loading ? ' loading' : '');
}

// --- GERAÇÃO DO SIMULADO ---
// API logic moved to src/api/gemini.js (see TODO.md)


async function generateExam() {
    const theme = document.getElementById("theme").value.trim();
    const instructions = document.getElementById("instructions").value.trim();
    const banca = document.getElementById("examBoard").value.trim();
    const qty = Number(document.getElementById("quantity").value);

    if (!theme) {
        alert("Por favor, digite um tema!");
        return;
    }

    setStatus("Gerando simulado com fallback de modelos...", true);

    const prompt = `
Gere um simulado com ${qty} questões de múltipla escolha para a vaga de ${theme} da banca ${banca}. Além disso, ${instructions}
Responda APENAS com JSON válido, sem markdown.

Formato esperado:
{
  "questions": [
    {
      "id": 1,
      "subject": "${theme}",
      "text": "pergunta",
      "options": [
        {"letter":"A","text":"..."},
        {"letter":"B","text":"..."},
        {"letter":"C","text":"..."},
        {"letter":"D","text":"..."},
        {"letter":"E","text":"..."}
      ],
      "correctAnswer": "A",
      "explanation": "explicação"
    }
  ]
}
`;

    try {
        const { callGemini } = await import('./api/gemini.js');
        const result = await callGemini(prompt);
        const rawText = result.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        exam.questions = parsed.questions;
        renderExam();
        startExamUI();
        setStatus(`Simulado gerado (${result.model || 'proxy'})`);
    } catch (e) {
        console.error("Falha final:", e);
        setStatus("Erro ao gerar simulado.");
        alert("Os modelos estão com alta demanda. Tente novamente ou verifique a chave GEMINI_API_KEY no Vercel.");
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
        correctAnswer: correctIdx,
        userAnswer: null,
        explanation: "Esta é uma explicação detalhada sobre por que a alternativa correta é a selecionada, focando nos critérios da banca examinadora."
    };
}

// --- UI E RENDERIZAÇÃO ---

function renderExam() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';

    exam.questions.forEach((q, index) => {
        const qCard = document.createElement('div');
        qCard.className = 'question-card';
        qCard.id = `q-card-${index}`;

        qCard.innerHTML = `
            <span class="question-number">Questão ${q.id}</span>
            <div class="question-subject">${q.subject}</div>
            <div class="question-text">${q.text}</div>
            <div class="options-list">
                ${q.options.map((opt, i) => `
                  <div class="option-item" onclick="selectOption(${index}, '${opt.letter}')" id="q-${index}-opt-${i}">
                      <div class="option-letter">${opt.letter}</div>
                      <div class="option-text">${opt.text}</div>
                  </div>
              `).join('')}
            </div>
            <div class="explanation" id="exp-${index}" style="display: none;">
                <div class="explanation-title">Explicação do Professor:</div>
                <div class="explanation-text">${q.explanation}</div>
            </div>
        `;
        container.appendChild(qCard);
    });

    renderNav();
}

function renderNav() {
    const nav = document.getElementById('navContainer');
    nav.innerHTML = '';
    exam.questions.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.textContent = i + 1;
        btn.onclick = () => document.getElementById(`q-card-${i}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
        btn.id = `nav-btn-${i}`;
        nav.appendChild(btn);
    });
    document.getElementById('questionsNav').style.display = 'block';
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
    const answered = exam.questions.filter(q => q.userAnswer !== null || q.userAnswer !== undefined).length;
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
    location.reload(); // Forma mais simples de limpar tudo
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