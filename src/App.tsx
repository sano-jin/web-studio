import React, { useState, useEffect } from "react";
import "./App.css";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import PauseIcon from "@mui/icons-material/Pause";
import CircularProgress from "@mui/material/CircularProgress";
import Slider from "@mui/material/Slider";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import {
  makeArray,
  UploadButton,
  DownloadButton,
  TrackLengthField,
} from "./util";
import { noteNames, setup } from "./soundSamples";
import { ProjectInfo } from "./Info";
import {
  globalState,
  eliminateHilights,
  timerID,
  audioContext,
  scheduler,
  draw,
  Tracks,
} from "./Track";

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
    globalState.nextNoteTime = audioContext.currentTime;
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
  const [initialTrackLength, setInitialTrackLength] = useState(
    globalState.trackLength
  );

  const handleChangeBPM = (event: Event, newBPM: number | number[]) => {
    globalState.bpm = newBPM as number;
    setBPM(newBPM as number);
  };

  const handleChangeBeatTimer = (
    event: Event,
    newBeatTimer: number | number[]
  ) => {
    globalState.currentNote = newBeatTimer as number;
    eliminateHilights();
    setBeatTimer(newBeatTimer as number);
  };

  return (
    <div>
      <Stack direction="row" spacing={2}>
        <Button
          aria-label="stop"
          onClick={() => {
            globalState.currentNote = 0;
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
            max={globalState.trackLength - 1}
            step={1}
          />
          <Box>{beatTimer}</Box>
        </Box>
        <UploadButton
          setFile={(file) => {
            console.log("setting file");
            file.text().then((text) => {
              const tracks = JSON.parse(text);
              globalState.tracks = tracks;
              console.log("setting initial tracks");
              globalState.trackLength = globalState.tracks[0].length;
              props.setInitialTracks(globalState.tracks);
              setInitialTrackLength(globalState.tracks[0].length);
            });
          }}
        />
        <DownloadButton
          content={JSON.stringify(
            globalState.tracks.map((tracks) =>
              tracks.slice(0, globalState.trackLength)
            )
          )}
          fileName="song.txt"
        />
        <TrackLengthField
          initialTrackLength={initialTrackLength}
          min={8}
          setTrackLength={(newTrackLength: number) => {
            globalState.trackLength = newTrackLength;
            if (globalState.tracks[0].length < newTrackLength) {
              console.log("mapping new track");
              globalState.tracks = globalState.tracks.map((globalTrack) => [
                ...globalTrack,
                ...makeArray(newTrackLength - globalTrack.length, false),
              ]);
              console.log("mapped new track. initializing tracks");
              const setupInitialTracks = async () => {
                await props.setInitialTracks(globalState.tracks);
                console.log("setup the initial tracks --- (1)");
              };
              setupInitialTracks();
            } else {
              // グローバルトラックの長さを縮めることはしない
              const newInitialTracks = globalState.tracks.map((track) =>
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
    makeArray(noteNames.length, Array(globalState.trackLength).fill(false))
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
            <Box style={{ overflowX: "scroll", margin: "30px 0" }}>
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
