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
    isDev: true,
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
        betterJapanese.origins.sayTime = Game.sayTime
        betterJapanese.origins.beautify = Beautify
        betterJapanese.origins.parseLoc = parseLoc

        // 翻訳対象の文章の末尾に%が付いている場合に消えてしまう問題を修正
        parseLoc = function(str, params) {
            let baseStr = betterJapanese.origins.parseLoc(str, params)
            if (typeof str === 'string' && str.endsWith('%')) baseStr += '%'
            return baseStr
        }

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

        // 更新履歴の翻訳
        let logUpdates = ''
        let logPerUpdate = ''
        let logIndex = ''
        let logResult = []
        let logId = 0
        while (typeof (logIndex = FindLocStringByPart(`Update notes ${logId}`)) === 'string' && typeof (logResult = loc(logIndex)) === 'object' && logResult.length > 1) {
            logPerUpdate = `<div class="subsection update${logIndex === `[Update notes ${logId}]small` ? ' small' : ''}">`
            logPerUpdate += `<div class="title">${logResult[0]}</div>`
            logResult.shift()
            for (let str of logResult) {
                if(str.indexOf('[Update Log General Names]') >= 0) {
                    str = str.replaceAll('[Update Log General Names]', choose(loc('[Update Log General Names]')))
                }
                logPerUpdate += `<div class="listing">${str}</div>`
            }
            logUpdates = `${logPerUpdate}</div>${logUpdates}`
            logId++
        }
        if(logUpdates.length > 0) {
            betterJapanese.origins.updateLog = Game.updateLog
            Game.updateLog = Game.updateLog.substring(0, Game.updateLog.search(/<div class="subsection update(?: small)?">/))
            Game.updateLog = Game.updateLog.substring(0, Game.updateLog.lastIndexOf('<div class="listing" style="font-weight:bold;font-style:italic;opacity:0.5;">'))
            Game.updateLog += `</div>${logUpdates}</div>`
        }

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
        upgrade = Game.Upgrades['Distinguished wallpaper assortment']
        upgrade.desc = loc('Contains more wallpapers for your background selector.')

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

        if (typeof(betterJapanese.origins.getNewTicker) === 'undefined') betterJapanese.origins.getNewTicker = Game.getNewTicker
        Game.getNewTicker = function(manual) {
            let animals = loc('TickerList (Animal)')
			let list = []
			let NEWS = loc('News :').replace(' ', '&nbsp;') + ' '
			let loreProgress = Math.round(Math.log(Game.cookiesEarned / 10) * Math.LOG10E + 1 | 0)
			if (Game.TickerN % 2 == 0 || loreProgress > 14) {				
				if (Math.random() < 0.75 || Game.cookiesEarned < 10000) {
					if (Game.Objects['Grandma'].amount > 0) {
                        list.push(`<q>${choose(loc('Ticker (grandma)'))}</q><sig>${Game.Objects['Grandma'].single}</sig>`)
                    }
					if (!Game.prefs.notScary && Game.Objects['Grandma'].amount >= 50) {
                        list.push(`<q>${choose(loc('Ticker (threatening grandma)'))}</q><sig>${Game.Objects['Grandma'].single}</sig>`)
                    }
					if (Game.HasAchiev('Just wrong') && Math.random() < 0.05) {
                        list.push(NEWS + loc('cookie manufacturer downsizes, sells own grandmother!'))
                    }
					if (!Game.prefs.notScary && Game.HasAchiev('Just wrong') && Math.random() < 0.4) {
                        list.push(`<q>${choose(loc('Ticker (angry grandma)'))}</q><sig>${Game.Objects['Grandma'].single}</sig>`)
                    }
					if (!Game.prefs.notScary && Game.Objects['Grandma'].amount >= 1 && Game.pledges > 0 && Game.elderWrath == 0) {
                        list.push(`<q>${choose(loc('Ticker (grandmas return)'))}</q><sig>${Game.Objects['Grandma'].single}</sig>`)
                    }
					for (let i in Game.Objects) {
						if (i != 'Cursor' && i != 'Grandma' && i != 'Mine' && i != 'Temple' && i != 'Wizard tower' && Game.Objects[i].amount > 0) {
                            list.push(NEWS + choose(loc('Ticker (' + i + ')')))
                        }
					}
					if (Game.Objects['Mine'].amount > 0) {
                        list.push(choose([
                            ...loc('Ticker (Mine)'),
                            loc('%1 miners trapped in collapsed chocolate mine!', Math.floor(Math.random() * 1000 + 2))
					    ]))
                    }
					if (Game.Objects['Temple'].amount > 0) {
                        list.push(NEWS + choose([
                            ...loc('Ticker (Temple)'),
					        loc('explorers bring back ancient artifact from abandoned temple; archeologists marvel at the centuries-old %1 %2!', [
                                choose(loc('TickerList (Temple1)')),
                                choose(loc('TickerList (Temple2)'))
                            ]),
					        loc('just how extensive is the cookie pantheon? Theologians speculate about possible %1 of %2.', [
                                choose(loc('TickerList (Temple3)')),
                                choose([choose(animals), choose(loc('TickerList (Temple4)'))])
                            ])
					    ]))
                    }
					if (Game.Objects['Wizard tower'].amount > 0) {
                        list.push(NEWS + choose([
                            ...loc('Ticker (Wizard tower)'),
                            loc('all %1 turned into %2 in freak magic catastrophe!', [
                                choose([choose(animals), choose(loc('TickerList (Wizard tower)'))]),
                                choose([choose(animals), choose(loc('TickerList (Wizard tower)'))])
                            ]),
                            loc('heavy dissent rages between the schools of %1 magic and %2 magic!', [choose(loc('TickerList (Wizard tower2)')), choose(loc('TickerList (Wizard tower2)'))])
                        ]))
                    }
					if (Game.season == 'halloween' && Game.cookiesEarned >= 1000) list.push(NEWS + choose(loc('Ticker (Halloween)')))
					if (Game.season == 'christmas' && Game.cookiesEarned >= 1000) list.push(NEWS + choose(loc('Ticker (Christmas)')))
					if (Game.season == 'valentines' && Game.cookiesEarned >= 1000) list.push(NEWS + choose(loc('Ticker (Valentines)')))
					if (Game.season == 'easter' && Game.cookiesEarned >= 1000) list.push(NEWS + choose(loc('Ticker (Easter)')))
				}
				if (Math.random() < 0.05) {
						if (Game.HasAchiev('Base 10')) list.push(NEWS + loc('cookie manufacturer completely forgoes common sense, lets strange obsession with round numbers drive building decisions!'))
						if (Game.HasAchiev('From scratch')) list.push(NEWS + loc('follow the tear-jerking, riches-to-rags story about a local cookie manufacturer who decided to give it all up!'))
						if (Game.HasAchiev('A world filled with cookies')) list.push(NEWS + loc('known universe now jammed with cookies! No vacancies!'))
						if (Game.HasAchiev('Last Chance to See')) list.push(NEWS + loc('incredibly rare albino wrinkler on the brink of extinction poached by cookie-crazed pastry magnate!'))
						if (Game.Has('Serendipity')) list.push(NEWS + loc('local cookie manufacturer becomes luckiest being alive!'))
						if (Game.Has('Season switcher')) list.push(NEWS + loc('seasons are all out of whack! "We need to get some whack back into them seasons", says local resident.'))
						if (Game.Has('Kitten helpers')) list.push(NEWS + loc('faint meowing heard around local cookie facilities; suggests new ingredient being tested.'))
						if (Game.Has('Kitten workers')) list.push(NEWS + loc('crowds of meowing kittens with little hard hats reported near local cookie facilities.'))
						if (Game.Has('Kitten engineers')) list.push(NEWS + loc('surroundings of local cookie facilities now overrun with kittens in adorable little suits. Authorities advise to stay away from the premises.'))
						if (Game.Has('Kitten overseers')) list.push(NEWS + loc('locals report troupe of bossy kittens meowing adorable orders at passersby.'))
						if (Game.Has('Kitten managers')) list.push(NEWS + loc('local office cubicles invaded with armies of stern-looking kittens asking employees "what\'s happening, meow".'))
						if (Game.Has('Kitten accountants')) list.push(NEWS + loc('tiny felines show sudden and amazing proficiency with fuzzy mathematics and pawlinomials, baffling scientists and pet store owners.'))
						if (Game.Has('Kitten specialists')) list.push(NEWS + loc('new kitten college opening next week, offers courses on cookie-making and catnip studies.'))
						if (Game.Has('Kitten experts')) list.push(NEWS + loc('unemployment rates soaring as woefully adorable little cats nab jobs on all levels of expertise, says study.'))
						if (Game.Has('Kitten consultants')) list.push(NEWS + loc('"In the future, your job will most likely be done by a cat", predicts suspiciously furry futurologist.'))
						if (Game.Has('Kitten assistants to the regional manager')) list.push(NEWS + loc('strange kittens with peculiar opinions on martial arts spotted loitering on local beet farms!'))
						if (Game.Has('Kitten marketeers')) list.push(NEWS + loc('nonsensical kitten billboards crop up all over countryside, trying to sell people the cookies they already get for free!'))
						if (Game.Has('Kitten analysts')) list.push(NEWS + loc('are your spending habits sensible? For a hefty fee, these kitten analysts will tell you!'))
						if (Game.Has('Kitten executives')) list.push(NEWS + loc('kittens strutting around in hot little business suits shouting cut-throat orders at their assistants, possibly the cutest thing this reporter has ever seen!'))
						if (Game.Has('Kitten admins')) list.push(NEWS + loc('all systems nominal, claim kitten admins obviously in way over their heads.'))
						if (Game.Has('Kitten angels')) list.push(NEWS + loc('"Try to ignore any ghostly felines that may be purring inside your ears," warn scientists. "They\'ll just lure you into making poor life choices."'))
						if (Game.Has('Kitten wages')) list.push(NEWS + loc('kittens break glass ceiling! Do they have any idea how expensive those are!'))
						if (Game.HasAchiev('Jellicles')) list.push(NEWS + loc('local kittens involved in misguided musical production, leave audience perturbed and unnerved.'))
				}
				if (Game.HasAchiev('Dude, sweet') && Math.random() < 0.2) {
                    list.push(NEWS + choose([
                        ...loc('Ticker (Dude, sweet)'),
                        loc('major sugar-smuggling ring dismantled by authorities; %1 tons of sugar lumps seized, %2 suspects apprehended.', [Math.floor(Math.random() * 30 + 3), Math.floor(Math.random() * 48 + 2)]),
                        loc('pro-diabetes movement protests against sugar-shaming. "I\'ve eaten nothing but sugar lumps for the past %1 years and I\'m feeling great!", says woman with friable skin.', Math.floor(Math.random() * 10 + 4))
				    ]))
                }
				if (Math.random() < 0.001) {
					list.push(choose(loc('Ticker (Rare)')))
				}
				if (Game.cookiesEarned >= 10000) {
                    list.push(
                        NEWS + choose([
                            loc('cookies found to %1 in %2!', [choose(loc('TickerList (misc1)')), choose(animals)]),
                            loc('cookies found to make %1 %2!', [choose(animals), choose(loc('TickerList (misc2)'))]),
                            loc('cookies tested on %1, found to have no ill effects.', choose(animals)),
                            loc('cookies unexpectedly popular among %1!', choose(animals)),
                            loc('unsightly lumps found on %1 near cookie facility; "they\'ve pretty much always looked like that", say biologists.', choose(animals)),
                            loc('new species of %1 discovered in distant country; "yup, tastes like cookies", says biologist.', choose(animals)),
                            loc('cookies go well with %1, says controversial chef.', choose([
                                choose(loc('TickerList (misc3)')) + choose(animals),
                                loc('%1 made from %2', [choose(loc('TickerList (misc4)')), choose(animals)])
                            ])),
                            loc('"do your cookies contain %1?", asks PSA warning against counterfeit cookies.', choose(animals)),
                            ...loc('Ticker (misc)').slice(0, 3)
						]),
					    NEWS + choose(loc('Ticker (misc)').slice(4)),
                        NEWS + choose([
                            ...loc('Ticker (misc2)'),
                            loc('cookies now more popular than %1, says study.', loc('TickerList (misc5)')),
                            loc('obesity epidemic strikes nation; experts blame %1.', loc('TickerList (misc6)'))
                        ]),
                        NEWS + choose([
                            ...loc('Ticker (misc3)'),
                            choose(loc('Ticker (misc4)')),
                            loc('cookies could be the key to %1, say scientists.', choose(loc('TickerList (misc7)'))),
                            loc('flavor text %1, study finds.', choose(loc('TickerList (misc8)')))
                        ]),
                        NEWS + choose([
                            ...loc('Ticker (misc5)'),
                            loc('%1-brand cookies \"%2 than competitors\", says consumer survey.', [Game.bakeryName, choose(loc('TickerList (misc9)'))]),
                            loc('"%1" set to be this year\'s most popular baby name.', Game.bakeryName),
                            loc('new popularity survey says %1\'s the word when it comes to cookies.', Game.bakeryName),
                            loc('major city being renamed %1ville after world-famous cookie manufacturer.', Game.bakeryName),
                            loc('%1 to be named after %2, the world-famous cookie manufacturer.', [choose([...loc('TickerList (misc9)'), loc('new species of %1', choose(animals))]), Game.bakeryName]),
                            loc('don\'t miss tonight\'s biopic on %1\'s irresistible rise to success!', Game.bakeryName),
                            loc('don\'t miss tonight\'s interview of %1 by %2!', [Game.bakeryName, choose(...loc('TickerList (misc11)'), loc('%1\'s own evil clone', Game.bakeryName))]),
                        ]),
                        NEWS + choose([
                            loc('nation cheers as legislators finally outlaw %1!', choose(loc('TickerList (misc12)'))),
                            loc('%1 %2 goes on journey of introspection, finds cookies : "I honestly don\'t know what I was expecting."', [choose(loc('TickerList (misc13)')), choose(loc('TickerList (misc14)'))]),
                            loc('%1 wakes up from coma, %2', [choose(loc('TickerList (misc14)')), choose(loc('TickerList (misc15)'))]),
                            loc('pet %1, dangerous fad or juicy new market?', choose(animals)),
                            loc('"average person bakes %1 cookie%2 a year" factoid actually just statistical error; %3, who has produced %4 cookies in their lifetime, is an outlier and should not have been counted.', [
                                Beautify(Math.ceil(Game.cookiesEarned / 7300000000)),
                                Math.ceil(Game.cookiesEarned / 7300000000) == 1 ? '' : 's',
                                Game.bakeryName,
                                Beautify(Game.cookiesEarned)
                            ])
						])
					)
				}
			}
			if (list.length == 0) {
				if (loreProgress <= 0) list.push(loc('You feel like making cookies. But nobody wants to eat your cookies.'))
				else if (loreProgress <= 1) list.push(loc('Your first batch goes to the trash. The neighborhood raccoon barely touches it.'))
				else if (loreProgress <= 2) list.push(loc('Your family accepts to try some of your cookies.'))
				else if (loreProgress <= 3) list.push(loc('Your cookies are popular in the neighborhood.'), loc('People are starting to talk about your cookies.'))
				else if (loreProgress <= 4) list.push(loc('Your cookies are talked about for miles around.'), loc('Your cookies are renowned in the whole town!'))
				else if (loreProgress <= 5) list.push(loc('Your cookies bring all the boys to the yard.'), loc('Your cookies now have their own website!'))
				else if (loreProgress <= 6) list.push(loc('Your cookies are worth a lot of money.'), loc('Your cookies sell very well in distant countries.'))
				else if (loreProgress <= 7) list.push(loc('People come from very far away to get a taste of your cookies.'), loc('Kings and queens from all over the world are enjoying your cookies.'))
				else if (loreProgress <= 8) list.push(loc('There are now museums dedicated to your cookies.'), loc('A national day has been created in honor of your cookies.'))
				else if (loreProgress <= 9) list.push(loc('Your cookies have been named a part of the world wonders.'), loc('History books now include a whole chapter about your cookies.'))
				else if (loreProgress <= 10) list.push(loc('Your cookies have been placed under government surveillance.'), loc('The whole planet is enjoying your cookies!'))
				else if (loreProgress <= 11) list.push(loc('Strange creatures from neighboring planets wish to try your cookies.'), loc('Elder gods from the whole cosmos have awoken to taste your cookies.'))
				else if (loreProgress <= 12) list.push(loc('Beings from other dimensions lapse into existence just to get a taste of your cookies.'), loc('Your cookies have achieved sentience.'))
				else if (loreProgress <= 13) list.push(loc('The universe has now turned into cookie dough, to the molecular level.'), loc('Your cookies are rewriting the fundamental laws of the universe.'))
				else if (loreProgress <= 14) list.push(loc('A local news station runs a 10-minute segment about your cookies. Success!<br><small>(you win a cookie)</small>'), loc('it\'s time to stop playing'))
			}
			if (Game.elderWrath > 0 && (((Game.pledges == 0 && Game.resets == 0) && Math.random() < 0.3) || Math.random() < 0.03)) {
				list = []
				if (Game.elderWrath == 1) list.push(NEWS + choose(loc('Ticker (grandma invasion start)')))
				if (Game.elderWrath == 2) list.push(NEWS + choose(loc('Ticker (grandma invasion rise)')))
				if (Game.elderWrath == 3) list.push(NEWS + choose(loc('Ticker (grandma invasion full)')))
			}
			if (Game.season == 'fools') {
				list = []
				if (Game.cookiesEarned >= 1000) {
                    list.push(choose([
					    choose(loc('Ticker (Business)')),
					    parseLoc(choose(loc('Ticker (Business2)')), choose(loc('TickerList (Business1)'))),
					    loc('The word of the day is: %1.', choose(loc('TickerList (Business2)')))
				    ]))
                }
				if (Game.cookiesEarned >= 1000 && Math.random() < 0.05) {
                    list.push(choose([
                        ...loc('Ticker (Business Rare)'),
                        loc('There is an idea of a %1. Some kind of abstraction. But there is no real you, only an entity. Something illusory.', Game.bakeryName)
				    ]))
                }
				if (Game.TickerN % 2 == 0) {
                    for (let obj in Game.Objects) {
                        if (obj != 'Cursor' && obj != 'Cortex baker' && Game.Objects[obj].amount > 0) {
                            list.push(choose(loc(`Ticker (Business ${obj})`)))
                        }
                    }
					if (Game.Objects['Grandma'].amount > 0) list.push(choose(loc('Ticker (Business Grandma2)')))
					if (Game.Objects['Cortex baker'].amount > 0) {
                        list.push(choose([
                            ...loc('Ticker (Bussiness Cortex baker)'),
                            loc('Bold new law proposal would grant default ownership of every new idea by anyone anywhere to %1\'s bakery!', Game.bakeryName)
					    ]))
                    }
				}
				if (loreProgress <= 0) list.push(loc('Such a grand day to begin a new business.'))
				else if (loreProgress <= 1) list.push(loc('You\'re baking up a storm!'))
				else if (loreProgress <= 2) list.push(loc('You are confident that one day, your cookie company will be the greatest on the market!'))
				else if (loreProgress <= 3) list.push(loc('Business is picking up!'))
				else if (loreProgress <= 4) list.push(loc('You\'re making sales left and right!'))
				else if (loreProgress <= 5) list.push(loc('Everyone wants to buy your cookies!'))
				else if (loreProgress <= 6) list.push(loc('You are now spending most of your day signing contracts!'))
				else if (loreProgress <= 7) list.push(loc('You\'ve been elected "business tycoon of the year"!'))
				else if (loreProgress <= 8) list.push(loc('Your cookies are a worldwide sensation! Well done, old chap!'))
				else if (loreProgress <= 9) list.push(loc('Your brand has made its way into popular culture. Children recite your slogans and adults reminisce them fondly!'))
				else if (loreProgress <= 10) list.push(loc('A business day like any other. It\'s good to be at the top!'))
				else if (loreProgress <= 11) list.push(loc('You look back on your career. It\'s been a fascinating journey, building your baking empire from the ground up.'))
			}
			
			for (let i = 0; i < Game.modHooks['ticker'].length; i++) {
				let arr = Game.modHooks['ticker'][i]()
				if (arr) list = list.concat(arr)
			}
			Game.TickerEffect = 0
			if (!manual && Game.T > Game.fps * 10 && Game.Has('Fortune cookies') && Math.random() < (Game.HasAchiev('O Fortuna') ? 0.04 : 0.02)) {
				let fortunes = []
				for (let i in Game.Tiers['fortune'].upgrades) {
					let it = Game.Tiers['fortune'].upgrades[i]
					if (!Game.HasUnlocked(it.name)) fortunes.push(it)
				}
				if (!Game.fortuneGC) fortunes.push('fortuneGC')
				if (!Game.fortuneCPS) fortunes.push('fortuneCPS')
				if (fortunes.length > 0) {
					list = []
					let me = choose(fortunes)
					Game.TickerEffect = {type: 'fortune', sub: me}
					if (me == 'fortuneGC') me = loc('Today is your lucky day!')
					else if (me == 'fortuneCPS') {
                        Math.seedrandom(Game.seed + '-fortune')
                        me = `${loc('Your lucky numbers are:')} ${Math.floor(Math.random() * 100)} ${Math.floor(Math.random() * 100)} ${Math.floor(Math.random() * 100)} ${Math.floor(Math.random() * 100)}`
                        Math.seedrandom()
                    } else {
						me = me.dname.substring(me.name.indexOf('#')) + ' : ' + me.baseDesc.substring(me.baseDesc.indexOf('<q>') + 3)
						me = me.substring(0, me.length - 4)
					}
					me = `<span class="fortune"><div class="icon" style="vertical-align:middle;display:inline-block;background-position:${-29 * 48}px ${-8 * 48}px;transform:scale(0.5);margin:-16px;position:relative;left:-4px;top:-2px;"></div>${me}</span>`
					list = [me]
				}
			}
			if (Game.windowW < Game.tickerTooNarrow) list = ['<div style="transform:scale(0.8,1.2);">' + NEWS + loc('help me!') + '</div>']
			Game.TickerAge = Game.fps * 10
			Game.Ticker = choose(list)
			Game.AddToLog(Game.Ticker)
			Game.TickerN++
			Game.TickerDraw()
		}

        // 英語以外でも施設固有の生産方法をツールチップに表示
        for (let i in Game.Objects) {
            let obj = Game.Objects[i]
            if (typeof(betterJapanese.origins.tooltip) === 'undefined') {
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
            if (typeof(betterJapanese.origins.levelTooltip) === 'undefined') {
                betterJapanese.origins.levelTooltip = obj.levelTooltip
            }
            obj.levelTooltip = function() {
                const strDivLine = '<div class="line"></div>'
                let defaultTooltip = betterJapanese.origins.levelTooltip.bind(this)().split(strDivLine)
                defaultTooltip[1] = `${loc(this.extraName.replace('[X]', '%1'), Beautify(this.level))} ${loc('Granting <b>+%1% %2 CpS</b>.', [Beautify(this.level), this.single])}`
                return defaultTooltip.join(strDivLine)
            }
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
