const fs = require('fs');
const path = require('path');
const extend = require('deepmix');

// Загрузка конфига
const config = JSON.parse(fs.readFileSync(path.normalize('./minifier-config.json'), 'utf8'));

function callError(mess) {
    console.error(mess);

    process.exitCode = 1;  // Код ошибки для терминала
    process.exit(1);       // Принудительное завершение
}

// Название папки с темой
var themeName = config.theme.name;

process.argv.forEach((val) => {
    // Проверка параметра с активным магазином в консоли
    if (~val.indexOf('theme=')) {
        themeName = val.split('=')[1];
    }
});

var themePath = path.join(__dirname, config.theme.path, themeName);

if (!themeName) {
    console.error("\n❌ Error: Обязательный параметр theme не указан");
    callError("💡 Example: npx gulp theme=your-theme");
}
if (!themePath) {
    callError('Invalid path: путь к теме не задан');
}
if (!fs.existsSync(themePath)) {
    callError(`Invalid path: тема по пути ${themePath} не найдена`);
}

console.log(`Выбрана тема: ${themePath}\n`);

/**
 * Настройки поумолчанию
 */
var defaultConfig = {
    account: {
        http: false
    },
    theme: {
        root: themePath,
        backup: false, // Создавать backup после загрузки?
        assetsSync: true, // Делать синхронизацию с директорией assets?
    },
    plugins: {
        // файлы которые не обрабатываются плагинами
        exclude: ['*.min.js', '*.min.css', '*.liquid'],

        /** 
        style: function (stream) {
            return stream
                .pipe(autoprefixer({
                    browsers: ['last 10 versions'],
                    cascade: true
                }))
        },
        // gulp плагины для скриптов
        script: function (stream) {
            return stream
                .pipe(uglify())
                .pipe(rename({ suffix: '.min' }))
                .pipe(gulp.dest(shop + "2/" + 'assets/js'));
        },
        // gulp плагины для изображений
        img: function (stream) {
            return stream
                .pipe(imagemin())
        }
        */
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
    util: {
        openBrowser: false // Открывать браузер при запуске стрима?
    }
}

module.exports = extend(defaultConfig, require(themePath));