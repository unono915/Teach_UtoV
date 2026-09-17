/* 화면 구성과 사용자 입력 처리 */
(function (global) {
  'use strict';

  var TU = global.TU || (global.TU = {});
  var u = TU.utils;
  var store = TU.store;
  var $ = u.$;

  var player = null;
  var currentClipId = null;
  var editing = null;      // null | { mode: 'new' | 'edit', clipId: string|null }
  var toastTimer = null;

  var dom = {};

  function cacheDom() {
    [
      'lesson-select', 'btn-lesson-new', 'btn-lesson-rename', 'btn-lesson-delete',
      'clip-list', 'clip-count', 'clip-empty', 'btn-clip-add',
      'player-placeholder', 'now-title', 'now-range', 'now-note', 'now-link',
      'progress', 'progress-fill', 'time-current', 'time-total',
      'btn-prev', 'btn-next', 'btn-play', 'btn-restart', 'btn-back5', 'btn-fwd5',
      'opt-loop', 'opt-autonext', 'opt-rate',
      'editor', 'editor-title', 'editor-error', 'f-url', 'f-title', 'f-start', 'f-end', 'f-note',
      'btn-mark-start', 'btn-mark-end', 'btn-preview', 'btn-editor-save',
      'btn-editor-cancel', 'btn-editor-close',
      'btn-export', 'btn-import', 'file-import', 'btn-theme', 'btn-help', 'help-dialog', 'toast'
    ].forEach(function (id) {
      dom[id] = document.getElementById(id);
    });
  }

  /* ---------- 알림 ---------- */

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.hidden = false;
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () { dom.toast.hidden = true; }, 2400);
  }

  /* ---------- 그리기 ---------- */

  function clipLabel(clip, index) {
    return clip.title || '클립 ' + (index + 1);
  }

  function rangeText(clip) {
    var start = u.formatTime(clip.start);
    if (clip.end === null) return start + ' ~ 끝';
    return start + ' ~ ' + u.formatTime(clip.end) + ' · ' + u.formatDuration(clip.start, clip.end);
  }

  function renderLessons() {
    var state = store.getState();
    var select = dom['lesson-select'];
    select.innerHTML = '';

    if (!state.lessons.length) {
      select.appendChild(u.el('option', { value: '', text: '수업이 없습니다' }));
      select.disabled = true;
    } else {
      select.disabled = false;
      state.lessons.forEach(function (lesson) {
        select.appendChild(u.el('option', {
          value: lesson.id,
          text: lesson.title + ' (' + lesson.clips.length + ')'
        }));
      });
      select.value = state.settings.currentLessonId || '';
    }

    var hasLesson = !!store.getCurrentLesson();
    dom['btn-lesson-rename'].disabled = !hasLesson;
    dom['btn-lesson-delete'].disabled = !hasLesson;
    dom['btn-clip-add'].disabled = !hasLesson;
  }

  function renderClips() {
    var lesson = store.getCurrentLesson();
    var list = dom['clip-list'];
    list.innerHTML = '';

    var clips = lesson ? lesson.clips : [];
    dom['clip-count'].textContent = String(clips.length);
    dom['clip-empty'].hidden = clips.length > 0;

    clips.forEach(function (clip, index) {
      var item = u.el('li', {
        class: 'clip-item' + (clip.id === currentClipId ? ' active' : ''),
        'data-id': clip.id,
        tabindex: '0',
        role: 'button',
        title: clip.note || clipLabel(clip, index)
      }, [
        u.el('span', { class: 'clip-index', text: String(index + 1) }),
        u.el('div', { class: 'clip-body' }, [
          u.el('div', { class: 'clip-title', text: clipLabel(clip, index) }),
          u.el('div', { class: 'clip-range', text: rangeText(clip) })
        ]),
        u.el('div', { class: 'clip-tools' }, [
          u.el('button', { type: 'button', class: 'tool-btn', 'data-act': 'up', title: '위로', text: '↑' }),
          u.el('button', { type: 'button', class: 'tool-btn', 'data-act': 'down', title: '아래로', text: '↓' }),
          u.el('button', { type: 'button', class: 'tool-btn', 'data-act': 'edit', title: '편집', text: '✎' }),
          u.el('button', { type: 'button', class: 'tool-btn', 'data-act': 'copy', title: '복제', text: '⧉' }),
          u.el('button', { type: 'button', class: 'tool-btn', 'data-act': 'del', title: '삭제', text: '✕' })
        ])
      ]);
      list.appendChild(item);
    });
  }

  function renderNowPlaying() {
    var lesson = store.getCurrentLesson();
    var clip = lesson ? store.getClip(lesson.id, currentClipId) : null;

    if (!clip) {
      dom['now-title'].textContent = lesson && lesson.clips.length
        ? '클립을 선택해 주세요'
        : '수업과 클립을 먼저 만들어 주세요';
      dom['now-range'].textContent = '—';
      dom['now-note'].hidden = true;
      dom['now-link'].hidden = true;
      dom['player-placeholder'].hidden = false;
      dom['time-current'].textContent = '0:00';
      dom['time-total'].textContent = '0:00';
      dom['progress-fill'].style.width = '0%';
      return;
    }

    var index = lesson.clips.indexOf(clip);
    dom['now-title'].textContent = clipLabel(clip, index);
    dom['now-range'].textContent = rangeText(clip);
    dom['now-note'].textContent = clip.note;
    dom['now-note'].hidden = !clip.note;
    dom['now-link'].href = u.watchUrl(clip.videoId, clip.start);
    dom['now-link'].hidden = false;
    dom['player-placeholder'].hidden = true;
  }

  function renderControls() {
    var lesson = store.getCurrentLesson();
    var clips = lesson ? lesson.clips : [];
    var index = -1;
    clips.forEach(function (clip, i) { if (clip.id === currentClipId) index = i; });

    dom['btn-prev'].disabled = index <= 0;
    dom['btn-next'].disabled = index === -1 || index >= clips.length - 1;
    ['btn-play', 'btn-restart', 'btn-back5', 'btn-fwd5'].forEach(function (id) {
      dom[id].disabled = index === -1;
    });
  }

  function render() {
    renderLessons();
    renderClips();
    renderNowPlaying();
    renderControls();
  }

  /* ---------- 재생 ---------- */

  function playClip(clipId, autoplay) {
    var lesson = store.getCurrentLesson();
    var clip = lesson ? store.getClip(lesson.id, clipId) : null;
    if (!clip) return;
    currentClipId = clip.id;
    player.load(clip, autoplay !== false);
    render();
  }

  function clipOffset(delta) {
    var lesson = store.getCurrentLesson();
    if (!lesson) return null;
    var index = -1;
    lesson.clips.forEach(function (clip, i) { if (clip.id === currentClipId) index = i; });
    if (index === -1) return lesson.clips[0] || null;
    return lesson.clips[index + delta] || null;
  }

  function goRelative(delta) {
    var clip = clipOffset(delta);
    if (clip) playClip(clip.id, true);
  }

  function onSegmentEnd() {
    if (store.getState().settings.autoNext) {
      var next = clipOffset(1);
      if (next) playClip(next.id, true);
      else toast('마지막 클립입니다.');
    }
  }

  function onTick(time, duration, segment) {
    var start = segment.start || 0;
    var end = segment.end !== null && segment.end !== undefined
      ? segment.end
      : (duration || 0);
    var span = Math.max(0.001, end - start);
    var elapsed = u.clamp(time - start, 0, span);

    dom['progress-fill'].style.width = (elapsed / span * 100).toFixed(2) + '%';
    dom['time-current'].textContent = u.formatTime(elapsed);
    dom['time-total'].textContent = u.formatTime(span);
    dom.progress.setAttribute('aria-valuenow', String(Math.round(elapsed / span * 100)));
  }

  function onStateChange(stateCode) {
    var playing = stateCode === global.YT.PlayerState.PLAYING;
    dom['btn-play'].textContent = playing ? '❚❚ 일시정지' : '▶ 재생';
  }

  /* ---------- 편집 ---------- */

  function showEditorError(message) {
    dom['editor-error'].textContent = message || '';
    dom['editor-error'].hidden = !message;
  }

  function openEditor(mode, clip) {
    var lesson = store.getCurrentLesson();
    if (!lesson) {
      toast('먼저 수업을 만들어 주세요.');
      return;
    }
    editing = { mode: mode, clipId: clip ? clip.id : null };
    dom['editor-title'].textContent = mode === 'new' ? '클립 추가' : '클립 편집';
    dom['f-url'].value = clip ? u.watchUrl(clip.videoId) : '';
    dom['f-title'].value = clip ? clip.title : '';
    dom['f-start'].value = clip ? u.formatTimeInput(clip.start) : '';
    dom['f-end'].value = clip && clip.end !== null ? u.formatTimeInput(clip.end) : '';
    dom['f-note'].value = clip ? clip.note : '';
    showEditorError('');
    dom.editor.hidden = false;

    if (clip) {
      player.load(clip, false);
      currentClipId = clip.id;
      render();
    }
    dom[clip ? 'f-title' : 'f-url'].focus();
    dom.editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeEditor() {
    editing = null;
    dom.editor.hidden = true;
    showEditorError('');
  }

  /** 편집 폼에서 읽어 검증한 값. 문제가 있으면 null 을 돌려주고 안내를 띄운다. */
  function readEditorForm() {
    var parsed = u.parseYouTube(dom['f-url'].value);
    if (!parsed) {
      showEditorError('유튜브 주소를 인식하지 못했습니다. 주소 전체를 붙여넣어 주세요.');
      dom['f-url'].focus();
      return null;
    }

    var startText = dom['f-start'].value.trim();
    var start = startText ? u.parseTime(startText) : 0;
    if (start === null) {
      showEditorError('시작 시각을 0:30 또는 90 같은 형식으로 적어 주세요.');
      dom['f-start'].focus();
      return null;
    }

    var endText = dom['f-end'].value.trim();
    var end = endText ? u.parseTime(endText) : null;
    if (endText && end === null) {
      showEditorError('끝 시각을 2:30 또는 150 같은 형식으로 적어 주세요.');
      dom['f-end'].focus();
      return null;
    }
    if (end !== null && end <= start) {
      showEditorError('끝 시각은 시작 시각보다 뒤여야 합니다.');
      dom['f-end'].focus();
      return null;
    }

    return {
      videoId: parsed.videoId,
      title: dom['f-title'].value.trim(),
      start: start,
      end: end,
      note: dom['f-note'].value.trim()
    };
  }

  function saveEditor(event) {
    event.preventDefault();
    var lesson = store.getCurrentLesson();
    if (!lesson || !editing) return;

    var data = readEditorForm();
    if (!data) return;

    var clip;
    if (editing.mode === 'new') {
      clip = store.addClip(lesson.id, data);
      toast('클립을 추가했습니다.');
    } else {
      clip = store.updateClip(lesson.id, editing.clipId, data);
      toast('클립을 수정했습니다.');
    }

    closeEditor();
    if (clip) playClip(clip.id, false);
    else render();
  }

  /** 편집 중인 값을 그대로 플레이어에 걸어 본다. */
  function previewEditor() {
    var data = readEditorForm();
    if (!data) return;
    showEditorError('');
    player.load({ videoId: data.videoId, start: data.start, end: data.end }, true);
  }

  function markTime(which) {
    if (!player.isReady()) {
      toast('플레이어가 아직 준비되지 않았습니다.');
      return;
    }
    var seconds = Math.max(0, Math.floor(player.getCurrentTime()));
    dom[which === 'start' ? 'f-start' : 'f-end'].value = u.formatTimeInput(seconds);
    showEditorError('');
  }

  /** 주소 칸에 값이 들어오면 바로 플레이어에 띄워 구간을 잡기 쉽게 한다. */
  function onUrlInput() {
    var parsed = u.parseYouTube(dom['f-url'].value);
    if (!parsed) return;
    if (parsed.start !== null && !dom['f-start'].value.trim()) {
      dom['f-start'].value = u.formatTimeInput(parsed.start);
    }
    player.preview(parsed.videoId, parsed.start || 0);
    dom['player-placeholder'].hidden = true;
    showEditorError('');
  }

  /* ---------- 수업 ---------- */

  function newLesson() {
    var title = global.prompt('새 수업 이름을 적어 주세요.', '수업 ' + (store.getLessons().length + 1));
    if (title === null) return;
    var lesson = store.addLesson(title.trim() || '새 수업');
    currentClipId = null;
    render();
    toast('"' + lesson.title + '" 수업을 만들었습니다.');
  }

  function renameLesson() {
    var lesson = store.getCurrentLesson();
    if (!lesson) return;
    var title = global.prompt('수업 이름을 바꿉니다.', lesson.title);
    if (title === null) return;
    store.updateLesson(lesson.id, { title: title.trim() || lesson.title });
    render();
  }

  function deleteLesson() {
    var lesson = store.getCurrentLesson();
    if (!lesson) return;
    var message = '"' + lesson.title + '" 수업을 삭제합니다.\n클립 ' + lesson.clips.length + '개가 함께 지워집니다. 계속할까요?';
    if (!global.confirm(message)) return;
    store.removeLesson(lesson.id);
    currentClipId = null;
    render();
    toast('수업을 삭제했습니다.');
  }

  /* ---------- 가져오기 / 내보내기 ---------- */

  function exportData() {
    if (!store.getLessons().length) {
      toast('내보낼 수업이 없습니다.');
      return;
    }
    var blob = new Blob([store.toJSON()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var stamp = new Date().toISOString().slice(0, 10);
    var link = u.el('a', { href: url, download: 'teach-utov-' + stamp + '.json' });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('JSON 파일로 내보냈습니다.');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var mode = 'merge';
      if (store.getLessons().length) {
        mode = global.confirm(
          '가져온 수업을 기존 목록에 "추가"하려면 확인,\n기존 목록을 전부 "교체"하려면 취소를 누르세요.'
        ) ? 'merge' : 'replace';
      }
      try {
        var result = store.importJSON(String(reader.result), mode);
        currentClipId = null;
        render();
        toast('수업 ' + result.lessons + '개, 클립 ' + result.clips + '개를 불러왔습니다.');
      } catch (err) {
        console.error(err);
        toast('파일을 불러오지 못했습니다: ' + err.message);
      }
    };
    reader.onerror = function () { toast('파일을 읽지 못했습니다.'); };
    reader.readAsText(file);
  }

  /* ---------- 테마 ---------- */

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  }

  function toggleTheme() {
    var next = store.getState().settings.theme === 'light' ? 'dark' : 'light';
    store.setSetting('theme', next);
    applyTheme(next);
  }

  /* ---------- 단축키 ---------- */

  function isTyping(target) {
    if (!target) return false;
    var tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function onKeyDown(event) {
    if (isTyping(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    var key = event.key;

    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      player.toggle();
      return;
    }
    if (key === 'ArrowLeft') {
      event.preventDefault();
      if (event.shiftKey) goRelative(-1);
      else player.seekBy(-5);
      return;
    }
    if (key === 'ArrowRight') {
      event.preventDefault();
      if (event.shiftKey) goRelative(1);
      else player.seekBy(5);
      return;
    }
    if (key === 'r' || key === 'R' || key === 'ㄱ') {
      event.preventDefault();
      player.restart(true);
      return;
    }
    if (key === 'l' || key === 'L') {
      event.preventDefault();
      dom['opt-loop'].checked = !dom['opt-loop'].checked;
      dom['opt-loop'].dispatchEvent(new Event('change'));
      return;
    }
    if (key === 'n' || key === 'N') {
      event.preventDefault();
      openEditor('new', null);
      return;
    }
    if (/^[1-9]$/.test(key)) {
      var lesson = store.getCurrentLesson();
      if (!lesson) return;
      var clip = lesson.clips[Number(key) - 1];
      if (clip) {
        event.preventDefault();
        playClip(clip.id, true);
      }
    }
  }

  /* ---------- 이벤트 연결 ---------- */

  function onClipListClick(event) {
    var item = event.target.closest('.clip-item');
    if (!item) return;
    var lesson = store.getCurrentLesson();
    if (!lesson) return;
    var clipId = item.getAttribute('data-id');
    var tool = event.target.closest('.tool-btn');

    if (!tool) {
      playClip(clipId, true);
      return;
    }

    var act = tool.getAttribute('data-act');
    if (act === 'up') store.moveClip(lesson.id, clipId, -1);
    else if (act === 'down') store.moveClip(lesson.id, clipId, 1);
    else if (act === 'edit') return openEditor('edit', store.getClip(lesson.id, clipId));
    else if (act === 'copy') {
      store.duplicateClip(lesson.id, clipId);
      toast('클립을 복제했습니다.');
    } else if (act === 'del') {
      var clip = store.getClip(lesson.id, clipId);
      if (!global.confirm('"' + (clip.title || '이 클립') + '" 을(를) 삭제할까요?')) return;
      store.removeClip(lesson.id, clipId);
      if (currentClipId === clipId) currentClipId = null;
      if (editing && editing.clipId === clipId) closeEditor();
      toast('클립을 삭제했습니다.');
    }
    render();
  }

  function onProgressClick(event) {
    var segment = player.getSegment();
    if (!segment.clip && !player.isReady()) return;
    var rect = dom.progress.getBoundingClientRect();
    var ratio = u.clamp((event.clientX - rect.left) / rect.width, 0, 1);
    var start = segment.start || 0;
    var end = segment.end !== null && segment.end !== undefined ? segment.end : player.getDuration();
    if (!end || end <= start) return;
    player.seekTo(start + (end - start) * ratio);
  }

  function bind() {
    dom['lesson-select'].addEventListener('change', function (event) {
      store.selectLesson(event.target.value);
      currentClipId = null;
      closeEditor();
      render();
    });

    dom['btn-lesson-new'].addEventListener('click', newLesson);
    dom['btn-lesson-rename'].addEventListener('click', renameLesson);
    dom['btn-lesson-delete'].addEventListener('click', deleteLesson);
    dom['btn-clip-add'].addEventListener('click', function () { openEditor('new', null); });

    dom['clip-list'].addEventListener('click', onClipListClick);
    dom['clip-list'].addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var item = event.target.closest('.clip-item');
      if (!item || event.target.closest('.tool-btn')) return;
      event.preventDefault();
      playClip(item.getAttribute('data-id'), true);
    });

    dom['btn-play'].addEventListener('click', function () { player.toggle(); });
    dom['btn-restart'].addEventListener('click', function () { player.restart(true); });
    dom['btn-back5'].addEventListener('click', function () { player.seekBy(-5); });
    dom['btn-fwd5'].addEventListener('click', function () { player.seekBy(5); });
    dom['btn-prev'].addEventListener('click', function () { goRelative(-1); });
    dom['btn-next'].addEventListener('click', function () { goRelative(1); });

    dom.progress.addEventListener('click', onProgressClick);
    dom.progress.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); player.seekBy(-5); }
      if (event.key === 'ArrowRight') { event.preventDefault(); player.seekBy(5); }
    });

    dom['opt-loop'].addEventListener('change', function (event) {
      store.setSetting('loopClip', event.target.checked);
      player.setLoop(event.target.checked);
      toast(event.target.checked ? '구간 반복을 켰습니다.' : '구간 반복을 껐습니다.');
    });

    dom['opt-autonext'].addEventListener('change', function (event) {
      store.setSetting('autoNext', event.target.checked);
    });

    dom['opt-rate'].addEventListener('change', function (event) {
      player.setRate(Number(event.target.value));
    });

    dom.editor.addEventListener('submit', saveEditor);
    dom['btn-editor-cancel'].addEventListener('click', closeEditor);
    dom['btn-editor-close'].addEventListener('click', closeEditor);
    dom['btn-mark-start'].addEventListener('click', function () { markTime('start'); });
    dom['btn-mark-end'].addEventListener('click', function () { markTime('end'); });
    dom['btn-preview'].addEventListener('click', previewEditor);
    dom['f-url'].addEventListener('change', onUrlInput);
    dom['f-url'].addEventListener('paste', function () {
      global.setTimeout(onUrlInput, 0);
    });

    dom['btn-export'].addEventListener('click', exportData);
    dom['btn-import'].addEventListener('click', function () { dom['file-import'].click(); });
    dom['file-import'].addEventListener('change', function (event) {
      var file = event.target.files[0];
      if (file) importData(file);
      event.target.value = '';
    });

    dom['btn-theme'].addEventListener('click', toggleTheme);
    dom['btn-help'].addEventListener('click', function () { dom['help-dialog'].showModal(); });

    document.addEventListener('keydown', onKeyDown);
  }

  /** 첫 실행이면 사용법을 보여 주는 예시 수업을 하나 만든다. */
  function seedIfEmpty() {
    if (store.getLessons().length) return;
    var lesson = store.addLesson('예시 수업');
    store.addClip(lesson.id, {
      videoId: 'aircAruvnKk',
      title: '신경망이란 무엇인가 — 도입부',
      start: 0,
      end: 95,
      note: '이 클립은 사용법을 보여 주는 예시입니다. 삭제해도 됩니다.'
    });
  }

  function init(playerInstance) {
    player = playerInstance;
    cacheDom();

    store.init();
    seedIfEmpty();

    var settings = store.getState().settings;
    applyTheme(settings.theme);
    dom['opt-loop'].checked = settings.loopClip;
    dom['opt-autonext'].checked = settings.autoNext;
    player.setLoop(settings.loopClip);

    bind();
    render();
  }

  TU.ui = {
    init: init,
    render: render,
    toast: toast,
    playClip: playClip,
    onSegmentEnd: onSegmentEnd,
    onTick: onTick,
    onStateChange: onStateChange
  };
})(window);
