/**
 * Utility functions and some components
 */
import React, { useState, useEffect, useRef } from "react";
import IconButton from "@mui/material/IconButton";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import Box from "@mui/material/Box";
import { styled } from "@mui/material/styles";
import TextField from "@mui/material/TextField";

// 長さ length, で全ての値が initialValue な array を作る．
// ただし，値は JSON.parse/stringfy を用いて deep copy する．
export const makeArray = <T extends {}>(length: number, initialValue: T): T[] =>
  JSON.parse(JSON.stringify(Array(length).fill(initialValue)));

// Upload 用のボタンのための Component のプロパティ
interface UploadButtonProps {
  setFile: (file: File) => void;
}

// 画面に表示しない input の componenet
const Input = styled("input")({
  display: "none",
});

// File をユーザの手元からアプリにアップロードするためのボタン
export const UploadButton = (props: UploadButtonProps) => {
  // uploader
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("uploading...");
    const files = event.target.files;
    if (files === null) return;
    const file = files[0];
    if (file === null) return;
    props.setFile(file);
  };

  return (
    <label htmlFor="file-upload">
      <Input
        accept="*"
        id="file-upload"
        type="file"
        onChange={handleFileUpload}
      />
      <IconButton aria-label="file-upload" component="span">
        <FileUploadIcon />
      </IconButton>
    </label>
  );
};

interface DownloadButtonProps {
  fileName: string; // ファイルの名前
  content: string; // ファイルの内容（現在は文字列のみ対応）
}

// アプリからユーザの手元にファイルをダウンロードするためのボタン
export const DownloadButton = (props: DownloadButtonProps) => {
  const [fileDownloadUrl, setFileDownloadUrl] = useState<string | undefined>(
    undefined
  );
  const dofileDownload = useRef<HTMLAnchorElement>(null);

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
    const blob = new Blob([props.content]); // Step 3
    console.log(blob);
    const fileDownloadUrl = URL.createObjectURL(blob); // Step 4
    setFileDownloadUrl(fileDownloadUrl); // Step 5
  };

  return (
    <Box>
      <IconButton aria-label="file-download" onClick={handleFileDownload}>
        <FileDownloadIcon />
      </IconButton>
      {
        // a hidden anchor element
        <a
          style={{ display: "none" }}
          download={props.fileName}
          href={fileDownloadUrl}
          ref={dofileDownload}
        >
          download it
        </a>
      }
    </Box>
  );
};

// トラックの長さを入力するためのボタン
export const TrackLengthField = (props: {
  setTrackLength: (trackLength: number) => void;
  initialTrackLength: number;
  min: number;
}) => {
  const [trackLengthStr, setTrackLengthStr] = useState(
    `${props.initialTrackLength}`
  );
  const [isError, setIsError] = useState(false);

  useEffect(
    () => setTrackLengthStr(`${props.initialTrackLength}`),
    [props.initialTrackLength]
  );

  return (
    <Box>
      <TextField
        error={isError}
        value={trackLengthStr}
        label="Length"
        type="number"
        helperText={
          isError ? `the length must not be shorter than ${props.min}` : ""
        }
        InputProps={{ inputProps: { min: props.min } }}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          if (e.target) {
            const newLength = e.target.value;
            console.log("setting track length");
            setTrackLengthStr(newLength);

            if (newLength.length <= 0) {
              console.log("too short");
              setIsError(true);
              props.setTrackLength(props.min);
              return;
            }

            const newLengthNum = parseInt(newLength);

            if (!isNaN(newLengthNum) && newLengthNum < props.min) {
              console.log("too short");
              setIsError(true);
              props.setTrackLength(props.min);
            } else {
              setIsError(false);
              props.setTrackLength(newLengthNum);
            }
          }
        }}
      />
    </Box>
  );
};
