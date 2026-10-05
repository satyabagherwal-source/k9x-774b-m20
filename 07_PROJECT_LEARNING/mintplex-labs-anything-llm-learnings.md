# Forensic Learning Record (Deep Inspection): Mintplex-Labs/anything-llm

> **Canonical Artifact**: `07_PROJECT_LEARNING/mintplex-labs-anything-llm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:07:46.929Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Mintplex-Labs/anything-llm`
- **Description**: Stop renting your intelligence. Own it with AnythingLLM. Everything you need for a powerful local-first agent experience 
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 66721 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `collector/utils/EncryptionWorker/index.js`
```
const crypto = require("crypto");

// Differs from EncryptionManager in that is does not set or define the keys that will be used
// to encrypt or read data and it must be told the key (as base64 string) explicitly that will be used and is provided to
// the class on creation. This key should be the same `key` that is used by the EncryptionManager class.
class EncryptionWorker {
  constructor(presetKeyBase64 = "") {
    this.key = Buffer.from(presetKeyBase64, "base64");
    this.algorithm = "aes-256-cbc";
    this.separator = ":";
  }

  log(text, ...args) {
    console.log(`\x1b[36m[EncryptionManager]\x1b[0m ${text}`, ...args);
  }

  /**
   * Give a chunk source, parse its payload query param and expand that object back into the URL
   * as additional query params
   * @param {string} chunkSource
   * @returns {URL} Javascript URL object with query params decrypted from payload query param.
   */
  expandPayload(chunkSource = "") {
    try {
      const url = new URL(chunkSource);
      if (!url.searchParams.has("payload")) return url;

      const decryptedPayload = this.decrypt(url.searchParams.get("payload"));
      const encodedParams = JSON.parse(decryptedPayload);
      url.searchParams.delete("payload"); // remove payload prop

      // Add all query params needed to replay as query params
      Object.entries(encodedParams).forEach(([key, value]) =>
        url.searchParams.append(key, value)
      );
      return url;
    } catch (e) {
      console.error(e);
    }
    return new URL(chunkSource);
  }

  encrypt(plainTextString = null) {
    try {
      if (!plainTextString)
        throw new Error("Empty string is not valid for this method.");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      const encrypted = cipher.update(plainTextString, "utf8", "hex");
      return [
        encrypted + cipher.final("hex"),
        Buffer.from(iv).toString("hex"),
      ].join(this.separator);
    } catch (e) {
      this.log(e);
      return null;
    }
  }

  decrypt(encryptedString) {
    try {
      const [encrypted, iv] = encryptedString.split(this.separator);
      if (!iv) throw new Error("IV not found");
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(iv, "hex")
      );
      return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
    } catch (e) {
      this.log(e);
      return null;
    }
  }
}

module.exports = { EncryptionWorker };

```

### Core Architecture Module: `collector/utils/OCRLoader/index.js`
```
const fs = require("fs");
const os = require("os");
const path = require("path");
const { VALID_LANGUAGE_CODES } = require("./validLangs");

class OCRLoader {
  /**
   * The language code(s) to use for the OCR.
   * @type {string[]}
   */
  language;
  /**
   * The cache directory for the OCR.
   * @type {string}
   */
  cacheDir;

  /**
   * The constructor for the OCRLoader.
   * @param {Object} options - The options for the OCRLoader.
   * @param {string} options.targetLanguages - The target languages to use for the OCR as a comma separated string. eg: "eng,deu,..."
   */
  constructor({ targetLanguages = "eng" } = {}) {
    this.language = this.parseLanguages(targetLanguages);
    this.cacheDir = path.resolve(
      process.env.STORAGE_DIR
        ? path.resolve(process.env.STORAGE_DIR, `models`, `tesseract`)
        : path.resolve(__dirname, `../../../server/storage/models/tesseract`)
    );

    // Ensure the cache directory exists or else Tesseract will persist the cache in the default location.
    if (!fs.existsSync(this.cacheDir))
      fs.mkdirSync(this.cacheDir, { recursive: true });
    this.log(
      `OCRLoader initialized with language support for:`,
      this.language.map((lang) => VALID_LANGUAGE_CODES[lang]).join(", ")
    );
  }

  /**
   * Parses the language code from a provided comma separated string of language codes.
   * @param {string} language - The language code to parse.
   * @returns {string[]} The parsed language code.
   */
  parseLanguages(language = null) {
    try {
      if (!language || typeof language !== "string") return ["eng"];
      const langList = language
        .split(",")
        .map((lang) => (lang.trim() !== "" ? lang.trim() : null))
        .filter(Boolean)
        .filter((lang) => VALID_LANGUAGE_CODES.hasOwnProperty(lang));
      if (langList.length === 0) return ["eng"];
      return langList;
    } catch (e) {
      this.log(`Error parsing languages: ${e.message}`, e.stack);
      return ["eng"];
    }
  }

  log(text, ...args) {
    console.log(`\x1b[36m[OCRLoader]\x1b[0m ${text}`, ...args);
  }

  /**
   * Loads a PDF file and returns an array of documents.
   * This function is reserved to parsing for SCANNED documents - digital documents are not supported in this function
   * @returns {Promise<{pageContent: string, metadata: object}[]>} An array of documents with page content and metadata.
   */
  async ocrPDF(
    filePath,
    { maxExecutionTime = 300_000, batchSize = 10, maxWorkers = null } = {}
  ) {
    if (
      !filePath ||
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {
      this.log(`File ${filePath} does not exist. Skipping OCR.`);
      return [];
    }

    const documentTitle = path.basename(filePath);
    this.log(`Starting OCR of ${documentTitle}`);
    const pdfjs = await import("pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js");
    let buffer = fs.readFileSync(filePath);

    const pdfDocument = await pdfjs.getDocument({ data: buffer });

    const documents = [];
    const meta = await pdfDocument.getMetadata().catch(() => null);
    const metadata = {
      source: filePath,
      pdf: {
        version: "v2.0.550",
        info: meta?.info,
        metadata: meta?.metadata,
        totalPages: pdfDocument.numPages,
      },
    };

    const pdfSharp = new PDFSharp({
      validOps: [
        pdfjs.OPS.paintJpegXObject,
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintInlineImageXObject,
      ],
    });
    await pdfSharp.init();

    const { createWorker, OEM } = require("tesseract.js");
    const BATCH_SIZE = batchSize;
    const MAX_EXECUTION_TIME = maxExecutionTime;
    const NUM_WORKERS = maxWorkers ?? Math.min(os.cpus().length, 4);
    const totalPages = pdfDocument.numPages;
    const workerPool = await Promise.all(
      Array(NUM_WORKERS)
        .fill(0)
        .map(() =>
          createWorker(this.language, OEM.LSTM_ONLY, {
            cachePath: this.cacheDir,
          })
        )
    );

    const startTime = Date.now();
    try {
      this.log("Bootstrapping OCR completed successfully!", {
        MAX_EXECUTION_TIME_MS: MAX_EXECUTION_TIME,
        BATCH_SIZE,
        MAX_CONCURRENT_WORKERS: NUM_WORKERS,
        TOTAL_PAGES: totalPages,
      });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `OCR job took too long to complete (${
                MAX_EXECUTION_TIME / 1000
              } seconds)`
            )
          );
        }, MAX_EXECUTION_TIME);
      });

      const processPages = async () => {
        for (
          let startPage = 1;
          startPage <= totalPages;
          startPage += BATCH_SIZE
        ) {
          const endPage = Math.min(startPage + BATCH_SIZE - 1, totalPages);
          const pageNumbers = Array.from(
            { length: endPage - startPage + 1 },
            (_, i) => startPage + i
          );
          this.log(`Working on pages ${startPage} - ${endPage}`);

          const pageQueue = [...pageNumbers];
          const results = [];
          const workerPromises = workerPool.map(async (worker, workerIndex) => {
            while (pageQueue.length > 0) {
              const pageNum = pageQueue.shift();
              this.log(
                `\x1b[34m[Worker ${
                  workerIndex + 1
                }]\x1b[0m assigned pg${pageNum}`
              );
              const page = await pdfDocument.getPage(pageNum);
              const imageBuffer = await pdfSharp.pageToBuffer({ page });
              if (!imageBuffer) continue;
              const { data } = await worker.recognize(imageBuffer, {}, "text");
              this.log(
                `✅ \x1b[34m[Worker ${
                  workerIndex + 1
                }]\x1b[0m completed pg${pageNum}`
              );
              results.push({
                pageContent: data.text,
                metadata: {
                  ...metadata,
                  loc: { pageNumber: pageNum },
                },
              });
            }
          });

          await Promise.all(workerPromises);
          documents.push(
            ...results.sort(
              (a, b) => a.metadata.loc.pageNumber - b.metadata.loc.pageNumber
            )
          );
        }
        return documents;
      };

      await Promise.race([timeoutPromise, processPages()]);
    } catch (e) {
      this.log(`Error: ${e.message}`, e.stack);
    } finally {
      global.Image = undefined;
      await Promise.all(workerPool.map((worker) => worker.terminate()));
    }

    this.log(`Completed OCR of ${documentTitle}!`, {
      documentsParsed: documents.length,
      totalPages: totalPages,
      executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
    });
    return documents;
  }

  /**
   * Loads an image file and returns the OCRed text.
   * @param {string} filePath - The path to the image file.
   * @param {Object} options - The options for the OCR.
   * @param {number} options.maxExecutionTime - The maximum execution time of the OCR in milliseconds.
   * @returns {Promise<string>} The OCRed text.
   */
  async ocrImage(filePath, { maxExecutionTime = 300_000 } = {}) {
    let content = "";
    let worker = null;
    if (
      !filePath ||
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {
      this.log(`File ${filePath} does not exist. Skipping OCR.`);
      return null;
    }

    const documentTitle = path.basename(filePath);
    try {
      this.log(`Starting OCR of ${documentTitle}`);
      const startTime = Date.now();
      const { createWorker, OEM } = require("tesseract.js");
      worker = await createWorker(this.language, OEM.LSTM_ONLY, {
        cachePath: this.cacheDir,
      });

      // Race the timeout with the OCR
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `OCR job took too long to complete (${
                maxExecutionTime / 1000
              } seconds)`
            )
          );
        }, maxExecutionTime);
      });

      const processImage = async () => {
        const { data } = await worker.recognize(filePath, {}, "text");
        content = data.text;
      };

      await Promise.race([timeoutPromise, processImage()]);
      this.log(`Completed OCR of ${documentTitle}!`, {
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      });

      return content;
    } catch (e) {
      this.log(`Error: ${e.message}`);
      return null;
    } finally {
      //eslint-disable-next-line
      if (!worker) return;
      await worker.terminate();
    }
  }
}

/**
 * pdf.js ImageKind.GRAYSCALE_1BPP. Packed 1-bit rows are ceil(width/8) bytes.
 * @type {number}
 */
const PDFJS_GRAYSCALE_1BPP = 1;

/**
 * Unpack pdf.js packed 1-bit DeviceGray into 8-bit grayscale Sharp can ingest.
 * Bit 1 is white, bit 0 is black (PDF DeviceGray).
 *
 * @param {Buffer|Uint8Array} packed
 * @param {number} width
 * @param {number} height
 * @returns {Buffer|null}
 */
function unpackPackedGray1Bpp(packed, width, height) {
  if (!packed || width <= 0 || height <= 0) return null;
  const rowBytes = Math.ceil(width / 8);
  if (packed.length < rowBytes * height) return null;

  const out = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes;
    for (let x = 0; x < width; x++) {
      const byte = packed[rowStart + (x >> 3)];
      const bit = (byte >> (7 - (x & 7))) & 1;
      out[y * width + x] = bit ? 255 : 0;
    }
  }
  return out;
}

/**
 * Build a Sharp `raw` input from a pdf.js image object.
 * Copies the source buffer so concurrent OCR workers cannot share backing memory.
 * 1-bit CCITT/bitonal scans (issue #6118) are expanded to 8-bit gray.
 *
 * @param {{width?: number, height?: number, data?: ArrayLike<number>, kind?: number}} img
 * @returns {{data: Buffer, width: number, h
```

### Core Architecture Module: `collector/utils/OCRLoader/validLangs.js`
```
/*

To get the list of valid language codes - do the following:
Open the following URL in your browser: https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html

Check this element is the proper table tbody with all the codes via console:
document.getElementsByTagName('table').item(0).children.item(1)

Now, copy the following code and paste it into the console:
function parseLangs() {
let langs = {};
  Array.from(document.getElementsByTagName('table').item(0).children.item(1).children).forEach((el) => {
    const [codeEl, languageEl, ...rest] = el.children
    const code = codeEl.innerText.trim()
    const language = languageEl.innerText.trim()
    if (!!code && !!language) langs[code] = language
  })
  return langs;
}

now, run the function:
copy(parseLangs())
*/

const VALID_LANGUAGE_CODES = {
  afr: "Afrikaans",
  amh: "Amharic",
  ara: "Arabic",
  asm: "Assamese",
  aze: "Azerbaijani",
  aze_cyrl: "Azerbaijani - Cyrilic",
  bel: "Belarusian",
  ben: "Bengali",
  bod: "Tibetan",
  bos: "Bosnian",
  bre: "Breton",
  bul: "Bulgarian",
  cat: "Catalan; Valencian",
  ceb: "Cebuano",
  ces: "Czech",
  chi_sim: "Chinese - Simplified",
  chi_tra: "Chinese - Traditional",
  chr: "Cherokee",
  cos: "Corsican",
  cym: "Welsh",
  dan: "Danish",
  dan_frak: "Danish - Fraktur (contrib)",
  deu: "German",
  deu_frak: "German - Fraktur (contrib)",
  deu_latf: "German (Fraktur Latin)",
  dzo: "Dzongkha",
  ell: "Greek, Modern (1453-)",
  eng: "English",
  enm: "English, Middle (1100-1500)",
  epo: "Esperanto",
  equ: "Math / equation detection module",
  est: "Estonian",
  eus: "Basque",
  fao: "Faroese",
  fas: "Persian",
  fil: "Filipino (old - Tagalog)",
  fin: "Finnish",
  fra: "French",
  frk: "German - Fraktur (now deu_latf)",
  frm: "French, Middle (ca.1400-1600)",
  fry: "Western Frisian",
  gla: "Scottish Gaelic",
  gle: "Irish",
  glg: "Galician",
  grc: "Greek, Ancient (to 1453) (contrib)",
  guj: "Gujarati",
  hat: "Haitian; Haitian Creole",
  heb: "Hebrew",
  hin: "Hindi",
  hrv: "Croatian",
  hun: "Hungarian",
  hye: "Armenian",
  iku: "Inuktitut",
  ind: "Indonesian",
  isl: "Icelandic",
  ita: "Italian",
  ita_old: "Italian - Old",
  jav: "Javanese",
  jpn: "Japanese",
  kan: "Kannada",
  kat: "Georgian",
  kat_old: "Georgian - Old",
  kaz: "Kazakh",
  khm: "Central Khmer",
  kir: "Kirghiz; Kyrgyz",
  kmr: "Kurmanji (Kurdish - Latin Script)",
  kor: "Korean",
  kor_vert: "Korean (vertical)",
  kur: "Kurdish (Arabic Script)",
  lao: "Lao",
  lat: "Latin",
  lav: "Latvian",
  lit: "Lithuanian",
  ltz: "Luxembourgish",
  mal: "Malayalam",
  mar: "Marathi",
  mkd: "Macedonian",
  mlt: "Maltese",
  mon: "Mongolian",
  mri: "Maori",
  msa: "Malay",
  mya: "Burmese",
  nep: "Nepali",
  nld: "Dutch; Flemish",
  nor: "Norwegian",
  oci: "Occitan (post 1500)",
  ori: "Oriya",
  osd: "Orientation and script detection module",
  pan: "Panjabi; Punjabi",
  pol: "Polish",
  por: "Portuguese",
  pus: "Pushto; Pashto",
  que: "Quechua",
  ron: "Romanian; Moldavian; Moldovan",
  rus: "Russian",
  san: "Sanskrit",
  sin: "Sinhala; Sinhalese",
  slk: "Slovak",
  slk_frak: "Slovak - Fraktur (contrib)",
  slv: "Slovenian",
  snd: "Sindhi",
  spa: "Spanish; Castilian",
  spa_old: "Spanish; Castilian - Old",
  sqi: "Albanian",
  srp: "Serbian",
  srp_latn: "Serbian - Latin",
  sun: "Sundanese",
  swa: "Swahili",
  swe: "Swedish",
  syr: "Syriac",
  tam: "Tamil",
  tat: "Tatar",
  tel: "Telugu",
  tgk: "Tajik",
  tgl: "Tagalog (new - Filipino)",
  tha: "Thai",
  tir: "Tigrinya",
  ton: "Tonga",
  tur: "Turkish",
  uig: "Uighur; Uyghur",
  ukr: "Ukrainian",
  urd: "Urdu",
  uzb: "Uzbek",
  uzb_cyrl: "Uzbek - Cyrilic",
  vie: "Vietnamese",
  yid: "Yiddish",
  yor: "Yoruba",
};

module.exports.VALID_LANGUAGE_CODES = VALID_LANGUAGE_CODES;

```

### Core Architecture Module: `collector/utils/WhisperProviders/GenericOpenAiWhisper.js`
```
const fs = require("fs");

class GenericOpenAiWhisper {
  constructor({ options }) {
    const { OpenAI: OpenAIApi } = require("openai");
    if (!options.WhisperGenericOpenAiBaseUrl)
      throw new Error("No base URL was set.");

    this.openai = new OpenAIApi({
      baseURL: options.WhisperGenericOpenAiBaseUrl,
      apiKey: options.WhisperGenericOpenAiApiKey || null,
    });
    this.model = options.WhisperGenericOpenAiModel || "whisper-small";
    this.temperature = 0;
    this.#log("Initialized.");
  }

  #log(text, ...args) {
    console.log(`\x1b[32m[GenericOpenAiWhisper]\x1b[0m ${text}`, ...args);
  }

  async processFile(fullFilePath) {
    return await this.openai.audio.transcriptions
      .create({
        file: fs.createReadStream(fullFilePath),
        model: this.model,
        temperature: this.temperature,
      })
      .then((response) => {
        if (!response) {
          return {
            content: "",
            error: "No content was able to be transcribed.",
          };
        }

        return { content: response.text, error: null };
      })
      .catch((error) => {
        this.#log(
          `Could not get any response from openai compatible whisper endpoint`,
          error.message
        );
        return { content: "", error: error.message };
      });
  }
}

module.exports = {
  GenericOpenAiWhisper,
};

```

### Core Architecture Module: `collector/utils/WhisperProviders/OpenAiWhisper.js`
```
const fs = require("fs");

class OpenAiWhisper {
  constructor({ options }) {
    const { OpenAI: OpenAIApi } = require("openai");
    if (!options.openAiKey) throw new Error("No OpenAI API key was set.");

    this.openai = new OpenAIApi({
      apiKey: options.openAiKey,
    });
    this.model = "whisper-1";
    this.temperature = 0;
    this.#log("Initialized.");
  }

  #log(text, ...args) {
    console.log(`\x1b[32m[OpenAiWhisper]\x1b[0m ${text}`, ...args);
  }

  async processFile(fullFilePath) {
    return await this.openai.audio.transcriptions
      .create({
        file: fs.createReadStream(fullFilePath),
        model: this.model,
        temperature: this.temperature,
      })
      .then((response) => {
        if (!response) {
          return {
            content: "",
            error: "No content was able to be transcribed.",
          };
        }

        return { content: response.text, error: null };
      })
      .catch((error) => {
        this.#log(
          `Could not get any response from openai whisper`,
          error.message
        );
        return { content: "", error: error.message };
      });
  }
}

module.exports = {
  OpenAiWhisper,
};

```

### Core Architecture Module: `collector/utils/WhisperProviders/ffmpeg/index.js`
```
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const { patchShellEnvironmentPath } = require("../../shell");
/**
 * Custom FFMPEG wrapper class for audio file conversion.
 * Replaces deprecated fluent-ffmpeg package.
 * Locates ffmpeg binary and converts audio files to required
 * WAV format (16k hz mono 32f) for Whisper transcription.
 *
 * @class FFMPEGWrapper
 */
class FFMPEGWrapper {
  static _instance;

  constructor() {
    if (FFMPEGWrapper._instance) return FFMPEGWrapper._instance;
    FFMPEGWrapper._instance = this;
    this._ffmpegPath = null;
  }

  log(text, ...args) {
    console.log(`\x1b[35m[FFMPEG]\x1b[0m ${text}`, ...args);
  }

  /**
   * Locates ffmpeg binary.
   * Uses fix-path on non-Windows platforms to ensure we can find ffmpeg.
   *
   * @returns {Promise<string>} Path to ffmpeg binary
   * @throws {Error}
   */
  async ffmpegPath() {
    if (this._ffmpegPath) return this._ffmpegPath;
    await patchShellEnvironmentPath();

    try {
      const which = process.platform === "win32" ? "where" : "which";
      const result = execSync(`${which} ffmpeg`, { encoding: "utf8" }).trim();
      const candidatePath = result?.split("\n")?.[0]?.trim();
      if (!candidatePath) throw new Error("FFMPEG candidate path not found.");
      if (!this.isValidFFMPEG(candidatePath))
        throw new Error("FFMPEG candidate path is not valid ffmpeg binary.");

      this.log(`Found FFMPEG binary at ${candidatePath}`);
      this._ffmpegPath = candidatePath;
      return this._ffmpegPath;
    } catch (error) {
      this.log(error.message);
    }

    throw new Error("FFMPEG binary not found.");
  }

  /**
   * Validates that path points to a valid ffmpeg binary.
   * Runs ffmpeg -version command.
   *
   * @param {string} pathToTest - Path of ffmpeg binary
   * @returns {boolean}
   */
  isValidFFMPEG(pathToTest) {
    try {
      if (!pathToTest || !fs.existsSync(pathToTest)) return false;
      execSync(`"${pathToTest}" -version`, { encoding: "utf8", stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Converts audio file to WAV format with required parameters for Whisper.
   * Output: 16k hz, mono, 32bit float.
   *
   * @param {string} inputPath - Input path for audio file (any format supported by ffmpeg)
   * @param {string} outputPath - Output path for converted file
   * @returns {Promise<boolean>}
   * @throws {Error} If ffmpeg binary cannot be found or conversion fails
   */
  async convertAudioToWav(inputPath, outputPath) {
    if (!fs.existsSync(inputPath))
      throw new Error(`Input file ${inputPath} does not exist.`);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    this.log(`Converting ${path.basename(inputPath)} to WAV format...`);
    // Convert to 16k hz mono 32f
    const result = spawnSync(
      await this.ffmpegPath(),
      [
        "-i",
        inputPath,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-acodec",
        "pcm_f32le",
        "-y",
        outputPath,
      ],
      { encoding: "utf8" }
    );

    // ffmpeg writes progress to stderr
    if (result.stderr) this.log(result.stderr.trim());
    if (result.status !== 0) throw new Error(`FFMPEG conversion failed`);
    this.log(`Conversion complete: ${path.basename(outputPath)}`);
    return true;
  }
}

module.exports = { FFMPEGWrapper };

```

### Core Architecture Module: `collector/utils/WhisperProviders/localWhisper.js`
```
const fs = require("fs");
const path = require("path");
const { v4 } = require("uuid");
const defaultWhisper = "Xenova/whisper-small"; // Model Card: https://huggingface.co/Xenova/whisper-small
const fileSize = {
  "Xenova/whisper-small": "250mb",
  "Xenova/whisper-large": "1.56GB",
};

class LocalWhisper {
  constructor({ options }) {
    this.model = options?.WhisperModelPref ?? defaultWhisper;
    this.fileSize = fileSize[this.model];
    this.cacheDir = path.resolve(
      process.env.STORAGE_DIR
        ? path.resolve(process.env.STORAGE_DIR, `models`)
        : path.resolve(__dirname, `../../../server/storage/models`)
    );

    this.modelPath = path.resolve(this.cacheDir, ...this.model.split("/"));
    // Make directory when it does not exist in existing installations
    if (!fs.existsSync(this.cacheDir))
      fs.mkdirSync(this.cacheDir, { recursive: true });

    this.#log("Initialized.");
  }

  #log(text, ...args) {
    console.log(`\x1b[32m[LocalWhisper]\x1b[0m ${text}`, ...args);
  }

  #validateAudioFile(wavFile) {
    const sampleRate = wavFile.fmt.sampleRate;
    const duration = wavFile.data.samples / sampleRate;

    // Most speech recognition systems expect minimum 8kHz
    // But we'll set it lower to be safe
    if (sampleRate < 4000) {
      // 4kHz minimum
      throw new Error(
        "Audio file sample rate is too low for accurate transcription. Minimum required is 4kHz."
      );
    }

    // Typical audio file duration limits
    const MAX_DURATION_SECONDS = 4 * 60 * 60; // 4 hours
    if (duration > MAX_DURATION_SECONDS) {
      throw new Error("Audio file duration exceeds maximum limit of 4 hours.");
    }

    // Check final sample count after upsampling to prevent memory issues
    const targetSampleRate = 16000;
    const upsampledSamples = duration * targetSampleRate;
    const MAX_SAMPLES = 230_400_000; // ~4 hours at 16kHz

    if (upsampledSamples > MAX_SAMPLES) {
      throw new Error("Audio file exceeds maximum allowed length.");
    }

    return true;
  }

  async #convertToWavAudioData(sourcePath) {
    try {
      let buffer;
      const wavefile = require("wavefile");
      const { FFMPEGWrapper } = require("./ffmpeg");
      const ffmpeg = new FFMPEGWrapper();
      const outFolder = path.resolve(__dirname, `../../storage/tmp`);
      if (!fs.existsSync(outFolder))
        fs.mkdirSync(outFolder, { recursive: true });

      const outputFile = path.resolve(outFolder, `${v4()}.wav`);
      const success = await ffmpeg.convertAudioToWav(sourcePath, outputFile);
      if (!success)
        throw new Error(
          "[Conversion Failed]: Could not convert file to .wav format!"
        );

      buffer = fs.readFileSync(outputFile);
      fs.rmSync(outputFile);

      const wavFile = new wavefile.WaveFile(buffer);
      try {
        this.#validateAudioFile(wavFile);
      } catch (error) {
        this.#log(`Audio validation failed: ${error.message}`);
        throw new Error(`Invalid audio file: ${error.message}`);
      }

      // Although we use ffmpeg to convert to the correct format (16k hz 32f),
      // different versions of ffmpeg produce different results based on the
      // environment. To ensure consistency, we convert to the correct format again.
      wavFile.toBitDepth("32f");
      wavFile.toSampleRate(16000);

      let audioData = wavFile.getSamples();
      if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
          const SCALING_FACTOR = Math.sqrt(2);

          // Merge channels into first channel to save memory
          for (let i = 0; i < audioData[0].length; ++i) {
            audioData[0][i] =
              (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
          }
        }
        audioData = audioData[0];
      }

      return audioData;
    } catch (error) {
      console.error(`convertToWavAudioData`, error);
      return null;
    }
  }

  async client() {
    if (!fs.existsSync(this.modelPath)) {
      this.#log(
        `The native whisper model has never been run and will be downloaded right now. Subsequent runs will be faster. (~${this.fileSize})`
      );
    }

    try {
      // Convert ESM to CommonJS via import so we can load this library.
      const pipeline = (...args) =>
        import("@xenova/transformers").then(({ pipeline }) => {
          return pipeline(...args);
        });
      return await pipeline("automatic-speech-recognition", this.model, {
        cache_dir: this.cacheDir,
        ...(!fs.existsSync(this.modelPath)
          ? {
              // Show download progress if we need to download any files
              progress_callback: (data) => {
                if (!data.hasOwnProperty("progress")) return;
                console.log(
                  `\x1b[34m[ONNXWhisper - Downloading Model Files]\x1b[0m ${
                    data.file
                  } ${~~data?.progress}%`
                );
              },
            }
          : {}),
      });
    } catch (error) {
      let errMsg = error.message;
      if (errMsg.includes("Could not locate file")) {
        errMsg =
          "The native whisper model failed to download from the huggingface.co CDN. Your internet connection may be unstable or blocked by Huggingface.co - you will need to download the model manually and place it in the storage/models folder to use local Whisper transcription.";
      }

      this.#log(
        `Failed to load the native whisper model: ${errMsg}`,
        error.stack
      );
      throw new Error(errMsg);
    }
  }

  async processFile(fullFilePath, filename) {
    try {
      const audioDataPromise = new Promise((resolve) =>
        this.#convertToWavAudioData(fullFilePath).then((audioData) =>
          resolve(audioData)
        )
      );
      const [audioData, transcriber] = await Promise.all([
        audioDataPromise,
        this.client(),
      ]);

      if (!audioData) {
        this.#log(`Failed to parse content from ${filename}.`);
        return {
          content: null,
          error: `Failed to parse content from ${filename}.`,
        };
      }

      this.#log(`Transcribing audio data to text...`);
      const { text } = await transcriber(audioData, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      return { content: text, error: null };
    } catch (error) {
      return { content: null, error: error.message };
    }
  }
}

module.exports = {
  LocalWhisper,
};

```

### Core Architecture Module: `collector/utils/comKey/index.js`
```
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const keyPath =
  process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, `../../../server/storage/comkey`)
    : path.resolve(
        process.env.STORAGE_DIR ??
          path.resolve(__dirname, `../../../server/storage`),
        `comkey`
      );

class CommunicationKey {
  #pubKeyName = "ipc-pub.pem";
  #storageLoc = keyPath;

  constructor() {}

  log(text, ...args) {
    console.log(`\x1b[36m[CommunicationKeyVerify]\x1b[0m ${text}`, ...args);
  }

  #readPublicKey() {
    return fs.readFileSync(path.resolve(this.#storageLoc, this.#pubKeyName));
  }

  // Given a signed payload from private key from /app/server/ this signature should
  // decode to match the textData provided. This class does verification only in collector.
  // Note: The textData is typically the JSON stringified body sent to the document processor API.
  verify(signature = "", textData = "") {
    try {
      let data = textData;
      if (typeof textData !== "string") data = JSON.stringify(data);
      return crypto.verify(
        "RSA-SHA256",
        Buffer.from(data),
        this.#readPublicKey(),
        Buffer.from(signature, "hex")
      );
    } catch {}
    return false;
  }

  // Use the rolling public-key to decrypt arbitrary data that was encrypted via the private key on the server side CommunicationKey class
  // that we know was done with the same key-pair and the given input is in base64 format already.
  // Returns plaintext string of the data that was encrypted.
  decrypt(base64String = "") {
    return crypto
      .publicDecrypt(this.#readPublicKey(), Buffer.from(base64String, "base64"))
      .toString();
  }
}

module.exports = { CommunicationKey };

```

### Core Architecture Module: `collector/utils/constants.js`
```
const WATCH_DIRECTORY = require("path").resolve(__dirname, "../hotdir");

const ACCEPTED_MIMES = {
  "text/plain": [".txt", ".md", ".org", ".adoc", ".rst"],
  "text/html": [".html"],
  "text/csv": [".csv"],
  "application/json": [".json"],
  // TODO: Create asDoc.js that works for standard MS Word files.
  // "application/msword": [".doc"],

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],

  "application/vnd.oasis.opendocument.text": [".odt"],
  "application/vnd.oasis.opendocument.presentation": [".odp"],

  "application/pdf": [".pdf"],
  "application/mbox": [".mbox"],

  "audio/wav": [".wav"],
  "audio/mpeg": [".mp3"],
  "audio/ogg": [".ogg", ".oga"],
  "audio/opus": [".opus"],
  "audio/mp4": [".m4a"],
  "audio/x-m4a": [".m4a"],
  "audio/webm": [".webm"],

  "video/mp4": [".mp4"],
  "video/mpeg": [".mpeg"],
  "application/epub+zip": [".epub"],
  "image/png": [".png"],
  "image/jpeg": [".jpg"],
  "image/jpg": [".jpg"],
  "image/webp": [".webp"],
};

const SUPPORTED_FILETYPE_CONVERTERS = {
  ".txt": "./convert/asTxt.js",
  ".md": "./convert/asTxt.js",
  ".org": "./convert/asTxt.js",
  ".adoc": "./convert/asTxt.js",
  ".rst": "./convert/asTxt.js",
  ".csv": "./convert/asTxt.js",
  ".json": "./convert/asTxt.js",

  ".html": "./convert/asTxt.js",
  ".pdf": "./convert/asPDF/index.js",

  ".docx": "./convert/asDocx.js",
  // TODO: Create asDoc.js that works for standard MS Word files.
  // ".doc": "./convert/asDoc.js",

  ".pptx": "./convert/asOfficeMime.js",

  ".odt": "./convert/asOfficeMime.js",
  ".odp": "./convert/asOfficeMime.js",

  ".xlsx": "./convert/asXlsx.js",

  ".mbox": "./convert/asMbox.js",

  ".epub": "./convert/asEPub.js",

  ".mp3": "./convert/asAudio.js",
  ".wav": "./convert/asAudio.js",
  ".mp4": "./convert/asAudio.js",
  ".mpeg": "./convert/asAudio.js",
  ".ogg": "./convert/asAudio.js",
  ".oga": "./convert/asAudio.js",
  ".opus": "./convert/asAudio.js",
  ".m4a": "./convert/asAudio.js",
  ".webm": "./convert/asAudio.js",

  ".png": "./convert/asImage.js",
  ".jpg": "./convert/asImage.js",
  ".jpeg": "./convert/asImage.js",
  ".webp": "./convert/asImage.js",
};

module.exports = {
  SUPPORTED_FILETYPE_CONVERTERS,
  WATCH_DIRECTORY,
  ACCEPTED_MIMES,
};

```

### Core Architecture Module: `collector/utils/downloadURIToFile/index.js`
```
const { WATCH_DIRECTORY, ACCEPTED_MIMES } = require("../constants");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { validURL } = require("../url");
const { default: slugify } = require("slugify");

// Add a custom slugify extension for slashing to handle URLs with paths.
slugify.extend({ "/": "-" });

/**
 * Maps a MIME type to the preferred file extension using ACCEPTED_MIMES.
 * Returns null if the MIME type is not recognized or if there are no possible extensions.
 * @param {string} mimeType - The MIME type to resolve (e.g., "application/pdf")
 * @returns {string|null} - The file extension (e.g., ".pdf") or null
 */
function mimeToExtension(mimeType) {
  if (!mimeType || !ACCEPTED_MIMES.hasOwnProperty(mimeType)) return null;
  const possibleExtensions = ACCEPTED_MIMES[mimeType] ?? [];
  if (possibleExtensions.length === 0) return null;
  return possibleExtensions[0];
}

/**
 * Download a file to the hotdir
 * @param {string} url - The URL of the file to download
 * @param {number} maxTimeout - The maximum timeout in milliseconds
 * @returns {Promise<{success: boolean, fileLocation: string|null, reason: string|null}>} - The path to the downloaded file
 */
async function downloadURIToFile(url, maxTimeout = 10_000) {
  if (!url || typeof url !== "string" || !validURL(url))
    return { success: false, reason: "Not a valid URL.", fileLocation: null };

  try {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
      console.error(
        `Timeout ${maxTimeout}ms reached while downloading file for URL:`,
        url.toString()
      );
    }, maxTimeout);

    const res = await fetch(url, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res;
      })
      .finally(() => clearTimeout(timeout));

    const urlObj = new URL(url);
    const sluggedPath = slugify(urlObj.pathname, { lower: true });
    let filename = `${urlObj.hostname}-${sluggedPath}`;

    const existingExt = path.extname(filename).toLowerCase();
    const { SUPPORTED_FILETYPE_CONVERTERS } = require("../constants");

    // If the filename does not already have a supported file extension,
    // try to infer one from the response Content-Type header.
    // This handles URLs like https://arxiv.org/pdf/2307.10265 where the
    // path has no explicit extension but the server responds with
    // Content-Type: application/pdf.
    if (!SUPPORTED_FILETYPE_CONVERTERS.hasOwnProperty(existingExt)) {
      const { parseContentType } = require("../../processLink/helpers");
      const contentType = parseContentType(res.headers.get("Content-Type"));
      const inferredExt = mimeToExtension(contentType);
      if (inferredExt) {
        console.log(
          `[Collector] URL path has no recognized extension. Inferred ${inferredExt} from Content-Type: ${contentType}`
        );
        filename += inferredExt;
      }
    }

    const localFilePath = path.join(WATCH_DIRECTORY, filename);
    const writeStream = fs.createWriteStream(localFilePath);
    await pipeline(res.body, writeStream);

    console.log(`[SUCCESS]: File ${localFilePath} downloaded to hotdir.`);
    return { success: true, fileLocation: localFilePath, reason: null };
  } catch (error) {
    console.error(`Error writing to hotdir: ${error} for URL: ${url}`);
    return { success: false, reason: error.message, fileLocation: null };
  }
}

module.exports = {
  downloadURIToFile,
  mimeToExtension,
};

```

### Core Architecture Module: `collector/utils/extensions/Confluence/ConfluenceLoader/index.js`
```
/*
 * This is a custom implementation of the Confluence langchain loader. There was an issue where
 * code blocks were not being extracted. This is a temporary fix until this issue is resolved.*/

const { htmlToText } = require("html-to-text");

class ConfluencePagesLoader {
  constructor({
    baseUrl,
    spaceKey,
    username,
    accessToken,
    limit = 25,
    expand = "body.storage,version",
    personalAccessToken,
    cloud = true,
    bypassSSL = false,
  }) {
    this.baseUrl = baseUrl;
    this.spaceKey = spaceKey;
    this.username = username;
    this.accessToken = accessToken;
    this.limit = limit;
    this.expand = expand;
    this.personalAccessToken = personalAccessToken;
    this.cloud = cloud;
    this.bypassSSL = bypassSSL;
    this.log("Initialized Confluence Loader");
    if (this.bypassSSL)
      this.log("!!SSL bypass is enabled!! Use at your own risk!!");
  }

  log(message, ...args) {
    console.log(`\x1b[36m[Confluence Loader]\x1b[0m ${message}`, ...args);
  }

  get authorizationHeader() {
    if (this.personalAccessToken) {
      return `Bearer ${this.personalAccessToken}`;
    } else if (this.username && this.accessToken) {
      const authToken = Buffer.from(
        `${this.username}:${this.accessToken}`
      ).toString("base64");
      return `Basic ${authToken}`;
    }
    return undefined;
  }

  async load(options) {
    try {
      const pages = await this.fetchAllPagesInSpace(
        options?.start,
        options?.limit
      );
      return pages.map((page) => this.createDocumentFromPage(page));
    } catch (error) {
      this.log("Error:", error);
      return [];
    }
  }

  async fetchConfluenceData(url) {
    try {
      const initialHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const authHeader = this.authorizationHeader;
      if (authHeader) initialHeaders.Authorization = authHeader;

      // If SSL bypass is enabled, set the NODE_TLS_REJECT_UNAUTHORIZED environment variable
      if (this.bypassSSL) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      const response = await fetch(url, { headers: initialHeaders });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${url} from Confluence: ${response.status}`
        );
      }
      return await response.json();
    } catch (error) {
      this.log("Error:", error);
      throw new Error(error.message);
    } finally {
      if (this.bypassSSL) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    }
  }

  // https://developer.atlassian.com/cloud/confluence/rest/v2/intro/#auth
  async fetchAllPagesInSpace(start = 0, limit = this.limit) {
    const url = `${this.baseUrl}${
      this.cloud ? "/wiki" : ""
    }/rest/api/content?spaceKey=${
      this.spaceKey
    }&limit=${limit}&start=${start}&expand=${this.expand}`;
    const data = await this.fetchConfluenceData(url);
    if (data.size === 0) {
      return [];
    }
    const nextPageStart = start + data.size;
    const nextPageResults = await this.fetchAllPagesInSpace(
      nextPageStart,
      limit
    );
    return data.results.concat(nextPageResults);
  }

  createDocumentFromPage(page) {
    // Function to extract code blocks
    const extractCodeBlocks = (content) => {
      const codeBlockRegex =
        /<ac:structured-macro[^>]*\sac:name="code"[^>]*>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/g;
      const languageRegex =
        /<ac:parameter ac:name="language">(.*?)<\/ac:parameter>/;

      return content.replace(codeBlockRegex, (match) => {
        const language = match.match(languageRegex)?.[1] || "";
        const code =
          match.match(
            /<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/
          )?.[1] || "";
        return `\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n`;
      });
    };

    const contentWithCodeBlocks = extractCodeBlocks(page.body.storage.value);
    const plainTextContent = htmlToText(contentWithCodeBlocks, {
      wordwrap: false,
      preserveNewlines: true,
    });
    const textWithPreservedStructure = plainTextContent.replace(
      /\n{3,}/g,
      "\n\n"
    );
    const pageUrl = `${this.baseUrl}${this.cloud ? "/wiki" : ""}/spaces/${
      this.spaceKey
    }/pages/${page.id}`;

    return {
      pageContent: textWithPreservedStructure,
      metadata: {
        id: page.id,
        status: page.status,
        title: page.title,
        type: page.type,
        url: pageUrl,
        version: page.version?.number,
        updated_by: page.version?.by?.displayName,
        updated_at: page.version?.when,
      },
    };
  }
}

module.exports = { ConfluencePagesLoader };

```

### Core Architecture Module: `collector/utils/extensions/Confluence/index.js`
```
const fs = require("fs");
const path = require("path");
const { default: slugify } = require("slugify");
const { v4 } = require("uuid");
const { writeToServerDocuments, sanitizeFileName } = require("../../files");
const { tokenizeString } = require("../../tokenizer");
const { ConfluencePagesLoader } = require("./ConfluenceLoader");

/**
 * Load Confluence documents from a spaceID and Confluence credentials
 * @param {object} args - forwarded request body params
 * @param {import("../../../middleware/setDataSigner").ResponseWithSigner} response - Express response object with encryptionWorker
 * @returns
 */
async function loadConfluence(
  {
    baseUrl = null,
    spaceKey = null,
    username = null,
    accessToken = null,
    cloud = true,
    personalAccessToken = null,
    bypassSSL = false,
  },
  response
) {
  if (!personalAccessToken && (!username || !accessToken)) {
    return {
      success: false,
      reason:
        "You need either a personal access token (PAT), or a username and access token to use the Confluence connector.",
    };
  }

  if (!baseUrl || !validBaseUrl(baseUrl)) {
    return {
      success: false,
      reason: "Provided base URL is not a valid URL.",
    };
  }

  if (!spaceKey) {
    return {
      success: false,
      reason: "You need to provide a Confluence space key.",
    };
  }

  const normalizedBaseUrl = resolveConfluenceBaseUrl(baseUrl, cloud);
  const { hostname } = new URL(normalizedBaseUrl);
  console.log(`-- Working Confluence ${normalizedBaseUrl} --`);
  const loader = new ConfluencePagesLoader({
    baseUrl: normalizedBaseUrl,
    spaceKey,
    username,
    accessToken,
    cloud,
    personalAccessToken,
    bypassSSL,
  });

  const { docs, error } = await loader
    .load()
    .then((docs) => {
      return { docs, error: null };
    })
    .catch((e) => {
      return {
        docs: [],
        error: e.message?.split("Error:")?.[1] || e.message,
      };
    });

  if (!docs.length || !!error) {
    return {
      success: false,
      reason: error ?? "No pages found for that Confluence space.",
    };
  }
  const outFolder = slugify(
    `confluence-${hostname}-${v4().slice(0, 4)}`
  ).toLowerCase();

  const outFolderPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(
          __dirname,
          `../../../../server/storage/documents/${outFolder}`
        )
      : path.resolve(process.env.STORAGE_DIR, `documents/${outFolder}`);

  if (!fs.existsSync(outFolderPath))
    fs.mkdirSync(outFolderPath, { recursive: true });

  docs.forEach((doc) => {
    if (!doc.pageContent) return;

    const data = {
      id: v4(),
      url: doc.metadata.url + ".page",
      title: doc.metadata.title || doc.metadata.source,
      docAuthor: normalizedBaseUrl,
      description: doc.metadata.title,
      docSource: `${normalizedBaseUrl} Confluence`,
      chunkSource: generateChunkSource(
        {
          doc,
          baseUrl: normalizedBaseUrl,
          spaceKey,
          accessToken,
          username,
          personalAccessToken,
          cloud,
          bypassSSL,
        },
        response.locals.encryptionWorker
      ),
      published: new Date().toLocaleString(),
      wordCount: doc.pageContent.split(" ").length,
      pageContent: doc.pageContent,
      token_count_estimate: tokenizeString(doc.pageContent),
    };

    console.log(
      `[Confluence Loader]: Saving ${doc.metadata.title} to ${outFolder}`
    );

    const fileName = sanitizeFileName(
      `${slugify(doc.metadata.title)}-${data.id}`
    );
    writeToServerDocuments({
      data,
      filename: fileName,
      destinationOverride: outFolderPath,
    });
  });

  return {
    success: true,
    reason: null,
    data: {
      spaceKey,
      destination: outFolder,
    },
  };
}

/**
 * Gets the page content from a specific Confluence page, not all pages in a workspace.
 * @returns
 */
async function fetchConfluencePage({
  pageUrl,
  baseUrl,
  spaceKey,
  username,
  accessToken,
  personalAccessToken = null,
  cloud = true,
  bypassSSL = false,
}) {
  if (
    !pageUrl ||
    !baseUrl ||
    !spaceKey ||
    (!personalAccessToken && (!username || !accessToken))
  ) {
    return {
      success: false,
      content: null,
      reason:
        "You need either a username and access token, or a personal access token (PAT), to use the Confluence connector.",
    };
  }

  if (!validBaseUrl(baseUrl)) {
    return {
      success: false,
      content: null,
      reason: "Provided base URL is not a valid URL.",
    };
  }

  if (!spaceKey) {
    return {
      success: false,
      content: null,
      reason: "You need to provide a Confluence space key.",
    };
  }

  console.log(`-- Working Confluence Page ${pageUrl} --`);
  const normalizedBaseUrl = resolveConfluenceBaseUrl(baseUrl, cloud);
  const loader = new ConfluencePagesLoader({
    baseUrl: normalizedBaseUrl,
    spaceKey,
    username,
    accessToken,
    cloud,
    personalAccessToken,
    bypassSSL,
  });

  const { docs, error } = await loader
    .load()
    .then((docs) => {
      return { docs, error: null };
    })
    .catch((e) => {
      return {
        docs: [],
        error: e.message?.split("Error:")?.[1] || e.message,
      };
    });

  if (!docs.length || !!error) {
    return {
      success: false,
      reason: error ?? "No pages found for that Confluence space.",
      content: null,
    };
  }

  const targetDocument = docs.find(
    (doc) => doc.pageContent && doc.metadata.url === pageUrl
  );
  if (!targetDocument) {
    return {
      success: false,
      reason: "Target page could not be found in Confluence space.",
      content: null,
    };
  }

  return {
    success: true,
    reason: null,
    content: targetDocument.pageContent,
  };
}

/**
 * Validates if the provided baseUrl is a valid URL at all.
 * @param {string} baseUrl
 * @returns {boolean}
 */
function validBaseUrl(baseUrl) {
  try {
    new URL(baseUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the Confluence base URL, preserving context paths for self-hosted deployments.
 * @param {string} baseUrl
 * @param {boolean} cloud
 * @returns {string}
 */
function resolveConfluenceBaseUrl(baseUrl, cloud = true) {
  const url = new URL(baseUrl);
  // Cloud URLs use just the origin; self-hosted may have a context path like /confluence
  if (cloud) return url.origin;

  const contextPath = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${contextPath}`;
}

/**
 * Generate the full chunkSource for a specific Confluence page so that we can resync it later.
 * This data is encrypted into a single `payload` query param so we can replay credentials later
 * since this was encrypted with the systems persistent password and salt.
 * @param {object} chunkSourceInformation
 * @param {import("../../EncryptionWorker").EncryptionWorker} encryptionWorker
 * @returns {string}
 */
function generateChunkSource(
  {
    doc,
    baseUrl,
    spaceKey,
    accessToken,
    username,
    personalAccessToken,
    cloud,
    bypassSSL,
  },
  encryptionWorker
) {
  // Store only the credential in use. An unset key would expand to the string
  // "null" and be replayed as a real credential.
  const payload = {
    baseUrl,
    spaceKey,
    cloud,
    bypassSSL,
    ...(personalAccessToken
      ? { personalAccessToken }
      : { token: accessToken, username }),
  };
  return `confluence://${doc.metadata.url}?payload=${encryptionWorker.encrypt(
    JSON.stringify(payload)
  )}`;
}

module.exports = {
  loadConfluence,
  fetchConfluencePage,
  resolveConfluenceBaseUrl,
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6492** (2026-09-25): **Malformed agent WebSocket frame crashes the server**
  *Symptoms*: Reported by @SounLabs via GHSA-2859-x4rv-jpw7. We're tracking and fixing it as a bug here.  ### What happens  A malformed frame sent over the agent WebSocket (`/agent-invocation/:uuid`) can crash the server process.  - `handleFeedback` in `server/utils/agents/aibitat/plugins/websocket.js` parses frames with a bare `JSON.parse` inside an `async` function. `relayToSocket` in `server/endpoints/agentWebsocket.js` never awaits or catches the returned promise. A frame like `{bad`, an empty frame or `null`, sent while the agent is waiting for feedback, becomes an unhandled rejection and Node exits. - A related path: the `ws` library delivers binary frames as a `Buffer`, and `safeJsonParse` throws a `TypeError` on a `Buffer` it can't parse. `handleToolToggle` runs on every frame, so a malformed binary frame crashes the process at any point in an agent session, not only while it's waiting for feedback.  Triggering either path requires an authenticated user with an active agent session.  ### Fix  - Use `safeJsonParse` in `handleFeedback` and return early when the input doesn't parse or isn't a feedback message. - Convert every incoming frame to a string in `relayToSocket` before it reaches any handler.  Thanks to @SounLabs for the report and the detailed reproduction. 

- **Issue #6153** (2026-08-21): **[BUG]: Gemini agent chat fails with "The agent model failed to respond: Connection error."**
  *Symptoms*: ### How are you running AnythingLLM?  AnythingLLM desktop app  ### What happened?  When using Google Gemini as the workspace agent provider (reproduced with gemini-3.1-pro, gemini-3.6-flash, and gemini-3.7-flash), sending an `@agent` chat or triggering automatic tool execution fails immediately on the initial turn with:  ``` The agent model failed to respond: Connection error. ```  Debug Log & Stack Trace: ``` [backend] info: [TELEMETRY SENT] {"event":"workspace_thread_created","distinctId":"00a4f226-5e70-4476-810c-4655db05dff5","properties":{"multiUserMode":false,"LLMSelection":"gemini","Embedder":"gemini","VectorDbSelection":"lancedb","TTSSelection":"native","LLMModel":"gemini-3.6-flash"}} [backend] info: [Event Logged] - workspace_thread_created [backend] info: [TELEMETRY SENT] {"event":"sent_chat","distinctId":"00a4f226-5e70-4476-810c-4655db05dff5","properties":{"multiUserMode":false,"LLMSelection":"gemini","Embedder":"gemini","VectorDbSelection":"lancedb","multiModal":false,"TTSSelection":"native","LLMModel":"gemini-3.6-flash"}} [backend] info: [Event Logged] - sent_chat [46248:0816/214058.207:ERROR:ffmpeg_common.cc(959)] Unsupported pixel format: -1 [backend] info: [AgentHandler] Start 0a927b8e-94b9-430a-bfd3-53160640d452::gemini:gemini-3.6-flash [backend] info: [TELEMETRY SENT] {"event":"agent_chat_started","distinctId":"00a4f226-5e70-4476-810c-4655db05dff5","properties":{}} [backend] info: [AgentHandler] Attached websocket plugin to Agent cluster [backend] info: [Agen
  **Post-Mortem & Fix Analysis**:
  > Confirmed + got a patch in desktop. The base reason was an unpinned sub-dep `undici` which should be pinned to v6, but resolved to v7 - this is the only only that was not pinned so of course it caused this problem!  This was because the OpenAI SDK client was throwing when `content-length` was applied. Going to to an in-release bump. When it is live I will post here and update change log. It would be `1.16.0-r2`
  > unsure if duplicate of this issue or not   i have had a similar issue when using file system access tool in the docker version (v 1.16.0) and qwen3.8 running on llama.cpp with localai selected as llm provider. i cannot reliably reproduce the issue. some times the agent would successfully retrieve the file, but other times it would fail citing a connection error (without actually being disconnected - sent a test message immediately after and got a response)  of the many times this error occurred, most of them were during file system access or very rarely a rag search with no results.  this is the docker log ``` anythingllm  | [backend] error: Connection error. Error: Connection error. anythingllm  |     at OpenAI.makeRequest (/app/server/node_modules/openai/core.js:332:19) anythingllm  |     at process.processTicksAndRejections (node:internal/process/task_queues:95:5) anythingllm  |     at async tooledStream (/app/server/utils/agents/aibitat/providers/helpers/tooled.js:191:18) anythingl
  > This is due to a bug we have already patched in desktop. it is specific to desktop and additionally specific to **only** Gemini due to how  undici was resolved during build. Will be patched in next release going out this week

- **Issue #5990** (2026-07-10): **Workspace update fails with Unknown argument router_id (v1.13.0–v1.15.0, Intel Mac)**
  *Symptoms*: **Reproducible on:** v1.13.0, v1.14.1, v1.15.0 (Desktop, Intel/x64 macOS) **NOT reproducible on:** v1.12.1 (Desktop, Intel/x64 macOS) — last version before Model Router **NOT reproducible on:** v1.15.0 (Desktop, Apple Silicon/arm64 macOS) — same version, different architecture  ### What happened? Any "Update Workspace" action fails, regardless of which field is actually being changed (system prompt, chat model, chat provider, etc.). The full workspace object is always sent on save, and it always includes `router_id`, which Prisma rejects as an unknown argument.  ### Error message  Error: Invalid prisma.workspaces.update() invocation: { where: { id: 4 }, data: { chatProvider: "ollama", chatModel: "gpt-oss:latest", chatMode: "chat", openAiHistory: 20, openAiPrompt: "...", queryRefusalResponse: "...", openAiTemp: 0.7, router_id: null, ~~~~~~~~~ ? name?: String | StringFieldUpdateOperationsInput, ? slug?: String | StringFieldUpdateOperationsInput, ... } Unknown argument router_id.   ### Steps to reproduce 1. Open any existing workspace's settings. 2. Change any single field (e.g. system prompt). 3. Click "Update Workspace". 4. Error appears, save fails.  ### Notes - The `router_id` column already exists in the local SQLite `workspaces` table (confirmed via direct sqlite3 inspection), so this isn't a missing migration — it looks like a mismatch between the field name used in the update payload (`router_id`) and what the compiled Prisma Client actually expects (possibly `routerId`)
  **Post-Mortem & Fix Analysis**:
  > I am on my intel mac, download 1.15.0 - no issues updating workspace. Fully deleted everything, downloaded 1.14.2 - onboarded fully, made workspace, adjusted settings - no issues, quit.  Installed 1.15.0, went to same workspace, edited settings and saved - no issues.  This issue is not explicitly clear but I presume this error is coming from the UI, not using the developer API? As it stands I cannot replicate this so a bit at a loss. You dont have like anythingLLM Desktop and docker running on the same machine or anything - or like an orphaned anythingllm app also running on the same machine?

- **Issue #5817** (2026-06-15): **[BUG]: High CPU usage when opening very long conversation**
  *Symptoms*: ### How are you running AnythingLLM?  Windows Desktop App  ### What happened?  Opening one specific very long conversation causes CPU usage to spike to around 96%. Other conversations in the same workspace remain around 5–10% CPU usage.  Observations:  Workspace contains approximately 530 vectors. CPU usage appears to correlate with conversation length rather than vector count. Switching away from the long conversation immediately reduces CPU usage. The issue occurs consistently and is reproducible.  Expected behavior: Opening a long conversation should not cause excessive CPU usage.  Actual behavior: CPU usage spikes to approximately 96% when the long conversation is opened.  Environment:  AnythingLLM version: [v1.13.0] Browser: [Chrome 148.0.7778.217] OS: [Windows 11] CPU: [AMD Ryzen AI 9 HX 370 w/ Radeon 890M]  ### Are there known steps to reproduce?  Steps to reproduce:  1. Open a workspace containing approximately 530 vectors. 2. Open a very long conversation with a large chat history. 3. Observe CPU usage in Task Manager. 4. Switch to a shorter conversation in the same workspace. 5. Compare CPU usage.  Result: CPU usage rises to approximately 96% when the long conversation is open and drops back to around 5–10% when switching to a shorter conversation.  Additional note: The issue appears to be related to conversation length rather than the number of vectors in the workspace.   ### LLM Provider & Model (if applicable)  Ollama / gemma4:31b  ### Embedder Provider & Model (
  **Post-Mortem & Fix Analysis**:
  > Additional finding:  CPU usage drops immediately from ~96% to ~4% when minimizing the browser window.  This strongly suggests a frontend rendering issue (likely continuous re-rendering of the long chat history while the tab is active).  The issue appears to be UI/rendering related rather than model, embedding, or vector search related.
  > @Bennowan did you get this on 1.14.0 as well? We updated the Ui client there and it should not be present but it would be nice to know if it is still there. BTW I am NOT getting this on any windows or mac device I have - CPU stays entirely flat.
  > Yes, I can still reproduce the issue on 1.14.0.  A few additional observations:  * Reinstalling AnythingLLM and clearing caches did not change the behavior. * CPU usage rises to around 96% when opening this specific conversation and immediately drops to around 4% when minimizing the window. * Ollama is running on a separate host and is accessed through port forwarding. The high CPU usage is occurring on the AnythingLLM client machine, not on the machine running the model. * This particular conversation is extremely large. I use it heavily, frequently upload files, and the conversation has grown over a long period of time with many very long responses.  It is possible that the issue only becomes visible once a conversation reaches a certain size. 

- **Issue #5797** (2026-06-11): **[BUG]: Uploading image clears text input field**
  *Symptoms*: ### How are you running AnythingLLM?  Docker (local)  ### What happened?  Writing a prompt then uploading image deletes the prompt  ### Are there known steps to reproduce?  _No response_  ### LLM Provider & Model (if applicable)  _No response_  ### Embedder Provider & Model (if applicable)  _No response_
  **Post-Mortem & Fix Analysis**:
  > I am also experiencing this issue on Windows 11 25H2. For me it has been happening with PDF files as well, although it isn't completely consistent and will occasionally not clear the text input field. I'll keep my eye on it to see if there's a consistent way to replicate it.
  > Fixed in desktop, will be in next patch

- **Issue #5714** (2026-05-27): **[BUG]: Wayland global shortcuts fail on KDE Plasma with Electron 31 (works under XWayland)**
  *Symptoms*: ### How are you running AnythingLLM?  Normally:  AppImage launched directly under KDE Plasma 6 Wayland.  Tested launch commands:  Native Wayland (fails to register global shortcuts): ./AnythingLLMDesktop.AppImage --enable-features=UseOzonePlatform,GlobalShortcutsPortal --ozone-platform=wayland  XWayland (global shortcuts work correctly): ./AnythingLLMDesktop.AppImage --ozone-platform=x11  Desktop file: Exec=./AnythingLLMDesktop.AppImage  ### What happened?  Environment:  * KDE Plasma 6 * Wayland session * Ubuntu Questing * AnythingLLM Desktop AppImage * Electron 31.7.7 (bundled)  Observed behavior:  * Desktop Assistant global shortcut fails to register for every Ctrl+key. * UI always reports:   "Failed to register Ctrl+<key>. It may conflict with another shortcut."  Verified:  * KDE global shortcuts work normally. * 1Password KDE global shortcut works. * Discord global shortcuts work under Electron 37.6.0. * No conflicting KDE shortcut exists. * AnythingLLM creates no KDE kglobalaccel component when registration fails. * AnythingLLM creates no GlobalShortcuts portal session. * AnythingLLM source code uses Electron globalShortcut.register().  Critical test:  * Launching AnythingLLM with:   --ozone-platform=x11   makes global shortcuts work immediately.  Conclusion:  * Failure appears specific to native Wayland + Electron 31 globalShortcut handling. * XWayland is a functional workaround.   ### Are there known steps to reproduce?  Steps to reproduce:  1. Run KDE Plasma 6 under a
  **Post-Mortem & Fix Analysis**:
  > This is unfortunately correct - it is due to a current limitation of Electrons GlobalShortcutRegister on Linux Related: #5150 #5155  Super annoying and the fix would only cover Wayland and nobody else :/
  > Thanks, that makes sense.  For what it’s worth, launching the AppImage with:  ./AnythingLLMDesktop.AppImage --ozone-platform=x11  does make the shortcut registration work on my KDE/Wayland system, so XWayland is a usable workaround for now.  I’ll stick with that unless/until Electron’s Linux global shortcut behavior improves. Closing this since it's a duplicate. 

- **Issue #5688** (2026-05-23): **[BUG]: APP Integrations in multi-user mode**
  *Symptoms*: ### Description  Hi, not sure if i missed something in the docs, are the app integrations availible in mult-user mode>, they are gone from the main admin menu and can't seem to find where to manage the settings.  in the chat window, under tools you can enable/disable them, but nowhere to config?:  <img width="623" height="526" alt="Image" src="https://github.com/user-attachments/assets/627a6576-6bd5-46b4-9c1d-287d1b54091c" />  <img width="473" height="157" alt="Image" src="https://github.com/user-attachments/assets/b679ec5a-3ed8-4f6f-83b6-9ff625daebc0" />  this is under admin account.. we flipped over to multi-user for the username/pwd security level rrather than just a pwd, we are not using for multi users in that sense. not sure if the admin will be availble under an actual user account. - i would assume this is the case as these would have to be at the user level  thanks
  **Post-Mortem & Fix Analysis**:
  > Ah then that is a bug, you cannot use those integrations in MuM mode right now because basically who gets to configured them? like what email would it look at since anyone could then send requests to it.  This is simply UI though, if you tried to call the tool it would still fail.

- **Issue #5603** (2026-06-02): **[BUG]:  LMStudio Agent loop socket timeout**
  *Symptoms*: ### How are you running AnythingLLM?  AnythingLLM desktop app  ### What happened?  <img width="4000" height="1800" alt="Image" src="https://github.com/user-attachments/assets/d190f5db-11fb-4b98-9923-fbd0a62b0146" />  ### Are there known steps to reproduce?  I am experiencing a recurring issue while using the AnythingLLM Desktop application with Agent Skills enabled. Specifically, I triggered an agent task that required the model to read and process my local files using the file system tool. The dataset contains approximately 1,600 files, so it is expected that the model would take a considerable amount of time to process and analyze the data.  During execution, the model begins processing normally and reaches approximately 11% progress. However, at this stage, a Socket Timeout error occurs in AnythingLLM. When I checked the LM Studio local server logs, I found the message: “client disconnected”.  It appears that AnythingLLM is not maintaining the connection long enough for the local model to complete its processing. As a result, the model is forcibly disconnected before it is able to return a response. This behavior interrupts the execution of long-running agent tasks, even though the model (Qwen 3.5-9B) is still actively processing in LM Studio.  This issue occurs specifically during heavy Agent Skill operations such as large-scale file reading and RAG-based workflows. Normal chat interactions without Agent Skills do not seem to trigger this problem.  I kindly request the de
  **Post-Mortem & Fix Analysis**:
  > This is because the [LMStudio Agent OAIClient](https://github.com/Mintplex-Labs/anything-llm/blob/5313-feat-model-router/server/utils/agents/aibitat/providers/lmstudio.js#L29-L33) needs a longer fetch.  This will then be extended to all others so we can solve it beyond just LMS
  > Was this supposed to be closed? I've been watching this from afar since this behavior occurs quite often with large prompts or several images on devices running large MoE models that force layers off to CPU with limited vram. I didn't notice any updates and I don't see a new version tag or anything.
  > Reopening this issue.  First, I would like to sincerely apologize to all users and the Anything LLM developers. The issue was closed unintentionally on my part, and I did not mean to close it.  On the contrary, I believe this issue is important and should be addressed as soon as possible, as it can negatively impact the productivity and reliability of Local AI workflows. I fully support the users who are experiencing this problem and appreciate everyone who has taken the time to provide feedback and share their experiences.  I would also like to thank the developers for their hard work and ongoing efforts to improve Anything LLM . Your work is greatly appreciated by the community.  I kindly hope the development team can investigate and resolve this issue, as it appears to continue affecting some users in real-world scenarios.  Thank you all for your understanding, and once again, I apologize for the accidental closure of this issue.  Best regards.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `ead123f0` (2026-10-05)
**Commit Message**: fix: finalize stopped scheduled job runs on Windows (#6637)

* fix: finalize stopped scheduled job runs on Windows

* chore: drop mock-heavy test and formatting churn, clarify exit comment

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `server/endpoints/scheduledJobs.js` (modified, +3/-2)
```diff
@@ -100,8 +100,9 @@ function scheduledJobEndpoints(app) {
             });
           }
 
-          const killed = backgroundService.killRun(run.jobId, run.id);
-          if (!killed) await ScheduledJobRun.kill(run.id);
+          backgroundService.killRun(run.jobId, run.id);
+          // Windows terminates workers without running their SIGTERM handler.
+          await ScheduledJobRun.kill(run.id);
           return response.status(200).json({ success: true });
         }
       } catch {
```

**File**: `server/models/scheduledJobRun.js` (modified, +8/-3)
```diff
@@ -117,15 +117,20 @@ const ScheduledJobRun = {
 
   complete: async function (id, { result } = {}) {
     try {
-      const run = await prisma.scheduled_job_runs.update({
-        where: { id: Number(id) },
+      // A cancellation in the parent may win the race with this worker.
+      const updated = await prisma.scheduled_job_runs.updateMany({
+        where: {
+          id: Number(id),
+          status: { in: this.nonTerminalStatuses },
+        },
         data: {
           status: this.statuses.completed,
           result: typeof result === "string" ? result : JSON.stringify(result),
           completedAt: new Date(),
         },
       });
-      return run;
+      if (updated.count === 0) return null;
+      return await this.get({ id: Number(id) });
     } catch (error) {
       console.error("Failed to complete scheduled job run:", error.message);
       return null;
```

**File**: `server/utils/BackgroundWorkers/index.js` (modified, +8/-3)
```diff
@@ -412,9 +412,14 @@ class BackgroundService {
     try {
       worker.send({ jobId, runId });
       await new Promise((resolve, reject) => {
-        worker.on("exit", (code, signal) => {
-          // SIGTERM is sent by removeScheduledJob when the job is deleted
-          // mid-run; treat that as a normal exit rather than a worker failure.
+        worker.on("exit", async (code, signal) => {
+          // SIGTERM is sent by killRun/removeScheduledJob and is a normal exit.
+          // Windows terminates the child without running its SIGTERM handler,
+          // so finalize the run here. kill() only updates non-terminal rows.
+          if (signal === "SIGTERM") {
+            const { ScheduledJobRun } = require("../../models/scheduledJobRun");
+            await ScheduledJobRun.kill(runId);
+          }
           if (code === 0 || code == null || signal === "SIGTERM") {
             resolve();
           } else {
```

---

### Incident Patch 2: `42832eb8` (2026-10-05)
**Commit Message**: fix: isolate chat attachment state and uploads by conversation (#6635)

* fix: isolate chat attachments by conversation

* chore: remove standalone attachment test and its dev dependencies

* chore: drop no-op unmount guards and formatting churn

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/index.jsx` (modified, +26/-4)
```diff
@@ -1,4 +1,4 @@
-import { useState, useEffect, createContext, useContext } from "react";
+import { useState, useEffect, useRef, createContext, useContext } from "react";
 import { v4 } from "uuid";
 import System from "@/models/system";
 import { useDropzone } from "react-dropzone";
@@ -45,6 +45,20 @@ export function DnDFileUploaderProvider({
   threadSlug = null,
   children,
 }) {
+  // Attachment state and event listeners belong to one conversation.
+  return (
+    <DnDFileUploader
+      key={`${workspace.slug}:${threadSlug ?? "default"}`}
+      workspace={workspace}
+      threadSlug={threadSlug}
+    >
+      {children}
+    </DnDFileUploader>
+  );
+}
+
+function DnDFileUploader({ workspace, threadSlug, children }) {
+  const mountedRef = useRef(true);
   const [files, setFiles] = useState([]);
   const [ready, setReady] = useState(false);
   const [dragging, setDragging] = useState(false);
@@ -60,6 +74,7 @@ export function DnDFileUploaderProvider({
   }, []);
 
   useEffect(() => {
+    mountedRef.current = true;
     window.addEventListener(REMOVE_ATTACHMENT_EVENT, handleRemove);
     window.addEventListener(CLEAR_ATTACHMENTS_EVENT, resetAttachments);
     window.addEventListener(PASTE_ATTACHMENT_EVENT, handlePastedAttachment);
@@ -69,6 +84,8 @@ export function DnDFileUploaderProvider({
     );
 
     return () => {
+      // In-flight uploads must not dispatch events to the next conversation.
+      mountedRef.current = false;
       window.removeEventListener(REMOVE_ATTACHMENT_EVENT, handleRemove);
       window.removeEventListener(CLEAR_ATTACHMENTS_EVENT, resetAttachments);
       window.removeEventListener(
@@ -215,11 +232,13 @@ export function DnDFileUploaderProvider({
    * @param {Attachment[]} newAttachments
    */
   async function embedEligibleAttachments(newAttachments = []) {
+    if (!mountedRef.current) return;
     window.dispatchEvent(new CustomEvent(ATTACHMENTS_PROCESSING_EVENT));
     const promises = [];
 
     const { currentContextTokenCount, contextWindow } =
       await Workspace.getParsedFiles(workspace.slug, threadSlug);
+    if (!mountedRef.current) return;
     const workspaceContextWindow = contextWindow
       ? Math.floor(contextWindow * Workspace.maxContextWindowLimit)
       : Number.POSITIVE_INFINITY;
@@ -301,9 +320,10 @@ export function DnDFileUploaderProvider({
     }
 
     // Wait for all promises to resolve in some way before dispatching the event to unlock the send button
-    Promise.all(promises).finally(() =>
-      window.dispatchEvent(new CustomEvent(ATTACHMENTS_PROCESSED_EVENT))
-    );
+    Promise.all(promises).finally(() => {
+      if (mountedRef.current)
+        window.dispatchEvent(new CustomEvent(ATTACHMENTS_PROCESSED_EVENT));
+    });
   }
 
   // Handle modal actions
@@ -315,6 +335,7 @@ export function DnDFileUploaderProvider({
       workspace.slug,
       pendingFiles.map((file) => file.parsedFileId)
     );
+    if (!mountedRef.current) return;
 
     // Remove all files from this batch from the UI
     setFiles((prev) =>
@@ -374,6 +395,7 @@ export function DnDFileUploaderProvider({
         )
       )
     );
+    if (!mountedRef.current) return;
 
     // Update status for all files
     const fileUpdates = pendingFiles.map((file, i) => ({
```

---

### Incident Patch 3: `495ad61a` (2026-10-05)
**Commit Message**: fix: preserve referenced MBOX chat attachments during orphan cleanup (#6633)

* fix: preserve referenced MBOX chat attachments during orphan cleanup

* use safeJsonParse for parsed-file metadata, tidy comments, drop test

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `server/jobs/cleanup-orphan-documents.js` (modified, +17/-5)
```diff
@@ -4,6 +4,7 @@ const { default: slugify } = require("slugify");
 const { log, conclude } = require("./helpers/index.js");
 const { WorkspaceParsedFiles } = require("../models/workspaceParsedFiles.js");
 const { directUploadsPath } = require("../utils/files");
+const { safeJsonParse } = require("../utils/http/index.js");
 
 async function batchDeleteFiles(filesToDelete, batchSize = 500) {
   let deletedCount = 0;
@@ -48,11 +49,22 @@ async function batchDeleteFiles(filesToDelete, batchSize = 500) {
     const filesToDelete = [];
     const knownFiles = await WorkspaceParsedFiles.where({}, null, null, {
       filename: true,
-    })
-      // Slugify the filename to match the direct uploads naming convention otherwise
-      // files with spaces will not result in a match and will be pruned when attached to a thread.
-      // This could then result in files showing "Attached" but the model not seeing them during chat.
-      .then((files) => new Set(files.map((f) => slugify(f.filename))));
+      metadata: true,
+    }).then(
+      (files) =>
+        new Set(
+          files.map((file) => {
+            // Keep the file getContextFiles reads, since collector output names
+            // (e.g. MBOX "-msg-N" files) can differ from the record filename.
+            const metadata = safeJsonParse(file.metadata, {});
+            if (typeof metadata?.location === "string" && metadata.location)
+              return path.basename(metadata.location);
+
+            // Records without a location match the slugified direct-uploads name.
+            return slugify(file.filename);
+          })
+        )
+    );
 
     if (!fs.existsSync(directUploadsPath))
       return log("No direct uploads path found - exiting.");
```

---

### Incident Patch 4: `4813d2ed` (2026-10-05)
**Commit Message**: fix: restore dropped i18n values in model router and model picker strings (#6631)

* fix: restore dropped i18n values in model router and model picker strings

24 strings in 13 locales lost an interpolated value or closed a Trans tag
before the value, so the route, rule, condition list, provider or count
did not render. English is unchanged.

* fix: rewrite garbled model router strings to match English structure

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `frontend/src/locales/ar/common.js` (modified, +1/-1)
```diff
@@ -1872,7 +1872,7 @@ const TRANSLATIONS = {
       "calculated-single-condition":
         'إذا كانت <prop>{{property}}</prop> {{comparator}} <val>"{{value}}"</val>، فقم بتوجيهها إلى <route>{{route}}</route>',
       "calculated-multi-condition":
-        "إذا كان {{quantifier}} من <cond>، فإن المسار يجب أن يكون إلى <route>، {{route}}، </route>",
+        "إذا تحقق {{quantifier}} من <cond>{{conditions}}</cond>، فقم بتوجيهها إلى <route>{{route}}</route>",
       "comparator-contains": "يحتوي على",
       "comparator-matches": "المباريات",
       "comparator-between": "بين",
```

**File**: `frontend/src/locales/da/common.js` (modified, +1/-1)
```diff
@@ -1901,7 +1901,7 @@ const TRANSLATIONS = {
       "calculated-single-condition":
         'Hvis <prop>{{property}}</prop> {{comparator}} <val> "_{{value}}_"</val>, så følg ruten til <route>{{route}}</route>',
       "calculated-multi-condition":
-        "Hvis {{quantifier}} fra <cond> er tilfældet, så følg ruten til <route>",
+        "Hvis {{quantifier}} af <cond>{{conditions}}</cond> er opfyldt, så følg ruten til <route>{{route}}</route>",
       "comparator-contains": "indeholder",
       "comparator-matches": "kampe",
       "comparator-between": "mellem",
```

**File**: `frontend/src/locales/fa/common.js` (modified, +2/-2)
```diff
@@ -1886,9 +1886,9 @@ const TRANSLATIONS = {
       "calculated-no-conditions":
         "بدون هیچ شرط – مسیر به سمت <route>{{route}}</route>",
       "calculated-single-condition":
-        'اگر <prop>، {{property}}، </prop>، {{comparator}}، <val>، "{{value}}"، </val> باشد، مسیر را به <route>، {{route}}، </route> تعیین کنید.',
+        'اگر <prop>{{property}}</prop> {{comparator}} <val>"{{value}}"</val> باشد، مسیر را به <route>{{route}}</route> تغییر دهید.',
       "calculated-multi-condition":
-        "اگر {{quantifier}} از نوع <cond> باشد، مسیر را به <route>{{route}}</route> تغییر دهید.",
+        "اگر {{quantifier}} از <cond>{{conditions}}</cond> برقرار باشد، مسیر را به <route>{{route}}</route> تغییر دهید.",
       "comparator-contains": "شامل",
       "comparator-matches": "مسابقات",
       "comparator-between": "بین",
```

**File**: `frontend/src/locales/fr/common.js` (modified, +4/-4)
```diff
@@ -1107,7 +1107,7 @@ const TRANSLATIONS = {
       "delete-confirmation":
         "Êtes-vous sûr de vouloir supprimer ces fichiers et dossiers ?\nCela supprimera les fichiers du système et les retirera automatiquement de tout espace de travail existant.\nCette action est irréversible.",
       "removing-message":
-        "Suppression de {{count}} documents et dossiers. Veuillez patienter.",
+        "Suppression de {{count}} documents et {{folderCount}} dossiers. Veuillez patienter.",
       "move-success": "{{count}} documents déplacés avec succès.",
       no_docs: "Aucun document",
       select_all: "Tout sélectionner",
@@ -1159,7 +1159,7 @@ const TRANSLATIONS = {
       vault_location: "Emplacement du coffre",
       vault_description:
         "Sélectionnez le dossier racine de votre coffre Obsidian.",
-      selected_files: "fichiers sélectionnés",
+      selected_files: "{{count}} fichiers markdown trouvés",
       importing: "Importation...",
       import_vault: "Importer le coffre",
       processing_time:
@@ -1231,7 +1231,7 @@ const TRANSLATIONS = {
       search: "Rechercher des modèles",
       loading_workspace_settings:
         "Chargement des paramètres de l'espace de travail...",
-      available_models: "Modèles disponibles",
+      available_models: "Modèles disponibles pour {{provider}}",
       available_models_description:
         "Sélectionnez un modèle à utiliser pour cet espace de travail.",
       save: "Sauvegarder",
@@ -1923,7 +1923,7 @@ const TRANSLATIONS = {
       "llm-section-label":
         "Règles LLM – évaluées par lots si aucune règle calculée ne correspond",
       "llm-rule-body":
-        'Correspondance avec "<desc>" puis redirection vers "<route>"{{route}}"</route>"',
+        'Correspondance avec <desc>"{{description}}"</desc> puis redirection vers <route>{{route}}</route>',
       "calculated-no-conditions":
         "Aucune condition – itinéraire vers <route>{{route}}</route>",
       "calculated-single-condition":
```

**File**: `frontend/src/locales/he/common.js` (modified, +2/-2)
```diff
@@ -1836,7 +1836,7 @@ const TRANSLATIONS = {
       "calculated-no-conditions":
         "ללא תנאים – מסל הגעה ל<route>{{route}}</route>",
       "calculated-single-condition":
-        "אם <prop> נמצא במיקום {{property}} וגם </prop> נמצא במיקום {{comparator}} וגם <val> נמצא במיקום {{value}} אז, יש להעביר את המסלול ל-<route> במיקום {{route}}",
+        'אם <prop>{{property}}</prop> {{comparator}} <val>"{{value}}"</val>, יש לנתב אל <route>{{route}}</route>',
       "calculated-multi-condition":
         "אם {{quantifier}} של <cond> נמצא ב{{conditions}} של </cond>, אז יש לכוון את המסלול ל<route> של {{route}} של </route>",
       "comparator-contains": "כולל",
@@ -1944,7 +1944,7 @@ const TRANSLATIONS = {
     chat: {
       "select-router-error": "בחר/י נתב",
       "invalid-model": "בחירת מודל לא תקינה",
-      "routed-to": "מופנה ל-{{model}} בתוך <route>",
+      "routed-to": "נשלח אל <route>{{model}}</route>",
       "routed-to-rule":
         "נשלח דרך <route>{{model}}</route> באמצעות <rule>{{ruleTitle}}</rule>",
     },
```

**File**: `frontend/src/locales/ja/common.js` (modified, +6/-6)
```diff
@@ -1882,13 +1882,13 @@ const TRANSLATIONS = {
       "llm-section-label":
         "LLMのルール—計算されたルールに一致しない場合に、まとめて評価",
       "llm-rule-body":
-        "次に、<desc>「{{description}}」</desc> にマッチし、その後、<route>へルーティングします。",
+        "<desc>「{{description}}」</desc> にマッチした場合、<route>{{route}}</route> へルーティングします。",
       "calculated-no-conditions":
-        "条件なし—ルート：<route>へ、{{route}}、</route>",
+        "条件なし — <route>{{route}}</route> へルーティング",
       "calculated-single-condition":
-        'もし <prop>が条件{{property}}、</prop>が条件{{comparator}}、そして<val>が条件 "{{value}}"、</val>である場合、<route>へ移動する',
+        'もし <prop>{{property}}</prop> {{comparator}} <val>"{{value}}"</val> の場合、<route>{{route}}</route> へルーティングします',
       "calculated-multi-condition":
-        "もし、[{{quantifier}}]が[<cond>]である場合、[{{conditions}}]、[</cond>]を通過して、[<route>]、[{{route}}]、[</route>]へ移動する。",
+        "<cond>{{conditions}}</cond> の{{quantifier}}に一致する場合、<route>{{route}}</route> へルーティングします",
       "comparator-contains": "これには",
       "comparator-matches": "試合",
       "comparator-between": "間、間隔",
@@ -1897,7 +1897,7 @@ const TRANSLATIONS = {
       "aria-drag-to-reorder": "ドラッグして並び順を変更",
       "aria-edit-rule": "編集規則",
       "aria-delete-rule": "ルールを削除する",
-      "quantifier-any": "何でも",
+      "quantifier-any": "いずれか",
       "quantifier-all": "すべて",
     },
     "rule-form": {
@@ -1998,7 +1998,7 @@ const TRANSLATIONS = {
       "invalid-model": "無効なモデルの選択",
       "routed-to": "<route>、{{model}}、</route> 宛にルーティング",
       "routed-to-rule":
-        "<route>～</route>を経由して、<rule>～</rule>へルーティング",
+        "<rule>{{ruleTitle}}</rule> により <route>{{model}}</route> へルーティング",
     },
   },
   imageGeneration: {
```

**File**: `frontend/src/locales/ko/common.js` (modified, +6/-4)
```diff
@@ -1853,11 +1853,12 @@ const TRANSLATIONS = {
         "LLM 규칙 — 계산된 규칙이 일치하는 경우 일괄적으로 평가",
       "llm-rule-body":
         '다음 단계는 <desc>"{{description}}"</desc>을 매칭한 후, <route>{{route}}</route>로 경로를 지정하는 것입니다.',
-      "calculated-no-conditions": "특정 조건 없음 – <route> 경로로 이동",
+      "calculated-no-conditions":
+        "특정 조건 없음 – <route>{{route}}</route> 경로로 이동",
       "calculated-single-condition":
         '만약 <prop> {{property}} </prop> {{comparator}} <val> "{{value}}" </val> 이면, <route> {{route}} </route>로 이동합니다.',
       "calculated-multi-condition":
-        "만약 {{quantifier}} (태그 0)가 {{conditions}} (태그 1)인 경우, <route> (태그 2)로 이동합니다.",
+        "만약 <cond>{{conditions}}</cond> 중 {{quantifier}} 조건을 충족하면, <route>{{route}}</route>로 이동합니다.",
       "comparator-contains": "포함",
       "comparator-matches": "경쟁",
       "comparator-between": "사이",
@@ -1963,8 +1964,9 @@ const TRANSLATIONS = {
     chat: {
       "select-router-error": "라우터를 선택하세요",
       "invalid-model": "유효하지 않은 모델 선택",
-      "routed-to": "<route> 정보가 {{model}}에 전달되었습니다.",
-      "routed-to-rule": "<route>에서 {{model}}를 통해 </route>로 연결",
+      "routed-to": "<route>{{model}}</route>(으)로 연결됨",
+      "routed-to-rule":
+        "<rule>{{ruleTitle}}</rule> 규칙을 통해 <route>{{model}}</route>(으)로 연결",
     },
   },
   imageGeneration: {
```

**File**: `frontend/src/locales/lt/common.js` (modified, +1/-1)
```diff
@@ -1902,7 +1902,7 @@ const TRANSLATIONS = {
       "calculated-no-conditions":
         "Nėra sąlygų – maršrutas į <route>{{route}}</route>",
       "calculated-single-condition":
-        "Jei <prop> yra {{property}} ir </prop>, o {{comparator}} yra <val> ir {{value}}, o </val> yra, tada kelias yra į <route> ir {{route}}",
+        'Jei <prop>{{property}}</prop> {{comparator}} <val>"{{value}}"</val>, nukreipti į <route>{{route}}</route>',
       "calculated-multi-condition":
         "Jei {{quantifier}} yra <cond> ir {{conditions}} yra </cond>, tuomet keliauti į <route> ir {{route}} yra </route>",
       "comparator-contains": "apima",
```

---

### Incident Patch 5: `50b1b151` (2026-10-05)
**Commit Message**: fix: show an error when embedding attached files into the workspace fails (#6629)

**File**: `frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/index.jsx` (modified, +5/-2)
```diff
@@ -396,9 +396,12 @@ export function DnDFileUploaderProvider({
     setTokenCount(0);
     setIsEmbedding(false);
     window.dispatchEvent(new CustomEvent(ATTACHMENTS_PROCESSED_EVENT));
+    const allEmbedded = results.every(({ response }) => response.ok);
     showToast(
-      `${pendingFiles.length} ${pluralize("file", pendingFiles.length)} embedded successfully`,
-      "success"
+      allEmbedded
+        ? `${pendingFiles.length} ${pluralize("file", pendingFiles.length)} embedded successfully`
+        : "Failed to embed files",
+      allEmbedded ? "success" : "error"
     );
   };
 
```

**File**: `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/AttachItem/ParsedFilesMenu/index.jsx` (modified, +8/-4)
```diff
@@ -71,11 +71,12 @@ export default function ParsedFilesMenu({
     setEmbedProgress(1);
     try {
       let completed = 0;
-      await Promise.all(
+      const results = await Promise.all(
         files.map((file) =>
-          Workspace.embedParsedFile(workspaceSlug, file.id).then(() => {
+          Workspace.embedParsedFile(workspaceSlug, file.id).then((result) => {
             completed++;
             setEmbedProgress(completed + 1);
+            return result;
           })
         )
       );
@@ -89,9 +90,12 @@ export default function ParsedFilesMenu({
         currentContextTokenCount >=
           contextWindow * Workspace.maxContextWindowLimit
       );
+      const allEmbedded = results.every(({ response }) => response.ok);
       showToast(
-        `${files.length} ${pluralize("file", files.length)} embedded successfully`,
-        "success"
+        allEmbedded
+          ? `${files.length} ${pluralize("file", files.length)} embedded successfully`
+          : "Failed to embed files",
+        allEmbedded ? "success" : "error"
       );
       tooltipRef?.current?.close();
     } catch (error) {
```

---

### Incident Patch 6: `cc487a6a` (2026-10-05)
**Commit Message**: fix: load the next page of documents from the server's offset in the picker (#6628)

* fix: load the next page of documents from the server's offset in the picker

* tidy fetched offset comment

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `frontend/src/components/Modals/ManageWorkspace/Documents/Directory/index.jsx` (modified, +4/-1)
```diff
@@ -168,7 +168,10 @@ export default function Directory({
       if (toRemove.length > 0) await System.deleteDocuments(toRemove);
       for (const folderName of foldersToRemove)
         await System.deleteFolder(folderName);
-      removeFiles(selected.map((file) => file.id));
+      removeFiles(
+        selected.map((file) => file.id),
+        { deleted: true }
+      );
       clearSelection();
       await refresh();
     } catch (error) {
```

**File**: `frontend/src/components/Modals/ManageWorkspace/Documents/hooks/useDocumentPicker.js` (modified, +13/-2)
```diff
@@ -17,6 +17,7 @@ const UNLOADED = Object.freeze({
   items: [],
   hasMore: false,
   totalCount: 0,
+  fetched: 0,
 });
 
 const EMPTY_SET = Object.freeze(new Set());
@@ -159,6 +160,10 @@ function reducer(state, action) {
               : action.items,
             hasMore: action.hasMore,
             totalCount: action.totalCount,
+            // Server offset of the next page. Pages are windows over the
+            // folder's full file list and embedded files are filtered out of
+            // each one, so this tracks windows fetched, not items shown.
+            fetched: (action.append ? prev.fetched : 0) + PAGE_SIZE,
           },
         },
       };
@@ -313,6 +318,11 @@ function reducer(state, action) {
                   0,
                   entry.totalCount - removedPerFolder[name]
                 ),
+                // Deleted files leave the folder's file list; files only staged
+                // for the workspace are still on disk, so the window stays put.
+                fetched: action.deleted
+                  ? Math.max(0, entry.fetched - removedPerFolder[name])
+                  : entry.fetched,
               };
       }
       const selectedFiles = new Set(state.selectedFiles);
@@ -415,7 +425,7 @@ export default function useDocumentPicker({ slug }) {
     if (entry.status === "loaded" && !append) return;
 
     dispatch({ type: "folder-loading", name });
-    const offset = append ? entry.items.length : 0;
+    const offset = append ? entry.fetched : 0;
     const result = await System.localFiles(name, offset, PAGE_SIZE);
     if (!result) return dispatch({ type: "folder-failed", name });
 
@@ -618,7 +628,8 @@ export default function useDocumentPicker({ slug }) {
     [loadFolder]
   );
   const removeFiles = useCallback(
-    (ids) => dispatch({ type: "remove-files", ids }),
+    (ids, { deleted = false } = {}) =>
+      dispatch({ type: "remove-files", ids, deleted }),
     []
   );
   const addFolder = useCallback(
```

---

### Incident Patch 7: `ea859be3` (2026-10-05)
**Commit Message**: fix: return 404 for an unknown workspace on manage-users and update-pin (#6625)

**File**: `server/endpoints/api/admin/index.js` (modified, +3/-3)
```diff
@@ -623,17 +623,17 @@ function apiAdminEndpoints(app) {
           await User.where({ id: { in: _uids.map(Number) } })
         ).map((user) => user.id);
         const workspace = await Workspace.get({ slug: String(workspaceSlug) });
-        const workspaceUsers = await Workspace.workspaceUsers(workspace.id);
-
         if (!workspace) {
           response.status(404).json({
             success: false,
             error: `Workspace ${workspaceSlug} not found`,
-            users: workspaceUsers,
+            users: [],
           });
           return;
         }
 
+        const workspaceUsers = await Workspace.workspaceUsers(workspace.id);
+
         if (userIds.length === 0) {
           response.status(404).json({
             success: false,
```

**File**: `server/endpoints/api/workspace/index.js` (modified, +2/-1)
```diff
@@ -570,7 +570,7 @@ function apiWorkspaceEndpoints(app) {
         }
       }
       #swagger.responses[404] = {
-        description: 'Document not found'
+        description: 'Workspace or document not found'
       }
       #swagger.responses[500] = {
         description: 'Internal Server Error'
@@ -580,6 +580,7 @@ function apiWorkspaceEndpoints(app) {
         const { slug = null } = request.params;
         const { docPath, pinStatus = false } = reqBody(request);
         const workspace = await Workspace.get({ slug: String(slug) });
+        if (!workspace) return response.sendStatus(404).end();
 
         const document = await Document.get({
           workspaceId: workspace.id,
```

**File**: `server/swagger/openapi.json` (modified, +1/-1)
```diff
@@ -2332,7 +2332,7 @@
             "description": "Forbidden"
           },
           "404": {
-            "description": "Document not found"
+            "description": "Workspace or document not found"
           },
           "500": {
             "description": "Internal Server Error"
```

---

### Incident Patch 8: `92861810` (2026-10-05)
**Commit Message**: fix: attach requested files to Outlook replies and reply drafts (#6623)

**File**: `server/utils/agents/aibitat/plugins/outlook/drafts/outlook-create-draft.js` (modified, +2/-1)
```diff
@@ -167,7 +167,8 @@ module.exports.OutlookCreateDraft = {
                 result = await outlookLib.createDraftReply(
                   replyToMessageId,
                   body,
-                  replyAll
+                  replyAll,
+                  { attachments: preparedAttachments }
                 );
               } else {
                 this.super.introspect(
```

**File**: `server/utils/agents/aibitat/plugins/outlook/lib.js` (modified, +20/-3)
```diff
@@ -1115,6 +1115,7 @@ class OutlookBridge {
         );
         if (!attachResult.success) {
           this.#log(`Failed to add attachment: ${attachResult.error}`);
+          return attachResult;
         }
       }
     }
@@ -1135,10 +1136,10 @@ class OutlookBridge {
    * @param {string} messageId - The message ID to reply to
    * @param {string} body - Reply body
    * @param {boolean} replyAll - Whether to reply all
-   * @param {object} options - Additional options
+   * @param {object} options - Additional options (attachments)
    * @returns {Promise<{success: boolean, data?: object, error?: string}>}
    */
-  async createDraftReply(messageId, body, replyAll = false, _options = {}) {
+  async createDraftReply(messageId, body, replyAll = false, options = {}) {
     const endpoint = replyAll
       ? `/me/messages/${messageId}/createReplyAll`
       : `/me/messages/${messageId}/createReply`;
@@ -1152,6 +1153,17 @@ class OutlookBridge {
 
     if (!result.success) return result;
 
+    for (const attachment of options.attachments || []) {
+      const attachResult = await this.request(
+        `/me/messages/${result.data.id}/attachments`,
+        { method: "POST", body: JSON.stringify(attachment) }
+      );
+      if (!attachResult.success) {
+        this.#log(`Failed to add attachment: ${attachResult.error}`);
+        return attachResult;
+      }
+    }
+
     return {
       success: true,
       data: {
@@ -1306,9 +1318,10 @@ class OutlookBridge {
    * @param {string} messageId - The message ID to reply to
    * @param {string} body - Reply body
    * @param {boolean} replyAll - Whether to reply all
+   * @param {object} options - Additional options (attachments)
    * @returns {Promise<{success: boolean, error?: string}>}
    */
-  async replyToMessage(messageId, body, replyAll = false) {
+  async replyToMessage(messageId, body, replyAll = false, options = {}) {
     const endpoint = replyAll
       ? `/me/messages/${messageId}/replyAll`
       : `/me/messages/${messageId}/reply`;
@@ -1317,6 +1330,10 @@ class OutlookBridge {
       method: "POST",
       body: JSON.stringify({
         comment: body,
+        message:
+          options.attachments?.length > 0
+            ? { attachments: options.attachments }
+            : undefined,
       }),
     });
   }
```

**File**: `server/utils/agents/aibitat/plugins/outlook/send/outlook-send-email.js` (modified, +2/-1)
```diff
@@ -166,7 +166,8 @@ module.exports.OutlookSendEmail = {
                 result = await outlookLib.replyToMessage(
                   replyToMessageId,
                   body,
-                  replyAll
+                  replyAll,
+                  { attachments: preparedAttachments }
                 );
               } else {
                 this.super.introspect(
```

---

### Incident Patch 9: `db6d4a61` (2026-10-05)
**Commit Message**: fix: scrape each page once when bulk links differ only by #fragment (#6619)

* fix: scrape each page once when bulk links differ only by #fragment

The bulk link scraper kept the fragment on discovered links, so in-page
anchors like "#install" were queued as new pages. The same page was then
loaded and stored again under the same file name, each copy counted
toward maxLinks, and real pages could be left out.

* fix: drop the #fragment from the start URL so in-page anchors match it

* chore: remove fragment comment in extractLinks

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `collector/__tests__/utils/extensions/WebsiteDepth/index.test.js` (modified, +44/-3)
```diff
@@ -145,11 +145,13 @@ describe("WebsiteDepth extractLinks scope", () => {
     ).toEqual(["https://example.com/docs/Upper"]);
   });
 
-  it("keeps query strings and fragments on in-scope links", () => {
-    const html = '<a href="/docs/guide?page=2#install">in</a>';
+  it("keeps query strings but drops fragments on in-scope links", () => {
+    const html =
+      '<a href="/docs/guide?page=2#install">in</a>' +
+      '<a href="/docs/guide?page=2#usage">in</a>';
     expect(
       extractLinks(html, new URL("https://example.com/docs/page"))
-    ).toEqual(["https://example.com/docs/guide?page=2#install"]);
+    ).toEqual(["https://example.com/docs/guide?page=2"]);
   });
 });
 
@@ -307,6 +309,45 @@ describe("WebsiteDepth websiteScraper", () => {
     expect(scraped).toHaveLength(3);
   });
 
+  it("does not spend maxLinks on #fragment links to pages already found", async () => {
+    mockSite({
+      "https://example.com/docs/page":
+        '<a href="#install">i</a><a href="#usage">u</a>' +
+        '<a href="/docs/api">a</a><a href="/docs/api#auth">a</a>',
+      "https://example.com/docs/api": "api content",
+    });
+
+    const scraped = await websiteScraper("https://example.com/docs/page", 1, 3);
+
+    // The in-page anchors are the start page itself, so the cap of 3 still
+    // has room for /docs/api, and each page is loaded and stored only once.
+    expect(scraped.map((d) => d.chunkSource)).toEqual([
+      "link://https://example.com/docs/page",
+      "link://https://example.com/docs/api",
+    ]);
+    expect(fetchedUrls().filter((url) => url.includes("#"))).toEqual([]);
+    expect(writeToServerDocuments).toHaveBeenCalledTimes(2);
+  });
+
+  it("scrapes the start page once when the start URL has a #fragment", async () => {
+    mockSite({
+      "https://example.com/docs/page":
+        '<a href="#install">i</a><a href="/docs/api">a</a>',
+      "https://example.com/docs/api": "api content",
+    });
+
+    const scraped = await websiteScraper(
+      "https://example.com/docs/page#intro",
+      1,
+      3
+    );
+
+    expect(scraped.map((d) => d.chunkSource)).toEqual([
+      "link://https://example.com/docs/page",
+      "link://https://example.com/docs/api",
+    ]);
+  });
+
   it("skips a page that fails to load without aborting the crawl", async () => {
     mockSite({
       "https://example.com/docs/page":
```

**File**: `collector/utils/extensions/WebsiteDepth/index.js` (modified, +6/-2)
```diff
@@ -13,8 +13,11 @@ const { decodePathname } = require("../../url");
 
 async function discoverLinks(startUrl, maxDepth = 1, maxLinks = 20) {
   const baseUrl = new URL(startUrl);
-  const discoveredLinks = new Set([startUrl]);
-  let queue = [[startUrl, 0]]; // [url, currentDepth]
+  // Matches extractLinks, so in-page anchors resolve to the start page itself.
+  baseUrl.hash = "";
+  const startHref = baseUrl.href;
+  const discoveredLinks = new Set([startHref]);
+  let queue = [[startHref, 0]]; // [url, currentDepth]
   const scrapedUrls = new Set();
 
   for (let currentDepth = 0; currentDepth < maxDepth; currentDepth++) {
@@ -119,6 +122,7 @@ function extractLinks(html, baseUrl, pageUrl = baseUrl) {
         absoluteUrl.pathname === scopePath ||
         absoluteUrl.pathname.startsWith(`${scopePath}/`));
     if (inScope) {
+      absoluteUrl.hash = "";
       extractedLinks.add(absoluteUrl.href);
     }
   }
```

---

### Incident Patch 10: `84a6625c` (2026-10-05)
**Commit Message**: fix: restore dropped i18n placeholders in MCP and profile strings (#6614)

The MCP server panel renders agent.mcp.tool-count-warning with a
{{count}} value, but 14 locales (ar, da, es, et, it, ja, lv, nl, pl,
ro, ru, tr, zh, zh_TW) had lost the placeholder, so the warning showed
an empty bold span instead of the number of enabled tools. The
<b>/<br /> markup is also aligned with the English source so the
count is the emphasized part. Where the noun form depends on the
number (ar, lv, pl, ro, ru), the count goes in parentheses.

The account modal passes {{error}} to profile_settings.failed_upload,
failed_remove and failed_update_user. fr and pt_BR dropped it, hiding
the error reason, and ru used a translated variable name {{ошибка}}
which i18next printed literally.

**File**: `frontend/src/locales/ar/common.js` (modified, +1/-1)
```diff
@@ -743,7 +743,7 @@ const TRANSLATIONS = {
       "start-server": "ابدأ خادم MCP",
       "delete-server": "حذف خادم MCP",
       "tool-count-warning":
-        "يحتوي هذا خادم MCP على <b> أدوات مُفعّلة</b> والتي ستستهلك السياق في كل محادثة. <br /> ضع في اعتبارك تعطيل الأدوات غير المرغوب فيها لتوفير السياق.",
+        "يحتوي خادم MCP هذا على <b>أدوات مُفعّلة ({{count}})</b> ستستهلك السياق في كل محادثة.<br />ضع في اعتبارك تعطيل الأدوات غير المرغوب فيها لتوفير السياق.",
       "startup-command": "أمر البدء",
       command: "الأمر",
       arguments: "حجج",
```

**File**: `frontend/src/locales/da/common.js` (modified, +1/-1)
```diff
@@ -746,7 +746,7 @@ const TRANSLATIONS = {
       "start-server": "Start MCP-serveren",
       "delete-server": "Slet MCP-serveren",
       "tool-count-warning":
-        "Denne MCP-server har <b>aktiverede</b>værktøjer, som vil forbruge kontekst i hvert chat-session.<br />Overvej at deaktivere uønskede værktøjer for at spare på konteksten.",
+        "Denne MCP-server har <b>{{count}} aktiverede værktøjer</b>, som vil forbruge kontekst i hver chat.<br />Overvej at deaktivere uønskede værktøjer for at spare på konteksten.",
       "startup-command": "Startkommando",
       command: "Instruktion",
       arguments: "Argumenter",
```

**File**: `frontend/src/locales/es/common.js` (modified, +1/-1)
```diff
@@ -810,7 +810,7 @@ const TRANSLATIONS = {
       "start-server": "Iniciar el servidor MCP",
       "delete-server": "Eliminar el servidor MCP",
       "tool-count-warning":
-        "Este servidor de MCP tiene <b> herramientas habilitadas</b> que consumirán contexto en cada conversación.<br /> Considere desactivar las herramientas no deseadas para ahorrar contexto.",
+        "Este servidor de MCP tiene <b>{{count}} herramientas habilitadas</b> que consumirán contexto en cada conversación.<br />Considere desactivar las herramientas no deseadas para ahorrar contexto.",
       "startup-command": "Comando inicial",
       command: "Órden",
       arguments: "Argumentos",
```

**File**: `frontend/src/locales/et/common.js` (modified, +1/-1)
```diff
@@ -773,7 +773,7 @@ const TRANSLATIONS = {
       "start-server": "Alusta MCP-serverit",
       "delete-server": "Kasuta MCP-serveri kustutamise funktsiooni",
       "tool-count-warning":
-        "See MCP server on lubanud <b>_, mis tarbivad konteksti igas vestluses.</b> Selle asemel võid soovimatuid tööriistu välja lülitada, et säästa konteksti.",
+        "Selles MCP serveris on <b>{{count}} lubatud tööriista</b>, mis tarbivad konteksti igas vestluses.<br />Konteksti säästmiseks kaalu soovimatute tööriistade välja lülitamist.",
       "startup-command": "Alustamine",
       command: "Juhendamine",
       arguments: "Argumentid",
```

**File**: `frontend/src/locales/fr/common.js` (modified, +3/-3)
```diff
@@ -1368,11 +1368,11 @@ const TRANSLATIONS = {
     update_account: "Mettre à jour le compte",
     theme: "Thème",
     language: "Langue",
-    failed_upload: "Échec du téléchargement de l'image.",
+    failed_upload: "Échec du téléchargement de l'image : {{error}}",
     upload_success: "Image téléchargée avec succès.",
-    failed_remove: "Échec de la suppression de l'image.",
+    failed_remove: "Échec de la suppression de l'image : {{error}}",
     profile_updated: "Profil mis à jour avec succès.",
-    failed_update_user: "Échec de la mise à jour de l'utilisateur.",
+    failed_update_user: "Échec de la mise à jour de l'utilisateur : {{error}}",
     account: "Compte",
     support: "Support",
     signout: "Déconnexion",
```

**File**: `frontend/src/locales/it/common.js` (modified, +1/-1)
```diff
@@ -768,7 +768,7 @@ const TRANSLATIONS = {
       "start-server": "Avvia il server MCP",
       "delete-server": "Elimina il server MCP",
       "tool-count-warning":
-        "Questo server MCP ha <b> alcune funzionalità abilitate</b> che consumano contesto in ogni chat.<br /> Considera di disabilitare le funzionalità indesiderate per preservare il contesto.",
+        "Questo server MCP ha <b>{{count}} strumenti abilitati</b> che consumano contesto in ogni chat.<br />Considera di disabilitare gli strumenti indesiderati per preservare il contesto.",
       "startup-command": "Comando di avvio",
       command: "Ordine",
       arguments: "Argomentazioni",
```

**File**: `frontend/src/locales/ja/common.js` (modified, +1/-1)
```diff
@@ -735,7 +735,7 @@ const TRANSLATIONS = {
       "start-server": "MCP サーバーを開始する",
       "delete-server": "MCP サーバーを削除",
       "tool-count-warning":
-        "このMCPサーバーには、<b>のツールが有効になっており、これらはチャットのコンテキストを消費します</b>。コンテキストを節約するために、不要なツールを無効にすることを検討してください。",
+        "このMCPサーバーでは<b>{{count}}個のツールが有効</b>になっており、すべてのチャットでコンテキストを消費します。<br />コンテキストを節約するために、不要なツールを無効にすることを検討してください。",
       "startup-command": "起動コマンド",
       command: "指示",
       arguments: "議論",
```

**File**: `frontend/src/locales/lv/common.js` (modified, +1/-1)
```diff
@@ -791,7 +791,7 @@ const TRANSLATIONS = {
       "start-server": "Sākt MCP serveri",
       "delete-server": "Dzēst MCP serveri",
       "tool-count-warning":
-        "Šis MCP servers ir aktivizētas <b> instrumenti, kas izmantos kontekstu katrā sarunā.</b> Iespējams, ir labāk deaktivizēt nevēlamus instrumentus, lai saglabātu kontekstu.",
+        "Šim MCP serverim ir <b>aktivizēti instrumenti ({{count}})</b>, kas izmantos kontekstu katrā sarunā.<br />Apsveriet nevēlamo instrumentu deaktivizēšanu, lai taupītu kontekstu.",
       "startup-command": "Sākuma komanda",
       command: "Instrukcijas",
       arguments: "Pamatatpersonas",
```

---

### Incident Patch 11: `feb04ca0` (2026-10-04)
**Commit Message**: fix: keep numeric strings over 15 digits as text in created Excel files (#6613)

* fix: keep numeric strings over 15 digits as text in created Excel files

* test: cover numeric strings beyond double precision in inferCellType

* docs: describe fitsInDouble return value accurately

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `server/__tests__/utils/agents/aibitat/plugins/create-files/xlsx/utils.test.js` (modified, +7/-0)
```diff
@@ -186,6 +186,8 @@ describe("inferCellType", () => {
     ["¥1,000", 1000],
     ["50%", 0.5],
     ["12.5%", 0.125],
+    ["123456789012345", 123456789012345],
+    ["$ 123,456,789,012,345", 123456789012345],
   ])("converts %j to the number %j", (input, expected) => {
     expect(inferCellType(input)).toBe(expected);
   });
@@ -200,6 +202,11 @@ describe("inferCellType", () => {
     "€1.234,56",
     "₹1,23,456",
     "$1.2.3",
+    "4111111111111111",
+    "12345678901234567890",
+    "1,234,567,890,123,456",
+    "$1234567890123456",
+    "-9007199254740993",
     "$192.168.1.10",
     "$1,23",
     "-$5",
```

**File**: `server/utils/agents/aibitat/plugins/create-files/xlsx/utils.js` (modified, +15/-0)
```diff
@@ -126,6 +126,18 @@ function detectDelimiter(csvString) {
   return bestDelimiter;
 }
 
+/**
+ * Excel stores numbers as IEEE-754 doubles, which only keep about 15
+ * significant digits. A longer digit string (a card number, an account or
+ * tracking ID) would be silently rounded if converted, so it stays as text.
+ * @param {string} numericText - A numeric string, possibly signed or with a decimal point.
+ * @returns {boolean} True if the value has at most 15 significant digits.
+ */
+function fitsInDouble(numericText) {
+  const digits = numericText.replace(/[^0-9]/g, "").replace(/^0+/, "");
+  return digits.length <= 15;
+}
+
 /**
  * Attempts to convert a string value to an appropriate type (number, date, boolean, or string).
  * @param {string} value - The string value to convert
@@ -143,13 +155,15 @@ function inferCellType(value) {
   if (lowerTrimmed === "false") return false;
 
   if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
+    if (!fitsInDouble(trimmed)) return value;
     const num = parseFloat(trimmed);
     if (!isNaN(num) && isFinite(num)) {
       return num;
     }
   }
 
   if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed)) {
+    if (!fitsInDouble(trimmed)) return value;
     const num = parseFloat(trimmed.replace(/,/g, ""));
     if (!isNaN(num) && isFinite(num)) {
       return num;
@@ -160,6 +174,7 @@ function inferCellType(value) {
     /^[$€£¥₹]\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)$/
   );
   if (currencyMatch) {
+    if (!fitsInDouble(currencyMatch[1])) return value;
     const num = parseFloat(currencyMatch[1].replace(/,/g, ""));
     if (!isNaN(num) && isFinite(num)) {
       return num;
```

---

### Incident Patch 12: `a72104c5` (2026-10-03)
**Commit Message**: fix: select entire folder after upload when picker is paginated (#6610)

* fix: select entire folder after upload when picker is paginated

After an upload only the first page (100 files) of a changed folder is
fetched and pre-selected file by file, while the folder checkbox rendered
as fully checked. "Move to workspace" then moved only those 100 files.

- Select a folder wholesale after upload when it had no files before, so
  resolveSelection() fetches all of its files.
- Never report a folder with unloaded pages as fully selected through
  individual file selection; show it as partial instead.
- A single click on such a folder now selects it wholesale instead of
  unchecking it.

* tighten picker selection comments

---------

Co-authored-by: Timothy Carambat <[REDACTED_EMAIL]>

**File**: `frontend/src/components/Modals/ManageWorkspace/Documents/hooks/useDocumentPicker.js` (modified, +43/-3)
```diff
@@ -224,9 +224,15 @@ function reducer(state, action) {
       // selected (how a fresh upload arrives) renders as checked, and clicking
       // a checked box has to uncheck it. Anything short of fully checked
       // selects the whole folder, so a partial box fills in on one click.
+      // Individual selections cannot cover pages not fetched yet, so a folder
+      // with more pages is never fully selected that way (search match lists
+      // are complete, so they are exempt).
+      const partiallyLoaded =
+        !state.searchResults && (state.contents[name] ?? UNLOADED).hasMore;
       const fullySelected = state.selectedFolders.has(name)
         ? !items.some((file) => state.deselectedFiles.has(file.id))
         : items.length > 0 &&
+          !partiallyLoaded &&
           items.every((file) => state.selectedFiles.has(file.id));
       const turningOn = !fullySelected;
       const selectedFiles = new Set(state.selectedFiles);
@@ -272,6 +278,22 @@ function reducer(state, action) {
       return { ...state, selectedFiles, deselectedFiles };
     }
 
+    // Wholesale selection, so files on pages not fetched yet are included.
+    case "select-folders": {
+      if (!action.names.length) return state;
+      const selectedFolders = new Set(state.selectedFolders);
+      const selectedFiles = new Set(state.selectedFiles);
+      const deselectedFiles = new Set(state.deselectedFiles);
+      for (const name of action.names) {
+        selectedFolders.add(name);
+        for (const file of (state.contents[name] ?? UNLOADED).items) {
+          selectedFiles.delete(file.id);
+          deselectedFiles.delete(file.id);
+        }
+      }
+      return { ...state, selectedFolders, selectedFiles, deselectedFiles };
+    }
+
     // Optimistically drop files from the picker (moved into the workspace or
     // deleted) without a round trip, so the UI never stalls behind a refetch.
     case "remove-files": {
@@ -446,8 +468,13 @@ export default function useDocumentPicker({ slug }) {
    */
   const folderSelectionState = useCallback(
     (name, visibleFiles) => {
-      const { selectedFolders, deselectedFiles, selectedFiles, contents } =
-        state;
+      const {
+        selectedFolders,
+        deselectedFiles,
+        selectedFiles,
+        contents,
+        searchResults,
+      } = state;
       const items = visibleFiles ?? (contents[name] ?? UNLOADED).items;
       if (selectedFolders.has(name)) {
         const opted = items.some((f) => deselectedFiles.has(f.id));
@@ -456,7 +483,11 @@ export default function useDocumentPicker({ slug }) {
       if (items.length === 0) return "none";
       const hits = items.filter((f) => selectedFiles.has(f.id)).length;
       if (hits === 0) return "none";
-      return hits === items.length ? "all" : "some";
+      // Mirrors `toggle-folder`: individual selections cannot make a folder
+      // with unfetched pages "all".
+      const partiallyLoaded =
+        !searchResults && (contents[name] ?? UNLOADED).hasMore;
+      return hits === items.length && !partiallyLoaded ? "all" : "some";
     },
     [state]
   );
@@ -628,6 +659,8 @@ export default function useDocumentPicker({ slug }) {
    * Reconcile the picker after an upload finishes. Refreshes shells in place,
    * pulls the pages of any folder whose file count grew, and pre-selects the
    * files that are genuinely new so the user can embed them immediately.
+   * A folder that was empty before the upload is selected wholesale instead,
+   * since every file in it is new and only its first page is fetched here.
    * Never touches `status`, so the tree stays on screen throughout.
    */
   const syncAfterUpload = useCallback(async () => {
@@ -655,6 +688,7 @@ export default function useDocumentPicker({ slug }) {
     );
 
     const freshIds = [];
+    const freshFolders = [];
     changed.forEach((folder, i) => {
       const result = pages[i];
       if (!result) return;
@@ -670,10 +704,16 @@ export default function useDocumentPicker({ slug }) {
         totalCount: result.totalCount ?? items.length,
       });
       dispatch({ type: "set-expanded", name: folder.name, value: true });
+      // Wholesale selection would also pick up a non-empty folder's old files.
+      if (!before.get(folder.name)) {
+        freshFolders.push(folder.name);
+        return;
+      }
       for (const file of items)
         if (!knownIds.has(file.id)) freshIds.push(file.id);
     });
 
+    dispatch({ type: "select-folders", names: freshFolders });
     dispatch({ type: "select-files", ids: freshIds });
   }, [refresh]);
 
```

---

### Incident Patch 13: `4ef8be44` (2026-10-03)
**Commit Message**: fix: convert the hourly schedule minute to UTC in half-hour time zones (#6605)

* fix: convert the hourly schedule minute to UTC in half-hour time zones

Hourly schedules ran at the wrong minute in half-hour and quarter-hour time zones because their local minute was treated as UTC. Convert the minute when saving, editing, and displaying hourly schedules and when the agent creates one. Jobs saved earlier keep their run time, and the list and edit form now show the minute they really run at. Every-N-hours patterns such as 0 */2 * * * are still not converted. Add Kolkata, Kathmandu, and New York cases to the cronUtils tests.

* fix: convert hour ranges, steps and lists in scheduled job crons to UTC

Agent-created schedules such as "0 9-17 * * 1-5" or "0 */2 * * *" were
stored unconverted, so they ran on UTC hours in every non-UTC zone.

Both directions now move every run by the zone offset and write the
result back as one cron expression. When the moved runs cannot be one
expression (mixed minute carries in 30/45 minute zones, or runs split
across two UTC days while a day field is set) the agent tool asks the
model to split the job, and the schedule list shows the stored UTC
expressio

**File**: `frontend/src/pages/GeneralSettings/ScheduledJobs/utils/cron.js` (modified, +139/-30)
```diff
@@ -82,7 +82,8 @@ export function getTimezoneAbbreviation() {
 
 /**
  * Humanize a cron expression for display in the user's local timezone.
- * The cron is stored in UTC, so we convert it to local time for display.
+ * The cron is stored in UTC, so we convert it to local time for display. A
+ * schedule with no single local expression is shown in UTC.
  * @param {string} cron - The cron expression (in UTC).
  * @param {string} locale - The locale.
  * @returns {string} The humanized cron expression with timezone indicator.
@@ -91,50 +92,158 @@ export function humanizeCron(cron, locale) {
   if (!cron) return "";
   try {
     const localCron = convertCronToLocalTime(cron);
-    const humanized = cronstrue.toString(localCron, {
+    const humanized = cronstrue.toString(localCron ?? cron, {
       throwExceptionOnParseError: false,
       locale: toCronstrueLocale(locale),
     });
-    return `${humanized} ${getTimezoneAbbreviation()}`;
+    return `${humanized} ${localCron ? getTimezoneAbbreviation() : "UTC"}`;
   } catch {
     return cron;
   }
 }
 
+const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
+
 /**
- * Convert a UTC cron expression to local time for display purposes.
- * Converts time and day fields for patterns that have a specific time.
- * @param {string} cron - The cron expression in UTC.
- * @returns {string} The cron expression adjusted to local time.
+ * Expand a cron minute or hour field into its sorted values. Supports numbers,
+ * ranges, steps and lists of those.
+ * @returns {number[]|null} null when the field has any other syntax or a value outside min-max.
  */
-function convertCronToLocalTime(cron) {
+function expandField(field, min, max) {
+  const values = new Set();
+  for (const part of field.split(",")) {
+    const match = /^(?:\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
+    if (!match) return null;
+    const [, from, to, step] = match;
+    let start = min;
+    let end = max;
+    if (from !== undefined) {
+      start = Number(from);
+      end = to !== undefined ? Number(to) : step !== undefined ? max : start;
+    }
+    const increment = step !== undefined ? Number(step) : 1;
+    if (start < min || end > max || start > end || increment < 1) return null;
+    for (let v = start; v <= end; v += increment) values.add(v);
+  }
+  return [...values].sort((a, b) => a - b);
+}
+
+/** Write sorted values back as a cron field: "*", a step, or a list of numbers and ranges. */
+function compressField(values, min, max) {
+  if (values.length === max - min + 1) return "*";
+  const step = values[1] - values[0];
+  if (
+    values.length >= 3 &&
+    step > 1 &&
+    values.every((v, i) => v === values[0] + i * step)
+  ) {
+    const last = values[values.length - 1];
+    return values[0] === min && last + step > max
+      ? `*/${step}`
+      : `${values[0]}-${last}/${step}`;
+  }
+  const parts = [];
+  for (let i = 0; i < values.length; ) {
+    let j = i;
+    while (values[j + 1] === values[j] + 1) j++;
+    if (j - i >= 2) parts.push(`${values[i]}-${values[j]}`);
+    else for (let k = i; k <= j; k++) parts.push(String(values[k]));
+    i = j + 1;
+  }
+  return parts.join(",");
+}
+
+/**
+ * Move a weekday field by whole days. Weekday lists and ranges ("1-5", "0,6",
+ * "MON-FRI") become an explicit shifted list. Other values stay as they are.
+ */
+function shiftWeekdayField(dow, dayShift) {
+  const numericDow = dow.replace(
+    /[a-z]+/gi,
+    // Unknown names become -1, which fails the pattern check below.
+    (name) => WEEKDAY_NAMES.indexOf(name.toUpperCase())
+  );
+  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(numericDow)) return dow;
+  const days = numericDow.split(",").flatMap((part) => {
+    const [from, to = from] = part.split("-").map(Number);
+    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
+  });
+  return shiftWeekdays(days, dayShift).join(",");
+}
+
+/**
+ * Move every run of a 5-field cron expression by a number of minutes. Mirrors
+ * shiftCron in server/utils/agents/aibitat/plugins/create-scheduled-job/cronUtils.js.
+ *
+ * Returns null when no single expression has the moved runs: the moved
+ * minute and hour values no longer combine into exactly the moved runs, or
+ * some runs cross midnight and others do not while a day field is set.
+ * @param {string} cron - 5-field cron expression.
+ * @param {number} shiftMinutes - Minutes to add to every run.
+ * @returns {string|null}
+ */
+function shiftCron(cron, shiftMinutes) {
   if (!cron || typeof cron !== "string") return cron;
   const parts = cron.trim().split(/\s+/);
   if (parts.length !== 5) return cron;
 
-  const [minute, hour, dom, mon, dow] = parts;
+  const [minute, hour, dom, month, dow] = parts;
+  const minutes = expandField(minute, 0, 59);
+  const hours = expandField(hour, 0, 23);
+  if (!minutes || !hours) return null;
 
-  // Only convert if hour is a specific number (not * or */n)
-  if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) {
- 
```

**File**: `server/__tests__/utils/agents/aibitat/plugins/create-scheduled-job/cronUtils.test.js` (modified, +248/-7)
```diff
@@ -1,6 +1,7 @@
 /* eslint-env jest */
 const later = require("@breejs/later");
 const {
+  shiftCron,
   convertCronLocalToUtc,
   catalogIdSet,
   readyToolsCatalog,
@@ -142,13 +143,109 @@ describe("convertCronLocalToUtc", () => {
     });
   });
 
-  describe("schedules without a specific time", () => {
-    it.each(["*/5 * * * *", "0 */2 * * 1", "* 9 * * 1", "0 9-17 * * 1"])(
-      "returns %s unchanged",
-      (cron) => {
-        expect(convertCronLocalToUtc(cron, "America/New_York")).toBe(cron);
-      }
-    );
+  describe("hourly schedules", () => {
+    it.each([
+      ["15 * * * *", "Asia/Kolkata", "45 * * * *"],
+      ["0 * * * *", "Asia/Kolkata", "30 * * * *"],
+      ["0 * * * *", "Asia/Kathmandu", "15 * * * *"],
+      ["0 * * * *", "America/St_Johns", "30 * * * *"],
+      ["15 * * * *", "America/New_York", "15 * * * *"],
+    ])("%s in %s -> %s", (cron, tz, expected) => {
+      expect(convertCronLocalToUtc(cron, tz)).toBe(expected);
+    });
+  });
+
+  describe("hour ranges, steps and lists", () => {
+    it.each([
+      ["0 9-17 * * 1-5", "Asia/Kolkata", "30 3-11 * * 1-5"],
+      ["0 9-17 * * 1-5", "America/New_York", "0 13-21 * * 1-5"],
+      ["0 9-17 * * 1-5", "Asia/Tokyo", "0 0-8 * * 1-5"],
+      ["0 */2 * * *", "Asia/Kolkata", "30 */2 * * *"],
+      ["0 */2 * * *", "Asia/Kathmandu", "15 */2 * * *"],
+      ["0 */3 * * *", "America/New_York", "0 1-22/3 * * *"],
+      ["0 9,13,17 * * *", "Asia/Kolkata", "30 3-11/4 * * *"],
+      ["0 9,12,17 * * *", "Asia/Kolkata", "30 3,6,11 * * *"],
+      ["30 8-18/2 * * *", "Asia/Kolkata", "0 3-13/2 * * *"],
+      ["* 9 * * 1", "America/New_York", "* 13 * * 1"],
+      ["0 21-23 * * 1", "America/New_York", "0 1-3 * * 2"],
+    ])("%s in %s -> %s", (cron, tz, expected) => {
+      expect(convertCronLocalToUtc(cron, tz)).toBe(expected);
+    });
+  });
+
+  describe("minute lists and steps", () => {
+    it.each([
+      ["0,30 * * * *", "Asia/Kathmandu", "15,45 * * * *"],
+      ["0,30 * * * *", "Asia/Kolkata", "0,30 * * * *"],
+      ["*/20 * * * *", "Asia/Kolkata", "10-50/20 * * * *"],
+      ["*/15 * * * *", "Asia/Kathmandu", "*/15 * * * *"],
+      ["*/5 * * * *", "America/New_York", "*/5 * * * *"],
+      ["0,30 9 * * *", "America/New_York", "0,30 13 * * *"],
+    ])("%s in %s -> %s", (cron, tz, expected) => {
+      expect(convertCronLocalToUtc(cron, tz)).toBe(expected);
+    });
+  });
+
+  describe("schedules with no single UTC expression", () => {
+    it.each([
+      // The :00 and :30 runs land in different UTC hours.
+      ["0,30 9-17 * * *", "Asia/Kolkata"],
+      ["* 9 * * *", "Asia/Kolkata"],
+      ["*/20 9 * * *", "Asia/Kolkata"],
+      // Some runs cross into the next or previous UTC day, others do not.
+      ["0 * * * 1", "America/New_York"],
+      ["15 * * * 1-5", "Asia/Kolkata"],
+      ["0 */2 * * 1", "America/New_York"],
+      ["0 9-17 * * 1-5", "Australia/Sydney"],
+      ["0 * 15 * *", "Asia/Tokyo"],
+      ["0 19-23 * * MON", "America/New_York"],
+    ])("%s in %s -> null", (cron, tz) => {
+      expect(convertCronLocalToUtc(cron, tz)).toBeNull();
+    });
+
+    it("converts the same pattern when every run stays on one day", () => {
+      expect(convertCronLocalToUtc("0 * * * 1", "UTC")).toBe("0 * * * 1");
+      expect(convertCronLocalToUtc("0 9-17 * * 1-5", "Asia/Tokyo")).toBe(
+        "0 0-8 * * 1-5"
+      );
+    });
+  });
+
+  describe("unsupported minute and hour fields", () => {
+    it.each([
+      "60 9 * * *",
+      "0 24 * * *",
+      "-1 9 * * *",
+      "*/0 * * * *",
+      "0 17-9 * * *",
+      "0,,30 9 * * *",
+      "0, 9 * * *",
+      "L 9 * * *",
+      "? 9 * * *",
+      "0 9/ * * *",
+      "0 9-* * * *",
+      "0x10 9 * * *",
+      "1e1 9 * * *",
+      "٣ 9 * * *",
+      "0 9.5 * * *",
+    ])("returns null for %s", (cron) => {
+      expect(convertCronLocalToUtc(cron, "Asia/Kolkata")).toBeNull();
+    });
+
+    it("reads leading zeros, duplicates and oversized steps", () => {
+      expect(convertCronLocalToUtc("00 09 * * *", "Asia/Kolkata")).toBe(
+        "30 3 * * *"
+      );
+      expect(convertCronLocalToUtc("0 9,9,9 * * *", "Asia/Kolkata")).toBe(
+        "30 3 * * *"
+      );
+      expect(convertCronLocalToUtc("0 */24 * * *", "America/New_York")).toBe(
+        "0 4 * * *"
+      );
+      expect(convertCronLocalToUtc("*/100 9 * * *", "America/New_York")).toBe(
+        "*/100 13 * * *"
+      );
+    });
   });
 
   describe("invalid input", () => {
@@ -329,3 +426,147 @@ describe("rejectedToolsMessage", () => {
     );
   });
 });
+
+describe("shiftCron", () => {
+  it.each([
+    // Keeps the text of fields whose values did not change.
+    ["0 0-23 * * *", 60, "0 0-23 * * *"],
+    ["*/15 9 * * *", 60, "*/15 10 * * *"],
+    // Writes changed fields as "*", steps, ranges or lists.
+    ["0 1-23 * * *", -60, "0 0-22 * * *"],
+    ["0 0,2,4 * * *", 60, "0 1-5/2 * * *"],
+    ["0 0,1 * * *", 60, "0 1,2 * * *"],
+    ["0 0,1,5 * * *", 60, "0 1,2,6 * * *"],
+
```

**File**: `server/utils/agents/aibitat/plugins/create-scheduled-job/cronUtils.js` (modified, +159/-54)
```diff
@@ -33,74 +33,178 @@ function tzOffsetMinutes(timeZone, at = new Date()) {
 const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
 
 /**
- * Convert a local hour + minute to UTC hour + minute for a given IANA timezone.
- * @param {number} localHour
- * @param {number} localMinute
- * @param {string} timeZone
- * @returns {{ hour: number, minute: number, dayShift: number }}
+ * Expand a cron minute or hour field into its sorted values. Supports numbers,
+ * ranges, steps and lists of those.
+ * @param {string} field
+ * @param {number} min
+ * @param {number} max
+ * @returns {number[]|null} null when the field has any other syntax or a value outside min-max.
+ */
+function expandField(field, min, max) {
+  const values = new Set();
+  for (const part of field.split(",")) {
+    const match = /^(?:\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
+    if (!match) return null;
+    const [, from, to, step] = match;
+    let start = min;
+    let end = max;
+    if (from !== undefined) {
+      start = Number(from);
+      end = to !== undefined ? Number(to) : step !== undefined ? max : start;
+    }
+    const increment = step !== undefined ? Number(step) : 1;
+    if (start < min || end > max || start > end || increment < 1) return null;
+    for (let v = start; v <= end; v += increment) values.add(v);
+  }
+  return [...values].sort((a, b) => a - b);
+}
+
+/**
+ * Write sorted values back as a cron field: "*", a step, or a list of
+ * numbers and ranges.
+ * @param {number[]} values
+ * @param {number} min
+ * @param {number} max
+ * @returns {string}
+ */
+function compressField(values, min, max) {
+  if (values.length === max - min + 1) return "*";
+  const step = values[1] - values[0];
+  if (
+    values.length >= 3 &&
+    step > 1 &&
+    values.every((v, i) => v === values[0] + i * step)
+  ) {
+    const last = values[values.length - 1];
+    return values[0] === min && last + step > max
+      ? `*/${step}`
+      : `${values[0]}-${last}/${step}`;
+  }
+  const parts = [];
+  for (let i = 0; i < values.length; ) {
+    let j = i;
+    while (values[j + 1] === values[j] + 1) j++;
+    if (j - i >= 2) parts.push(`${values[i]}-${values[j]}`);
+    else for (let k = i; k <= j; k++) parts.push(String(values[k]));
+    i = j + 1;
+  }
+  return parts.join(",");
+}
+
+/**
+ * Move a day-of-month field by whole days. Only a single day moves, and only
+ * when both the old and the new day are within 1-28, which every month has.
+ * Other values stay as they are.
+ */
+function shiftDayOfMonth(dom, dayShift) {
+  const shifted = Number(dom) + dayShift;
+  return /^\d+$/.test(dom) &&
+    Math.min(Number(dom), shifted) >= 1 &&
+    Math.max(Number(dom), shifted) <= 28
+    ? String(shifted)
+    : dom;
+}
+
+/**
+ * Move a weekday field by whole days. Weekday lists and ranges ("1-5", "0,6",
+ * "MON-FRI") become an explicit shifted list. Other values stay as they are.
  */
-function localToUtcHM(localHour, localMinute, timeZone) {
-  const offset = tzOffsetMinutes(timeZone);
-  const total = localHour * 60 + localMinute - offset;
-  const minutesOfDay = ((total % 1440) + 1440) % 1440;
-  return {
-    hour: Math.floor(minutesOfDay / 60),
-    minute: minutesOfDay % 60,
-    // Days the date moved (-1, 0 or 1) once converted to UTC.
-    dayShift: Math.floor(total / 1440),
-  };
+function shiftWeekdays(dow, dayShift) {
+  const numericDow = dow.replace(
+    /[a-z]+/gi,
+    // Unknown names become -1, which fails the pattern check below.
+    (name) => WEEKDAY_NAMES.indexOf(name.toUpperCase())
+  );
+  if (!/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(numericDow)) return dow;
+  const days = new Set();
+  for (const part of numericDow.split(",")) {
+    const [from, to = from] = part.split("-").map(Number);
+    for (let d = from; d <= to; d++) days.add((((d + dayShift) % 7) + 7) % 7);
+  }
+  return [...days].sort((a, b) => a - b).join(",");
 }
 
 /**
- * Convert the time and day fields of a 5-field cron expression from a user's
- * local timezone to UTC. Returns the original string unchanged if the pattern
- * has no specific hour (e.g. every-minute or every-N-hours schedules).
+ * Move every run of a 5-field cron expression by a number of minutes.
  *
- * @param {string} cron  - 5-field cron expression in local time.
- * @param {string} timeZone - IANA timezone (e.g. "America/New_York").
- * @returns {string} 5-field cron expression in UTC.
+ * Cron runs at every combination of its minute and hour values, so the moved
+ * runs must form such a combination too. In zones with a 30 or 45 minute
+ * offset, "0,30 9-17 * * *" does not: its :00 and :30 runs land in different
+ * sets of hours. Runs that cross midnight also need the day fields to move by
+ * the same number of days, which is impossible when some runs cross and some
+ * do not (e.g. "0 * * * 1"). Both cases return null.
+ *
+ * Month fields never move. Day fields move by the rules of shiftDayOfMonth
+ * and shiftWeekdays.
+ *
+ * @param {stri
```

**File**: `server/utils/agents/aibitat/plugins/create-scheduled-job/index.js` (modified, +3/-0)
```diff
@@ -125,6 +125,9 @@ const createScheduledJob = {
             const userId = this.super.handlerProps.invocation?.user_id ?? null;
             const { timezone } = UserMetaCache.get(userId);
             const cron = convertCronLocalToUtc(localCron, timezone);
+            if (!cron) {
+              return `'${localCron}' cannot be stored as a single schedule in the ${timezone} time zone, because its run times do not map onto one UTC cron expression. Split it into separate jobs so that each one uses a single minute value and its hours stay on the same day (e.g. '0 9 * * 1-5' and '0 10-17 * * 1-5' instead of '0 9-17 * * 1-5').`;
+            }
 
             // Resolve the tools the job may use. A scheduled job can ONLY use
             // the tools stored on it, and - exactly like the manual Scheduled
```

---

### Incident Patch 14: `c70bd2b5` (2026-10-03)
**Commit Message**: fix: apply TOOL_CALL_APPROVAL_TIMEOUT_MS to Telegram tool approvals (#6601)

Agent tool approvals requested over Telegram still expired after 2 minutes when TOOL_CALL_APPROVAL_TIMEOUT_MS was set, so the Approve/Deny message timed out and the tool was denied. The http-socket plugin hard-coded the 120 second timeout while the websocket plugin already reads the variable. The http-socket plugin now uses the websocket plugin's parser for both the IPC timeoutMs and its own timer, keeping the 2 minute default.

**File**: `server/utils/agents/aibitat/plugins/http-socket.js` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@ const chalk = require("chalk");
 const { Telemetry } = require("../../../../models/telemetry");
 const { v4: uuidv4 } = require("uuid");
 const { skillIsAutoApproved } = require("../../../helpers/agents");
-const TOOL_APPROVAL_TIMEOUT_MS = 120 * 1_000; // 2 mins for tool approval
+const { toolApprovalTimeoutMs } = require("./websocket.js");
+const TOOL_APPROVAL_TIMEOUT_MS = toolApprovalTimeoutMs();
 
 /**
  * Get the IPC channel for worker communication.
```

**File**: `server/utils/agents/aibitat/plugins/websocket.js` (modified, +1/-0)
```diff
@@ -531,4 +531,5 @@ const websocket = {
 module.exports = {
   websocket,
   WEBSOCKET_BAIL_COMMANDS,
+  toolApprovalTimeoutMs,
 };
```

---

### Incident Patch 15: `902fc93a` (2026-10-03)
**Commit Message**: fix: show an error when a system prompt variable change fails (#6604)

Refused or failed variable changes were reported as successful because the model returns a failure result instead of throwing. Check the result of create, update, and delete before changing the UI. Keep the existing generic error messages so server details are not displayed.

**File**: `frontend/src/pages/Admin/SystemPromptVariables/AddVariableModal/index.jsx` (modified, +3/-1)
```diff
@@ -27,7 +27,9 @@ export default function AddVariableModal({ closeModal, onRefresh }) {
     }
 
     try {
-      await System.promptVariables.create(newVariable);
+      const { success, error } =
+        await System.promptVariables.create(newVariable);
+      if (!success) throw new Error(error);
       showToast("Variable created successfully", "success", { clear: true });
       if (onRefresh) onRefresh();
       closeModal();
```

**File**: `frontend/src/pages/Admin/SystemPromptVariables/VariableRow/EditVariableModal/index.jsx` (modified, +5/-1)
```diff
@@ -28,7 +28,11 @@ export default function EditVariableModal({ variable, closeModal, onRefresh }) {
     }
 
     try {
-      await System.promptVariables.update(variable.id, updatedVariable);
+      const { success, error } = await System.promptVariables.update(
+        variable.id,
+        updatedVariable
+      );
+      if (!success) throw new Error(error);
       showToast("Variable updated successfully", "success", { clear: true });
       if (onRefresh) onRefresh();
       closeModal();
```

**File**: `frontend/src/pages/Admin/SystemPromptVariables/VariableRow/index.jsx` (modified, +4/-1)
```diff
@@ -28,7 +28,10 @@ export default function VariableRow({ variable, onRefresh }) {
       return false;
 
     try {
-      await System.promptVariables.delete(variable.id);
+      const { success, error } = await System.promptVariables.delete(
+        variable.id
+      );
+      if (!success) throw new Error(error);
       rowRef?.current?.remove();
       showToast("Variable deleted successfully", "success", { clear: true });
       if (onRefresh) onRefresh();
```

#### Recent Merged Pull Requests:
- **PR #6637** (2026-10-05): fix: finalize stopped scheduled job runs on Windows (@dakjdakd)
- **PR #6635** (2026-10-05): fix: isolate chat attachment state and uploads by conversation (@dakjdakd)
- **PR #6633** (2026-10-05): fix: preserve referenced MBOX chat attachments during orphan cleanup (@dakjdakd)
- **PR #6631** (2026-10-05): fix: restore dropped i18n values in model router and model picker strings (@theluckystrike)
- **PR #6629** (2026-10-05): fix: show an error when embedding attached files into the workspace fails (@marmar9615-cloud)
- **PR #6628** (2026-10-05): fix: load the next page of documents from the server's offset in the picker (@marmar9615-cloud)
- **PR #6625** (2026-10-05): fix: return 404 for an unknown workspace on manage-users and update-pin (@marmar9615-cloud)
- **PR #6623** (2026-10-05): fix: attach requested files to Outlook replies and reply drafts (@marmar9615-cloud)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
