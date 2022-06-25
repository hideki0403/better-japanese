// BetterJapanese Injector

let conf = JSON.parse(localStorage.getItem('BJPConfig') || '{"replaceJP": false}')
let language = localStorage.getItem('BJPLangPack')

// localStorageに翻訳データが保存されていない場合はfallbackを使用
if (!language) {
    LoadLang(`loc/JA_fallback.js?v=${Game.version}`)
}

if (language && conf.replaceJP) {
    AddLanguage('JA', 'japanese', JSON.parse(language))
}

Game.LoadMod(`https://pages.yukineko.me/better-japanese/assets/main.js?v=${Game.version}`)