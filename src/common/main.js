const betterJapanese = {
    name: 'betterJapanese',
    api: {
        url: {
            release: 'https://pages.yukineko.me/better-japanese/api/release.json',
            dev: '../mods/local/better-japanese'
        },
        endpoints: {
            'TRANSLATE': null,
            'CATEGORY': null
        },
        cache: null
    },
    config: {
        hash: '0',
        replaceJP: true,
        replaceNews: true,
        numberJP: true,
        shortFormatJP: false,
        secondFormatJP: true,
        ignoreList: []
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
    tmpIgnoreList: {},
    tmpCategoryList: {},
    currentIgnoreList: [],
    isRegisteredHook: false,

    init: function() {
        this.fallbackTimer = setTimeout(() => {
            this.checkUpdate()
            this.initialized = true
        }, 5000)

        if (App) send({ id: 'init bridge' })

        if (!this.isRegisteredHook) this.initAfterLoad()

        // Web版で既にDOMが構築されていた場合はDOMを再構成するスクリプトを読み込む (一部の翻訳が適用されないため)
        if (!App && Game.ready) Game.LoadMod('https://pages.yukineko.me/better-japanese/rebuild.js')

        this.log('Initialized')
    },

    initAfterLoad: async function() {
        betterJapanese.load()

        // メニューに独自ボタンを実装
        // この方法で実装しないとCCSEなどのメニュー独自実装Modと競合してしまう
        let origin = eval('Game.UpdateMenu.toString()').split('\n')
        origin.splice(origin.length - 1, 0, `
            if (Game.onMenu == 'prefs') {
                betterJapanese.injectMenu()
            }
            
            if (Game.onMenu == 'stats') {
                betterJapanese.fixStats()
            }
        `)
        eval(`Game.UpdateMenu = ${origin.join('\n')}`)

        // 時間表記からカンマを取り除く
        betterJapanese.origins.sayTime = Game.sayTime
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
        betterJapanese.origins.beautify = Beautify
        Beautify = function(val, floats) {
            let negative = (val < 0)
            let decimal = ''
            let fixed = val.toFixed(floats)
            if (floats > 0 && Math.abs(val) < 1000 && Math.floor(fixed) != fixed) decimal = '.' + (fixed.toString()).split('.')[1]
            val = Math.floor(Math.abs(val))
            if (floats > 0 && fixed == val + 1) val++
            let format = Game.prefs.format ? 2 : betterJapanese.config.numberJP ? 3 : 1
            let formatter = numberFormatters[format]
            let output = (val.toString().indexOf('e+') != -1 && format == 2) ? val.toPrecision(3).toString() : formatter(val).toString()
            if (Game.prefs.format || (betterJapanese.config.numberJP && betterJapanese.config.secondFormatJP)) {
                output = output.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            } else {
                output = output.replace(/^(\d)(\d{3})/, '$1,$2')
            }
            if (output == '0') negative = false
            return negative ? '-' + output : output + decimal
        }

        // 指数表記の場合表示が崩れる現象を修正
        if (!betterJapanese.origins.simpleBeautify) betterJapanese.origins.simpleBeautify = SimpleBeautify
        SimpleBeautify = function(val) {
            if (val.toString().indexOf('e+') >= 0) {
                return val.toString().replace(/(?<=.)(\d{3})(?=\d)/g, '$1,')
            }
            return betterJapanese.origins.simpleBeautify(val)
        }

        // カスタムCSSを適用
        let customStyle = document.createElement('style')
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

        #prompt.ignoreList {
            width: 50vw;
            left: -25vw;
        }

        #prompt input {
            width: auto;
            margin: 4px;
        }

        .accordion-parent {
            display: none;
        }

        .accordion-child {
            display: none;
        }

        .accordion-parent:checked + label + .accordion-child {
            display: block;
        }

        .accordion-parent + label > li:after {
            content: "▼";
            margin-left: 10px;
            background-color: #555;
            padding: 2px;
            border-radius: 8px;
        }

        .accordion-parent:checked + label > li:after {
            content: "▲";
        }

        #prompt li {
            margin: 5px 0;
            padding: 5px;
            background: #222;
        }

        #prompt ul ul {
            list-style: none;
            padding-left: 20px;
        }
        `

        document.head.appendChild(customStyle)

        // 設定の「日本語訳の改善」がOFFになっている場合はここから下は実行しない (ニュース欄やアップデート履歴が壊れる)
        if (!betterJapanese.config.replaceJP) return

        // 背景の名前を翻訳
        for (let i = 1; i < Game.AllBGs.length; i++) {
            Game.AllBGs[i].enName = Game.AllBGs[i].name
            Game.AllBGs[i].name = loc(Game.AllBGs[i].enName)
        }

        // 在庫市場のquoteを実装
        while (!Game.Objects['Bank'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
        if (!betterJapanese.origins.goodTooltip) {
            betterJapanese.origins.goodTooltip = Game.Objects['Bank'].minigame.goodTooltip
        }
        Game.Objects['Bank'].minigame.goodTooltip = function(id) {
            return function() {
                let desc = betterJapanese.origins.goodTooltip(id)()
                const qbefore = '<div class="line"></div>'
                let qpos = desc.indexOf(qbefore) + qbefore.length
                return `${desc.substring(0, qpos)}<div class="description"><q>${loc(Game.Objects['Bank'].minigame.goodsById[id].desc)}</q><div class="line">${desc.substring(qpos)}`
            }
        }

        // 菜園情報の画像を差し替え
        while (!Game.Objects['Farm'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
        Function('Game.Objects[\'Farm\'].minigame.tools[\'info\'].descFunc=' + Game.Objects['Farm'].minigame.tools['info'].descFunc.toString().replace(/(<img src=").+?(")/, '$1data:image/png;base64,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$2'))()

        // 情報欄の翻訳
        betterJapanese.origins.updateLog = Game.updateLog
        Game.updateLog = `
            <div class="selectable">
	            <div class="section">${loc('Info')}</div>
	            <div class="subsection">
	                <div class="title">${loc('About')}</div>
    	            ${(App ? `<div class="listing" style="font-weight:bold;font-style:italic;opacity:0.5;">${loc('Note: links will open in your web browser.')}</div>` : '')}
	                <div class="listing">
                        ${loc('Cookie Clicker is a javascript game by %1 and %2.', [
                            '<a href="//orteil.dashnet.org" target="_blank">Orteil</a>',
                            '<a href="//dashnet.org" target="_blank">Opti</a>'
                        ])}
                    </div>
	                ${(App ? `<div class="listing">${loc('Music by %1.', '<a href="https://twitter.com/C418" target="_blank">C418</a>')}</div>` : '')}
	                <div class="listing">
                        ${loc('We have an %1; if you\'re looking for help, you may also want to visit the %2 or the %3.<br>News and teasers are usually posted on Orteil\'s %4 and %5.', [
                            `<a href="https://discordapp.com/invite/cookie" target="_blank">${loc('official Discord')}</a>`,
                            '<a href="https://www.reddit.com/r/CookieClicker" target="_blank">subreddit</a>',
		                    '<a href="https://cookieclicker.wikia.com/wiki/Cookie_Clicker_Wiki" target="_blank">wiki</a>',
		                    '<a href="https://orteil42.tumblr.com/" target="_blank">tumblr</a>',
		                    '<a href="https://twitter.com/orteil42" target="_blank">twitter</a>',
		                ])}
	                </div>
                    ${(!App ? `<div class="listing block" style="margin:8px 32px;font-size:11px;line-height:110%;color:rgba(200,200,255,1);background:rgba(128,128,255,0.15);" id="supportSection">
                        ${loc('This version of Cookie Clicker is 100% free, forever. Want to support us so we can keep developing games? Here\'s some ways you can help:%1', [`<br><br>
                            &bull; ${loc('get %1 (it\'s about 5 bucks)', `<a href="https://store.steampowered.com/app/1454400/Cookie_Clicker/" target="_blank" class="highlightHover smallWhiteButton">${loc('Cookie Clicker on Steam')}</a>`)}<br><br>
                            &bull; ${loc('support us on %1 (there\'s perks!)', '<a href="https://www.patreon.com/dashnet" target="_blank" class="highlightHover smallOrangeButton">Patreon</a>')}<br><br>
                            &bull; ${loc('check out our %1 with rad cookie shirts, hoodies and stickers', `<a href="http://www.redbubble.com/people/dashnet" target="_blank" class="highlightHover smallWhiteButton">${loc('Shop')}</a>`)}<br><br>
                            &bull; ${loc('disable your adblocker (if you want!)')}
                        `])}
                    </div>
                </div>` : '')}
                <div class="listing warning">${loc('Note: if you find a new bug after an update and you\'re using a 3rd-party add-on, make sure it\'s not just your add-on causing it!')}</div>
                ${(!App ? (`<div class="listing warning">
                    ${loc('Warning: clearing your browser cache or cookies <small>(what else?)</small> will result in your save being wiped. Export your save and back it up first!')}
                </div>`) : '')}
            </div>
            <div class="subsection">
            <div class="title">${loc('Version history')}</div>`
        let logUpdates = ''
        let logPerUpdate = ''
        let logIndex = ''
        let logResult = []
        let logId = 0
        while (typeof (logIndex = FindLocStringByPart(`Update notes ${logId}`)) === 'string' && typeof (logResult = loc(logIndex)) === 'object' && logResult.length > 1) {
            let logOptions = logIndex.substring(logIndex.indexOf(']') + 1).split('|')
            let isSmallList = false, isAppList = false
            if (logOptions.includes('small')) isSmallList = true
            if (logOptions.includes('app')) isAppList = true
            if ((App && isAppList) || !isAppList) {
                logPerUpdate = `<div class="subsection update${isSmallList ? ' small' : ''}">`
                logPerUpdate += `<div class="title">${logResult[0]}</div>`
                for (let i = 1; i < logResult.length; i++) {
                    let options = logResult[i].split('|')
                    let str = options.pop()
                    let isAppItem = false
                    if (options.length > 0) {
                        if (options.includes('app')) isAppItem = true
                    }
                    if ((App && isAppItem) || !isAppItem) {
                        str = str.replaceAll('[Update Log General Names]', choose(loc('[Update Log General Names]')))
                        logPerUpdate += `<div class="listing">${str}</div>`
                    }
                }
                logUpdates = `${logPerUpdate}</div>${logUpdates}`
            }
            logId++
        }
        Game.updateLog += `</div>${logUpdates}</div></div>`

        // 巡り続ける読本のフレーバーテキスト翻訳、thisを使うので非ラムダ式(以降同様)
        let upgrade = Game.Upgrades['Endless book of prose']
        upgrade.desc = loc('%1 are <b>twice</b> as efficient.', cap(upgrade.buildingTie1.plural))
        upgrade.originDescFunc = upgrade.descFunc
        upgrade.descFunc = function() {
            let str = loc(FindLocStringByPart(`Upgrade quote ${this.id}`), Game.bakeryName)
            let n = 26
            let i = Math.floor(Game.T * 0.1)
            let originDesc = this.originDescFunc()
            if (originDesc.indexOf('<q>') >= 0) {
                originDesc = originDesc.substring(0, originDesc.indexOf('<q>'))
            }
            return `${originDesc}<q style="font-family:Courier;">${str.substr(i % str.length, n) + (i % str.length > (str.length - n) ? str.substr(0, i % str.length - (str.length - n)) : '')}</q>`
        }

        // マウス達をクリックするマウス達のフレーバーテキスト翻訳
        upgrade = Game.Upgrades['Mice clicking mice']
        upgrade.desc = betterJapanese.createSynergyUpgradeDesc(upgrade)
        upgrade.descFunc = function() {
            Math.seedrandom(Game.seed + '-blasphemouse')
            if (Math.random() < 0.3) {
                Math.seedrandom()
                return `${this.desc}<q>${loc(FindLocStringByPart(`Upgrade quote ${this.id}`))}</q>`
            }

            Math.seedrandom()
            return `${this.desc}<q>${loc('Mice clicking mice (Absolutely blasphemouse!)')}</q>`
        }

        // 富くじ演算のフレーバーテキスト翻訳
        upgrade = Game.Upgrades['Tombola computing']
        upgrade.desc = betterJapanese.createSynergyUpgradeDesc(upgrade)
        upgrade.descFunc = function() {
            Math.seedrandom(Game.seed + '-tombolacomputing')
            let str = loc(FindLocStringByPart(`Upgrade quote ${this.id}`), [
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 100),
                parseLoc(choose(loc('Tombola computing (Base)')), [
                    Math.floor(Math.random() * 5 + 2),
                    choose(loc('Tombola computing (Color)')),
                    choose(loc('Tombola computing (Living)'))
                ])
            ])
            Math.seedrandom()
            return `${this.desc}<q>${str}</q>`
        }

        // 一級品の壁紙アソートメントの説明翻訳
        Game.Upgrades['Distinguished wallpaper assortment'].desc = loc('Contains more wallpapers for your background selector.')

        // ゴールデンスイッチの説明翻訳
        let func = function() {
            if (!Game.Has('Residual luck')) return this.ddesc

            let bonus = 0
            let upgrades = Game.goldenCookieUpgrades
            for (let i in upgrades) {
                if (Game.Has(upgrades[i])) bonus++
            }

            return `<div style="text-align:center;">${Game.listTinyOwnedUpgrades(Game.goldenCookieUpgrades)}<br><br>${loc('The effective boost is <b>+%1%</b><br>thanks to %2<br>and your <b>%3</b> %4.', [Beautify(Math.round(50 + bonus * 10)), getUpgradeName('Residual luck'), bonus, loc('golden cookie upgrade', bonus)])}</div><div class="line"></div>${this.ddesc}`
        }

        Game.Upgrades['Golden switch [off]'].descFunc = func
        Game.Upgrades['Golden switch [on]'].descFunc = func

        // 猫の場合「購入済み」タグが変化することを翻訳にも反映
        betterJapanese.origins.crateTooltip = Game.crateTooltip
        Game.crateTooltip = function(me, context) {
            let tooltipText = betterJapanese.origins.crateTooltip(me, context)
            if (Game.sesame) {
                tooltipText = tooltipText.replace(/<div style="font-size:9px;">.*<\/div>/, `<div style="font-size:9px;">ID : ${me.id} | 順序 : ${Math.floor(me.order)}${me.tier ? ` | ティア : ${me.tier}` : ''}</div>`)
            }
            if (me.type == 'upgrade' && me.bought > 0 && me.pool != 'tech' && me.kitten) {
                return tooltipText.replace(`<div class="tag" style="background-color:#fff;">${loc('Purchased')}</div>`, `<div class="tag" style="background-color:#fff;">${loc('[Tag]Purrchased')}</div>`)
            }

            return tooltipText
        }

        // 英語以外でも施設固有の生産方法をツールチップに表示
        for (let i in Game.Objects) {
            let obj = Game.Objects[i]
            if (typeof (betterJapanese.origins.tooltip) === 'undefined') {
                betterJapanese.origins.tooltip = obj.tooltip
            }
            obj.actionNameJP = loc(obj.actionName)
            obj.tooltip = function() {
                const strDivDescriptionBlock = '<div class="descriptionBlock">'
                let defaultTooltip = betterJapanese.origins.tooltip.bind(this)().split(strDivDescriptionBlock)
                // Game.Object[X].tooltipのdescriptionBlockは存在しないか4つのどちらか
                if (defaultTooltip.length > 1) {
                    defaultTooltip[4] = loc('<b>%1</b> %2 so far', [loc('%1 cookie', LBeautify(this.totalCookies)), this.actionNameJP]) + '</div>'
                    return defaultTooltip.join(strDivDescriptionBlock) + '</div>'
                }
                return defaultTooltip
            }
        }

        // 英語以外でも施設固有の角砂糖によるレベルアップの恩恵を表示
        for (let i in Game.Objects) {
            let obj = Game.Objects[i]
            if (typeof (betterJapanese.origins.levelTooltip) === 'undefined') {
                betterJapanese.origins.levelTooltip = obj.levelTooltip
            }
            obj.levelTooltip = function() {
                const strDivLine = '<div class="line"></div>'
                let defaultTooltip = betterJapanese.origins.levelTooltip.bind(this)().split(strDivLine)
                defaultTooltip[1] = `${loc(this.extraName.replace('[X]', '%1'), Beautify(this.level))} ${loc('Granting <b>+%1% %2 CpS</b>.', [Beautify(this.level), this.single])}`
                return defaultTooltip.join(strDivLine)
            }
        }

        betterJapanese.origins.parseLoc = parseLoc
        parseLoc = function(str, params) {
            // 独自実装されている翻訳でコケないように修正
            if (str.constructor === Object) return ''

            // 翻訳対象の文章の末尾に%が付いている場合に消えてしまう問題を修正
            let baseStr = betterJapanese.origins.parseLoc(str, params)
            if (typeof str === 'string' && str.endsWith('%')) baseStr += '%'
            return baseStr
        }

        // ニュース欄の改善を有効化していれば置き換え
        if (betterJapanese.config.replaceNews) {
            // ニュースのフォーチュンクッキーの表示が壊れる問題を修正
            let tickerOrigin = Game.getNewTicker.toString().replace('me.name.indexOf(\'#\')', 'me.dname.indexOf(\'No.\')').replace(/me\.baseDesc/g, 'me.ddesc')
            eval(`Game.getNewTicker = ${tickerOrigin}`)

            // ニュースを英語で出力させるように
            betterJapanese.origins.getNewTicker = Game.getNewTicker
            Game.getNewTicker = function(manual) {
                let isDefaultEN = EN
                EN = true
                betterJapanese.origins.getNewTicker(manual)
                if (!isDefaultEN) EN = false
            }

            // ニュースの文章を翻訳
            betterJapanese.origins.tickerDraw = Game.TickerDraw
            Game.TickerDraw = function() {
                Game.Ticker = betterJapanese.locTicker(Game.Ticker)
                betterJapanese.origins.tickerDraw()
            }
        }

        // ミニゲームでの砂糖使用時に表示する確認ツールチップを翻訳
        betterJapanese.origins.refillLump = Game.refillLump
        Function('Game.refillLump = ' + Game.refillLump.toString().replace('\'refill\'', 'loc(\'refill\')'))()

        // イースターのエッグ解放時に表示するツールチップのアップグレード名を翻訳
        betterJapanese.origins.dropEgg = Game.DropEgg
        Function('Game.DropEgg = ' + Game.DropEgg.toString().replace(/(Game\.Notify\(loc\("You found an egg\!"\),'\<b\>'\+)drop(\+'\<\/b\>',Game\.Upgrades\[drop\]\.icon\);)/, '$1Game.Upgrades[drop].dname$2'))()

        // 転生後に表示されるツールチップを翻訳
        betterJapanese.origins.reincarnate = Game.Reincarnate
        Function('Game.Reincarnate = ' + Game.Reincarnate.toString().replace(/(Game\.Notify\()'Reincarnated'(,loc\("Hello, cookies!"\),\[10,0\],4\);)/, '$1loc("Reincarnated")$2'))()
        
        // hookを削除
        Game.removeHook('create', betterJapanese.initAfterLoad)
    },

    register: function() {
        Game.registerMod(this.name, this)
        if (!Game.ready) {
            Game.registerHook('create', betterJapanese.initAfterLoad)
            this.isRegisteredHook = true
        }
    },

    save: function() {
        localStorage.setItem('BJPConfig', JSON.stringify(this.config))
    },

    load: function() {
        let conf = localStorage.getItem('BJPConfig')
        if (conf) this.config = Object.assign(this.config, JSON.parse(conf))
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

        let openPrompt = () => {
            betterJapanese.openIgnorePrompt()
        }

        this.writeButton('toggleBJPButton', 'replaceJP', '日本語訳の改善', '日本語訳を非公式翻訳版に置き換えます。変更は再起動後に適用されます。', updateAll)
        this.writeButton('toggleNewsButton', 'replaceNews', 'ニュース欄の改善', 'ニュース欄の挙動および翻訳を置き換えます。変更は再起動後に適用されます。', updateAll)
        this.writeButton('openIgnoreWordList', null, '置き換え除外リスト', '非公式翻訳に置き換えたくない単語を指定することができます。', openPrompt)
        this.writeButton('toggleNumberJPButton', 'numberJP', '日本語単位', '数の単位に日本語単位を用います。', updateAll)
        this.writeButton('toggleShortFormatJPButton', 'shortFormatJP', '塵劫記単位', '数の単位に塵劫記の単位(阿僧祇～無量大数)を用います。', updateAll)
        this.writeButton('toggleSecondFormatJPButton', 'secondFormatJP', '第二単位', `${loc('ON')}の場合はXXXX億YYYY万、${loc('OFF')}の場合はXXXX.YYYY億のように表示されます。`, updateAll)
    },

    fixStats: function() {
        const strLegacyStarted = '<div class="listing"><b>' + loc('Legacy started:') + '</b>'
        l('menu').innerHTML = l('menu').innerHTML.replace(new RegExp(strLegacyStarted + ' (.+?), (.+?)</div>'), strLegacyStarted + ' $1、$2</div>')
    },

    writeButton: function(buttonId, targetProp = null, desc, label = null, callback = null, targetElementName = 'monospaceButton') {
        // 本家のWritePrefButtonとほぼ同じ

        // ボタンを追加する先の要素を指定 (デフォルトはmonospaceButton)
        let targetElement = l(targetElementName)

        // 仕様の都合上、最初に改行タグを追加
        targetElement.parentNode.insertBefore(document.createElement('br'), targetElement.previousElementSibling)

        // ボタンを生成
        let elementButton = document.createElement('a')
        elementButton.className = 'smallFancyButton option'
        if (targetProp) elementButton.className += ` prefButton ${this.config[targetProp] ? 'on' : 'off'}`
        elementButton.id = buttonId

        let onclickStr = targetProp ? `betterJapanese.toggleButton('${buttonId}', '${targetProp}', '${desc}');` : ''

        // Callbackが存在し、なおかつ与えられた引数がfunctionであればCallbackを追加
        if (callback && typeof callback === 'function') onclickStr += `(${callback.toString()})()`

        elementButton.setAttribute(Game.clickStr, onclickStr)

        elementButton.innerText = desc

        if (targetProp) elementButton.innerText += ` ${this.config[targetProp] ? loc('ON') : loc('OFF')}`

        targetElement.parentNode.insertBefore(elementButton, targetElement.previousElementSibling)

        // ラベルがあれば生成
        if (label) {
            let elementLabel = document.createElement('label')
            elementLabel.innerText = `(${label})`
            targetElement.parentNode.insertBefore(elementLabel, targetElement.previousElementSibling)
        }
    },

    toggleButton: function(buttonId, targetProp, desc) {
        let button = l(buttonId)
        betterJapanese.config[targetProp] = !betterJapanese.config[targetProp]
        button.className = `smallFancyButton prefButton option ${this.config[targetProp] ? 'on' : 'off'}`
        button.innerText = `${desc} ${this.config[targetProp] ? loc('ON') : loc('OFF')}`
        PlaySound('snd/tick.mp3')
    },

    addDevButton: function() {
        let element = document.createElement('div')
        element.innerHTML = '<button style="position: absolute; left: 10px; top: 10px; z-index: 9999;" type="button" onclick="betterJapanese.reloadLanguagePack()">Reload LanguageFile</button>'
        document.body.append(element)
    },

    getJSON: async function(url) {
        let res = await fetch(url).then(res => res.json()).catch((err) => {
            this.log(`An error occurred while retrieving data: ${err}`)
            return null
        })

        if (!res) return null

        return res
    },

    getAssetsData: async function() {
        // キャッシュがあればキャッシュを返す
        if (this.api.cache) return this.api.cache

        // なければ取得して定義
        this.api.cache = await this.getJSON(this.api.url.release)
        this.api.endpoints.TRANSLATE = !this.isDev ? this.api.cache?.url?.translate : this.api.url.dev + '/translate.json'
        this.api.endpoints.CATEGORY = !this.isDev ? this.api.cache?.url?.category : this.api.url.dev + '/category.json'

        return this.api.cache
    },

    checkUpdate: async function(force = false) {
        this.log('Checking updates')

        // 開発者モードがONであれば強制的に更新
        if (this.isDev) return await this.updateLanguagePack()

        // APIからアセットのデータを取得
        let data = await this.getAssetsData()

        // データが正しく取得できなかったら終了
        if (!data) return this.log('An error occurred while checking updates')

        // 更新がなかったら終了
        if (data.hash === this.config.hash && !force) return this.log('No updates available')

        return await this.updateLanguagePack()
    },

    reload: function() {
        Game.toSave = true
        Game.toReload = true
    },

    reloadLanguagePack: async function() {
        await this.checkUpdate()
        ModLanguage('JA', JSON.parse(localStorage.getItem('BJPLangPack')))
    },

    updateLanguagePack: async function() {
        let assetsData = await this.getAssetsData()

        // assetsDataが存在せず、なおかつ開発者モードではなければ終了
        if (!assetsData && !this.isDev) return null

        // TODO: apiのエンドポイント変更

        let translateJson = await this.getJSON(this.api.endpoints.TRANSLATE)
        let ignoreList = this.config.ignoreList

        for (let key of ignoreList) {
            delete translateJson[key]
        }

        translateJson[''] = {
            'language': 'JA',
            'plural-forms': 'nplurals=2;plural=(n!=1);'
        }

        localStorage.setItem('BJPLangPack', JSON.stringify(translateJson))
        this.config.hash = assetsData.hash
        this.save()

        this.log('Update successfull')

        Game.Notify('日本語訳改善Mod', '翻訳データを更新しました。<br>再読み込み後から有効になります。<br><a onclick="betterJapanese.reload()">セーブデータを保存して再読み込み</a>')
    },

    openIgnorePrompt: async function() {
        betterJapanese.tmpIgnoreList = {}

        let content = `
            <h3>非公式日本語訳 置き換え除外リスト</h3>
            <div style="display: flex;">
                <div style="width: 50%; padding: 10px;">
                    <h4>カテゴリから選択</h4>
                    <p>カテゴリから一括して単語の置き換えの除外を設定することが出来ます。</p>
                    <div id="ignorelist-category" style="height: 50vh; overflow-y: scroll; text-align: left;">読み込み中</div>
                </div>
                <div style="width: 50%; padding: 10px;">
                    <h4>単語を個別に選択</h4>
                    <p>単語の左にあるチェックボックスにチェックを付けるとその単語の置き換えを無効化します。</p>
                    <input id="ignorelist-search" type="search" placeholder="単語を検索" onchange="betterJapanese.createIgnoreWordList()">
                    <button type="button" onclick="betterJapanese.changeAllIgnoreList(true)">全選択</button>
                    <button type="button" onclick="betterJapanese.changeAllIgnoreList(false)">全解除</button>
                    <div id="ignorelist-content" style="height: 50vh; overflow-y: scroll; text-align: left;">読み込み中</div>
                </div>
            </div>
        `

        Game.Prompt(content, [['保存', 'betterJapanese.saveIgnoreList();Game.ClosePrompt();'], 'キャンセル'], null, 'ignoreList')

        document.getElementById('ignorelist-search').addEventListener('input', betterJapanese.createIgnoreWordList)
        document.getElementById('ignorelist-content').addEventListener('change', (e) => {
            if (!e.target.name || !e.target.name.startsWith('word:')) return
            let key = e.target.name.replace('word:', '').replace(/\\"/g, '"')
            betterJapanese.tmpIgnoreList[key] = e.target.checked
        })

        let checkButton = (obj, state, position) => {
            let element = document.getElementsByName(position)[0]
            element.checked = state
            if (state) element.indeterminate = false

            if (obj.constructor === Object) {
                Object.keys(obj).forEach(key => checkButton(obj[key], state, `${position}/${key}`))
                return
            }

            obj.forEach(key => {
                betterJapanese.tmpIgnoreList[key] = state
            })
        }

        document.getElementById('ignorelist-category').addEventListener('change', (e) => {
            if (!e.target.name || !e.target.name.startsWith('category:')) return
            let category = e.target.name.replace('category:', '').split('/')
            let currentPosition = betterJapanese.tmpCategoryList

            category.forEach(key => {
                currentPosition = currentPosition[key]
            })

            checkButton(currentPosition, e.target.checked, e.target.name)

            let key = e.target.name
            for (let i = 0; i < category.length - 1; i++) {
                // 一番最後のスラッシュ以降を消す
                key = key.replace(/[^\/]*$/, '')

                let elements = document.querySelectorAll(`[name^=${key.replace(/(\:|\/)/g, '\\$1')}]`)
                let parent = document.getElementsByName(key.replace(/\/$/, ''))[0]

                if (!elements) continue

                let checkState = 0
                let isContainIndeterminate = false

                elements.forEach(e => {
                    if (e.indeterminate) isContainIndeterminate = true
                    if (e.checked) checkState++
                })

                if (isContainIndeterminate) checkState = -1

                switch (checkState) {
                    case 0: {
                        parent.indeterminate = false
                        parent.checked = false
                        break
                    }

                    case elements.length: {
                        parent.indeterminate = false
                        parent.checked = true
                        break
                    }

                    default: {
                        parent.indeterminate = true
                        parent.checked = false
                        break
                    }
                }

                key = key.replace(/\/$/, '')
            }

            this.createIgnoreWordList()
        })

        betterJapanese.createIgnoreWordList()
        betterJapanese.createIgnoreCategoryList()
    },

    createIgnoreWordList: async function() {
        let searchWord = document.getElementById('ignorelist-search')?.value || ''
        let translateList = await betterJapanese.getJSON(betterJapanese.api.endpoints.TRANSLATE)
        let ignoreList = betterJapanese.processIgnoreList()
        betterJapanese.currentIgnoreList = []

        let translateListHtml = []
        for (let key of Object.keys(translateList)) {
            let value = translateList[key]
            let isChecked = ignoreList.includes(key)

            if (value.constructor === Object) continue
            if (value.constructor === Array) value = value[0]

            if (searchWord && !value.match(searchWord)) continue

            betterJapanese.currentIgnoreList.push(key)
            key = key.replace(/"/g, '\\$1')

            translateListHtml.push(`<div><label><input type="checkbox" name="word:${key}" ${isChecked ? 'checked' : ''}>${value.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '')}</label></div>`)
        }

        if (!translateListHtml.length) translateListHtml.push('<p>該当する単語が見つかりませんでした。</p>')

        document.getElementById('ignorelist-content').innerHTML = translateListHtml.join('')
    },

    createIgnoreCategoryList: async function() {
        let categoryList = await betterJapanese.getJSON(betterJapanese.api.endpoints.CATEGORY)
        betterJapanese.tmpCategoryList = categoryList
        let categoryListHtml = '<ul>'

        let createNest = (category, parent) => {
            for (let key of Object.keys(category)) {
                let value = category[key]
                let current = parent ? `${parent}/${key}` : key
                let isExistChild = value.constructor === Object

                if (isExistChild) {
                    let id = `accordion:${current}`
                    categoryListHtml += `<input type="checkbox" id="${id}" class="accordion-parent"><label for=${id}>`
                }

                categoryListHtml += `<li><label><input type="checkbox" name="category:${current}">${key}</label></li>`

                if (isExistChild) {
                    categoryListHtml += '</label><ul class="accordion-child">'
                    createNest(value, current)
                    categoryListHtml += '</ul>'
                }
            }
        }

        createNest(categoryList)
        categoryListHtml += '</ul>'

        document.getElementById('ignorelist-category').innerHTML = categoryListHtml
    },

    changeAllIgnoreList: function(state) {
        betterJapanese.currentIgnoreList.forEach(key => {
            betterJapanese.tmpIgnoreList[key] = state
        })
        betterJapanese.createIgnoreWordList()
    },

    processIgnoreList: function() {
        let array = betterJapanese.config.ignoreList.concat()

        for (let key of Object.keys(betterJapanese.tmpIgnoreList)) {
            // 変更予定リストに含まれている要素がtrueであればignoreListに追加
            if (betterJapanese.tmpIgnoreList[key]) {
                array.push(key)
                continue
            }

            // 変更予定リストに含まれている要素がfalseでなおかつignoreListに追加されていればignoreListから削除
            if (array.includes(key)) {
                array.splice(array.indexOf(key), 1)
            }
        }

        return array
    },

    saveIgnoreList: function() {
        betterJapanese.config.ignoreList = betterJapanese.processIgnoreList()
        betterJapanese.checkUpdate(true)
        // Game.Notify('日本語訳改善Mod', '置き換え除外リストを保存しました。<br>再読み込み後から有効になります。<br><a onclick="betterJapanese.reload()">セーブデータを保存して再読み込み</a>')
    },

    formatEveryFourthPower: function() {
        // 接尾辞挿入の4桁区切り版、secondで第二単位の使用を指定
        return function(value) {
            let prefixes = betterJapanese.config.shortFormatJP ? betterJapanese.formats.short : betterJapanese.formats.prefix
            let suffixes = betterJapanese.config.shortFormatJP ? [''] : betterJapanese.formats.suffixes
            let second = betterJapanese.config.secondFormatJP

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

            // 第二単位を付ける
            if (second) {
                if (!preIndex && !sufIndex) return value

                let str = Math.floor(dispNum / 10000) + (preIndex ? prefixes[preIndex] : suffixes[sufIndex])
                if (dispNum % 10000) str += (dispNum % 10000) + prefixes[preIndex ? preIndex - 1 : prefixes.length - 1]
                str += suffixes[preIndex ? sufIndex : sufIndex - 1]

                return str !== 'NaN' ? str : value.toPrecision(3).toString()

            }

            // 第二単位を付けない
            return Math.round(value * 10000 / (10 ** (numeral * 4))) / 10000 + prefixes[preIndex] + suffixes[sufIndex]
        }
    },

    createSynergyUpgradeDesc: function(upgrade) {
        return `${loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(upgrade.buildingTie1.plural), 5, upgrade.buildingTie2.single])}<br>${loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(upgrade.buildingTie2.plural), 0.1, upgrade.buildingTie1.single])}`
    },

    locTicker: function(tickerText) {
        let baseTickerText = tickerText
        let newsFormat = loc('News :').replace(' ', '&nbsp;')
        let newsRegex = new RegExp(`N.*ws : |${newsFormat} `)
        let isStartWithHtmlTag = tickerText.startsWith('<')
        let isContainsNewsText = tickerText.match(newsRegex)

        // "News : "があれば除去
        let ticker = isContainsNewsText ? tickerText.replace(newsRegex, '') : tickerText

        // htmlタグが含まれている場合はタグを除去
        if (isStartWithHtmlTag) ticker = ticker.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '')

        // 翻訳
        let localizedStr = betterJapanese.replaceString(ticker)

        // 先程削除したNewsを追加 (含んでいなければ何もしない)
        if (isContainsNewsText) localizedStr = `${newsFormat} ${localizedStr}`

        // htmlタグが含まれている場合はタグを追加
        if (isStartWithHtmlTag) localizedStr = baseTickerText.replace(ticker, localizedStr)

        return localizedStr
    },

    replaceString(str) {
        // locStringsから探して見つかれば返す
        let staticLocStr = locStrings[str]
        if (staticLocStr) return staticLocStr

        // 動的なニュース(Ticker (Dynamic))のリストが読み込めていなければそのまま返す
        let dynamicLocList = locStrings['Ticker (Dynamic)']
        if (!dynamicLocList) return str

        // 動的ニュースリストから対象のニュースを探す
        let targetStr = Object.keys(dynamicLocList).find((text) => {
            // エスケープが必要な文字をエスケープしてから動的な部分 (%1や%2など) を置き換え
            return betterJapanese.getReplacedRegex(text).test(str)
        })

        if (!targetStr) {
            betterJapanese.log(`翻訳が見つかりませんでした。\nString: ${str}`)
            return str
        }

        let dynamicLocStr = dynamicLocList[targetStr]

        // 置き換える単語を取得
        let strParams = betterJapanese.getReplacedRegex(targetStr).exec(str)

        // 置き換え
        for (let i = 0; i < strParams.length - 1; i++) {
            dynamicLocStr = dynamicLocStr.replace(`%${i + 1}`, betterJapanese.replaceString(strParams[i + 1]))
        }

        return dynamicLocStr
    },

    getReplacedRegex: function(str, splitRegex = /%\d+/g) {
        let regex = str.replace(/(\\|\*|\+|\.|\?|\{|\}|\(|\)|\^|\$|\|)/g, '\\$1')
        if (str.match('%1 %2')) regex = regex.replace('%1', '(.*?)')
        regex = regex.replace(splitRegex, '(.*)')

        return new RegExp(regex, 'g')
    },

    devCheck: function(isDev = false) {
        if (betterJapanese.initialized) return

        betterJapanese.isDev = betterJapanese.isDev || isDev
        betterJapanese.checkUpdate()
        betterJapanese.log(`DevMode: ${betterJapanese.isDev}`)
        if (betterJapanese.isDev) betterJapanese.addDevButton()
        clearTimeout(betterJapanese.fallbackTimer)
        betterJapanese.initialized = true
    }
}

if (App) {
    window.api.receive('fromMain', (msg) => {
        if (msg.id === 'greenworks loaded') {
            betterJapanese.devCheck(!!msg.data.DEV)
        }
    })
} else {
    betterJapanese.devCheck(false)
}

betterJapanese.register()
