import React from "react";
import logo from "./logo.svg";
import "./App.css";
import Button from "@mui/material/Button";

// window.AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();

const audioElement: HTMLAudioElement = new Audio(
  "./SynthesizedPianoNotes/Piano11.mp3"
);

// Web Audio API内で使える形に変換
const track = ctx.createMediaElementSource(audioElement);

const play = () => {
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  // 出力につなげる
  track.connect(ctx.destination);
  audioElement.play();
};

// audioElementを一時停止する
const pause = () => {
  audioElement.pause();
};

const App = () => (
  <div className="App">
    <header className="App-header">
      <img src={logo} className="App-logo" alt="logo" />
      <p>
        Edit <code>src/App.tsx</code> and save to reload.
      </p>
      <Button id="play" onClick={play}>
        play
      </Button>
      <Button id="pause" onClick={pause}>
        pause
      </Button>
      {
        // <audio src="./SynthesizedPianoNotes/Piano11.mp3"></audio>
      }
      <a
        className="App-link"
        href="https://reactjs.org"
        target="_blank"
        rel="noopener noreferrer"
      >
        Learn React
      </a>
    </header>
  </div>
);

export default App;
