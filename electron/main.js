/*
 * Teach_UtoV 데스크톱 앱.
 *
 * 화면은 웹 버전(docs/app)을 그대로 쓴다. 다만 유튜브 IFrame Player API 가
 * file:// 에서 동작하지 않으므로, 앱 안에서 작은 http 서버를 띄우고 거기에 접속한다.
 *
 * 포트를 고정하는 이유: 저장한 수업 목록은 브라우저 저장소(localStorage)에 들어가고,
 * 그 저장소는 "주소:포트" 마다 따로 만들어진다. 포트가 바뀌면 지난 목록이 보이지 않는다.
 */
import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from '../scripts/static-server.mjs';

const APP_ROOT = fileURLToPath(new URL('../docs/app', import.meta.url));
const FIXED_PORT = 47317;

let mainWindow = null;
let serverUrl = null;

/** 고정 포트로 띄우되, 막혀 있으면 빈 포트로 물러선다. */
async function startServer() {
  try {
    const fixed = await startStaticServer({ root: APP_ROOT, port: FIXED_PORT });
    return { url: fixed.url, moved: false };
  } catch {
    const fallback = await startStaticServer({ root: APP_ROOT, port: 0 });
    return { url: fallback.url, moved: true };
  }
}

function buildMenu() {
  const template = [
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로 고침' },
        { type: 'separator' },
        { role: 'resetZoom', label: '기본 크기' },
        { role: 'zoomIn', label: '크게' },
        { role: 'zoomOut', label: '작게' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
        { role: 'toggleDevTools', label: '개발자 도구' }
      ]
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '프로젝트 홈페이지',
          click: () => shell.openExternal('https://github.com/unono915/Teach_UtoV')
        },
        {
          label: 'Teach_UtoV 정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Teach_UtoV',
              message: `Teach_UtoV ${app.getVersion()}`,
              detail:
                '수업에서 보여 줄 유튜브 영상의 구간을 기록해 두고 바로 재생하는 도구입니다.\n' +
                '유튜브 공식 IFrame Player API 로 재생만 하며, 영상을 내려받지 않습니다.'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#14161a',
    title: 'Teach_UtoV',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  // "유튜브에서 열기" 같은 바깥 링크는 기본 브라우저로 보낸다.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });

  // 앱 창 자체가 다른 사이트로 넘어가지 않도록 막는다.
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(serverUrl)) {
      event.preventDefault();
      if (/^https?:/i.test(target)) shell.openExternal(target);
    }
  });

  mainWindow.loadURL(url);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    const started = await startServer();
    serverUrl = started.url;

    buildMenu();
    createWindow(started.url);

    if (started.moved) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: '포트가 사용 중입니다',
        message: `평소 쓰는 포트(${FIXED_PORT})를 다른 프로그램이 쓰고 있습니다.`,
        detail:
          '임시 포트로 실행했습니다. 프로그램은 정상 동작하지만, 이전에 저장해 둔 수업 목록이\n' +
          '보이지 않을 수 있습니다. 그럴 때는 그 포트를 쓰는 프로그램을 끄고 다시 실행해 주세요.\n' +
          '목록은 평소에 "내보내기" 로 백업해 두시면 안전합니다.'
      });
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(serverUrl);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
