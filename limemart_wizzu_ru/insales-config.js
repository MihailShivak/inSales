'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Настройки поумолчанию
 */
exports.default = {
  account: {
    id: 'b9cb4f035d13332069ab58857f8c82e1',
    token: '5e2e2ddc0d38b1f72b797deeefcd33a4',
    url: 'myshop-clx188.myinsales.ru',
    http: true
  },
  theme: {
    id: '11279825',
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
  },
};