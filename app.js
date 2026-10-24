console.log("AddaBD app.js loaded");

const $ = (id) => document.getElementById(id);

const loginPanel = $("loginPanel");
const chatPanel = $("chatPanel");
const sendOtpBtn = $("sendOtpBtn");
const verifyOtpBtn = $("verifyOtpBtn");
const logoutBtn = $("logoutBtn");
const messagesEl = $("messages");

let confirmationResult = null;
let recaptchaVerifier = null;
let unsubscribeMessages = null;
let currentUser = null;

$("year").textContent = new Date().getFullYear();

function setLoginStatus(message) {
  loginPanel.querySelector("p").textContent = message;
}

function showError(error) {
  console.error("Firebase error code:", error.code);
  console.error("Firebase error message:", error.message);
  console.error("Full Firebase error:", error);
  const errors = {
    "auth/invalid-phone-number": "ফোন নম্বরটি সঠিক নয়।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করো।",
    "auth/invalid-verification-code": "OTP ভুল হয়েছে। আবার যাচাই করো।",
    "auth/code-expired": "OTP-এর মেয়াদ শেষ। নতুন OTP নাও।",
    "auth/unauthorized-domain": "Firebase-এ GitHub Pages ডোমেইন অনুমোদন করো।",
    "auth/operation-not-allowed": "Firebase Authentication-এ Phone sign-in চালু করো।",
    "auth/captcha-check-failed": "reCAPTCHA যাচাই হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করো।",
    "auth/quota-exceeded": "আজকের SMS সীমা শেষ হয়েছে। পরে চেষ্টা করো।",
    "auth/network-request-failed": "ইন্টারনেট সংযোগ পরীক্ষা করো।"
  };

  setLoginStatus(
    errors[error.code] ||
    "সমস্যা হয়েছে: " + (error.message || error.code || "অজানা ত্রুটি")
  );
}

sendOtpBtn.addEventListener("click", async () => {
  const phone = $("phone").value.trim();

  if (!/^\+8801[3-9]\d{8}$/.test(phone)) {
    setLoginStatus("সঠিক নম্বর লেখো: +8801XXXXXXXXX");
    return;
  }

  sendOtpBtn.disabled = true;
  setLoginStatus("reCAPTCHA প্রস্তুত হচ্ছে...");

  try {
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {
        console.warn("reCAPTCHA clear:", e);
      }
      recaptchaVerifier = null;
    }

    $("recaptcha-container").innerHTML = "";

    recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container",
      {
        size: "normal",
        callback: () => {
          setLoginStatus("reCAPTCHA সম্পন্ন হয়েছে।");
        },
        "expired-callback": () => {
          setLoginStatus("reCAPTCHA-এর মেয়াদ শেষ। আবার যাচাই করো।");
        }
      }
    );

    await recaptchaVerifier.render();

    setLoginStatus("reCAPTCHA সম্পন্ন করো, তারপর আবার OTP পাঠাও চাপো।");
  } catch (error) {
    showError(error);
    sendOtpBtn.disabled = false;
    return;
  }

  sendOtpBtn.disabled = false;

  // প্রথমবার reCAPTCHA দেখাবে। পরেরবার বোতাম চাপলে OTP পাঠাবে।
  sendOtpBtn.onclick = null;
  sendOtpBtn.addEventListener("click", sendOtpAfterCaptcha, { once: true });
});

async function sendOtpAfterCaptcha() {
  const phone = $("phone").value.trim();
  sendOtpBtn.disabled = true;

  try {
    setLoginStatus("OTP পাঠানো হচ্ছে...");
    confirmationResult = await firebase.auth().signInWithPhoneNumber(
      phone,
      recaptchaVerifier
    );
    setLoginStatus("OTP পাঠানো হয়েছে। SMS-এর ৬ সংখ্যার কোড লেখো।");
  } catch (error) {
    showError(error);
  } finally {
    sendOtpBtn.disabled = false;
  }
}

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
    setLoginStatus("লগইন সফল হয়েছে!");
  } catch (error) {
    showError(error);
  } finally {
    verifyOtpBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await firebase.auth().signOut();
  } catch (error) {
    showError(error);
  }
});

firebase.auth().onAuthStateChanged((user) => {
  currentUser = user;

  if (user) {
    loginPanel.classList.add("hidden");
    chatPanel.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");

    $("userInfo").textContent = user.phoneNumber || "AddaBD ব্যবহারকারী";
    startMessages();
  } else {
    loginPanel.classList.remove("hidden");
    chatPanel.classList.add("hidden");
    logoutBtn.classList.add("hidden");

    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
  }
});

function startMessages() {
  if (unsubscribeMessages) unsubscribeMessages();

  unsubscribeMessages = firebase.firestore()
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limitToLast(100)
    .onSnapshot((snapshot) => {
      messagesEl.innerHTML = "";

      snapshot.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "message";

        const sender = document.createElement("strong");
        sender.textContent =
          data.uid === currentUser?.uid
            ? "তুমি"
            : (data.phone || "AddaBD ব্যবহারকারী");

        const text = document.createElement("p");
        text.textContent = data.text || "";

        item.append(sender, text);
        messagesEl.appendChild(item);
      });

      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, (error) => {
      console.error("Messages error:", error);
      $("status").textContent =
        "মেসেজ লোড হয়নি। Firestore Rules পরীক্ষা করো।";
    });
}

$("messageForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const input = $("messageInput");
  const text = input.value.trim();

  if (!text) return;

  try {
    await firebase.firestore().collection("messages").add({
      uid: currentUser.uid,
      phone: currentUser.phoneNumber || "",
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = "";
  } catch (error) {
    console.error("Send message error:", error);
    $("status").textContent = "মেসেজ পাঠানো যায়নি। আবার চেষ্টা করো।";
  }
});
