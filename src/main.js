var betterJapanese = {
    name: 'betterJapanese',
    apiUrl: {
        release: 'https://pages.yukineko.me/better-japanese/api/release.json',
        dev: '../mods/local/better-japanese/translate.json'
    },
    config: {
        hash: '0',
        enable: true
    },
    isDev: false,
    initialized: false,
    fallbackTimer: 0,
    origins: {},

    init: function () {
        this.load()

        this.fallbackTimer = setTimeout(() => {
            this.checkUpdate()
            this.initialized = true
        }, 5000)

        send({ id: 'init bridge' })

        this.log('Initialized')
    },

    initAfterLoad: function(){
        betterJapanese.origins.updateMenu = Game.UpdateMenu
        betterJapanese.origins.sayTime = Game.sayTime

        // メニューに独自ボタンを実装
        Game.UpdateMenu = function(){
            betterJapanese.origins.updateMenu()
            if(Game.onMenu == 'prefs'){
                betterJapanese.injectMenu()
            }
        }

        // 時間表記からカンマを取り除く
        Game.sayTime = function(time, detail){
            return betterJapanese.origins.sayTime(time, detail).replaceAll(', ', '')
        }

        // hookを削除
        Game.removeHook('create', betterJapanese.initAfterLoad)
    },

    register: function () {
        Game.registerMod(this.name, this)
        Game.registerHook('create', betterJapanese.initAfterLoad)
    },

    save: function () {
        localStorage.setItem('BJPConfig', JSON.stringify(this.config))
    },

    load: function () {
        var conf = localStorage.getItem('BJPConfig')
        if (conf) this.config = JSON.parse(conf)
    },

    injectMenu: function () {
        this.writeButton('toggleBJPButton', 'enable', '日本語訳の改善', '日本語訳を非公式翻訳版に置き換えます', () => {
            BeautifyAll()
            Game.RefreshStore()
            Game.upgradesToRebuild=1
        })
    },

    writeButton: function (buttonId, targetProp, desc, label = null, callback = null, targetElementName = 'monospaceButton') {
        //本家のWritePrefButtonとほぼ同じ

        // ボタンを追加する先の要素を指定 (デフォルトはmonospaceButton)
        var targetElement = l(targetElementName)

        // 仕様の都合上、最初に改行タグを追加
        targetElement.parentNode.insertBefore(document.createElement('br'), targetElement.previousElementSibling)

        // ボタンを生成
        var elementButton = document.createElement('a')
        elementButton.className = `smallFancyButton prefButton option ${this.config[targetProp] ? 'on' : 'off'}`
        elementButton.id = buttonId

        var onclickStr = `betterJapanese.toggleButton('${buttonId}', '${targetProp}', '${desc}');`

        // Callbackが存在し、なおかつ与えられた引数がfunctionであればCallbackを追加
        if(callback && typeof callback === 'function') onclickStr += `(${callback.toString()})()`

        elementButton.setAttribute(Game.clickStr, onclickStr)
        
        elementButton.innerText = `${desc} ${this.config[targetProp] ? 'ON' : 'OFF'}`
        targetElement.parentNode.insertBefore(elementButton, targetElement.previousElementSibling)

        // ラベルがあれば生成
        if(label) {
            var elementLabel = document.createElement('label')
            elementLabel.innerText = `(${label})`
            targetElement.parentNode.insertBefore(elementLabel, targetElement.previousElementSibling)
        }
    },

    toggleButton: function (buttonId, targetProp, desc) {
        var button = l(buttonId)
        this.config[targetProp] = !this.config[targetProp]
        button.className = `smallFancyButton prefButton option ${this.config[targetProp] ? 'on' : 'off'}`
        button.innerText = `${desc} ${this.config[targetProp] ? 'ON' : 'OFF'}`
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
        var res = await fetch(this.apiUrl.release).then(res => res.json()).catch(() => this.config.hash)
        if(res.hash !== this.config.hash) {
            if (await this.updateLanguagePack(res.url)) {
                this.config.hash = res.hash
                this.save()
                this.showUpdateNotification()
            }
        } else {
            this.log('No updates available')
        }
    },

    showUpdateNotification: function () {
        Game.Notify('日本語訳改善Mod', '翻訳データを更新しました。<br>再読み込み後から有効になります。<br><a onclick="betterJapanese.reload()">セーブデータを保存して再読み込み</a>')
    },

    reload: function () {
        Game.toSave = true
        Game.toReload = true
    },

    reloadLanguagePack: async function () {
        await this.checkUpdate()
        this.showUpdateNotification()
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
        betterJapanese.isDev = betterJapanese.isDev || !!msg.data.DEV
        betterJapanese.log(`DevMode: ${betterJapanese.isDev}`)
        betterJapanese.checkUpdate()
        if (betterJapanese.isDev) betterJapanese.addDevButton()

        clearTimeout(betterJapanese.fallbackTimer)
        betterJapanese.initialized = true
    }
})

betterJapanese.register()