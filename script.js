// ==========================================
// GRAM RIDE - COMPLETE SCRIPT
// ==========================================

const SUPABASE_URL = "https://dvryhortalliicjyaxfb.supabase.co";
const SUPABASE_KEY = "sb_publishable_-rN6Uk-0rRFNFBBegaCwVg_rDWEpxIN";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// HTML ELEMENTS
// ==========================================

const el = (id) => document.getElementById(id);

const authForm = el("authForm");
const modeSection = el("modeSection");
const passengerSection = el("passengerSection");
const driverSection = el("driverSection");
const driverForm = el("driverForm");
const adminPanel = el("adminPanel");

let currentUser = null;
let currentProfile = null;
let passengerLocation = null;
let driverWatchId = null;

// ==========================================
// THANA AND UNION DATA
// ==========================================

const unionData = {
  shyamnagar: [
    "ভুরুলিয়া",
    "কাশিমাড়ী",
    "শ্যামনগর",
    "নূরনগর",
    "কৈখালী",
    "রমজাননগর",
    "মুন্সিগঞ্জ",
    "ঈশ্বরীপুর",
    "বুড়িগোয়ালিনী",
    "আটুলিয়া",
    "পদ্মপুকুর",
    "গাবুরা"
  ],

  koyra: [
    "আমাদী",
    "বাগালী",
    "মহেশ্বরীপুর",
    "মহারাজপুর",
    "কয়রা",
    "উত্তর বেদকাশী",
    "দক্ষিণ বেদকাশী"
  ]
};

el("thana").addEventListener("change", function () {
  const selected = this.value;
  const unionSelect = el("union");

  unionSelect.innerHTML =
    '<option value="">ইউনিয়ন নির্বাচন করুন</option>';

  (unionData[selected] || []).forEach((union) => {
    const option = document.createElement("option");
    option.value = union;
    option.textContent = union;
    unionSelect.appendChild(option);
  });
});

// ==========================================
// AUTHENTICATION
// ==========================================

el("signupBtn").addEventListener("click", signup);
el("loginBtn").addEventListener("click", login);

async function signup() {
  const email = el("email").value.trim();
  const password = el("password").value;

  if (!email || !password) {
    return showMessage("authMessage", "ইমেইল ও পাসওয়ার্ড লিখুন।");
  }

  if (password.length < 6) {
    return showMessage(
      "authMessage",
      "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।"
    );
  }

  const { error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    return showMessage("authMessage", error.message);
  }

  showMessage(
    "authMessage",
    "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল যাচাই করতে হতে পারে।"
  );
}

async function login() {
  const email = el("email").value.trim();
  const password = el("password").value;

  if (!email || !password) {
    return showMessage("authMessage", "ইমেইল ও পাসওয়ার্ড লিখুন।");
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return showMessage("authMessage", error.message);
  }

  currentUser = data.user;
  await restoreSession();
}

async function restoreSession() {
  const { data } = await db.auth.getUser();

  currentUser = data.user;

  if (!currentUser) {
    showLoggedOut();
    return;
  }

  await loadProfile();
}

async function loadProfile() {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    showMessage("authMessage", error.message);
    return;
  }

  currentProfile = data;

  authForm.style.display = "none";
  modeSection.style.display = "block";
  el("logoutBtn").style.display = "block";

  if (currentProfile?.is_admin === true) {
    el("adminBtn").style.display = "block";
  } else {
    el("adminBtn").style.display = "none";
  }

  showMessage("modeMessage", "আপনি সফলভাবে লগইন করেছেন।");
}

function showLoggedOut() {
  currentUser = null;
  currentProfile = null;

  authForm.style.display = "block";
  modeSection.style.display = "none";
  passengerSection.style.display = "none";
  driverSection.style.display = "none";
  adminPanel.style.display = "none";

  el("logoutBtn").style.display = "none";
  el("adminBtn").style.display = "none";
}

// ==========================================
// MODE SELECTION
// ==========================================

el("passengerModeBtn").addEventListener("click", () => {
  stopDriverTracking();

  modeSection.style.display = "none";
  passengerSection.style.display = "block";
  driverSection.style.display = "none";
  adminPanel.style.display = "none";

  el("backModeBtn").style.display = "block";
});

el("driverModeBtn").addEventListener("click", async () => {
  modeSection.style.display = "none";
  passengerSection.style.display = "none";
  driverSection.style.display = "block";
  adminPanel.style.display = "none";

  el("backModeBtn").style.display = "block";

  await checkDriverApplication();
});

el("backModeBtn").addEventListener("click", () => {
  stopDriverTracking();

  passengerSection.style.display = "none";
  driverSection.style.display = "none";
  driverForm.style.display = "none";
  adminPanel.style.display = "none";

  modeSection.style.display = "block";
  el("backModeBtn").style.display = "none";
});

// ==========================================
// DRIVER REGISTRATION
// ==========================================

el("driverBtn").addEventListener("click", () => {
  driverForm.style.display = "block";
});

el("registerBtn").addEventListener("click", registerDriver);

async function registerDriver() {
  const name = el("driverName").value.trim();
  const phone = el("driverPhone").value.trim();
  const vehicleType = el("vehicleType").value.trim();
  const vehicleNumber = el("vehicleNumber").value.trim();

  if (!name || !phone || !vehicleType || !vehicleNumber) {
    return showMessage(
      "driverMessage",
      "সব তথ্য পূরণ করুন।"
    );
  }

  const { data: userData } = await db.auth.getUser();
  const user = userData.user;

  if (!user) {
    return showMessage("driverMessage", "আবার লগইন করুন।");
  }

  const { error: profileError } = await db
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: name,
        phone: phone,
        role: "driver"
      },
      { onConflict: "id" }
    );

  if (profileError) {
    return showMessage("driverMessage", profileError.message);
  }

  const { error: vehicleError } = await db
    .from("vehicles")
    .insert({
      driver_id: user.id,
      vehicle_type: vehicleType,
      vehicle_number: vehicleNumber,
      is_approved: false,
      availability_status: "offline",
      status: "অপেক্ষমাণ"
    });

  if (vehicleError) {
    return showMessage("driverMessage", vehicleError.message);
  }

  showMessage(
    "driverMessage",
    "আপনার আবেদন জমা হয়েছে। অ্যাডমিন অনুমোদনের অপেক্ষায় থাকুন।"
  );

  el("registerBtn").disabled = true;
}

// ==========================================
// CHECK DRIVER APPROVAL
// ==========================================

async function checkDriverApplication() {
  const { data, error } = await db
    .from("vehicles")
    .select("*")
    .eq("driver_id", currentUser.id);

  if (error) {
    return showMessage("modeMessage", error.message);
  }

  const approved = (data || []).some(
    (vehicle) => vehicle.is_approved === true
  );

  if (approved) {
    driverForm.style.display = "none";

    showMessage(
      "modeMessage",
      "আপনি অনুমোদিত চালক। আপনার GPS লোকেশন চালু হচ্ছে।"
    );

    startDriverTracking();
  } else {
    driverForm.style.display = "none";

    showMessage(
      "modeMessage",
      "আপনার চালক আবেদন এখনো অনুমোদিত হয়নি।"
    );
  }
}

// ==========================================
// DRIVER GPS TRACKING
// ==========================================

function startDriverTracking() {
  if (!navigator.geolocation) {
    return showMessage(
      "modeMessage",
      "আপনার ব্রাউজারে GPS সুবিধা নেই।"
    );
  }

  if (driverWatchId !== null) return;

  driverWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const { error } = await db
        .from("driver_locations")
        .upsert(
          {
            driver_id: currentUser.id,
            latitude,
            longitude,
            updated_at: new Date().toISOString()
          },
          { onConflict: "driver_id" }
        );

      if (error) {
        console.error("GPS update error:", error.message);
        return;
      }

      await db
        .from("vehicles")
        .update({
          availability_status: "online"
        })
        .eq("driver_id", currentUser.id)
        .eq("is_approved", true);
    },

    (error) => {
      showMessage(
        "modeMessage",
        "GPS অনুমতি দিন। লোকেশন চালু করা যাচ্ছে না।"
      );
      console.error(error.message);
    },

    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000
    }
  );
}

function stopDriverTracking() {
  if (driverWatchId !== null) {
    navigator.geolocation.clearWatch(driverWatchId);
    driverWatchId = null;
  }
}

// ==========================================
// PASSENGER GPS
// ==========================================

el("getLocationBtn").addEventListener(
  "click",
  getPassengerLocation
);

async function getPassengerLocation() {
  if (!navigator.geolocation) {
    return showMessage(
      "locationMessage",
      "আপনার ব্রাউজারে GPS সুবিধা নেই।"
    );
  }

  showMessage("locationMessage", "আপনার লোকেশন নেওয়া হচ্ছে...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      passengerLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      showMessage(
        "locationMessage",
        "আপনার লোকেশন পাওয়া গেছে। এখন কাছাকাছি ড্রাইভার খুঁজুন।"
      );
    },

    (error) => {
      showMessage(
        "locationMessage",
        "লোকেশন পাওয়া যায়নি। GPS চালু করে অনুমতি দিন।"
      );
      console.error(error.message);
    },

    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000
    }
  );
}

// ==========================================
// FIND NEARBY DRIVERS (1 KM)
// ==========================================

el("nearbyDriversBtn").addEventListener(
  "click",
  findNearbyDrivers
);

async function findNearbyDrivers() {
  if (!passengerLocation) {
    return showMessage(
      "nearbyDriversList",
      "আগে আপনার বর্তমান লোকেশন নিন।"
    );
  }

  const list = el("nearbyDriversList");

  list.textContent = "কাছাকাছি ড্রাইভার খোঁজা হচ্ছে...";

  const { data, error } = await db.rpc(
    "nearby_approved_drivers",
    {
      p_lat: passengerLocation.latitude,
      p_lon: passengerLocation.longitude
    }
  );

  if (error) {
    console.error(error);
    list.textContent =
      "ড্রাইভার খুঁজতে সমস্যা হয়েছে: " + error.message;
    return;
  }

  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.textContent =
      "১ কিলোমিটারের মধ্যে কোনো অনুমোদিত ড্রাইভার পাওয়া যায়নি।";
    return;
  }

  data.forEach((driver) => {
    const card = document.createElement("div");
    card.className = "driver-card";

    const updatedAt = new Date(
      driver.location_updated_at
    );

    const minutesOld = Math.floor(
      (Date.now() - updatedAt.getTime()) / 60000
    );

    // ৫ মিনিটের মধ্যে GPS আপডেট এবং online status থাকলেই Online
    const isOnline =
      String(driver.availability_status).toLowerCase() === "online" &&
      minutesOld <= 5;

    const status = isOnline ? "অনলাইন" : "অফলাইন";

    const distance = Math.round(driver.distance_meters);

    const name = document.createElement("h3");
    name.textContent = driver.driver_name || "নাম পাওয়া যায়নি";

    const phone = document.createElement("p");
    phone.textContent = "ফোন: " + (driver.phone_number || "নম্বর নেই");

    const vehicle = document.createElement("p");
    vehicle.textContent =
      "গাড়ির ধরন: " + (driver.vehicle_type || "উল্লেখ নেই");

    const vehicleNumber = document.createElement("p");
    vehicleNumber.textContent =
      "গাড়ির নম্বর: " + (driver.vehicle_number || "উল্লেখ নেই");

    const distanceText = document.createElement("p");
    distanceText.textContent = "দূরত্ব: " + distance + " মিটার";

    const statusText = document.createElement("p");
    statusText.textContent = "স্ট্যাটাস: " + status;

    const updatedText = document.createElement("p");
    updatedText.textContent =
      minutesOld < 1
        ? "লোকেশন আপডেট: এইমাত্র"
        : "লোকেশন আপডেট: " + minutesOld + " মিনিট আগে";

    card.append(
      name,
      phone,
      vehicle,
      vehicleNumber,
      distanceText,
      statusText,
      updatedText
    );

    if (driver.phone_number) {
      const callButton = document.createElement("a");

      callButton.href =
        "tel:" + driver.phone_number.replace(/[^\d+]/g, "");

      callButton.textContent = "📞 কল করুন";
      callButton.className = "call-button";

      card.appendChild(callButton);
    }

    list.appendChild(card);
  });
}

// ==========================================
// ADMIN PANEL
// ==========================================

el("adminBtn").addEventListener("click", async () => {
  if (currentProfile?.is_admin !== true) {
    return;
  }

  passengerSection.style.display = "none";
  driverSection.style.display = "none";
  modeSection.style.display = "none";
  adminPanel.style.display = "block";

  el("backModeBtn").style.display = "block";

  await loadAdminApplications();
});

async function loadAdminApplications() {
  const container = el("adminApplications");
  container.textContent = "আবেদন লোড হচ্ছে...";

  const { data, error } = await db
    .from("vehicles")
    .select("*")
    .eq("is_approved", false)
    .eq("status", "অপেক্ষমাণ");

  if (error) {
    container.textContent = error.message;
    return;
  }

  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.textContent = "কোনো অপেক্ষমাণ আবেদন নেই।";
    return;
  }

  for (const vehicle of data) {
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, phone")
      .eq("id", vehicle.driver_id)
      .maybeSingle();

    const card = document.createElement("div");
    card.className = "application-card";

    const title = document.createElement("h3");
    title.textContent = profile?.full_name || "নাম পাওয়া যায়নি";

    const phone = document.createElement("p");
    phone.textContent = "ফোন: " + (profile?.phone || "নেই");

    const type = document.createElement("p");
    type.textContent = "গাড়ির ধরন: " + vehicle.vehicle_type;

    const number = document.createElement("p");
    number.textContent = "গাড়ির নম্বর: " + vehicle.vehicle_number;

    const approve = document.createElement("button");
    approve.type = "button";
    approve.textContent = "অনুমোদন করুন";

    approve.addEventListener("click", async () => {
      await approveDriver(vehicle.id);
    });

    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "বাতিল করুন";

    reject.addEventListener("click", async () => {
      await rejectDriver(vehicle.id);
    });

    card.append(title, phone, type, number, approve, reject);
    container.appendChild(card);
  }
}

async function approveDriver(vehicleId) {
  const { error } = await db
    .from("vehicles")
    .update({
      is_approved: true,
      status: "অনুমোদিত"
    })
    .eq("id", vehicleId);

  if (error) {
    alert("অনুমোদন হয়নি: " + error.message);
    return;
  }

  alert("চালক অনুমোদিত হয়েছে।");
  await loadAdminApplications();
}

async function rejectDriver(vehicleId) {
  const { error } = await db
    .from("vehicles")
    .update({
      is_approved: false,
      status: "বাতিল"
    })
    .eq("id", vehicleId);

  if (error) {
    alert("বাতিল করা যায়নি: " + error.message);
    return;
  }

  alert("আবেদন বাতিল হয়েছে।");
  await loadAdminApplications();
}

// ==========================================
// PASSENGER UNION SEARCH
// ==========================================

el("searchBtn").addEventListener("click", () => {
  const thana = el("thana").value;
  const union = el("union").value;

  if (!thana || !union) {
    return showMessage(
      "result",
      "থানা ও ইউনিয়ন নির্বাচন করুন।"
    );
  }

  showMessage(
    "result",
    "আপনার নির্বাচন: " +
      el("thana").selectedOptions[0].textContent +
      " — " +
      union
  );
});

// ==========================================
// LOGOUT
// ==========================================

el("logoutBtn").addEventListener("click", async () => {
  stopDriverTracking();

  await db.auth.signOut();

  showLoggedOut();

  showMessage("authMessage", "আপনি লগআউট করেছেন।");
});

// ==========================================
// COMMON MESSAGE FUNCTION
// ==========================================

function showMessage(id, message) {
  const element = el(id);

  if (element) {
    element.textContent = message;
  }
}

// ==========================================
// RESTORE LOGIN SESSION
// ==========================================

restoreSession();