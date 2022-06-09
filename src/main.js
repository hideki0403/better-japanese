var betterJapanese = {
    name: 'betterJapanese',
    apiUrl: {
        release: 'https://hideki0403.github.io/better-japanese',
        dev: '../mods/local/better-japanese/translate.json'
    },
    config: {
        version: '0.0.1',
        enable: true
    },
    isDev: true,

    init: function () {
        var origin = eval('Game.UpdateMenu.toString()').split('\n')
        origin.splice(origin.length - 1, 0, `
            if(Game.onMenu == 'prefs'){
                betterJapanese.injectMenu()
            }
        `)

        eval(`Game.UpdateMenu = ${origin.join('\n')}`)

        console.log('[BetterJapanese] Initialized')
        this.checkUpdate()

        if(this.isDev) this.addDevButton()
    },

    register: function () {
        Game.registerMod(this.name, this)
    },

    save: function () {
        localStorage.setItem('BJPConfig', JSON.stringify(this.config))
    },

    load: function () {
        var conf = localStorage.getItem('BJPConfig')
        if (conf) this.config = JSON.parse(conf)
        
    },

    injectMenu: function () {
        var button = l('monospaceButton')
        var element = document.createElement('div')
        element.innerHTML = `<a class="smallFancyButton prefButton option ${this.config.enable ? 'on' : 'off'}" id="betterJPButton" ${Game.clickStr}="betterJapanese.toggleButton()">非公式日本語訳 ${this.config.enable ? 'ON' : 'OFF'}</a><label>(日本語訳を非公式翻訳版に置き換えます)</label>`

        button.parentNode.insertBefore(element, button.previousElementSibling)
    },

    toggleButton: function () {
        var button = l('betterJPButton')
        this.config.enable = !this.config.enable
        button.innerHTML = `非公式日本語訳 ${this.config.enable ? 'ON' : 'OFF'}`
        button.className = `smallFancyButton prefButton option ${(this.config.enable ? 'on' : 'off')}`
        BeautifyAll()
        Game.RefreshStore()
        Game.upgradesToRebuild = 1
        PlaySound('snd/tick.mp3')
    },

    addDevButton: function () {
        var element = document.createElement('div')
        element.innerHTML = `<button style="position: absolute; left: 10px; top: 10px; z-index: 9999;" type="button" onclick="betterJapanese.reloadLanguagePack()">Reload LanguageFile</button>`
        document.body.append(element)
    },

    checkUpdate: async function () {
        console.log('[BetterJapanese] Checking updates')

        if(this.isDev) return await this.updateLanguagePack(this.apiUrl.dev)
        var res = await fetch(`${this.apiUrl.release}/api/version`).then(res => res.json())
        if(res.version !== this.config.version) {
            if (this.updateLanguagePack(res.url)) {
                this.config.version = res.version
                this.save()
            }
        }
    },

    reloadLanguagePack: async function () {
        await this.checkUpdate()
        ModLanguage('JA', JSON.parse(localStorage.getItem('BJPLangPack')))
    },

    updateLanguagePack: async function (url) {
        var base = {
            "": {
                "language": "JA",
                "plural-forms": "nplurals=2;plural=(n!=1);"
            },
        }

        try {
            var lang = await fetch(url).then(res => res.json())
            localStorage.setItem('BJPLangPack', JSON.stringify(Object.assign(base, lang)))
        } catch {
            console.log('[BetterJapanese] Update failed')
            return false
        }

        console.log('[BetterJapanese] Update successfull')
        return true
    }
}

betterJapanese.register()