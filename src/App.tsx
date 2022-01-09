import React, { useState, useEffect } from "react";
import "./App.css";
// import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";

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
const trackLength = 32;

let globalTracks: boolean[][] = Array(6).fill(Array(trackLength).fill(false));

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

const play2 = async (soundState: SoundState, time: number) => {
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

// 長さ length, で全ての値が initialValue な array を作る．
// ただし，値は JSON.parse/stringfy を用いて deep copy する．
const makeArray = <T extends {}>(length: number, initialValue: T): T[] =>
  JSON.parse(JSON.stringify(Array(length).fill(initialValue)));

const soundStates: SoundState[] = makeArray(15, {
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
        play2(soundStates[index], time);
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
  index: number;
  isSelected: boolean;
  setIsSelected: (isSelected: boolean) => void;
}

const TrackCell = (trackCellProp: TrackCellProp) => {
  return (
    <ToggleButton
      value="check"
      selected={trackCellProp.isSelected}
      onChange={() => {
        trackCellProp.setIsSelected(!trackCellProp.isSelected);
      }}
    >
      {trackCellProp.index}
    </ToggleButton>
  );
};

interface TrackCellsProps {
  index: number;
  track: boolean[];
  setTrack: (track: boolean[]) => void;
}

const TrackCells = (trackCellsProps: TrackCellsProps) => {
  return (
    <Stack direction="row" spacing={2}>
      <div>{noteNames[trackCellsProps.index]}</div>
      {trackCellsProps.track.map((trackCell, index) => (
        <TrackCell
          key={index}
          index={index}
          isSelected={trackCell}
          setIsSelected={(isSelected: boolean) => {
            const track = [...trackCellsProps.track];
            track[index] = isSelected;
            trackCellsProps.setTrack([...track]);
          }}
        />
      ))}
    </Stack>
  );
};

const Tracks = () => {
  // Declare a new state variable, which we'll call "count"
  const [tracks, setTracks] = useState(
    Array(15).fill(Array(trackLength).fill(false))
  );

  return (
    <div
      style={{
        overflowX: "scroll",
        overflowY: "scroll",
        width: "90%",
        height: "100%",
      }}
    >
      <Stack direction="column" spacing={2}>
        {tracks
          .slice()
          .reverse()
          .map((track, index) => (
            <TrackCells
              key={index}
              index={tracks.length - index - 1}
              track={track}
              setTrack={(track: boolean[]) => {
                tracks[tracks.length - index - 1] = track;
                globalTracks = tracks;
                setTracks([...tracks]);
              }}
            />
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
