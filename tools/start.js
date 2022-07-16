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
const color = require('chalk')
log.enabled = true

const version = require(path.join(rootDir, './package.json')).version

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

    let translatedJson = json5.parse(fs.readFileSync(localeFile, 'utf-8'))
    let category = {}
    if (!file || file.match('.json5')) {
        let currentCategory = null
        let parent = null
        let parentKey = null

        for (let key of Object.keys(translatedJson)) {
            if (key.startsWith('#CATEGORY: ')) {
                // カテゴリを生成してcurrentCategoryに指定
                currentCategory = category
                
                key.replace('#CATEGORY: ', '').split('/').forEach(cat => {
                    if (currentCategory.constructor === Array && parent !== null) {
                        if (currentCategory.length) {
                            console.error(color.red('親となるカテゴリに要素が含まれているため、子カテゴリを追加できません。\n(例えばカテゴリ「ミニゲーム」が存在する場合は「ミニゲーム/農場」カテゴリを設定することができません)'))
                            return
                        }

                        parent[parentKey] = {}
                        currentCategory = parent[parentKey]
                    }

                    if (!currentCategory[cat]) currentCategory[cat] = []
                    parent = currentCategory
                    parentKey = cat
                    currentCategory = currentCategory[cat]
                })

                delete translatedJson[key]
                continue
            }

            if (key.startsWith('#ENDCATEGORY:')) {
                currentCategory = null
                delete translatedJson[key]
                continue
            }

            if (currentCategory === null) continue

            if (currentCategory.constructor !== Array) console.error(color.red('カテゴリがネストしているため、親となるカテゴリに要素を追加することができません。\n(例えばカテゴリ「ミニゲーム/農場」が存在する場合は「ミニゲーム」カテゴリを設定することができません)'))

            currentCategory.push(key)
        }
    }

    fs.copySync(srcDir, distDir)
    fs.copySync(assetsDir, distDir)
    fs.writeJSONSync(path.join(distDir, 'translate.json'), translatedJson)
    if (Object.keys(category).length) fs.writeJSONSync(path.join(distDir, 'category.json'), category)

    return true
}

copyFiles()

fs.writeJSONSync(path.join(distDir, './version.json'), { version })

const watcher = chokidar.watch([srcDir, assetsDir, localeFile])

watcher.on('ready', () => log('ready'))

watcher.on('change', async (file) => {
    if (await copyFiles(file)) log(`updated: ${file}`)
})