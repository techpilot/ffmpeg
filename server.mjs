import express from "express";
import cors from "cors";
import multer from "multer";
import { createFFmpeg } from "@ffmpeg/ffmpeg";
import PQueue from "p-queue";

const ffmpegInstance = createFFmpeg({ log: true });
let ffmpegLoadingPromise = ffmpegInstance.load();

const requestQueue = new PQueue({ concurrency: 1 });

async function getFFmpeg() {
  if (ffmpegLoadingPromise) {
    await ffmpegLoadingPromise;
    ffmpegLoadingPromise = undefined;
  }

  return ffmpegInstance;
}

const app = express();
const port = 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

app.use(cors());

app.post("/thumbnail", upload.single("video"), async (req, res) => {
  try {
    const videoData = req.file.buffer;

    const ffmpeg = await getFFmpeg();

    const inputFileName = `input-video`;
    const outputFileName = `output-image.mp4`;
    let outputData = null;

    await requestQueue.add(async () => {
      ffmpeg.FS("writeFile", inputFileName, videoData);

      // await ffmpeg.run(
      //   "-ss",
      //   "00:00:01.000",
      //   "-i",
      //   inputFileName,
      //   "-frames:v",
      //   "1",
      //   outputFileName
      // );

      // await ffmpeg.run(
      //   "-y",
      //   "-t",
      //   "3",
      //   "-i",
      //   inputFileName,
      //   "-filter_complex",
      //   "fps=5,scale=720:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse",
      //   "-f",
      //   "gif",
      //   outputFileName
      // );

      await ffmpeg.run(
        "-i",
        inputFileName,
        "-t",
        "2.5",
        "-ss",
        "2.0",
        "-f",
        "mp4",
        outputFileName
      );

      outputData = ffmpeg.FS("readFile", outputFileName);
      ffmpeg.FS("unlink", inputFileName);
      ffmpeg.FS("unlink", outputFileName);
    });

    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment;filename=${outputFileName}`,
      "Content-Length": outputData.length,
    });
    res.end(Buffer.from(outputData, "binary"));
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`[info] ffmpeg-api listening at http://localhost:${port}`);
});
