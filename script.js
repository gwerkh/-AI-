// Mobile camera capture and local demo results only. No AI or network calls.
const camera = document.getElementById("camera");
const photo = document.getElementById("photo");
const startCameraButton = document.getElementById("start-camera");
const takePhotoButton = document.getElementById("take-photo");
const capturedImage = document.getElementById("captured-image");
const resultCard = document.getElementById("result-card");
const category = document.getElementById("category");
const wasteName = document.getElementById("waste-name");
const description = document.getElementById("description");
const material = document.getElementById("material");
const confidence = document.getElementById("confidence");
const disposal = document.getElementById("disposal");
const details = document.getElementById("details");
const moreButton = document.getElementById("more-button");
let cameraStream = null;

const demoResults = {
  plastic_bottle: { name: "페트병", material: "페트(PET)", description: "내용물을 비우고 라벨과 뚜껑을 분리해 주세요.", disposal: "내용물을 비운 뒤 물로 헹구고, 라벨을 제거해 주세요. 가능한 한 찌그러뜨려 전용 수거함에 배출합니다." },
  can: { name: "캔", material: "금속", description: "내용물을 비우고 가능한 한 납작하게 만들어 주세요.", disposal: "내용물을 비우고 헹군 뒤 캔류 수거함에 배출합니다. 날카로운 부분은 안쪽으로 접어 주세요." },
  paper: { name: "종이", material: "종이", description: "젖거나 음식물이 묻은 부분은 종이류에서 제외해 주세요.", disposal: "테이프와 비닐 등을 떼고 펼쳐서 묶거나 종이류 수거함에 배출합니다." },
  cardboard: { name: "박스", material: "골판지", description: "테이프와 송장을 제거하고 접어서 배출해 주세요.", disposal: "내용물을 비우고 테이프·송장·비닐을 제거한 뒤 납작하게 접어 묶어 배출합니다." },
  plastic_bag: { name: "비닐", material: "비닐류", description: "음식물 등 이물질이 묻지 않은 깨끗한 비닐만 분리해 주세요.", disposal: "이물질을 제거하고 투명 또는 별도 비닐류 수거 기준에 따라 배출합니다. 오염이 심하면 종량제 봉투에 버립니다." },
  glass_bottle: { name: "유리병", material: "유리", description: "내용물을 비우고 뚜껑을 분리해 주세요.", disposal: "내용물을 비우고 헹군 뒤 유리병 수거함에 배출합니다. 깨진 유리는 다치지 않도록 포장해 불연성 폐기물 기준을 확인하세요." }
};

function showResult(item, isPhoto = false) {
  category.textContent = isPhoto ? "촬영 완료 · 데모" : "테스트 예시 · AI 분석 아님";
  wasteName.textContent = isPhoto ? "사진이 촬영됐어요" : item.name;
  description.textContent = isPhoto
    ? "카메라 촬영은 정상 작동했습니다. 이 테스트 버전은 사진을 AI로 분석하지 않습니다. 아래 버튼으로 예시 결과를 확인할 수 있어요."
    : item.description;
  material.textContent = isPhoto ? "분석 기능 없음" : item.material;
  confidence.textContent = "해당 없음";
  disposal.textContent = isPhoto ? "분리배출 예시를 보려면 위의 테스트 모드에서 종류를 선택해 주세요." : item.disposal;
  details.classList.remove("show");
  moreButton.textContent = "더보기";
  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

startCameraButton.addEventListener("click", async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("이 브라우저에서 카메라를 사용할 수 없습니다. 최신 모바일 브라우저에서 HTTPS 또는 localhost로 접속해 주세요.");
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }, audio: false
    });
    camera.srcObject = cameraStream;
    await camera.play();
    startCameraButton.classList.add("hidden");
    takePhotoButton.classList.remove("hidden");
  } catch (error) {
    console.error("카메라 오류:", error);
    const message = error.name === "NotAllowedError"
      ? "카메라 권한이 거부됐습니다. 브라우저 설정에서 카메라 권한을 허용해 주세요."
      : "카메라를 시작할 수 없습니다. 다른 앱이 카메라를 사용 중인지와 브라우저 권한을 확인해 주세요.";
    alert(message + "\n\n휴대폰에서는 HTTPS로 접속해야 카메라가 작동합니다.");
  }
});

takePhotoButton.addEventListener("click", () => {
  if (!cameraStream || !camera.videoWidth) {
    alert("카메라 화면이 준비될 때까지 잠시 기다려 주세요.");
    return;
  }
  photo.width = camera.videoWidth;
  photo.height = camera.videoHeight;
  photo.getContext("2d").drawImage(camera, 0, 0, photo.width, photo.height);
  capturedImage.src = photo.toDataURL("image/jpeg", 0.9);
  capturedImage.classList.remove("hidden");
  showResult(null, true);
});

document.querySelectorAll(".waste-button").forEach((button) => {
  button.addEventListener("click", () => {
    const item = demoResults[button.dataset.waste];
    if (item) showResult(item);
  });
});

moreButton.addEventListener("click", () => {
  const isOpen = details.classList.toggle("show");
  moreButton.textContent = isOpen ? "접기" : "더보기";
  moreButton.setAttribute("aria-expanded", String(isOpen));
});

window.addEventListener("pagehide", () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
});

// Location-based district detection. Coordinates are used only in memory and are never saved.
const locationStatus = document.getElementById("location-status");
const currentRegion = document.getElementById("current-region");
const startLocationButton = document.getElementById("start-location");
let locationWatchId = null;
let lastRegionLookup = null;
let activeRegionCode = "";
let kakaoGeocoder = null;

function distanceInMeters(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function resolveRegion(latitude, longitude) {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.services) {
      reject(new Error("Kakao Maps key is missing or the SDK did not load."));
      return;
    }
    kakaoGeocoder ||= new kakao.maps.services.Geocoder();
    kakaoGeocoder.coord2RegionCode(longitude, latitude, (documents, status) => {
      if (status !== kakao.maps.services.Status.OK || !documents?.length) {
        reject(new Error("No administrative region was returned for this location."));
        return;
      }
      const district = documents.find((item) => item.region_type === "H") || documents[0];
      resolve({
        code: district.code,
        name: [district.region_1depth_name, district.region_2depth_name].filter(Boolean).join(" "),
        city: district.region_1depth_name,
        district: district.region_2depth_name
      });
    });
  });
}

async function updateDetectedRegion(position) {
  const point = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
  const now = Date.now();
  if (lastRegionLookup && now - lastRegionLookup.time < 30000) return;
  if (lastRegionLookup && distanceInMeters(lastRegionLookup.point, point) < 75) return;
  lastRegionLookup = { point, time: now };

  try {
    const region = await resolveRegion(point.latitude, point.longitude);
    currentRegion.textContent = region.name || "지역을 확인할 수 없음";
    if (region.code !== activeRegionCode) {
      activeRegionCode = region.code;
      locationStatus.textContent = "시·군·구가 확인됐습니다. 지역별 배출 기준 데이터는 아직 연결되지 않았습니다.";
      document.dispatchEvent(new CustomEvent("waste-region-change", { detail: region }));
    } else {
      locationStatus.textContent = "현재 지역을 확인했습니다. 위치가 다른 시·군·구로 바뀌면 자동 갱신합니다.";
    }
  } catch (error) {
    console.error("지역 확인 오류:", error);
    locationStatus.textContent = "지역을 확인하지 못했습니다. Kakao Developers의 JavaScript 키와 웹 도메인 설정을 확인해 주세요.";
  }
}

startLocationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = "이 브라우저에서는 위치 기능을 사용할 수 없습니다.";
    return;
  }
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    startLocationButton.textContent = "현재 위치 사용";
    locationStatus.textContent = "위치 감지를 멈췄습니다.";
    return;
  }
  locationStatus.textContent = "위치 권한을 확인하고 있습니다…";
  locationWatchId = navigator.geolocation.watchPosition(
    updateDetectedRegion,
    (error) => {
      const messages = {
        1: "위치 권한이 거부됐습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.",
        2: "현재 위치를 확인할 수 없습니다. GPS 또는 네트워크 연결을 확인해 주세요.",
        3: "위치 확인 시간이 초과됐습니다. 다시 시도해 주세요."
      };
      locationStatus.textContent = messages[error.code] || "위치를 확인하지 못했습니다.";
      if (error.code === 1) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        startLocationButton.textContent = "현재 위치 사용";
      }
    },
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
  );
  startLocationButton.textContent = "위치 감지 중지";
});

window.addEventListener("pagehide", () => {
  if (locationWatchId !== null) navigator.geolocation.clearWatch(locationWatchId);
});
// Officially sourced regional data for Ansan-si Danwon-gu.
const ansanDanwonGuide = {
  label: "경기도 안산시 단원구",
  sourceLinks: [
    { label: "단원구청 생활폐기물 배출 안내", url: "https://ansan.go.kr/danwongu/common/cntnts/selectContents.do?cntnts_id=C0000438" },
    { label: "안산시 재활용품 분리배출 안내", url: "https://ansan.go.kr/www/common/cntnts/selectContents.do?cntnts_id=C0001357" }
  ],
  checkedOn: "2026-10-06",
  items: {
    plastic_bottle: { material: "페트(PET)", disposal: "투명 음료·생수 페트병은 내용물을 비우고 헹군 뒤 라벨을 제거해 압착하고 뚜껑을 닫아 투명 페트병으로 따로 배출하세요. 유색 페트병 등은 플라스틱류로 배출합니다." },
    can: { material: "금속(알루미늄·철)", disposal: "내용물을 비우고 라벨이나 플라스틱 뚜껑 등 다른 재질을 제거해 캔류로 배출하세요. 페인트·오일 등 이물질이 묻은 캔은 재활용 대상이 아닙니다." },
    paper: { material: "종이·종이팩", disposal: "신문·책·종이상자 등은 묶어서 배출하고, 스프링·테이프 등 이물질을 제거하세요. 비닐 코팅지, 오염된 종이, 영수증은 재활용되지 않습니다. 종이팩은 내용물을 비우고 헹군 뒤 펼쳐 말려 배출하세요." },
    cardboard: { material: "골판지", disposal: "상자를 펼치고 택배 테이프 등 다른 재질을 제거한 뒤 묶어서 종이류로 배출하세요." },
    plastic_bag: { material: "비닐류", disposal: "내용물을 비우고 이물질을 제거한 뒤 비닐류로 배출하세요. 딱지처럼 접으면 재활용이 어려울 수 있습니다." },
    glass_bottle: { material: "유리병", disposal: "내용물을 비우고 라벨과 뚜껑을 제거해 배출하세요. 보증금 대상 소주·맥주병은 소매점에 반환할 수 있습니다. 깨진 유리, 내열유리, 크리스탈, 판유리, 사기·도자기는 재활용 유리병이 아니며 전용 마대 또는 대형폐기물 기준을 확인하세요." },
    food_waste: { material: "음식물류 폐기물", disposal: "일반 가정은 주황색 음식물 전용봉투에 담아 배출장소에 배출하세요. 지정 수거통을 이용하는 경우에도 전용 종량제봉투를 사용합니다. 뼈·조개껍데기·딱딱한 씨와 껍데기·달걀껍데기·차 찌꺼기 등은 일반 종량제봉투 대상입니다." }
  },
  schedule: "일반 생활폐기물·음식물류는 매일, 재활용품은 화·금요일, 대형폐기물은 월·목요일 배출로 안내되어 있습니다. 배출 시간은 전날 저녁 8시부터 다음 날 새벽 6시까지이며, 공동주택은 자체 지정일을 따릅니다."
};

let activeRegionGuide = null;

// Include all administrative levels because Kakao may return a city, district, and dong separately.
function resolveRegion(latitude, longitude) {
  return new Promise((resolve, reject) => {
    if (!window.kakao?.maps?.services) {
      reject(new Error("Kakao Maps SDK unavailable. Check the JavaScript key, Map activation, and registered domain."));
      return;
    }
    kakaoGeocoder ||= new kakao.maps.services.Geocoder();
    kakaoGeocoder.coord2RegionCode(longitude, latitude, (documents, status) => {
      if (status !== kakao.maps.services.Status.OK || !documents?.length) {
        reject(new Error(`Kakao region lookup failed: ${status}`));
        return;
      }
      const district = documents.find((item) => item.region_type === "H") || documents[0];
      const levels = [district.region_1depth_name, district.region_2depth_name, district.region_3depth_name, district.region_4depth_name].filter(Boolean);
      resolve({
        code: district.code,
        name: levels.join(" "),
        city: district.region_1depth_name || "",
        district: district.region_2depth_name || "",
        locality: district.region_3depth_name || "",
        levels
      });
    });
  });
}

document.addEventListener("waste-region-change", (event) => {
  const region = event.detail || {};
  const hierarchy = [...(region.levels || []), region.name, region.city, region.district, region.locality].join(" ");
  activeRegionGuide = hierarchy.includes("안산") && hierarchy.includes("단원구") ? ansanDanwonGuide : null;
  if (activeRegionGuide) {
    locationStatus.textContent = "단원구 공식 안내를 적용했습니다. " + activeRegionGuide.schedule;
  } else {
    locationStatus.textContent = "현재 지역은 확인했지만 연결된 지역별 배출 자료가 없습니다.";
  }
});

// Add locally stored, source-linked guidance to the existing demo result card.
function showResult(item, isPhoto = false) {
  const itemId = Object.keys(demoResults).find((key) => demoResults[key] === item);
  const localItem = !isPhoto && itemId ? activeRegionGuide?.items[itemId] : null;
  category.textContent = isPhoto
    ? "촬영 완료 · AI 분석 없음"
    : localItem
      ? `${activeRegionGuide.label} 공식 안내`
      : "테스트 예시 · AI 분석 아님";
  wasteName.textContent = isPhoto ? "사진이 촬영됐어요" : item.name;
  description.textContent = isPhoto
    ? "카메라 촬영은 정상 작동했습니다. 이 테스트 버전은 사진을 AI로 분석하지 않습니다."
    : item.description;
  material.textContent = isPhoto ? "분석 기능 없음" : (localItem?.material || item.material);
  confidence.textContent = localItem ? "공식 자료" : "해당 없음";
  disposal.textContent = isPhoto
    ? "지역별 예시를 보려면 테스트 모드에서 품목을 선택해 주세요."
    : (localItem?.disposal || item.disposal);

  resultSource.replaceChildren();
  if (!isPhoto && activeRegionGuide) {
    const schedule = document.createElement("span");
    schedule.textContent = activeRegionGuide.schedule + " ";
    resultSource.appendChild(schedule);
    for (const [index, source] of activeRegionGuide.sourceLinks.entries()) {
      if (index) resultSource.appendChild(document.createTextNode(" · "));
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.label;
      resultSource.appendChild(link);
    }
    const checked = document.createElement("span");
    checked.textContent = ` (확인일: ${activeRegionGuide.checkedOn})`;
    resultSource.appendChild(checked);
  }
  details.classList.remove("show");
  moreButton.textContent = "더보기";
  moreButton.setAttribute("aria-expanded", "false");
  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
const resultSource = document.getElementById('result-source');


demoResults.food_waste = {
  name: "음식물쓰레기",
  material: "음식물류 폐기물",
  description: "일반 가정은 음식물 전용봉투를 사용해 배출합니다.",
  disposal: "물기와 이물질을 최대한 제거한 뒤 지역 배출 기준을 확인하세요."
};

const wasteSearchAliases = {
  plastic_bottle: ["페트병", "페트", "생수병", "투명페트", "투명페트병", "플라스틱병"],
  can: ["캔", "알루미늄캔", "철캔", "음료수캔"],
  paper: ["종이", "신문", "종이팩", "우유팩", "멸균팩", "책"],
  cardboard: ["박스", "상자", "택배상자", "골판지", "종이박스"],
  plastic_bag: ["비닐", "비닐봉지", "비닐봉투", "과자봉지", "봉투"],
  glass_bottle: ["유리병", "소주병", "맥주병", "유리"],
  food_waste: ["음식물쓰레기", "음식물", "잔반", "음식찌꺼기"]
};

function normalizeWasteQuery(value) {
  return value.normalize("NFC").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

function findWasteId(query) {
  const normalized = normalizeWasteQuery(query);
  const entries = Object.entries(wasteSearchAliases);
  for (const [id, aliases] of entries) {
    if (aliases.some((alias) => normalizeWasteQuery(alias) === normalized)) return id;
  }
  if (normalized.length < 2) return null;
  for (const [id, aliases] of entries) {
    if (aliases.some((alias) => normalizeWasteQuery(alias).includes(normalized))) return id;
  }
  return null;
}

function showSearchNotFound(query) {
  category.textContent = activeRegionGuide ? activeRegionGuide.label + " · 검색 자료 없음" : "검색 자료 없음";
  wasteName.textContent = "등록된 품목을 찾지 못했어요";
  description.textContent = "“" + query + "”에 대한 안내가 아직 등록되지 않았습니다. 다른 이름이나 재질로 다시 검색해 주세요.";
  material.textContent = "미등록";
  confidence.textContent = "해당 없음";
  disposal.textContent = "현재 등록된 품목만 안내합니다. 미등록 품목은 지자체 안내를 확인해 주세요.";
  resultSource.replaceChildren();
  if (activeRegionGuide) {
    for (const [index, source] of activeRegionGuide.sourceLinks.entries()) {
      if (index) resultSource.appendChild(document.createTextNode(" · "));
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.label;
      resultSource.appendChild(link);
    }
  }
  details.classList.remove("show");
  moreButton.textContent = "더보기";
  moreButton.setAttribute("aria-expanded", "false");
  resultCard.classList.remove("hidden");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.getElementById("waste-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = document.getElementById("waste-search-input").value.trim();
  const itemId = findWasteId(query);
  if (itemId && demoResults[itemId]) {
    showResult(demoResults[itemId]);
  } else {
    showSearchNotFound(query);
  }
});