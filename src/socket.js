// src/socket.js
import { startTranscription } from "./socketControllers/transcription.js";

export const socketConnection = (io, transcribeClient) => {
  console.log("Initializing socket connection");
  
  io.on("connection", (socket) => {
    console.log("A user connected");

    let audioStream;
    let lastTranscript = "";
    let isTranscribing = false;

    // Start transcription on client event
    socket.on("startTranscription", () => {
      startTranscription(socket, audioStream, isTranscribing, transcribeClient);
    });

    // Receive audio chunks
    socket.on("audioData", (data) => {
      if (isTranscribing) {
        socket.emit("audioData", data);
      }
    });

    socket.on("stopTranscription", () => {
      isTranscribing = false;
      audioStream = null;
      lastTranscript = "";
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
      isTranscribing = false;
      audioStream = null;
    });
  });
};
