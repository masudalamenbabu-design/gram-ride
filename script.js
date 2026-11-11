
/* =========================================
   GRAM RIDE - SUPABASE CONFIGURATION
========================================= */

const SUPABASE_URL = "https://dvryhortalliicjyaxfb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-rN6Uk-0rRFNFBBegaCwVg_rDWEpxIN";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =========================================
   GLOBAL STATE
========================================= */

let currentUser = null;
let currentProfile = null;
let selectedRole = null;
let currentVehicle = null;

let passengerPosition = null;
let driverPosition = null;

let passengerMap = null;
let driverMap = null;

let rideRefreshTimer = null;
let activePassengerRideChannel = null;

/* =========================================
   HELPERS
========================================= */

function el(id) {
  return document.getElementById(id);
}

function show(id) {
  const node = el(id);
  if (node) node.classList.remove("hidden");
}

function hide(id) {
  const node = el(id);
  if (node) node.classList.add("hidden");
}

function value(id) {
  return el(id)?.value?.trim() || "";
}

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? "";
}

function message(id, text, error = false) {
  const node = el(id);
  if (!node) return;

  node.textContent = text;
  node.style.color = error ? "#d94848" : "#087f5b";
}

function friendlyError(error) {
  return error?.message || "সমস্যা হয়েছে। আবার চেষ্টা করুন।";
}

function escapeHTML(input) {
  return String(input ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function validCoordinates(position) {
  return position &&
    Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude);
}

function showOnly(sectionId) {
  const sections = [
    "welcomeSection",
    "authSection",
    "roleChoice",
    "registerForm",
    "otpForm",
    "loginForm",
    "driverApplySection",
    "modeSection",
    "driverSection",
    "passengerSection",
    "adminSection"
  ];

  sections.forEach(hide);

  if (sectionId) show(sectionId);
}

function stopRideRefresh() {
  if (rideRefreshTimer) {
    clearInterval(rideRefreshTimer);
    rideRefreshTimer = null;
  }
}

/* =========================================
   START / NAVIGATION
========================================= */

el("startAppBtn")?.addEventListener("click", () => {
  showOnly("authSection");
});

el("showRegisterBtn")?.addEventListener("click", () => {
  showOnly("roleChoice");
});

el("showLoginBtn")?.addEventListener("click", () => {
  showOnly("loginForm");
});

el("backWelcomeBtn")?.addEventListener("click", () => {
  showOnly("welcomeSection");
});

el("backAuthBtn")?.addEventListener("click", () => {
  showOnly("authSection");
});

el("backRoleBtn")?.addEventListener("click", () => {
  showOnly("roleChoice");
});

el("backLoginBtn")?.addEventListener("click", () => {
  showOnly("authSection");
});

el("chooseDriverBtn")?.addEventListener("click", () => {
  selectedRole = "driver";

  setText("registerTitle", "চালক হিসেবে অ্যাকাউন্ট তৈরি");

  show("driverFields");
  showOnly("registerForm");
});

el("choosePassengerBtn")?.addEventListener("click", () => {
  selectedRole = "passenger";

  setText("registerTitle", "যাত্রী হিসেবে অ্যাকাউন্ট তৈরি");

  hide("driverFields");
  showOnly("registerForm");
});

/* =========================================
   REGISTRATION
========================================= */

el("registrationForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const fullName = value("regName");
  const address = value("regAddress");
  const email = value("regEmail").toLowerCase();
  const phone = value("regPhone");
  const password = value("regPassword");

  const vehicleType = value("regVehicleType");
  const vehicleNumber = value("regVehicleNumber");

  if (!selectedRole) {
    message("registerMessage", "আগে অ্যাকাউন্টের ধরন নির্বাচন করুন।", true);
    return;
  }

  if (!fullName || !address || !email || !phone || !password) {
    message("registerMessage", "সব প্রয়োজনীয় তথ্য পূরণ করুন।", true);
    return;
  }

  if (password.length < 8) {
    message("registerMessage", "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।", true);
    return;
  }

  if (selectedRole === "driver" && !vehicleType) {
    message("registerMessage", "গাড়ির ধরন নির্বাচন করুন।", true);
    return;
  }

  message("registerMessage", "অ্যাকাউন্ট তৈরি হচ্ছে...");

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          address,
          role: selectedRole
        },
        emailRedirectTo: window.location.href
      }
    });

    if (error) throw error;

    sessionStorage.setItem("gramride_pending_email", email);
    sessionStorage.setItem("gramride_pending_name", fullName);
    sessionStorage.setItem("gramride_pending_address", address);
    sessionStorage.setItem("gramride_pending_phone", phone);
    sessionStorage.setItem("gramride_pending_role", selectedRole);
    sessionStorage.setItem("gramride_pending_vehicle_type", vehicleType);
    sessionStorage.setItem("gramride_pending_vehicle_number", vehicleNumber);

    if (data.session && data.user) {
      currentUser = data.user;
      await saveNewProfile();
      return;
    }

    message("otpMessage", "আপনার ইমেইলে OTP পাঠানো হয়েছে।");
    showOnly("otpForm");

  } catch (error) {
    message("registerMessage", friendlyError(error), true);
  }
});

/* =========================================
   SAVE NEW PROFILE
========================================= */

async function saveNewProfile() {
  if (!currentUser) return;

  const fullName = sessionStorage.getItem("gramride_pending_name");
  const address = sessionStorage.getItem("gramride_pending_address");
  const phone = sessionStorage.getItem("gramride_pending_phone");
  const role = sessionStorage.getItem("gramride_pending_role");

  const vehicleType = sessionStorage.getItem("gramride_pending_vehicle_type");
  const vehicleNumber = sessionStorage.getItem("gramride_pending_vehicle_number");

  if (!fullName || !role) {
    message("registerMessage", "নিবন্ধনের তথ্য পাওয়া যায়নি।", true);
    return;
  }

  const profileData = {
    id: currentUser.id,
    full_name: fullName,
    phone,
    address,
    role,
    approval_status: role === "driver" ? "pending" : "approved"
  };

  const { error: profileError } = await db
    .from("profiles")
    .upsert(profileData, { onConflict: "id" });

  if (profileError) {
    message("registerMessage", friendlyError(profileError), true);
    return;
  }

  if (role === "driver") {
    const { error: vehicleError } = await db
      .from("vehicles")
      .insert({
        driver_id: currentUser.id,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber || null,
        is_approved: false,
        availability_status: "offline"
      });

    if (vehicleError) {
      message("registerMessage", friendlyError(vehicleError), true);
      return;
    }
  }

  clearPendingRegistration();

  message("registerMessage", "অ্যাকাউন্ট তৈরি হয়েছে। এখন লগইন করুন।");
  showOnly("loginForm");
}

function clearPendingRegistration() {
  [
    "gramride_pending_email",
    "gramride_pending_name",
    "gramride_pending_address",
    "gramride_pending_phone",
    "gramride_pending_role",
    "gramride_pending_vehicle_type",
    "gramride_pending_vehicle_number"
  ].forEach(key => sessionStorage.removeItem(key));
}

/* =========================================
   OTP VERIFICATION
========================================= */

el("otpVerifyForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = sessionStorage.getItem("gramride_pending_email");
  const token = value("otpCode");

  if (!email || !token) {
    message("otpMessage", "ইমেইল অথবা OTP পাওয়া যায়নি।", true);
    return;
  }

  message("otpMessage", "OTP যাচাই হচ্ছে...");

  try {
    const { data, error } = await db.auth.verifyOtp({
      email,
      token,
      type: "signup"
    });

    if (error) throw error;

    currentUser = data.user;

    await saveNewProfile();

  } catch (error) {
    message("otpMessage", friendlyError(error), true);
  }
});

el("resendOtpBtn")?.addEventListener("click", async () => {
  const email = sessionStorage.getItem("gramride_pending_email");

  if (!email) {
    message("otpMessage", "ইমেইল পাওয়া যায়নি।", true);
    return;
  }

  try {
    const { error } = await db.auth.resend({
      type: "signup",
      email
    });

    if (error) throw error;

    message("otpMessage", "নতুন OTP পাঠানো হয়েছে।");

  } catch (error) {
    message("otpMessage", friendlyError(error), true);
  }
});

/* =========================================
   LOGIN
========================================= */

el("loginFormElement")?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = value("loginEmail").toLowerCase();
  const password = value("loginPassword");

  if (!email || !password) {
    message("loginMessage", "ইমেইল ও পাসওয়ার্ড দিন।", true);
    return;
  }

  message("loginMessage", "লগইন হচ্ছে...");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    currentUser = data.user;

    await loadUserDashboard();

  } catch (error) {
    message("loginMessage", friendlyError(error), true);
  }
});

/* =========================================
   LOAD PROFILE
========================================= */

async function loadUserDashboard() {
  if (!currentUser) return;

  stopRideRefresh();

  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    message(
      "loginMessage",
      "প্রোফাইল পাওয়া যায়নি। Auth Users এবং profiles-এর ID মিলিয়ে দেখুন। " +
      friendlyError(error),
      true
    );
    return;
  }

  currentProfile = profile;

  if (profile.is_admin === true) {
    await loadAdminDashboard();
    return;
  }

  if (profile.role === "driver") {
    await loadDriverDashboard();
    return;
  }

  if (profile.role === "passenger") {
    await loadPassengerDashboard();
    return;
  }

  message("loginMessage", "অ্যাকাউন্টের ধরন পাওয়া যায়নি।", true);
}

/* =========================================
   DRIVER DASHBOARD
========================================= */

async function loadDriverDashboard() {
  showOnly("driverApplySection");

  const { data: vehicles, error } = await db
    .from("vehicles")
    .select("*")
    .eq("driver_id", currentUser.id);

  if (error) {
    message("driverApplyMessage", friendlyError(error), true);
    return;
  }

  currentVehicle = vehicles?.[0] || null;

  if (!currentVehicle || currentVehicle.is_approved !== true) {
    message(
      "driverApplyMessage",
      "আপনার চালক আবেদন এখনো অনুমোদিত হয়নি। অ্যাডমিনের অনুমোদনের জন্য অপেক্ষা করুন।"
    );

    show("applyDriverBtn");
    return;
  }

  await showDriverDashboard();
}

el("applyDriverBtn")?.addEventListener("click", loadDriverDashboard);

async function showDriverDashboard() {
  showOnly("driverSection");

  // অনলাইন/অফলাইন নিয়ন্ত্রণ দেখানো
  show("driverControls");

  setText("driverWelcomeName", currentProfile?.full_name || "চালক");

  updateDriverOnlineUI();

  await loadDriverRideRequests();

  startRideRefresh();

  if (currentVehicle?.availability_status === "online") {
    await updateDriverLocation();
  }
}

function updateDriverOnlineUI() {
  const online = currentVehicle?.availability_status === "online";

  setText(
    "driverOnlineLabel",
    online ? "আপনি এখন অনলাইন" : "আপনি এখন অফলাইন"
  );

  setText(
    "driverOnlineBtn",
    online ? "অফলাইন করুন" : "অনলাইন করুন"
  );
}

el("driverOnlineBtn")?.addEventListener("click", async () => {
  if (!currentVehicle) return;

  const goOnline = currentVehicle.availability_status !== "online";

  try {
    const { data, error } = await db.rpc("set_driver_availability", {
      p_vehicle_id: currentVehicle.id,
      p_online: goOnline
    });

    if (error) throw error;

    if (data === false) {
      throw new Error("চালকের অবস্থা পরিবর্তন করা যায়নি।");
    }

    currentVehicle.availability_status = goOnline ? "online" : "offline";

    updateDriverOnlineUI();

    message("driverMessage", "অবস্থা পরিবর্তন হয়েছে।");

    if (goOnline) {
      await updateDriverLocation();
      await loadDriverRideRequests();
    }

  } catch (error) {
    message("driverMessage", friendlyError(error), true);
  }
});

el("driverLocationBtn")?.addEventListener("click", updateDriverLocation);

/* =========================================
   DRIVER GPS
========================================= */

async function updateDriverLocation() {
  if (!currentUser || !currentVehicle) return;

  if (!navigator.geolocation) {
    message("driverMessage", "আপনার ব্রাউজারে GPS সুবিধা নেই।", true);
    return;
  }

  message("driverMessage", "GPS অবস্থান আপডেট হচ্ছে...");

  navigator.geolocation.getCurrentPosition(async position => {
    driverPosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };

    try {
      const { error } = await db
        .from("driver_locations")
        .upsert({
          driver_id: currentUser.id,
          latitude: driverPosition.latitude,
          longitude: driverPosition.longitude,
          updated_at: new Date().toISOString()
        }, { onConflict: "driver_id" });

      if (error) throw error;

      message("driverMessage", "আপনার অবস্থান আপডেট হয়েছে।");

      drawDriverMap();

    } catch (error) {
      message("driverMessage", friendlyError(error), true);
    }

  }, () => {
    message("driverMessage", "GPS অনুমতি দিন এবং আবার চেষ্টা করুন।", true);
  }, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000
  });
}

function drawDriverMap() {
  if (!driverPosition || !window.L || !el("driverMap")) return;

  if (!driverMap) {
    driverMap = L.map("driverMap").setView(
      [driverPosition.latitude, driverPosition.longitude],
      15
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(driverMap);
  } else {
    driverMap.setView(
      [driverPosition.latitude, driverPosition.longitude],
      15
    );
  }

  L.marker([
    driverPosition.latitude,
    driverPosition.longitude
  ])
    .addTo(driverMap)
    .bindPopup("আপনার অবস্থান")
    .openPopup();
}

/* =========================================
   DRIVER RIDE REQUESTS
========================================= */

async function loadDriverRideRequests() {
  if (!currentUser || !currentVehicle) return;

  const list = el("driverRideRequests");
  if (!list) return;

  if (currentVehicle.availability_status !== "online") {
    list.innerHTML = "<p>রাইড দেখতে অনলাইন করুন।</p>";
    return;
  }

  try {
    const { data: rides, error } = await db
      .from("rides")
      .select("*")
      .in("status", ["requested", "pending"])
      .is("driver_id", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: rejected, error: rejectError } = await db
      .from("ride_rejections")
      .select("ride_id")
      .eq("driver_id", currentUser.id);

    if (rejectError) throw rejectError;

    const rejectedIds = new Set(
      (rejected || []).map(item => item.ride_id)
    );

    const available = (rides || []).filter(ride =>
      !rejectedIds.has(ride.id) &&
      (!ride.vehicle_type ||
        ride.vehicle_type === currentVehicle.vehicle_type)
    );

    list.innerHTML = "";

    if (!available.length) {
      list.innerHTML = "<p>এখন কোনো নতুন রাইড নেই।</p>";
      return;
    }

    available.forEach(ride => {
      const card = document.createElement("div");

      const pickup = ride.pickup_address || "উঠার স্থান";
      const destination =
        ride.destination_address ||
        ride.dropoff_address ||
        "গন্তব্য";

      card.innerHTML = `
        <h3>নতুন রাইড</h3>
        <p>উঠার স্থান: ${escapeHTML(pickup)}</p>
        <p>গন্তব্য: ${escapeHTML(destination)}</p>
        <p>যাত্রী: ${Number(ride.passenger_count || 1)} জন</p>
        <p>যাত্রার ধরন: ${escapeHTML(ride.trip_type || "যাত্রী")}</p>
        <button class="primary-btn accept-ride">রাইড গ্রহণ</button>
        <button class="secondary-btn reject-ride">বাতিল</button>
      `;

      card.querySelector(".accept-ride")
        .addEventListener("click", () => acceptRide(ride));

      card.querySelector(".reject-ride")
        .addEventListener("click", () => rejectRide(ride));

      list.appendChild(card);
    });

  } catch (error) {
    list.innerHTML = `<p>${escapeHTML(friendlyError(error))}</p>`;
  }
}

/* =========================================
   ACCEPT RIDE
========================================= */

async function acceptRide(ride) {
  if (!currentVehicle) return;

  if (!confirm("আপনি কি এই রাইড গ্রহণ করতে চান?")) return;

  try {
    const { data, error } = await db.rpc("accept_ride", {
      p_ride_id: ride.id,
      p_vehicle_id: currentVehicle.id
    });

    if (error) throw error;

    if (data !== true) {
      message("driverMessage", "অন্য চালক রাইডটি গ্রহণ করেছেন।", true);
      await loadDriverRideRequests();
      return;
    }

    message("driverMessage", "রাইড গ্রহণ করা হয়েছে।");

    await loadDriverRideRequests();

  } catch (error) {
    message("driverMessage", friendlyError(error), true);
  }
}

/* =========================================
   REJECT RIDE
========================================= */

async function rejectRide(ride) {
  if (!currentVehicle) return;

  try {
    const { data, error } = await db.rpc("reject_ride", {
      p_ride_id: ride.id,
      p_vehicle_id: currentVehicle.id
    });

    if (error) throw error;

    if (data === false) {
      throw new Error("রাইডটি বাতিল করা যায়নি।");
    }

    message("driverMessage", "এই রাইডটি আপনার তালিকা থেকে বাদ দেওয়া হয়েছে।");

    await loadDriverRideRequests();

  } catch (error) {
    message("driverMessage", friendlyError(error), true);
  }
}

/* =========================================
   PASSENGER DASHBOARD
========================================= */

async function loadPassengerDashboard() {
  showOnly("passengerSection");

  setText("welcomeName", currentProfile?.full_name || "যাত্রী");

  message("passengerMessage", "রাইড নিতে GPS আপডেট করুন।");

  loadPassengerPreviousRide();
}

el("getPassengerGPS")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    message("passengerMessage", "আপনার ব্রাউজারে GPS নেই।", true);
    return;
  }

  message("passengerMessage", "আপনার অবস্থান নেওয়া হচ্ছে...");

  navigator.geolocation.getCurrentPosition(position => {
    passengerPosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };

    setText("passengerLocationStatus", "আপনার অবস্থান পাওয়া গেছে।");

    message("passengerMessage", "GPS আপডেট হয়েছে।");

    drawPassengerMap();

  }, () => {
    message("passengerMessage", "GPS অনুমতি দিন এবং আবার চেষ্টা করুন।", true);
  }, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000
  });
});

/* =========================================
   PASSENGER MAP
========================================= */

function drawPassengerMap() {
  if (!passengerPosition || !window.L || !el("passengerMap")) return;

  if (!passengerMap) {
    passengerMap = L.map("passengerMap").setView(
      [passengerPosition.latitude, passengerPosition.longitude],
      15
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(passengerMap);
  } else {
    passengerMap.setView(
      [passengerPosition.latitude, passengerPosition.longitude],
      15
    );
  }

  L.marker([
    passengerPosition.latitude,
    passengerPosition.longitude
  ])
    .addTo(passengerMap)
    .bindPopup("আপনার অবস্থান")
    .openPopup();
}

/* =========================================
   FIND NEARBY DRIVERS
========================================= */

el("findDriversBtn")?.addEventListener("click", findNearbyDrivers);

async function findNearbyDrivers() {
  if (!passengerPosition || !validCoordinates(passengerPosition)) {
    message("passengerMessage", "প্রথমে GPS আপডেট করুন।", true);
    return;
  }

  const vehicleType = value("passengerVehicleType");
  const pickup = value("pickupAddress");
  const destination = value("destinationAddress");

  if (!vehicleType || !pickup || !destination) {
    message("passengerMessage", "গাড়ির ধরন, উঠার স্থান ও গন্তব্য দিন।", true);
    return;
  }

  message("passengerMessage", "কাছাকাছি চালক খোঁজা হচ্ছে...");

  try {
    const { data: drivers, error } = await db.rpc(
      "nearby_approved_drivers",
      {
        p_lat: passengerPosition.latitude,
        p_lon: passengerPosition.longitude
      }
    );

    if (error) throw error;

    const matching = (drivers || []).filter(driver =>
      driver.availability_status === "online" &&
      driver.vehicle_type === vehicleType &&
      Number(driver.distance_meters) <= 1000
    );

    const list = el("nearbyDrivers");

    if (!list) return;

    list.innerHTML = "";

    if (!matching.length) {
      list.innerHTML = "<p>১ কিলোমিটারের মধ্যে অনলাইন চালক পাওয়া যায়নি।</p>";

      message("passengerMessage", "অন্য সময় আবার চেষ্টা করুন।");
      return;
    }

    matching.forEach(driver => {
      const card = document.createElement("div");

      card.innerHTML = `
        <h3>${escapeHTML(driver.full_name || "চালক")}</h3>
        <p>গাড়ি: ${escapeHTML(driver.vehicle_type || "")}</p>
        <p>দূরত্ব: ${Math.round(Number(driver.distance_meters))} মিটার</p>
        <button class="primary-btn">রাইডের অনুরোধ পাঠান</button>
      `;

      card.querySelector("button")
        .addEventListener("click", () => requestRide(driver));

      list.appendChild(card);
    });

    message("passengerMessage", "চালক পাওয়া গেছে। একজনকে রাইডের অনুরোধ পাঠান।");

  } catch (error) {
    message("passengerMessage", friendlyError(error), true);
  }
}

/* =========================================
   CREATE RIDE REQUEST
========================================= */

async function requestRide(driver) {
  const pickup = value("pickupAddress");
  const destination = value("destinationAddress");
  const vehicleType = value("passengerVehicleType");

  const tripType = value("tripType") || "passenger";

  const passengerCount = tripType === "passenger"
    ? Number(value("passengerCount") || 1)
    : 1;

  if (!currentUser || !passengerPosition) return;

  if (!confirm("এই চালকদের কাছে রাইডের অনুরোধ পাঠাবেন?")) return;

  try {
    const { data, error } = await db
      .from("rides")
      .insert({
        passenger_id: currentUser.id,

        pickup_address: pickup,
        dropoff_address: destination,
        destination_address: destination,

        pickup_latitude: passengerPosition.latitude,
        pickup_longitude: passengerPosition.longitude,

        pickup_lat: passengerPosition.latitude,
        pickup_lng: passengerPosition.longitude,

        vehicle_type: vehicleType,
        trip_type: tripType,
        passenger_count: passengerCount,

        status: "requested"
      })
      .select()
      .single();

    if (error) throw error;

    message(
      "passengerMessage",
      "রাইডের অনুরোধ পাঠানো হয়েছে। চালকের গ্রহণের অপেক্ষায় থাকুন।"
    );

    if (data?.id) {
      sessionStorage.setItem("gramride_active_ride", data.id);
      watchPassengerRide(data.id);
    }

  } catch (error) {
    message("passengerMessage", friendlyError(error), true);
  }
}

/* =========================================
   PASSENGER RIDE STATUS
========================================= */

function watchPassengerRide(rideId) {
  if (activePassengerRideChannel) {
    db.removeChannel(activePassengerRideChannel);
  }

  activePassengerRideChannel = db
    .channel("ride-status-" + rideId)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rides",
        filter: "id=eq." + rideId
      },
      payload => {
        const ride = payload.new;

        if (ride.status === "accepted") {
          message("passengerMessage", "আপনার রাইড একজন চালক গ্রহণ করেছেন।");
        } else if (ride.status === "completed") {
          message("passengerMessage", "আপনার রাইড সম্পন্ন হয়েছে।");
        } else if (
          ride.status === "cancelled" ||
          ride.status === "canceled"
        ) {
          message("passengerMessage", "রাইডটি বাতিল হয়েছে।", true);
        }
      }
    )
    .subscribe();
}

async function loadPassengerPreviousRide() {
  const rideId = sessionStorage.getItem("gramride_active_ride");

  if (rideId) {
    watchPassengerRide(rideId);
  }
}

/* =========================================
   DRIVER GOOGLE MAPS
========================================= */

el("driverGoogleMapsBtn")?.addEventListener("click", async () => {
  if (!currentUser) return;

  try {
    const { data: rides, error } = await db
      .from("rides")
      .select("*")
      .eq("driver_id", currentUser.id)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    const ride = rides?.[0];

    if (!ride) {
      message("driverMessage", "আপনার কোনো সক্রিয় রাইড পাওয়া যায়নি।", true);
      return;
    }

    const lat = ride.pickup_latitude ?? ride.pickup_lat;
    const lng = ride.pickup_longitude ?? ride.pickup_lng;

    if (lat == null || lng == null) {
      message("driverMessage", "রাইডের অবস্থানের তথ্য পাওয়া যায়নি।", true);
      return;
    }

    const url =
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    window.open(url, "_blank");

  } catch (error) {
    message("driverMessage", friendlyError(error), true);
  }
});

/* =========================================
   ADMIN DASHBOARD
========================================= */

async function loadAdminDashboard() {
  showOnly("adminSection");

  await refreshAdminData();
}

el("refreshAdminBtn")?.addEventListener("click", refreshAdminData);

async function refreshAdminData() {
  try {
    const { data: profiles, error } = await db
      .from("profiles")
      .select("*")
      .eq("role", "driver");

    if (error) throw error;

    const { data: vehicles, error: vehicleError } = await db
      .from("vehicles")
      .select("*");

    if (vehicleError) throw vehicleError;

    const vehicleByDriver = new Map(
      (vehicles || []).map(vehicle => [vehicle.driver_id, vehicle])
    );

    const applications = (profiles || []).filter(profile => {
      const vehicle = vehicleByDriver.get(profile.id);

      return vehicle &&
        vehicle.is_approved !== true &&
        profile.approval_status !== "rejected";
    });

    const approved = (profiles || []).filter(profile => {
      const vehicle = vehicleByDriver.get(profile.id);

      return vehicle && vehicle.is_approved === true;
    });

    const rejected = (profiles || []).filter(profile => {
      return profile.approval_status === "rejected";
    });

    setText("totalDrivers", String(profiles?.length || 0));
    setText("approvedDrivers", String(approved.length));
    setText("rejectedDrivers", String(rejected.length));

    renderAdminApplications(applications, vehicleByDriver);
    renderDriverList("approvedDrivers", approved);
    renderDriverList("rejectedDrivers", rejected);

    message("adminMessage", "অ্যাডমিন তথ্য আপডেট হয়েছে।");

  } catch (error) {
    message("adminMessage", friendlyError(error), true);
  }

  await loadPlaces();
}

/* =========================================
   ADMIN APPLICATIONS
========================================= */

function renderAdminApplications(applications, vehicleByDriver) {
  const list = el("adminApplications");

  if (!list) return;

  list.innerHTML = "";

  if (!applications.length) {
    list.innerHTML = "<p>নতুন আবেদন নেই।</p>";
    return;
  }

  applications.forEach(profile => {
    const vehicle = vehicleByDriver.get(profile.id);

    const card = document.createElement("div");

    card.innerHTML = `
      <h3>${escapeHTML(profile.full_name || "")}</h3>
      <p>ঠিকানা: ${escapeHTML(profile.address || "")}</p>
      <p>মোবাইল: ${escapeHTML(profile.phone || "")}</p>
      <p>গাড়ি: ${escapeHTML(vehicle?.vehicle_type || "")}</p>
      <p>নম্বর: ${escapeHTML(vehicle?.vehicle_number || "")}</p>
      <button class="primary-btn approve-driver">অনুমোদন</button>
      <button class="danger-btn reject-driver">বাতিল</button>
    `;

    card.querySelector(".approve-driver")
      .addEventListener("click", () => approveDriver(profile.id, vehicle?.id));

    card.querySelector(".reject-driver")
      .addEventListener("click", () => rejectDriver(profile.id, vehicle?.id));

    list.appendChild(card);
  });
}

function renderDriverList(elementId, profiles) {
  const list = el(elementId);

  if (!list) return;

  list.innerHTML = "";

  if (!profiles.length) {
    list.innerHTML = "<p>কোনো তথ্য নেই।</p>";
    return;
  }

  profiles.forEach(profile => {
    const item = document.createElement("div");

    item.textContent =
      `${profile.full_name || ""} — ${profile.phone || ""}`;

    list.appendChild(item);
  });
}

/* =========================================
   APPROVE DRIVER
========================================= */

async function approveDriver(driverId, vehicleId) {
  if (!vehicleId) {
    message("adminMessage", "চালকের গাড়ির তথ্য পাওয়া যায়নি।", true);
    return;
  }

  if (!confirm("আপনি কি এই আবেদন অনুমোদন করবেন?")) return;

  try {
    const { error: vehicleError } = await db
      .from("vehicles")
      .update({
        is_approved: true
      })
      .eq("id", vehicleId);

    if (vehicleError) throw vehicleError;

    const { error: profileError } = await db
      .from("profiles")
      .update({
        approval_status: "approved"
      })
      .eq("id", driverId);

    if (profileError) throw profileError;

    message("adminMessage", "চালকের আবেদন অনুমোদন করা হয়েছে।");

    await refreshAdminData();

  } catch (error) {
    message("adminMessage", friendlyError(error), true);
  }
}

/* =========================================
   REJECT DRIVER
========================================= */

async function rejectDriver(driverId, vehicleId) {
  if (!confirm("আপনি কি এই আবেদন বাতিল করবেন?")) return;

  try {
    if (vehicleId) {
      const { error } = await db
        .from("vehicles")
        .update({
          is_approved: false,
          availability_status: "offline"
        })
        .eq("id", vehicleId);

      if (error) throw error;
    }

    const { error: profileError } = await db
      .from("profiles")
      .update({
        approval_status: "rejected"
      })
      .eq("id", driverId);

    if (profileError) throw profileError;

    message("adminMessage", "আবেদন বাতিল করা হয়েছে।");

    await refreshAdminData();

  } catch (error) {
    message("adminMessage", friendlyError(error), true);
  }
}

/* =========================================
   ADMIN PLACE MANAGEMENT
========================================= */

el("addPlaceBtn")?.addEventListener("click", addPlace);

async function addPlace() {
  const placeName = value("newPlaceName");

  if (!placeName) {
    message("adminMessage", "জায়গার নাম লিখুন।", true);
    return;
  }

  try {
    const { error } = await db
      .from("places")
      .insert({
        name: placeName
      });

    if (error) throw error;

    if (el("newPlaceName")) {
      el("newPlaceName").value = "";
    }

    message("adminMessage", "জায়গা যোগ করা হয়েছে।");

    await loadPlaces();

  } catch (error) {
    message("adminMessage", friendlyError(error), true);
  }
}

async function loadPlaces() {
  const list = el("placeList");

  if (!list) return;

  try {
    const { data, error } = await db
      .from("places")
      .select("*")
      .order("name");

    if (error) throw error;

    list.innerHTML = "";

    if (!data?.length) {
      list.innerHTML = "<p>এখনো কোনো জায়গা যোগ করা হয়নি।</p>";
      return;
    }

    data.forEach(place => {
      const item = document.createElement("div");

      item.textContent = place.name;

      list.appendChild(item);
    });

  } catch (error) {
    list.innerHTML =
      `<p>${escapeHTML(friendlyError(error))}</p>`;
  }
}

/* =========================================
   LOGOUT
========================================= */

el("logoutBtn")?.addEventListener("click", async () => {
  try {
    stopRideRefresh();

    if (activePassengerRideChannel) {
      await db.removeChannel(activePassengerRideChannel);
      activePassengerRideChannel = null;
    }

    const { error } = await db.auth.signOut();

    if (error) throw error;

    currentUser = null;
    currentProfile = null;
    currentVehicle = null;

    passengerPosition = null;
    driverPosition = null;

    selectedRole = null;

    sessionStorage.removeItem("gramride_active_ride");

    showOnly("welcomeSection");

  } catch (error) {
    alert(friendlyError(error));
  }
});

/* =========================================
   DRIVER REQUEST REFRESH
========================================= */

function startRideRefresh() {
  stopRideRefresh();

  rideRefreshTimer = setInterval(() => {
    if (
      currentProfile?.role === "driver" &&
      currentVehicle?.availability_status === "online"
    ) {
      loadDriverRideRequests();
    }
  }, 12000);
}

/* =========================================
   INITIAL APP SCREEN
========================================= */

// আগের লগইন সেশন থাকলেও প্রথমে Welcome দেখাবে।
// ব্যবহারকারী লগইন করলে তারপর ড্যাশবোর্ড খুলবে।

async function initializeApp() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    currentUser = data.session?.user || null;

    showOnly("welcomeSection");

  } catch (error) {
    console.error("Session check error:", error);
    showOnly("welcomeSection");
  }
}

initializeApp();
