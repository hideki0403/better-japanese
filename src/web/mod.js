// BetterJapanese WebMod

let conf = JSON.parse(localStorage.getItem('BJPConfig') || '{"replaceJP": false}')
let language = localStorage.getItem('BJPLangPack')

if (language && conf.replaceJP) {
    ModLanguage('JA', JSON.parse(language))
}

Game.LoadMod(`https://pages.yukineko.me/better-japanese/assets/main.js?nocache=${Date.now()}`)