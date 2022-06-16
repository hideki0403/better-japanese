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
    origins: {},

    init: function () {
        this.load()

        //万進法用の単位
        betterJapanese.formatJpPrefixes = ['','万','億','兆','京','垓','秭','穣','溝','澗','正','載','極','恒河沙']
        //上数用の単位
        betterJapanese.formatJpSuffixes = [];
        for(let suf of ['頻波羅','矜羯羅','阿伽羅']){
            let len = betterJapanese.formatJpSuffixes.push(suf) - 1
            for(let i = 0; i < len; i++){
                betterJapanese.formatJpSuffixes.push(betterJapanese.formatJpSuffixes[i] + suf)
            }
        }
        betterJapanese.formatJpSuffixes = ['', ...betterJapanese.formatJpSuffixes]
        //塵劫記用の単位
        betterJapanese.formatJpShort = [...betterJapanese.formatJpPrefixes, '阿僧祇', '那由多', '不可思議', '無量大数']

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
        betterJapanese.origins.beautify = Beautify

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
        
        //接尾辞挿入の4桁区切り版、secondで第二単位の使用を指定
        betterJapanese.formatEveryFourthPower = function(prefixes, suffixes, second)
        {
            return function (value)
            {
                if(!isFinite(value)) return '無限大';//loc("Infinity")
                if(value > 10 ** (prefixes.length * suffixes.length * 4)){
                    return value.toPrecision(3).toString()
                }
                let numeral = Math.floor(Math.log10(value) / 4)
                let preIndex = numeral % prefixes.length
                let sufIndex = Math.floor(numeral / prefixes.length)
                let dispNum = Math.round(value * 10000 / (10 ** (numeral * 4)))
                if(second){
                    if(preIndex){
                        return Math.floor(dispNum / 10000) + prefixes[preIndex] + (dispNum % 10000) + prefixes[preIndex - 1] + suffixes[sufIndex]
                    }else{
                        if(sufIndex){
                            return Math.floor(dispNum / 10000) + suffixes[sufIndex] + (dispNum % 10000) + prefixes[prefixes.length - 1] + suffixes[sufIndex - 1]
                        }else{
                            return value
                        }
                    }
                }else{
                    return Math.round(value * 10000 / (10 ** (numeral * 4))) / 10000 + prefixes[preIndex] + suffixes[sufIndex]
                }
            };
        }
        
        //本家の挿入関数に追加
        numberFormatters=
        [
            formatEveryThirdPower(formatShort),
            formatEveryThirdPower(formatLong),
            rawFormatter,
            betterJapanese.formatEveryFourthPower(betterJapanese.formatJpShort, [''], false),
            betterJapanese.formatEveryFourthPower(betterJapanese.formatJpShort, [''], true),
            betterJapanese.formatEveryFourthPower(betterJapanese.formatJpPrefixes, betterJapanese.formatJpSuffixes, false),
            betterJapanese.formatEveryFourthPower(betterJapanese.formatJpPrefixes, betterJapanese.formatJpSuffixes, true)
        ];

        //設定によって日本語単位を使用するように変更、同時にカンマ区切りも場合によって変更
        Beautify = function(val, floats){
            var negative = (val < 0);
            var decimal = '';
            var fixed = val.toFixed(floats);
            if (floats > 0 && Math.abs(val) < 1000 && Math.floor(fixed) != fixed) decimal = '.' + (fixed.toString()).split('.')[1];
            val = Math.floor(Math.abs(val));
            if (floats > 0 && fixed == val + 1) val++;
            let format = 0;
            if(Game.prefs.format){
                format = 2;
            }else{
                if(betterJapanese.config.numberJP){
                    if(betterJapanese.config.shortFormatJP){
                        format = 3;
                    }else{
                        format = 5;
                    }
                    if(betterJapanese.config.secondFormatJP){
                        format++;
                    }
                }else{
                    format = 1;
                }
            }
            var formatter=numberFormatters[format];
            var output=(val.toString().indexOf('e+')!=-1 && format==2)?val.toPrecision(3).toString():formatter(val).toString();
            if(Game.prefs.format || (betterJapanese.config.numberJP && betterJapanese.config.secondFormatJP)){
                output = output.replace(/\B(?=(\d{3})+(?!\d))/g,',');
            }else{
                output = output.replace(/^(\d)(\d{3})/,'$1,$2');
            }
            if (output=='0') negative=false;
            return negative?'-'+output:output+decimal;
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
        let updateAll = () => {
            BeautifyAll()
            Game.RefreshStore()
            Game.upgradesToRebuild=1
        }
        this.writeButton('toggleBJPButton', 'enable', '日本語訳の改善', '日本語訳を非公式翻訳版に置き換えます', updateAll)
        this.writeButton('toggleNumberJPButton', 'numberJP', '日本語単位', '数の単位に日本語単位を用います', updateAll)
        this.writeButton('toggleShortFormatJPButton', 'shortFormatJP', '塵劫記単位', '数の単位に塵劫記の単位(阿僧祇～無量大数)を用います', updateAll)
        this.writeButton('toggleSecondFormatJPButton', 'secondFormatJP', '第二単位', `${loc("ON")}の場合はXXXX億YYYY万、${loc("OFF")}の場合はXXXX.YYYY億のように表示されます`, updateAll)
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
        
        elementButton.innerText = `${desc} ${this.config[targetProp] ? loc("ON") : loc("OFF")}`
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
        betterJapanese.config[targetProp] = !betterJapanese.config[targetProp]
        button.className = `smallFancyButton prefButton option ${this.config[targetProp] ? 'on' : 'off'}`
        button.innerText = `${desc} ${this.config[targetProp] ? loc("ON") : loc("OFF")}`
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
        var res = await fetch(`${this.apiUrl.release}/api/release.json`).then(res => res.json()).catch(() => this.config.hash)
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