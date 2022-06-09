console.time('BetterJapanese')
console.log('[BetterJapanese/Language] Loading')

var conf = JSON.parse(localStorage.getItem('BJPConfig') || '{enable: false}')
var language = localStorage.getItem('BJPLangPack')

if (language && conf.enable) ModLanguage('JA', JSON.parse(language))

console.log('[BetterJapanese/Language] Loaded')
console.timeEnd('BetterJapanese')