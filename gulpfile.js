const fs = require('fs');
const path = require('path');

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const gulp = require('gulp');
const logger = require('gulplog');
const rename = require('gulp-rename');

// CSS: минификация + Autoprefixer (кроссбраузерность)
const cleanCSS = require('gulp-clean-css');
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');

// JS: Babel (ES6+ → ES5) + Terser (лучше Uglify для modern JS)
const babel = require('gulp-babel');
const terser = require('gulp-terser');
const sourcemaps = require('gulp-sourcemaps');

function callError(mess) {
    logger.error(mess);

    process.exitCode = 1;  // Код ошибки для терминала
    process.exit(1);       // Принудительное завершение
}

// Парсинг CLI аргументов
const argv = yargs(hideBin(process.argv))
    .scriptName("minifier")
    .usage('$0 <cmd> [args]')
    .options({
        'theme': {
            alias: 'th',
            type: 'string',
            desc: 'Название папки темы'
        },
        'option': {
            alias: 'o',
            type: 'string',
            default: 'default',
            desc: 'Выбор списка оптимизируемых файлов (minifier-config.json)'
        },
        'mode': {
            alias: 'm',
            type: 'string',
            default: 'normal',
            choices: ['light', 'normal', 'hard'],
            desc: 'Режим минификации'
        },
        'type': {
            alias: 'tp',
            type: 'string',
            default: 'all',
            choices: ['all', 'js', 'css'],
            desc: 'Тип обрабатываемых файлов'
        },
        'files': {
            alias: 'f',
            type: 'array',
            desc: 'Файлы для обработки (app.js style.css)'
        }
    })
    .help()
    .argv;

// Загрузка конфига
const config = JSON.parse(fs.readFileSync(path.normalize('./minifier-config.json'), 'utf8'));
const modeConfig = config.minifyModes[argv.mode] || config.minifyModes.normal;
const themeName = argv.theme || config.theme.name;
const themePath = path.join(__dirname, config.theme.path, themeName);

if (!themeName) {
    callError('Invalid values: обязательный параметр "theme" не указан');
}
if (!themePath) {
    callError('Invalid path: путь к теме не задан');
}
if (!fs.existsSync(themePath)) {
    callError(`Invalid path: тема по пути ${themePath} не найдена`);
}

logger.info(`Выбрана тема: ${themePath}\n`);

function optimizationDone(done) {
    console.log("");
    logger.info("✅ Оптимизация прошла успешно");
    done();
}

function getFilePaths(type) {
    const typeSelect = type === "js" ? "js" : "style";

    if (argv.files?.length) {
        return argv.files.map(f => path.join(themePath, `assets/${typeSelect}/${f}`));
    }
    else if (argv.option === 'all') {
        return [
            path.join(themePath, `assets/${type}/**/*.${typeSelect}`),
            path.join(themePath, `assets/${type}/**/*.min.*`)
        ];
    }

    return config.options[argv.option ?? 'default'][type].map(
        f => path.join(themePath, `assets/${typeSelect}/${f}`)
    );
}

// Минификация JS
function minifyJS() {
    const paths = getFilePaths('js');
    if (!paths.length) {
        callError("Файлы не найдены");
        return;
    }

    logger.info("JS files:");
    console.log(paths, "\n");

    return gulp.src(paths, { allowEmpty: true })
		// .pipe(sourcemaps.init({ loadMaps: true }))  // Только если нужно
        .pipe(sourcemaps.init())
		.pipe(babel({
            // compact: true,
			presets: ['@babel/preset-env']
		}))
		.pipe(terser(modeConfig.terserJS))
		.pipe(rename({ suffix: '.min' }))
		.pipe(gulp.dest( path.join(themePath, 'assets/js') ))
		.on('end', () => logger.info(`✅ JS готов (${argv.mode} mode)`));
}

// Минификация CSS
function minifyCSS() {
    const paths = getFilePaths('css');
    if (!paths.length) {
        callError("Файлы не найдены");
        return;
    }

    logger.info("CSS files:");
    console.log(paths, "\n");

    return gulp.src(paths, { allowEmpty: true })
		// .pipe(sourcemaps.init({ loadMaps: true }))
		.pipe(sourcemaps.init())
		.pipe(postcss([
			autoprefixer({
				overrideBrowserslist: ['> 1%', 'last 2 versions', 'ie >= 11']
			})
		]))
		.pipe(cleanCSS({ level: modeConfig.cleanCSS }))
		.pipe(rename({ suffix: '.min' }))
		.pipe(gulp.dest( path.join(themePath, 'assets/style') ))
		.on('end', () => logger.info(`✅ CSS готов (${argv.mode} mode)`));
}

exports.default = gulp.series(
    argv.type == "all" ? 
        gulp.parallel(minifyJS, minifyCSS) : 
        (argv.type == "js" ? minifyJS : minifyCSS),
    
    optimizationDone
);