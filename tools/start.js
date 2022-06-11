// select target language
const targetLanguage = process.env.TARGET_LOCALE || 'ja'

const path = require('path')
const fs = require('fs-extra')
const log = require('debug')('Watcher')
const chokidar = require('chokidar')
const rootDir = path.join(__dirname, '../')
const distDir = path.join(rootDir, './dist/')
const srcDir = path.join(rootDir, './src/')
const localeFile = path.join(rootDir, `./locales/${targetLanguage}.json5`)
const json5 = require('json5')
log.enabled = true

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir)

function copyFiles() {
    try {
        fs.copySync(srcDir, distDir)
        fs.writeJSONSync(path.join(distDir, 'translate.json'), json5.parse(fs.readFileSync(localeFile, 'utf-8')))
        return true
    } catch(e) {
        log(e)
        return false
    }
}

copyFiles()

const watcher = chokidar.watch([srcDir, localeFile])

watcher.on('ready', () => log('ready'))

watcher.on('change', (file) => {
    if (copyFiles()) log(`updated: ${file}`)
})