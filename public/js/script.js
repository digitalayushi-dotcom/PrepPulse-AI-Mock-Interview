
// ====== AI Mock Interview Script ======
// Voice recognition, timer, analytics, and UI logic

let recognition;
let isListening = false;
let speechStartTime;
let totalSpeechTime = 0;
let fillerCount = 0;
let answerStartTime = null;

// Initialize speech recognition if available
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-IN"; // Indian English Support
}

let interviewLocked = false;
let countdown;
let timeLeft = 300; // 5 minutes

// Generate a new interview question
async function generateQuestion(event) {
  const role = getSelectedRole();
  if (!role) {
    alert("Please select or enter a role first.");
    return;
  }
  const difficulty = document.getElementById("difficultySelect")?.value || "beginner";
  document.getElementById("loading").style.display = "block";
  event.target.disabled = true;
  document.getElementById("questionBox").style.display = "none";
  document.getElementById("questionBox").innerText = "";
  try {
    const response = await fetch("/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, difficulty })
    });
    let data = {};
    try {
      data = await response.json();
    } catch (jsonErr) {
      document.getElementById("loading").style.display = "none";
      event.target.disabled = false;
      alert("Backend error: Invalid or empty response.\n" + jsonErr.message);
      return;
    }
    document.getElementById("loading").style.display = "none";
    event.target.disabled = false;
    if (response.status !== 200) {
      alert("Backend error: " + (data.error || "Unknown error"));
      return;
    }
    document.getElementById("questionBox").style.display = "block";
    const box = document.getElementById("questionBox");
    box.innerText = data.question;
    box.classList.remove("fade-in");
    void box.offsetWidth;
    box.classList.add("fade-in");
    clearInterval(countdown);
    timeLeft = 300;
    timerStarted = false;
    answerStartTime = null;
    document.getElementById("timer").style.display = "none";
    document.getElementById("timer").style.color = "white";
    // reset interview mode
    interviewLocked = false;
    const answerEl = document.getElementById("answer");
    answerEl.disabled = false;
    // clear any previous answer when starting a new question
    answerEl.value = "";
    document.querySelectorAll(".evaluate")[1].disabled = false;
    // reset analytics/chart state for new question
    resetAnalytics();
    // reset voice tracking
    fillerCount = 0;
    totalSpeechTime = 0;
    // Hide score badge until answer is evaluated
    document.getElementById("analyticsScoreBadge").style.display = "none";
  } catch (err) {
    document.getElementById("loading").style.display = "none";
    event.target.disabled = false;
    alert("Failed to generate question. Please try again.\n" + err.message);
  }
}

// Evaluate the user's answer and show feedback
async function evaluateAnswer(event) {
  if (interviewLocked) return;
  clearInterval(countdown);
  // Show actual time taken by the candidate out of the 5 minutes
  const TOTAL_SECONDS = 300;
  let usedSeconds;
  if (answerStartTime) {
    usedSeconds = Math.round((Date.now() - answerStartTime) / 1000);
  } else {
    usedSeconds = TOTAL_SECONDS - timeLeft;
  }
  usedSeconds = Math.max(0, Math.min(TOTAL_SECONDS, usedSeconds));
  const usedMin = Math.floor(usedSeconds / 60);
  const usedSec = usedSeconds % 60;
  const timerEl = document.getElementById("timer");
  if (timerEl) {
    timerEl.style.display = "block";
    timerEl.style.color = "white";
    timerEl.innerHTML =
      'Time Taken: <span id="timeValue">' +
      usedMin.toString().padStart(2, "0") +
      ":" +
      usedSec.toString().padStart(2, "0") +
      "</span>";
  }
  const role = getSelectedRole();
  const answer = document.getElementById("answer").value;
  document.getElementById("feedbackLoading").style.display = "block";
  event.target.disabled = true;
  try {
    const response = await fetch("/evaluate-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, answer })
    });
    const data = await response.json();
    document.getElementById("feedbackLoading").style.display = "none";
    event.target.disabled = false;
    interviewLocked = true;
    document.getElementById("answer").disabled = true;
    if (isListening) {
      recognition.stop();
    }
    // Show written feedback in right panel
    document.getElementById("writtenFeedbackCard").style.display = "block";
    document.getElementById("writtenFeedbackText").innerText = data.feedback;

    // ===== Overall performance chart (Performance Analytics card) =====
    // 1) Prefer numbers that follow "score out of 10"
// ===== Overall performance chart (Performance Analytics card) =====
    
    // 1) Robust Regex to capture various score formats (e.g., "8/10", "Score: 8.5/10", "Score out of 10: 7")
    const numericScores = [];
    const scoreRegex = /(\d+(?:\.\d+)?)\s*\/\s*10|score.*?:?\s*(\d+(?:\.\d+)?)/gi;
    let match;
    
    while ((match = scoreRegex.exec(data.feedback)) !== null) {
      // match[1] catches "8/10", match[2] catches "Score: 8"
      let parsedVal = parseFloat(match[1] || match[2]);
      // Ensure we don't grab random numbers higher than 10
      if (!Number.isNaN(parsedVal) && parsedVal <= 10) {
        numericScores.push(parsedVal);
      }
    }

    // Compute overall score
    const overallScore = numericScores.length > 0
        ? numericScores.reduce((sum, s) => sum + s, 0) / numericScores.length
        : 0;
    
    const percentage = (overallScore / 10) * 100;

    // FIX: Set to 'flex' instead of 'block' to keep the chart centered and visible
    document.getElementById("analyticsScore").style.display = "flex";
    renderChart(overallScore);

    const rounded = Math.round(overallScore * 10) / 10;
    const badge = document.getElementById("analyticsScoreBadge");
    badge.innerText = "Overall Score: " + rounded + " / 10";
    badge.style.display = "block";

    if (document.getElementById("graphBar")) {
      document.getElementById("graphBar").style.width = percentage + "%";
    }
    // Voice Confidence
    let voiceConfidence = 8;
    if (fillerCount > 5) voiceConfidence -= 2;
    if (totalSpeechTime < 20) voiceConfidence -= 2;
    if (totalSpeechTime > 60) voiceConfidence += 1;
    voiceConfidence = Math.max(1, Math.min(10, voiceConfidence));
    document.getElementById("writtenFeedbackText").innerText +=
      "\n\nVoice Confidence Score: " + voiceConfidence + " / 10";
  } catch (err) {
    document.getElementById("feedbackLoading").style.display = "none";
    event.target.disabled = false;
    alert("Failed to evaluate answer. Please try again.");
  }
}


// Helper to get role either from select or manual input
function getSelectedRole() {
  const select = document.getElementById("roleSelect");
  const manual = document.getElementById("roleManual");
  if (manual && manual.value.trim() !== "") {
    return manual.value.trim();
  }
  return select ? select.value : "";
}

// Show/hide manual role input
function toggleManualRole(value) {
  const manual = document.getElementById("roleManual");
  if (!manual) return;
  if (value === "other") {
    manual.style.display = "block";
    manual.focus();
  } else {
    manual.style.display = "none";
    manual.value = "";
  }
  // When changing job role, clear previous answer, feedback, and analytics state
  answerStartTime = null;
  const answerEl = document.getElementById("answer");
  if (answerEl) {
    answerEl.value = "";
    answerEl.disabled = false;
  }
  const feedbackEl = document.getElementById("writtenFeedbackText");
  if (feedbackEl) {
    feedbackEl.innerText = "Feedback will appear here after evaluation...";
  }
  resetAnalytics();
}

// Update timer display
function updateTimer() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  document.getElementById("timeValue").innerText =
    `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}


// Play beep sound when time is up
function playBeep() {
  const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  audio.play();
}

// Start the countdown timer
function startTimer() {
  document.getElementById("timer").style.display = "block";
  updateTimer();
  // remember when the candidate actually started answering
  answerStartTime = Date.now();
  countdown = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 30) {
      document.getElementById("timer").style.color = "#ff4d4d";
    }
    if (timeLeft <= 0) {
      clearInterval(countdown);
      playBeep();
      evaluateAnswer({ target: document.querySelector(".evaluate:last-of-type") });
    }
  }, 1000);
}

let timerStarted = false;

// Start timer on first input
document.getElementById("answer").addEventListener("input", () => {
  if (!timerStarted) {
    startTimer();
    timerStarted = true;
  }
});

const voiceBtn = document.getElementById("voiceBtn");
const answerBox = document.getElementById("answer");

// Voice input logic
if (recognition) {
  voiceBtn.addEventListener("click", () => {
    if (!isListening) {
      try {
        recognition.start();
      } catch (err) {
        // Already started
      }
      voiceBtn.classList.add("recording");
      document.querySelector(".mic-img").src = "images/mic-off.jpg";
      isListening = true;
      speechStartTime = Date.now();
    } else {
      recognition.stop();
    }
  });

  recognition.onresult = function (event) {
    let finalTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + " ";
      }
    }
    if (finalTranscript !== "") {
      answerBox.value += finalTranscript;
    }
    if (!timerStarted) {
      startTimer();
      timerStarted = true;
    }
    // filler detection
    const fillers = finalTranscript.match(/\b(um|uh|like|you know|basically)\b/gi);
    if (fillers) fillerCount += fillers.length;
    // Live border glow
    answerBox.style.boxShadow = "0 0 10px #00c9a7";
    setTimeout(() => {
      answerBox.style.boxShadow = "none";
    }, 200);
  };

  recognition.onend = function () {
    voiceBtn.classList.remove("recording");
    document.querySelector(".mic-img").src = "images/mic.jpg";
    isListening = false;
    totalSpeechTime += (Date.now() - speechStartTime) / 1000;
  };
} else {
  voiceBtn.style.display = "none";
}
// Render the circular score chart
function renderChart(score) {
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  // Manual size setting to avoid blur/zero size
  canvas.width = 200;
  canvas.height = 200;
  const percentage = score / 10;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 70;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 1. Background Track (Light Circle)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 15;
  ctx.stroke();
  // 2. Score Arc (Green Progress)
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -0.5 * Math.PI, (percentage * 2 * Math.PI) - 0.5 * Math.PI);
  ctx.strokeStyle = "#00c9a7";
  ctx.lineWidth = 15;
  ctx.lineCap = "round";
  ctx.stroke();
  // 3. Center Text (Percentage %)
  ctx.fillStyle = "white";
  ctx.font = "bold 32px Poppins";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Math.round(percentage * 100) + "%", cx, cy - 5);
  // 4. Label Text
  ctx.font = "14px Poppins";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("Overall Score", cx, cy + 25);
}

// Reset analytics visuals to a neutral 0% state
function resetAnalytics() {
  // draw a 0% chart but hide the badge so card looks "ready"
  renderChart(0);
  const badgeEl = document.getElementById("analyticsScoreBadge");
  if (badgeEl) {
    badgeEl.style.display = "none";
    badgeEl.innerText = "Overall Score: 0 / 10";
  }
  const graphBar = document.getElementById("graphBar");
  if (graphBar) {
    graphBar.style.width = "0%";
  }
}

// Initialize analytics chart on first page load / reload
if (document.getElementById("scoreChart")) {
  resetAnalytics();
}
// ===== PROFILE MENU =====
function toggleProfileMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById("profileDropdown");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}
function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}
document.addEventListener("click", function () {
  const menu = document.getElementById("profileDropdown");
  if (menu) {
    menu.style.display = "none";
  }
});