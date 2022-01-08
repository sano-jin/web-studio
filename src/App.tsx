import React from "react";
import logo from "./logo.svg";
import "./App.css";
import Button from "@mui/material/Button";

const ctx = new AudioContext();

let sampleSource: AudioBufferSourceNode = ctx.createBufferSource();

// 再生中のときはtrue
let isPlaying = false;

// 音源を取得しAudioBuffer形式に変換して返す関数
const setupSample = async () => {
  const response = await fetch("./SynthesizedPianoNotes/Piano11.mp3");
  const arrayBuffer = await response.arrayBuffer();
  // Web Audio APIで使える形式に変換
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer;
};

// AudioBufferをctxに接続し再生する関数
const playSample = (ctx: BaseAudioContext, audioBuffer: AudioBuffer) => {
  sampleSource = ctx.createBufferSource();

  // 変換されたバッファーを音源として設定
  sampleSource.buffer = audioBuffer;

  // 出力につなげる
  sampleSource.connect(ctx.destination);
  sampleSource.start();
  isPlaying = true;
};

const play = async () => {
  // 再生中なら二重に再生されないようにする
  if (isPlaying) return;
  const sample = await setupSample();
  playSample(ctx, sample);
};

// oscillatorを破棄し再生を停止する
const stop = async () => {
  sampleSource?.stop();
  isPlaying = false;
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
      <Button id="stop" onClick={stop}>
        stop
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
