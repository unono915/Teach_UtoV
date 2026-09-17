/*
 * YouTube IFrame Player API 얇은 감싸개.
 *
 * 영상은 유튜브가 그대로 재생하고, 이 모듈은 "어디서 시작해 어디서 멈출지"만 관리한다.
 * 내려받거나 복제하는 동작은 전혀 없다.
 */
(function (global) {
  'use strict';

  var TU = global.TU || (global.TU = {});
  var API_SRC = 'https://www.youtube.com/iframe_api';
  var TICK_MS = 120;

  var apiPromise = null;

  /** iframe_api 스크립트를 한 번만 넣고, YT 준비가 끝나면 resolve 한다. */
  function ensureApi() {
    if (apiPromise) return apiPromise;

    apiPromise = new Promise(function (resolve, reject) {
      if (global.YT && global.YT.Player) return resolve(global.YT);

      var previous = global.onYouTubeIframeAPIReady;
      global.onYouTubeIframeAPIReady = function () {
        if (typeof previous === 'function') previous();
        resolve(global.YT);
      };

      var script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      script.onerror = function () {
        reject(new Error('유튜브 플레이어를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
      };
      document.head.appendChild(script);
    });

    return apiPromise;
  }

  function Segment() {
    this.clip = null;
    this.start = 0;
    this.end = null;
  }

  function createPlayer(options) {
    var handlers = {
      onReady: options.onReady || function () {},
      onStateChange: options.onStateChange || function () {},
      onSegmentEnd: options.onSegmentEnd || function () {},
      onTick: options.onTick || function () {},
      onError: options.onError || function () {}
    };

    var yt = null;
    var ready = false;
    var segment = new Segment();
    var timer = null;
    var pendingClip = null;
    var loopClip = false;
    var endFired = false;

    function startTicker() {
      if (timer) return;
      timer = global.setInterval(tick, TICK_MS);
    }

    function stopTicker() {
      if (!timer) return;
      global.clearInterval(timer);
      timer = null;
    }

    function currentTime() {
      if (!ready || !yt || typeof yt.getCurrentTime !== 'function') return 0;
      var value = yt.getCurrentTime();
      return isFinite(value) ? value : 0;
    }

    function duration() {
      if (!ready || !yt || typeof yt.getDuration !== 'function') return 0;
      var value = yt.getDuration();
      return isFinite(value) ? value : 0;
    }

    function isPlaying() {
      return ready && yt && yt.getPlayerState && yt.getPlayerState() === global.YT.PlayerState.PLAYING;
    }

    function tick() {
      if (!ready) return;
      var time = currentTime();
      handlers.onTick(time, duration(), segment);

      if (segment.end === null || !isPlaying()) return;
      if (time < segment.end - 0.05) {
        endFired = false;
        return;
      }
      if (endFired) return;
      endFired = true;

      if (loopClip) {
        yt.seekTo(segment.start, true);
        yt.playVideo();
        endFired = false;
      } else {
        yt.pauseVideo();
        yt.seekTo(segment.start, true);
      }
      handlers.onSegmentEnd(segment.clip);
    }

    function applyClip(clip, autoplay) {
      segment.clip = clip;
      segment.start = Number(clip.start) || 0;
      segment.end = clip.end === null || clip.end === undefined ? null : Number(clip.end);
      endFired = false;

      var args = { videoId: clip.videoId, startSeconds: segment.start };
      if (autoplay) yt.loadVideoById(args);
      else yt.cueVideoById(args);
      startTicker();
    }

    function mount(elementId) {
      return ensureApi().then(function (YT) {
        return new Promise(function (resolve) {
          yt = new YT.Player(elementId, {
            host: 'https://www.youtube-nocookie.com',
            playerVars: {
              rel: 0,
              modestbranding: 1,
              playsinline: 1,
              iv_load_policy: 3,
              enablejsapi: 1,
              origin: global.location.origin
            },
            events: {
              onReady: function () {
                ready = true;
                if (pendingClip) {
                  applyClip(pendingClip.clip, pendingClip.autoplay);
                  pendingClip = null;
                }
                handlers.onReady();
                resolve(api);
              },
              onStateChange: function (event) {
                if (event.data === global.YT.PlayerState.PLAYING) startTicker();
                handlers.onStateChange(event.data);
              },
              onError: function (event) {
                handlers.onError(event.data);
              }
            }
          });
        });
      });
    }

    var api = {
      mount: mount,

      /** 클립을 걸고(autoplay 면 바로) 재생한다. */
      load: function (clip, autoplay) {
        if (!clip) return;
        if (!ready) {
          pendingClip = { clip: clip, autoplay: !!autoplay };
          segment.clip = clip;
          return;
        }
        applyClip(clip, !!autoplay);
      },

      play: function () { if (ready) yt.playVideo(); },
      pause: function () { if (ready) yt.pauseVideo(); },

      toggle: function () {
        if (!ready) return;
        if (isPlaying()) yt.pauseVideo();
        else yt.playVideo();
      },

      /** 구간 처음으로 되돌린다. */
      restart: function (autoplay) {
        if (!ready) return;
        endFired = false;
        yt.seekTo(segment.start, true);
        if (autoplay !== false) yt.playVideo();
      },

      seekTo: function (seconds) {
        if (!ready) return;
        endFired = false;
        yt.seekTo(Math.max(0, seconds), true);
      },

      seekBy: function (delta) {
        if (!ready) return;
        api.seekTo(currentTime() + delta);
      },

      setRate: function (rate) {
        if (ready && yt.setPlaybackRate) yt.setPlaybackRate(rate);
      },

      getRate: function () {
        return ready && yt.getPlaybackRate ? yt.getPlaybackRate() : 1;
      },

      setVolume: function (value) {
        if (ready && yt.setVolume) yt.setVolume(value);
      },

      setLoop: function (value) { loopClip = !!value; },

      /** 편집 화면에서 구간과 무관하게 영상만 띄울 때 사용한다. */
      preview: function (videoId, startSeconds) {
        if (!ready) return;
        segment.clip = null;
        segment.end = null;
        segment.start = Number(startSeconds) || 0;
        endFired = false;
        yt.cueVideoById({ videoId: videoId, startSeconds: segment.start });
        startTicker();
      },

      /** 편집 중 구간 끝을 바로 반영한다. */
      setSegment: function (start, end) {
        segment.start = Number(start) || 0;
        segment.end = end === null || end === undefined ? null : Number(end);
        endFired = false;
      },

      getSegment: function () { return segment; },
      getCurrentTime: currentTime,
      getDuration: duration,
      isPlaying: isPlaying,
      isReady: function () { return ready; },
      destroy: function () {
        stopTicker();
        if (yt && yt.destroy) yt.destroy();
        yt = null;
        ready = false;
      }
    };

    return api;
  }

  TU.player = {
    ensureApi: ensureApi,
    create: createPlayer
  };
})(window);
