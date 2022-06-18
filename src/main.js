var betterJapanese = {
    name: 'betterJapanese',
    apiUrl: {
        release: 'https://pages.yukineko.me/better-japanese/api/release.json',
        dev: '../mods/local/better-japanese/translate.json'
    },
    config: {
        hash: '0',
        replaceJP: true,
        numberJP: true,
        shortFormatJP: false,
        secondFormatJP: true
    },
    isDev: false,
    initialized: false,
    fallbackTimer: 0,
    origins: {},
    formats: {
        prefix: ['', '万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極', '恒河沙'], // 万進法用の単位
        suffixes: [], // 上数用の単位
        short: [] // 塵劫記用の単位
    },

    init: function() {
        this.load()

        this.fallbackTimer = setTimeout(() => {
            this.checkUpdate()
            this.initialized = true
        }, 5000)

        send({ id: 'init bridge' })

        this.log('Initialized')
    },

    initAfterLoad: async function() {
        betterJapanese.origins.updateMenu = Game.UpdateMenu
        betterJapanese.origins.sayTime = Game.sayTime
        betterJapanese.origins.beautify = Beautify

        // メニューに独自ボタンを実装
        Game.UpdateMenu = function() {
            betterJapanese.origins.updateMenu()
            if (Game.onMenu == 'prefs') {
                betterJapanese.injectMenu()
            }
        }

        // 時間表記からカンマを取り除く
        Game.sayTime = function(time, detail) {
            return betterJapanese.origins.sayTime(time, detail).replaceAll(', ', '')
        }

        // 単位関係の初期化
        for (let suf of ['頻波羅', '矜羯羅', '阿伽羅']) {
            let len = betterJapanese.formats.suffixes.push(suf) - 1
            for (let i = 0; i < len; i++) {
                betterJapanese.formats.suffixes.push(betterJapanese.formats.suffixes[i] + suf)
            }
        }

        betterJapanese.formats.suffixes = ['', ...betterJapanese.formats.suffixes]

        // 塵劫記用の単位
        betterJapanese.formats.short = [...betterJapanese.formats.prefix, '阿僧祇', '那由多', '不可思議', '無量大数']

        // 本家の挿入関数に追加
        numberFormatters = [
            formatEveryThirdPower(formatShort),
            formatEveryThirdPower(formatLong),
            rawFormatter,
            betterJapanese.formatEveryFourthPower()
        ]

        // 設定によって日本語単位を使用するように変更、同時にカンマ区切りも場合によって変更
        Beautify = function(val, floats) {
            var negative = (val < 0)
            var decimal = ''
            var fixed = val.toFixed(floats)
            if (floats > 0 && Math.abs(val) < 1000 && Math.floor(fixed) != fixed) decimal = '.' + (fixed.toString()).split('.')[1]
            val = Math.floor(Math.abs(val))
            if (floats > 0 && fixed == val + 1) val++
            let format = Game.prefs.format ? 2 : betterJapanese.config.numberJP ? 3 : 1
            var formatter = numberFormatters[format]
            var output = (val.toString().indexOf('e+') != -1 && format == 2) ? val.toPrecision(3).toString() : formatter(val).toString()
            if (Game.prefs.format || (betterJapanese.config.numberJP && betterJapanese.config.secondFormatJP)) {
                output = output.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            } else {
                output = output.replace(/^(\d)(\d{3})/, '$1,$2')
            }
            if (output == '0') negative = false
            return negative ? '-' + output : output + decimal
        }

        // 背景の名前を翻訳
        for (let i = 1; i < Game.AllBGs.length; i++) {
            Game.AllBGs[i].enName = Game.AllBGs[i].name
            Game.AllBGs[i].name = loc(Game.AllBGs[i].enName)
        }

        // カスタムCSSを適用
        var customStyle = document.createElement('style')
        customStyle.innerHTML = `
        .framed q:before {
            display:inline-block;
            content:"「" !important;
            font-size:14px;
            font-family:Georgia;
            font-weight:bold;
        }

        .framed q:after {
            display:inline-block;
            content:"」" !important;
            font-size:14px;
            font-family:Georgia;
            font-weight:bold;
            margin-top:-2px;
        }
        `

        document.head.appendChild(customStyle)

        // 在庫市場のquoteを実装
        while (!Game.Objects['Bank'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
        var M = Game.Objects['Bank'].minigame
        M.goodTooltip = function(id) {
            return function() {
                var me = M.goodsById[id]
                var delta = M.goodDelta(id)
                var val = M.getGoodPrice(me)
                icon = me.icon || [0, 0]
                var str = '<div style="padding:8px 4px;min-width:350px;" id="tooltipMarketGood">' + '<div class="icon" style="float:left;margin-left:-8px;margin-top:-8px;background-position:' + (-icon[0] * 48) + 'px ' + (-icon[1] * 48) + 'px;"></div>' + '<div class="name">' + me.name + ' <span style="font-size:12px;opacity:0.8;">(' + loc('from %1', '<span style="font-variant:small-caps;">' + me.company + '</span>') + ')</span> <span class="bankSymbol">' + me.symbol + ' <span class="bankSymbolNum' + (delta >= 0 ? ' bankSymbolUp' : delta < 0 ? ' bankSymbolDown' : '') + '">' + (delta + '' + (delta == Math.floor(delta) ? '.00' : (delta * 10) == Math.floor(delta * 10) ? '0' : '') + '%') + '</span></span></div>' + '<div class="line"></div><div class="description">' + '<q>' + loc(me.desc) + '</q>' + '<div class="line"></div><div style="font-size:11px;">&bull; <div class="icon" style="pointer-events:none;display:inline-block;transform:scale(0.5);margin:-16px -18px -16px -14px;vertical-align:middle;background-position:' + (-icon[0] * 48) + 'px ' + (-icon[1] * 48) + 'px;"></div> ' + loc('%1: currently worth <b>$%2</b> per unit.', [me.name, Beautify(val, 2)]) + '<br>&bull; ' + loc('You currently own %1 (worth <b>$%2</b>).', ['<div class="icon" style="pointer-events:none;display:inline-block;transform:scale(0.5);margin:-16px -18px -16px -14px;vertical-align:middle;background-position:' + (-icon[0] * 48) + 'px ' + (-icon[1] * 48) + 'px;"></div> <b>' + Beautify(me.stock) + '</b>x ' + me.name, Beautify(val * me.stock, 2)]) + '<br>&bull; ' + loc('Your warehouses can store up to %1.', '<div class="icon" style="pointer-events:none;display:inline-block;transform:scale(0.5);margin:-16px -18px -16px -14px;vertical-align:middle;background-position:' + (-icon[0] * 48) + 'px ' + (-icon[1] * 48) + 'px;"></div> <b>' + Beautify(M.getGoodMaxStock(me)) + '</b>x ' + me.name) + '<br>&bull; ' + loc('You may increase your storage space by upgrading your offices and by buying more %1. You also get %2 extra storage space per %3 level (currently: <b>+%4</b>).', ['<div class="icon" style="pointer-events:none;display:inline-block;transform:scale(0.5);margin:-16px -18px -16px -14px;vertical-align:middle;background-position:' + (-me.building.iconColumn * 48) + 'px ' + (0 * 48) + 'px;"></div> ' + me.building.plural, 10, me.building.single, (me.building.level * 10)]) + '<br>&bull; ' + loc('The average worth of this stock and how high it can peak depends on the building it is tied to, along with the level of your %1.', '<div class="icon" style="pointer-events:none;display:inline-block;transform:scale(0.5);margin:-16px -18px -16px -14px;vertical-align:middle;background-position:' + (-15 * 48) + 'px ' + (0 * 48) + 'px;"></div> ' + Game.Objects['Bank'].plural) + '</div>' + '<div style="font-size:11px;opacity:0.5;margin-top:3px;">' + loc('%1 the hide button to toggle all other stocks.', loc('Shift-click')) + '</div>' + '</div></div>'
                return str
            }
        }

        // 更新履歴の翻訳
        let logUpdates = ''
        let logPerUpdate = ''
        let logIndex = ''
        let logResult = []
        let logId = 0
        while (typeof (logIndex = FindLocStringByPart(`Update notes ${logId}`)) === 'string' && typeof (logResult = loc(logIndex)) === 'object' && logResult.length > 1)
        {
            logPerUpdate = `<div class="subsection update${logIndex === `[Update notes ${logId}]small` ? ' small' : ''}">`
            logPerUpdate += `<div class="title">${logResult[0]}</div>`
            logResult.shift()
            for (let str of logResult)
            {
                if(str.indexOf('[Update Log General Names]') >= 0)
                {
                    str = str.replaceAll('[Update Log General Names]', choose(loc('[Update Log General Names]')))
                }
                logPerUpdate += `<div class="listing">${str}</div>`
            }
            logUpdates = `${logPerUpdate}</div>${logUpdates}`
            logId++
        }
        if(logUpdates.length > 0)
        {
            betterJapanese.origins.updateLog = Game.updateLog
            Game.updateLog = Game.updateLog.substring(0, Game.updateLog.search(/<div class="subsection update(?: small)?">/))
            Game.updateLog = Game.updateLog.substring(0, Game.updateLog.lastIndexOf('<div class="listing" style="font-weight:bold;font-style:italic;opacity:0.5;">'))
            Game.updateLog += `</div>${logUpdates}</div>`
        }

        // hookを削除
        Game.removeHook('create', betterJapanese.initAfterLoad)
    },

    register: function() {
        Game.registerMod(this.name, this)
        Game.registerHook('create', betterJapanese.initAfterLoad)
    },

    save: function() {
        localStorage.setItem('BJPConfig', JSON.stringify(this.config))
    },

    load: function() {
        var conf = localStorage.getItem('BJPConfig')
        if (conf) this.config = JSON.parse(conf)
    },

    log: function(msg) {
        console.log(`%c[BetterJapanese]%c ${msg}`, 'color: yellow', '')
    },

    injectMenu: function() {
        let updateAll = () => {
            BeautifyAll()
            Game.RefreshStore()
            Game.upgradesToRebuild = 1
        }
        this.writeButton('toggleBJPButton', 'replaceJP', '日本語訳の改善', '日本語訳を非公式翻訳版に置き換えます。変更は再起動後に適用されます。', updateAll)
        this.writeButton('toggleNumberJPButton', 'numberJP', '日本語単位', '数の単位に日本語単位を用います。', updateAll)
        this.writeButton('toggleShortFormatJPButton', 'shortFormatJP', '塵劫記単位', '数の単位に塵劫記の単位(阿僧祇～無量大数)を用います。', updateAll)
        this.writeButton('toggleSecondFormatJPButton', 'secondFormatJP', '第二単位', `${loc('ON')}の場合はXXXX億YYYY万、${loc('OFF')}の場合はXXXX.YYYY億のように表示されます。`, updateAll)
    },

    writeButton: function(buttonId, targetProp, desc, label = null, callback = null, targetElementName = 'monospaceButton') {
        // 本家のWritePrefButtonとほぼ同じ

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
        if (callback && typeof callback === 'function') onclickStr += `(${callback.toString()})()`

        elementButton.setAttribute(Game.clickStr, onclickStr)

        elementButton.innerText = `${desc} ${this.config[targetProp] ? loc('ON') : loc('OFF')}`
        targetElement.parentNode.insertBefore(elementButton, targetElement.previousElementSibling)

        // ラベルがあれば生成
        if (label) {
            var elementLabel = document.createElement('label')
            elementLabel.innerText = `(${label})`
            targetElement.parentNode.insertBefore(elementLabel, targetElement.previousElementSibling)
        }
    },

    toggleButton: function(buttonId, targetProp, desc) {
        var button = l(buttonId)
        betterJapanese.config[targetProp] = !betterJapanese.config[targetProp]
        button.className = `smallFancyButton prefButton option ${this.config[targetProp] ? 'on' : 'off'}`
        button.innerText = `${desc} ${this.config[targetProp] ? loc('ON') : loc('OFF')}`
        PlaySound('snd/tick.mp3')
    },

    addDevButton: function() {
        var element = document.createElement('div')
        element.innerHTML = '<button style="position: absolute; left: 10px; top: 10px; z-index: 9999;" type="button" onclick="betterJapanese.reloadLanguagePack()">Reload LanguageFile</button>'
        document.body.append(element)
    },

    checkUpdate: async function() {
        this.log('Checking updates')

        if (this.isDev) return await this.updateLanguagePack(this.apiUrl.dev)
        var res = await fetch(this.apiUrl.release).then(res => res.json()).catch((err) => {
            this.log(`An error occurred while checking for updates: ${err}`)
            return this.config
        })

        if (res.hash !== this.config.hash) {
            if (await this.updateLanguagePack(res.url)) {
                this.config.hash = res.hash
                this.save()
                this.showUpdateNotification()
            }
        } else {
            this.log('No updates available')
        }
    },

    showUpdateNotification: function() {
        Game.Notify('日本語訳改善Mod', '翻訳データを更新しました。<br>再読み込み後から有効になります。<br><a onclick="betterJapanese.reload()">セーブデータを保存して再読み込み</a>')
    },

    reload: function() {
        Game.toSave = true
        Game.toReload = true
    },

    reloadLanguagePack: async function() {
        await this.checkUpdate()
        this.showUpdateNotification()
        ModLanguage('JA', JSON.parse(localStorage.getItem('BJPLangPack')))
    },

    updateLanguagePack: async function(url) {
        var base = {
            '': {
                'language': 'JA',
                'plural-forms': 'nplurals=2;plural=(n!=1);'
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

    formatEveryFourthPower: function() {
        // 接尾辞挿入の4桁区切り版、secondで第二単位の使用を指定
        return function(value) {
            var prefixes = betterJapanese.config.shortFormatJP ? betterJapanese.formats.short : betterJapanese.formats.prefix
            var suffixes = betterJapanese.config.shortFormatJP ? [''] : betterJapanese.formats.suffixes
            var second = betterJapanese.config.secondFormatJP

            // infinityの場合は無限大を返す
            if (!isFinite(value)) return '無限大'// loc("Infinity")

            if (value > 10 ** (prefixes.length * suffixes.length * 4)) {
                return value.toPrecision(3).toString()
            }

            // 小数点の場合は最大小数第3位まででそのまま出力
            if (value < 1) {
                return (Math.round(value * 1000) / 1000).toString()
            }

            let numeral = Math.floor(Math.log10(value) / 4)
            let preIndex = numeral % prefixes.length
            let sufIndex = Math.floor(numeral / prefixes.length)
            let dispNum = Math.round(value * 10000 / (10 ** (numeral * 4)))

            if (second) {
                // 第二単位を付ける
                if (!preIndex && !sufIndex) return value

                let str = Math.floor(dispNum / 10000) + (preIndex ? prefixes[preIndex] : suffixes[sufIndex])
                if (dispNum % 10000) str += (dispNum % 10000) + prefixes[preIndex ? preIndex - 1 : prefixes.length - 1]
                str += suffixes[preIndex ? sufIndex : sufIndex - 1]

                return str !== 'NaN' ? str : value.toPrecision(3).toString()

            } else {
                // 第二単位を付けない
                return Math.round(value * 10000 / (10 ** (numeral * 4))) / 10000 + prefixes[preIndex] + suffixes[sufIndex]
            }
        }
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