# BetterJapanese
![GitHub release (latest by date)](https://img.shields.io/github/v/release/hideki0403/better-japanese)
[![CodeFactor](https://www.codefactor.io/repository/github/hideki0403/better-japanese/badge)](https://www.codefactor.io/repository/github/hideki0403/better-japanese)  

[![Create Release](https://github.com/hideki0403/better-japanese/actions/workflows/release.yml/badge.svg)](https://github.com/hideki0403/better-japanese/actions/workflows/release.yml)
[![Publish new locales](https://github.com/hideki0403/better-japanese/actions/workflows/publish.yml/badge.svg)](https://github.com/hideki0403/better-japanese/actions/workflows/publish.yml)
[![pages-build-deployment](https://github.com/hideki0403/better-japanese/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/hideki0403/better-japanese/actions/workflows/pages/pages-build-deployment)  

Web/Steam版CookieClickerの公式日本語訳などを全面的に改善するMod


## 使い方 (Web版)
### ブックマーク
ブラウザのブックマークを使用する方法です。  
以下の文字列をコピーしてブックマークに登録し、[CookieClicker](https://orteil.dashnet.org/cookieclicker/)を開いてから登録したブックマークをクリックすることでModを使用できます。  
この方法はブラウザの拡張機能を導入する必要がなく簡単に使用することができますが、ゲームを開く度に操作が必要なのでヘビーユーザーの方はUserscriptを使用した方法がオススメです。
```js
javascript: (function(){Game.LoadMod('https://pages.yukineko.me/better-japanese/mod.js')})();
```

### Userscript (おすすめ)
Tampermonkeyなどのuserscript対応のブラウザ拡張機能を使用する方法です。  
拡張機能をインストールした後に[こちら](https://pages.yukineko.me/better-japanese/BetterJapanese.user.js)から導入することが出来ます。  
この方法はブラウザの拡張機能を導入する必要がありますが、ゲームを開く度にModを読み込む操作が必要なくなるのでヘビーユーザーの方にはオススメです。

### Webサイトに埋め込む
自身でホストしているサイトに導入する方法です。  
1. [最新のRelease](https://github.com/hideki0403/better-japanese/releases/)のAssetsから`JA.js`をダウンロードします。
2. 自身でホストしているCookieClickerのサイトの`loc`ディレクトリにある`JA.js`を`JA_fallback.js`に変更します。
3. 先程ダウンロードした`JA.js`を`loc`ディレクトリにコピーします。
  
この方法は自身でCookieClickerのクローンをホストしている場合などに使用できる方法で、ユーザーは操作をすることなくModを使用することが出来ます。  

## 使い方 (Steam版)
### Workshop (おすすめ)
SteamのWorkshopを利用してModを導入する方法です。  
[こちらの記事](https://steamcommunity.com/sharedfiles/filedetails/?id=2820593054)に詳しい導入方法が記載されています。

### 手動で導入する
手動でCookieClickerのmodsディレクトリに導入する方法です。  
1. [最新のRelease](https://github.com/hideki0403/better-japanese/releases/)のAssetsから`better-japanese.zip`をダウンロードします。
2. 先程ダウンロードした`better-japanese.zip`を解凍し、`Steam/steamapps/common/Cookie Clicker/resources/app/mods/local`にコピーします。

## 開発/翻訳
開発や翻訳については[こちら](https://github.com/hideki0403/better-japanese/wiki/%E9%96%8B%E7%99%BA%E3%83%BB%E7%BF%BB%E8%A8%B3%E3%82%92%E8%A1%8C%E3%81%86)をご覧ください。

## スペシャルサンクス
- [NATTO](https://twitter.com/LPerNATTO)様 (日本語訳の提供)

## 謝辞
このModを作成するにあたり、以下のWebサイトを参考にさせて頂きました。  
この場をお借りして感謝申し上げます。  

- [Cookie Clicker 日本語Wiki](https://w.atwiki.jp/cookieclickerjpn/)
- [CookieClicker 日本語版](https://natto0wtr.web.fc2.com/CookieClicker/)