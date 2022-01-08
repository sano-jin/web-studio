import React, { useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

const ctx = new AudioContext();

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
  const sampleSource = ctx.createBufferSource();

  // 変換されたバッファを音源として設定
  sampleSource.buffer = audioBuffer;

  // 出力につなげる
  sampleSource.connect(ctx.destination);
  sampleSource.start();
  return sampleSource;
};

// React で管理しない，audio の状態．
interface ImpureState {
  audioBuffer: AudioBuffer | null;
  sampleSource: AudioBufferSourceNode | null;
  isPlaying: boolean; // 再生中なら true
}

const play = (impureState: ImpureState) => async () => {
  // 再生中なら二重に再生されないようにする
  if (impureState.isPlaying) return;

  const audioBuffer = impureState.audioBuffer;

  // audioBuffer が null（まだ準備途中）なら，return．
  if (audioBuffer === null) return;
  impureState.sampleSource = playSample(ctx, audioBuffer);
  impureState.isPlaying = true;
};

// oscillator を破棄し再生を停止する
const stop = (impureState: ImpureState) => async () => {
  const sampleSource = impureState.sampleSource;
  sampleSource?.stop(ctx.currentTime + 0.1);
  impureState.isPlaying = false;
};

interface KeyButtonProps {
  index: number;
  name: string;
}

const KeyButton = (keyButtonProps: KeyButtonProps) => {
  const impureState: ImpureState = {
    audioBuffer: null,
    sampleSource: null,
    isPlaying: false,
  };

  // Similar to componentDidMount and componentDidUpdate:
  useEffect(() => {
    const setup = async () => {
      impureState.audioBuffer = await setupSample(keyButtonProps.index);
      console.log(`done setup for ${keyButtonProps.name}`);
    };
    setup();
  });

  return (
    <Stack direction="column" spacing={2}>
      <Button
        id="play"
        onMouseDown={play(impureState)}
        onMouseUp={stop(impureState)}
      >
        {keyButtonProps.name}
      </Button>
    </Stack>
  );
};

const App = () => {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <Stack direction="row" spacing={2}>
          <KeyButton index={11} name={"C"} />
          <KeyButton index={13} name={"D"} />
          <KeyButton index={15} name={"E"} />
          <KeyButton index={16} name={"F"} />
          <KeyButton index={18} name={"G"} />
          <KeyButton index={110} name={"A"} />
        </Stack>
      </header>
    </div>
  );
};

export default App;
