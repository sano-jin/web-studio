import React, { useState, useEffect, useRef } from "react";
import "./App.css";
// import logo from "./logo.svg";
// import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import Button from "@mui/material/Button";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import PauseIcon from "@mui/icons-material/Pause";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
// import Chip from "@mui/material/Chip";
import { makeArray } from "./util";
import {
  noteNames,
  SoundState,
  soundStates,
  testSoundStates,
  setup,
} from "./soundSamples";

// safari のサポートもするなら，webkitAudioContext も必要だが，面倒なのでやらない．
const audioContext = new AudioContext();

let globalBPM = 80.0; // tempo

const lookahead = 25.0; // How freaquently to call scheduling function (in milliseconds)
const scheduleAheadTime = 0.2; // How far ahead to schedule audio (in seconds)

let currentNote = 0;
let nextNoteTime = 0.0; // When the next note is due.

// メインのトラックの長さ（todo: user definable にする）
const trackLength = 64;

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
const stop = async (soundState: SoundState, time: number) => {
  const sampleSource = soundState.sampleSource;
  sampleSource?.stop(time + 0.1);
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

interface TrackCellProps {
  trackIndex: number;
  index: number;
  initialTracks: boolean[][];
}

// 一つ一つのノート
const TrackCell = (props: TrackCellProps) => {
  // このノートが選択されているなら true
  // globalTracks[props.trackIndex][props.index] と同じ値になっている必要がある．
  const [isSelected, setIsSelected] = useState(
    props.initialTracks[props.trackIndex][props.index]
  );

  useEffect(() => {
    setIsSelected(props.initialTracks[props.trackIndex][props.index]);
  }, [props.trackIndex, props.index, props.initialTracks]);

  return (
    <ToggleButton
      className={`cell (_, ${props.index})`}
      value="check"
      selected={isSelected}
      onMouseDown={() => {
        // 2 重に再生されないようになっているので，まず止めてから再生する．
        // 要改良
        // ユーザがクリックしたタイミングで鳴らす
        stop(testSoundStates[props.trackIndex], 0);
        play(testSoundStates[props.trackIndex], 0);
      }}
      onMouseUp={() => {
        stop(testSoundStates[props.trackIndex], 0);
      }}
      onChange={() => {
        // 選択状態かどうかをトグルする．
        console.log(
          `set cell (${props.trackIndex}, ${props.index})`,
          !isSelected
        );
        setIsSelected(!isSelected);
        globalTracks[props.trackIndex][props.index] = !isSelected;
      }}
      style={{
        width: "10px",
        height: "10px",
        color: "#777",
        margin: "0px",
        padding: "10px",
      }}
    >
      <code>{props.index % 4 === 0 ? "." : " "}</code>
    </ToggleButton>
  );
};

interface TrackCellsProps {
  trackIndex: number; // このトラックの識別子（音階のキー）
  initialTracks: boolean[][];
}

// 一本のトラック
const TrackCells = (props: TrackCellsProps) => {
  const track = Array(trackLength).fill(false);

  return (
    <Stack direction="row" spacing={1} style={{ width: "auto" }}>
      {track.map((_, index) => (
        <TrackCell
          key={index}
          trackIndex={props.trackIndex}
          index={index}
          initialTracks={props.initialTracks}
        />
      ))}
    </Stack>
  );
};

interface TrackNoteHeaderProps {
  trackIndex: number;
}

const TrackNoteHeader = (trackNoteHeaderProps: TrackNoteHeaderProps) => (
  <div
    style={{
      width: "20px",
      height: "20px",
      overflow: "hidden",
      border: "1px solid transparent",
    }}
  >
    <code>{noteNames[trackNoteHeaderProps.trackIndex]}</code>
  </div>
);

const Tracks = (props: { initialTracks: boolean[][] }) => {
  const tracks = Array(noteNames.length).fill(false);

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
      <Stack
        direction="column"
        spacing={0}
        style={{
          display: "inline-block",
          width: "30px",
          verticalAlign: "top",
        }}
      >
        {tracks.map((_, index) => (
          <TrackNoteHeader key={index} trackIndex={tracks.length - index - 1} />
        ))}
      </Stack>
      <div
        style={{
          overflowX: "scroll",
          width: "calc(100% - 30px)",
          height: "100%",
          fontSize: "calc(5px + 1vmin)",
          color: "#777",
          display: "inline-block",
        }}
      >
        <Stack direction="column" spacing={0}>
          {tracks.map((_, index) => (
            <TrackCells
              key={index}
              trackIndex={tracks.length - index - 1}
              initialTracks={props.initialTracks}
            />
          ))}
        </Stack>
      </div>
    </div>
  );
};

// アニメーションを行うための変数．
// todo: closure に含めるようにしたほうが良いかも．
let lastNoteDrawn = trackLength;

// ハイライトを除去する．
const eliminateHilights = () => {
  console.log("eliminate hilights", lastNoteDrawn);
  const lastNoteElems = document.getElementsByClassName(
    `cell (_, ${lastNoteDrawn})`
  ) as HTMLCollectionOf<HTMLElement>;
  for (let i = 0; i < lastNoteElems.length; i++) {
    lastNoteElems[i].style.boxShadow = "none";
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
    const currentNoteElems = document.getElementsByClassName(
      `cell (_, ${drawNote})`
    ) as HTMLCollectionOf<HTMLElement>;
    for (let i = 0; i < currentNoteElems.length; i++) {
      if (globalTracks[globalTracks.length - i - 1][drawNote]) {
        // 今音を出しているノード
        currentNoteElems[i].style.boxShadow =
          "0 0 8px rgba(180, 180, 255, 0.5)";
      } else {
        currentNoteElems[i].style.boxShadow =
          "0 0 8px rgba(255, 255, 255, 0.2)";
      }
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
const PlayButton = (playButtonProps: PlayButtonProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [beatTimer, setBeatTimer] = useState(0);
  const [bpm, setBPM] = useState(100);
  const [fileDownloadUrl, setFileDownloadUrl] = useState<string | undefined>(
    undefined
  );
  const dofileDownload = useRef<HTMLAnchorElement>(null);

  const handleChangeBPM = (event: Event, newBPM: number | number[]) => {
    globalBPM = bpm;
    setBPM(newBPM as number);
  };

  const handleChangeBeatTimer = (
    event: Event,
    newBeatTimer: number | number[]
  ) => {
    currentNote = newBeatTimer as number;
    setBeatTimer(newBeatTimer as number);
  };

  // uploader
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files === null) return;
    const file = files[0];
    if (file === null) return;
    file.text().then((text) => {
      const tracks = JSON.parse(text);
      globalTracks = tracks;
      playButtonProps.setInitialTracks(globalTracks);
    });
  };

  // downloader の補助関数．
  // url を設定し終えた後に，クリックする．
  useEffect(() => {
    // "Do something after fileDownloadUrl has changed"
    if (fileDownloadUrl !== undefined) {
      if (!dofileDownload || !dofileDownload.current) return;
      dofileDownload.current.click(); // Step 6
      URL.revokeObjectURL(fileDownloadUrl); // Step 7
      setFileDownloadUrl(undefined);
    }
  }, [fileDownloadUrl]);

  // downloader
  const handleFileDownload = () => {
    const output = JSON.stringify(globalTracks);
    const blob = new Blob([output]); // Step 3
    console.log(blob);
    const fileDownloadUrl = URL.createObjectURL(blob); // Step 4
    setFileDownloadUrl(fileDownloadUrl); // Step 5
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
          <Slider
            aria-label="bpm"
            value={bpm}
            onChange={handleChangeBPM}
            min={1}
            max={300}
          />
          <p>{bpm}</p>
        </Box>
        <Box style={{ width: "200px" }}>
          <Slider
            aria-label="beatTimer"
            value={beatTimer}
            onChange={handleChangeBeatTimer}
            max={trackLength - 1}
            step={1}
          />
          <p>{beatTimer}</p>
        </Box>
        <label htmlFor="file-upload">
          <input
            id="file-upload"
            type="file"
            name="file-upload"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <Box className="custom-button file-uploader">
            <FileUploadIcon />
          </Box>
        </label>
        <Button aria-label="file-download" onClick={handleFileDownload}>
          <FileDownloadIcon />
        </Button>
        {
          // a hidden anchor element
          <a
            style={{ display: "none" }}
            download={"song.txt"}
            href={fileDownloadUrl}
            ref={dofileDownload}
          >
            download it
          </a>
        }
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
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <PlayButton setInitialTracks={setInitialTracks} />
              </Grid>
              <Grid item xs={12}>
                <Tracks initialTracks={initialTracks} />
              </Grid>
            </Grid>
          </Box>
        )}
      </header>
    </div>
  );
};

export default App;
