const config = {
    language: process.env.TARGET_LOCALE || 'ja',
    url: {
        translate: process.env.BASE_URL ? `${process.env.BASE_URL}/assets/translate.json` : 'https://pages.yukineko.me/better-japanese/assets/translate.json',
        category: process.env.BASE_URL ? `${process.env.BASE_URL}/assets/category.json` : 'https://pages.yukineko.me/better-japanese/assets/category.json',
    },
    date: Date.now(),
    hash: 0,
}

const path = require('path')
const fs = require('fs-extra')
const hash = require('md5-file')
const rootDir = path.join(__dirname, '../')
const distDir = path.join(rootDir, './publish/')
const apiDir = path.join(distDir, './api/')
const assetsDir = path.join(distDir, './assets/')
const localeFile = path.join(rootDir, `./locales/${config.language}.json5`)
const releaseLocaleFile = path.join(assetsDir, './translate.json')
const releaseCategoryFile = path.join(assetsDir, './category.json')
const json5 = require('json5')
const color = require('chalk')

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir)
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir)
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir)

let translatedJson = json5.parse(fs.readFileSync(localeFile, 'utf-8'))
let category = {}
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

fs.writeJSONSync(releaseLocaleFile, translatedJson)
fs.writeJSONSync(releaseCategoryFile, category)

config.hash = hash.sync(releaseLocaleFile)

fs.writeJSONSync(path.join(apiDir, 'release.json'), config)