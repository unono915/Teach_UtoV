/* 부팅 — 플레이어를 만들고 화면과 연결한다. */
(function (global) {
  'use strict';

  var TU = global.TU;

  var ERROR_MESSAGE = {
    2: '영상 주소가 올바르지 않습니다.',
    5: '이 영상은 현재 브라우저에서 재생할 수 없습니다.',
    100: '영상을 찾을 수 없습니다. 삭제되었거나 비공개일 수 있습니다.',
    101: '이 영상은 게시자가 외부 재생을 막아 두었습니다. 유튜브에서 열어 주세요.',
    150: '이 영상은 게시자가 외부 재생을 막아 두었습니다. 유튜브에서 열어 주세요.'
  };

  function start() {
    var player = TU.player.create({
      onSegmentEnd: function (clip) { TU.ui.onSegmentEnd(clip); },
      onTick: function (time, duration, segment) { TU.ui.onTick(time, duration, segment); },
      onStateChange: function (code) { TU.ui.onStateChange(code); },
      onError: function (code) {
        TU.ui.toast(ERROR_MESSAGE[code] || ('영상을 재생하지 못했습니다. (오류 ' + code + ')'));
      }
    });

    TU.ui.init(player);

    player.mount('player').catch(function (err) {
      TU.ui.toast(err.message);
    });

    // file:// 로 직접 열면 유튜브 플레이어가 동작하지 않는다.
    if (global.location.protocol === 'file:') {
      TU.ui.toast('로컬 파일로 열면 재생이 되지 않습니다. npm start 로 실행해 주세요.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
