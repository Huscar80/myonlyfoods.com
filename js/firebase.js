// myonlyfoods — shared Firebase setup and page helpers
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getCountFromServer, arrayUnion, arrayRemove, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// These values are safe to have in public code. Your data is protected by the
// security rules in firestore.rules and storage.rules, not by hiding this.
const firebaseConfig = {
    apiKey: "AIzaSyBKgYfFzvjy47pmIK_G1D9yon8NjjX5lmI",
    authDomain: "myonlyfoods-e9ee8.firebaseapp.com",
    projectId: "myonlyfoods-e9ee8",
    storageBucket: "myonlyfoods-e9ee8.firebasestorage.app",
    messagingSenderId: "790098672248",
    appId: "1:790098672248:web:cdac6a3911a7ba82860b8d",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ---------- Small helpers ----------

// Escape text before putting it into HTML, so a recipe named "<b>" can't break the page.
export function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export const icons = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    plate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
};

export function photoHtml(url, alt) {
    if (url) return `<img src="${esc(url)}" alt="${esc(alt || "")}" loading="lazy">`;
    return `${icons.plate}<span>No photo yet</span>`;
}

// Shows a short message at the bottom of the screen. Pass { action, onAction }
// to add a button, such as "Undo".
export function toast(message, opts = {}) {
    let el = document.getElementById("toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "toast";
        el.className = "toast";
        el.setAttribute("role", "status");
        document.body.appendChild(el);
    }
    el.textContent = message;
    if (opts.action && opts.onAction) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "toast-action";
        b.textContent = opts.action;
        b.addEventListener("click", () => { el.classList.remove("show"); opts.onAction(); });
        el.appendChild(b);
    }
    el.classList.toggle("has-action", !!opts.action);
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), opts.action ? 6000 : 2800);
}

// Turn Firebase's error codes into plain English.
export function friendlyError(error) {
    const code = error?.code || "";
    const map = {
        "auth/invalid-credential": "That email and password don't match. Please try again.",
        "auth/wrong-password": "That email and password don't match. Please try again.",
        "auth/user-not-found": "We couldn't find an account with that email.",
        "auth/invalid-email": "That doesn't look like a valid email address.",
        "auth/email-already-in-use": "There's already an account with that email. Try signing in instead.",
        "auth/weak-password": "Please use a password with at least 6 characters.",
        "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
        "auth/network-request-failed": "Couldn't reach the server. Check your internet connection.",
        "permission-denied": "You don't have permission to do that. (The Firebase security rules may need updating.)",
        "storage/unauthorized": "Photo upload isn't allowed right now. Check Firebase Storage is turned on.",
    };
    return map[code] || "Something went wrong. Please try again.";
}

// ---------- Auth ----------

// Resolves with the signed-in user, or sends visitors to the login page.
export function requireUser() {
    return new Promise((resolve) => {
        const stop = onAuthStateChanged(auth, (user) => {
            stop();
            if (user) resolve(user);
            else window.location.replace("login.html");
        });
    });
}

export function logout() {
    signOut(auth).then(() => window.location.replace("./"));
}

// ---------- Header ----------

export function renderHeader(active) {
    const slot = document.getElementById("site-header");
    if (!slot) return;
    const cur = (name) => (name === active ? ' aria-current="page"' : "");
    slot.className = "site-header";
    slot.innerHTML = `
      <div class="inner">
        <a class="brand" href="home.html"><img src="images/mainlogo.jpg" alt="">myonlyfoods</a>
        <nav class="main-nav" aria-label="Main">
          <a href="home.html"${cur("home")}>Home</a>
          <a href="dashboard.html"${cur("recipes")}>My recipes</a>
          <a href="planner.html"${cur("planner")}>Meal plan</a>
          <a href="profile.html"${cur("profile")}>Profile</a>
          <span class="soon">Browse <span class="badge badge-soon">Soon</span></span>
        </nav>
        <div class="header-actions">
          <a class="btn btn-primary" href="editor.html">${icons.plus}New recipe</a>
          <button class="btn btn-plain" type="button" id="logout-btn">Log out</button>
        </div>
      </div>`;
    document.getElementById("logout-btn").addEventListener("click", logout);
}

// ---------- Recipes ----------

export const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Salads", "Sides", "Desserts", "Sauces", "Drinks"];
export const CUISINES = ["None", "Mexican", "Italian", "BBQ", "Southern", "Asian"];

// Older recipes were saved with a slightly different shape. This makes every
// recipe look the same to the pages, without changing what's stored.
export function normalizeRecipe(id, data) {
    const d = data || {};
    let category = d.category || "Dinner";
    if (category === "Deserts") category = "Desserts";
    let steps = Array.isArray(d.steps) ? d.steps : null;
    if (!steps) {
        steps = String(d.instructions || "")
            .split(/\n\s*\n|\n/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return {
        id,
        title: d.title || "Untitled recipe",
        description: d.description || "",
        category,
        subCategory: d.subCategory && d.subCategory !== "None" ? d.subCategory : "",
        ingredients: Array.isArray(d.ingredients) ? d.ingredients.filter((i) => String(i).trim()) : [],
        steps,
        notes: d.notes || "",
        prepTime: d.prepTime || "",
        cookTime: d.cookTime || "",
        servings: d.servings || "",
        photoURL: d.photoURL || "",
        collections: Array.isArray(d.collections) ? d.collections : [],
        visibility: d.visibility || "private",
        price: d.price || "",
        savedFrom: d.savedFrom || null,
        createdAt: d.createdAt,
    };
}

// ---------- Sharing ----------
// Recipes marked Public are copied to a shared "publicRecipes" list so other
// people can find them. Private and For sale recipes are never copied there.
export async function syncPublicRecipe(user, recipeId, data) {
    const ref = doc(db, "publicRecipes", recipeId);
    if (data.visibility !== "public") {
        await deleteDoc(ref).catch(() => {}); // fine if it was never shared
        return;
    }
    let ownerName = user.displayName || "";
    try {
        const p = await getDoc(doc(db, "profiles", user.uid));
        if (p.exists() && p.data().name) ownerName = p.data().name;
    } catch { /* keep displayName */ }
    await setDoc(ref, {
        ownerId: user.uid,
        ownerName: ownerName || "A home cook",
        title: data.title || "",
        description: data.description || "",
        category: data.category || "",
        subCategory: data.subCategory || "",
        prepTime: data.prepTime || "",
        cookTime: data.cookTime || "",
        servings: data.servings || "",
        ingredients: data.ingredients || [],
        steps: data.steps || [],
        notes: data.notes || "",
        photoURL: data.photoURL || "",
        updatedAt: new Date(),
    });
}

// Copy someone's public recipe into your own book. Saving the same one twice
// just updates your copy, because the copy's id is based on the original's.
export async function saveCopy(user, pubId, pub) {
    const copyId = `saved_${pubId}`;
    await setDoc(doc(db, "profiles", user.uid, "recipes", copyId), {
        title: pub.title || "Untitled recipe",
        description: pub.description || "",
        category: pub.category || "Dinner",
        subCategory: pub.subCategory || "None",
        prepTime: pub.prepTime || "",
        cookTime: pub.cookTime || "",
        servings: pub.servings || "",
        ingredients: pub.ingredients || [],
        steps: pub.steps || [],
        instructions: (pub.steps || []).join("\n"),
        notes: pub.notes || "",
        photoURL: pub.photoURL || "",
        collections: [],
        visibility: "private",
        price: "",
        savedFrom: { recipeId: pubId, ownerId: pub.ownerId || "", ownerName: pub.ownerName || "" },
        createdAt: new Date(),
        updatedAt: new Date(),
    }, { merge: true });
    return copyId;
}

// ---------- Likes ----------
// Each like on a shared recipe is one small record named after the person who
// liked it, so nobody can like the same recipe twice. The count is just how
// many of those records exist.
export async function likeCount(pubId) {
    const snap = await getCountFromServer(collection(db, "publicRecipes", pubId, "likes"));
    return snap.data().count;
}

// How many likes a shared recipe got on or after a date.
export async function likeCountSince(pubId, since) {
    const q = query(collection(db, "publicRecipes", pubId, "likes"), where("createdAt", ">=", since));
    const snap = await getCountFromServer(q);
    return snap.data().count;
}

export function likePill(n, small) {
    return `<span class="like-pill${small ? " small" : ""}" title="${n} ${n === 1 ? "like" : "likes"}">${heartIcon}${n}</span>`;
}

export async function isLiked(user, pubId) {
    const snap = await getDoc(doc(db, "publicRecipes", pubId, "likes", user.uid));
    return snap.exists();
}

// Likes (or unlikes) a shared recipe, and remembers it for your suggestions.
export async function setLike(user, pubId, on) {
    const likeRef = doc(db, "publicRecipes", pubId, "likes", user.uid);
    const prefsRef = doc(db, "profiles", user.uid, "prefs", "suggestions");
    if (on) await setDoc(likeRef, { createdAt: new Date() });
    else await deleteDoc(likeRef);
    await setDoc(prefsRef, { liked: on ? arrayUnion("pub:" + pubId) : arrayRemove("pub:" + pubId) }, { merge: true });
}

export const heartIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

export function unpublishRecipe(recipeId) {
    return deleteDoc(doc(db, "publicRecipes", recipeId)).catch(() => {});
}

export function totalTime(r) {
    return [r.prepTime, r.cookTime].filter(Boolean).join(" + ");
}

export function visibilityBadge(r) {
    if (r.visibility === "sale") {
        return `<span class="badge badge-sale">For sale${r.price ? " · $" + esc(r.price) : ""}</span>`;
    }
    if (r.visibility === "public") return '<span class="badge badge-public">Public</span>';
    return '<span class="badge badge-private">Private</span>';
}

// ---------- Photos ----------

// Shrinks a photo in the browser before upload, so pages load fast and storage stays small.
export async function shrinkImage(file, maxSize = 1600, quality = 0.82) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = reject;
            i.src = url;
        });
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function uploadImage(path, blob) {
    const r = ref(storage, path);
    await uploadBytes(r, blob, { contentType: "image/jpeg" });
    return getDownloadURL(r);
}
