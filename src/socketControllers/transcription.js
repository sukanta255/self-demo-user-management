import { StartMedicalStreamTranscriptionCommand } from "@aws-sdk/client-transcribe-streaming";

export const startTranscription = async (socket, audioStream, isTranscribing, transcribeClient) => {
  console.log("Starting transcription");
  isTranscribing = true;
  let buffer = Buffer.from("");

  audioStream = async function* () {
    while (isTranscribing) {
      const chunk = await new Promise((resolve) =>
        socket.once("audioData", resolve)
      );
      if (chunk === null) break;
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

      while (buffer.length >= 1024) {
        yield { AudioEvent: { AudioChunk: buffer.slice(0, 1024) } };
        buffer = buffer.slice(1024);
      }
    }
  };

  const command = new StartMedicalStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaSampleRateHertz: 44100,
    MediaEncoding: "pcm",
    AudioStream: audioStream(),
  });

  try {
    const response = await transcribeClient.send(command);

    for await (const event of response.TranscriptResultStream) {
      if (!isTranscribing) break;
      if (event.TranscriptEvent) {
        const results = event.TranscriptEvent.Transcript.Results;
        if (results.length > 0 && results[0].Alternatives.length > 0) {
          const transcript = results[0].Alternatives[0].Transcript;
          const isFinal = !results[0].IsPartial;

          socket.emit("transcription", { text: transcript, isFinal });
        }
      }
    }
  } catch (err) {
    console.error("Transcription error:", err);
    socket.emit("error", "Transcription error: " + err.message);
  }
};