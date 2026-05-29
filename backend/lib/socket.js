// Singleton socket.io instance — call setIO(io) once in server.js, then getIO() anywhere
let ioInstance = null;

export function setIO(io) {
    ioInstance = io;
}

export function getIO() {
    return ioInstance;
}
