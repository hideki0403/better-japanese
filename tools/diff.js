const language = process.env.TARGET_LOCALE || 'ja'

const fs = require('fs-extra')
const path = require('path')
const json5 = require('json5')
const rootDir = path.join(__dirname, '../')
const baseLocaleFile = path.join(rootDir, './locales/en.json5')
const targetLocaleFile = path.join(rootDir, `./locales/${language}.json5`)
const resultFile = path.join(rootDir, './untranslated.json')

const baseLocale = json5.parse(fs.readFileSync(baseLocaleFile, 'utf-8'))
const targetLocale = json5.parse(fs.readFileSync(targetLocaleFile, 'utf-8'))

const untranslatedString = {}

// 未翻訳の文章があるか確認
Object.keys(baseLocale).forEach(key => {
    if(!targetLocale[key]) untranslatedString[key] = baseLocale[key]
})

const untranslatedCount = Object.keys(untranslatedString).length

// 未翻訳の文章がなければ終了
if (!untranslatedCount) {
    console.log('未翻訳の文章はありませんでした。')
    process.exit()
}

// 対象が実績またはアップグレードであればquote用の要素も用意しておく
Object.keys(untranslatedString).forEach(key => {
    if (key.match(/^\[(Achievement|Upgrade) name/)) {
        untranslatedString[key.replace('name', 'quote')] = ''
    }
})

// 未翻訳の部分があればjsonとして書き出し
console.log(`未翻訳の文章が${untranslatedCount}件見つかりました。\n対象の文章をディレクトリのrootにuntraslated.jsonとして書き出しました。`)
fs.writeJSONSync(resultFile, untranslatedString, {
    spaces: 4
})