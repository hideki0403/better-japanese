const betterJapanese = {
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
    isRegisteredHook: false,

    init: function() {
        this.load()

        this.fallbackTimer = setTimeout(() => {
            this.checkUpdate()
            this.initialized = true
        }, 5000)

        if (App) send({ id: 'init bridge' })

        if (!this.isRegisteredHook) this.initAfterLoad()
        if (!App && Game.ready) this.initAfterDOMCreated()

        this.log('Initialized')
    },

    initAfterLoad: async function() {
        // メニューに独自ボタンを実装
        // この方法で実装しないとCCSEなどのメニュー独自実装Modと競合してしまう
        let origin = eval('Game.UpdateMenu.toString()').split('\n')
        origin.splice(origin.length - 1, 0, `
            if (Game.onMenu == 'prefs') {
                betterJapanese.injectMenu()
            } else if (Game.onMenu == 'stats') {
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

        // 背景の名前を翻訳
        for (let i = 1; i < Game.AllBGs.length; i++) {
            Game.AllBGs[i].enName = Game.AllBGs[i].name
            Game.AllBGs[i].name = loc(Game.AllBGs[i].enName)
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
        `

        document.head.appendChild(customStyle)

        // 在庫市場のquoteを実装
        while (!Game.Objects['Bank'].hasOwnProperty('minigame')) await new Promise(resolve => setTimeout(resolve, 1000))
        if (typeof(betterJapanese.origins.goodTooltip) === 'undefined') {
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
        while (typeof(logIndex = FindLocStringByPart(`Update notes ${logId}`)) === 'string' && typeof(logResult = loc(logIndex)) === 'object' && logResult.length > 1) {
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
            if(originDesc.indexOf('<q>') >= 0) {
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
        upgrade = Game.Upgrades['Distinguished wallpaper assortment'].desc = loc('Contains more wallpapers for your background selector.')

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
            if(Game.sesame) {
                tooltipText = tooltipText.replace(/<div style="font-size:9px;">.*<\/div>/, `<div style="font-size:9px;">ID : ${me.id} | 順序 : ${Math.floor(me.order)}${me.tier ? ` | ティア : ${me.tier}` : ''}</div>`)
            }
            if(me.type == 'upgrade' && me.bought > 0 && me.pool != 'tech' && me.kitten) {
                return tooltipText.replace(`<div class="tag" style="background-color:#fff;">${loc('Purchased')}</div>`, `<div class="tag" style="background-color:#fff;">${loc('[Tag]Purrchased')}</div>`)
            }
            
            return tooltipText
        }

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

        betterJapanese.origins.parseLoc = parseLoc
        parseLoc = function(str, params) {
            // 独自実装されている翻訳でコケないように修正
            if (str.constructor === Object) return ''

            // 翻訳対象の文章の末尾に%が付いている場合に消えてしまう問題を修正
            let baseStr = betterJapanese.origins.parseLoc(str, params)
            if (typeof str === 'string' && str.endsWith('%')) baseStr += '%'
            return baseStr
        }

        // hookを削除
        Game.removeHook('create', betterJapanese.initAfterLoad)
    },

    initAfterDOMCreated: function() {
        let funcInitString = Game.Init.toString().replaceAll(/[\r\n\t]/g, '')
        // ベーカリー名欄
        Game.bakeryNameL.textContent = loc('%1\'s bakery', Game.bakeryName)
        // プロトコル切り替え欄
        Game.attachTooltip(
                l('httpsSwitch'),
                `<div style="padding:8px;width:350px;text-align:center;font-size:11px;">${loc('You are currently playing Cookie Clicker on the <b>%1</b> protocol.<br>The <b>%2</b> version uses a different save slot than this one.<br>Click this lock to reload the page and switch to the <b>%2</b> version!', [(Game.https ? 'HTTPS' : 'HTTP'), (Game.https ? 'HTTP' : 'HTTPS')])}</div>`,
                'this'
            )
        // チャレンジモード名、概要
        let ascensionModeDescsEN = []
        for (let obj of funcInitString.match(/Game\.ascensionModes=\{.+?\};/)[0].matchAll(/desc:loc\("(.+?)"\)/g)) {
            ascensionModeDescsEN.push(obj[1].replaceAll('\\"', '"'))
        }
        for (let am in Game.ascensionModes) {
            Game.ascensionModes[am].dname = loc(Game.ascensionModes[am].name + ' [ascension type]')
            Game.ascensionModes[am].desc = loc(ascensionModeDescsEN[am])
        }
        // 昇天画面上部メニュー
        l('ascendButton').outerHTML = `<a id="ascendButton" class="option framed large red" ${Game.getTooltip(`<div style="min-width:300px;text-align:center;font-size:11px;padding:8px;" id="tooltipReincarnate">${loc('Click this once you\'ve bought<br>everything you need!')}</div>`, 'bottom-right')} style="font-size:16px;margin-top:0px;"><span class="fancyText" style="font-size:20px;">${loc('Reincarnate')}</span></a>`
        l('ascendInfo').getElementsByClassName('ascendData')[0].innerHTML = loc('You are ascending.<br>Drag the screen around<br>or use arrow keys!<br>When you\'re ready,<br>click Reincarnate.')
        Game.UpdateAscensionModePrompt()
        // 設定画面オンオフ
        ON = ' ' + loc('ON')
        OFF = ' ' + loc('OFF')
        // 施設非表示欄
        for (let pm of document.getElementsByClassName('productMute')) {
            let id = pm.id.split('productMute')[1]
            pm.outerHTML = `<div class="productButton productMute" ${Game.getTooltip(`<div style="width:150px;text-align:center;font-size:11px;" id="tooltipMuteBuilding"><b>${loc('Mute')}</b><br>(${loc('Minimize this building')})</div>`, 'this')} onclick="Game.ObjectsById[${id}].mute(1);PlaySound(Game.ObjectsById[${id}].muted?\'snd/clickOff2.mp3\':\'snd/clickOn2.mp3\');" id="productMute${id}">${loc('Mute')}</div>`
        }
        l('buildingsMute').children[0].innerHTML = loc('Muted:')
        // ミニゲーム名
        Game.Objects['Farm'].minigameName = loc('Garden')
        Game.Objects['Factory'].minigameName = loc('Dungeon')
        Game.Objects['Bank'].minigameName = loc('Stock Market')
        Game.Objects['Temple'].minigameName = loc('Pantheon')
        Game.Objects['Wizard tower'].minigameName = loc('Grimoire')
        // 施設名、概要、ビジネスシーズン時の施設名、概要
        for (let i in Game.Objects) {
            Game.Objects[i].dname = loc(Game.Objects[i].name)
            Game.Objects[i].single = Game.Objects[i].dname
            Game.Objects[i].plural = Game.Objects[i].dname
            Game.Objects[i].desc = loc(FindLocStringByPart(Game.Objects[i].name + ' quote'))
            Game.foolObjects[i].name = loc(FindLocStringByPart(Game.Objects[i].name + ' business name')) || Game.foolObjects[i].name
            Game.foolObjects[i].desc = loc(FindLocStringByPart(Game.Objects[i].name + ' business quote')) || Game.foolObjects[i].desc
        }
        Game.foolObjects['Unknown'].name = loc('Investment')
        Game.foolObjects['Unknown'].desc = loc('You\'re not sure what this does, you just know it means profit.')
        // アップグレード名、実績名
        LocalizeUpgradesAndAchievs()
        // バフ名
        for (let bf in Game.buffs) {
            Game.buffs[bf].dname = loc(Game.buffs[bf].name)
        }
        // サンタレベル名
        let santaLevelsEN = Game.Init.toString().match(/Game\.santaLevels=\['(.+?)'\];/)[1].split('\',\'')
        for (let sl in santaLevelsEN) {
            Game.santaLevels[sl] = loc(santaLevelsEN[sl])
        }
        // ドラゴンオーラ名、概要
        let dragonAuraDescsEN = []
        for (let obj of funcInitString.match(/Game\.dragonAuras=\{.+?\};/)[0].matchAll(/desc:loc\((.+?)\)/g)) {
            let res = null
            if (obj[1][0] == '"' && obj[1][obj[1].length - 1] == '"') {
                dragonAuraDescsEN.push(loc(obj[1].substring(1, obj[1].length - 1)))
            } else if ((res = obj[1].match(/"(.+?)",(\d+?)/)) != null) {
                dragonAuraDescsEN.push(loc(res[1], Number(res[2])))
            } else if ((res = obj[1].match(/"(.+?)",\[(\d+?),(\d+?)]/)) != null) {
                dragonAuraDescsEN.push(loc(res[1], [Number(res[2]), Number(res[3])]))
            }
        }
        for (let dl in Game.dragonAuras) {
            Game.dragonAuras[dl].dname = loc(Game.dragonAuras[dl].name)
            Game.dragonAuras[dl].desc = loc(dragonAuraDescsEN[dl])
        }
        // ドラゴンレベル概要
        let dragonLevelNamesEN = []
        for (let obj of funcInitString.match(/Game\.dragonLevels=\[.+?\];/)[0].matchAll(/name:'(.+?)'/g)) {
            dragonLevelNamesEN.push(obj[1])
        }
        for (let i = 0; i < Game.dragonLevels.length; i++) {
            let it = Game.dragonLevels[i]
            it.name = loc(dragonLevelNamesEN[i])
            if (i < 3) {
                it.action = loc('Chip it')
            } else if (i == 3) {
                it.action = loc('Hatch it')
            } else if (i < Game.dragonLevels.length - 3) {
                it.action = `${loc('Train %1', Game.dragonAuras[i - 3].dname)}<br><small>${loc('Aura: %1', Game.dragonAuras[i - 3].desc)}</small>`
            } else if (i == Game.dragonLevels.length - 3) {
                it.action = `${loc('Bake dragon cookie')}<br><small>${loc('elicious!')}</small>`
            } else if (i == Game.dragonLevels.length - 2) {
                it.action = `${loc('Train secondary aura')}<br><small>${loc('Lets you use two dragon auras simultaneously')}</small>`
            } else if (i == Game.dragonLevels.length - 1) {
                it.action = loc('Your dragon is fully trained.')
            }
        }
        // ミルク名
        for (let ml in Game.AllMilks) {
            Game.AllMilks[ml].name = loc(Game.AllMilks[ml].bname)
        }
        // 中央メニュー欄各種ボタン
        l('prefsButton').firstChild.innerHTML = loc('Options')
        l('statsButton').firstChild.innerHTML = loc('Stats')
        l('logButton').firstChild.innerHTML = loc('Info')
        l('legacyButton').firstChild.innerHTML = loc('Legacy')
        Game.adaptWidth = function(node) {
            let el = node.firstChild
            el.style.padding = ''
            let width = el.clientWidth / 95
            if (width > 1) {
                el.style.fontSize = (parseInt(window.getComputedStyle(el).fontSize) * 1 / width) + 'px'
                el.style.transform = `scale(1,${width})`
            }
        }
        Game.adaptWidth(l('prefsButton'))
        Game.adaptWidth(l('legacyButton'))
        // 更新時「情報」ボタン上通知
        l('checkForUpdate').childNodes[0].textContent = loc('New update!')
        // 右メニュー欄
        l('buildingsTitle').childNodes[0].textContent = loc('Buildings')
        l('storeTitle').childNodes[0].textContent = loc('Store')
        // アップグレード、実績用の汎用概要文取得関数
        let strCookieProductionMultiplierPlus = loc('Cookie production multiplier <b>+%1%</b>.', '[x]')
		let getStrCookieProductionMultiplierPlus = function(x) {
            return strCookieProductionMultiplierPlus.replace('[x]', x)
        }
		let getStrThousandFingersGain = function(x) {
            return loc('Multiplies the gain from %1 by <b>%2</b>.', [getUpgradeName('Thousand fingers'), x])
        }
		let strKittenDesc = loc('You gain <b>more CpS</b> the more milk you have.')
		let getStrClickingGains = function(x) {
            return loc('Clicking gains <b>+%1% of your CpS</b>.', x)
        }
        // クッキー系アップグレード概要
        for (let result of funcInitString.matchAll(/Game\.NewUpgradeCookie\(.*?name:'(.+?)(?<!\\)',/g)) {
            let name = result[1].replaceAll('\\\'', '\'')
            let obj = Game.Upgrades[name]
            let pow = typeof(obj.power) === 'function' ? obj.power(obj) : obj.power
            obj.ddesc = loc('Cookie production multiplier <b>+%1%</b>.', pow)
        }
        // シナジー系アップグレード概要
        for (let result of funcInitString.matchAll(/(?<!\/\/)Game\.SynergyUpgrade\('(.+?)(?<!\\)',/g)) {
            let name = result[1].replaceAll('\\\'', '\'')
            let obj = Game.Upgrades[name]
            obj.ddesc = loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(obj.buildingTie1.plural), 5, obj.buildingTie2.single]) + '<br>' + loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(obj.buildingTie2.plural), 0.1, obj.buildingTie1.single])
        }
        // ティアありアップグレード概要
        for (let result of funcInitString.matchAll(/(?<!\/\/)Game.TieredUpgrade\('(.+?)(?<!\\)','(<q>.+?<\/q>)?(?<!\\)',.+?,('fortune'|(?:\d+?))\)/g)) {
            let name = result[1].replaceAll('\\\'', '\'')
            let obj = Game.Upgrades[name]
            if (result[3] === '\'fortune\'') {
                obj.ddesc = loc('%1 are <b>%2%</b> more efficient and <b>%3%</b> cheaper.', [cap(obj.buildingTie1.plural), 7, 7])
            } else {
                obj.ddesc = loc('%1 are <b>twice</b> as efficient.', cap(obj.buildingTie1.plural))
            }
        }
        // 施設別抑制解除系アップグレード概要
        for (let result of funcInitString.matchAll(/(?<!\/\/)Game\.NewUnshackleBuilding\({building:'(.+?)(?<!\\)',/g)) {
            let name = result[1].replaceAll('\\\'', '\'')
            let building = Game.Objects[name]
            let obj = Game.Upgrades['Unshackled ' + building.bplural]
            if (name === 'Cursor') {
                obj.ddesc = getStrThousandFingersGain(25)
            } else {
                obj.ddesc = loc('Tiered upgrades for <b>%1</b> provide an extra <b>+%2%</b> production.<br>Only works with unshackled upgrade tiers.', [cap(building.plural), Math.round((building.id == 1 ? 0.5 : (20 - building.id) * 0.1) * 100)])
            }
        }
        // ティア別抑制解除系アップグレード概要
        for (let result of funcInitString.matchAll(/(?<!\/\/)Game\.NewUnshackleUpgradeTier\({tier:(\d+?),/g)) {
            let tier = Number(result[1])
            let obj
            if (tier == 1) {
                obj = Game.Upgrades['Unshackled flavor']
            } else {
                obj = Game.Upgrades['Unshackled ' + Game.Tiers[tier].name.toLowerCase()]
            }
            tier = Game.Tiers[tier]
            obj.ddesc = loc('Unshackles all <b>%1-tier upgrades</b>, making them more powerful.<br>Only applies to unshackled buildings.', cap(loc('[Tier]' + tier.name, 0, tier.name)))
        }
        // グランマシナジー系アップグレード概要
        for (let result of funcInitString.matchAll(/(?<!\/\/)Game\.GrandmaSynergy\('(.+?)(?<!\\)',/g)) {
            let obj = Game.Upgrades[result[1].replaceAll('\\\'', '\'')]
            obj.ddesc = loc('%1 are <b>twice</b> as efficient.', cap(Game.Objects['Grandma'].plural)) + ' ' + loc('%1 gain <b>+%2%</b> CpS per %3.', [cap(obj.buildingTie.plural), 1, loc('%1 grandma', LBeautify(obj.buildingTie.id - 1))])
        }
        let angelUpgrades = ['Angels', 'Archangels', 'Virtues', 'Dominions', 'Cherubim', 'Seraphim', 'God']// 天使系アップグレード
        let demonUpgrades = ['Belphegor', 'Mammon', 'Abaddon', 'Satan', 'Asmodeus', 'Beelzebub', 'Lucifer']// 悪魔系アップグレード
        // その他アップグレード概要
        for (let result of funcInitString.matchAll(/(?<!\/\/|=)new Game\.Upgrade\('(.+?)(?<!\\)',(.+?)(?<!\([^,\)]+?),((?:[^,]|(?:(?<=\([^\)]+?),(?=[^\(]+?\))))+)(?<!\([^,\)]+?),(?:\[\d+?,\d+?\]|Game.GetIcon\(.+?\))(?:,function\(\){.+?})?\);/g)) {
            let obj = Game.Upgrades[result[1].replaceAll('\\\'', '\'')]
            if (obj.name.indexOf('Permanent upgrade slot ') == 0) {
                obj.ddesc = loc('Placing an upgrade in this slot will make its effects <b>permanent</b> across all playthroughs.')
            } else if(angelUpgrades.includes(obj.name)) {
                let match = result[2].match(/desc\((\d+?),(\d+?)\)/)
                obj.ddesc = loc('You gain another <b>+%1%</b> of your regular CpS while the game is closed, for a total of <b>%2%</b>.', [Number(match[1]), Number(match[2])])
            } else if(demonUpgrades.includes(obj.name)) {
                let match = result[2].match(/desc\((\d+?)\)/)
                obj.ddesc = loc('You retain optimal cookie production while the game is closed for twice as long, for a total of <b>%1</b>.', Game.sayTime(Number(match[1]) * 60 * 60 * Game.fps, -1))
            } else {
                obj.ddesc = eval(result[2])
            }
        }
        // アップグレードフレーバーテキスト
        for (let upg in Game.Upgrades) {
            let obj = Game.Upgrades[upg]
            let quote = loc(FindLocStringByPart('Upgrade quote ' + obj.id))
            if (typeof(quote) !== 'undefined') {
                let qpos = obj.ddesc.indexOf('<q>')
                if (qpos >= 0) {
                    obj.ddesc = obj.ddesc.substring(0, qpos)
                }
                obj.ddesc += `<q>${quote}</q>`
            }
        }
        // ティアあり実績概要
        for (let result of funcInitString.matchAll(/Game.TieredAchievement\('(.+?)(?<!\\)',/g)) {
            let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
            obj.baseDesc = loc('Have <b>%1</b>.', loc('%1 ' + obj.buildingTie.bsingle, LBeautify(Game.Tiers[obj.tier].achievUnlock)))
        }
        // 施設別生産量実績概要
        for (let result of funcInitString.matchAll(/Game.ProductionAchievement\('(.+?)(?<!\\)','(.+?)',(\d+?)(?:,(\d+?),(\d+?))?\);/g)) {
            let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
			let building = Game.Objects[result[2].replaceAll('\\\'', '\'')]
			let n = 12 + building.n + (typeof(result[5]) === 'undefined' ? 0 : Number(result[5])) + 7 * (Number(result[3]) - 1)
			let pow = Math.pow(10, n)
			obj.baseDesc = loc('Make <b>%1</b> just from %2.', [loc('%1 cookie', {n: pow, b: toFixed(pow)}), building.plural])
        }
        // 全体生産量実績概要
        for (let result of funcInitString.matchAll(/Game.BankAchievement\('(.+?)(?<!\\)'/g)) {
            let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
            obj.baseDesc = loc('Bake <b>%1</b> in one ascension.', loc('%1 cookie', {n: obj.threshold, b: toFixed(obj.threshold)}))
        }
        // CpS実績概要
        for (let result of funcInitString.matchAll(/Game.CpsAchievement\(('.+?(?<!\\)')(?:,'.+?')?\);/g)) {
            let name = eval(result[1].replaceAll(/Beautify\((.+?)\)/g, 'formatEveryThirdPower(formatLong)($1)')).replaceAll('\\\'', '\'')
            let obj = Game.Achievements[name]
            obj.baseDesc = loc('Bake <b>%1</b> per second.', loc('%1 cookie', {n: obj.threshold, b: toFixed(obj.threshold)}))
        }
        // その他実績概要
        for (let result of funcInitString.matchAll(/new Game.Achievement\('(.+?)(?<!\\)',(.+?),\[\d+?,\d+?\]\);/g)) {
            let obj = Game.Achievements[result[1].replaceAll('\\\'', '\'')]
            obj.baseDesc = eval(result[2])
        }
        // 施設レベル実績概要
		for (let i in Game.Objects)	{
			if (Game.Objects[i].levelAchiev10) {
                Game.Objects[i].levelAchiev10.baseDesc = loc('Reach level <b>%1</b> %2.', [10, Game.Objects[i].plural])
                Game.Objects[i].levelAchiev10.desc = Game.Objects[i].levelAchiev10.baseDesc
            }
		}
        // 実績フレーバーテキスト
        for (let acv in Game.Achievements) {
            let obj = Game.Achievements[acv]
			obj.ddesc = BeautifyInText(obj.baseDesc)
            let quote = loc(FindLocStringByPart('Achievement quote ' + obj.id))
            if (typeof(quote) !== 'undefined') {
                let qpos = obj.ddesc.indexOf('<q>')
                if (qpos >= 0) {
                    obj.ddesc = obj.ddesc.substring(0, qpos)
                }
                obj.ddesc += `<q>${quote}</q>`
            }
        }
        Game.RebuildUpgrades()
        Game.BuildStore()
        
        // トップバー
        Game.attachTooltip(
            l('topbarOrteil'),
            '<div style="padding:8px;width:250px;text-align:center;">Orteilのサブドメインに戻るよ!<br>他のゲームがたくさんあるよ!</div>',
            'this'
        )
        Game.attachTooltip(
            l('topbarDashnet'),
            '<div style="padding:8px;width:250px;text-align:center;">私たちのホームページに戻るよ!</div>',
            'this'
        )
        Game.attachTooltip(
            l('topbarTwitter'),
            '<div style="padding:8px;width:250px;text-align:center;">ゲームの更新をたまに告知する、Orteilのtwitterだよ。</div>',
            'this'
        )
        Game.attachTooltip(
            l('topbarTumblr'),
            '<div style="padding:8px;width:250px;text-align:center;">ゲームの更新をたまに告知する、Orteilのtumblrだよ。</div>',
            'this'
        )
        Game.attachTooltip(
            l('topbarDiscord'),
            '<div style="padding:8px;width:250px;text-align:center;">私たちの公式Discordサーバーだよ。<br>CookieClickerや他のゲームの質問や小技を共有できるよ!</div>',
            'this'
        )
        l('topbarMerch').innerHTML = '買ってね!'
        Game.attachTooltip(
            l('topbarMerch'),
            '<div style="padding:8px;width:250px;text-align:center;">CookieClickerシャツ、フード、ステッカーが!</div>',
            'this'
        )
        Game.attachTooltip(
            l('topbarPatreon'),
            '<div style="padding:8px;width:250px;text-align:center;">Patreonで支援してCookieClickerの更新を援助してね!<br>パトロンには素敵なご褒美も!</div>',
            'this'
        )
        l('topbarMobileCC').innerHTML = 'Android版CookieClicker'
        Game.attachTooltip(
            l('topbarMobileCC'),
            '<div style="padding:8px;width:250px;text-align:center;">スマホでCookieClickerを遊ぼう!<br>(Androidだけです。iOSバージョンは後ほど)</div>',
            'this'
        )
        l('topbarSteamCC').innerHTML = 'Steam版CookieClicker'
        Game.attachTooltip(
            l('topbarSteamCC'),
            '<div style="padding:8px;width:250px;text-align:center;">Steam上でCookieClickerを入手しよう!<br>音楽はC418さんが監修。</div>',
            'this'
        )
        Game.attachTooltip(
            l('topbarRandomgen'),
            '<div style="padding:8px;width:250px;text-align:center;">ランダム生成機で何か書けるように作ったよ。</div>',
            'this'
        )
        Game.attachTooltip(
            l('topbarIGM'),
            '<div style="padding:8px;width:250px;text-align:center;">シンプルなスクリプト言語でオリジナル放置ゲームを作れるように作ったよ。</div>',
            'this'
        )
        l('linkVersionBeta').innerHTML = 'ベータテストに参加!'
        l('links').children[0].children[2].innerHTML = 'クラシック'
        // 右メニュー広告欄
        l('smallSupport').children[4].innerHTML = '^ スポンサードリンク ^'
        l('support').children[0].innerHTML = 'v スポンサードリンク v'
        'Cookie Clickerは主に広告によって支えられています。<br>このサイトをブロックしないよう考えていただくか<a href="https://www.patreon.com/dashnet" target="_blank">Patreon</a>を確認してください!'
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
        // this.writeButton('openIgnoreWordList', null, '置き換え除外リスト', '非公式翻訳に置き換えたくない単語を指定することができます。', betterJapanese.openIgnorePrompt)
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

    checkUpdate: async function() {
        this.log('Checking updates')

        if (this.isDev) return await this.updateLanguagePack(this.apiUrl.dev)
        let res = await fetch(this.apiUrl.release).then(res => res.json()).catch((err) => {
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
        let base = {
            '': {
                'language': 'JA',
                'plural-forms': 'nplurals=2;plural=(n!=1);'
            },
        }

        try {
            let lang = await fetch(url).then(res => res.json())
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

    openIgnorePrompt: function() {
        Game.Prompt('非公式翻訳の置き換え除外リスト', ['保存', 'キャンセル'])
    },

    locTicker: function(tickerText) {
        let baseTickerText = tickerText
        let isContainsHtmlTag = tickerText.startsWith('<')

        // 文頭の"News : "を除去
        let ticker = tickerText.replace('News : ', '')

        // htmlタグが含まれている場合はタグを除去
        if (isContainsHtmlTag) ticker = ticker.replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '')

        // 静的なニュースであればlocStringsから探して返す
        let staticLocStr = locStrings[ticker]
        if (staticLocStr) return !isContainsHtmlTag ? staticLocStr : baseTickerText.replace(ticker, staticLocStr)

        // 動的なニュース(Ticker (Dynamic))のリストが読み込めていなければそのまま返す
        let dynamicTickerList = locStrings['Ticker (Dynamic)']
        if (!dynamicTickerList) return tickerText

        // 動的ニュースリストから対象のニュースを探す
        let targetTicker = Object.keys(dynamicTickerList).find((text) => {
            // エスケープが必要な文字をエスケープしてから動的な部分 (%1や%2など) を置き換え
            return betterJapanese.getReplacedRegex(text).test(ticker)
        })

        if (!targetTicker) return tickerText

        let localizedStr = dynamicTickerList[targetTicker]

        // 置き換える単語を取得
        let tickerParams = betterJapanese.getReplacedRegex(targetTicker).exec(ticker)

        // 置き換え
        for (let i = 0; i < tickerParams.length - 1; i++) {
            localizedStr = localizedStr.replace(`%${i + 1}`, loc(tickerParams[i + 1]))
        }

        return !isContainsHtmlTag ? localizedStr : baseTickerText.replace(ticker, localizedStr)
    },

    getReplacedRegex: function(str, splitRegex = /%\d+/g) {
        return new RegExp(str.replace(/(\\|\*|\+|\.|\?|\{|\}|\(|\)|\^|\$|\|)/g, '\\$1').replace(splitRegex, '(.*)'), 'g')
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
