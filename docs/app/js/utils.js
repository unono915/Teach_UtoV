/* 공통 유틸리티 — 시간 파싱/표기, 유튜브 URL 해석, 작은 DOM 헬퍼 */
(function (global) {
  'use strict';

  var TU = global.TU || (global.TU = {});

  /** 짧고 충돌 가능성이 낮은 id */
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
  }

  /**
   * "90", "1:30", "01:02:03", "1m30s", "90s" 를 초로 바꾼다.
   * 해석할 수 없으면 null.
   */
  function parseTime(input) {
    if (input === null || input === undefined) return null;
    var text = String(input).trim();
    if (!text) return null;

    if (/^\d+(\.\d+)?$/.test(text)) return Math.max(0, parseFloat(text));

    var unit = text.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+(?:\.\d+)?)\s*s)?$/i);
    if (unit && (unit[1] || unit[2] || unit[3])) {
      return Math.max(0,
        (parseInt(unit[1] || '0', 10) * 3600) +
        (parseInt(unit[2] || '0', 10) * 60) +
        parseFloat(unit[3] || '0'));
    }

    var parts = text.split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    var total = 0;
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i].trim();
      if (!/^\d+(\.\d+)?$/.test(piece)) return null;
      total = total * 60 + parseFloat(piece);
    }
    return Math.max(0, total);
  }

  /** 초 -> "m:ss" 또는 "h:mm:ss" */
  function formatTime(seconds) {
    var value = Math.max(0, Math.floor(Number(seconds) || 0));
    var h = Math.floor(value / 3600);
    var m = Math.floor((value % 3600) / 60);
    var s = value % 60;
    var mm = h > 0 && m < 10 ? '0' + m : String(m);
    var ss = s < 10 ? '0' + s : String(s);
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  /** 편집 칸에 넣기 좋은 고정 폭 표기 (항상 분:초 이상) */
  function formatTimeInput(seconds) {
    if (seconds === null || seconds === undefined || seconds === '') return '';
    return formatTime(seconds);
  }

  /** 구간 길이를 사람이 읽는 문구로 */
  function formatDuration(start, end) {
    if (end === null || end === undefined) return '끝까지';
    var length = Math.max(0, Math.round(end - start));
    if (length < 60) return length + '초';
    var m = Math.floor(length / 60);
    var s = length % 60;
    return s === 0 ? m + '분' : m + '분 ' + s + '초';
  }

  var VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

  /**
   * 유튜브 주소(또는 id)에서 { videoId, start } 를 뽑는다.
   * 인식 실패 시 null.
   */
  function parseYouTube(input) {
    if (!input) return null;
    var text = String(input).trim();
    if (!text) return null;

    if (VIDEO_ID.test(text)) return { videoId: text, start: null };

    var url;
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
    } catch (err) {
      return null;
    }

    var host = url.hostname.replace(/^www\./i, '').toLowerCase();
    var path = url.pathname.replace(/\/+$/, '');
    var id = null;

    if (host === 'youtu.be') {
      id = path.slice(1).split('/')[0];
    } else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (path === '/watch') {
        id = url.searchParams.get('v');
      } else {
        var seg = path.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
        if (seg) id = seg[2];
      }
    }

    if (!id || !VIDEO_ID.test(id)) return null;

    var start = parseTime(url.searchParams.get('t') || url.searchParams.get('start') || '');
    return { videoId: id, start: start };
  }

  function thumbnailUrl(videoId) {
    return 'https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg';
  }

  function watchUrl(videoId, start) {
    var base = 'https://www.youtube.com/watch?v=' + videoId;
    return start ? base + '&t=' + Math.floor(start) + 's' : base;
  }

  /** document.querySelector 축약 */
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /** 속성/자식을 한 번에 지정하는 createElement */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else node.setAttribute(key, value === true ? '' : value);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  TU.utils = {
    uid: uid,
    parseTime: parseTime,
    formatTime: formatTime,
    formatTimeInput: formatTimeInput,
    formatDuration: formatDuration,
    parseYouTube: parseYouTube,
    thumbnailUrl: thumbnailUrl,
    watchUrl: watchUrl,
    $: $,
    $$: $$,
    el: el,
    clamp: clamp
  };
})(window);
