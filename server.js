const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let rooms = {};

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    socket.on("joinRoom", ({ room, username }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = { players: {}, votes: {}, songs: {}, difficulties: {}, voteCount: 0 };
        }
        rooms[room].players[socket.id] = { username, score: 0, health: 100 };
        io.to(room).emit("playerList", Object.values(rooms[room].players));

        if (Object.keys(rooms[room].players).length === 2) {
            io.to(room).emit("requestSongs");
        }
    });

    socket.on("uploadSong", ({ room, songData, filename }) => {
        if (rooms[room]) {
            rooms[room].songs[socket.id] = { filename, notes: songData };
            if (Object.keys(rooms[room].songs).length === 2) {
                const songList = Object.entries(rooms[room].songs).map(([id, song]) => ({
                    id, filename: song.filename
                }));
                io.to(room).emit("startSongVote", songList);
            }
        }
    });

    socket.on("voteSong", ({ room, songId }) => {
        rooms[room].votes[socket.id] = songId;
        if (Object.keys(rooms[room].votes).length === 2) {
            const voted = Object.values(rooms[room].votes);
            const winner = voted[0] === voted[1] ? voted[0] : voted[Math.floor(Math.random() * 2)];
            const selected = rooms[room].songs[winner];
            io.to(room).emit("songSelected", selected.notes);
        }
    });

    socket.on("voteDifficulty", ({ room, speed }) => {
        rooms[room].difficulties[socket.id] = speed;
        if (Object.keys(rooms[room].difficulties).length === 2) {
            const speeds = Object.values(rooms[room].difficulties).map(Number);
            const avgSpeed = speeds.reduce((a, b) => a + b) / speeds.length;
            io.to(room).emit("startGame", avgSpeed);
        }
    });

    socket.on("scoreUpdate", ({ room, score, health }) => {
        if (rooms[room] && rooms[room].players[socket.id]) {
            rooms[room].players[socket.id].score = score;
            rooms[room].players[socket.id].health = health;
            socket.to(room).emit("opponentUpdate", { score, health });
        }
    });

    socket.on("disconnect", () => {
        for (const room in rooms) {
            if (rooms[room].players[socket.id]) {
                delete rooms[room].players[socket.id];
                io.to(room).emit("playerLeft");
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server listening on port", PORT);
});
