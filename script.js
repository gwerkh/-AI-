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