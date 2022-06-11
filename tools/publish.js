const config = {
    language: process.env.TARGET_LOCALE || 'ja',
    url: process.env.BASE_URL ? `${process.env.BASE_URL}/translate.json` : 'https://pages.yukineko.me/better-japanese/translate.json',
    date: Date.now(),
    hash: 0,
}

const path = require('path')
const fs = require('fs-extra')
const hash = require('md5-file')
const rootDir = path.join(__dirname, '../')
const distDir = path.join(rootDir, './publish/')
const apiDir = path.join(distDir, './api/')
const localeFile = path.join(rootDir, `./locales/${config.language}.json5`)
const releaseLocaleFile = path.join(distDir, 'translate.json')
const json5 = require('json5')

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir)
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir)

fs.writeJSONSync(releaseLocaleFile, json5.parse(fs.readFileSync(localeFile, 'utf-8')))

config.hash = hash.sync(releaseLocaleFile)

fs.writeJSONSync(path.join(apiDir, 'release.json'), config)