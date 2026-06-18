$(function () {
  const YOUTUBE_API_KEY = "xxx";

  const INITIAL_CENTER = { lat: 35.681236, lng: 139.767125 };
  const MAX_YOUTUBE_RESULTS = 10;
  const MAX_PLACE_RESULTS = 8;

  const themeClasses = [
    "theme-pink",
    "theme-red",
    "theme-blue",
    "theme-yellow",
    "theme-green",
    "theme-black"
  ];

  const state = {
    map: null,
    geocoder: null,
    infoWindow: null,
    markers: [],
    currentPlaces: []
  };

  const $body = $("body");
  const $sidebar = $(".sidebar");
  const $overlay = $(".overlay");
  const $menuToggle = $(".menu-toggle");
  const $themeButtons = $(".theme-btn");
  const $searchButton = $("#searchButton");
  const $keyword = $("#keyword");
  const $channel = $("#channel");
  const $resultList = $("#resultList");
  const $routeList = $("#routeList");
  const $mapBox = $("#map");

  // HTMLエスケープ
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 数字を2桁表示にしたいときの補助
  function formatCount(num) {
    return String(num).padStart(2, "0");
  }

  // サイドバーを開く
  function openSidebar() {
    $sidebar.addClass("is-open");
    $overlay.addClass("is-open");
  }

  // サイドバーを閉じる
  function closeSidebar() {
    $sidebar.removeClass("is-open");
    $overlay.removeClass("is-open");
  }

  // テーマを切り替える
  function changeTheme(themeName) {
    $body.removeClass(themeClasses.join(" "));
    $body.addClass(themeName);
  }

  // 地図の初期化
  function initMap() {
    if (!window.google || !google.maps) {
      $mapBox.html("<p>Google Maps APIの読み込みに失敗しました。</p>");
      return;
    }

    $mapBox.empty();

    state.map = new google.maps.Map(document.getElementById("map"), {
      center: INITIAL_CENTER,
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    state.geocoder = new google.maps.Geocoder();
    state.infoWindow = new google.maps.InfoWindow();
  }

  // 既存マーカーを消す
  function clearMarkers() {
    state.markers.forEach((marker) => marker.setMap(null));
    state.markers = [];
  }

  // YouTube検索APIを叩く
  function searchYouTubeVideos(query) {
    return $.ajax({
      url: "https://www.googleapis.com/youtube/v3/search",
      method: "GET",
      dataType: "json",
      data: {
        part: "snippet",
        q: query,
        type: "video",
        maxResults: MAX_YOUTUBE_RESULTS,
        regionCode: "JP",
        relevanceLanguage: "ja",
        key: YOUTUBE_API_KEY
      }
    });
  }

  // APIの返り値を表示用に整える
  function formatVideoItems(items) {
    return (items || [])
      .filter((item) => item.id && item.id.videoId && item.snippet)
      .map((item) => {
        const videoId = item.id.videoId;

        return {
          videoId: videoId,
          title: item.snippet.title || "",
          description: item.snippet.description || "",
          channelTitle: item.snippet.channelTitle || "",
          publishedAt: item.snippet.publishedAt || "",
          url: `https://www.youtube.com/watch?v=${videoId}`
        };
      });
  }

  // 場所候補を拾うための簡易パターン
  function extractLocationCandidates(text) {
    if (!text) return [];

    const patterns = [
      /([一-龥ぁ-んァ-ヶーA-Za-z0-9\s]+(?:駅|公園|神社|寺|タワー|展望台|海岸|カフェ|レストラン|商店街|美術館|博物館|空港|港|広場|橋|浜|山|丘|坂|通り|ストリート|スクエア|スタジオ|ホテル|市場))/g,
      /(東京都|大阪府|京都府|神奈川県|千葉県|埼玉県|愛知県|福岡県|北海道|沖縄県|兵庫県|宮城県|広島県|静岡県|奈良県|長野県|石川県|熊本県|鹿児島県)/g,
      /([A-Za-z][A-Za-z\s]+(?:Station|Park|Tower|Museum|Cafe|Tokyo|Osaka|Shibuya|Harajuku|Ueno|Asakusa))/g
    ];

    const results = [];

    patterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (!matches) return;

      matches.forEach((match) => {
        const cleaned = match.trim();
        if (cleaned && !results.includes(cleaned)) {
          results.push(cleaned);
        }
      });
    });

    return results;
  }

  // 動画から場所候補を作る
  function buildPlaceCandidates(videos) {
    const placeMap = new Map();

    videos.forEach((video) => {
      const combinedText = `${video.title} ${video.description} ${video.channelTitle}`;
      const candidates = extractLocationCandidates(combinedText);

      candidates.forEach((placeName) => {
        const key = placeName.replace(/\s+/g, " ").trim();

        if (!placeMap.has(key)) {
          placeMap.set(key, {
            name: key,
            videos: [video]
          });
        } else {
          placeMap.get(key).videos.push(video);
        }
      });
    });

    return Array.from(placeMap.values()).slice(0, MAX_PLACE_RESULTS);
  }

  // 候補一覧を表示
  function renderResults(places) {
    $resultList.empty();

    if (!places || places.length === 0) {
      $resultList.append("<li>場所候補が見つかりませんでした。</li>");
      return;
    }

    places.forEach((place) => {
      const relatedVideos = (place.videos || []).slice(0, 3);

      let videoHtml = "";
      relatedVideos.forEach((video) => {
        videoHtml += `
          <li>
            <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener">
              ${escapeHtml(video.title)}
            </a>
          </li>
        `;
      });

      $resultList.append(`
        <li>
          <strong>${escapeHtml(place.name)}</strong><br>
          関連動画数: ${formatCount(place.videos.length)}<br>
          <ul>
            ${videoHtml}
          </ul>
        </li>
      `);
    });
  }

  // 巡礼ルートを表示
  function renderRoute(routePlaces) {
    $routeList.empty();

    if (!routePlaces || routePlaces.length === 0) {
      $routeList.append("<li>ルート候補はまだありません。</li>");
      return;
    }

    routePlaces.forEach((place, index) => {
      $routeList.append(`
        <li>
          ${index + 1}. ${escapeHtml(place.name)} 
          <small>（関連動画 ${place.videos.length}件）</small>
        </li>
      `);
    });
  }

  // 距離を計算する
  function haversineDistance(a, b) {
    const R = 6371;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;

    const s1 =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return 2 * R * Math.asin(Math.sqrt(s1));
  }

  // 巡回順を「今いる場所に近い順」で並べる
  function buildRouteOrder(places) {
    if (!places || places.length === 0) return [];

    const remaining = [...places];
    const ordered = [remaining.shift()];

    while (remaining.length > 0) {
      const last = ordered[ordered.length - 1];
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      remaining.forEach((place, index) => {
        const distance = haversineDistance(last.position, place.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      ordered.push(remaining.splice(nearestIndex, 1)[0]);
    }

    return ordered;
  }

  // 住所候補をジオコードする
  function geocodePlace(placeName) {
    return new Promise((resolve, reject) => {
      if (!state.geocoder) {
        reject(new Error("Geocoder is not ready"));
        return;
      }

      state.geocoder.geocode(
        { address: `${placeName} 日本` },
        (results, status) => {
          if (status === "OK" && results && results[0]) {
            const location = results[0].geometry.location;

            resolve({
              lat: location.lat(),
              lng: location.lng()
            });
          } else {
            reject(status);
          }
        }
      );
    });
  }

  // 場所候補に緯度経度を付ける
  async function resolvePlaces(places) {
    const resolved = [];

    for (const place of places) {
      try {
        const position = await geocodePlace(place.name);
        resolved.push({
          ...place,
          position
        });
      } catch (error) {
        console.warn(`ジオコード失敗: ${place.name}`, error);
      }
    }

    return resolved;
  }

  // 地図にピンを立てる
  function renderMap(places) {
    if (!state.map || !state.infoWindow) return;

    clearMarkers();

    if (!places || places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    places.forEach((place, index) => {
      const marker = new google.maps.Marker({
        map: state.map,
        position: place.position,
        label: String(index + 1),
        title: place.name
      });

      marker.addListener("click", () => {
        const videoList = (place.videos || [])
          .slice(0, 3)
          .map((video) => `<li>${escapeHtml(video.title)}</li>`)
          .join("");

        state.infoWindow.setContent(`
          <div style="max-width: 240px;">
            <strong>${escapeHtml(place.name)}</strong>
            <p style="margin: 8px 0 0;">関連動画</p>
            <ul style="padding-left: 18px; margin: 8px 0 0;">
              ${videoList}
            </ul>
          </div>
        `);

        state.infoWindow.open({
          map: state.map,
          anchor: marker
        });
      });

      state.markers.push(marker);
      bounds.extend(place.position);
    });

    state.map.fitBounds(bounds);

    if (places.length === 1) {
      state.map.setZoom(14);
    }
  }

  // 検索ボタン処理
  async function handleSearch() {
    const keyword = $keyword.val().trim();
    const channel = $channel.val().trim();

    if (keyword === "" && channel === "") {
      alert("推しの名前、動画タイトル、またはチャンネル情報を入力してください。");
      return;
    }

    if (YOUTUBE_API_KEY === "YOUR_YOUTUBE_API_KEY") {
      alert("YouTube APIキーを設定してください。");
      return;
    }

    const query = [keyword, channel].filter(Boolean).join(" ").trim();

    $searchButton.prop("disabled", true).text("検索中...");

    try {
      const response = await searchYouTubeVideos(query);
      const videos = formatVideoItems(response.items || []);
      const placeCandidates = buildPlaceCandidates(videos);
      const resolvedPlaces = await resolvePlaces(placeCandidates);
      const routePlaces = buildRouteOrder(resolvedPlaces);

      state.currentPlaces = resolvedPlaces;

      renderResults(resolvedPlaces);
      renderRoute(routePlaces);
      renderMap(resolvedPlaces);

      if (resolvedPlaces.length === 0) {
        alert("動画は見つかりましたが、場所候補を地図に変換できませんでした。");
      }
    } catch (error) {
      console.error("検索失敗:", error);
      alert("検索に失敗しました。APIキーや通信状態を確認してください。");
    } finally {
      $searchButton.prop("disabled", false).text("推しが訪れた場所を探す");
    }
  }

  // Enterキーでも検索できるようにする
  $keyword.add($channel).on("keydown", function (event) {
    if (event.key === "Enter") {
      handleSearch();
    }
  });

  // UIイベント
  $menuToggle.on("click", function () {
    if ($sidebar.hasClass("is-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  $overlay.on("click", function () {
    closeSidebar();
  });

  $themeButtons.on("click", function () {
    const themeName = $(this).data("theme");
    changeTheme(themeName);
    closeSidebar();
  });

  $searchButton.on("click", function () {
    handleSearch();
  });

  // 初期化
  initMap();
});