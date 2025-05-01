const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const audioUpload = document.getElementById("audioUpload");
const startButton = document.getElementById("startButton");
const mobileButtons = document.querySelectorAll(".arrow-btn");

let audioCtx, source, analyser, buffer, dataArray, notes = [], songStartTime, audio;

const lanes = ["left", "down", "up", "right"];
const laneX = { left: 40, down: 110, up: 180, right: 250 };
let noteSpeed = 2;
const noteSize = 30;
let score = 0, combo = 0, health = 100;

startButton.addEventListener("click", () => {
    if (!buffer) return alert("Upload a song first!");
    startGame();
});

audioUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            initAudio(evt.target.result);
        };
        reader.readAsArrayBuffer(file);
    }
});

function initAudio(arrayBuffer) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.decodeAudioData(arrayBuffer, (decodedData) => {
        buffer = decodedData;
        generateNotes(buffer);
    });
}

function generateNotes(buffer) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    for (let i = 0; i < channelData.length; i += sampleRate / 20) {
        const vol = Math.abs(channelData[i]);
        if (vol > 0.2) {
            const dir = lanes[Math.floor(Math.random() * lanes.length)];
            notes.push({ time: i / sampleRate, lane: dir, hit: false });
        }
    }
}

function startGame() {
    audio = audioCtx.createBufferSource();
    audio.buffer = buffer;
    audio.connect(audioCtx.destination);
    songStartTime = audioCtx.currentTime;
    audio.start();
    noteSpeed = parseFloat(document.getElementById("noteSpeedInput").value);
    document.getElementById("noteSpeedDisplay").innerText = noteSpeed + "x";
    requestAnimationFrame(gameLoop);
}

function drawNote(note, y) {
    ctx.fillStyle = "#0f0";
    ctx.fillRect(laneX[note.lane], y, noteSize, noteSize);
}

function drawReceptors() {
    ctx.fillStyle = "#fff";
    lanes.forEach(lane => {
        ctx.strokeStyle = "#ccc";
        ctx.strokeRect(laneX[lane] + 5, 115, noteSize - 10, noteSize - 10);
    });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = audioCtx.currentTime - songStartTime;

    drawReceptors(); // Draw static target arrows

    notes.forEach(note => {
        const y = (note.time - elapsed) * 900 * noteSpeed + 400;
        if (!note.hit && note.time < elapsed - 0.3) {
            handleMiss(note);
        }
        if (!note.hit && y > -noteSize && y < canvas.height) {
            drawNote(note, y);
        }
    });

    noteSpeed = parseFloat(document.getElementById("noteSpeedInput").value);
    document.getElementById("noteSpeedDisplay").innerText = noteSpeed + "x";
    requestAnimationFrame(gameLoop);
}

function handleHit(note) {
    note.hit = true;
    score += 100;
    combo++;
    health = Math.min(100, health + 2);
    updateHUD();
}

function handleMiss(note) {
    note.hit = true;
    combo = 0;
    health = Math.max(0, health - 10);
	score -= 100;
    updateHUD();
}

function updateHUD() {
    document.getElementById("score").innerText = "Score: " + score;
    document.getElementById("combo").innerText = "Combo: " + combo;
    document.getElementById("healthBar").style.width = health + "%";
}

function checkHit(inputLane) {
    const elapsed = audioCtx.currentTime - songStartTime;
    for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (!note.hit && note.lane === inputLane && Math.abs(note.time - elapsed) < 0.3) {
            handleHit(note);
            return;
        }
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") checkHit("left");
    if (e.key === "ArrowDown") checkHit("down");
    if (e.key === "ArrowUp") checkHit("up");
    if (e.key === "ArrowRight") checkHit("right");
});

mobileButtons.forEach(btn => {
    btn.addEventListener("touchstart", (e) => {
        e.preventDefault(); // Stop zoom/double-tap on mobile
        checkHit(btn.dataset.dir);
    }, { passive: false });
});