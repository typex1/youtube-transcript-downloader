import express from "express";
import { YoutubeTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const TRANSCRIPTS_DIR = path.join(__dirname, "transcripts");

if (!fs.existsSync(TRANSCRIPTS_DIR)) {
  fs.mkdirSync(TRANSCRIPTS_DIR);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function extractVideoId(url) {
  const patterns = [
    /(?:v=|\/v\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube Transkript Downloader</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e0e0e0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { background: #1a1a1a; padding: 2rem; border-radius: 12px; width: 100%; max-width: 520px; }
    h1 { font-size: 1.3rem; margin-bottom: 1.2rem; color: #ff4444; }
    label { display: block; margin-bottom: .4rem; font-size: .9rem; }
    input { width: 100%; padding: .6rem .8rem; border: 1px solid #333; border-radius: 6px; background: #262626; color: #e0e0e0; font-size: .95rem; }
    button { margin-top: 1rem; width: 100%; padding: .7rem; border: none; border-radius: 6px; background: #ff4444; color: #fff; font-size: 1rem; cursor: pointer; }
    button:hover { background: #cc3333; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    #status { margin-top: 1rem; padding: .8rem; border-radius: 6px; display: none; font-size: .9rem; white-space: pre-wrap; }
    .success { background: #1a3a1a; color: #6f6; display: block !important; }
    .error { background: #3a1a1a; color: #f66; display: block !important; }
  </style>
</head>
<body>
  <div class="container">
    <h1>YouTube Transkript Downloader</h1>
    <form id="form">
      <label for="url">YouTube Video URL</label>
      <input id="url" name="url" type="text" placeholder="https://www.youtube.com/watch?v=..." required>
      <button type="submit" id="btn">Transkript herunterladen</button>
    </form>
    <div id="status"></div>
  </div>
  <script>
    const form = document.getElementById("form");
    const btn = document.getElementById("btn");
    const status = document.getElementById("status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      btn.disabled = true;
      status.className = "";
      status.style.display = "none";
      try {
        const res = await fetch("/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: document.getElementById("url").value })
        });
        const data = await res.json();
        if (res.ok) {
          status.textContent = data.message;
          status.className = "success";
        } else {
          status.textContent = data.error;
          status.className = "error";
        }
      } catch (err) {
        status.textContent = "Netzwerkfehler: " + err.message;
        status.className = "error";
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`);
});

app.post("/transcript", async (req, res) => {
  const { url } = req.body;
  const videoId = extractVideoId(url || "");

  if (!videoId) {
    return res.status(400).json({ error: "Ungültige YouTube URL." });
  }

  const filePath = path.join(TRANSCRIPTS_DIR, `${videoId}.md`);

  if (fs.existsSync(filePath)) {
    return res.json({ message: `Transkript existiert bereits: transcripts/${videoId}.md` });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: "Kein Transkript für dieses Video gefunden." });
    }

    const lines = transcript.map((t) => t.text);
    const md = `# YouTube Transkript\n\n- Video-ID: ${videoId}\n- URL: https://www.youtube.com/watch?v=${videoId}\n- Heruntergeladen: ${new Date().toISOString()}\n\n---\n\n${lines.join("\n")}`;

    fs.writeFileSync(filePath, md, "utf-8");
    res.json({ message: `Transkript gespeichert: transcripts/${videoId}.md (${transcript.length} Segmente)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Abrufen des Transkripts: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
