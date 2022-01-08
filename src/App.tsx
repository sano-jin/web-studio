import React, { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import Button from "@mui/material/Button";

const ctx = new AudioContext();

let sampleSource: AudioBufferSourceNode | null = null;
let audioBuffer: AudioBuffer | null;

// 再生中のときは true
let isPlaying = false;

// 音源を取得し AudioBuffer 形式に変換して返す関数
const setupSample = async (index: number) => {
  const response = await fetch(`./SynthesizedPianoNotes/Piano${index}.mp3`);
  const arrayBuffer = await response.arrayBuffer();
  // Web Audio API で使える形式に変換
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer;
};

// AudioBuffer を ctx に接続し再生する関数
const playSample = (ctx: BaseAudioContext, audioBuffer: AudioBuffer) => {
  sampleSource = ctx.createBufferSource();

  // 変換されたバッファを音源として設定
  sampleSource.buffer = audioBuffer;

  // 出力につなげる
  sampleSource.connect(ctx.destination);
  sampleSource.start();
  isPlaying = true;
};

const play = async () => {
  // 再生中なら二重に再生されないようにする
  if (isPlaying) return;

  // audioBuffer が null（まだ準備途中）なら，return．
  if (audioBuffer === null) return;
  playSample(ctx, audioBuffer);
};

// oscillator を破棄し再生を停止する
const stop = async () => {
  sampleSource?.stop();
  isPlaying = false;
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);

  // Similar to componentDidMount and componentDidUpdate:
  useEffect(() => {
    const setup = async () => {
      audioBuffer = await setupSample(13);
      setIsLoading(false);
    };
    setup();
  });

  return isLoading ? (
    <div>
      <p>is loading</p>
    </div>
  ) : (
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
      </header>
    </div>
  );
};

export default App;
