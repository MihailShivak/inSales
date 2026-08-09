'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Настройки поумолчанию
 */
exports.default = {
  account: {
    id: 'c821a430fddc6379c9699c75f3003ae4',
    token: '0f9fe39bd55b693ef2009455f14e4250',
    url: 'myshop-dew702.myinsales.ru',
    http: true
  },
  theme: {
    id: '11366001',
    root: '.',
    backup: true,
    assetsSync: true,
    excludeFiles: [],
    onUpdate: function onUpdate() {
      // обновление темы
    },
    assetsDomain: 'https://assets.insales.ru'
  },
  util: {
    openBrowser: true
  },
  plugins: {
    exclude: ['*.min.js', '*.min.css', '*.liquid']
  },
  chokidarOptions: {
    ignored: /[\/\\]\./,
    ignoreInitial: true,
    followSymlinks: true,
    usePolling: false,
    interval: 200,
    delay: 0,
    binaryInterval: 300,
    alwaysStat: true,
    depth: 99,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100
    },
    ignorePermissionErrors: true
  }
};