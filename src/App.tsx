import { useEffect, useRef, useState } from "react";
import "./App.css"; // Make sure you have some basic CSS

const TOTAL_QUESTIONS = 60;
const API_URL = "https://myquizautomation-backend.onrender.com";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [running, setRunning] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("Ready");
  const [countdown, setCountdown] = useState(0);

  // Start the webcam when the component mounts
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
              facingMode: "environment",
               width:  { ideal: 1920 },
               height: { ideal: 1080 },
               frameRate: { ideal: 30 }
           }
         });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setStatus("Camera access denied");
      }
    }
    setupCamera();
  }, []);

  // Main processing loop (same logic as your mobile app)
  useEffect(() => {
    if (!running) return;

    let isMounted = true;

    const runScanner = async () => {
      let currentQ = questionNumber;

      while (currentQ < TOTAL_QUESTIONS && isMounted) {
        currentQ += 1;
        setQuestionNumber(currentQ);
        setAnswer("");
        setStatus(`Preparing question ${currentQ}...`);

        await wait(1000);
        if (!isMounted) break;

        try {
          setStatus("Capturing...");
          const imageBlob = await capturePhoto();

          if (!imageBlob) {
            throw new Error("Failed to capture image");
          }

          setStatus("Sending to AI...");
          const result = await sendImageToBackend(imageBlob);

          setAnswer(result.answer);
          setStatus("Answer");

          for (let seconds = 5; seconds > 0; seconds--) {
            if (!isMounted) break;
            setCountdown(seconds);
            await wait(1000);
          }

          setCountdown(0);
          setAnswer("");
          await wait(300);
        } catch (error: any) {
          console.error(error);
          setStatus("Error");
          alert(error.message || "Failed to process question.");
          setRunning(false);
          break;
        }
      }

      if (isMounted) {
        setRunning(false);
        setStatus("Finished");
      }
    };

    runScanner();

    return () => {
      isMounted = false;
    };
  }, [running]);

  // Helper to capture a frame from the video
  const capturePhoto = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  };

  async function sendImageToBackend(imageBlob: Blob) {
    const formData = new FormData();
    formData.append("image", imageBlob, "question.jpg");

    const response = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || `Backend error: ${response.status}`);
    }

    return await response.json();
  }

  async function testConnection() {
    setStatus("Testing connection...");
    try {
      const response = await fetch(`${API_URL}/docs`, { method: "GET" });
      if (response.ok) {
        alert("Connected to backend successfully!");
      } else {
        alert(`Backend responded with status: ${response.status}`);
      }
    } catch (error) {
      alert("Could not reach the backend.");
    }
    setStatus("Ready");
  }

  function startScanner() {
    setQuestionNumber(0);
    setAnswer("");
    setCountdown(0);
    setStatus("Starting...");
    setRunning(true);
  }

  function stopScanner() {
    setRunning(false);
    setAnswer("");
    setCountdown(0);
    setStatus("Stopped");
  }

  return (
    <div className="app-container">
      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline className="camera-feed" />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div className="capture-box"></div>
      </div>

      <div className="bottom-panel">
        <h2>
          {questionNumber} / {TOTAL_QUESTIONS}
        </h2>
        <p className="status">{status}</p>

        {answer !== "" && (
          <div className="answer-box">
            <h1>{answer}</h1>
            {countdown > 0 && <p>Next question in {countdown}</p>}
          </div>
        )}

        {!running ? (
          <div className="button-row">
            <button className="btn-test" onClick={testConnection}>
              TEST API
            </button>
            <button className="btn-start" onClick={startScanner}>
              START
            </button>
          </div>
        ) : (
          <button className="btn-stop" onClick={stopScanner}>
            STOP
          </button>
        )}
      </div>
    </div>
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
