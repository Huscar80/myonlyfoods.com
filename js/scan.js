// myonlyfoods — read a photo of a recipe card in the browser (free, no server).
// Uses Tesseract.js, which downloads its reading files the first time it's used.

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (window.Tesseract) return resolve();
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Couldn't load the card reader. Check your internet connection."));
        document.head.appendChild(s);
    });
}

// Make the photo easier to read: shrink huge phone photos, turn it gray and boost contrast.
async function prepareImage(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error("That photo couldn't be opened."));
            i.src = url;
        });
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
            const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            const v = Math.max(0, Math.min(255, (g - 128) * 1.5 + 128));
            px[i] = px[i + 1] = px[i + 2] = v;
        }
        ctx.putImageData(data, 0, 0);
        return c;
    } finally {
        URL.revokeObjectURL(url);
    }
}

// Reads the text on the card. onProgress gets a number from 0 to 1.
export async function readCard(file, onProgress = () => {}) {
    await loadScript(TESSERACT_URL);
    const image = await prepareImage(file);
    const worker = await window.Tesseract.createWorker("eng", 1, {
        logger: (m) => { if (m.status === "recognizing text") onProgress(m.progress); },
    });
    try {
        const { data } = await worker.recognize(image);
        return data.text || "";
    } finally {
        await worker.terminate();
    }
}

// ---------- Turning the text into a recipe ----------

const UNITS = "cups?|c\\.|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|quarts?|qts?|pints?|pts?|cans?|jars?|pkgs?|packages?|sticks?|cloves?|slices?|pinch|dash|bunch|heads?|stalks?";
const AMOUNT_START = /^(\d+|[½⅓⅔¼¾⅛]|\d+\s*\/\s*\d+|one|two|three|four|five|six|a|an|half)\b/i;
const HAS_UNIT = new RegExp(`\\b(${UNITS})\\b`, "i");
const INGREDIENTS_HEAD = /^(ingredients?|you(?:'|’)?ll need|what you need)\s*:?\s*$/i;
const STEPS_HEAD = /^(directions?|instructions?|method|steps?|preparation|how to make( it)?)\s*:?\s*$/i;
const NOISE = /^(recipe|from the (kitchen|desk) of.*|recipe for|title)\s*:?\s*$/i;

function clean(line) {
    return line
        .replace(/[|_~`^]+/g, " ")          // stray marks the reader picks up from card lines
        .replace(/^[\s•·*\-–—>]+/, "")      // bullets
        .replace(/\s{2,}/g, " ")
        .trim();
}

// inList: we're still in the part of the card where ingredients are listed,
// so a short plain line like "Cheese, lettuce, salsa" counts too.
function looksLikeIngredient(line, inList = false) {
    const words = line.split(" ").length;
    if (line.length > 70) return false;
    if (/[.!]$/.test(line) && words > 3) return false; // full sentences are steps
    if (AMOUNT_START.test(line)) return true;
    if (HAS_UNIT.test(line) && words <= 8) return true;
    return inList && words <= 6;
}

function stripStepNumber(line) {
    return line.replace(/^(step\s*)?\d+\s*[.):-]\s*/i, "");
}

// Joins lines that were broken mid-sentence on the card.
function joinSentences(lines) {
    const out = [];
    lines.forEach((line) => {
        const startsNew = /^(step\s*)?\d+\s*[.):-]/i.test(line) || /^[A-Z]/.test(line);
        const prev = out[out.length - 1];
        if (prev && !/[.!?:]$/.test(prev) && !startsNew) out[out.length - 1] = `${prev} ${line}`;
        else if (prev && !/[.!?:]$/.test(prev) && /^[a-z(]/.test(line)) out[out.length - 1] = `${prev} ${line}`;
        else out.push(line);
    });
    return out.map(stripStepNumber).filter((s) => s.length > 2);
}

export function parseRecipeText(text) {
    const result = { title: "", ingredients: [], steps: [], servings: "", prepTime: "", cookTime: "" };
    let lines = String(text || "").split(/\r?\n/).map(clean).filter((l) => l.length > 1);

    // Pull out servings and times wherever they appear.
    lines = lines.filter((line) => {
        let m;
        if ((m = line.match(/\b(?:serves|servings?|yield|makes)\s*:?\s*(\d+(?:\s*(?:-|to)\s*\d+)?)/i)) && line.length < 40) { result.servings = m[1].replace(/\s+/g, ""); return false; }
        if ((m = line.match(/\bprep(?:aration)?(?:\s*time)?\s*:?\s*(.+)$/i)) && line.length < 40) { result.prepTime = m[1].trim(); return false; }
        if ((m = line.match(/\b(?:cook(?:ing)?|bake|baking)\s*time\s*:?\s*(.+)$/i)) && line.length < 40) { result.cookTime = m[1].trim(); return false; }
        return true;
    });

    // Title: a "Recipe: X" line, else the first short line that isn't a heading or an ingredient.
    for (let i = 0; i < lines.length && i < 4; i++) {
        const m = lines[i].match(/^(?:recipe|title)\s*:\s*(.+)$/i);
        if (m) { result.title = m[1]; lines.splice(i, 1); break; }
        if (NOISE.test(lines[i])) { lines.splice(i, 1); i--; continue; }
        if (!INGREDIENTS_HEAD.test(lines[i]) && !STEPS_HEAD.test(lines[i]) && !looksLikeIngredient(lines[i]) && lines[i].length <= 60) {
            result.title = lines[i].replace(/[.:]+$/, "");
            lines.splice(i, 1);
            break;
        }
    }

    const ingHead = lines.findIndex((l) => INGREDIENTS_HEAD.test(l));
    const stepHead = lines.findIndex((l) => STEPS_HEAD.test(l));

    if (ingHead !== -1 || stepHead !== -1) {
        // The card has headings: use them.
        const ingStart = ingHead === -1 ? 0 : ingHead + 1;
        const ingEnd = stepHead > ingStart ? stepHead : (ingHead === -1 ? stepHead : lines.length);
        const ingLines = lines.slice(ingStart, ingEnd === -1 ? lines.length : ingEnd);
        const stepLines = stepHead === -1 ? [] : lines.slice(stepHead + 1);
        // Some cards list ingredients after the steps; catch ingredient-looking lines either way.
        result.ingredients = ingLines.filter((l) => !STEPS_HEAD.test(l));
        result.steps = joinSentences(stepLines.filter((l) => !INGREDIENTS_HEAD.test(l)));
        if (ingHead === -1) {
            result.ingredients = ingLines.filter(looksLikeIngredient);
        }
    } else {
        // No headings: short lines with amounts are ingredients, the rest are steps.
        const ing = [], rest = [];
        let seenStep = false;
        lines.forEach((l) => {
            if (!seenStep && looksLikeIngredient(l, ing.length > 0)) ing.push(l);
            else { rest.push(l); seenStep = true; }
        });
        result.ingredients = ing;
        result.steps = joinSentences(rest);
    }

    result.ingredients = result.ingredients.map((l) => l.replace(/\s+([,.])/g, "$1")).filter((l) => l.length > 1);
    return result;
}
