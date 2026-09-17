/*
 * 데이터 저장소 — 묶음 > 수업 > 클립 3단 구조를 localStorage 에 담고,
 * 변경되면 구독자에게 알린다.
 */
(function (global) {
  'use strict';

  var TU = global.TU || (global.TU = {});
  var uid = TU.utils.uid;

  var STORAGE_KEY = 'teach-utov:data:v1';
  var SCHEMA_VERSION = 2;

  var state = null;
  var listeners = [];

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      collections: [],
      lessons: [],
      settings: {
        theme: 'dark',
        autoNext: false,
        loopClip: false,
        currentCollectionId: null,   // null 이면 "전체"
        currentLessonId: null
      }
    };
  }

  function now() {
    return new Date().toISOString();
  }

  function normalizeClip(clip) {
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
  }

  /**
   * 저장소나 파일에서 읽은 값을 현재 스키마에 맞게 정리한다.
   * 묶음이 없던 v1 데이터는 "묶음 없음" 상태로 그대로 넘어온다.
   */
  function normalize(raw) {
    var base = emptyState();
    if (!raw || typeof raw !== 'object') return base;

    var collections = Array.isArray(raw.collections) ? raw.collections : [];
    base.collections = collections
      .filter(function (item) { return item && (item.id || item.title); })
      .map(function (item) {
        return {
          id: item.id || uid('col'),
          title: String(item.title || '제목 없는 묶음'),
          createdAt: item.createdAt || now()
        };
      });

    var knownCollections = {};
    base.collections.forEach(function (item) { knownCollections[item.id] = true; });

    var lessons = Array.isArray(raw.lessons) ? raw.lessons : [];
    base.lessons = lessons.map(function (lesson) {
      var clips = Array.isArray(lesson && lesson.clips) ? lesson.clips : [];
      var collectionId = lesson && lesson.collectionId;
      return {
        id: (lesson && lesson.id) || uid('lesson'),
        collectionId: knownCollections[collectionId] ? collectionId : null,
        title: String((lesson && lesson.title) || '제목 없는 수업'),
        description: String((lesson && lesson.description) || ''),
        createdAt: (lesson && lesson.createdAt) || now(),
        updatedAt: (lesson && lesson.updatedAt) || now(),
        clips: clips
          .filter(function (clip) { return clip && clip.videoId; })
          .map(normalizeClip)
      };
    });

    if (raw.settings && typeof raw.settings === 'object') {
      base.settings.theme = raw.settings.theme === 'light' ? 'light' : 'dark';
      base.settings.autoNext = !!raw.settings.autoNext;
      base.settings.loopClip = !!raw.settings.loopClip;
      base.settings.currentCollectionId = raw.settings.currentCollectionId || null;
      base.settings.currentLessonId = raw.settings.currentLessonId || null;
    }

    if (!knownCollections[base.settings.currentCollectionId]) {
      base.settings.currentCollectionId = null;
    }
    var lessonIds = base.lessons.map(function (lesson) { return lesson.id; });
    if (lessonIds.indexOf(base.settings.currentLessonId) === -1) {
      base.settings.currentLessonId = lessonIds.length ? lessonIds[0] : null;
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

  function commit() {
    persist();
    listeners.forEach(function (fn) { fn(state); });
  }

  function touch(lesson) {
    if (lesson) lesson.updatedAt = now();
  }

  function indexOfId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return i;
    }
    return -1;
  }

  /* ---- 조회 ---- */

  function getState() { return state; }

  function getCollections() { return state.collections; }

  function getCollection(id) {
    var index = indexOfId(state.collections, id);
    return index === -1 ? null : state.collections[index];
  }

  function getCurrentCollection() {
    return getCollection(state.settings.currentCollectionId);
  }

  function getLessons() { return state.lessons; }

  /** 지금 고른 묶음에 속한 수업만. 묶음이 "전체"면 모두. */
  function getVisibleLessons() {
    var collectionId = state.settings.currentCollectionId;
    if (!collectionId) return state.lessons;
    return state.lessons.filter(function (lesson) {
      return lesson.collectionId === collectionId;
    });
  }

  function getLessonsOf(collectionId) {
    return state.lessons.filter(function (lesson) {
      return lesson.collectionId === (collectionId || null);
    });
  }

  function getLesson(id) {
    var index = indexOfId(state.lessons, id);
    return index === -1 ? null : state.lessons[index];
  }

  function getCurrentLesson() {
    return getLesson(state.settings.currentLessonId);
  }

  function getClip(lessonId, clipId) {
    var lesson = getLesson(lessonId);
    if (!lesson) return null;
    var index = indexOfId(lesson.clips, clipId);
    return index === -1 ? null : lesson.clips[index];
  }

  function countClips() {
    return state.lessons.reduce(function (sum, lesson) {
      return sum + lesson.clips.length;
    }, 0);
  }

  /* ---- 묶음 ---- */

  function addCollection(title) {
    var collection = {
      id: uid('col'),
      title: title || '새 묶음',
      createdAt: now()
    };
    state.collections.push(collection);
    state.settings.currentCollectionId = collection.id;
    var first = getVisibleLessons()[0];
    state.settings.currentLessonId = first ? first.id : null;
    commit();
    return collection;
  }

  function updateCollection(id, patch) {
    var collection = getCollection(id);
    if (!collection) return null;
    if (typeof patch.title === 'string') collection.title = patch.title;
    commit();
    return collection;
  }

  /**
   * 묶음을 지운다. withLessons 가 참이면 안에 든 수업까지 지우고,
   * 거짓이면 수업을 "묶음 없음" 으로 꺼내 둔다.
   */
  function removeCollection(id, withLessons) {
    var index = indexOfId(state.collections, id);
    if (index === -1) return false;
    state.collections.splice(index, 1);

    if (withLessons) {
      state.lessons = state.lessons.filter(function (lesson) {
        return lesson.collectionId !== id;
      });
    } else {
      state.lessons.forEach(function (lesson) {
        if (lesson.collectionId === id) lesson.collectionId = null;
      });
    }

    state.settings.currentCollectionId = null;
    if (!getLesson(state.settings.currentLessonId)) {
      state.settings.currentLessonId = state.lessons.length ? state.lessons[0].id : null;
    }
    commit();
    return true;
  }

  function selectCollection(id) {
    var next = id || null;
    if (state.settings.currentCollectionId === next) return;
    state.settings.currentCollectionId = next;
    var lessons = getVisibleLessons();
    var stillVisible = lessons.some(function (lesson) {
      return lesson.id === state.settings.currentLessonId;
    });
    if (!stillVisible) {
      state.settings.currentLessonId = lessons.length ? lessons[0].id : null;
    }
    commit();
  }

  function moveCollection(id, delta) {
    var index = indexOfId(state.collections, id);
    var target = index + delta;
    if (index === -1 || target < 0 || target >= state.collections.length) return false;
    var moved = state.collections.splice(index, 1)[0];
    state.collections.splice(target, 0, moved);
    commit();
    return true;
  }

  /* ---- 수업 ---- */

  function addLesson(title, collectionId) {
    var lesson = {
      id: uid('lesson'),
      collectionId: collectionId === undefined
        ? state.settings.currentCollectionId
        : (collectionId || null),
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
    if ('collectionId' in patch) lesson.collectionId = patch.collectionId || null;
    touch(lesson);
    commit();
    return lesson;
  }

  function removeLesson(id) {
    var index = indexOfId(state.lessons, id);
    if (index === -1) return false;
    state.lessons.splice(index, 1);
    if (state.settings.currentLessonId === id) {
      var visible = getVisibleLessons();
      state.settings.currentLessonId = visible.length
        ? visible[Math.min(index, visible.length - 1)].id
        : null;
    }
    commit();
    return true;
  }

  function selectLesson(id) {
    if (state.settings.currentLessonId === id) return;
    state.settings.currentLessonId = id;
    commit();
  }

  /** 보이는 목록 기준으로 수업 순서를 바꾼다. */
  function moveLesson(id, delta) {
    var visible = getVisibleLessons();
    var here = indexOfId(visible, id);
    var there = here + delta;
    if (here === -1 || there < 0 || there >= visible.length) return false;

    var from = indexOfId(state.lessons, id);
    var to = indexOfId(state.lessons, visible[there].id);
    var moved = state.lessons.splice(from, 1)[0];
    state.lessons.splice(to, 0, moved);
    commit();
    return true;
  }

  /** 끌어 놓기용 — 보이는 목록의 targetIndex 자리로 수업을 옮긴다. */
  function reorderLesson(id, targetIndex) {
    var visible = getVisibleLessons();
    var here = indexOfId(visible, id);
    if (here === -1) return false;
    var there = Math.max(0, Math.min(visible.length - 1, targetIndex));
    if (there === here) return false;

    var from = indexOfId(state.lessons, id);
    var to = indexOfId(state.lessons, visible[there].id);
    var moved = state.lessons.splice(from, 1)[0];
    state.lessons.splice(to, 0, moved);
    commit();
    return true;
  }

  function duplicateLesson(id) {
    var lesson = getLesson(id);
    if (!lesson) return null;
    var copy = JSON.parse(JSON.stringify(lesson));
    copy.id = uid('lesson');
    copy.title = lesson.title + ' (복사)';
    copy.createdAt = now();
    copy.updatedAt = now();
    copy.clips.forEach(function (clip) { clip.id = uid('clip'); });
    state.lessons.splice(indexOfId(state.lessons, id) + 1, 0, copy);
    state.settings.currentLessonId = copy.id;
    commit();
    return copy;
  }

  /* ---- 클립 ---- */

  function addClip(lessonId, data) {
    var lesson = getLesson(lessonId);
    if (!lesson) return null;
    var clip = normalizeClip({
      videoId: data.videoId,
      title: data.title || '',
      start: data.start,
      end: data.end,
      note: data.note || ''
    });
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
    var index = indexOfId(lesson.clips, clipId);
    var target = index + delta;
    if (index === -1 || target < 0 || target >= lesson.clips.length) return false;
    var moved = lesson.clips.splice(index, 1)[0];
    lesson.clips.splice(target, 0, moved);
    touch(lesson);
    commit();
    return true;
  }

  /** 끌어 놓기용 — 클립을 목록의 targetIndex 자리로 옮긴다. */
  function reorderClip(lessonId, clipId, targetIndex) {
    var lesson = getLesson(lessonId);
    if (!lesson) return false;
    var index = indexOfId(lesson.clips, clipId);
    if (index === -1) return false;
    var to = Math.max(0, Math.min(lesson.clips.length - 1, targetIndex));
    if (to === index) return false;
    var moved = lesson.clips.splice(index, 1)[0];
    lesson.clips.splice(to, 0, moved);
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
    lesson.clips.splice(lesson.clips.indexOf(clip) + 1, 0, copy);
    touch(lesson);
    commit();
    return copy;
  }

  /** 클립을 다른 수업으로 보낸다. */
  function moveClipToLesson(fromLessonId, clipId, toLessonId) {
    var from = getLesson(fromLessonId);
    var to = getLesson(toLessonId);
    var clip = getClip(fromLessonId, clipId);
    if (!from || !to || !clip || from === to) return false;
    from.clips = from.clips.filter(function (item) { return item.id !== clipId; });
    to.clips.push(clip);
    touch(from);
    touch(to);
    commit();
    return true;
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
      collections: state.collections,
      lessons: state.lessons,
      settings: state.settings
    }, null, 2);
  }

  /**
   * mode 가 'replace' 면 통째로 바꾸고, 그 밖에는 기존 목록 뒤에 덧붙인다.
   * 반환값은 { collections, lessons, clips } 개수.
   */
  function importJSON(text, mode) {
    var incoming = normalize(JSON.parse(text));
    if (!incoming.lessons.length && !incoming.collections.length) {
      throw new Error('불러올 수업이 없습니다.');
    }

    if (mode === 'replace') {
      state.collections = incoming.collections;
      state.lessons = incoming.lessons;
    } else {
      var usedCollections = {};
      state.collections.forEach(function (item) { usedCollections[item.id] = true; });
      incoming.collections.forEach(function (item) {
        if (usedCollections[item.id]) {
          var fresh = uid('col');
          incoming.lessons.forEach(function (lesson) {
            if (lesson.collectionId === item.id) lesson.collectionId = fresh;
          });
          item.id = fresh;
        }
        state.collections.push(item);
      });

      var usedLessons = {};
      state.lessons.forEach(function (lesson) { usedLessons[lesson.id] = true; });
      incoming.lessons.forEach(function (lesson) {
        if (usedLessons[lesson.id]) lesson.id = uid('lesson');
        state.lessons.push(lesson);
      });
    }

    state.settings.currentCollectionId = null;
    state.settings.currentLessonId = incoming.lessons.length ? incoming.lessons[0].id : null;
    commit();
    return {
      collections: incoming.collections.length,
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
    SCHEMA_VERSION: SCHEMA_VERSION,
    init: init,
    subscribe: subscribe,
    getState: getState,

    getCollections: getCollections,
    getCollection: getCollection,
    getCurrentCollection: getCurrentCollection,
    addCollection: addCollection,
    updateCollection: updateCollection,
    removeCollection: removeCollection,
    selectCollection: selectCollection,
    moveCollection: moveCollection,

    getLessons: getLessons,
    getVisibleLessons: getVisibleLessons,
    getLessonsOf: getLessonsOf,
    getLesson: getLesson,
    getCurrentLesson: getCurrentLesson,
    addLesson: addLesson,
    updateLesson: updateLesson,
    removeLesson: removeLesson,
    selectLesson: selectLesson,
    moveLesson: moveLesson,
    reorderLesson: reorderLesson,
    duplicateLesson: duplicateLesson,

    getClip: getClip,
    countClips: countClips,
    addClip: addClip,
    updateClip: updateClip,
    removeClip: removeClip,
    moveClip: moveClip,
    reorderClip: reorderClip,
    duplicateClip: duplicateClip,
    moveClipToLesson: moveClipToLesson,

    setSetting: setSetting,
    toJSON: toJSON,
    importJSON: importJSON,
    _normalize: normalize
  };
})(window);
