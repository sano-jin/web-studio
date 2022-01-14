import React, { useState, useEffect } from "react";
import "./App.css";
import Button from "@mui/material/Button";
// import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import PauseIcon from "@mui/icons-material/Pause";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
// import InfoIcon from "@mui/icons-material/Info";
import {
  makeArray,
  UploadButton,
  DownloadButton,
  TrackLengthField,
} from "./util";
import {
  noteNames,
  SoundState,
  soundStates,
  testSoundStates,
  setup,
} from "./soundSamples";
import { ProjectInfo } from "./Info";

// safari のサポートもするなら，webkitAudioContext も必要だが，面倒なのでやらない．
const audioContext = new AudioContext();

let globalBPM = 80.0; // tempo

const lookahead = 25.0; // How freaquently to call scheduling function (in milliseconds)
const scheduleAheadTime = 0.2; // How far ahead to schedule audio (in seconds)

let currentNote = 0;
let nextNoteTime = 0.0; // When the next note is due.

// メインのトラックの長さ（todo: user definable にする）
let trackLength = 256;

// メインのトラック
// 音を鳴らすタイミングは true
let globalTracks: boolean[][] = makeArray(
  noteNames.length,
  Array(trackLength).fill(false)
);

// 拍子を一つ進める．
const nextNote = () => {
  // console.log("currentNote: ", currentNote);
  const secondsPerBeat = 60.0 / globalBPM / 2;

  // Add beat length to last beat time
  nextNoteTime += secondsPerBeat;

  // Advance the beat number, wrap to zero
  currentNote++;

  // 最後まで到達したら最初に戻る
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

// time 秒後に音を鳴らす
const play = async (soundState: SoundState, time: number) => {
  // 再生中なら 2 重に再生されないようにする
  if (soundState.isPlaying) return;

  console.log("play");

  const audioBuffer = soundState.audioBuffer;

  // audioBuffer が null（まだ準備途中）なら，return．
  if (audioBuffer === null) {
    console.log("audioBuffer === null");
    return;
  }

  // AudioBuffer を audioContext に接続し再生する
  const sampleSource = audioContext.createBufferSource();

  // 変換されたバッファを音源として設定
  sampleSource.buffer = audioBuffer;

  // 出力につなげる
  sampleSource.connect(audioContext.destination);

  // time 後に鳴らすようにスケジュールする
  // console.log("time: ", time);
  sampleSource.start(time);

  // stop できるように，今再生している AudioBuffer を記録しておく．
  soundState.sampleSource = sampleSource;
  soundState.isPlaying = true;
};

// oscillator を破棄し再生を停止する
// time の値は，audioContext.currentTime + <現在遅刻からの経過秒数> のようにして指定する
const stop = async (soundState: SoundState, time: number) => {
  // console.log(`stop in ${time} seconds`);
  const sampleSource = soundState.sampleSource;
  sampleSource?.stop(time);
  soundState.isPlaying = false;
};

// 次に鳴らす音をスケジュールする．
const scheduleNote =
  (soundStates: SoundState[]) => (beatNumber: number, time: number) => {
    // push the note on the queue, even if we're not playing.
    notesInQueue.push({ note: beatNumber, time: time });

    // メイントラックをもとに，このタイミングで音を鳴らすか決める．
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

// scheduler の setTimeout を止めるのに用いる id
let timerID: number = 0;

// 音をスケジュールする．
// setTimeout はそこまで正確でないので，さらに scheduleNote を用いて正確なタイミングを図っている．
const scheduler = () => {
  // while there are notes that will need to play before the next interval,
  // schedule them and advance the pointer
  while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
    // console.log("scheduleNote");
    scheduleNote(soundStates)(currentNote, nextNoteTime);
    nextNote();
  }
  timerID = window.setTimeout(scheduler, lookahead);
};

interface TrackNoteHeaderProps {
  trackIndex: number;
  noteName: string;
}

const TrackNoteHeader = (trackNoteHeaderProps: TrackNoteHeaderProps) => (
  <div
    style={{
      width: "20px",
      height: "20px",
      overflow: "hidden",
    }}
  >
    <code>{noteNames[trackNoteHeaderProps.trackIndex]}</code>
  </div>
);

const noteN = 29;

const getCoordination = (ctx: CanvasRenderingContext2D, e: MouseEvent) => {
  /*
   * rectでcanvasの絶対座標位置を取得し、
   * クリック座標であるe.clientX,e.clientYからその分を引く
   * ※クリック座標はdocumentからの位置を返すため
   * ※rectはスクロール量によって値が変わるので、onClick()内でつど定義
   */
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const noteX = Math.floor(x / 20);
  const noteY = Math.floor(y / 20);

  return [noteX, noteY];
};

// initialize a cell
const initCell = (
  ctx: CanvasRenderingContext2D,
  noteX: number,
  noteY: number
) => {
  const trackIndex = noteN - 1 - noteY;
  const positionIndex = noteX;

  const isSelected = globalTracks[trackIndex][positionIndex];

  if (isSelected) {
    ctx.fillStyle = "#777";
    // ctx.fillRect(noteX * 20 + 1, noteY * 20 + 1, 20 - 2, 20 - 2);
    ctx.fillRect(noteX * 20, noteY * 20, 20, 20);
  } else {
    // ctx.clearRect(noteX * 20 + 1, noteY * 20 + 1, 20 - 2, 20 - 2);
    ctx.clearRect(noteX * 20, noteY * 20, 20, 20);
  }
};

let isDrawing = false;
let lastDrawnNote = [-1, -1];

const onClick =
  (ctx: CanvasRenderingContext2D, clearSelect: () => void) =>
  (e: MouseEvent) => {
    isDrawing = true;
    clearSelect();

    const [noteX, noteY] = getCoordination(ctx, e);
    lastDrawnNote = [noteX, noteY];

    const trackIndex = noteN - 1 - noteY;
    const positionIndex = noteX;

    // console.log("onclick canvas", trackIndex, positionIndex);

    const isSelected = globalTracks[trackIndex][positionIndex];

    globalTracks[trackIndex][positionIndex] = !isSelected;

    if (!isSelected) {
      ctx.fillStyle = "#777";
      // ctx.fillRect(noteX * 20 + 1, noteY * 20 + 1, 20 - 2, 20 - 2);
      ctx.fillRect(noteX * 20, noteY * 20, 20, 20);
    } else {
      // ctx.clearRect(noteX * 20 + 1, noteY * 20 + 1, 20 - 2, 20 - 2);
      ctx.clearRect(noteX * 20, noteY * 20, 20, 20);
    }

    // 2 重に再生されないようになっているので，まず止めてから再生する．
    // 要改良
    // ユーザがクリックしたタイミングで鳴らす
    stop(testSoundStates[trackIndex], 0);
    play(testSoundStates[trackIndex], 0);
  };

const onMouseUpCanvas =
  (ctx: CanvasRenderingContext2D, clearSelect: () => void) =>
  (e: MouseEvent) => {
    isDrawing = false;
    clearSelect();

    const [, noteY] = getCoordination(ctx, e);

    const trackIndex = noteN - 1 - noteY;

    stop(testSoundStates[trackIndex], audioContext.currentTime + 0.2);
  };

const onMouseMoveCanvas =
  (
    notesCtx: CanvasRenderingContext2D,
    selectedCtx: CanvasRenderingContext2D,
    clearSelect: () => void
  ) =>
  (e: MouseEvent) => {
    const [noteX, noteY] = getCoordination(notesCtx, e);

    const trackIndex = noteN - 1 - noteY;
    const positionIndex = noteX;

    const isSelected = globalTracks[trackIndex][positionIndex];

    if (noteX !== lastDrawnNote[0] || noteY !== lastDrawnNote[1]) {
      if (isDrawing) {
        if (!isSelected) {
          notesCtx.fillStyle = "#777";
          notesCtx.fillRect(noteX * 20, noteY * 20, 20, 20);
        } else {
          notesCtx.clearRect(noteX * 20, noteY * 20, 20, 20);
        }
        globalTracks[trackIndex][positionIndex] = !isSelected;
      } else {
        // is not drawing
        console.log("hoge");
        clearSelect();
        if (isSelected) {
          selectedCtx.fillStyle = "#abb";
          selectedCtx.fillRect(noteX * 20, noteY * 20, 20, 20);
        } else {
          selectedCtx.fillStyle = "#455";
          selectedCtx.fillRect(noteX * 20, noteY * 20, 20, 20);
        }
      }
      lastDrawnNote = [noteX, noteY];
    }
  };

const getCanvas = (
  id: string
): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const elem = document.getElementById(id) as HTMLCanvasElement | null;
  if (!elem) {
    throw new Error(`no such element with the id ${id}`);
  }
  var ctx = (elem as HTMLCanvasElement).getContext("2d");
  if (!ctx) {
    throw new Error("cannot get the context");
  }
  return [elem, ctx];
};

let barCtxGlobal: CanvasRenderingContext2D | null = null;
let barElemGlobal: HTMLCanvasElement | null = null;

let isFirst = true;

const initCanvas = () => {
  console.log("initialize canvas");
  const [, backCtx] = getCanvas("canvas-background");
  const [notesElem, notesCtx] = getCanvas("canvas-notes");
  const [barElem, barCtx] = getCanvas("canvas-bar");
  const [selectedElem, selectedCtx] = getCanvas("canvas-selected");

  barCtxGlobal = barCtx;
  barElemGlobal = barElem;

  // 透過させる
  notesCtx.clearRect(0, 0, notesElem.width, notesElem.height);
  barCtx.clearRect(0, 0, barElem.width, barElem.height);
  selectedCtx.clearRect(0, 0, selectedElem.width, selectedElem.height);

  const clearSelect = () => {
    lastDrawnNote = [-1, -1];
    selectedCtx.clearRect(0, 0, selectedElem.width, selectedElem.height);
  };

  if (isFirst) {
    // 2回以上 addEventListener するのはダメなようなので，
    // 初回のみ初期化するようにしている
    isFirst = false;
    selectedElem.addEventListener(
      "mousedown",
      onClick(notesCtx, clearSelect),
      false
    );
    selectedElem.addEventListener(
      "mouseup",
      onMouseUpCanvas(notesCtx, clearSelect),
      false
    );
    selectedElem.addEventListener(
      "mousemove",
      onMouseMoveCanvas(notesCtx, selectedCtx, clearSelect),
      false
    );
    selectedElem.addEventListener("mouseout", (e) => {
      clearSelect();
    });
  }

  // 枠線を描く
  backCtx.strokeStyle = "#444";
  backCtx.beginPath();
  for (let i = 0; i < noteN + 1; i++) {
    backCtx.moveTo(0, i * 20);
    backCtx.lineTo(trackLength * 20, i * 20);
  }
  for (let i = 0; i < trackLength + 1; i++) {
    backCtx.moveTo(i * 20, 0);
    backCtx.lineTo(i * 20, noteN * 20);
  }
  backCtx.stroke();

  // 小節ごとの目印
  backCtx.strokeStyle = "#555";
  backCtx.beginPath();
  for (let i = 0; i < trackLength / 4 + 1; i++) {
    backCtx.moveTo(i * 20 * 4, 0);
    backCtx.lineTo(i * 20 * 4, noteN * 20);
  }
  backCtx.stroke();

  return [notesCtx, barCtx];
};

interface TracksProps {
  initialTracks: boolean[][];
  noteNames: string[];
}

const Canvas = (props: { id: string }) => (
  <canvas
    id={props.id}
    width={`${trackLength * 20}`}
    height={`${noteN * 20}`}
    style={{ position: "absolute", left: "0" }}
  ></canvas>
);

const Tracks = (props: TracksProps) => {
  useEffect(() => {
    // if (!canvasCtx) {
    //   canvasCtx = initCanvas();
    // } else {
    const [canvasCtx, barCtx] = initCanvas();
    barCtxGlobal = barCtx;
    for (let i = 0; i < trackLength; i++) {
      for (let j = 0; j < noteN; j++) {
        initCell(canvasCtx, i, j);
      }
    }
  }, [props.initialTracks]);

  return (
    <div
      style={{
        height: "100%",
        fontSize: "calc(5px + 1vmin)",
        color: "#777",
        display: "block",
        width: "100%",
        maxHeight: "80vh",
        overflowY: "scroll",
        overflowX: "hidden",
      }}
    >
      <Grid container spacing={2}>
        <Grid item xs={1}>
          <Stack
            id="note-name-list"
            direction="column"
            spacing={0}
            style={{
              display: "inline-block",
              width: "30px",
            }}
          >
            {props.noteNames.map((noteName, index) => (
              <TrackNoteHeader
                key={index}
                noteName={noteName}
                trackIndex={props.noteNames.length - index - 1}
              />
            ))}
          </Stack>
        </Grid>
        <Grid item xs={11}>
          <div
            style={{
              overflowX: "scroll",
              overflowY: "hidden",
              width: "100%",
              height: "100%",
              fontSize: "calc(5px + 1vmin)",
              color: "#777",
              position: "relative",
            }}
          >
            <Canvas id="canvas-background" />
            <Canvas id="canvas-notes" />
            <Canvas id="canvas-bar" />
            <Canvas id="canvas-selected" />
          </div>
        </Grid>
      </Grid>
    </div>
  );
};

// アニメーションを行うための変数．
// todo: closure に含めるようにしたほうが良いかも．
let lastNoteDrawn = trackLength;

// ハイライトを除去する．
const eliminateHilights = () => {
  console.log("eliminate hilights", lastNoteDrawn);
  if (barCtxGlobal && barElemGlobal) {
    barCtxGlobal.clearRect(0, 0, barElemGlobal.width, barElemGlobal.height);
  }
};

// アニメーションを行う．
// 現在再生中の箇所をハイライトする（影をつける）
const draw = (setBeatTimer: (beatTimer: number) => void) => () => {
  let drawNote = lastNoteDrawn;
  let currentTime = audioContext.currentTime;

  while (notesInQueue.length && notesInQueue[0].time - 0.6 < currentTime) {
    drawNote = notesInQueue[0].note;
    notesInQueue.splice(0, 1); // remove note from queue
  }

  // We only need to draw if the note has moved.
  if (lastNoteDrawn !== drawNote) {
    setBeatTimer(drawNote);

    // 現在再生している部分をハイライトする．

    if (barCtxGlobal && barElemGlobal) {
      barCtxGlobal.clearRect(0, 0, barElemGlobal.width, barElemGlobal.height);
      for (let i = 0; i < noteN; i++) {
        if (globalTracks[globalTracks.length - i - 1][drawNote]) {
          // 今音を出しているノード
          barCtxGlobal.fillStyle = "#acd";
          barCtxGlobal.fillRect(drawNote * 20, i * 20, 20, 20);
        } else {
          barCtxGlobal.fillStyle = "#30333a";
          barCtxGlobal.fillRect(drawNote * 20 + 1, i * 20 + 1, 20 - 2, 20 - 2);
        }
      }
    }
    lastNoteDrawn = drawNote;
  }
  // set up to draw again
  requestAnimationFrame(draw(setBeatTimer));
};

// 再生・停止を行う
const onchange = (
  setBeatTimer: (beatTimer: number) => void,
  isPlaying: boolean
) => {
  if (isPlaying) {
    // start playing

    // check if context is in suspended state (autoplay policy)
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // currentNote = 0;
    nextNoteTime = audioContext.currentTime;
    scheduler(); // kick off scheduling
    requestAnimationFrame(draw(setBeatTimer)); // start the drawing loop.
  } else {
    window.clearTimeout(timerID);
  }
};

interface PlayButtonProps {
  setInitialTracks: (initialTracks: boolean[][]) => void;
}

// 再生ボタンなど，各種メニュー
const PlayButton = (props: PlayButtonProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatTimer, setBeatTimer] = useState(0);
  const [bpm, setBPM] = useState(100);
  const [initialTrackLength, setInitialTrackLength] = useState(trackLength);

  const handleChangeBPM = (event: Event, newBPM: number | number[]) => {
    globalBPM = newBPM as number;
    setBPM(newBPM as number);
  };

  const handleChangeBeatTimer = (
    event: Event,
    newBeatTimer: number | number[]
  ) => {
    currentNote = newBeatTimer as number;
    eliminateHilights();
    setBeatTimer(newBeatTimer as number);
  };

  return (
    <div>
      <Stack direction="row" spacing={2}>
        <Button
          aria-label="stop"
          onClick={() => {
            currentNote = 0;
            eliminateHilights();
            setBeatTimer(0);
            if (isPlaying) {
              window.clearTimeout(timerID);
              setIsPlaying(false);
            }
          }}
        >
          <StopIcon />
        </Button>
        <ToggleButton
          value="play-and-pause"
          selected={isPlaying}
          onChange={() => {
            onchange(setBeatTimer, !isPlaying);
            setIsPlaying(!isPlaying);
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </ToggleButton>
        <Box style={{ width: "200px" }}>
          <Box>Tempo</Box>
          <Slider
            aria-label="bpm"
            value={bpm}
            onChange={handleChangeBPM}
            min={1}
            max={300}
          />
          <Box>{bpm}</Box>
        </Box>
        <Box style={{ width: "200px" }}>
          <Box>Position</Box>
          <Slider
            aria-label="beatTimer"
            value={beatTimer}
            onChange={handleChangeBeatTimer}
            max={trackLength - 1}
            step={1}
          />
          <Box>{beatTimer}</Box>
        </Box>
        <UploadButton
          setFile={(file) => {
            console.log("setting file");
            file.text().then((text) => {
              const tracks = JSON.parse(text);
              globalTracks = tracks;
              console.log("setting initial tracks");
              trackLength = globalTracks[0].length;
              props.setInitialTracks(globalTracks);
              setInitialTrackLength(globalTracks[0].length);
            });
          }}
        />
        <DownloadButton
          content={JSON.stringify(
            globalTracks.map((tracks) => tracks.slice(0, trackLength))
          )}
          fileName="song.txt"
        />
        <TrackLengthField
          initialTrackLength={initialTrackLength}
          min={8}
          setTrackLength={(newTrackLength: number) => {
            trackLength = newTrackLength;
            if (globalTracks[0].length < newTrackLength) {
              console.log("mapping new track");
              globalTracks = globalTracks.map((globalTrack) => [
                ...globalTrack,
                ...makeArray(newTrackLength - globalTrack.length, false),
              ]);
              console.log("mapped new track. initializing tracks");
              const setupInitialTracks = async () => {
                await props.setInitialTracks(globalTracks);
                console.log("setup the initial tracks --- (1)");
              };
              setupInitialTracks();
            } else {
              // グローバルトラックの長さを縮めることはしない
              const newInitialTracks = globalTracks.map((track) =>
                track.slice(0, newTrackLength)
              );
              console.log("newTrackLength", newTrackLength);
              console.log(
                "newInitialTracks[0].length",
                newInitialTracks[0].length
              );
              const setupInitialTracks = async () => {
                await props.setInitialTracks(newInitialTracks);
                console.log("setup the initial tracks --- (2)");
              };
              setupInitialTracks();
            }
          }}
        />
      </Stack>
    </div>
  );
};

const App = () => {
  // 音源をセットアップしている間は isLoading = true
  const [isLoading, setIsLoading] = useState(true);
  const [initialTracks, setInitialTracks] = useState<boolean[][]>(
    makeArray(noteNames.length, Array(trackLength).fill(false))
  );

  // Similar to componentDidMount and componentDidUpdate:
  useEffect(() => {
    // 音源をセットアップする．
    const loadFiles = async () => {
      await setup(audioContext);
      setIsLoading(false);
    };
    loadFiles();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        {isLoading ? (
          // 音源をセットアップしている間は，プログレスメータを回しておく
          <CircularProgress color="secondary" />
        ) : (
          <Box sx={{ flexGrow: 1 }} style={{ width: "90%", margin: "50px 0" }}>
            <Box style={{ overflowX: "scroll" }}>
              <Grid
                container
                spacing={2}
                style={{ minWidth: "800px", margin: "30px 0" }}
              >
                <Grid item xs={11}>
                  <PlayButton setInitialTracks={setInitialTracks} />
                </Grid>
                <Grid item xs={1}>
                  <ProjectInfo />
                </Grid>
              </Grid>
            </Box>
            <Tracks initialTracks={initialTracks} noteNames={noteNames} />
          </Box>
        )}
      </header>
    </div>
  );
};

export default App;
