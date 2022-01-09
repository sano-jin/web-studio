/**
 * Sound samples
 */
import { makeArray } from "./util";

// 各音の名前
export const noteNames = [
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

// 音源の名前（から，接頭辞の "Piano" を除いたもの）
export const soundFileNames = [
  "11 (12)", // C
  "11 (10)", // D
  "11 (8)", // E
  "11 (7)", // F
  "11 (5)", // G
  "11 (3)", // A
  "11 (1)", // B
  "11",
  "13",
  "15",
  "16",
  "18",
  "110",
  "112",
  "113",
  "115",
  "117",
  "118",
  "120",
  "122",
  "124",
  "125", // C
  "125 (2)", // D
  "125 (4)", // E
  "125 (5)", // F
  "125 (7)", // G
  "125 (9)", // A
  "125 (11)", // B
  "125 (12)", // C
];

if (soundFileNames.length !== noteNames.length) {
  throw new Error(
    "implementation error: the number of the files and the notes are not the same"
  );
}

// React で管理しない，audio の状態．
export interface SoundState {
  audioBuffer: AudioBuffer | null;
  sampleSource: AudioBufferSourceNode | null;
  isPlaying: boolean; // 再生中なら true
}

// ピアノロールで自動的に鳴らす用の音
export const soundStates: SoundState[] = makeArray(noteNames.length, {
  audioBuffer: null,
  sampleSource: null,
  isPlaying: false,
});

// ユーザがクリックしたときに鳴らすようの音
export const testSoundStates: SoundState[] = makeArray(noteNames.length, {
  audioBuffer: null,
  sampleSource: null,
  isPlaying: false,
});

// 音源を取得し AudioBuffer 形式に変換して返す関数
const setupSample = async (audioContext: AudioContext, index: string) => {
  console.log("setting", index);
  const response = await fetch(`./SynthesizedPianoNotes/Piano${index}.mp3`);
  const arrayBuffer = await response.arrayBuffer();
  // Web Audio API で使える形式に変換
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
};

// 音源を何回 setup したかの counter．
// 一回以上だったら実装ミス（setup は一回だけやれば良い）
let setupCounter = 0;

// 複数音源を全て setup する．
// await Promise.all で，全てセットし終わるまで待つ
export const setup = async (audioContext: AudioContext) => {
  await Promise.all(
    soundFileNames.map(async (note, index) => {
      console.log("index, note", index, note);
      const audioBuffer = await setupSample(audioContext, note);
      soundStates[index].audioBuffer = audioBuffer;
      testSoundStates[index].audioBuffer = audioBuffer;
    })
  );

  console.log(`done setup for tracks`, ++setupCounter);
};
