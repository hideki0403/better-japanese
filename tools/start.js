// select target language
const targetLanguage = process.env.TARGET_LOCALE || 'ja'

const path = require('path')
const fs = require('fs-extra')
const log = require('debug')('Watcher')
const chokidar = require('chokidar')
const rootDir = path.join(__dirname, '../')
const distDir = path.join(rootDir, './dist/')
const srcDir = path.join(rootDir, './src/common')
const assetsDir = path.join(rootDir, './src/steam')
const localeFile = path.join(rootDir, `./locales/${targetLanguage}.json5`)
const json5 = require('json5')
const ESLINT = require('eslint').ESLint
const eslint = new ESLINT()
log.enabled = true

async function initFormatter() {
    formatter = await eslint.loadFormatter('stylish')
}

initFormatter()

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir)

async function copyFiles(file) {
    if (file && file.match(/.(json5|js)/)) {
        let result = formatter.format(await eslint.lintFiles(file))
        console.log(result)
        if (!!result) return false
    }

    fs.copySync(srcDir, distDir)
    fs.copySync(assetsDir, distDir)
    fs.writeJSONSync(path.join(distDir, 'translate.json'), json5.parse(fs.readFileSync(localeFile, 'utf-8')))
    return true
}

copyFiles()

const watcher = chokidar.watch([srcDir, assetsDir, localeFile])

watcher.on('ready', () => log('ready'))

watcher.on('change', async (file) => {
    if (await copyFiles(file)) log(`updated: ${file}`)
})