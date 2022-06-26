// ==UserScript==
// @name BetterJapanese
// @include /https?://orteil.dashnet.org/cookieclicker/
// @description CookieClickerの公式日本語訳などを全面的に改善するMod
// ==/UserScript==

const loadBJP = () => {
    const Game = unsafeWindow.Game

    if (typeof Game !== 'undefined' && typeof Game.ready !== 'undefined' && Game.ready) {
        Game.LoadMod('https://pages.yukineko.me/better-japanese/mod.js')
    } else {
        setTimeout(loadBJP, 500)
    }
}

loadBJP()