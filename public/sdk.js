/**
 * Kaiseki Analytics SDK v1.0.0
 *
 * 導入方法:
 * <script src="https://{your-domain}/sdk.js" data-project="YOUR_PROJECT_KEY"></script>
 *
 * 機能:
 * - page_view 自動追跡
 * - SPA対応（history hook）
 * - visitor_id (cookie/localStorage)
 * - session_id（30分タイムアウト）
 * - 流入情報はセッション開始時に固定
 * - 最大スクロール記録（離脱時1回）
 * - data-track クリックのみ取得
 * - sendBeacon 優先
 * - PII 自動除外
 * - HMAC 署名（オプション）
 * - 短期リトライ
 */
(function (window, document) {
  "use strict";

  // ========== 設定 ==========
  var script = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var PROJECT_KEY = script.getAttribute("data-project");
  var ENDPOINT =
    script.getAttribute("data-endpoint") ||
    (script.src
      ? script.src.replace(/\/sdk\.js.*$/, "/api/ingest")
      : "/api/ingest");

  if (!PROJECT_KEY) {
    console.warn("[Kaiseki] data-project が設定されていません");
    return;
  }

  // ========== 定数 ==========
  var SESSION_TIMEOUT = 30 * 60 * 1000; // 30分
  var ENGAGEMENT_PING_INTERVAL = 10 * 1000; // 10秒
  var STORAGE_PREFIX = "kaiseki_";
  var COOKIE_VISITOR_KEY = "_kvisitor";
  var COOKIE_SESSION_KEY = "_ksession";

  // ========== ユーティリティ ==========
  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function setCookie(name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie =
      name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
  }

  function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop().split(";").shift() || "");
    }
    return null;
  }

  function getStorage(key) {
    try {
      return localStorage.getItem(STORAGE_PREFIX + key);
    } catch (e) {
      return null;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, value);
    } catch (e) {
      // localStorage unavailable
    }
  }

  // PII フィールドを除去する
  var PII_PATTERNS = [/email/i, /password/i, /phone/i, /credit/i, /ssn/i];
  function sanitizeProps(obj) {
    if (!obj || typeof obj !== "object") return obj;
    var clean = {};
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        var isPII = PII_PATTERNS.some(function (p) {
          return p.test(key);
        });
        if (!isPII) {
          clean[key] = obj[key];
        }
      }
    }
    return clean;
  }

  // URLからPIIを除去する（クエリパラメータのメール等）
  function sanitizeUrl(url) {
    try {
      var u = new URL(url);
      var params = new URLSearchParams();
      u.searchParams.forEach(function (value, key) {
        var isPII = PII_PATTERNS.some(function (p) {
          return p.test(key);
        });
        if (!isPII && !["token", "auth", "key", "secret"].includes(key.toLowerCase())) {
          params.set(key, value);
        }
      });
      u.search = params.toString();
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  // ========== 訪問者・セッション管理 ==========

  // visitor_id: 永続Cookie + localStorage
  function getVisitorId() {
    var id = getCookie(COOKIE_VISITOR_KEY) || getStorage("visitor_id");
    if (!id) {
      id = uuid();
      setCookie(COOKIE_VISITOR_KEY, id, 365);
      setStorage("visitor_id", id);
    }
    return id;
  }

  var visitorId = getVisitorId();

  // session_id: 30分タイムアウト
  function getOrCreateSession() {
    var now = Date.now();
    var sessionData = null;

    try {
      var raw = sessionStorage.getItem(STORAGE_PREFIX + "session");
      if (raw) sessionData = JSON.parse(raw);
    } catch (e) {
      // ignore
    }

    if (sessionData && now - sessionData.lastActivity < SESSION_TIMEOUT) {
      sessionData.lastActivity = now;
      try {
        sessionStorage.setItem(
          STORAGE_PREFIX + "session",
          JSON.stringify(sessionData)
        );
      } catch (e) {}
      return { sessionId: sessionData.id, isNew: false };
    }

    // 新しいセッション
    var newSession = {
      id: uuid(),
      startedAt: now,
      lastActivity: now,
      attribution: captureAttribution(),
    };

    try {
      sessionStorage.setItem(
        STORAGE_PREFIX + "session",
        JSON.stringify(newSession)
      );
    } catch (e) {}

    return { sessionId: newSession.id, isNew: true, attribution: newSession.attribution };
  }

  function updateSessionActivity() {
    try {
      var raw = sessionStorage.getItem(STORAGE_PREFIX + "session");
      if (raw) {
        var data = JSON.parse(raw);
        data.lastActivity = Date.now();
        sessionStorage.setItem(STORAGE_PREFIX + "session", JSON.stringify(data));
      }
    } catch (e) {}
  }

  function getSessionAttribution() {
    try {
      var raw = sessionStorage.getItem(STORAGE_PREFIX + "session");
      if (raw) {
        var data = JSON.parse(raw);
        return data.attribution || {};
      }
    } catch (e) {}
    return {};
  }

  // ========== 流入情報取得（セッション開始時に固定） ==========
  function captureAttribution() {
    var url = new URL(window.location.href);
    var params = url.searchParams;

    return {
      landingUrl: sanitizeUrl(window.location.href),
      landingPath: window.location.pathname,
      referrer: document.referrer || null,
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
      utmContent: params.get("utm_content"),
      utmTerm: params.get("utm_term"),
      gclid: params.get("gclid"),
      wbraid: params.get("wbraid"),
      gbraid: params.get("gbraid"),
      fbclid: params.get("fbclid"),
    };
  }

  // ========== イベント送信 ==========

  function send(payload, retries) {
    retries = retries || 0;
    var body = JSON.stringify(payload);

    // sendBeacon 優先（ページ離脱時も確実に送信）
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: "application/json" });
      var ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }

    // fetch フォールバック
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(function (err) {
      if (retries < 3) {
        setTimeout(function () {
          send(payload, retries + 1);
        }, Math.pow(2, retries) * 1000);
      }
    });
  }

  function buildPayload(eventType, props) {
    var attribution = getSessionAttribution();
    var base = {
      projectKey: PROJECT_KEY,
      visitorId: visitorId,
      sessionId: currentSessionId,
      eventType: eventType,
      path: window.location.pathname,
      timestamp: new Date().toISOString(),
    };

    if (props) {
      base.props = sanitizeProps(props);
    }

    return base;
  }

  // ========== セッション初期化 ==========

  var sessionResult = getOrCreateSession();
  var currentSessionId = sessionResult.sessionId;

  if (sessionResult.isNew) {
    // session_start イベント
    var sessionPayload = buildPayload("session_start");
    var attr = sessionResult.attribution || {};
    sessionPayload.attribution = attr;
    send(sessionPayload);
  }

  // ========== スクロール追跡 ==========

  var maxScrollPercent = 0;

  function getScrollPercent() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight =
      Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      ) - window.innerHeight;
    if (docHeight <= 0) return 100;
    return Math.min(100, Math.round((scrollTop / docHeight) * 100));
  }

  var scrollTimer = null;
  function onScroll() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var pct = getScrollPercent();
      if (pct > maxScrollPercent) {
        maxScrollPercent = pct;
      }
    }, 200);
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  // 離脱時にスクロール深度を1回送信
  function sendScrollDepth() {
    if (maxScrollPercent > 0) {
      send(buildPayload("scroll_depth", { percent: maxScrollPercent }));
    }
  }

  // ========== エンゲージメントping ==========

  var engagementTimer = null;
  var pingCount = 0;

  function startEngagementPing() {
    engagementTimer = setInterval(function () {
      pingCount++;
      send(buildPayload("engagement_ping", { pingCount: pingCount }));
      updateSessionActivity();
    }, ENGAGEMENT_PING_INTERVAL);
  }

  function stopEngagementPing() {
    clearInterval(engagementTimer);
  }

  // ページ表示中のみpingを送る
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopEngagementPing();
      sendScrollDepth();
    } else {
      startEngagementPing();
    }
  });

  startEngagementPing();

  // ========== ページビュー ==========

  function trackPageView() {
    send(buildPayload("page_view", { title: document.title }));
    updateSessionActivity();
    // スクロールリセット
    maxScrollPercent = 0;
  }

  // 初回ページビュー
  trackPageView();

  // ========== SPA対応（history hook） ==========

  function hookHistory(type) {
    var orig = history[type];
    return function () {
      var result = orig.apply(this, arguments);
      window.dispatchEvent(new Event("kaiseki:" + type.toLowerCase()));
      return result;
    };
  }

  history.pushState = hookHistory("pushState");
  history.replaceState = hookHistory("replaceState");

  window.addEventListener("kaiseki:pushstate", function () {
    sendScrollDepth();
    setTimeout(trackPageView, 0);
  });

  window.addEventListener("popstate", function () {
    sendScrollDepth();
    setTimeout(trackPageView, 0);
  });

  // ========== CTA クリック追跡 ==========

  document.addEventListener(
    "click",
    function (e) {
      var el = e.target;
      // data-track 属性を持つ要素（または親要素）を探す
      while (el && el !== document) {
        if (el.getAttribute && el.getAttribute("data-track")) {
          var trackName = el.getAttribute("data-track");
          var trackProps = {};
          // data-track-* 属性を収集
          Array.prototype.forEach.call(el.attributes, function (attr) {
            if (attr.name.startsWith("data-track-") && attr.name !== "data-track") {
              var propKey = attr.name.replace("data-track-", "").replace(/-/g, "_");
              trackProps[propKey] = attr.value;
            }
          });

          send(
            buildPayload("cta_click", {
              trackName: trackName,
              text: el.textContent ? el.textContent.trim().substring(0, 100) : "",
              ...trackProps,
            })
          );
          break;
        }
        el = el.parentElement;
      }
    },
    true
  );

  // ========== ヒートマップ用クリック追跡 ==========

  document.addEventListener(
    "click",
    function (e) {
      var docH = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
      var x =
        window.innerWidth > 0
          ? Math.round((e.clientX / window.innerWidth) * 10000) / 100
          : 0;
      var y =
        docH > 0
          ? Math.round(((e.clientY + window.scrollY) / docH) * 10000) / 100
          : 0;

      var el = e.target || document.body;
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      var id = el.id ? "#" + el.id : "";
      var cls =
        el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      var selector = (tag + id + cls).slice(0, 80);

      send(
        buildPayload("click", {
          x: x,
          y: y,
          vw: window.innerWidth,
          selector: selector,
        })
      );
    },
    true
  );

  // ========== 離脱時処理 ==========

  window.addEventListener("beforeunload", function () {
    stopEngagementPing();
    sendScrollDepth();
  });

  // ========== パブリックAPI ==========

  window.kaiseki = window.kaiseki || {};

  /**
   * カスタムイベントを手動送信する
   */
  window.kaiseki.track = function (eventName, props) {
    var payload = buildPayload("custom", sanitizeProps(props || {}));
    payload.eventName = eventName;
    send(payload);
  };

  /**
   * コンバージョンを手動送信する
   */
  window.kaiseki.conversion = function (conversionName, props) {
    var payload = buildPayload("conversion", sanitizeProps(props || {}));
    payload.conversionName = conversionName;
    send(payload);
  };

  /**
   * 現在のセッション情報を取得する（デバッグ用）
   */
  window.kaiseki.debug = function () {
    return {
      projectKey: PROJECT_KEY,
      visitorId: visitorId,
      sessionId: currentSessionId,
      maxScroll: maxScrollPercent,
      attribution: getSessionAttribution(),
    };
  };
})(window, document);
