console.time('BetterJapanese')
console.log('[BetterJapanese/Language] Loading')

let conf = JSON.parse(localStorage.getItem('BJPConfig') || '{replaceJP: false}')
let language = localStorage.getItem('BJPLangPack')

if (language && conf.replaceJP) ModLanguage('JA', JSON.parse(language))

console.log('[BetterJapanese/Language] Loaded')
console.timeEnd('BetterJapanese')