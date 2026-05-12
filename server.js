import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

// Test Groq API connectivity

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function callGroq(prompt) {
  const response = await groq.chat.completions.create({
    messages: [
      { role: "user", content: prompt }
    ],
    model: "llama-3.1-8b-instant",
  });

  return response.choices[0].message.content;
}

app.get("/groq-test", async (req, res) => {
  try {
    const prompt = "Say hello. Test Groq API connectivity.";
    const text = await callGroq(prompt);
    res.json({ result: text });
  } catch (err) {
    console.error("Groq API test error:", err);
    res.status(500).json({ error: err.message || "Groq API test failed" });
  }
});

app.post("/generate-question", async (req, res) => {
  try {
    const { role, difficulty } = req.body;
    let diffText = "beginner";
    if (difficulty === "mid") diffText = "mid-level";
    if (difficulty === "job-ready") diffText = "job-ready (advanced)";

    const prompt = `You are an expert interviewer. Generate ONLY one realistic, professional interview question for a ${role} position at ${diffText} difficulty. Do NOT include any introductory text, explanations, or answers. Output ONLY the question itself.`;

    const text = await callGroq(prompt);
    // Try to extract only the question sentence
    let question = text;
    // Remove introductory phrases like "Here's ..." or "Question:"
    question = question.replace(/^.*?(\?|:)/, "");
    // Find the first sentence ending with a question mark
    const qMatch = text.match(/([^\n]*\?)/);
    if (qMatch && qMatch[1]) {
      question = qMatch[1].trim();
    }
    res.json({ question });
  } catch (err) {
    console.error("Groq API error:", err);
    res.status(500).json({ error: err.message || "AI failed" });
  }
});

app.post("/evaluate-answer", async (req, res) => {
  try {
    const { role, answer } = req.body;

    const prompt = `
Evaluate this interview answer for a ${role} position.

Answer:
${answer}

Give:
1. Communication score out of 10
2. Technical knowledge score out of 10
3. Confidence score out of 10
4. Improvement suggestions
`;

    const text = await callGroq(prompt);

    res.json({ feedback: text });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "AI failed" });
  }
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
