import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { auth, db, googleProvider } from "./firebase-config.js";

const defaultAvatar =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23040b12'/%3E%3Ccircle cx='80' cy='58' r='30' fill='%2319e6ff' fill-opacity='.9'/%3E%3Cpath d='M30 142c8-31 28-47 50-47s42 16 50 47' fill='%23246dff' fill-opacity='.8'/%3E%3C/svg%3E";

function setMessage(target, message, type = "info") {
  if (!target) return;
  target.textContent = message;
  target.dataset.type = type;
}

function getProvider(user) {
  return user.providerData[0]?.providerId || "password";
}

async function saveUserProfile(user, nome, isNewUser = false) {
  const userRef = doc(db, "usuarios", user.uid);
  const snapshot = await getDoc(userRef);
  const baseData = {
    uid: user.uid,
    nome: nome || user.displayName || "Usuário Paráxen",
    email: user.email || "",
    foto: user.photoURL || "",
    provedor: getProvider(user),
    ultimoLogin: serverTimestamp()
  };

  if (isNewUser || !snapshot.exists()) {
    await setDoc(userRef, {
      ...baseData,
      dataCriacao: serverTimestamp()
    }, { merge: true });
    return;
  }

  await setDoc(userRef, baseData, { merge: true });
}

export async function entrarComGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await saveUserProfile(result.user, result.user.displayName, Boolean(result._tokenResponse?.isNewUser));
  window.location.href = "perfil.html";
}

export async function cadastrarComEmail(nome, email, senha) {
  const credential = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(credential.user, {
    displayName: nome
  });
  await saveUserProfile(credential.user, nome, true);
  window.location.href = "perfil.html";
}

export async function entrarComEmail(email, senha) {
  const credential = await signInWithEmailAndPassword(auth, email, senha);
  await saveUserProfile(credential.user, credential.user.displayName);
  window.location.href = "perfil.html";
}

export async function recuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function sair() {
  await signOut(auth);
  window.location.href = "index.html";
}

export function observarUsuario(callback) {
  return onAuthStateChanged(auth, callback);
}

export function renderAuthState(user) {
  const guestEls = document.querySelectorAll("[data-auth-guest]");
  const userEls = document.querySelectorAll("[data-auth-user]");
  const nameEls = document.querySelectorAll("[data-auth-name]");
  const emailEls = document.querySelectorAll("[data-auth-email]");
  const photoEls = document.querySelectorAll("[data-auth-photo]");

  guestEls.forEach((el) => {
    el.hidden = Boolean(user);
  });

  userEls.forEach((el) => {
    el.hidden = !user;
  });

  if (!user) return;

  nameEls.forEach((el) => {
    el.textContent = user.displayName || "Meu Perfil";
  });

  emailEls.forEach((el) => {
    el.textContent = user.email || "";
  });

  photoEls.forEach((el) => {
    el.src = user.photoURL || defaultAvatar;
    el.alt = user.displayName ? `Foto de ${user.displayName}` : "Foto do usuário";
  });
}

function traduzirErro(error) {
  const code = error?.code || "";

  if (code.includes("email-already-in-use")) return "Este e-mail já está cadastrado.";
  if (code.includes("invalid-email")) return "Informe um e-mail válido.";
  if (code.includes("weak-password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "E-mail ou senha inválidos.";
  }
  if (code.includes("popup-closed-by-user")) return "Login com Google cancelado.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Tente novamente mais tarde.";

  return "Não foi possível concluir a ação. Tente novamente.";
}

function initHeaderAuth() {
  observarUsuario(renderAuthState);

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      await sair();
    });
  });
}

function initLoginPage() {
  const loginForm = document.querySelector("[data-login-form]");
  const resetForm = document.querySelector("[data-reset-form]");
  const googleButtons = document.querySelectorAll("[data-google-login]");
  const message = document.querySelector("[data-auth-message]");

  googleButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await entrarComGoogle();
      } catch (error) {
        setMessage(message, traduzirErro(error), "error");
        button.disabled = false;
      }
    });
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);

    try {
      setMessage(message, "Entrando...", "info");
      await entrarComEmail(form.get("email").trim(), form.get("senha"));
    } catch (error) {
      setMessage(message, traduzirErro(error), "error");
    }
  });

  resetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(resetForm);
    const email = form.get("email").trim();

    if (!email) {
      setMessage(message, "Informe seu e-mail para recuperar a senha.", "error");
      return;
    }

    try {
      await recuperarSenha(email);
      setMessage(message, "Enviamos um link de recuperação para seu e-mail.", "success");
    } catch (error) {
      setMessage(message, traduzirErro(error), "error");
    }
  });
}

function initCadastroPage() {
  const cadastroForm = document.querySelector("[data-cadastro-form]");
  const googleButtons = document.querySelectorAll("[data-google-login]");
  const message = document.querySelector("[data-auth-message]");

  googleButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await entrarComGoogle();
      } catch (error) {
        setMessage(message, traduzirErro(error), "error");
        button.disabled = false;
      }
    });
  });

  cadastroForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(cadastroForm);
    const nome = form.get("nome").trim();
    const email = form.get("email").trim();
    const senha = form.get("senha");
    const confirmarSenha = form.get("confirmarSenha");

    if (senha !== confirmarSenha) {
      setMessage(message, "As senhas não conferem.", "error");
      return;
    }

    try {
      setMessage(message, "Criando sua conta...", "info");
      await cadastrarComEmail(nome, email, senha);
    } catch (error) {
      setMessage(message, traduzirErro(error), "error");
    }
  });
}

initHeaderAuth();
initLoginPage();
initCadastroPage();
