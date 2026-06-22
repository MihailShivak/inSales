# 🚀 Gulp-минификатор для тем InSales

> Сборка под разработку тем InSales

Минификация, оптимизация и кроссбраузерная сборка JS/CSS 
для InSales Uploader. ES6→ES5, Autoprefixer, Terser, 3 режима сжатия.

## ✨ Особенности
- ✅ Node.js #26.3.0
- ✅ Минификация JS (Babel + Terser) + CSS (PostCSS)
- ✅ Кроссбраузерность (IE11+, Safari 10+)
- ✅ CLI параметры: --theme (th), --option (o), --mode (m), --type (tp), --files (f)
- ✅ Конфиг `minifier-config.json` с параметрами запуска
- ✅ Поддержка InSales Uploader (автозагрузка *.min.*)
- ✅ 3 режима: light/normal/hard

## 🚀 Быстрый старт
> [!WARNING]
> В файле `minifier-config.example.json` содержится пример конфигурации. Важно не забыть создать свой `minifier-config.json` на основе примера

```bash
npm i
npx gulp --theme=your-theme
npx gulp --theme=your-theme --mode=hard
```

## 📚 Примеры использования

### 1. По файлам из CLI

```bash
# Только конкретные JS файлы
npx gulp --type js --files em_theme.js app.js

# Только конкретные CSS файлы
npx gulp --type css --files style.css theme.css
```

### 2. Из конфига minifier-config.json
> Можно создавать собственные сброки --option в конфиг файле `minifier-config.json`

```bash
# JS из "min" секции конфига
npx gulp --type js --option min

# CSS из "max" секции конфига
npx gulp --type css --option max
```

### 3. Режимы минификации
```bash
# Легкая (без изменений имен)
npx gulp minify --mode light

# Максимальный (удаляет console.log)
npx gulp --type js --mode hard

# Оптимальный (по умолчанию)
npx gulp --type css --mode normal
```

### 4. Комбо

```bash
# Максимальный режим оптимизации для JS файла theme.js
npx gulp --type js --files theme.js --mode hard
```

### 5. Справка
```bash
npx gulp help
```

## 📚 Примеры использования uploader

### Основные команды
> Название и путь темы можно также задавать в `minifier-config.json`<br>
> Детали по команде uploader смотреть в документации [InSales Uploader](https://insales.github.io/insales-uploader/)
```bash
uploader d
uploader d theme=your-theme
uploader s theme=your-theme
```

## 🗂️ Структура проекта

```text
insales-gulp-minifier/
├── theme_1/                  # Пример рабочей темы 1
│   ├── index.js              # Настройками доступа к магазину
├── theme_2/                  # Пример рабочей темы 2
│   ├── index.js              # Настройками доступа к магазину
├── gulpfile.js               # Основной Gulp
├── insales-config.js         # Конфигурация uploader
├── minifier-config.json      # Пример конфига для проекта
├── package.json              # Зависимости
```
