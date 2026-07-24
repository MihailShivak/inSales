'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Настройки поумолчанию
 */
exports.default = {
  account: {
    id: '3450d24dcbfb7ea86419a603c0446be9',
    token: '79c3dcdef0acfb89ceb36699aa5364c1',
    url: 'myshop-cxp257.myinsales.ru',
    http: true
  },
  theme: {
    id: '10910657',
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