import {
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { observarUsuario, renderAuthState, sair } from "./auth.js";

const defaultAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23040b12'/%3E%3Ccircle cx='80' cy='58' r='30' fill='%2319e6ff' fill-opacity='.9'/%3E%3Cpath d='M30 142c8-31 28-47 50-47s42 16 50 47' fill='%23246dff' fill-opacity='.8'/%3E%3C/svg%3E";

const form = document.querySelector("[data-profile-form]");
const message = document.querySelector("[data-profile-message]");
const editButton = document.querySelector("[data-edit-profile]");
const logoutButtons = document.querySelectorAll("[data-profile-logout]");
const nameInput = document.querySelector("#perfil-nome");
const emailInput = document.querySelector("#perfil-email");
const photo = document.querySelector("[data-profile-photo]");

function setMessage(text, type = "info") {
  if (!message) return;
  message.textContent = text;
  message.dataset.type = type;
}

async function loadFirestoreProfile(user) {
  const snapshot = await getDoc(doc(db, "usuarios", user.uid));
  return snapshot.exists() ? snapshot.data() : {};
}

function setEditMode(enabled) {
  if (nameInput) nameInput.disabled = !enabled;
  form?.classList.toggle("is-editing", enabled);
  if (editButton) editButton.textContent = enabled ? "Salvar perfil" : "Editar perfil";
}

observarUsuario(async (user) => {
  renderAuthState(user);

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const firestoreProfile = await loadFirestoreProfile(user);
  const nome = firestoreProfile.nome || user.displayName || "Usuário Paráxen";
  const foto = firestoreProfile.foto || user.photoURL || defaultAvatar;

  if (nameInput) nameInput.value = nome;
  if (emailInput) emailInput.value = firestoreProfile.email || user.email || "";
  if (photo) {
    photo.src = foto;
    photo.alt = `Foto de ${nome}`;
  }
});

editButton?.addEventListener("click", async () => {
  if (!auth.currentUser) return;

  if (!form?.classList.contains("is-editing")) {
    setEditMode(true);
    nameInput?.focus();
    return;
  }

  const nome = nameInput.value.trim();

  if (!nome) {
    setMessage("Informe um nome para o perfil.", "error");
    return;
  }

  try {
    await updateProfile(auth.currentUser, { displayName: nome });
    await setDoc(doc(db, "usuarios", auth.currentUser.uid), {
      uid: auth.currentUser.uid,
      nome,
      email: auth.currentUser.email || "",
      foto: auth.currentUser.photoURL || "",
      provedor: auth.currentUser.providerData[0]?.providerId || "password",
      ultimoLogin: serverTimestamp()
    }, { merge: true });

    setEditMode(false);
    renderAuthState(auth.currentUser);
    setMessage("Perfil atualizado.", "success");
  } catch (error) {
    setMessage("Não foi possível atualizar o perfil.", "error");
  }
});

logoutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    await sair();
  });
});
