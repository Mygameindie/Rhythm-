
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const audioUpload = document.getElementById("audioUpload");
const startButton = document.getElementById("startButton");
const mobileButtons = document.querySelectorAll(".arrow-btn");

let audioCtx, buffer, notes = [], songStartTime, audio;
const lanes = ["left", "down", "up", "right"];
const laneX = { left: 40, down: 110, up: 180, right: 250 };
let noteSpeed = 2;
const noteSize = 30;
let score = 0, combo = 0, health = 100;

startButton.addEventListener("click", () => {
    if (!buffer && !audio) return alert("Upload a song or video first!");
    startCountdown(startGame);
});

audioUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const fileType = file.type;
        if (fileType.startsWith('audio/') || file.name.endsWith('.mp3')) {
            const reader = new FileReader();
            reader.onload = evt => initAudio(evt.target.result);
            reader.readAsArrayBuffer(file);
        } else if (fileType === 'video/mp4') {
            extractAudioFromVideo(file);
        } else {
            alert("Unsupported file format");
        }
    }
});

function initAudio(arrayBuffer) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.decodeAudioData(arrayBuffer, decodedData => {
        buffer = decodedData;
    }, error => {
        console.error("Error decoding audio:", error);
        alert("Error decoding audio.");
    });
}

async function generateNotes(buffer) {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const step = Math.floor(sampleRate * 0.05);
    const flux = [];

    for (let i = 1; i < channelData.length / step - 1; i++) {
        let sumPrev = 0, sumCurr = 0;
        for (let j = 0; j < step; j++) {
            sumPrev += (channelData[(i - 1) * step + j] || 0) ** 2;
            sumCurr += (channelData[i * step + j] || 0) ** 2;
        }
        flux.push(Math.max(sumCurr - sumPrev, 0));
    }

    const avg = flux.reduce((a, b) => a + b) / flux.length;
    let lastNoteTime = -Infinity;

    for (let i = 1; i < flux.length - 1; i++) {
        if (flux[i] > flux[i - 1] && flux[i] > flux[i + 1] && flux[i] > avg * 0.5) {
            const time = i * 0.09;
            if (time - lastNoteTime > 0.3) {
                notes.push({ time, lane: lanes[Math.floor(Math.random() * 4)], hit: false });
                lastNoteTime = time;
            }
        }
    }
}

let startGame = async function () {
    await generateNotes(buffer);
    audio = audioCtx.createBufferSource();
    audio.buffer = buffer;
    audio.connect(audioCtx.destination);
    songStartTime = audioCtx.currentTime;
    audio.start(); audio.onended = stopGame;
    animationId = requestAnimationFrame(gameLoop);
};

function extractAudioFromVideo(file) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.crossOrigin = "anonymous";
    video.load();

    const tempAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = tempAudioCtx.createMediaElementSource(video);
    source.connect(tempAudioCtx.destination);

    video.addEventListener('canplay', () => {
        audioCtx = tempAudioCtx;
        buffer = null;
        audio = video;
    });

    video.addEventListener('ended', stopGame);

    video.addEventListener('play', () => {
        songStartTime = audioCtx.currentTime;
        animationId = requestAnimationFrame(gameLoop);
    });

    startGame = async function () {
        audio = video;
        generateNotesFromPlayback(audio);
        video.play();
    };
}

function generateNotesFromPlayback(mediaElement) {
    notes = [];
    for (let i = 1; i <= 100; i++) {
        const time = i * 0.6;
        notes.push({ time, lane: lanes[Math.floor(Math.random() * 4)], hit: false });
    }
}

function drawNote(note, y) {
    ctx.fillStyle = "#0f0";
    ctx.fillRect(laneX[note.lane], y, noteSize, noteSize);
}

function drawReceptors() {
    ctx.strokeStyle = "#ccc";
    lanes.forEach(lane => ctx.strokeRect(laneX[lane] + 5, 115, noteSize - 10, noteSize - 10));
}


let animationId;
function gameLoop() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = audioCtx.currentTime - songStartTime;
    noteSpeed = parseFloat(document.getElementById("noteSpeedInput").value);
    document.getElementById("noteSpeedDisplay").innerText = noteSpeed + "x";

    drawReceptors();
    notes.forEach(note => {
        const y = (note.time - elapsed) * 900 * noteSpeed;
        if (!note.hit && note.time < elapsed - 0.3) handleMiss(note);
        if (!note.hit && y > -noteSize && y < canvas.height) drawNote(note, y);
    });

    animationId = requestAnimationFrame(gameLoop);
}

function handleHit(note) {
    note.hit = true; score += 100; combo++; health = Math.min(100, health + 2); updateHUD();
}

function handleMiss(note) {
    note.hit = true; combo = 0; health = Math.max(0, health - 10); score -= 100; updateHUD();
}

function updateHUD() {
    document.getElementById("score").innerText = `Score: ${score}`;
    document.getElementById("combo").innerText = `Combo: ${combo}`;
    document.getElementById("healthBar").style.width = `${health}%`;
}

function checkHit(inputLane) {
    const elapsed = audioCtx.currentTime - songStartTime;
    notes.some(note => {
        if (!note.hit && note.lane === inputLane && Math.abs(note.time - elapsed) < 0.5) {
            handleHit(note);
            return true;
        }
        return false;
    });
}

document.addEventListener("keydown", e => {
    if (["ArrowLeft","ArrowDown","ArrowUp","ArrowRight"].includes(e.key))
        checkHit(e.key.slice(5).toLowerCase());
});

mobileButtons.forEach(btn =>
    btn.addEventListener("touchstart", e => {
        e.preventDefault();
        checkHit(btn.dataset.dir);
    }, { passive: false })
);

function startCountdown(callback) {
    let count = 3;
    const countdownEl = document.getElementById("countdown");
    countdownEl.style.display = "block";
    countdownEl.innerText = count;
    const interval = setInterval(() => {
        count--;
        if (count) countdownEl.innerText = count;
        else { clearInterval(interval); countdownEl.style.display = "none"; callback(); }
    }, 1000);
}


function stopGame() {
    if (animationId) cancelAnimationFrame(animationId);
    console.log("Game stopped after song ended.");
}
