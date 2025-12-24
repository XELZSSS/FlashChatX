module.exports = {
  appId: 'com.flashchatx.app',
  productName: 'FlashChat X',
  icon: 'electron/icons/app-dev.ico',
  directories: {
    output: 'release',
    buildResources: 'electron/icons',
  },
  electronDownload: {
    mirror: 'https://npmmirror.com/mirrors/electron/',
  },
  files: [
    'dist/**/*',
    'server/**/*',
    {
      from: 'electron',
      to: 'electron',
      filter: ['*.js'],
    },
    'package.json',
  ],
  extraResources: [
    {
      from: 'electron/icons',
      to: 'icons',
    },
  ],
  extraMetadata: {
    main: 'electron/main.js',
  },
  asar: true,
  win: {
    target: 'nsis',
    icon: 'electron/icons/app-dev.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
};
