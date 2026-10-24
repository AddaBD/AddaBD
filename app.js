console.log("AddaBD app.js loaded");
console.log("Firebase:", typeof firebase);$ = (id) => document.getElementById(id);

const loginPanel = $("loginPanel");
const chatPanel = $("chatPanel");
const sendOtpBtn = $("sendOtpBtn");
const verifyOtpBtn = $("verifyOtpBtn");
const logoutBtn = $("logoutBtn");
const statusEl = $("status");
const messagesEl = $("messages");

let confirmationResult = null;
let unsubscribeMessages = null;
let recaptchaVerifier = null;
let currentUser = null;

$("year").textContent = new Date().getFullYear();

function setLoginStatus(message) {
  $("loginPanel").querySelector("p").textContent = message;
}

function showError(error) {
  console.error(error);
  const code = error?.code || "";
  const messages = {
    "auth/invalid-phone-number": "ফোন নম্বরটি সঠিক নয়। +880 দিয়ে লেখো।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।",
    "auth/invalid-verification-code": "OTP সঠিক নয়। আবার পরীক্ষা করো।",
    "auth/code-expired": "OTP-এর মেয়াদ শেষ। নতুন OTP নাও।",
    "auth/unauthorized-domain": "Firebase-এ এই ওয়েব ডোমেইন অনুমোদন করতে হবে।",
    "auth/operation-not-allowed": "Firebase-এ Phone sign-in চালু করো।"
  };

  const message = messages[code] ||
    `সমস্যা হয়েছে: ${error?.message || "আবার চেষ্টা করো।"}`;

  setLoginStatus(message);
  statusEl.textContent = message;
}

sendOtpBtn.addEventListener("click", async () => {
  const phone = $("phone").value.trim();

  if (!/^\+8801[3-9]\d{8}$/.test(phone)) {
    setLoginStatus("সঠিক নম্বর লেখো: +8801XXXXXXXXX");
    return;
  }

  sendOtpBtn.disabled = true;

  try {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
    }

    recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container",
      { size: "normal" }
    );

    await recaptchaVerifier.render();

    confirmationResult = await auth.signInWithPhoneNumber(
      phone,
      recaptchaVerifier
    );

    setLoginStatus("OTP পাঠানো হয়েছে। SMS দেখে কোড লেখো।");
  } catch (error) {
    showError(error);
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (_) {}
      recaptchaVerifier = null;
    }
  } finally {
    sendOtpBtn.disabled = false;
  }
});

verifyOtpBtn.addEventListener("click", async () => {
  const code = $("otp").value.trim();

  if (!confirmationResult) {
    setLoginStatus("আগে OTP পাঠাও।");
    return;
  }

  if (!/^\d{6}$/.test(code)) {
    setLoginStatus("৬ সংখ্যার OTP লেখো।");
    return;
  }

  verifyOtpBtn.disabled = true;

  try {
    await confirmationResult.confirm(code);
    setLoginStatus("লগইন সফল!");
  } catch (error) {
    showError(error);
  } finally {
    verifyOtpBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await auth.signOut();
  } catch (error) {
    showError(error);
  }
});

auth.onAuthStateChanged((user) => {
  currentUser = user;

  loginPanel.classList.toggle("hidden", !!user);
  chatPanel.classList.toggle("hidden", !user);
  logoutBtn.classList.toggle("hidden", !user);

  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  if (user) {
    $("userInfo").textContent = user.phoneNumber || "Signed in";
    statusEl.textContent = "চ্যাট সংযোগ করা হচ্ছে…";
    startMessages();
  }
});

function startMessages() {
  unsubscribeMessages = db.collection("messages")
    .orderBy("createdAt", "desc")
    .limit(100)
    .onSnapshot((snapshot) => {
      messagesEl.replaceChildren();

      const docs = [...snapshot.docs].reverse();

      for (const doc of docs) {
        const message = doc.data();

        const card = document.createElement("div");
        card.className = "message" +
          (message.uid === currentUser.uid ? " mine" : "");

        const sender = document.createElement("div");
        sender.className = "sender";
        sender.textContent = message.phone || "AddaBD user";

        const body = document.createElement("div");
        body.className = "body";
        body.textContent = message.text || "";

        const time = document.createElement("div");
        time.className = "time";

        if (message.createdAt?.toDate) {
          time.textContent = message.createdAt.toDate()
            .toLocaleString("bn-BD");
        }

        card.append(sender, body, time);
        messagesEl.appendChild(card);
      }

      statusEl.textContent = `${snapshot.size}টি সাম্প্রতিক মেসেজ`;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, (error) => {
      showError(error);
      statusEl.textContent =
        "চ্যাট লোড হয়নি। Firestore Rules ও Database সেটিংস দেখো।";
    });
}

$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const input = $("messageInput");
  const text = input.value.trim();

  if (!text) return;

  const button = $("messageForm").querySelector("button");
  button.disabled = true;

  try {
    await db.collection("messages").add({
      uid: currentUser.uid,
      phone: currentUser.phoneNumber || "AddaBD user",
      text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = "";
  } catch (error) {
    showError(error);
  } finally {
    button.disabled = false;
  }
});
