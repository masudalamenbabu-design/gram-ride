const SUPABASE_URL = "https://dvryhortalliicjyaxfb.supabase.co";
const SUPABASE_KEY = "sb_publishable_-rN6Uk-0rRFNFBBegaCwVg_rDWEpxIN";

const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const unions = {
  shyamnagar: [
    "ভুরুলিয়া", "কাশিমাড়ী", "শ্যামনগর",
    "নূরনগর", "কৈখালী", "রমজাননগর",
    "মুন্সিগঞ্জ", "ঈশ্বরীপুর", "বুড়িগোয়ালিনী",
    "আটুলিয়া", "পদ্মপুকুর", "গাবুরা"
  ],
  koyra: [
    "আমাদী", "বাগালী", "মহেশ্বরীপুর",
    "মহারাজপুর", "কয়রা", "উত্তর বেদকাশী",
    "দক্ষিণ বেদকাশী"
  ]
};

const thana = document.getElementById("thana");
const union = document.getElementById("union");
const searchBtn = document.getElementById("searchBtn");
const result = document.getElementById("result");

thana.addEventListener("change", function () {
  union.innerHTML = '<option value="">ইউনিয়ন নির্বাচন করুন</option>';

  if (!thana.value || !unions[thana.value]) {
    union.innerHTML = '<option value="">আগে থানা নির্বাচন করুন</option>';
    return;
  }

  unions[thana.value].forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    union.appendChild(option);
  });

  result.textContent = "";
});

searchBtn.addEventListener("click", function () {
  if (!thana.value) {
    result.textContent = "আগে আপনার থানা নির্বাচন করুন।";
    return;
  }

  if (!union.value) {
    result.textContent = "আগে আপনার ইউনিয়ন নির্বাচন করুন।";
    return;
  }

  result.textContent =
    "নির্বাচিত এলাকা: " +
    thana.options[thana.selectedIndex].text +
    " — " + union.value;
});

console.log("গ্রাম রাইড: Supabase সংযোগ প্রস্তুত", db);
async function testSupabase() {
  const { data, error } = await db
    .from("thanas")
    .select("*");

  if (error) {
    result.textContent = "ডাটাবেস সমস্যা: " + error.message;
    console.log(error);
    return;
  }

  result.textContent =
    "Supabase সংযোগ সফল! মোট থানা: " + data.length;

  console.log("থানার তথ্য:", data);
}

testSupabase();
const driverBtn = document.getElementById("driverBtn");
const driverForm = document.getElementById("driverForm");

driverBtn.addEventListener("click", function () {
  driverForm.style.display = "block";
  driverBtn.style.display = "none";
});

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authMessage = document.getElementById("authMessage");

document.getElementById("signupBtn").addEventListener("click", async function () {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authMessage.textContent = "ইমেইল ও পাসওয়ার্ড লিখুন।";
    return;
  }

  if (password.length < 6) {
    authMessage.textContent = "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।";
    return;
  }

  const { data, error } = await db.auth.signUp({
    email: email,
    password: password
  });

  if (error) {
    authMessage.textContent = "সমস্যা: " + error.message;
  } else {
    authMessage.textContent =
      "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল যাচাই করতে হতে পারে।";
  }
});

document.getElementById("loginBtn").addEventListener("click", async function () {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authMessage.textContent = "ইমেইল ও পাসওয়ার্ড লিখুন।";
    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    authMessage.textContent = "লগইন সমস্যা: " + error.message;
  } else {
    authMessage.textContent = "লগইন সফল হয়েছে!";
  }
});

const registerBtn = document.getElementById("registerBtn");
const driverMessage = document.getElementById("driverMessage");

registerBtn.addEventListener("click", async function () {
  const driverName = document.getElementById("driverName").value.trim();
  const driverPhone = document.getElementById("driverPhone").value.trim();
  const vehicleType = document.getElementById("vehicleType").value.trim();
  const vehicleNumber = document.getElementById("vehicleNumber").value.trim();

  if (!driverName || !driverPhone || !vehicleType || !vehicleNumber) {
    driverMessage.textContent = "সব তথ্য পূরণ করুন।";
    return;
  }

  const { data: userData, error: userError } = await db.auth.getUser();

  if (userError || !userData.user) {
    driverMessage.textContent = "আগে লগইন করুন।";
    return;
  }

  const userId = userData.user.id;

  const { error: profileError } = await db
    .from("profiles")
    .upsert({
      id: userId,
      full_name: driverName,
      phone: driverPhone
    });

  if (profileError) {
    driverMessage.textContent =
      "চালকের তথ্য সংরক্ষণ সমস্যা: " + profileError.message;
    return;
  }

  const { error: vehicleError } = await db
    .from("vehicles")
    .insert({
      driver_id: userId,
      vehicle_type: vehicleType,
      vehicle_number: vehicleNumber,
      status: "অপেক্ষমাণ",
      is_approved: false
    });

  if (vehicleError) {
    driverMessage.textContent =
      "গাড়ির তথ্য সংরক্ষণ সমস্যা: " + vehicleError.message;
    return;
  }

  driverMessage.textContent =
    "চালক নিবন্ধন সফল! আপনার আবেদন অ্যাডমিনের অনুমোদনের অপেক্ষায় আছে।";

  registerBtn.disabled = true;
});
