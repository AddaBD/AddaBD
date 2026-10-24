const $ = id => document.getElementById(id);

// GitHub-এর public source code-এ এই পাসওয়ার্ড দেখা যাবে।
// এটি শুধু অতিরিক্ত প্রবেশ-শর্ত, নিরাপদ পরিচয় যাচাই নয়।
const FRIENDS_GATE_PASSWORD = "AddaBD2026";

let isSignup = false;
let currentUser = null;
let currentProfile = null;
let activeFriend = null;
let activeConversationId = null;
let messagesUnsubscribe = null;

$("year").textContent = new Date().getFullYear();

function normalizePhone(value) {
  let p = value.replace(/[\s()-]/g, "");

  if (/^01[3-9]\d{8}$/.test(p)) {
    p = "+88" + p;
  } else if (/^8801[3-9]\d{8}$/.test(p)) {
    p = "+" + p;
  }

  if (!/^\+8801[3-9]\d{8}$/.test(p)) {
    throw new Error("সঠিক বাংলাদেশি মোবাইল নম্বর লেখো।");
  }

  return p;
}

function internalEmail(phone) {
  return "u" + phone.replace(/\D/g, "") + "@addabd.app";
}

function setStatus(id, message, error = false) {
  const el = $(id);
  el.textContent = message;
  el.classList.toggle("error", error);
}

function showError(error, target = "authStatus") {
  console.error("AddaBD:", error.code, error.message);

  const messages = {
    "auth/email-already-in-use": "এই নম্বরের অ্যাকাউন্ট আগে তৈরি হয়েছে। লগইন করো।",
    "auth/invalid-credential": "নম্বর বা অ্যাকাউন্ট পাসওয়ার্ড ভুল।",
    "auth/invalid-email": "নম্বরের ফরম্যাট সঠিক নয়।",
    "auth/weak-password": "নিজস্ব পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের দাও।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করো।",
    "auth/network-request-failed": "ইন্টারনেট সংযোগ পরীক্ষা করো।",
    "permission-denied": "Firebase Firestore Rules বা অনুমতি পরীক্ষা করতে হবে।",
    "unavailable": "সার্ভারে সংযোগ হচ্ছে না। পরে আবার চেষ্টা করো।"
  };

  setStatus(
    target,
    messages[error.code] || error.message || "কাজটি সম্পন্ন হয়নি।",
    true
  );
}

$("toggleAuthBtn").addEventListener("click", () => {
  isSignup = !isSignup;
  $("nameField").classList.toggle("hidden", !isSignup);
  $("authTitle").textContent = isSignup
    ? "নতুন অ্যাকাউন্ট তৈরি"
    : "AddaBD-তে লগইন";
  $("authBtn").textContent = isSignup ? "অ্যাকাউন্ট তৈরি করো" : "লগইন";
  $("toggleAuthBtn").textContent = isSignup
    ? "আগে অ্যাকাউন্ট তৈরি করেছ? লগইন করো"
    : "নতুন অ্যাকাউন্ট তৈরি করো";
  $("accountPassword").autocomplete = isSignup
    ? "new-password"
    : "current-password";
  setStatus("authStatus", "");
});

$("authBtn").addEventListener("click", async () => {
  if ($("authBtn").disabled) return;

  $("authBtn").disabled = true;
  setStatus("authStatus", "অপেক্ষা করো…");

  let createdCredential = null;
  let reservedPhone = null;

  try {
    const phone = normalizePhone($("phone").value);
    const gate = $("sharedPassword").value;
    const password = $("accountPassword").value;

    if (gate !== FRIENDS_GATE_PASSWORD) {
      throw new Error("বন্ধুদের সাধারণ পাসওয়ার্ড সঠিক নয়।");
    }

    if (password.length < 8) {
      throw new Error("নিজস্ব পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
    }

    if (isSignup) {
      const name = $("displayName").value.trim();
      if (!name) throw new Error("তোমার নাম লিখো।");
      if (name.length > 40) throw new Error("নাম সর্বোচ্চ ৪০ অক্ষর হতে পারে।");

      createdCredential = await auth.createUserWithEmailAndPassword(
        internalEmail(phone), password
      );

      const uid = createdCredential.user.uid;

      // একই নম্বর একবারই নিবন্ধন করা যাবে।
      // এটি নম্বরের মালিকানা যাচাই করে না।
      await db.runTransaction(async tx => {
        const ref = db.collection("phoneIndex").doc(phone);
        const snap = await tx.get(ref);

        if (snap.exists) {
          throw new Error("এই নম্বরটি ইতিমধ্যে নিবন্ধিত।");
        }

        tx.set(ref, {
          uid,
          phone,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      reservedPhone = phone;

      await db.collection("users").doc(uid).set({
        uid,
        phone,
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setStatus("authStatus", "অ্যাকাউন্ট তৈরি হয়েছে।");
    } else {
      const credential = await auth.signInWithEmailAndPassword(
        internalEmail(phone), password
      );

      createdCredential = credential;
    }
  } catch (error) {
    // নিবন্ধন আংশিক ব্যর্থ হলে নিজের তৈরি রেকর্ড পরিষ্কার করার চেষ্টা।
    if (createdCredential && isSignup) {
      try {
        if (reservedPhone) {
          await db.collection("phoneIndex").doc(reservedPhone).delete();
        }
        await createdCredential.user.delete();
      } catch (cleanupError) {
        console.error("Cleanup required:", cleanupError);
      }
    }

    showError(error);
  } finally {
    $("authBtn").disabled = false;
  }
});

auth.onAuthStateChanged(async user => {
  currentUser = user || null;
  closeChat();

  if (!user) {
    currentProfile = null;
    $("loginPanel").classList.remove("hidden");
    $("appPanel").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
    return;
  }

  try {
    const snap = await db.collection("users").doc(user.uid).get();

    if (!snap.exists) {
      setStatus("authStatus", "প্রোফাইল পাওয়া যায়নি। সহায়তা প্রয়োজন।", true);
      await auth.signOut();
      return;
    }

    currentProfile = snap.data();

    $("loginPanel").classList.add("hidden");
    $("appPanel").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    $("welcomeName").textContent = "স্বাগতম, " + currentProfile.name;
    $("myPhone").textContent = currentProfile.phone;
    setStatus("authStatus", "");
  } catch (error) {
    showError(error);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await auth.signOut();
  } catch (error) {
    showError(error);
  }
});

$("searchBtn").addEventListener("click", async () => {
  setStatus("searchResult", "বন্ধু খোঁজা হচ্ছে…");

  try {
    if (!currentUser) throw new Error("আগে লগইন করো।");

    const phone = normalizePhone($("friendPhone").value);

    if (phone === currentProfile.phone) {
      throw new Error("নিজের নম্বর নয়, বন্ধুর নম্বর লেখো।");
    }

    const indexSnap = await db.collection("phoneIndex").doc(phone).get();

    if (!indexSnap.exists) {
      throw new Error("এই নম্বরে কোনো নিবন্ধিত বন্ধু পাওয়া যায়নি।");
    }

    const uid = indexSnap.data().uid;
    const userSnap = await db.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      throw new Error("বন্ধুর প্রোফাইল পাওয়া যায়নি।");
    }

    const friend = userSnap.data();

    const result = document.createElement("div");
    result.className = "friend-result";

    const info = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = friend.name;
    const number = document.createElement("p");
    number.textContent = friend.phone;
    info.append(name, number);

    const chatBtn = document.createElement("button");
    chatBtn.className = "primary";
    chatBtn.textContent = "চ্যাট";
    chatBtn.addEventListener("click", () => openChat(friend));

    result.append(info, chatBtn);
    $("searchResult").replaceChildren(result);
  } catch (error) {
    showError(error, "searchResult");
  }
});

function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

async function openChat(friend) {
  try {
    closeChat();

    activeFriend = friend;
    activeConversationId = conversationId(currentUser.uid, friend.uid);

    const conversationRef = db.collection("conversations")
      .doc(activeConversationId);

    const conversationSnap = await conversationRef.get();

    if (!conversationSnap.exists) {
      await conversationRef.set({
        participants: [currentUser.uid, friend.uid].sort(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    $("chatName").textContent = friend.name;
    $("chatPhone").textContent = friend.phone;
    $("closeChatBtn").classList.remove("hidden");
    $("messages").replaceChildren();
    setStatus("chatStatus", "মেসেজ লোড হচ্ছে…");

    messagesUnsubscribe = conversationRef.collection("messages")
      .orderBy("createdAt", "asc")
      .limit(100)
      .onSnapshot(snapshot => {
        const container = $("messages");
        container.replaceChildren();

        snapshot.forEach(doc => {
          const data = doc.data();
          const bubble = document.createElement("div");
          bubble.className = "bubble" +
            (data.senderUid === currentUser.uid ? " mine" : "");

          const body = document.createElement("p");
          body.textContent = data.text;

          const meta = document.createElement("small");
          meta.textContent = data.senderUid === currentUser.uid
            ? "তুমি"
            : friend.name;

          bubble.append(body, meta);
          container.appendChild(bubble);
        });

        container.scrollTop = container.scrollHeight;
        setStatus("chatStatus", snapshot.empty ? "প্রথম মেসেজ পাঠাও।" : "");
      }, error => showError(error, "chatStatus"));

    $("messageInput").focus();
  } catch (error) {
    showError(error, "chatStatus");
  }
}

function closeChat() {
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }

  activeFriend = null;
  activeConversationId = null;

  if ($("messages")) $("messages").replaceChildren();
  if ($("closeChatBtn")) $("closeChatBtn").classList.add("hidden");
}

$("closeChatBtn").addEventListener("click", closeChat);

$("messageForm").addEventListener("submit", async event => {
  event.preventDefault();

  const input = $("messageInput");
  const text = input.value.trim();

  if (!text || !activeFriend || !activeConversationId) return;
  if (text.length > 2000) return;

  input.disabled = true;

  try {
    await db.collection("conversations")
      .doc(activeConversationId)
      .collection("messages")
      .add({
        senderUid: currentUser.uid,
        text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    input.value = "";
  } catch (error) {
    showError(error, "chatStatus");
  } finally {
    input.disabled = false;
    input.focus();
  }
});
