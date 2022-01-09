import React, { useState, useEffect } from "react";
import "./App.css";
// import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";

// 長さ length, で全ての値が initialValue な array を作る．
// ただし，値は JSON.parse/stringfy を用いて deep copy する．
const makeArray = <T extends {}>(length: number, initialValue: T): T[] =>
  JSON.parse(JSON.stringify(Array(length).fill(initialValue)));

// safari のサポートもするなら，webkitAudioContext も必要だが，面倒なのでやらない．
const ctx = new AudioContext();

// 音源を取得し AudioBuffer 形式に変換して返す関数
const setupSample = async (index: number) => {
  console.log("setting", index);
  const response = await fetch(`./SynthesizedPianoNotes/Piano${index}.mp3`);
  const arrayBuffer = await response.arrayBuffer();
  // Web Audio API で使える形式に変換
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer;
};

// React で管理しない，audio の状態．
interface SoundState {
  audioBuffer: AudioBuffer | null;
  sampleSource: AudioBufferSourceNode | null;
  isPlaying: boolean; // 再生中なら true
}

const bpm = 80.0; // tempo

const lookahead = 25.0; // How freaquently to call scheduling function (in milliseconds)
const scheduleAheadTime = 0.1; // How far ahead to schedule audio (in seconds)

let currentNote = 0;
let nextNoteTime = 0.0; // When the next note is due.

// メインのトラック
// 音を鳴らすタイミングは true
const trackLength = 128;

let globalTracks: boolean[][] = makeArray(15, Array(trackLength).fill(false));

const nextNote = () => {
  // console.log("currentNote: ", currentNote);
  const secondsPerBeat = 60.0 / bpm / 2;

  nextNoteTime += secondsPerBeat; // Add beat length to last beat time

  // Advance the beat number, wrap to zero
  currentNote++;
  // 最後まで到達したら最初に戻る
  // （この例では，4 回鳴らすのをループする）
  // if (currentNote === 4) {
  if (currentNote === trackLength) {
    currentNote = 0;
  }
};

// アニメーション（表示）用に，今どのタイミングかを記録しておくための型．
interface NoteInQueue {
  note: number;
  time: number;
}

// アニメーション（表示）用に，今どのタイミングかを記録しておく．
const notesInQueue: NoteInQueue[] = [];

const play = async (soundState: SoundState, time: number) => {
  // 再生中なら 2 重に再生されないようにする
  if (soundState.isPlaying) return;

  console.log("play2");

  const audioBuffer = soundState.audioBuffer;

  // audioBuffer が null（まだ準備途中）なら，return．
  if (audioBuffer === null) {
    console.log("audioBuffer === null");
    return;
  }

  // AudioBuffer を ctx に接続し再生する
  const sampleSource = ctx.createBufferSource();

  // 変換されたバッファを音源として設定
  sampleSource.buffer = audioBuffer;

  // 出力につなげる
  sampleSource.connect(ctx.destination);

  // time 後に鳴らすようにスケジュールする
  // console.log("time: ", time);
  sampleSource.start(time);

  // stop できるように，今再生している AudioBuffer を記録しておく．
  soundState.sampleSource = sampleSource;
  soundState.isPlaying = true;
};

// oscillator を破棄し再生を停止する
const stop = async (soundState: SoundState, time: number) => {
  const sampleSource = soundState.sampleSource;
  sampleSource?.stop(time + 0.1);
  soundState.isPlaying = false;
};

// ピアノロールで自動的に鳴らす用の音
const soundStates: SoundState[] = makeArray(15, {
  audioBuffer: null,
  sampleSource: null,
  isPlaying: false,
});

// ユーザがクリックしたときに鳴らすようの音
const testSoundStates: SoundState[] = makeArray(15, {
  audioBuffer: null,
  sampleSource: null,
  isPlaying: false,
});

const noteNames = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
  "C",
];

// 音源を setup する．
const setup = async () => {
  [
    11, 13, 15, 16, 18, 110, 112, 113, 115, 117, 118, 120, 122, 124, 125,
  ].forEach(async (note, index) => {
    console.log("index, note", index, note);
    soundStates[index].audioBuffer = await setupSample(note);
    testSoundStates[index].audioBuffer = await setupSample(note);
  });

  console.log(`done setup for tracks`);
};
setup();

const scheduleNote =
  (soundStates: SoundState[]) => (beatNumber: number, time: number) => {
    // push the note on the queue, even if we're not playing.
    notesInQueue.push({ note: beatNumber, time: time });

    // トラックをもとに，このタイミングで音を鳴らすか決める．
    globalTracks.forEach((track, index) => {
      if (track[beatNumber]) {
        // play in time
        console.log("index", index);
        play(soundStates[index], time);
      } else {
        // もし選択されていない（かつすでに鳴っている）なら止める．
        if (soundStates[index].isPlaying) {
          console.log("stop", index);
          stop(soundStates[index], time);
        }
      }
    });
  };

let timerID: number = 0;
const scheduler = () => {
  // while there are notes that will need to play before the next interval,
  // schedule them and advance the pointer
  while (nextNoteTime < ctx.currentTime + scheduleAheadTime) {
    // console.log("scheduleNote");
    scheduleNote(soundStates)(currentNote, nextNoteTime);
    nextNote();
  }
  timerID = window.setTimeout(scheduler, lookahead);
};

interface TrackCellProp {
  trackIndex: number;
  index: number;
}

// 一つ一つのノート
const TrackCell = (trackCellProp: TrackCellProp) => {
  // Declare a new state variable, which we'll call "count"
  const [isSelected, setIsSelected] = useState(false);

  return (
    <ToggleButton
      className={`cell (_, ${trackCellProp.index})`}
      value="check"
      selected={isSelected}
      onMouseDown={() => {
        // 2 重に再生されないようになっているので，まず止めてから再生する．
        // 要改良
        stop(testSoundStates[trackCellProp.trackIndex], 0);
        play(testSoundStates[trackCellProp.trackIndex], 0);
      }}
      onMouseUp={() => {
        stop(testSoundStates[trackCellProp.trackIndex], 0);
      }}
      onChange={() => {
        console.log(
          `set cell (${trackCellProp.trackIndex}, ${trackCellProp.index})`,
          !isSelected
        );
        setIsSelected(!isSelected);
        globalTracks[trackCellProp.trackIndex][trackCellProp.index] =
          !isSelected;
      }}
      style={{ width: "10px", height: "10px" }}
    >
      <code style={{ color: "#666" }}>
        {trackCellProp.index % 4 === 0 ? "." : " "}
      </code>
    </ToggleButton>
  );
};

interface TrackCellsProps {
  trackIndex: number;
}

// 一本のトラック
const TrackCells = (trackCellsProps: TrackCellsProps) => {
  const track = Array(trackLength).fill(false);

  return (
    <Stack direction="row" spacing={1}>
      <div>
        <code>{noteNames[trackCellsProps.trackIndex]}</code>
      </div>
      {track.map((_, index) => (
        <TrackCell
          key={index}
          trackIndex={trackCellsProps.trackIndex}
          index={index}
        />
      ))}
    </Stack>
  );
};

const Tracks = () => {
  const tracks = Array(15).fill(false);

  return (
    <div
      style={{
        overflowX: "scroll",
        overflowY: "scroll",
        width: "90%",
        height: "100%",
        fontSize: "calc(5px + 2vmin)",
        color: "#222",
      }}
    >
      <Stack direction="column" spacing={1}>
        {tracks.map((_, index) => (
          <TrackCells key={index} trackIndex={tracks.length - index - 1} />
        ))}
      </Stack>
    </div>
  );
};

let lastNoteDrawn = 3;

const draw = (setBeatTimer: (beatTimer: number) => void) => () => {
  let drawNote = lastNoteDrawn;
  let currentTime = ctx.currentTime;

  while (notesInQueue.length && notesInQueue[0].time < currentTime) {
    drawNote = notesInQueue[0].note;
    notesInQueue.splice(0, 1); // remove note from queue
  }

  // We only need to draw if the note has moved.
  if (lastNoteDrawn !== drawNote) {
    setBeatTimer(drawNote);

    // 現在再生している部分をハイライトする．
    const currentNoteElems = document.getElementsByClassName(
      `cell (_, ${drawNote})`
    ) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < currentNoteElems.length; i++) {
      currentNoteElems[i].style.boxShadow = "0 0 8px rgba(255, 255, 255, 0.2)";
    }

    // ハイライトを除去する．
    const lastNoteElems = document.getElementsByClassName(
      `cell (_, ${lastNoteDrawn})`
    ) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < lastNoteElems.length; i++) {
      lastNoteElems[i].style.boxShadow = "none";
    }

    lastNoteDrawn = drawNote;
  }
  // set up to draw again
  requestAnimationFrame(draw(setBeatTimer));
};

const PlayButton = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatTimer, setBeatTimer] = useState(0);

  const onchange = (isPlaying: boolean) => {
    if (isPlaying) {
      // start playing

      // check if context is in suspended state (autoplay policy)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      currentNote = 0;
      nextNoteTime = ctx.currentTime;
      scheduler(); // kick off scheduling
      requestAnimationFrame(draw(setBeatTimer)); // start the drawing loop.
    } else {
      window.clearTimeout(timerID);
    }
  };

  return (
    <div>
      <ToggleButton
        value="check"
        selected={isPlaying}
        onChange={() => {
          onchange(!isPlaying);
          setIsPlaying(!isPlaying);
        }}
      >
        {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
      </ToggleButton>

      <p>{beatTimer}</p>
    </div>
  );
};

const App = () => {
  useEffect(() => {});

  return (
    <div className="App">
      <header className="App-header">
        <PlayButton />
        <Tracks />
      </header>
    </div>
  );
};

export default App;
