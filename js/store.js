/* 수업/클립 데이터 저장소 — localStorage 에 담고, 변경되면 구독자에게 알린다. */
(function (global) {
  'use strict';

  var TU = global.TU || (global.TU = {});
  var uid = TU.utils.uid;

  var STORAGE_KEY = 'teach-utov:data:v1';
  var SCHEMA_VERSION = 1;

  var state = null;
  var listeners = [];

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      lessons: [],
      settings: {
        theme: 'dark',
        autoNext: false,
        loopClip: false,
        currentLessonId: null
      }
    };
  }

  function now() {
    return new Date().toISOString();
  }

  /** 저장소나 파일에서 읽은 값을 현재 스키마에 맞게 정리한다. */
  function normalize(raw) {
    var base = emptyState();
    if (!raw || typeof raw !== 'object') return base;

    var lessons = Array.isArray(raw.lessons) ? raw.lessons : [];
    base.lessons = lessons.map(function (lesson) {
      var clips = Array.isArray(lesson && lesson.clips) ? lesson.clips : [];
      return {
        id: (lesson && lesson.id) || uid('lesson'),
        title: String((lesson && lesson.title) || '제목 없는 수업'),
        description: String((lesson && lesson.description) || ''),
        createdAt: (lesson && lesson.createdAt) || now(),
        updatedAt: (lesson && lesson.updatedAt) || now(),
        clips: clips
          .filter(function (clip) { return clip && clip.videoId; })
          .map(function (clip) {
            var start = Number(clip.start);
            var end = clip.end === null || clip.end === undefined || clip.end === ''
              ? null
              : Number(clip.end);
            if (!isFinite(start) || start < 0) start = 0;
            if (end !== null && (!isFinite(end) || end <= start)) end = null;
            return {
              id: clip.id || uid('clip'),
              videoId: String(clip.videoId),
              title: String(clip.title || ''),
              start: start,
              end: end,
              note: String(clip.note || '')
            };
          })
      };
    });

    if (raw.settings && typeof raw.settings === 'object') {
      base.settings.theme = raw.settings.theme === 'light' ? 'light' : 'dark';
      base.settings.autoNext = !!raw.settings.autoNext;
      base.settings.loopClip = !!raw.settings.loopClip;
      base.settings.currentLessonId = raw.settings.currentLessonId || null;
    }

    var ids = base.lessons.map(function (lesson) { return lesson.id; });
    if (ids.indexOf(base.settings.currentLessonId) === -1) {
      base.settings.currentLessonId = ids.length ? ids[0] : null;
    }
    return base;
  }

  function read() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch (err) {
      console.warn('저장된 데이터를 읽지 못해 새로 시작합니다.', err);
      return emptyState();
    }
  }

  function persist() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('데이터를 저장하지 못했습니다.', err);
    }
  }

  function notify() {
    listeners.forEach(function (fn) { fn(state); });
  }

  function commit() {
    persist();
    notify();
  }

  function touch(lesson) {
    if (lesson) lesson.updatedAt = now();
  }

  /* ---- 조회 ---- */

  function getState() { return state; }

  function getLessons() { return state.lessons; }

  function getLesson(id) {
    for (var i = 0; i < state.lessons.length; i++) {
      if (state.lessons[i].id === id) return state.lessons[i];
    }
    return null;
  }

  function getCurrentLesson() {
    return getLesson(state.settings.currentLessonId);
  }

  function getClip(lessonId, clipId) {
    var lesson = getLesson(lessonId);
    if (!lesson) return null;
    for (var i = 0; i < lesson.clips.length; i++) {
      if (lesson.clips[i].id === clipId) return lesson.clips[i];
    }
    return null;
  }

  /* ---- 수업 ---- */

  function addLesson(title) {
    var lesson = {
      id: uid('lesson'),
      title: title || '새 수업',
      description: '',
      createdAt: now(),
      updatedAt: now(),
      clips: []
    };
    state.lessons.push(lesson);
    state.settings.currentLessonId = lesson.id;
    commit();
    return lesson;
  }

  function updateLesson(id, patch) {
    var lesson = getLesson(id);
    if (!lesson) return null;
    if (typeof patch.title === 'string') lesson.title = patch.title;
    if (typeof patch.description === 'string') lesson.description = patch.description;
    touch(lesson);
    commit();
    return lesson;
  }

  function removeLesson(id) {
    var index = -1;
    state.lessons.forEach(function (lesson, i) { if (lesson.id === id) index = i; });
    if (index === -1) return false;
    state.lessons.splice(index, 1);
    if (state.settings.currentLessonId === id) {
      var next = state.lessons[Math.min(index, state.lessons.length - 1)];
      state.settings.currentLessonId = next ? next.id : null;
    }
    commit();
    return true;
  }

  function selectLesson(id) {
    if (state.settings.currentLessonId === id) return;
    state.settings.currentLessonId = id;
    commit();
  }

  /* ---- 클립 ---- */

  function addClip(lessonId, data) {
    var lesson = getLesson(lessonId);
    if (!lesson) return null;
    var clip = {
      id: uid('clip'),
      videoId: data.videoId,
      title: data.title || '',
      start: Number(data.start) || 0,
      end: data.end === null || data.end === undefined ? null : Number(data.end),
      note: data.note || ''
    };
    lesson.clips.push(clip);
    touch(lesson);
    commit();
    return clip;
  }

  function updateClip(lessonId, clipId, patch) {
    var clip = getClip(lessonId, clipId);
    if (!clip) return null;
    Object.keys(patch).forEach(function (key) {
      if (key === 'id') return;
      clip[key] = patch[key];
    });
    touch(getLesson(lessonId));
    commit();
    return clip;
  }

  function removeClip(lessonId, clipId) {
    var lesson = getLesson(lessonId);
    if (!lesson) return false;
    var before = lesson.clips.length;
    lesson.clips = lesson.clips.filter(function (clip) { return clip.id !== clipId; });
    if (lesson.clips.length === before) return false;
    touch(lesson);
    commit();
    return true;
  }

  function moveClip(lessonId, clipId, delta) {
    var lesson = getLesson(lessonId);
    if (!lesson) return false;
    var index = -1;
    lesson.clips.forEach(function (clip, i) { if (clip.id === clipId) index = i; });
    var target = index + delta;
    if (index === -1 || target < 0 || target >= lesson.clips.length) return false;
    var moved = lesson.clips.splice(index, 1)[0];
    lesson.clips.splice(target, 0, moved);
    touch(lesson);
    commit();
    return true;
  }

  function duplicateClip(lessonId, clipId) {
    var lesson = getLesson(lessonId);
    var clip = getClip(lessonId, clipId);
    if (!lesson || !clip) return null;
    var copy = JSON.parse(JSON.stringify(clip));
    copy.id = uid('clip');
    copy.title = (clip.title || '클립') + ' (복사)';
    var index = lesson.clips.indexOf(clip);
    lesson.clips.splice(index + 1, 0, copy);
    touch(lesson);
    commit();
    return copy;
  }

  /* ---- 설정 ---- */

  function setSetting(key, value) {
    if (!(key in state.settings)) return;
    state.settings[key] = value;
    commit();
  }

  /* ---- 가져오기 / 내보내기 ---- */

  function toJSON() {
    return JSON.stringify({
      app: 'Teach_UtoV',
      version: SCHEMA_VERSION,
      exportedAt: now(),
      lessons: state.lessons,
      settings: state.settings
    }, null, 2);
  }

  /**
   * mode 가 'replace' 면 통째로 바꾸고, 그 밖에는 기존 수업 뒤에 덧붙인다.
   * 반환값은 { lessons, clips } 개수.
   */
  function importJSON(text, mode) {
    var incoming = normalize(JSON.parse(text));
    if (!incoming.lessons.length) throw new Error('불러올 수업이 없습니다.');

    if (mode === 'replace') {
      state.lessons = incoming.lessons;
    } else {
      var existing = {};
      state.lessons.forEach(function (lesson) { existing[lesson.id] = true; });
      incoming.lessons.forEach(function (lesson) {
        if (existing[lesson.id]) lesson.id = uid('lesson');
        state.lessons.push(lesson);
      });
    }
    state.settings.currentLessonId = incoming.lessons[0].id;
    commit();
    return {
      lessons: incoming.lessons.length,
      clips: incoming.lessons.reduce(function (sum, lesson) {
        return sum + lesson.clips.length;
      }, 0)
    };
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (item) { return item !== fn; });
    };
  }

  function init() {
    state = read();
    return state;
  }

  TU.store = {
    STORAGE_KEY: STORAGE_KEY,
    init: init,
    subscribe: subscribe,
    getState: getState,
    getLessons: getLessons,
    getLesson: getLesson,
    getCurrentLesson: getCurrentLesson,
    getClip: getClip,
    addLesson: addLesson,
    updateLesson: updateLesson,
    removeLesson: removeLesson,
    selectLesson: selectLesson,
    addClip: addClip,
    updateClip: updateClip,
    removeClip: removeClip,
    moveClip: moveClip,
    duplicateClip: duplicateClip,
    setSetting: setSetting,
    toJSON: toJSON,
    importJSON: importJSON,
    _normalize: normalize
  };
})(window);
