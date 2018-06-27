// ==UserScript==
// @name         FCoin Helper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add total amount for FCoin exchnage finance
// @supportURL   https://github.com/yanghuan/FCoin-Helper/issues
// @contributionURL    https://github.com/yanghuan/FCoin-Helper#crypto
// @author       YANG Huan
// @match        https://exchange.fcoin.com/finance
// @require      https://cdn.bootcss.com/jquery/1.8.3/jquery.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var tokens = [];
    var curPrices = {};
    function check() {
        let rts =  $(".rt-tbody");
        let trs = rts.children(".rt-tr-group");
        if (trs.length > 0) {
            let list = []
            trs.each(function () {
                let tds = $(this).find(".rt-td");
                let symbol = $(tds[0]).children().text();
                let count = $(tds[1]).children().text();
                let remain = $(tds[2]).children().text();
                tokens.push({ "symbol": symbol, "count": count, "remain": remain });
            });
            getPricesFromWebSocket();
        } else {
            registerCheck();
        }
    }
    function registerCheck() {
        setTimeout(check, 1000);
    }
    function getPricesFromWebSocket() {
        let webSocket = new WebSocket("wss://ws.fcoin.com/api/v2/ws");
        webSocket.binaryType = "arraybuffer";
        webSocket.onopen = function(event){
            console.log(("webSocket connect at time: "+new Date()));
            var sub_tickers = {
                "id":'tickers',
                "cmd": "sub",
                "args": ['all-tickers']
            };
            webSocket.send(JSON.stringify(sub_tickers));
        };
        webSocket.onmessage = function(event){
            let raw_data = event.data;
            let data = JSON.parse(raw_data);
            if (data.topic == 'all-tickers') {
                if (data.tickers.length > 0) {
                    for (let i = 0; i < data.tickers.length; i++) {
                        let ticker = data.tickers[i];
                        let symbol = ticker.symbol;
                        let price = ticker.ticker[0];
                        if (symbol == "ethusdt") {
                            if (price != null) {
                              curPrices.eth = price;
                            }
                        }
                        else if (symbol == "btcusdt") {
                            if (price != null) {
                              curPrices.btc = price;
                            }
                        }
                        else if (symbol == "ftusdt") {
                            if (price != null) {
                              curPrices.ft = price;
                            }
                        }
                        updatePrice(symbol, price);
                    }
                }
            }
        };
        webSocket.onclose = function() {
            console.log("webSocket connect is closed");
            console.log(arguments);
            getPricesFromWebSocket();
        };
        webSocket.onerror = function(){
            console.log("error");
            console.log(arguments);
            getPricesFromWebSocket();
        };
        setInterval(function () {
            webSocket.send(JSON.stringify({"cmd": "ping","args":[ Date.parse(new Date())]}));
        }, 40000);
    }
    function spltSymbol(symbol) {
        let len = symbol.length;
        let last = symbol[len - 1];
        let token, price;
        if (last == "c") {
            token = symbol.substr(0, len - 3);
            price = "btc";
        }
        else if (last == "h") {
            token = symbol.substr(0, len - 3);
            price = "eth";
        }
        else if (last == "t") {
            let prevLast = symbol[len - 2];
            if (prevLast == "d") {
                token = symbol.substr(0, len - 4);
                price = "usdt";
            }
            else {
                token = symbol.substr(0, len - 2);
                price = "ft";
            }
        }
        return [token, price];
    }
    function updatePrice(symbol, price) {
        let a = spltSymbol(symbol);
        let token = a[0];
        let priceToken = a[1];
        let info = tokens.find(i => i.symbol == token);
        if (info != null) {
            info["@" + priceToken] = price;
            update();
        }
        else {
            console.wran(`${token} is not found in finance`);
        }
    }
    function getPriceOfUSDT(t) {
        if (t.symbol == "usdt") {
            return 1;
        }
        let usdt = t["@usdt"];
        if (usdt != null) {
            return usdt;
        }
        let btc = t["@btc"];
        if (btc != null) {
            return btc * curPrices.btc;
        }
        let eth = t["@eth"];
        if (eth != null) {
            return eth * curPrices.eth;
        }
        let ft = t["@ft"];
        if (ft != null) {
            return ft * curPrices.ft;
        }
        return null;
    }
    function getTotalUSDT() {
        let total = 0;
        for (let i = 0; i < tokens.length; ++i) {
            let t = tokens[i];
            let p = getPriceOfUSDT(t);
            if (p == null) {
              return null;
            }
            let money = parseFloat(t.count) * p;
            total += money;
        }
        return total;
    }
    function show(datas) {
        let s = datas.join("/ ");
        let capital = $(".hscFzz");
        let span = capital.children("span");
        if (span.length > 0) {
            span.html(s);
        }
        else {
            capital.append(`<span>${s}</span>`);
        }
    }
    function update() {
        let datas = []
        let usdt = getTotalUSDT();
        if (usdt != null) {
          let usdtString = `  ${usdt.toFixed(2)} usdt`;
          datas.push(usdtString);
          let btcString = `${(usdt / curPrices.btc).toFixed(4)} btc`;
          datas.push(btcString);
          let ethString = `${(usdt / curPrices.eth).toFixed(4)} eth`;
          datas.push(ethString);
          show(datas);
        }
    }
    $(function () {
        registerCheck();
        //debugger;
    });
})();
