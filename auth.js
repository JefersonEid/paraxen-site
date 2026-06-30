import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
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

let authActionInProgress = false;
const authTimeoutMs = 15000;

function setMessage(target, message, type = "info") {
  if (!target) return;
  target.textContent = message;
  target.dataset.type = type;
}

function setLoading(form, isLoading) {
  if (!form) return;
  form.querySelectorAll("input, button").forEach((field) => {
    field.disabled = isLoading;
  });
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;

  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.defaultText;
}

function irParaHome() {
  window.location.href = "index.html";
}

function criarErroTimeout() {
  const error = new Error("Tempo esgotado ao conectar com o Firebase.");
  error.code = "auth/request-timeout";
  return error;
}

function comTimeout(promise) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(criarErroTimeout());
    }, authTimeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function bloquearGoogleEmArquivoLocal() {
  if (window.location.protocol !== "file:") return;

  const error = new Error("Google Auth não suporta páginas abertas por file://.");
  error.code = "auth/file-protocol";
  throw error;
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
  bloquearGoogleEmArquivoLocal();
  authActionInProgress = true;
  try {
    const result = await comTimeout(signInWithPopup(auth, googleProvider));
    try {
      await saveUserProfile(result.user, result.user.displayName, Boolean(result._tokenResponse?.isNewUser));
    } catch (error) {
      console.warn("Conta autenticada, mas o perfil não foi salvo no Firestore.", error);
    }
    irParaHome();
  } catch (error) {
    const code = error?.code || "";
    if (code.includes("popup-blocked") || code.includes("operation-not-supported-in-this-environment")) {
      await comTimeout(signInWithRedirect(auth, googleProvider));
      return;
    }
    authActionInProgress = false;
    throw error;
  }
}

export async function cadastrarComEmail(nome, email, senha) {
  try {
    authActionInProgress = true;
    const credential = await comTimeout(createUserWithEmailAndPassword(auth, email, senha));
    await comTimeout(updateProfile(credential.user, {
      displayName: nome
    }));
    try {
      await saveUserProfile(credential.user, nome, true);
    } catch (error) {
      console.warn("Conta criada, mas o perfil não foi salvo no Firestore.", error);
    }
  } catch (error) {
    authActionInProgress = false;
    throw error;
  }
}

export async function entrarComEmail(email, senha) {
  try {
    authActionInProgress = true;
    const credential = await comTimeout(signInWithEmailAndPassword(auth, email, senha));
    try {
      await saveUserProfile(credential.user, credential.user.displayName);
    } catch (error) {
      console.warn("Login concluído, mas o perfil não foi salvo no Firestore.", error);
    }
    irParaHome();
  } catch (error) {
    authActionInProgress = false;
    throw error;
  }
}

export async function recuperarSenha(email) {
  await comTimeout(sendPasswordResetEmail(auth, email));
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
    el.textContent = user.displayName || user.email || "Usuário";
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
  if (code.includes("file-protocol")) {
    return "Login com Google não funciona abrindo o arquivo direto. Use o site publicado ou um servidor local.";
  }
  if (code.includes("unauthorized-domain")) {
    return "Domínio não autorizado no Firebase para login com Google.";
  }
  if (code.includes("operation-not-allowed")) {
    return "Login com Google não está habilitado no Firebase.";
  }
  if (code.includes("invalid-auth-event")) {
    return "Login com Google não está configurado corretamente no Firebase.";
  }
  if (code.includes("popup-closed-by-user")) return "Login com Google cancelado.";
  if (code.includes("popup-blocked")) return "O navegador bloqueou a janela do Google.";
  if (code.includes("network-request-failed")) return "Falha de conexão com o Firebase.";
  if (code.includes("request-timeout")) {
    return "A conexão demorou demais. Verifique a internet, desative bloqueadores e tente novamente.";
  }
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

function initAuthPageRedirect() {
  const isAuthPage = document.querySelector("[data-login-form], [data-cadastro-form]");
  if (!isAuthPage) return;

  observarUsuario((user) => {
    if (user && !authActionInProgress) {
      irParaHome();
    }
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
        setMessage(message, "Abrindo login do Google...", "info");
        setButtonLoading(button, true, "Abrindo Google...");
        await entrarComGoogle();
      } catch (error) {
        setMessage(message, traduzirErro(error), "error");
        setButtonLoading(button, false);
      }
    });
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);

    try {
      setMessage(message, "Entrando...", "info");
      setLoading(loginForm, true);
      await entrarComEmail(form.get("email").trim(), form.get("senha"));
    } catch (error) {
      setMessage(message, traduzirErro(error), "error");
      setLoading(loginForm, false);
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
      setLoading(resetForm, true);
      await recuperarSenha(email);
      setMessage(message, "Enviamos um link de recuperação para seu e-mail.", "success");
    } catch (error) {
      setMessage(message, traduzirErro(error), "error");
    } finally {
      setLoading(resetForm, false);
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
        setMessage(message, "Abrindo login do Google...", "info");
        setButtonLoading(button, true, "Abrindo Google...");
        await entrarComGoogle();
      } catch (error) {
        setMessage(message, traduzirErro(error), "error");
        setButtonLoading(button, false);
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
      setLoading(cadastroForm, true);
      await cadastrarComEmail(nome, email, senha);
      setMessage(message, "Cadastro efetuado com sucesso.", "success");
      window.setTimeout(irParaHome, 1200);
    } catch (error) {
      setMessage(message, traduzirErro(error), "error");
      setLoading(cadastroForm, false);
    }
  });
}

function initAuthScreenClose() {
  document.querySelectorAll(".auth-screen").forEach((screen) => {
    if (screen.classList.contains("profile-screen")) return;

    screen.addEventListener("click", (event) => {
      if (event.target === screen) {
        window.location.href = "index.html";
      }
    });
  });
}

initHeaderAuth();
initAuthScreenClose();
initAuthPageRedirect();
initLoginPage();
initCadastroPage();
