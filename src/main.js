var betterJapanese = {
    name: 'betterJapanese',
    apiUrl: {
        release: 'https://pages.yukineko.me/better-japanese',
        dev: '../mods/local/better-japanese/translate.json'
    },
    config: {
        hash: '0',
        enable: true
    },
    isDev: false,
    initialized: false,
    fallbackTimer: 0,

    init: function () {
        var origin = eval('Game.UpdateMenu.toString()').split('\n')
        origin.splice(origin.length - 1, 0, `
            if(Game.onMenu == 'prefs'){
                betterJapanese.injectMenu()
            }
        `)

        eval(`Game.UpdateMenu = ${origin.join('\n')}`)

        this.fallbackTimer = setTimeout(() => {
            this.checkUpdate()
            this.initialized = true
        }, 5000)

        send({ id: 'init bridge' })

        this.log('Initialized')
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
        this.log('Checking updates')

        if(this.isDev) return await this.updateLanguagePack(this.apiUrl.dev)
        var res = await fetch(`${this.apiUrl.release}/api/release`).then(res => res.json()).catch(() => this.config.hash)
        if(res.hash !== this.config.hash) {
            if (this.updateLanguagePack(res.url)) {
                this.config.hash = res.hash
                this.save()
            }
        } else {
            this.log('No updates available')
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
            this.log('Update failed')
            return false
        }

        this.log('Update successfull')
        return true
    },

    log: function (msg) {
        console.log(`%c[BetterJapanese]%c ${msg}`, 'color: yellow', '')
    }
}

window.api.receive('fromMain', (msg) => {
    if (msg.id === 'greenworks loaded' && !betterJapanese.initialized) {
        betterJapanese.isDev = !!msg.data.DEV
        betterJapanese.log(`DevMode: ${betterJapanese.isDev}`)
        betterJapanese.checkUpdate()
        if (betterJapanese.isDev) betterJapanese.addDevButton()

        clearTimeout(betterJapanese.fallbackTimer)
        betterJapanese.initialized = true
    }
})

betterJapanese.register()